@echo off
rem Вход в Claude для ботов Clawds. Данные входа хранятся в server\claude-config, личный ~/.claude не трогается.
set CLAUDE_CONFIG_DIR=%~dp0claude-config
if exist "D:\Git\bin\bash.exe" set CLAUDE_CODE_GIT_BASH_PATH=D:\Git\bin\bash.exe
if not defined CLAUDE_CODE_GIT_BASH_PATH if exist "C:\Program Files\Git\bin\bash.exe" set CLAUDE_CODE_GIT_BASH_PATH=C:\Program Files\Git\bin\bash.exe
set ANTHROPIC_API_KEY=
set ANTHROPIC_AUTH_TOKEN=
set ANTHROPIC_BASE_URL=
claude auth login
claude auth status
pause
