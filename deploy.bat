@echo off
REM deploy.bat - quick git deploy for the ops app
REM Usage:  deploy "your commit message"

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
