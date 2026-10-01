@echo off
setlocal enabledelayedexpansion

title From Reviews to Revenue - Analytics Dashboard Launcher
color 0A

echo.
echo  ================================================================
echo   FROM REVIEWS TO REVENUE
echo   Customer Sentiment ^& Business Risk Analysis - E-Commerce
echo   https://github.com/shreyamishra4379/From-Reviews-to-Revenue-...
echo  ================================================================
echo.
echo  Smart launcher: already-computed stages are SKIPPED automatically.
echo  NLP model is NEVER re-run if nlp_reviews.parquet already exists.
echo.

:: ── Project root (directory containing this .bat file) ──────────────────────
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "DASHBOARD=%ROOT%\dashboard2"
set "DATA=%ROOT%\data\processed"
set "SRC=%ROOT%\src"
set "REPORTS=%ROOT%\reports\figures"

:: ════════════════════════════════════════════════════════════════════════════
:: STEP 0  -  Check prerequisites
:: ════════════════════════════════════════════════════════════════════════════
echo  [0/6] Checking prerequisites...
echo  ----------------------------------------------------------------

:: Python check
python --version >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo.
    echo  [ERROR] Python not found.
    echo         Install Python 3.10+ from https://www.python.org
    echo         Check "Add Python to PATH" during install.
    pause
    exit /b 1
)
for /f "delims=" %%V in ('python --version 2^>^&1') do set "PY_VER=%%V"
echo  [OK] !PY_VER!

:: Node.js check
node --version >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo.
    echo  [ERROR] Node.js not found.
    echo         Install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
for /f "delims=" %%V in ('node --version') do set "NODE_VER=%%V"
echo  [OK] Node.js !NODE_VER!

:: Python packages check - use double-double-quotes for cmd compatibility
python -c "import pandas, pyarrow, duckdb" >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo  [INFO] Installing Python packages (first run only)...
    pip install -r "%ROOT%\requirements.txt"
    if !ERRORLEVEL! neq 0 (
        echo  [WARN] Some packages may have failed. Continuing...
    ) else (
        echo  [OK]   Python packages installed.
    )
) else (
    echo  [OK] Python packages ready (pandas, pyarrow, duckdb).
)

:: ════════════════════════════════════════════════════════════════════════════
:: STEP 1  -  Stage 1: Data Pipeline (Download + Star-Schema Parquets)
:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  [1/6] Stage 1 - Data Pipeline
echo  ----------------------------------------------------------------

if exist "%DATA%\fact_orders.parquet" (
    echo  [SKIP] fact_orders.parquet found - Stage 1 already complete.
) else (
    echo  [RUN]  src\data\make_dataset.py
    echo         Downloading from Kaggle and building star-schema parquets...
    echo         Requires KAGGLE_USERNAME and KAGGLE_KEY environment variables.
    echo.
    python "%SRC%\data\make_dataset.py"
    if !ERRORLEVEL! neq 0 (
        echo.
        echo  [ERROR] Stage 1 failed.
        echo         Fix: Set KAGGLE_USERNAME and KAGGLE_KEY env vars, or
        echo              place raw CSV files in data\raw\ manually.
        pause
        exit /b 1
    )
    echo  [OK]   Stage 1 complete.
)

:: ════════════════════════════════════════════════════════════════════════════
:: STEP 2  -  Stage 2: EDA + Feature Engineering
:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  [2/6] Stage 2 - EDA and Feature Engineering
echo  ----------------------------------------------------------------

:: 2A - EDA (check for a known output figure)
if exist "%REPORTS%\01_monthly_order_volume.png" (
    echo  [SKIP] EDA figures found - Stage 2A already complete.
) else (
    echo  [RUN]  src\data\run_eda.py
    python "%SRC%\data\run_eda.py"
    if !ERRORLEVEL! neq 0 (
        echo  [WARN] Stage 2A (EDA) had errors - continuing...
    ) else (
        echo  [OK]   Stage 2A (EDA) complete.
    )
)

:: 2B - Feature engineering
if exist "%DATA%\feature_matrix.parquet" (
    echo  [SKIP] feature_matrix.parquet found - Stage 2B already complete.
) else (
    if exist "%DATA%\features_orders.parquet" (
        echo  [SKIP] features_orders.parquet found - Stage 2B already complete.
    ) else (
        echo  [RUN]  src\data\build_features.py
        python "%SRC%\data\build_features.py"
        if !ERRORLEVEL! neq 0 (
            echo  [WARN] Stage 2B (features) had errors - continuing...
        ) else (
            echo  [OK]   Stage 2B (features) complete.
        )
    )
)

:: ════════════════════════════════════════════════════════════════════════════
:: STEP 3  -  Stage 3: NLP Pipeline (XLM-RoBERTa Sentiment Analysis)
:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  [3/6] Stage 3 - NLP Pipeline (XLM-RoBERTa)
echo  ----------------------------------------------------------------

if exist "%DATA%\nlp_reviews.parquet" (
    echo  [SKIP] nlp_reviews.parquet found - NLP already computed.
    echo         (40,977 reviews processed - skipping slow transformer step)
) else (
    echo  [RUN]  src\nlp\nlp_pipeline.py
    echo.
    echo  +----------------------------------------------------------+
    echo  ^|  WARNING: This step takes 10 to 60 minutes.             ^|
    echo  ^|  GPU (CUDA) is used automatically if available.         ^|
    echo  ^|  DO NOT close this window until it finishes.            ^|
    echo  +----------------------------------------------------------+
    echo.
    python "%SRC%\nlp\nlp_pipeline.py"
    if !ERRORLEVEL! neq 0 (
        echo.
        echo  [ERROR] Stage 3 (NLP) failed.
        echo         Install: pip install transformers torch sentence-transformers scikit-learn
        pause
        exit /b 1
    )
    echo  [OK]   Stage 3 (NLP) complete.
)

:: ════════════════════════════════════════════════════════════════════════════
:: STEP 4  -  Stage 4: Statistical Analysis + Business Metrics
:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  [4/6] Stage 4 - Statistical Analysis and Business Metrics
echo  ----------------------------------------------------------------

if exist "%DATA%\stage4\stage4_metrics.json" (
    echo  [SKIP] stage4_metrics.json found - Stage 4 already complete.
) else (
    echo  [RUN]  src\analytics\stage4_analysis.py
    python "%SRC%\analytics\stage4_analysis.py"
    if !ERRORLEVEL! neq 0 (
        echo.
        echo  [ERROR] Stage 4 failed. Ensure Stage 3 (NLP) completed first.
        pause
        exit /b 1
    )
    echo  [OK]   Stage 4 complete.
)

:: ════════════════════════════════════════════════════════════════════════════
:: STEP 5  -  Export: Pre-aggregated JSON for Dashboard
:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  [5/6] Export - Building dashboard JSON files
echo  ----------------------------------------------------------------
echo  [RUN]  export_dashboard_data.py (reads stages 1-4, writes JSON)

python "%ROOT%\export_dashboard_data.py"
if !ERRORLEVEL! neq 0 (
    echo.
    echo  [ERROR] Data export failed.
    echo         Ensure data\processed\ has all stage outputs.
    pause
    exit /b 1
)
echo  [OK]   7 JSON files written to dashboard2\public\data\

:: ════════════════════════════════════════════════════════════════════════════
:: STEP 6  -  Launch Next.js Dashboard
:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  [6/6] Dashboard - Starting Next.js server
echo  ----------------------------------------------------------------

if not exist "%DASHBOARD%" (
    echo  [ERROR] dashboard2 folder not found: %DASHBOARD%
    pause
    exit /b 1
)

:: Install npm packages on first run
if not exist "%DASHBOARD%\node_modules" (
    echo  [INFO]  node_modules not found. Installing npm packages...
    echo          (First-run only - takes about 1 minute)
    cd /d "%DASHBOARD%"
    npm install --legacy-peer-deps
    if !ERRORLEVEL! neq 0 (
        echo.
        echo  [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo  [OK]   npm packages installed.
) else (
    echo  [OK]   node_modules present - skipping npm install.
)

:: Free port 3000 in case anything is running on it
for /f "tokens=5" %%P in ('netstat -aon 2^>nul ^| findstr LISTENING ^| findstr ":3000 "') do (
    taskkill /PID %%P /F >nul 2>&1
)
echo  [OK]   Port 3000 is free.

echo.
echo  ================================================================
echo   LAUNCHING DASHBOARD  ^>^>  http://localhost:3000
echo  ================================================================
echo.
echo   Home        http://localhost:3000/
echo   NLP         http://localhost:3000/nlp-insights
echo   Statistics  http://localhost:3000/statistical-analysis
echo   Delivery    http://localhost:3000/delivery
echo   Business    http://localhost:3000/business-impact
echo   Category    http://localhost:3000/category-deep-dive
echo   SQL         http://localhost:3000/sql-analytics
echo.
echo   SQL Analytics runs live DuckDB queries - no model re-training.
echo   Press Ctrl+C to stop the server.
echo  ================================================================
echo.

:: Change to dashboard2 dir and start server
cd /d "%DASHBOARD%"

:: Open browser 4 seconds after server starts (in background)
start /b cmd /c "timeout /t 4 /nobreak >nul 2>&1 && start http://localhost:3000"

:: Start the dev server (blocking - keeps window open)
npm run dev

endlocal
