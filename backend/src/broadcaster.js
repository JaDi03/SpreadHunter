const WebSocket = require('ws');

class Broadcaster {
  constructor() {
    this.wss = null;
  }

  init(server) {
    this.wss = new WebSocket.Server({ server });
    
    this.wss.on('connection', (ws) => {
      console.log('Frontend connected');
      ws.send(JSON.stringify({ type: 'connected' }));
      
      ws.on('close', () => {
        console.log('Frontend disconnected');
      });
    });
  }

  broadcast(type, data) {
    if (!this.wss) return;

    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

module.exports = new Broadcaster();
