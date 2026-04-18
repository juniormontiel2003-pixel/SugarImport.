@echo off
title SugarImport (Modo Offline)
color 0b

echo ===================================================
echo     INICIANDO SUGAR IMPORT (MODO SIN CONEXION)
echo ===================================================
echo.
echo Paso 1: Encendiendo el sistema de base de datos y la pagina...
echo.
echo (Se va a abrir una ventana del sistema, NO la cierres mientras uses la pagina)
start "SugarImport Server" cmd /k "node server.js"

echo.
echo Paso 2: Esperando a que el servidor termine de arrancar...
timeout /t 3 /nobreak > NUL

echo.
echo Paso 3: Abriendo el Panel de Administrador de manera local...
start http://localhost:3000/login
start http://localhost:3000

echo.
echo ===================================================
echo     TODO LISTO PARA USAR SIN CONEXION A INTERNET
echo ===================================================
echo.
echo Ya puedes usar ambas pestañas en tu navegador.
timeout /t 5 > NUL
exit
