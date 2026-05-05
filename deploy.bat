@echo off
REM deploy.bat - quick git deploy for the ops app
REM Usage:  deploy "your commit message"
REM
REM Guard: refuses to run on main. Always ship from a feature branch -> PR -> merge.

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set BRANCH=%%b
if /i "%BRANCH%"=="main" (
    echo ERROR: deploy.bat refuses to push from main - switch to a feature branch first.
    echo.
    echo Workflow:
    echo   git checkout -b ^<feature-branch^>
    echo   deploy.bat "your message"
    echo   gh pr create
    echo   gh pr merge
    exit /b 1
)

if "%~1"=="" (
    set MSG=update
) else (
    set MSG=%~1
)

echo.
echo === Deploying to Vercel ===
echo Commit message: %MSG%
echo.

git add .
git commit -m "%MSG%"
git push

echo.
echo === Done. Vercel is auto-deploying. ===
echo Live at: https://guestos-ops.vercel.app
echo (Build takes ^~1 min. Env var changes still need manual redeploy.)
echo.
