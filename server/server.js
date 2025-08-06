const WebSocket = require('ws');

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });
const rooms = {};
const roomStates = {}; // Store the current state for each room

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
      // Initialize room if it doesn't exist
      if (!rooms[room]) {
        rooms[room] = [];
        roomStates[room] = { color: 'red' }; // Default state
      }
      
      // Add client to room
      rooms[room].push(ws);
      ws.room = room;
      ws.clientId = rooms[room].length; // Assign client ID (1, 2, 3, etc.)
      
      // Send current room state to the newly joined client
      ws.send(JSON.stringify({ 
        type: 'joined', 
        clientId: ws.clientId,
        state: roomStates[room]
      }));
      
      // Notify all clients in the room about the new connection
      const clients = rooms[room];
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            type: 'client_count', 
            count: clients.length 
          }));
        }
      });
      
    } else if (type === 'state_update') {
      // Update room state and broadcast to all other clients
      if (roomStates[room]) {
        roomStates[room] = { ...roomStates[room], ...data };
        
        const clients = rooms[room] || [];
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'state_update', 
              data: roomStates[room] 
            }));
          }
        });
      }
      
    } else if (type === 'chat_message') {
      // Broadcast chat message to all other clients in the room
      const clients = rooms[room] || [];
      clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            type: 'chat_message', 
            senderId: ws.clientId,
            text: data.text 
          }));
        }
      });
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (room && rooms[room]) {
      rooms[room] = rooms[room].filter((s) => s !== ws);
      
      // Update client count for remaining clients
      const clients = rooms[room];
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            type: 'client_count', 
            count: clients.length 
          }));
        }
      });
      
      // Clean up empty rooms
      if (rooms[room].length === 0) {
        delete rooms[room];
        delete roomStates[room];
      }
    }
  });
});

console.log(`WebSocket server listening on ${port}`);
