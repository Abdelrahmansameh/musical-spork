const SIGNALING_URL = 'wss://musical-spork.onrender.com';

const square = document.getElementById('square');
let color = 'red';
let syncInterval;
let room = prompt('Room code?');
if (!room) {
  room = Math.random().toString(36).substr(2, 4);
  alert('Your room code: ' + room);
}
const codeDisplay = document.createElement('p');
codeDisplay.textContent = 'Room: ' + room;
document.body.insertBefore(codeDisplay, square);

// Add a status display for debugging
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
showStatus('Initializing...');

const ws = new WebSocket(SIGNALING_URL);
ws.onopen = () => {
  showStatus('WebSocket connected. Joining room...');
  ws.send(JSON.stringify({ type: 'join', room }));
};
ws.onerror = (e) => {
  showStatus('WebSocket error: ' + (e.message || e.type));
};
ws.onclose = () => {
  showStatus('WebSocket closed.');
};

// Replace RTCPeerConnection initialization with TURN/STUN servers
const peer = new RTCPeerConnection({
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    // Use TURN over UDP and TCP for port 80, and TCP/TLS on port 443
    {
      urls: [
        'turn:openrelay.metered.ca:80?transport=udp',
        'turn:openrelay.metered.ca:80?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: [
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceTransportPolicy: 'relay',
  iceCandidatePoolSize: 10,
  iceCheckMinInterval: 500,
});
let dc;
let initiator = false;

let iceCandidateTimeout;
let gatheringComplete = false;

peer.onicecandidate = ({ candidate }) => {
  if (candidate) {
    showStatus('ICE candidate gathered. Sending to peer...');
    ws.send(JSON.stringify({ type: 'signal', room, data: candidate }));
    
    // Reset timeout each time we get a candidate
    clearTimeout(iceCandidateTimeout);
    iceCandidateTimeout = setTimeout(() => {
      if (!gatheringComplete) {
        showStatus('ICE gathering timed out - proceeding with available candidates');
        gatheringComplete = true;
        // Force proceed with connection
        if (peer.iceGatheringState === 'gathering') {
          sendState();
        }
      }
    }, 5000); // 5 second timeout
  } else {
    showStatus('All ICE candidates sent.');
    gatheringComplete = true;
    clearTimeout(iceCandidateTimeout);
  }
};
peer.onicecandidateerror = (e) => {
  showStatus('ICE candidate error: ' + (e.errorText || e.type));
};
peer.onconnectionstatechange = () => {
  const state = peer.connectionState;
  const iceState = peer.iceConnectionState;
  const stats = peer.getStats().then(stats => {
    stats.forEach(report => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        showStatus(`Connection state: ${state}, ICE: ${iceState}, RTT: ${report.currentRoundTripTime}ms`);
      }
    });
  });
  
  if (state === 'failed') {
    showStatus('Connection failed - attempting to restart ICE');
    peer.restartIce();
  } else if (state === 'disconnected') {
    showStatus('Connection disconnected - waiting for reconnection...');
    // Attempt to reconnect after a short delay
    setTimeout(() => {
      if (peer.connectionState === 'disconnected') {
        showStatus('Attempting to restart connection...');
        peer.restartIce();
      }
    }, 2000);
  }
};
peer.onsignalingstatechange = () => {
  showStatus('Signaling state: ' + peer.signalingState);
};

function sendState() {
  if (dc && dc.readyState === 'open') {
    dc.send(JSON.stringify({ type: 'state', color }));
  }
}

// --- Chat Room Logic ---
const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
let clientLabel = null;

function appendChatMessage(sender, text) {
  const div = document.createElement('div');
  div.textContent = sender + ': ' + text;
  div.style.marginBottom = '4px';
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function sendChatMessage(text) {
  if (dc && dc.readyState === 'open') {
    dc.send(JSON.stringify({ type: 'chat', text }));
    appendChatMessage(clientLabel, text);
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

function setupDataChannel(channel) {
  dc = channel;
  showStatus('DataChannel created: ' + dc.label);
  dc.onopen = () => {
    showStatus('DataChannel open! Syncing state...');
    sendState();
    syncInterval = setInterval(sendState, 1000);
    // Set client label after connection established
    clientLabel = initiator ? 'Client 1' : 'Client 2';
  };
  dc.onclose = () => {
    showStatus('DataChannel closed.');
    clearInterval(syncInterval);
  };
  dc.onerror = (e) => {
    showStatus('DataChannel error: ' + (e.message || e.type));
  };
  dc.onmessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      showStatus('Received non-JSON message on DataChannel.');
      return;
    }
    if (msg.type === 'state') {
      color = msg.color;
      square.style.background = color;
      showStatus('Received state update: color=' + color);
    } else if (msg.type === 'chat') {
      // Show message from the other client
      const sender = initiator ? 'Client 2' : 'Client 1';
      appendChatMessage(sender, msg.text);
    }
  };
}

peer.ondatachannel = (e) => setupDataChannel(e.channel);

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);
  showStatus('WebSocket message: ' + msg.type);
  if (msg.type === 'ready') {
    initiator = msg.initiator;
    showStatus('Room ready. Initiator: ' + initiator);
    if (initiator) {
      dc = peer.createDataChannel('toggle');
      setupDataChannel(dc);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      showStatus('Created offer, sending to peer...');
      ws.send(JSON.stringify({ type: 'signal', room, data: offer }));
    }
  } else if (msg.type === 'signal') {
    if (msg.data.type === 'offer') {
      showStatus('Received offer. Setting remote description...');
      await peer.setRemoteDescription(msg.data);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      showStatus('Created answer, sending to peer...');
      ws.send(JSON.stringify({ type: 'signal', room, data: answer }));
    } else if (msg.data.type === 'answer') {
      showStatus('Received answer.');
      if (peer.signalingState !== 'stable') {
        await peer.setRemoteDescription(msg.data);
        showStatus('Set remote description for answer.');
      }
    } else if (msg.data.candidate) {
      showStatus('Received ICE candidate. Adding...');
      await peer.addIceCandidate(msg.data);
    }
  }
};

function toggle() {
  color = color === 'red' ? 'blue' : 'red';
  square.style.background = color;
}

square.onclick = () => {
  toggle();
  showStatus('Square clicked. Sending state...');
  sendState();
};
