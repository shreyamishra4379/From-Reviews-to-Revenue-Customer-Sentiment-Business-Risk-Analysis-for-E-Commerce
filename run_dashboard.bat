@echo off
title E-Commerce Analytics Dashboard
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   From Reviews to Revenue — Analytics Dashboard          ║
echo  ║   Next.js Web Dashboard  ·  http://localhost:3000         ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ── Check Node.js ───────────────────────────────────────────────────────────
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Node.js not found. Install from https://nodejs.org ^(v18+^)
    pause
    exit /b 1
)

echo  [OK] Node.js found:
node --version
npm --version

:: ── Dashboard directory ──────────────────────────────────────────────────────
set DASHBOARD_DIR=%~dp0dashboard2

if not exist "%DASHBOARD_DIR%" (
    echo  [ERROR] dashboard2 directory not found at %DASHBOARD_DIR%
    pause
    exit /b 1
)

:: ── Export fresh data from processed parquets ───────────────────────────────
echo.
echo  [STEP 1] Exporting pre-aggregated JSON from Stages 1-4 outputs ...
python "%~dp0export_dashboard_data.py"
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [WARN] Data export had errors. Continuing with cached JSON if available.
    echo         Make sure python + pandas + pyarrow are installed.
) else (
    echo  [OK] Data exported successfully.
)

:: ── Install npm dependencies if node_modules is missing ─────────────────────
echo.
echo  [STEP 2] Checking npm dependencies ...
if not exist "%DASHBOARD_DIR%\node_modules" (
    echo  Installing npm packages (first run only) ...
    cd /d "%DASHBOARD_DIR%"
    npm install --legacy-peer-deps
    if %ERRORLEVEL% neq 0 (
        echo  [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
) else (
    echo  [OK] node_modules found — skipping install.
)

:: ── Kill anything on port 3000 ───────────────────────────────────────────────
echo.
echo  [STEP 3] Freeing port 3000 ...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000 "') do (
    taskkill /PID %%p /F >nul 2>&1
)

:: ── Start Next.js dev server ─────────────────────────────────────────────────
echo.
echo  [STEP 4] Starting Next.js dashboard ...
echo.
echo  ┌─────────────────────────────────────────────────────┐
echo  │  Dashboard: http://localhost:3000                    │
echo  │                                                     │
echo  │  Pages:                                             │
echo  │    🏠  Overview          /                          │
echo  │    🧠  NLP Insights      /nlp-insights              │
echo  │    📈  Statistical       /statistical-analysis      │
echo  │    🚚  Delivery          /delivery                  │
echo  │    💰  Business Impact   /business-impact           │
echo  │    🏢  Category Dive     /category-deep-dive        │
echo  │    🗄️  SQL Analytics     /sql-analytics             │
echo  │                                                     │
echo  │  Press Ctrl+C to stop.                              │
echo  └─────────────────────────────────────────────────────┘
echo.

cd /d "%DASHBOARD_DIR%"
start "" "http://localhost:3000"
npm run dev
