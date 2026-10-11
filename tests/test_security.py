"""Tests for the security features: data-integrity fingerprints and fraud signals."""
import json

import pandas as pd
import pytest

from config.settings import DATA_PROC
from src.analytics.fraud_signals import flag_reviews
from src.security import integrity


# ── SHA-256 integrity manifest ───────────────────────────────────────────────
def test_manifest_verifies_current_files():
    report = integrity.verify_manifest()
    assert report.get("error") is None
    assert report["ok"], f"modified={report['modified']} missing={report['missing']}"
    assert report["checked"] >= 40


def test_manifest_covers_dashboard_and_sql():
    files = json.loads(integrity.MANIFEST.read_text(encoding="utf-8"))["files"]
    assert any(f.startswith("dashboard/public/data/") for f in files)
    assert any(f.startswith("sql/") for f in files)
    assert "data/processed/integrity_manifest.json" not in files


def test_any_byte_change_changes_the_hash(tmp_path):
    f = tmp_path / "result.csv"
    f.write_bytes(b"category,rate\noffice_furniture,0.3651\n")
    before = integrity.sha256_file(f)
    f.write_bytes(b"category,rate\noffice_furniture,0.3652\n")   # one digit tampered
    assert integrity.sha256_file(f) != before
    assert len(before) == 64


# ── Fraud and counterfeit signals ────────────────────────────────────────────
@pytest.mark.parametrize("text,signal", [
    ("Produto falsificado, código de autenticidade falso.", "Counterfeit or not original"),
    ("Recebi uma réplica, não é original", "Counterfeit or not original"),
    ("Isso foi um golpe, quero meu dinheiro", "Scam or fraud"),
    ("Me senti enganada pela loja", "Scam or fraud"),
    ("Meu cartão foi clonado depois da compra", "Stolen or cloned"),
])
def test_flags_fraud_language(text, signal):
    assert flag_reviews(pd.Series([text])).loc[0, signal]


@pytest.mark.parametrize("text", [
    "Produto ótimo, chegou antes do prazo",
    "Entrega rápida, recomendo",
    "Falsamente achei que ia atrasar, mas chegou",   # 'falsamente' is not 'falso'
])
def test_does_not_flag_normal_reviews(text):
    assert not flag_reviews(pd.Series([text])).loc[0, "any_signal"]


def test_fraud_export_is_consistent():
    d = json.loads((DATA_PROC / "stage4" / "fraud_signals.json").read_text(encoding="utf-8"))
    assert 0 < d["flagged_reviews"] < d["text_reviews"]
    assert d["flagged_pct"] == pytest.approx(d["flagged_reviews"] / d["text_reviews"] * 100, abs=0.01)
    assert all(s["reviews"] >= d["seller_min_reviews"] for s in d["top_sellers"])
    assert all(c["reviews"] >= d["category_min_reviews"] for c in d["top_categories"])
    assert "not confirmed" in d["method"].lower()
