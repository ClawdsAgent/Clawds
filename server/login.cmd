@echo off
rem Вход в Claude для ботов Clawds. Данные входа хранятся в server\claude-config, личный ~/.claude не трогается.
set CLAUDE_CONFIG_DIR=%~dp0claude-config
set CLAUDE_CODE_GIT_BASH_PATH=D:\Git\bin\bash.exe
set ANTHROPIC_API_KEY=
set ANTHROPIC_AUTH_TOKEN=
set ANTHROPIC_BASE_URL=
claude auth login
claude auth status
pause
