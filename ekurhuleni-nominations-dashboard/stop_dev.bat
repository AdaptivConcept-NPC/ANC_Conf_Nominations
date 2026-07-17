@echo off
setlocal

echo Stopping Supabase local environment...
call npx supabase@2.108.0 stop

if errorlevel 1 (
  echo Failed to stop Supabase local environment.
  exit /b 1
)

echo Supabase local environment stopped successfully.
exit /b 0
