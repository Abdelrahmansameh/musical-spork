const SIGNALING_URL = 'wss://musical-spork.onrender.com';

const square = document.getElementById('square');
let color = 'red';
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

peer.onicecandidate = ({ candidate }) => {
  if (candidate) {
    ws.send(JSON.stringify({ type: 'signal', room, data: candidate }));
  }
};

function setupDataChannel(channel) {
  dc = channel;
  dc.onmessage = (e) => {
    if (e.data === 'toggle') toggle();
  };
}

peer.ondatachannel = (e) => setupDataChannel(e.channel);

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'ready') {
    dc = peer.createDataChannel('toggle');
    setupDataChannel(dc);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'signal', room, data: offer }));
  } else if (msg.type === 'signal') {
    if (msg.data.type === 'offer') {
      await peer.setRemoteDescription(msg.data);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'signal', room, data: answer }));
    } else if (msg.data.type === 'answer') {
      await peer.setRemoteDescription(msg.data);
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
  if (dc && dc.readyState === 'open') {
    dc.send('toggle');
  }
};
