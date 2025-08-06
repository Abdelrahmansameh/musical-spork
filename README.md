# Tetris Attack - Real-time Multiplayer

A real-time multiplayer Tetris Attack-style puzzle game where two players compete by matching colored blocks and sending garbage to their opponent.

## Game Features

### Core Gameplay
- **6x12 game board** for each player
- **5 different colored blocks**: red, blue, green, yellow, purple
- **Match 3+ blocks** horizontally or vertically to clear them
- **Chain reactions** when blocks fall and create new matches
- **Combo system** that increases score and sends garbage to opponent
- **Auto-rising blocks** every 3 seconds to keep the game active

### Competitive Elements
- **Real-time multiplayer** for 2 players
- **Garbage blocks** sent to opponent when making combos
- **Score tracking** with combo multipliers  
- **Game over** when blocks reach the top
- **Live synchronization** of both players' boards

### Controls
- **Arrow Keys**: Move cursor around the board
- **Space**: Swap the two blocks under the cursor
- **R**: Manually raise the bottom row
- **Enter**: Start game (when both players connected)

## Technical Implementation

### Client-Side (`client/`)
- **Canvas-free rendering** using CSS Grid for game boards
- **Real-time cursor** showing current player position
- **Block animations** for matches and falling blocks
- **WebSocket communication** for all game actions
- **Responsive design** with split-screen layout

### Server-Side (`server/`)
- **WebSocket server** handling real-time communication
- **Room-based multiplayer** with unique room codes
- **Game state synchronization** between players
- **Garbage distribution** system for competitive play
- **Auto-cleanup** of empty rooms

## Game Mechanics

### Matching System
1. Scan board for 3+ consecutive blocks of same color
2. Mark matched blocks for removal
3. Apply gravity to make blocks fall
4. Repeat until no more matches found
5. Award points based on combo level

### Combo System
- **Combo 1**: 10 points per block
- **Combo 2+**: Points multiply, garbage sent to opponent
- **Garbage amount**: Based on combo level (combo/2 lines)

### Block Rising
- Bottom row rises automatically every 3 seconds
- Players can manually raise with 'R' key
- New random colored blocks generated at bottom
- Cursor moves up when blocks rise

## Setup & Deployment

### Local Development
```bash
# Start WebSocket server
cd server
node server.js

# Start client HTTP server  
node serve-client.js

# Open http://localhost:8080 in browser
```

### Production Deployment
- Deploy `server/` to any Node.js hosting (Render, Heroku, etc.)
- Serve `client/` files via static hosting (GitHub Pages, Netlify, etc.)
- Update `WEBSOCKET_URL` in `main.js` to production server

## How to Play

1. **Join a room**: Enter room code or get auto-generated one
2. **Wait for opponent**: Game starts when 2 players connected
3. **Press Enter** to begin the match
4. **Move cursor** with arrow keys to position over blocks
5. **Swap blocks** with spacebar to create matches
6. **Create combos** by setting up chain reactions
7. **Send garbage** to opponent through successful combos
8. **Survive longer** than opponent to win!

## Architecture

### Message Types
- `join`: Player joins room
- `game_start`: Begin match when both players ready
- `game_action`: Move, swap, match, rise actions
- `send_garbage`: Combo triggers garbage for opponent  
- `game_over`: Match ends, declare winner
- `chat_message`: Text communication between players

### State Management
- **Client state**: Own board, cursor, score, combos
- **Server state**: Both players' boards, game status
- **Sync mechanism**: Periodic state validation
- **Real-time updates**: Immediate action broadcasting

Built on WebSocket technology for ultra-low latency competitive gameplay!
