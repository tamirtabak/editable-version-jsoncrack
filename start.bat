bat@echo off
title jsoncrack.com Runner
cd /d "D:\PycharmProjects\editable-version-jsoncrack"

echo Installing/updating dependencies...
call pnpm install

echo Starting browser...
start http://localhost:3000/

echo Starting jsoncrack.com on http://localhost:3000/
call pnpm dev:www

pause