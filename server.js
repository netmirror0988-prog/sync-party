const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const LEAD_MS = 1500; // how far in the future scheduled play/seek commands are set

// rooms: code -> { masterWs, clients: Set<ws> }
const rooms = new Map();

function makeCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(code));
  return code;
}

function broadcast(room, data, excludeWs = null) {
  const msg = JSON.stringify(data);
  for (const client of room.clients) {
    if (client !== excludeWs && client.readyState === 1) client.send(msg);
  }
}

function sendPeerCount(room) {
  broadcast(room, { type: 'peers', count: room.clients.size });
}

wss.on('connection', (ws) => {
  ws.room = null;
  ws.isMaster = false;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', t0: msg.t0, serverTime: Date.now() }));
        break;
      }

      case 'create': {
        const code = makeCode();
        const room = { clients: new Set([ws]), masterWs: ws };
        rooms.set(code, room);
        ws.room = code;
        ws.isMaster = true;
        ws.send(JSON.stringify({ type: 'created', code }));
        sendPeerCount(room);
        break;
      }

      case 'join': {
        const room = rooms.get(msg.code);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
          return;
        }
        room.clients.add(ws);
        ws.room = msg.code;
        ws.isMaster = false;
        ws.send(JSON.stringify({ type: 'joined', code: msg.code }));
        sendPeerCount(room);
        break;
      }

      case 'control': {
        const room = rooms.get(ws.room);
        if (!room || ws !== room.masterWs) return; // only master may control

        const base = { type: 'control', action: msg.action };

        if (msg.action === 'load' || msg.action === 'play' || msg.action === 'seek') {
          base.url = msg.url;
          base.position = msg.position || 0;
          base.targetServerTime = Date.now() + LEAD_MS;
        } else if (msg.action === 'pause') {
          base.position = msg.position || 0;
          base.targetServerTime = Date.now() + 300;
        } else if (msg.action === 'timeupdate') {
          base.position = msg.position;
          base.serverTime = Date.now();
        }

        broadcast(room, base); // includes master, so master stays in sync too
        break;
      }
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.room);
    if (!room) return;
    room.clients.delete(ws);
    if (ws.isMaster) {
      broadcast(room, { type: 'masterLeft' });
      rooms.delete(ws.room);
    } else {
      sendPeerCount(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sync Party running on http://localhost:${PORT}`));
