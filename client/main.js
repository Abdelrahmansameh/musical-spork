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

const ws = new WebSocket(SIGNALING_URL);
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'join', room }));
};

const peer = new RTCPeerConnection();
let dc;
let initiator = false;

peer.onicecandidate = ({ candidate }) => {
  if (candidate) {
    ws.send(JSON.stringify({ type: 'signal', room, data: candidate }));
  }
};

function sendState() {
  if (dc && dc.readyState === 'open') {
    dc.send(JSON.stringify({ type: 'state', color }));
  }
}

function setupDataChannel(channel) {
  dc = channel;
  dc.onopen = () => {
    sendState();
    syncInterval = setInterval(sendState, 1000);
  };
  dc.onclose = () => clearInterval(syncInterval);
  dc.onmessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.type === 'state') {
      color = msg.color;
      square.style.background = color;
    }
  };
}

peer.ondatachannel = (e) => setupDataChannel(e.channel);

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'ready') {
    initiator = msg.initiator;
    if (initiator) {
      dc = peer.createDataChannel('toggle');
      setupDataChannel(dc);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'signal', room, data: offer }));
    }
  } else if (msg.type === 'signal') {
    if (msg.data.type === 'offer') {
      await peer.setRemoteDescription(msg.data);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'signal', room, data: answer }));
    } else if (msg.data.type === 'answer') {
      // Avoid applying an answer twice in glare situations
      if (peer.signalingState !== 'stable') {
        await peer.setRemoteDescription(msg.data);
      }
    } else if (msg.data.candidate) {
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
  sendState();
};
