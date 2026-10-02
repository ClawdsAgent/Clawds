@echo off
rem Запуск Clawds: сервер ботов и интерфейс. Нужен один раз выполненный server\login.cmd
cd /d "%~dp0"
if not exist server\node_modules ( pushd server & call npm install & popd )
if not exist app\node_modules ( pushd app & call npm install & popd )
start "Clawds server" cmd /k "cd /d %~dp0server && npm start"
start "Clawds UI" cmd /k "cd /d %~dp0app && npm run dev"
timeout /t 4 >nul
start http://127.0.0.1:5173
