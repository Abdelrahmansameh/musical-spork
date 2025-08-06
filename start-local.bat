@echo off
echo Starting Musical Spork Local Development Servers...
echo.

echo Installing dependencies...
cd server
call npm install
cd ..

echo.
echo Starting WebSocket server on port 3000...
start "WebSocket Server" cmd /k "cd server && npm start"

echo Starting HTTP client server on port 8080...
start "Client Server" cmd /k "node serve-client.js"

echo.
echo Servers started!
echo.
echo WebSocket Server: ws://localhost:3000
echo Client Server: http://localhost:8080
echo.
echo Open http://localhost:8080 in your browser to test the application
echo You can open multiple browser tabs/windows to test multi-client functionality
echo.
pause
