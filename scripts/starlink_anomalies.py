#!/usr/bin/env python3
"""
Fetch Starlink exporter metrics from Netdata and flag anomalies.

Usage:
    python scripts/starlink_anomalies.py --window 7200 --points 720 --json

Requirements:
    pip install requests pandas numpy
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Dict, Iterable, List

import numpy as np
import pandas as pd
import requests

DEFAULT_CHARTS = {
    "downlink": "starlink_dish_downlink_throughput_bytes",
    "uplink": "starlink_dish_uplink_throughput_bytes",
    "latency": "starlink_dish_pop_ping_latency_ms",
    "loss": "starlink_dish_pop_ping_drop_ratio",
    "obstruction": "starlink_dish_fraction_obstruction_ratio",
}


@dataclass
class AnomalyEvent:
    metric: str
    timestamp: pd.Timestamp
    value: float
    zscore: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "metric": self.metric,
            "timestamp": self.timestamp.isoformat(),
            "value": float(self.value),
            "zscore": float(self.zscore),
        }


NETDATA_URL = os.environ.get("NETDATA_URL", "http://127.0.0.1:19999")


def fetch_chart(
    chart: str,
    window: int,
    points: int,
) -> pd.Series:
    """Return a pandas Series indexed by UTC timestamps (ms precision)."""
    res = requests.get(
        f"{NETDATA_URL}/api/v1/data",
        params={
            "chart": chart,
            "after": -window,
            "points": points,
            "format": "json",
        },
        timeout=10,
    )
    res.raise_for_status()
    payload = res.json()
    data = payload.get("result", {}).get("data", [])
    if not data:
        return pd.Series(dtype="float64")
    timestamps = [row[0] * 1000 for row in data]
    values = [row[1] for row in data]
    index = pd.to_datetime(timestamps, unit="ms", utc=True)
    return pd.Series(values, index=index, dtype="float64")


def robust_zscore(series: pd.Series, window: int) -> pd.Series:
    """
    Rolling robust z-score using median & MAD to reduce outlier influence.
    """
    clean = series.dropna()
    if clean.empty:
        return clean
    median = clean.rolling(window, min_periods=window).median()
    mad = clean.rolling(window, min_periods=window).apply(
        lambda x: np.median(np.abs(x - np.median(x))), raw=True
    )
    # convert MAD to an equivalent std-dev (approximately)
    mad_adjusted = mad * 1.4826
    z = (clean - median) / mad_adjusted.replace({0: np.nan})
    return z.dropna()


def detect_anomalies(
    series: pd.Series,
    window: int,
    threshold: float,
    metric: str,
) -> Iterable[AnomalyEvent]:
    """
    Yield anomaly events where |robust z-score| >= threshold.
    """
    zscores = robust_zscore(series, window)
    if zscores.empty:
        return []
    mask = zscores.abs() >= threshold
    return [
        AnomalyEvent(metric=metric, timestamp=ts, value=series.loc[ts], zscore=z)
        for ts, z in zscores[mask].items()
        if ts in series.index
    ]


def aggregate_score(zscore_frames: List[pd.Series]) -> pd.Series:
    """
    Combine multiple z-score series into a single score between 0 and 100.
    """
    if not zscore_frames:
        return pd.Series(dtype="float64")
    df = pd.concat(zscore_frames, axis=1).abs()
    max_score = df.max(axis=1)
    score = np.clip(max_score * 10, 0, 100)
    return score


def run_analysis(
    charts: Dict[str, str],
    window: int,
    points: int,
    z_threshold: float,
    roll_window: int,
) -> Dict[str, List[Dict[str, float]]]:
    events: Dict[str, List[Dict[str, float]]] = {}
    zscore_series: List[pd.Series] = []
    for label, chart in charts.items():
        series = fetch_chart(chart, window=window, points=points)
        anomalies = detect_anomalies(series, roll_window, z_threshold, label)
        events[label] = [event.to_dict() for event in anomalies]
        zscores = robust_zscore(series, roll_window)
        if not zscores.empty:
            zscore_series.append(zscores)

    combined = aggregate_score(zscore_series)
    events["combined_score"] = [
        {"timestamp": ts.isoformat(), "value": float(val)}
        for ts, val in combined.items()
    ]
    return events


def main() -> None:
    parser = argparse.ArgumentParser(description="Starlink anomaly detector via Netdata")
    parser.add_argument(
        "--window",
        type=int,
        default=3600,
        help="Window size in seconds (default: 3600)",
    )
    parser.add_argument(
        "--points",
        type=int,
        default=360,
        help="Number of samples to retrieve (default: 360)",
    )
    parser.add_argument(
        "--charts",
        nargs="*",
        default=None,
        help="Specific chart IDs to analyse (default: Starlink throughput/latency/loss).",
    )
    parser.add_argument(
        "--z-threshold",
        type=float,
        default=3.5,
        help="Absolute robust z-score threshold to flag anomalies (default: 3.5)",
    )
    parser.add_argument(
        "--roll-window",
        type=int,
        default=30,
        help="Rolling window (in samples) for robust z-score (default: 30)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="output JSON instead of human readable text",
    )
    args = parser.parse_args()

    charts = DEFAULT_CHARTS
    if args.charts:
        charts = {chart: chart for chart in args.charts}

    results = run_analysis(
        charts=charts,
        window=args.window,
        points=args.points,
        z_threshold=args.z_threshold,
        roll_window=args.roll_window,
    )

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for metric, anomalies in results.items():
            if metric == "combined_score":
                continue
            print(f"{metric}: {len(anomalies)} anomalies")
            for event in anomalies[:10]:
                print(
                    f"  {event['timestamp']}  value={event['value']:.2f}  z={event['zscore']:.2f}"
                )
        combined_points = len(results.get("combined_score", []))
        print(f"\nCombined score points: {combined_points}")


if __name__ == "__main__":
    main()


