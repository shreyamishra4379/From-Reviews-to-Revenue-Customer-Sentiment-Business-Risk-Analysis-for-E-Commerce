@echo off
setlocal

echo ================================================================
echo  From Reviews to Revenue - Customer Sentiment ^& Business Risk Analytics
echo  Single Next.js App (Frontend + API Routes)
echo ================================================================
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found. Install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js:
node --version
echo [OK] npm:
npm --version
echo.

REM Get project directory
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"
echo [INFO] Project: %PROJECT_DIR%
echo.

REM Frontend deps
echo [1/3] Installing dependencies...
cd /d "%PROJECT_DIR%frontend"
if not exist node_modules (
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependencies exist
)

REM Score distribution
echo.
echo [2/3] Creating score distribution...
cd /d "%PROJECT_DIR%frontend"
node ../backend/create_score_dist.mjs
if errorlevel 1 (
    echo [WARN] Score distribution failed (continuing)
)

REM Build
echo.
echo [3/3] Building production...
cd /d "%PROJECT_DIR%frontend"
npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

REM Start production server
echo.
echo Starting server on http://localhost:3000...
cd /d "%PROJECT_DIR%frontend"
start "Frontend + API" cmd /k npm start

timeout /t 3 /nobreak >nul

REM Open browser
echo.
echo Opening http://localhost:3000 ...
start "" "http://localhost:3000"

echo.
echo ================================================================
echo  RUNNING at http://localhost:3000
echo  API routes at /api/*
echo ================================================================
echo.
echo Server runs in separate window. Close when ready.
pause