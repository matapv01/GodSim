@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0Start_Game.ps1"
if errorlevel 1 pause
