const WebSocket = require('ws');

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });
const rooms = {};
const roomStates = {}; // Store the current game state for each room

// Initialize empty game state
function createGameState() {
  return {
    board: Array(12).fill().map(() => Array(6).fill(null)),
    cursor: { x: 2, y: 8 },
    score: 0,
    isPlaying: false,
    combo: 0,
    lastRiseTime: Date.now()
  };
}

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      return;
    }
    const { type, room, data, playerId } = msg;
    if (!room) return;
    
    if (type === 'join') {
      // Initialize room if it doesn't exist
      if (!rooms[room]) {
        rooms[room] = [];
        roomStates[room] = {
          player1: createGameState(),
          player2: createGameState(),
          gameStarted: false,
          winner: null
        };
      }
      
      // Add client to room
      rooms[room].push(ws);
      ws.room = room;
      ws.clientId = rooms[room].length; // Assign client ID (1, 2)
      
      // Send current room state to the newly joined client
      ws.send(JSON.stringify({ 
        type: 'joined', 
        clientId: ws.clientId,
        gameState: roomStates[room]
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
      
    } else if (type === 'game_start') {
      // Start the game for all players in the room
      if (roomStates[room]) {
        // Reset game state completely
        roomStates[room].gameStarted = true;
        roomStates[room].winner = null;
        roomStates[room].player1 = createGameState();
        roomStates[room].player2 = createGameState();
        roomStates[room].player1.isPlaying = true;
        roomStates[room].player2.isPlaying = true;
        
        const clients = rooms[room] || [];
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'game_start' }));
          }
        });
      }
      
    } else if (type === 'game_action') {
      // Handle game actions and broadcast to other players
      if (roomStates[room] && playerId) {
        const playerKey = `player${playerId}`;
        const gameState = roomStates[room][playerKey];
        
        // Update server state based on action
        switch (data.action) {
          case 'move':
            gameState.cursor = data.cursor;
            break;
          case 'swap':
          case 'match':
          case 'rise':
            // Update server's copy of the board
            if (data.boardState) {
              gameState.board = data.boardState;
            }
            if (data.score !== undefined) {
              gameState.score = data.score;
            }
            if (data.combo !== undefined) {
              gameState.combo = data.combo;
            }
            break;
          case 'game_over':
            roomStates[room].winner = data.winner;
            roomStates[room].gameStarted = false;
            roomStates[room].player1.isPlaying = false;
            roomStates[room].player2.isPlaying = false;
            
            // Broadcast game over to ALL clients in the room
            const clients = rooms[room] || [];
            clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ 
                  type: 'game_over',
                  data: {
                    winner: data.winner,
                    loser: data.loser
                  }
                }));
              }
            });
            return; // Don't process further for game_over
            break;
        }
        
        // Broadcast action to other clients in the room
        const clients = rooms[room] || [];
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'game_action',
              data: data
            }));
          }
        });
        
        // For board-changing actions, send the updated board to the opponent
        if (['swap', 'match', 'rise'].includes(data.action) && data.boardState) {
          clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ 
                type: 'game_action',
                data: {
                  action: 'board_sync',
                  board: data.boardState,
                  score: data.score
                }
              }));
            }
          });
        }
        
        // Send periodic state sync to ensure consistency
        if (Math.random() < 0.2) { // 20% chance to sync state
          clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ 
                type: 'game_state_sync',
                data: roomStates[room]
              }));
            }
          });
        }
      }
      
    } else if (type === 'send_garbage') {
      // Send garbage to target player
      const clients = rooms[room] || [];
      const targetClient = clients.find(client => client.clientId === data.targetPlayer);
      
      if (targetClient && targetClient.readyState === WebSocket.OPEN) {
        targetClient.send(JSON.stringify({
          type: 'garbage_received',
          data: { lines: data.lines }
        }));
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
      
      // If game was in progress and a player left, end the game
      if (roomStates[room] && roomStates[room].gameStarted && clients.length < 2) {
        roomStates[room].gameStarted = false;
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'game_over',
              data: { winner: 'disconnect' }
            }));
          }
        });
      }
      
      // Clean up empty rooms
      if (rooms[room].length === 0) {
        delete rooms[room];
        delete roomStates[room];
      }
    }
  });
});

console.log(`Tetris Attack WebSocket server listening on ${port}`);
