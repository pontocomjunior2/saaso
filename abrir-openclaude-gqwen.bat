@echo off
title OpenClaude + GQWEN Launcher
cd /d "%~dp0"

echo ============================================
echo   Iniciando GQWEN Server...
echo ============================================

:: Inicia o servidor do GQWEN em uma janela separada (fica rodando em background)
start "GQWEN Server" cmd /k "gqwen serve on"

:: Aguarda 3 segundos para o servidor inicializar
timeout /t 3 /nobreak > nul

echo ============================================
echo   Servidor GQWEN iniciado!
echo   Abrindo OpenClaude no diretorio atual...
echo ============================================

:: Abre um novo terminal no diretorio do .bat com o OpenClaude ja conectado ao GQWEN
start "OpenClaude" cmd /k "cd /d "%~dp0" && openclaude"

exit
