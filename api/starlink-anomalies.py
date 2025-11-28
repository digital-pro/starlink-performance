import base64
import json
import os
import time
from collections import defaultdict
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Dict, List, Tuple
from urllib.parse import parse_qs

import numpy as np
import requests
from numpy.lib.stride_tricks import sliding_window_view
from requests import RequestException

NETDATA_URL = os.environ.get("NETDATA_URL", "http://127.0.0.1:19999")
STARLINK_CHARTS: Dict[str, str] = {
    "downlink": "starlink_dish_downlink_throughput_bytes",
    "uplink": "starlink_dish_uplink_throughput_bytes",
    "latency": "starlink_dish_pop_ping_latency_ms",
    "loss": "starlink_dish_pop_ping_drop_ratio",
    "obstruction": "starlink_dish_fraction_obstruction_ratio",
}

PROM_URL_RAW = os.environ.get("PROM_URL", "").strip()
if PROM_URL_RAW:
    _normalized = PROM_URL_RAW.rstrip("/")
    PROM_URL = _normalized if _normalized.endswith("/api/v1") else f"{_normalized}/api/v1"
else:
    PROM_URL = ""

PROM_BASIC = os.environ.get("PROM_BASIC")
PROM_BEARER = os.environ.get("PROM_BEARER")
PROM_USER = os.environ.get("PROM_USER")
PROM_TOKEN = os.environ.get("PROM_TOKEN")
PROM_SCOPE = (
    os.environ.get("PROM_SCOPE_ID")
    or os.environ.get("GRAFANA_SCOPE_ID")
    or (PROM_USER if PROM_USER else None)
)

PROM_QUERY_OVERRIDES: Dict[str, str] = {
    # Netdata charts expose bytes-per-second; Prometheus recording rules store identical names.
    "starlink_dish_downlink_throughput_bytes": "starlink_dish_downlink_throughput_bytes",
    "starlink_dish_uplink_throughput_bytes": "starlink_dish_uplink_throughput_bytes",
    "starlink_dish_pop_ping_latency_ms": "starlink_dish_pop_ping_latency_ms",
    "starlink_dish_pop_ping_drop_ratio": "starlink_dish_pop_ping_drop_ratio",
    "starlink_dish_fraction_obstruction_ratio": "starlink_dish_fraction_obstruction_ratio",
}


class TimeSeries:
    __slots__ = ("timestamps", "values")

    def __init__(self, timestamps, values):
        self.timestamps = np.asarray(timestamps, dtype=np.int64)
        self.values = np.asarray(values, dtype=np.float64)
        if self.timestamps.shape != self.values.shape:
            raise ValueError("Timestamp/value length mismatch")

    @classmethod
    def empty(cls) -> "TimeSeries":
        return cls(np.array([], dtype=np.int64), np.array([], dtype=np.float64))

    @property
    def is_empty(self) -> bool:
        return self.timestamps.size == 0

    def drop_invalid(self) -> "TimeSeries":
        if self.is_empty:
            return self
        mask = np.isfinite(self.values)
        if mask.all():
            return TimeSeries(self.timestamps.copy(), self.values.copy())
        return TimeSeries(self.timestamps[mask], self.values[mask])

    def as_lists(self) -> Tuple[List[int], List[float]]:
        return (
            self.timestamps.astype(np.int64).tolist(),
            self.values.astype(float).tolist(),
        )

    def to_value_map(self) -> Dict[int, float]:
        return {int(ts): float(val) for ts, val in zip(self.timestamps, self.values)}


def prom_headers() -> Dict[str, str]:
    headers: Dict[str, str] = {}
    if PROM_BASIC:
        headers["Authorization"] = f"Basic {PROM_BASIC}"
    elif PROM_BEARER:
        headers["Authorization"] = f"Bearer {PROM_BEARER}"
    elif PROM_USER and PROM_TOKEN:
        basic = base64.b64encode(f"{PROM_USER}:{PROM_TOKEN}".encode("utf-8")).decode("utf-8")
        headers["Authorization"] = f"Basic {basic}"
    if PROM_SCOPE:
        headers["X-Scope-OrgID"] = PROM_SCOPE
    return headers


def fetch_from_netdata(chart: str, seconds: int, points: int) -> TimeSeries:
    base = NETDATA_URL.rstrip("/")
    if not base:
        return TimeSeries.empty()
    response = requests.get(
        f"{base}/api/v1/data",
        params={
            "chart": chart,
            "after": -seconds,
            "points": points,
            "format": "json",
        },
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    data = payload.get("result", {}).get("data", [])
    entries: List[Tuple[int, float]] = []
    for row in data:
        if not isinstance(row, (list, tuple)) or len(row) < 2:
            continue
        try:
            timestamp_ms = int(float(row[0]) * 1000)
        except (TypeError, ValueError):
            continue
        value_raw = row[1]
        if value_raw is None:
            value = float("nan")
        else:
            try:
                value = float(value_raw)
            except (TypeError, ValueError):
                value = float("nan")
        entries.append((timestamp_ms, value))
    if not entries:
        return TimeSeries.empty()
    timestamps, values = zip(*entries)
    return TimeSeries(timestamps, values)


def fetch_from_prometheus(chart: str, seconds: int, points: int) -> TimeSeries:
    if not PROM_URL:
        return TimeSeries.empty()

    query = PROM_QUERY_OVERRIDES.get(chart, chart)
    seconds = max(int(seconds), 1)
    points = max(int(points), 1)
    end = int(time.time())
    start = end - seconds
    step = max(seconds // points, 1)

    response = requests.get(
        f"{PROM_URL}/query_range",
        params={"query": query, "start": start, "end": end, "step": step},
        headers=prom_headers(),
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    result = payload.get("data", {}).get("result", [])
    if not result:
        return TimeSeries.empty()

    first = result[0]
    values = first.get("values", [])
    if not values:
        return TimeSeries.empty()

    entries: List[Tuple[int, float]] = []
    for stamp, value_raw in values:
        try:
            timestamp_ms = int(float(stamp) * 1000)
        except (TypeError, ValueError):
            continue
        try:
            value = float(value_raw)
        except (TypeError, ValueError):
            value = float("nan")
        entries.append((timestamp_ms, value))
    if not entries:
        return TimeSeries.empty()
    timestamps, series_values = zip(*entries)
    return TimeSeries(timestamps, series_values)


def fetch_chart(chart: str, seconds: int, points: int) -> TimeSeries:
    netdata_error: Exception | None = None
    prom_error: Exception | None = None

    try:
        netdata_series = fetch_from_netdata(chart, seconds, points)
        if not netdata_series.is_empty:
            return netdata_series
    except RequestException as exc:
        netdata_error = exc
    except ValueError as exc:
        netdata_error = exc

    try:
        prom_series = fetch_from_prometheus(chart, seconds, points)
        if not prom_series.is_empty:
            if netdata_error:
                print(f"[starlink-anomalies] Falling back to Prometheus for '{chart}': {netdata_error}")
            return prom_series
    except RequestException as exc:
        prom_error = exc
    except ValueError as exc:
        prom_error = exc

    if netdata_error:
        print(f"[starlink-anomalies] Netdata fetch failed for '{chart}': {netdata_error}")
    if prom_error:
        print(f"[starlink-anomalies] Prometheus fetch failed for '{chart}': {prom_error}")

    return TimeSeries.empty()


def robust_zscore(series: TimeSeries, window: int) -> Dict[int, float]:
    clean = series.drop_invalid()
    if clean.is_empty or clean.values.size < window:
        return {}

    windows = sliding_window_view(clean.values, window)
    medians = np.median(windows, axis=1)
    residuals = clean.values[window - 1 :] - medians
    mad = np.median(np.abs(windows - medians[:, None]), axis=1)
    mad_adjusted = mad * 1.4826
    denom = np.where(mad_adjusted == 0, np.nan, mad_adjusted)
    z = residuals / denom

    needs_fallback = ~np.isfinite(z)
    if np.any(needs_fallback):
        std = windows.std(axis=1, ddof=0)
        std = np.where(std == 0, np.nan, std)
        fallback = residuals / std
        z = np.where(needs_fallback, fallback, z)

    valid_mask = np.isfinite(z)
    if not np.any(valid_mask):
        return {}

    timestamps = clean.timestamps[window - 1 :]
    return {int(ts): float(score) for ts, score in zip(timestamps[valid_mask], z[valid_mask])}


def detect_anomalies(series: TimeSeries, window: int, threshold: float) -> List[Tuple[int, float]]:
    zscores = robust_zscore(series, window)
    if not zscores:
        return []
    return [(ts, score) for ts, score in zscores.items() if abs(score) >= threshold]


def aggregate_score(zscore_frames: List[Dict[int, float]]) -> TimeSeries:
    if not zscore_frames:
        return TimeSeries.empty()

    combined: defaultdict[int, List[float]] = defaultdict(list)
    for frame in zscore_frames:
        for ts, score in frame.items():
            combined[int(ts)].append(abs(float(score)))

    if not combined:
        return TimeSeries.empty()

    sorted_items = sorted(combined.items())
    timestamps = np.array([ts for ts, _ in sorted_items], dtype=np.int64)
    values = np.array(
        [min(100.0, max(scores) * 10.0) for _, scores in sorted_items],
        dtype=np.float64,
    )
    return TimeSeries(timestamps, values)


print(
    "[starlink-anomalies] module import",
    {
        "has_prom_url": bool(PROM_URL),
        "has_basic": bool(PROM_BASIC),
        "has_bearer": bool(PROM_BEARER),
        "has_user_token": bool(PROM_USER and PROM_TOKEN),
        "has_scope": bool(PROM_SCOPE),
    },
    flush=True,
)


def _get_arg(args, key, default):
    if args is None:
        return default
    value = None
    if hasattr(args, "get"):
        value = args.get(key)
        if value is None and hasattr(args, "getlist"):
            values = args.getlist(key)
            value = values[0] if values else None
    elif isinstance(args, dict):
        value = args.get(key)
    if isinstance(value, (list, tuple)):
        value = value[0] if value else None
    if value is None:
        return default
    return value


def build_response(args):
    try:
        seconds = int(_get_arg(args, "seconds", "3600"))
        points = int(_get_arg(args, "points", "360"))
        threshold = float(_get_arg(args, "threshold", "3.5"))
        window = int(_get_arg(args, "window", "30"))

        series_payload: Dict[str, Dict[str, List[float]]] = {}
        events_payload: List[Dict[str, object]] = []
        zscore_frames: List[Dict[int, float]] = []

        for label, chart in STARLINK_CHARTS.items():
            series = fetch_chart(chart, seconds=seconds, points=points)
            zscores = robust_zscore(series, window)
            if zscores:
                zscore_frames.append(zscores)
            anomalies = detect_anomalies(series, window, threshold)

            timestamps_list, values_list = series.as_lists()
            series_payload[label] = {
                "timestamps": timestamps_list,
                "values": values_list,
                "zscores": [float(zscores.get(ts, 0.0)) for ts in timestamps_list],
            }

            value_map = series.to_value_map()
            for ts, score in anomalies:
                events_payload.append(
                    {
                        "metric": label,
                        "timestamp": ts,
                        "iso": datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat(),
                        "value": float(value_map.get(ts, float("nan"))),
                        "zscore": float(score),
                    }
                )

        combined = aggregate_score(zscore_frames)
        combined_payload = {
            "timestamps": combined.timestamps.astype(np.int64).tolist(),
            "values": combined.values.astype(float).tolist(),
        }

        events_payload.sort(key=lambda item: item["timestamp"])

        body = {
            "window_seconds": seconds,
            "points": points,
            "threshold": threshold,
            "window": window,
            "series": series_payload,
            "score": combined_payload,
            "events": events_payload,
        }

        return (
            json.dumps(body),
            200,
            {"Content-Type": "application/json"},
        )
    except Exception as exc:  # pragma: no cover
        import sys
        import traceback

        print(f"[starlink-anomalies] handler error: {exc}", flush=True)
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        return (
            json.dumps({"error": str(exc), "traceback": traceback.format_exc()}),
            500,
            {"Content-Type": "application/json"},
        )


def handle_request(request):
    args = getattr(request, "args", request)
    return build_response(args)


def app(environ, start_response):
    method = (environ.get("REQUEST_METHOD") or "GET").upper()
    if method not in ("GET", "HEAD"):
        body = json.dumps({"error": "Method not allowed"})
        start_response("405 Method Not Allowed", [("Content-Type", "application/json")])
        return [b"" if method == "HEAD" else body.encode("utf-8")]

    params = parse_qs(environ.get("QUERY_STRING", ""), keep_blank_values=False)
    normalized = {key: values[0] if isinstance(values, list) and values else "" for key, values in params.items()}

    body, status, headers = build_response(normalized)
    try:
        reason = HTTPStatus(status).phrase
    except ValueError:
        reason = "OK" if 200 <= status < 400 else "ERROR"

    start_response(f"{status} {reason}", list(headers.items()))
    if method == "HEAD":
        return [b""]
    return [body.encode("utf-8") if isinstance(body, str) else body]


def lambda_handler(event, context):  # pragma: no cover
    params = (event or {}).get("queryStringParameters") or {}
    body, status, headers = build_response(params)
    return {"statusCode": status, "headers": headers, "body": body}
