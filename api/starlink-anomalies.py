import base64
import json
import os
import time
from http import HTTPStatus
from typing import Dict, List
from urllib.parse import parse_qs

import numpy as np
import pandas as pd
import requests
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


def fetch_from_netdata(chart: str, seconds: int, points: int) -> pd.Series:
    base = NETDATA_URL.rstrip("/")
    if not base:
        return pd.Series(dtype="float64")
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
    if not data:
        return pd.Series(dtype="float64")
    timestamps = [row[0] * 1000 for row in data]
    values = [row[1] for row in data]
    index = pd.to_datetime(timestamps, unit="ms", utc=True)
    return pd.Series(values, index=index, dtype="float64")


def fetch_from_prometheus(chart: str, seconds: int, points: int) -> pd.Series:
    if not PROM_URL:
        return pd.Series(dtype="float64")

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
        return pd.Series(dtype="float64")

    first = result[0]
    values = first.get("values", [])
    if not values:
        return pd.Series(dtype="float64")

    timestamps = [float(item[0]) for item in values]
    series_values = [float(item[1]) for item in values]
    index = pd.to_datetime(timestamps, unit="s", utc=True)
    return pd.Series(series_values, index=index, dtype="float64")


def fetch_chart(chart: str, seconds: int, points: int) -> pd.Series:
    netdata_error: Exception | None = None
    prom_error: Exception | None = None

    try:
        netdata_series = fetch_from_netdata(chart, seconds, points)
        if not netdata_series.empty:
            return netdata_series
    except RequestException as exc:
        netdata_error = exc
    except ValueError as exc:
        netdata_error = exc

    try:
        prom_series = fetch_from_prometheus(chart, seconds, points)
        if not prom_series.empty:
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

    return pd.Series(dtype="float64")


def robust_zscore(series: pd.Series, window: int) -> pd.Series:
    clean = series.dropna()
    if clean.empty or len(clean) < window:
        return pd.Series(dtype="float64")
    median = clean.rolling(window, min_periods=window).median()
    mad = clean.rolling(window, min_periods=window).apply(
        lambda x: np.median(np.abs(x - np.median(x))), raw=True
    )
    mad_adjusted = mad * 1.4826
    denom = mad_adjusted.replace({0: np.nan})
    z = (clean - median) / denom

    needs_fallback = z.isna() | ~np.isfinite(z)
    if needs_fallback.any():
        std = clean.rolling(window, min_periods=window).std(ddof=0)
        std = std.replace({0: np.nan})
        fallback = (clean - median) / std
        z = z.where(~needs_fallback, fallback)

    return z.dropna()


def detect_anomalies(series: pd.Series, window: int, threshold: float) -> pd.Series:
    zscores = robust_zscore(series, window)
    if zscores.empty:
        return pd.Series(dtype="float64")
    mask = zscores.abs() >= threshold
    return zscores[mask]


def aggregate_score(zscore_frames: List[pd.Series]) -> pd.Series:
    if not zscore_frames:
        return pd.Series(dtype="float64")
    df = pd.concat(zscore_frames, axis=1).abs()
    max_score = df.max(axis=1)
    return np.clip(max_score * 10, 0, 100)


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

        series_payload = {}
        events_payload = []
        zscore_frames = []

        for label, chart in STARLINK_CHARTS.items():
            series = fetch_chart(chart, seconds=seconds, points=points)
            zscores = robust_zscore(series, window)
            if not zscores.empty:
                zscore_frames.append(zscores)
            anomalies = detect_anomalies(series, window, threshold)
            series_payload[label] = {
                "timestamps": [int(ts.value // 10**6) for ts in series.index],
                "values": [float(v) for v in series.values],
                "zscores": [float(zscores.get(ts, 0.0)) for ts in series.index],
            }
            for ts, z in anomalies.items():
                events_payload.append(
                    {
                        "metric": label,
                        "timestamp": int(ts.value // 10**6),
                        "iso": ts.isoformat(),
                        "value": float(series.loc[ts]),
                        "zscore": float(z),
                    }
                )

        combined = aggregate_score(zscore_frames)
        combined_payload = {
            "timestamps": [int(ts.value // 10**6) for ts in combined.index],
            "values": [float(v) for v in combined.values],
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

