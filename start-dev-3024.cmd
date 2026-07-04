@echo off
cd /d "%~dp0"
set "NEXT_DIST_DIR=.next-dev-3024"
"C:\nvm4w\nodejs\node.exe" node_modules\next\dist\bin\next dev --webpack -p 3024 > dev-server-3024.log 2> dev-server-3024.err.log
