#!/usr/bin/env python3
"""Score a predictions.json (downloaded from the Eval tab, or produced by any backend
extractor, e.g. a LangChain/LangGraph pipeline) against the labelled fake dataset.

Usage:  python3 scripts/score.py predictions.json [src/data/samples.json]
Stdlib only. Same metrics as the in-browser eval (src/lib/eval.ts).
"""
import json
import sys
import unicodedata

FIELDS = ["fullName", "age", "coverageAmount", "smoker", "conditions"]


def norm(s: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", s).split()).lower()


def correct(field, got, want):
    if got is None:
        return False
    if field == "fullName":
        return norm(got) == norm(want)
    if field == "conditions":
        return sorted(got) == sorted(want)
    return got == want


def main() -> int:
    preds_path = sys.argv[1] if len(sys.argv) > 1 else "predictions.json"
    data_path = sys.argv[2] if len(sys.argv) > 2 else "src/data/samples.json"
    labels = {s["id"]: s["labels"] for s in json.load(open(data_path, encoding="utf-8"))}
    preds = {p["id"]: p for p in json.load(open(preds_path, encoding="utf-8"))}

    hits = {f: 0 for f in FIELDS}
    exact = 0
    tp = fp = fn = 0
    for doc_id, want in labels.items():
        got = preds.get(doc_id, {})
        ok = {f: correct(f, got.get(f), want[f]) for f in FIELDS}
        for f in FIELDS:
            hits[f] += ok[f]
            if not ok[f]:
                print(f"  miss  {doc_id:<26} {f:<15} expected={want[f]!r} got={got.get(f)!r}")
        exact += all(ok.values())
        g, w = set(got.get("conditions") or []), set(want["conditions"])
        tp, fp, fn = tp + len(g & w), fp + len(g - w), fn + len(w - g)

    n = len(labels)
    p = 1.0 if tp + fp == 0 else tp / (tp + fp)
    r = 1.0 if tp + fn == 0 else tp / (tp + fn)
    f1 = 0.0 if p + r == 0 else 2 * p * r / (p + r)
    print()
    for f in FIELDS:
        print(f"{f:<15} {hits[f] / n:6.1%}")
    print(f"{'overall':<15} {sum(hits.values()) / (n * len(FIELDS)):6.1%}")
    print(f"exact-match docs {exact}/{n}   conditions P={p:.2f} R={r:.2f} F1={f1:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
