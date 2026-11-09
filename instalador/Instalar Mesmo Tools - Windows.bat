@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Instalar Mesmo Tools

rem ============================================================
rem  Instalador do Mesmo Tools para Windows
rem  Copia o painel para "ScriptUI Panels" de TODAS as versoes
rem  do After Effects instaladas (2024, 2025, 2026, 2027, Beta...).
rem  Precisa de administrador porque a pasta fica em Program Files.
rem ============================================================

rem --- pede administrador (abre de novo com permissao) ---
net session >nul 2>&1
if errorlevel 1 (
    echo Pedindo permissao de administrador...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath \"%~f0\" -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

rem --- acha os arquivos do painel (mesma pasta ou uma acima) ---
set "SRCDIR=%~dp0"
if not exist "%SRCDIR%MesmoTools.jsx" set "SRCDIR=%~dp0..\"
if not exist "%SRCDIR%MesmoTools.jsx" (
    echo.
    echo  Nao achei o MesmoTools.jsx.
    echo  Deixe este instalador na mesma pasta que MesmoTools.jsx e MesmoTools_EN.jsx.
    echo.
    pause
    exit /b 1
)

echo.
echo  ================================
echo       Instalar Mesmo Tools
echo  ================================
echo.
echo   1 = Portugues  (MesmoTools.jsx)
echo   2 = English    (MesmoTools_EN.jsx)
echo   3 = Os dois / Both
echo.
choice /c 123 /n /m " Escolha o idioma [1, 2 ou 3]: "
set "LANG=%errorlevel%"

set "FILES="
if "%LANG%"=="1" set "FILES=MesmoTools.jsx"
if "%LANG%"=="2" set "FILES=MesmoTools_EN.jsx"
if "%LANG%"=="3" set "FILES=MesmoTools.jsx MesmoTools_EN.jsx"

echo.
set /a FOUND=0
set /a FAILED=0

for /d %%D in ("%ProgramFiles%\Adobe\Adobe After Effects*") do (
    if exist "%%~D\Support Files\AfterFX.exe" (
        set "DEST=%%~D\Support Files\Scripts\ScriptUI Panels"
        if not exist "!DEST!" mkdir "!DEST!" >nul 2>&1
        set "OK=1"
        for %%F in (!FILES!) do (
            copy /Y "%SRCDIR%%%F" "!DEST!\%%F" >nul 2>&1 || set "OK=0"
        )
        if exist "!DEST!\CompManager_Mesmo.jsx" del /q "!DEST!\CompManager_Mesmo.jsx" >nul 2>&1
        if "!OK!"=="1" (
            echo   [OK]   %%~nxD
            set /a FOUND+=1
        ) else (
            echo   [ERRO] %%~nxD  ^(feche o After Effects e tente de novo^)
            set /a FAILED+=1
        )
    )
)

echo.
if %FOUND%==0 if %FAILED%==0 (
    echo  Nenhum After Effects encontrado em "%ProgramFiles%\Adobe".
    echo  Copie o MesmoTools.jsx a mao para:
    echo  ...\Adobe After Effects 20xx\Support Files\Scripts\ScriptUI Panels
    echo.
    pause
    exit /b 1
)

echo  Pronto. Instalado em %FOUND% versao(oes) do After Effects.
echo.
echo  Falta so 1 coisa (uma vez so):
echo   Edit ^> Preferences ^> Scripting ^& Expressions ^>
echo   marque "Allow Scripts to Write Files and Access Network"
echo.
echo  Depois reinicie o After e abra em Window ^> MesmoTools.jsx
echo.
pause
