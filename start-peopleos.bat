
@echo off
title PeopleOS Startup

echo =================================
echo       PEOPLEOS STARTUP
echo =================================

:: Move to project root
cd /d "%~dp0"

:: Check Docker Compose file
if not exist "docker-compose.yml" (
    if not exist "compose.yml" (
        echo ERROR: Docker Compose file not found!
        echo Current folder: %CD%
        echo.
        echo Please place this BAT file in your project root.
        pause
        exit /b 1
    )
)

echo.
echo [1/3] Starting Docker containers...

docker compose up -d

if errorlevel 1 (
    echo Docker startup failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Starting PeopleOS API...

start "PeopleOS API" cmd /k "cd /d "%~dp0apps\api" && npx prisma migrate dev && npm run prisma:seed && npm run start:dev"

timeout /t 5 /nobreak >nul

echo.
echo [3/3] Starting PeopleOS Web...

start "PeopleOS Web" cmd /k "cd /d "%~dp0" && npm run dev:web"

echo.
echo =================================
echo PeopleOS startup initiated!
echo =================================
echo Web: http://localhost:5173/login
echo Mailpit: http://localhost:8025
echo.
pause
