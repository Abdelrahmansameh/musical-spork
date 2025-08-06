# Musical Spork Local Development Setup
Write-Host "Starting Musical Spork Local Development Servers..." -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Set-Location server
npm install
Set-Location ..

Write-Host ""
Write-Host "Starting servers..." -ForegroundColor Yellow

# Start WebSocket server in background
Write-Host "Starting WebSocket server on port 3000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; npm start" -WindowStyle Normal

# Wait a moment for the WebSocket server to start
Start-Sleep -Seconds 2

# Start HTTP client server in background
Write-Host "Starting HTTP client server on port 8080..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node serve-client.js" -WindowStyle Normal

Write-Host ""
Write-Host "Servers started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "WebSocket Server: ws://localhost:3000" -ForegroundColor White
Write-Host "Client Server: http://localhost:8080" -ForegroundColor White
Write-Host ""
Write-Host "Open http://localhost:8080 in your browser to test the application" -ForegroundColor Yellow
Write-Host "You can open multiple browser tabs/windows to test multi-client functionality" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
