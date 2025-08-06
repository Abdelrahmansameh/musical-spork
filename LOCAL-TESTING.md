# Musical Spork - Local Testing Guide

## Quick Start

### Option 1: Automated Setup (Recommended)
1. **Using Batch Script (Windows)**:
   ```
   double-click start-local.bat
   ```

2. **Using PowerShell**:
   ```powershell
   .\start-local.ps1
   ```

### Option 2: Manual Setup

1. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Start the WebSocket server** (in first terminal):
   ```bash
   cd server
   npm start
   ```
   This will start the WebSocket server on `ws://localhost:3000`

3. **Start the client server** (in second terminal):
   ```bash
   node serve-client.js
   ```
   This will start the HTTP server on `http://localhost:8080`

4. **Open your browser** and navigate to:
   ```
   http://localhost:8080
   ```

## Testing the Application

1. **Single Client Test**:
   - Open `http://localhost:8080` in your browser
   - You should see the color square and be able to click it to change colors
   - Check the status messages at the top of the page

2. **Multi-Client Test**:
   - Open multiple browser tabs/windows pointing to `http://localhost:8080`
   - Use the same room code in all tabs
   - Click the square in one tab and verify the color changes in all other tabs
   - Test the chat functionality between different tabs

3. **Room Separation Test**:
   - Open tabs with different room codes
   - Verify that changes in one room don't affect other rooms

## Troubleshooting

### Common Issues

1. **"Connection failed" or "WebSocket error"**:
   - Make sure the WebSocket server is running on port 3000
   - Check if another application is using port 3000
   - Try restarting the WebSocket server

2. **"Cannot GET /" or 404 errors**:
   - Make sure the client server is running on port 8080
   - Verify you're accessing `http://localhost:8080` (not `https://`)

3. **Port conflicts**:
   - If port 3000 or 8080 is in use, modify the ports in:
     - `server/server.js` (line with `process.env.PORT || 3000`)
     - `serve-client.js` (line with `PORT = 8080`)
     - `client/main.js` (WebSocket URL)

### Checking if servers are running

1. **WebSocket Server**: Look for "WebSocket server listening on 3000" message
2. **Client Server**: Look for "Client server running at http://localhost:8080/" message

## Development Tips

1. **Auto-reload**: The servers don't auto-restart on file changes. Restart them manually after making changes.

2. **Browser DevTools**: 
   - Open DevTools (F12) to see console logs
   - Check the Network tab for WebSocket connection status
   - Look for any JavaScript errors in the Console tab

3. **Testing Multiple Clients**:
   - Use different browser windows (not just tabs) for better isolation
   - Try using different browsers (Chrome, Firefox, etc.)
   - Test on different devices if available

## File Structure
```
musical-spork/
├── client/
│   ├── index.html          # Main HTML file
│   └── main.js            # Client-side JavaScript
├── server/
│   ├── package.json       # Server dependencies
│   └── server.js          # WebSocket server
├── serve-client.js        # Local HTTP server for client files
├── start-local.bat        # Windows batch script
├── start-local.ps1        # PowerShell script
└── LOCAL-TESTING.md       # This file
```

## Next Steps

Once you've verified everything works locally:
1. Test thoroughly with multiple clients
2. Verify all features (color sync, chat, room separation)
3. Deploy to your production environment
4. Update the WebSocket URL in `main.js` for production if needed
