const WebSocket = require('ws');

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });
const rooms = {};

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      return;
    }
    const { type, room, data } = msg;
    if (!room) return;
    if (type === 'join') {
      rooms[room] = rooms[room] || [];
      if (rooms[room].length < 2) {
        rooms[room].push(ws);
      }
      ws.room = room;
      if (rooms[room].length === 2) {
        rooms[room].forEach((s) => s.send(JSON.stringify({ type: 'ready' })));
      }
    } else if (type === 'signal') {
      const peers = rooms[room] || [];
      peers.forEach((peer) => {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify({ type: 'signal', data }));
        }
      });
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (room && rooms[room]) {
      rooms[room] = rooms[room].filter((s) => s !== ws);
      if (rooms[room].length === 0) {
        delete rooms[room];
      }
    }
  });
});

console.log(`Signaling server listening on ${port}`);
