@echo off
setlocal enabledelayedexpansion

if "%~1"=="--local" (
    echo ============================================
    echo  Starting with LOCAL Supabase instance
    echo ============================================
    echo.
    echo Starting Supabase local environment...
    call npx supabase@2.108.0 start

    if errorlevel 1 (
        echo Failed to start Supabase local environment.
        exit /b 1
    )

    echo.
    echo Starting React Vite Frontend ^(LOCAL mode^)...
    echo.
    start cmd /k "cd frontend && set VITE_SUPABASE_URL=http://127.0.0.1:54321 && set VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW0iLCJyb2xlIjoiYW4iLCJpYXQiOjE3ODQzNzU1ODQsImV4cCI6MjA5OTk1MTU4NH0.M/DlrSf6zr/hdZcdNy79erTFk56WF381ehf2uJffL0Y && set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW0iLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzg0Mzc1NTg0LCJleHAiOjIwOTk5NTE1ODR9.YXd6Dv15ci-dHOZre6h7XSFNTJX4OqH3onxbLTRkUog && npm run dev"
) else (
    echo ============================================
    echo  Starting with CLOUD Supabase instance
    echo ============================================
    echo.
    echo Using cloud Supabase: zilabbyqoaivtgqdeijd.supabase.co
    echo.
    echo Starting React Vite Frontend ^(CLOUD mode^)...
    echo.
    start cmd /k "cd frontend && npm run dev"
)

echo.
echo Development environment started successfully!
echo You can access the dashboard in your browser.
endlocal