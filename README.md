# p2p-color-toggle

A minimal peer-to-peer demo that syncs the color of a square between two browsers using WebRTC data channels.

## Structure
- `server/` – Node.js WebSocket signaling server.
- `client/` – Static HTML/JS client.

## Deploy
### Server
Deploy `server/` to any Node hosting (Glitch, Render, Fly.io, etc.).
```
cd server
npm install
node server.js
```

### Client
Serve the files in `client/` via GitHub Pages or any static host.

## Usage
1. Start the signaling server.
2. Open `client/index.html` in two browser windows.
3. Enter the same room code (or share the generated code).
4. Click the square and watch the color toggle in both windows.
