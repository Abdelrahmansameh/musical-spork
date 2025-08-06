// Use local WebSocket server for development, production server for deployment
const WEBSOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'ws://localhost:3000'
  : 'wss://musical-spork.onrender.com';

// Game constants
const BOARD_WIDTH = 6;
const BOARD_HEIGHT = 12;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
const BLOCK_RISE_INTERVAL = 3000; // Rise blocks every 3 seconds
const GAME_LOOP_INTERVAL = 100; // Game loop every 100ms

// Block class
class Block {
  constructor(color, isGarbage = false) {
    this.color = color;
    this.isGarbage = isGarbage;
    this.matched = false;
    this.falling = false;
  }
}

// Game state class
class GameState {
  constructor() {
    this.board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(null));
    this.cursor = { x: 2, y: 8 };
    this.score = 0;
    this.garbageQueue = [];
    this.isPlaying = false;
    this.combo = 0;
    this.lastRiseTime = Date.now();
  }

  // Initialize board with some random blocks
  initBoard() {
    for (let y = 8; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (Math.random() < 0.7) {
          this.board[y][x] = new Block(COLORS[Math.floor(Math.random() * COLORS.length)]);
        }
      }
    }
  }

  // Get block at position
  getBlock(x, y) {
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return null;
    return this.board[y][x];
  }

  // Set block at position
  setBlock(x, y, block) {
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return;
    this.board[y][x] = block;
  }

  // Swap two adjacent blocks
  swapBlocks(x1, y1, x2, y2) {
    if (x2 < 0 || x2 >= BOARD_WIDTH || y1 !== y2) return false;
    
    const block1 = this.getBlock(x1, y1);
    const block2 = this.getBlock(x2, y2);
    
    this.setBlock(x1, y1, block2);
    this.setBlock(x2, y2, block1);
    return true;
  }

  // Apply gravity to make blocks fall
  applyGravity() {
    let moved = false;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      for (let y = BOARD_HEIGHT - 2; y >= 0; y--) {
        if (this.board[y][x] && !this.board[y + 1][x]) {
          // Find the lowest empty position
          let newY = y + 1;
          while (newY + 1 < BOARD_HEIGHT && !this.board[newY + 1][x]) {
            newY++;
          }
          this.board[newY][x] = this.board[y][x];
          this.board[y][x] = null;
          moved = true;
        }
      }
    }
    return moved;
  }

  // Find matches of 3 or more consecutive blocks
  findMatches() {
    const matches = new Set();
    
    // Check horizontal matches
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      let count = 1;
      let currentColor = null;
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const block = this.getBlock(x, y);
        if (block && !block.isGarbage && block.color === currentColor) {
          count++;
        } else {
          if (count >= 3 && currentColor) {
            for (let i = x - count; i < x; i++) {
              matches.add(`${i},${y}`);
            }
          }
          count = block && !block.isGarbage ? 1 : 0;
          currentColor = block && !block.isGarbage ? block.color : null;
        }
      }
      if (count >= 3 && currentColor) {
        for (let i = BOARD_WIDTH - count; i < BOARD_WIDTH; i++) {
          matches.add(`${i},${y}`);
        }
      }
    }

    // Check vertical matches
    for (let x = 0; x < BOARD_WIDTH; x++) {
      let count = 1;
      let currentColor = null;
      for (let y = 0; y < BOARD_HEIGHT; y++) {
        const block = this.getBlock(x, y);
        if (block && !block.isGarbage && block.color === currentColor) {
          count++;
        } else {
          if (count >= 3 && currentColor) {
            for (let i = y - count; i < y; i++) {
              matches.add(`${x},${i}`);
            }
          }
          count = block && !block.isGarbage ? 1 : 0;
          currentColor = block && !block.isGarbage ? block.color : null;
        }
      }
      if (count >= 3 && currentColor) {
        for (let i = BOARD_HEIGHT - count; i < BOARD_HEIGHT; i++) {
          matches.add(`${x},${i}`);
        }
      }
    }

    return Array.from(matches).map(pos => {
      const [x, y] = pos.split(',').map(Number);
      return { x, y };
    });
  }

  // Remove matched blocks and return score
  removeMatches(matches) {
    let score = 0;
    matches.forEach(({ x, y }) => {
      if (this.board[y][x]) {
        this.board[y][x] = null;
        score += 10 * (this.combo + 1);
      }
    });
    
    if (matches.length > 0) {
      this.combo++;
      // Send garbage to opponent based on combo (more balanced)
      // Only send garbage on combos of 3+ and scale properly
      if (this.combo >= 3) {
        const garbageLines = Math.max(1, Math.floor((this.combo - 2) / 2));
        sendGarbage(garbageLines);
        console.log(`Sending ${garbageLines} garbage lines for combo ${this.combo}`);
      }
    } else {
      this.combo = 0;
    }
    
    return score;
  }

  // Rise blocks from bottom
  riseBlocks() {
    // Store the current board state temporarily
    const tempBoard = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      tempBoard[y] = [];
      for (let x = 0; x < BOARD_WIDTH; x++) {
        tempBoard[y][x] = this.board[y][x];
      }
    }
    
    // Move all blocks up one row (everything moves up except bottom row)
    for (let y = 0; y < BOARD_HEIGHT - 1; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        this.board[y][x] = tempBoard[y + 1][x];
      }
    }
    
    // Add new row at bottom with normal colored blocks (NOT garbage)
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (Math.random() < 0.8) {
        // Create normal colored blocks, never garbage from rising
        this.board[BOARD_HEIGHT - 1][x] = new Block(COLORS[Math.floor(Math.random() * COLORS.length)], false);
      } else {
        this.board[BOARD_HEIGHT - 1][x] = null;
      }
    }
    
    // Move cursor up if at bottom to keep it visible
    if (this.cursor.y >= BOARD_HEIGHT - 1) {
      this.cursor.y = BOARD_HEIGHT - 2;
    }
  }

  // Check if game is over (blocks reached top)
  isGameOver() {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (this.board[0][x]) return true;
    }
    return false;
  }
}


// Game variables
let clientId = null;
let connectedClients = 0;
let gameState = new GameState();
let opponentState = new GameState();
let gameLoopId = null;

// DOM elements
const player1Board = document.getElementById('player1-board');
const player2Board = document.getElementById('player2-board');
const player1Score = document.getElementById('player1-score');
const player2Score = document.getElementById('player2-score');
const cursor = document.getElementById('player1-cursor');

// Get or create room
let room = prompt('Room code?');
if (!room) {
  room = Math.random().toString(36).substr(2, 4);
  alert('Your room code: ' + room);
}

// Display room code
const codeDisplay = document.createElement('p');
codeDisplay.textContent = 'Room: ' + room;
codeDisplay.style.position = 'fixed';
codeDisplay.style.top = '10px';
codeDisplay.style.left = '10px';
codeDisplay.style.background = 'rgba(0,0,0,0.8)';
codeDisplay.style.color = 'white';
codeDisplay.style.padding = '8px';
codeDisplay.style.borderRadius = '4px';
document.body.appendChild(codeDisplay);

// Add connection status display
const statusDiv = document.createElement('div');
statusDiv.style.position = 'fixed';
statusDiv.style.top = '50px';
statusDiv.style.left = '10px';
statusDiv.style.background = 'rgba(0,0,0,0.8)';
statusDiv.style.color = 'white';
statusDiv.style.zIndex = '9999';
statusDiv.style.fontSize = '14px';
statusDiv.style.padding = '4px 8px';
statusDiv.style.fontFamily = 'monospace';
statusDiv.style.borderRadius = '4px';
document.body.appendChild(statusDiv);

function showStatus(msg) {
  statusDiv.textContent = msg;
  console.log('[STATUS]', msg);
}

// Add client count display
const clientCountDiv = document.createElement('div');
clientCountDiv.style.position = 'fixed';
clientCountDiv.style.top = '80px';
clientCountDiv.style.left = '10px';
clientCountDiv.style.background = 'rgba(0,0,0,0.6)';
clientCountDiv.style.color = 'white';
clientCountDiv.style.padding = '4px 8px';
clientCountDiv.style.fontSize = '12px';
clientCountDiv.style.fontFamily = 'monospace';
clientCountDiv.style.borderRadius = '4px';
document.body.appendChild(clientCountDiv);

function updateClientCount(count) {
  connectedClients = count;
  clientCountDiv.textContent = `Connected: ${count}`;
}

showStatus('Connecting to server...');

// Initialize WebSocket connection
const ws = new WebSocket(WEBSOCKET_URL);

ws.onopen = () => {
  showStatus('Connected to server. Joining room...');
  ws.send(JSON.stringify({ type: 'join', room }));
};

ws.onerror = (e) => {
  showStatus('WebSocket error: ' + (e.message || e.type));
};

ws.onclose = () => {
  showStatus('Disconnected from server');
  if (gameLoopId) {
    clearInterval(gameLoopId);
    gameLoopId = null;
  }
  setTimeout(() => {
    showStatus('Attempting to reconnect...');
    location.reload();
  }, 3000);
};

ws.onmessage = (event) => {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch (e) {
    console.error('Failed to parse message:', event.data);
    return;
  }

  switch (msg.type) {
    case 'joined':
      clientId = msg.clientId;
      showStatus(`Connected as Player ${clientId}`);
      if (msg.gameState) {
        // Apply initial game state
        if (clientId === 1) {
          reconstructBoard(gameState, msg.gameState.player1.board);
          gameState.score = msg.gameState.player1.score || 0;
          reconstructBoard(opponentState, msg.gameState.player2.board);
          opponentState.score = msg.gameState.player2.score || 0;
        } else {
          reconstructBoard(gameState, msg.gameState.player2.board);
          gameState.score = msg.gameState.player2.score || 0;
          reconstructBoard(opponentState, msg.gameState.player1.board);
          opponentState.score = msg.gameState.player1.score || 0;
        }
        renderBoards();
      }
      break;

    case 'client_count':
      updateClientCount(msg.count);
      if (msg.count === 2 && !gameState.isPlaying) {
        showStatus('Both players connected! Press Enter to start game.');
      }
      break;

    case 'game_start':
      startGame();
      break;

    case 'game_action':
      handleOpponentAction(msg.data);
      break;

    case 'game_state_sync':
      syncGameState(msg.data);
      break;

    case 'garbage_received':
      receiveGarbage(msg.data.lines);
      break;

    case 'game_over':
      endGame(msg.data.winner);
      break;

    case 'chat_message':
      appendChatMessage(`Player ${msg.senderId}`, msg.text);
      break;

    default:
      console.log('Unknown message type:', msg.type);
  }
};

// Game functions
function startGame() {
  // Reset both game states completely
  gameState = new GameState();
  opponentState = new GameState();
  
  // Initialize game
  gameState.isPlaying = true;
  gameState.initBoard();
  gameState.lastRiseTime = Date.now();
  
  // Reset scores
  gameState.score = 0;
  opponentState.score = 0;
  player1Score.textContent = 0;
  player2Score.textContent = 0;
  
  // Reset visual styling
  const player1BoardElement = document.getElementById('player1-board');
  const player2BoardElement = document.getElementById('player2-board');
  player1BoardElement.style.border = '3px solid #fff';
  player2BoardElement.style.border = '3px solid #fff';
  player1BoardElement.style.opacity = '1';
  player2BoardElement.style.opacity = '1';
  
  showStatus('Game started! Use arrow keys to move, space to swap.');
  
  // Send initial board state to opponent
  sendGameAction({ 
    action: 'board_sync', 
    board: gameState.board,
    score: gameState.score 
  });
  
  if (!gameLoopId) {
    gameLoopId = setInterval(gameLoop, GAME_LOOP_INTERVAL);
  }
  
  renderBoards();
}

function gameLoop() {
  if (!gameState.isPlaying) return;

  let boardChanged = false;

  // Auto-rise blocks
  if (Date.now() - gameState.lastRiseTime > BLOCK_RISE_INTERVAL) {
    console.log('Rising blocks...');
    gameState.riseBlocks();
    gameState.lastRiseTime = Date.now();
    boardChanged = true;
  }

  // Process matches and gravity
  let gravityNeeded = true;
  while (gravityNeeded) {
    gravityNeeded = gameState.applyGravity();
    if (gravityNeeded) boardChanged = true;
    
    const matches = gameState.findMatches();
    if (matches.length > 0) {
      const score = gameState.removeMatches(matches);
      gameState.score += score;
      player1Score.textContent = gameState.score;
      boardChanged = true;
      
      // Animate matched blocks
      matches.forEach(({ x, y }) => {
        const blockElement = getBlockElement(player1Board, x, y);
        if (blockElement) {
          blockElement.classList.add('matched');
        }
      });
      
      gravityNeeded = true;
    }
  }

  // Send board sync if anything changed
  if (boardChanged) {
    sendGameAction({ 
      action: 'board_sync',
      board: gameState.board,
      score: gameState.score,
      combo: gameState.combo
    });
  }

  // Check game over
  if (gameState.isGameOver()) {
    const winner = clientId === 1 ? 'player2' : 'player1';
    endGame(winner);
    // Send game over message to server which will broadcast to both clients
    sendGameAction({ 
      action: 'game_over', 
      winner: winner,
      loser: clientId === 1 ? 'player1' : 'player2'
    });
    return; // Stop processing when game is over
  }

  renderBoards();
}

function sendGameAction(data) {
  if (ws.readyState === WebSocket.OPEN) {
    // Include current board state for critical actions
    if (['swap', 'match', 'rise'].includes(data.action)) {
      data.boardState = gameState.board;
    }
    
    ws.send(JSON.stringify({
      type: 'game_action',
      room: room,
      playerId: clientId,
      data: data
    }));
  }
}

function sendGarbage(lines) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'send_garbage',
      room: room,
      data: { lines: lines, targetPlayer: clientId === 1 ? 2 : 1 }
    }));
  }
}

function receiveGarbage(lines) {
  // Add garbage lines to bottom and push everything up
  for (let i = 0; i < lines; i++) {
    gameState.riseBlocks();
    // Replace bottom row with garbage
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (Math.random() < 0.9) {
        gameState.board[BOARD_HEIGHT - 1][x] = new Block('garbage', true);
      }
    }
  }
}

function handleOpponentAction(data) {
  switch (data.action) {
    case 'move':
      opponentState.cursor = data.cursor;
      break;
    case 'board_sync':
      // Full board synchronization from opponent - this is the reliable source of truth
      reconstructBoard(opponentState, data.board);
      if (data.score !== undefined) {
        opponentState.score = data.score;
        player2Score.textContent = opponentState.score;
      }
      break;
    case 'swap':
    case 'rise':
    case 'match':
      // These actions should not replicate locally anymore - wait for board_sync instead
      // This prevents desynchronization issues
      break;
  }
  renderBoards();
}

function syncGameState(data) {
  if (clientId === 1) {
    reconstructBoard(opponentState, data.player2.board);
    opponentState.score = data.player2.score;
  } else {
    reconstructBoard(opponentState, data.player1.board);
    opponentState.score = data.player1.score;
  }
  renderBoards();
}

// Helper function to properly reconstruct the board with Block objects
function reconstructBoard(gameState, boardData) {
  if (!boardData) return;
  
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (boardData[y] && boardData[y][x]) {
        const blockData = boardData[y][x];
        gameState.board[y][x] = new Block(blockData.color, blockData.isGarbage);
        gameState.board[y][x].matched = blockData.matched || false;
      } else {
        gameState.board[y][x] = null;
      }
    }
  }
}

function endGame(winner) {
  gameState.isPlaying = false;
  opponentState.isPlaying = false;
  
  if (gameLoopId) {
    clearInterval(gameLoopId);
    gameLoopId = null;
  }
  
  const isWinner = (winner === 'player1' && clientId === 1) || (winner === 'player2' && clientId === 2);
  
  // Add visual feedback to the boards
  const player1BoardElement = document.getElementById('player1-board');
  const player2BoardElement = document.getElementById('player2-board');
  
  if (winner === 'disconnect') {
    showStatus('Opponent disconnected! Press Enter to restart when both players connected.');
    player1BoardElement.style.opacity = '0.5';
    player2BoardElement.style.opacity = '0.5';
  } else {
    showStatus(isWinner ? 'You Win! 🎉 Press Enter to play again.' : 'You Lose! 😞 Press Enter to play again.');
    
    // Highlight winner/loser visually
    if (isWinner) {
      player1BoardElement.style.border = '3px solid #00ff00'; // Green for winner
      player2BoardElement.style.border = '3px solid #ff0000'; // Red for loser
    } else {
      player1BoardElement.style.border = '3px solid #ff0000'; // Red for loser  
      player2BoardElement.style.border = '3px solid #00ff00'; // Green for winner
    }
  }
  
  // Stop the game loop immediately
  renderBoards();
}

// Rendering functions
function renderBoards() {
  renderBoard(player1Board, gameState, true);
  renderBoard(player2Board, opponentState, false);
  updateCursor();
}

function renderBoard(boardElement, state, showCursor) {
  // Clear board
  const existingBlocks = boardElement.querySelectorAll('.block');
  existingBlocks.forEach(block => block.remove());

  // Render blocks
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const block = state.getBlock(x, y);
      const blockElement = document.createElement('div');
      blockElement.className = 'block';
      blockElement.style.gridColumn = x + 1;
      blockElement.style.gridRow = y + 1;
      
      if (block) {
        blockElement.classList.add(block.color);
        if (block.matched) {
          blockElement.classList.add('matched');
        }
      }
      
      boardElement.appendChild(blockElement);
    }
  }
}

function updateCursor() {
  const blockSize = 240 / BOARD_WIDTH; // Board width / number of columns
  const blockHeight = 480 / BOARD_HEIGHT; // Board height / number of rows
  
  cursor.style.width = (blockSize * 2) + 'px'; // Cursor spans 2 blocks horizontally
  cursor.style.height = blockHeight + 'px';
  cursor.style.left = (gameState.cursor.x * blockSize) + 'px';
  cursor.style.top = (gameState.cursor.y * blockHeight) + 'px';
}

function getBlockElement(boardElement, x, y) {
  const blocks = boardElement.querySelectorAll('.block');
  const index = y * BOARD_WIDTH + x;
  return blocks[index];
}

// Input handling
document.addEventListener('keydown', (event) => {
  if (!gameState.isPlaying) {
    if (event.key === 'Enter' && connectedClients === 2) {
      // Start game
      ws.send(JSON.stringify({ type: 'game_start', room: room }));
    }
    return;
  }

  let moved = false;
  const oldCursor = { ...gameState.cursor };

  switch (event.key) {
    case 'ArrowLeft':
      if (gameState.cursor.x > 0) {
        gameState.cursor.x--;
        moved = true;
      }
      break;
    case 'ArrowRight':
      if (gameState.cursor.x < BOARD_WIDTH - 2) { // -2 because cursor spans 2 blocks
        gameState.cursor.x++;
        moved = true;
      }
      break;
    case 'ArrowUp':
      if (gameState.cursor.y > 0) {
        gameState.cursor.y--;
        moved = true;
      }
      break;
    case 'ArrowDown':
      if (gameState.cursor.y < BOARD_HEIGHT - 1) {
        gameState.cursor.y++;
        moved = true;
      }
      break;
    case ' ':
      // Swap blocks
      event.preventDefault();
      const swapped = gameState.swapBlocks(
        gameState.cursor.x, gameState.cursor.y,
        gameState.cursor.x + 1, gameState.cursor.y
      );
      if (swapped) {
        sendGameAction({
          action: 'board_sync',
          board: gameState.board,
          score: gameState.score
        });
        renderBoards();
      }
      break;
    case 'r':
    case 'R':
      // Manual rise
      gameState.riseBlocks();
      gameState.lastRiseTime = Date.now();
      sendGameAction({ 
        action: 'board_sync',
        board: gameState.board,
        score: gameState.score
      });
      renderBoards();
      break;
  }

  if (moved) {
    updateCursor();
    sendGameAction({
      action: 'move',
      cursor: gameState.cursor
    });
  }
});

// Chat functionality (keep existing)
const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

function appendChatMessage(sender, text) {
  const div = document.createElement('div');
  div.textContent = `${sender}: ${text}`;
  div.style.marginBottom = '4px';
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function sendChatMessage(text) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'chat_message',
      room: room,
      data: { text: text }
    }));
    appendChatMessage(`Player ${clientId} (You)`, text);
  }
}

chatForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    sendChatMessage(text);
    chatInput.value = '';
  }
});

// Initialize display
renderBoards();
