@echo off
echo Starting Supabase local environment...
call npx supabase@2.108.0 start

echo Starting React Vite Frontend...
start cmd /k "cd frontend && npm run dev"

echo Development environment started successfully!
echo You can access the dashboard in your browser.
