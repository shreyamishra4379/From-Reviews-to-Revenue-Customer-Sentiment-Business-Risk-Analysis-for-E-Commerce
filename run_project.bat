@echo off
echo ===============================================================================
echo Customer Voice ^& Business Impact Analytics
echo Running Full Pipeline...
echo ===============================================================================
echo.

echo [1/6] Stage 1: Downloading data ^& building star schema...
python src\data\load_raw.py
if %ERRORLEVEL% neq 0 goto :error
python src\data\make_dataset.py
if %ERRORLEVEL% neq 0 goto :error
echo Stage 1 Complete.
echo.

echo [2/6] Stage 2: EDA ^& feature engineering...
python src\data\build_features.py
if %ERRORLEVEL% neq 0 goto :error
echo Stage 2 Complete.
echo.

echo [3/6] Stage 3: NLP pipeline (Note: This takes 1.5 - 2 hours on CPU)...
python src\analytics\nlp_pipeline.py
if %ERRORLEVEL% neq 0 goto :error
echo Stage 3 Complete.
echo.

echo [4/6] Stage 4: Business analytics ^& statistics...
python src\analytics\stage4_analysis.py
if %ERRORLEVEL% neq 0 goto :error
echo Stage 4 Complete.
echo.

echo [5/6] Stage 4 (Continued): Validating SQL queries...
python src\analytics\validate_sql.py
if %ERRORLEVEL% neq 0 goto :error
echo SQL Validation Complete.
echo.

echo [6/6] Launching Streamlit Dashboard...
python -m streamlit run app.py
if %ERRORLEVEL% neq 0 goto :error

goto :eof

:error
echo.
echo ===============================================================================
echo ERROR: Pipeline stopped due to an error in the previous step.
echo ===============================================================================
pause
exit /b 1
