@echo off
if not exist "%USERPROFILE%\.codex-trabalho" (
    mkdir "%USERPROFILE%\.codex-trabalho"
)
set CODEX_HOME=%USERPROFILE%\.codex-trabalho
cd /d "%~dp0"
codex