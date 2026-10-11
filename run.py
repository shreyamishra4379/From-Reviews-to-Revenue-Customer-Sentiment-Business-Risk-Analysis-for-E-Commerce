"""
run.py — run the whole project with one command (Windows, macOS, Linux).

    python run.py            build anything missing, then start the dashboard
    python run.py --dev      same, but start Next.js in development mode
    python run.py --no-browser   don't open a browser tab (servers, CI)

Steps (each is skipped when its outputs already exist):
  1. Stage 1  download data (kagglehub) and build the star schema
  2. Stage 2  EDA charts and features
  3. Stage 3  NLP pipeline (slow: about 1.5 h on CPU)
  4. Stage 4  business analytics, statistics, SQL validation
  5. Fraud    fraud and counterfeit signals in review text
  6. Export   topic names, dashboard JSON and SHA-256 integrity manifest (always)
  7. Dashboard  npm install (first run), build, start on http://localhost:3000

Security check of the running dashboard: python src/security/pentest.py
"""
import importlib.util
import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DASH = ROOT / "dashboard"
PROC = ROOT / "data" / "processed"
PORT = int(os.environ.get("PORT", "3000"))
PY = sys.executable


def step(title):
    print(f"\n=== {title} ===", flush=True)


def run(cmd, cwd=ROOT):
    print("  $", " ".join(str(c) for c in cmd), flush=True)
    result = subprocess.run(cmd, cwd=cwd, shell=(os.name == "nt" and cmd[0] == "npm"))
    if result.returncode != 0:
        sys.exit(f"\n[ERROR] Step failed: {' '.join(str(c) for c in cmd)}")


def stage(name, marker, scripts):
    if marker.exists():
        print(f"  [skip] {name} - {marker.relative_to(ROOT)} exists")
        return
    for s in scripts:
        run([PY, str(ROOT / s)])


def main():
    dev = "--dev" in sys.argv
    open_browser = "--no-browser" not in sys.argv
    step("Checking tools")
    if sys.version_info < (3, 10):
        sys.exit("[ERROR] Python 3.10+ is required.")
    if not shutil.which("node") or not shutil.which("npm"):
        sys.exit("[ERROR] Node.js 18+ is required: https://nodejs.org")
    if not all(importlib.util.find_spec(m) for m in ("duckdb", "pandas", "pyarrow")):
        print("  Installing Python packages from requirements.txt ...")
        run([PY, "-m", "pip", "install", "-r", str(ROOT / "requirements.txt")])
    print("  [ok] Python and Node.js found")

    step("Pipeline")
    stage("Stage 1", PROC / "fact_orders.parquet",
          ["src/data/download_data.py", "src/data/make_dataset.py"])
    stage("Stage 2", PROC / "features_orders.parquet",
          ["src/data/run_eda.py", "src/data/build_features.py"])
    stage("Stage 3", PROC / "nlp_reviews.parquet", ["src/nlp/nlp_pipeline.py"])
    stage("Stage 4", PROC / "stage4" / "stage4_metrics.json",
          ["src/analytics/stage4_analysis.py", "src/analytics/validate_sql.py"])
    stage("Fraud signals", PROC / "stage4" / "fraud_signals.json", ["src/analytics/fraud_signals.py"])

    step("Exporting dashboard data")
    run([PY, str(ROOT / "src/nlp/topic_names.py")])
    run([PY, str(ROOT / "src/export_dashboard_data.py")])

    step("Dashboard")
    if not (DASH / "node_modules").exists():
        run(["npm", "install", "--legacy-peer-deps"], cwd=DASH)
    if not (DASH / ".env.local").exists():
        print("  [note] No dashboard/.env.local: Ask AI is off until you add GROQ_API_KEY / GEMINI_API_KEY.")
    if not dev:
        run(["npm", "run", "build"], cwd=DASH)

    url = f"http://localhost:{PORT}"
    print(f"\n  Starting the dashboard at {url}  (Ctrl+C to stop)")
    print(f"  Security check (in another terminal): python src/security/pentest.py {url}\n", flush=True)
    if open_browser:
        threading.Thread(target=lambda: (time.sleep(6), webbrowser.open(url)), daemon=True).start()
    cmd = ["npx", "next", "dev" if dev else "start", "-p", str(PORT)]
    try:
        subprocess.run(cmd, cwd=DASH, shell=(os.name == "nt"))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
