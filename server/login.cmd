@echo off
chcp 65001 >nul
rem Вход в Claude для ботов Clawds. Данные входа хранятся в server\claude-config, личный ~/.claude не трогается.
rem Параметр fresh: сначала выйти из старого входа (его даёт приложение, когда вход уже был).
set CLAUDE_CONFIG_DIR=%~dp0claude-config
if exist "D:\Git\bin\bash.exe" set CLAUDE_CODE_GIT_BASH_PATH=D:\Git\bin\bash.exe
if not defined CLAUDE_CODE_GIT_BASH_PATH if exist "C:\Program Files\Git\bin\bash.exe" set CLAUDE_CODE_GIT_BASH_PATH=C:\Program Files\Git\bin\bash.exe
set ANTHROPIC_API_KEY=
set ANTHROPIC_AUTH_TOKEN=
set ANTHROPIC_BASE_URL=
if /i "%~1"=="fresh" (
  echo Выходим из прежнего входа...
  claude auth logout
)
echo.
echo Сейчас откроется страница Anthropic. Нажмите там "Authorize" (принять) и вернитесь в это окно.
echo Пока вы не подтвердили вход на странице, здесь будет ожидание. Окно не закрывайте.
echo.
claude auth login
echo.
echo ===== Итог =====
claude auth status
echo.
echo Если выше написано "loggedIn": true, вход выполнен, окно можно закрыть.
pause
