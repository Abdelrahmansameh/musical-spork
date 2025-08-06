// Use local WebSocket server for development, production server for deployment
const WEBSOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'ws://localhost:3000'
  : 'wss://musical-spork.onrender.com';

const square = document.getElementById('square');
let color = 'red';
let clientId = null;
let connectedClients = 0;

// Get or create room
let room = prompt('Room code?');
if (!room) {
  room = Math.random().toString(36).substr(2, 4);
  alert('Your room code: ' + room);
}

// Display room code
const codeDisplay = document.createElement('p');
codeDisplay.textContent = 'Room: ' + room;
document.body.insertBefore(codeDisplay, square);

// Add connection status display
const statusDiv = document.createElement('div');
statusDiv.style.position = 'fixed';
statusDiv.style.top = '0';
statusDiv.style.left = '0';
statusDiv.style.width = '100%';
statusDiv.style.background = 'rgba(0,0,0,0.8)';
statusDiv.style.color = 'white';
statusDiv.style.zIndex = '9999';
statusDiv.style.fontSize = '16px';
statusDiv.style.padding = '8px';
statusDiv.style.fontFamily = 'monospace';
document.body.insertBefore(statusDiv, document.body.firstChild);

function showStatus(msg) {
  statusDiv.textContent = msg;
  console.log('[STATUS]', msg);
}

// Add client count display
const clientCountDiv = document.createElement('div');
clientCountDiv.style.position = 'fixed';
clientCountDiv.style.top = '40px';
clientCountDiv.style.left = '8px';
clientCountDiv.style.background = 'rgba(0,0,0,0.6)';
clientCountDiv.style.color = 'white';
clientCountDiv.style.padding = '4px 8px';
clientCountDiv.style.fontSize = '14px';
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
  setTimeout(() => {
    showStatus('Attempting to reconnect...');
    location.reload(); // Simple reconnection strategy
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
      showStatus(`Connected as Client ${clientId}`);
      // Apply initial state
      if (msg.state) {
        color = msg.state.color;
        square.style.background = color;
      }
      break;

    case 'client_count':
      updateClientCount(msg.count);
      break;

    case 'state_update':
      // Update state from server
      if (msg.data.color) {
        color = msg.data.color;
        square.style.background = color;
        showStatus(`State updated: color=${color}`);
      }
      break;

    case 'chat_message':
      // Display chat message from another client
      appendChatMessage(`Client ${msg.senderId}`, msg.text);
      break;

    default:
      console.log('Unknown message type:', msg.type);
  }
};

// State update function
function sendStateUpdate() {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'state_update',
      room: room,
      data: { color: color }
    }));
  }
}

// Chat functionality
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
    // Show our own message
    appendChatMessage(`Client ${clientId} (You)`, text);
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

// Square click handler
function toggle() {
  color = color === 'red' ? 'blue' : 'red';
  square.style.background = color;
  showStatus(`Color changed to ${color}`);
  sendStateUpdate();
}

square.onclick = toggle;
