"""
Plan balanced E2E shards from historical case durations.

Reads tests/e2e/case_weights.json ({case: seconds}) and partitions cases into
N shards using Longest Processing Time (LPT) — a greedy 4/3-approximation of
multiway-partition. Output is the GitHub Actions matrix `include` JSON.

Usage:
    python tests/e2e/plan_shards.py --shards 2
    # Optional: restrict to a subset
    python tests/e2e/plan_shards.py --shards 2 --only invalid-params,shared-link

Emits to stdout:
    {"include":[{"shard":"shard-1","cases":"shared-link,clean-url","weight":16.5}, ...]}

When invoked inside GitHub Actions, also writes
  matrix=<json>
to $GITHUB_OUTPUT so it can feed `strategy.matrix.include`.
"""

from __future__ import annotations

import argparse
import heapq
import json
import os
import sys
from pathlib import Path

WEIGHTS_FILE = Path(__file__).with_name("case_weights.json")


def load_weights() -> dict[str, float]:
    data = json.loads(WEIGHTS_FILE.read_text(encoding="utf-8"))
    return {k: float(v) for k, v in data.items() if not k.startswith("_")}


def plan(weights: dict[str, float], shards: int) -> list[dict]:
    # LPT: sort cases by weight desc; assign each to the currently lightest shard.
    sorted_cases = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)
    heap: list[tuple[float, int, list[str]]] = [(0.0, i, []) for i in range(shards)]
    heapq.heapify(heap)
    for name, w in sorted_cases:
        total, idx, bucket = heapq.heappop(heap)
        bucket.append(name)
        heapq.heappush(heap, (total + w, idx, bucket))
    out: list[dict] = []
    for total, idx, bucket in sorted(heap, key=lambda x: x[1]):
        if not bucket:
            continue
        out.append({
            "shard": f"shard-{idx+1}",
            "cases": ",".join(bucket),
            "weight": round(total, 2),
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shards", type=int, default=2)
    ap.add_argument("--only", type=str, default="")
    args = ap.parse_args()

    weights = load_weights()
    if args.only:
        keep = {s.strip() for s in args.only.split(",") if s.strip()}
        weights = {k: v for k, v in weights.items() if k in keep}
        missing = keep - set(weights)
        if missing:
            print(f"warn: missing weights for: {sorted(missing)} (treated as 1.0)", file=sys.stderr)
            for m in missing:
                weights[m] = 1.0

    shards = max(1, min(args.shards, len(weights) or 1))
    include = plan(weights, shards)
    matrix = {"include": include}
    payload = json.dumps(matrix, separators=(",", ":"))
    print(payload)

    gh_output = os.environ.get("GITHUB_OUTPUT")
    if gh_output:
        with open(gh_output, "a", encoding="utf-8") as fh:
            fh.write(f"matrix={payload}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
