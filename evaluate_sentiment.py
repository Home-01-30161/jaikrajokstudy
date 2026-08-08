"""
SSense Sentiment Evaluation — Wisesight Sentiment Dataset
==========================================================
Dataset : pythainlp/wisesight_sentiment (HuggingFace, CC0-1.0)
          Wisesight (2019). Wisesight Sentiment Corpus.
          https://huggingface.co/datasets/pythainlp/wisesight_sentiment
API     : SSense — aiforthai.in.th (NECTEC)

Run:
    pip install requests scikit-learn datasets
    python evaluate_sentiment.py
"""

import requests
import json
import time
import csv
import os
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report,
)

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY  = "AxWkjqnznABZt1yPSsvEVveqIEibC48k"
ENDPOINT = "https://api.aiforthai.in.th/ssense"
HEADERS  = {"Apikey": API_KEY, "Content-Type": "application/x-www-form-urlencoded"}

# ── Load local PyThaiNLP dataset ──────────────────────────────────────────────
# Source: https://github.com/PyThaiNLP/thai-sentiment-analysis-dataset
# Labels: pos → positive, neg → negative (no neutral class in this dataset)
DATASET_DIR = os.path.join(os.path.dirname(__file__), "thai-sentiment-analysis-dataset")
CSV_FILES = ["general-amy.csv", "review_shopping.csv", "tcas61.csv"]
LABEL_MAP = {"pos": "positive", "neg": "negative"}

print("Loading PyThaiNLP Thai Sentiment Analysis Dataset (local)...")
TEST_DATA = []
for fname in CSV_FILES:
    fpath = os.path.join(DATASET_DIR, fname)
    with open(fpath, encoding="utf-8-sig") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) >= 2:
                text, label = row[0].strip(), row[1].strip()
                if label in LABEL_MAP and text:
                    TEST_DATA.append((text, LABEL_MAP[label]))

print(f"Loaded {len(TEST_DATA)} samples from {len(CSV_FILES)} files")
print(f"  positive : {sum(1 for _, l in TEST_DATA if l == 'positive')}")
print(f"  negative : {sum(1 for _, l in TEST_DATA if l == 'negative')}")
print(f"  neutral  : {sum(1 for _, l in TEST_DATA if l == 'neutral')}")

# ── SSense API call ───────────────────────────────────────────────────────────
def call_ssense(text: str) -> dict:
    try:
        res = requests.post(
            ENDPOINT,
            headers=HEADERS,
            data={"text": text[:500]},
            timeout=15,
        )
        res.raise_for_status()
        return res.json()
    except Exception as e:
        print(f"  [ERROR] {e}")
        return {}

def parse_polarity(result) -> str:
    try:
        item = result[0] if isinstance(result, list) else result
        polarity = item["sentiment"]["polarity"]
        if polarity == "positive":
            return "positive"
        elif polarity == "negative":
            return "negative"
        else:
            return "neutral"
    except (KeyError, IndexError, TypeError):
        return "neutral"

# ── Run evaluation ────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SSense Sentiment Evaluation - Wisesight Dataset")
print("=" * 60)

y_true = []
y_pred = []
results_detail = []
errors = 0

for i, (text, ground_truth) in enumerate(TEST_DATA, 1):
    if i % 50 == 0 or i == 1:
        print(f"[{i:04d}/{len(TEST_DATA)}] processing...")
    raw = call_ssense(text)
    predicted = parse_polarity(raw)

    try:
        item = raw[0] if isinstance(raw, list) else raw
        score = item["sentiment"]["score"]
    except (KeyError, IndexError, TypeError):
        score = None
        errors += 1

    correct = predicted == ground_truth

    y_true.append(ground_truth)
    y_pred.append(predicted)
    results_detail.append({
        "text": text,
        "ground_truth": ground_truth,
        "predicted": predicted,
        "score": score,
        "correct": correct,
    })

    # polite delay — avoid rate limiting
    time.sleep(0.3)

# ── Statistics ────────────────────────────────────────────────────────────────
labels = ["positive", "negative"]

print("\n" + "=" * 60)
print("RESULTS")
print("=" * 60)
print(f"\nDataset : PyThaiNLP Thai Sentiment Analysis Dataset")
print(f"Source  : https://github.com/PyThaiNLP/thai-sentiment-analysis-dataset")
print(f"Samples : {len(TEST_DATA)} (pos={sum(1 for _, l in TEST_DATA if l=='positive')}, "
      f"neg={sum(1 for _, l in TEST_DATA if l=='negative')})")
print(f"API errors (fell back to neutral): {errors}")

acc = accuracy_score(y_true, y_pred)
print(f"\nAccuracy : {acc:.4f} ({acc*100:.2f}%)")

print("\nClassification Report:")
print(classification_report(y_true, y_pred, labels=labels, digits=4))

print("Confusion Matrix (rows=Actual, cols=Predicted):")
print(f"               {'  '.join(f'{l:8s}' for l in labels)}")
cm = confusion_matrix(y_true, y_pred, labels=labels)
for i, row in enumerate(cm):
    print(f"Actual {labels[i]:8s} {row}")

precision, recall, f1, support = precision_recall_fscore_support(
    y_true, y_pred, labels=labels, zero_division=0
)
print("\nPer-class breakdown:")
print(f"{'Class':10s} {'Precision':>10s} {'Recall':>10s} {'F1':>10s} {'Support':>10s}")
print("-" * 50)
for i, label in enumerate(labels):
    print(f"{label:10s} {precision[i]:10.4f} {recall[i]:10.4f} {f1[i]:10.4f} {support[i]:10d}")

p_macro = precision.mean()
r_macro = recall.mean()
f1_macro = f1.mean()
print("-" * 50)
print(f"{'Macro avg':10s} {p_macro:10.4f} {r_macro:10.4f} {f1_macro:10.4f}")

scores_correct   = [float(r["score"]) for r in results_detail if r["correct"] and r["score"] is not None]
scores_incorrect = [float(r["score"]) for r in results_detail if not r["correct"] and r["score"] is not None]
if scores_correct:
    print(f"\nAvg confidence when CORRECT  : {sum(scores_correct)/len(scores_correct):.2f}%")
if scores_incorrect:
    print(f"Avg confidence when INCORRECT: {sum(scores_incorrect)/len(scores_incorrect):.2f}%")

# ── Save results ──────────────────────────────────────────────────────────────
output = {
    "dataset": {
        "name": "PyThaiNLP Thai Sentiment Analysis Dataset",
        "source": "https://github.com/PyThaiNLP/thai-sentiment-analysis-dataset",
        "license": "Apache-2.0",
        "files": CSV_FILES,
        "total_samples": len(TEST_DATA),
        "api_errors": errors,
    },
    "accuracy": acc,
    "macro_precision": p_macro,
    "macro_recall": r_macro,
    "macro_f1": f1_macro,
    "confusion_matrix": {
        "labels": labels,
        "matrix": cm.tolist(),
    },
    "per_class": {
        label: {
            "precision": float(precision[i]),
            "recall": float(recall[i]),
            "f1": float(f1[i]),
            "support": int(support[i]),
        }
        for i, label in enumerate(labels)
    },
    "detail": [
        {k: v for k, v in r.items()}
        for r in results_detail
    ],
}

with open("evaluation_results.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print("\nFull results saved to evaluation_results.json")
print("=" * 60)
