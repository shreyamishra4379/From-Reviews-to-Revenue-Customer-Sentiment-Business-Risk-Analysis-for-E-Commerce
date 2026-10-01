@echo off
setlocal enabledelayedexpansion

title From Reviews to Revenue - Dashboard Launcher
color 0A

echo.
echo  ================================================================
echo   FROM REVIEWS TO REVENUE
echo   Customer Sentiment ^& Business Risk Analysis - E-Commerce
echo  ================================================================
echo.

:: ── Set project root to the folder where this .bat lives ────────────────────
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "DASH=%ROOT%\dashboard2"

echo  Root : %ROOT%
echo  Dash : %DASH%
echo.

:: ════════════════════════════════════════════════════════════════════════════
:: CHECK 1 — Python
:: ════════════════════════════════════════════════════════════════════════════
echo  Checking Python...
python --version >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo.
    echo  [ERROR] Python not found. Install from https://python.org
    echo          Make sure "Add Python to PATH" is checked during install.
    pause
    exit /b 1
)
python --version
echo  [OK] Python found.
echo.

:: ════════════════════════════════════════════════════════════════════════════
:: CHECK 2 — Node.js
:: ════════════════════════════════════════════════════════════════════════════
echo  Checking Node.js...
node --version >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo.
    echo  [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
node --version
echo  [OK] Node.js found.
echo.

:: ════════════════════════════════════════════════════════════════════════════
:: STAGE SKIP LOGIC
:: (Already-computed outputs are detected and skipped automatically)
:: ════════════════════════════════════════════════════════════════════════════
echo  ----------------------------------------------------------------
echo  Checking which pipeline stages need to run...
echo  ----------------------------------------------------------------

set "NEED_S1=0"
set "NEED_S2=0"
set "NEED_S3=0"
set "NEED_S4=0"

if not exist "%ROOT%\data\processed\fact_orders.parquet"           set "NEED_S1=1"
if not exist "%ROOT%\reports\figures\01_monthly_order_volume.png"  set "NEED_S2=1"
if not exist "%ROOT%\data\processed\nlp_reviews.parquet"          set "NEED_S3=1"
if not exist "%ROOT%\data\processed\stage4\stage4_metrics.json"   set "NEED_S4=1"

if "!NEED_S1!"=="0" (
    echo  [SKIP] Stage 1 - fact_orders.parquet found
) else (
    echo  [RUN]  Stage 1 - will download and build parquets
)
if "!NEED_S2!"=="0" (
    echo  [SKIP] Stage 2 - EDA figures found
) else (
    echo  [RUN]  Stage 2 - will run EDA and feature engineering
)
if "!NEED_S3!"=="0" (
    echo  [SKIP] Stage 3 - nlp_reviews.parquet found
) else (
    echo  [RUN]  Stage 3 - will run NLP pipeline - 10 to 60 min
)
if "!NEED_S4!"=="0" (
    echo  [SKIP] Stage 4 - stage4_metrics.json found
) else (
    echo  [RUN]  Stage 4 - will run statistical analysis
)
echo.

:: ════════════════════════════════════════════════════════════════════════════
:: STAGE 1 — Data Pipeline
:: ════════════════════════════════════════════════════════════════════════════
if "!NEED_S1!"=="1" (
    echo  [1/4] Running Stage 1 - Data Pipeline...
    echo        Requires KAGGLE_USERNAME and KAGGLE_KEY env vars.
    python "%ROOT%\src\data\make_dataset.py"
    if !ERRORLEVEL! neq 0 (
        echo  [ERROR] Stage 1 failed. See error above.
        pause
        exit /b 1
    )
    echo  [OK] Stage 1 done.
    echo.
)

:: ════════════════════════════════════════════════════════════════════════════
:: STAGE 2 — EDA + Feature Engineering
:: ════════════════════════════════════════════════════════════════════════════
if "!NEED_S2!"=="1" (
    echo  [2/4] Running Stage 2 - EDA and Features...
    python "%ROOT%\src\data\run_eda.py"
    if !ERRORLEVEL! neq 0 (
        echo  [WARN] Stage 2A EDA had errors - continuing...
    ) else (
        echo  [OK] Stage 2A EDA done.
    )
    python "%ROOT%\src\data\build_features.py"
    if !ERRORLEVEL! neq 0 (
        echo  [WARN] Stage 2B features had errors - continuing...
    ) else (
        echo  [OK] Stage 2B features done.
    )
    echo.
)

:: ════════════════════════════════════════════════════════════════════════════
:: STAGE 3 — NLP Pipeline (slow — skipped if already done)
:: ════════════════════════════════════════════════════════════════════════════
if "!NEED_S3!"=="1" (
    echo  [3/4] Running Stage 3 - NLP Pipeline...
    echo.
    echo  +----------------------------------------------------------+
    echo  ^|  This step takes 10-60 minutes. Do NOT close window.    ^|
    echo  ^|  GPU CUDA used automatically if available.           ^|
    echo  +----------------------------------------------------------+
    echo.
    python "%ROOT%\src\nlp\nlp_pipeline.py"
    if !ERRORLEVEL! neq 0 (
        echo  [ERROR] Stage 3 NLP failed.
        echo  Install: pip install transformers torch sentence-transformers scikit-learn
        pause
        exit /b 1
    )
    echo  [OK] Stage 3 done.
    echo.
)

:: ════════════════════════════════════════════════════════════════════════════
:: STAGE 4 — Statistical Analysis
:: ════════════════════════════════════════════════════════════════════════════
if "!NEED_S4!"=="1" (
    echo  [4/4] Running Stage 4 - Statistical Analysis...
    python "%ROOT%\src\analytics\stage4_analysis.py"
    if !ERRORLEVEL! neq 0 (
        echo  [ERROR] Stage 4 failed. Check Stage 3 completed first.
        pause
        exit /b 1
    )
    echo  [OK] Stage 4 done.
    echo.
)

:: ════════════════════════════════════════════════════════════════════════════
:: EXPORT — Build dashboard JSON files (always runs, fast ~2 sec)
:: ════════════════════════════════════════════════════════════════════════════
echo  ----------------------------------------------------------------
echo  Exporting pre-aggregated JSON for dashboard (2-3 sec)...
echo  ----------------------------------------------------------------
python "%ROOT%\export_dashboard_data.py"
if !ERRORLEVEL! neq 0 (
    echo.
    echo  [ERROR] Data export failed. See error above.
    pause
    exit /b 1
)
echo  [OK] JSON export complete.
echo.

:: ════════════════════════════════════════════════════════════════════════════
:: DASHBOARD — Install npm packages if needed
:: ════════════════════════════════════════════════════════════════════════════
echo  ----------------------------------------------------------------
echo  Preparing dashboard...
echo  ----------------------------------------------------------------

if not exist "%DASH%" (
    echo  [ERROR] dashboard2 folder not found at: %DASH%
    pause
    exit /b 1
)

if not exist "%DASH%\node_modules" (
    echo  Installing npm packages - first time only, takes ~1 minute...
    cd /d "%DASH%"
    npm install --legacy-peer-deps
    if !ERRORLEVEL! neq 0 (
        echo  [ERROR] npm install failed. Check internet connection.
        pause
        exit /b 1
    )
    echo  [OK] npm packages installed.
) else (
    echo  [OK] node_modules ready.
)

:: Free port 3000
echo  Freeing port 3000...
for /f "tokens=5" %%P in ('netstat -aon 2^>nul ^| findstr LISTENING ^| findstr ":3000"') do (
    taskkill /PID %%P /F >nul 2>&1
)

:: ════════════════════════════════════════════════════════════════════════════
:: LAUNCH — Start the Next.js server
:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  ================================================================
echo   STARTING DASHBOARD  >>  http://localhost:3000
echo  ================================================================
echo.
echo   Home       http://localhost:3000/
echo   NLP        http://localhost:3000/nlp-insights
echo   Stats      http://localhost:3000/statistical-analysis
echo   Delivery   http://localhost:3000/delivery
echo   Business   http://localhost:3000/business-impact
echo   Category   http://localhost:3000/category-deep-dive
echo   SQL        http://localhost:3000/sql-analytics
echo.
echo   Browser will open automatically in 5 seconds.
echo   Press Ctrl+C to stop the server.
echo  ================================================================
echo.

cd /d "%DASH%"

:: Open browser 5 seconds after npm run dev starts using PowerShell (avoids nested cmd issues)
start /b powershell -WindowStyle Hidden -Command "Start-Sleep 5; Start-Process 'http://localhost:3000'"

:: Start server - this is the LAST command, keeps window open
npm run dev
