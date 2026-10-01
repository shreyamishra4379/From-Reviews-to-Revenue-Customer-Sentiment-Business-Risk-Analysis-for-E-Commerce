@echo off
setlocal EnableDelayedExpansion

echo.
echo ============================================================
echo   From Reviews to Revenue
echo   Customer Sentiment ^& Business Risk Analytics
echo ============================================================
echo.

:: ── Step 1: Locate Python ────────────────────────────────────────────────────
set "PYTHON="

:: Priority 1: Virtual environment in this folder
if exist "%~dp0venv_cuda\Scripts\python.exe" (
    set "PYTHON=%~dp0venv_cuda\Scripts\python.exe"
    echo [INFO] Using CUDA virtual environment.
    goto :python_found
)
if exist "%~dp0venv\Scripts\python.exe" (
    set "PYTHON=%~dp0venv\Scripts\python.exe"
    echo [INFO] Using local virtual environment.
    goto :python_found
)

:: Priority 2: System Python
for %%P in (python.exe python3.exe py.exe) do (
    for /f "delims=" %%F in ('where %%P 2^>nul') do (
        if not defined PYTHON set "PYTHON=%%F"
    )
)

if defined PYTHON goto :python_found

:: Priority 3: Common install paths
for %%D in (
    "C:\Python313\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%APPDATA%\Python\Python313\python.exe"
) do (
    if not defined PYTHON if exist %%~D set "PYTHON=%%~D"
)

:python_found
if not defined PYTHON (
    echo [ERROR] Python not found!
    echo         Please install Python 3.10+ from https://python.org
    echo         and make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
echo [OK] Python: %PYTHON%
echo.

:: ── Step 2: Check Python version ─────────────────────────────────────────────
"%PYTHON%" -c "import sys; v=sys.version_info; exit(0 if v>=(3,10) else 1)" 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python 3.10 or higher is required.
    "%PYTHON%" --version
    pause
    exit /b 1
)

:: ── Step 3: Install required packages ────────────────────────────────────────
echo [1/3] Checking and installing required packages...
"%PYTHON%" -m pip install --quiet --upgrade pip
"%PYTHON%" -m pip install --quiet ^
    streamlit>=1.30.0 ^
    pandas>=2.0.0 ^
    numpy>=1.24.0 ^
    pyarrow>=14.0.0 ^
    plotly>=5.15.0 ^
    duckdb>=0.10.0 ^
    kagglehub>=0.2.0

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to install required packages.
    echo         Try running manually: pip install -r requirements.txt
    pause
    exit /b 1
)
echo [OK] All packages installed.
echo.

:: ── Step 4: Run smart pipeline setup (skips if outputs exist) ────────────────
echo [2/3] Running pipeline setup (skips completed stages)...
set NLTK_ALLOW_PROXIED_URLOPEN=1

"%PYTHON%" setup.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Pipeline setup failed.
    echo         Check the error output above.
    pause
    exit /b 1
)
echo.

:: ── Step 5: Launch Streamlit dashboard ───────────────────────────────────────
echo [3/3] Launching dashboard...
echo.
echo   +----------------------------------------------------+
echo   ^|  Dashboard: http://localhost:8501                  ^|
echo   ^|  Press Ctrl+C in this window to stop the server   ^|
echo   +----------------------------------------------------+
echo.

"%PYTHON%" -m streamlit run "%~dp0app.py" ^
    --server.headless false ^
    --browser.gatherUsageStats false ^
    --server.port 8501

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Streamlit failed to start.
    echo         Make sure port 8501 is not in use.
    pause
    exit /b 1
)

endlocal
