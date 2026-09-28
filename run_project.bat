@echo off
echo ===============================================================================
echo  From Reviews to Revenue — Customer Sentiment ^& Business Risk Analytics
echo ===============================================================================
echo.

:: ── Check for Python ───────────────────────────────────────────────────────
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+ and try again.
    pause
    exit /b 1
)

:: ── Activate virtual environment if it exists ─────────────────────────────
if exist venv_cuda\Scripts\activate.bat (
    echo Activating CUDA virtual environment...
    call venv_cuda\Scripts\activate.bat
) else if exist venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo [INFO] No virtual environment found. Using system Python.
    echo        To create one: python -m venv venv
    echo        Then: pip install -r requirements.txt
)

set NLTK_ALLOW_PROXIED_URLOPEN=1
echo.

:: ── Smart pipeline: setup.py handles skipping if outputs exist ────────────
echo [1/2] Running smart pipeline setup (skips completed stages)...
python setup.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo ===============================================================================
    echo  ERROR: Pipeline setup failed. Check the error above.
    echo ===============================================================================
    pause
    exit /b 1
)
echo.

:: ── Launch dashboard ──────────────────────────────────────────────────────
echo [2/2] Launching Streamlit dashboard...
echo       Open http://localhost:8501 in your browser.
echo.
python -m streamlit run app.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo ===============================================================================
    echo  ERROR: Streamlit launch failed.
    echo  Make sure streamlit is installed: pip install streamlit
    echo ===============================================================================
    pause
    exit /b 1
)

goto :eof
