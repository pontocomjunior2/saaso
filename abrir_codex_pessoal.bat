@echo off
if not exist "%USERPROFILE%\.codex-pessoal" (
    mkdir "%USERPROFILE%\.codex-pessoal"
)
set CODEX_HOME=%USERPROFILE%\.codex-pessoal
cd /d "%~dp0"
codex