"""
topic_names.py — Business-readable names for the 8 embedding topics (Stage 3).

The NLP pipeline only produces term-based labels ("Topic 3: prazo / antes / produto").
These names were assigned by reading each cluster's c-TF-IDF terms and sample
reviews in data/processed/nlp_topics.json. They are interpretations, not model
output, and must be revisited if the pipeline is re-run (KMeans ids can change).

Writes data/processed/dim_topics.csv so SQL and the dashboard share one lookup.

Usage:
    python src/nlp/topic_names.py
"""
import json
import os
import sys

import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(ROOT, "data", "processed")

# topic_id -> (business name, evidence from the terms / sample reviews)
TOPIC_NAMES = {
    0: ("Positive Shopping Experience",   "produto, recomendo, loja, gostei; samples praise store and purchase"),
    1: ("Order Receipt / Delivery Problems", "recebi, comprei, veio, correios, nao; samples report missing or partial orders"),
    2: ("Product Quality Praise",         "qualidade, bom, ótimo, excelente; samples praise product quality"),
    3: ("Early Delivery Satisfaction",    "prazo, antes, antes prazo, chegou antes"),
    4: ("General Approval / Short Praise", "bom, recomendo, tudo ok, perfeito; very short reviews"),
    5: ("Mixed Delivery + Product Feedback", "entrega, produto, bom, rápida; samples mix praise and complaints"),
    6: ("Product Expectation vs Reality", "veio, diferente, foto, cor, porém; samples describe items not matching the listing"),
    7: ("Delivery Status / Pending Orders", "recebi, ainda, entregue, dia; samples report orders not yet received"),
}


def topic_name(topic_id) -> str:
    return TOPIC_NAMES.get(int(topic_id), (f"Topic {topic_id}", ""))[0]


def write_dim_topics() -> pd.DataFrame:
    with open(os.path.join(DATA_DIR, "nlp_topics.json"), encoding="utf-8") as f:
        topics = json.load(f)["embedding_topics"]
    if {t["topic_id"] for t in topics} != set(TOPIC_NAMES):
        sys.exit("Topic ids in nlp_topics.json do not match TOPIC_NAMES - re-label the topics.")
    rows = [{
        "topic_id": t["topic_id"],
        "business_topic_name": topic_name(t["topic_id"]),
        "term_label": t["business_topic_name"],
        "representative_terms": ", ".join(t["representative_terms"][:10]),
        "review_count": t["review_count"],
        "evidence": TOPIC_NAMES[t["topic_id"]][1],
    } for t in topics]
    df = pd.DataFrame(rows).sort_values("topic_id")
    df.to_csv(os.path.join(DATA_DIR, "dim_topics.csv"), index=False, encoding="utf-8")
    return df


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(write_dim_topics()[["topic_id", "business_topic_name", "review_count"]].to_string(index=False))
