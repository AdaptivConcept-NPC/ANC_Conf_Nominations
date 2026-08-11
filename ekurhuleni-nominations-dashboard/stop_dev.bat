@echo off
setlocal

if "%~1"=="--local" (
    echo ============================================
    echo  Stopping LOCAL Supabase instance
    echo ============================================
    echo.
    echo Stopping Supabase local environment...
    call npx supabase@2.108.0 stop

    if errorlevel 1 (
        echo Failed to stop Supabase local environment.
        exit /b 1
    )

    echo.
    echo Supabase local environment stopped successfully.
) else (
    echo ============================================
    echo  Stopping CLOUD mode ^(no local Supabase^)
    echo ============================================
    echo.
    echo No local Supabase instance to stop.
    echo The cloud Supabase instance requires no shutdown.
)

endlocal
exit /b 0