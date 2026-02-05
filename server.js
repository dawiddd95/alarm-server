const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Przechowuj połączone telefony
const phones = new Set();

// WebSocket - połączenia z telefonów
wss.on('connection', (ws) => {
    console.log('📱 Telefon połączony');
    phones.add(ws);
    
    ws.on('close', () => {
        console.log('📱 Telefon rozłączony');
        phones.delete(ws);
    });
    
    ws.on('message', (message) => {
        console.log('Otrzymano:', message.toString());
    });
});

// Funkcja wysyłania komendy do wszystkich telefonów
function sendToAllPhones(command) {
    phones.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: command }));
        }
    });
}

// API endpoints
app.get('/play', (req, res) => {
    sendToAllPhones('play');
    res.json({ status: 'ok', message: 'Wysłano komendę PLAY', connectedPhones: phones.size });
});

app.get('/stop', (req, res) => {
    sendToAllPhones('stop');
    res.json({ status: 'ok', message: 'Wysłano komendę STOP', connectedPhones: phones.size });
});

app.get('/status', (req, res) => {
    res.json({ status: 'ok', connectedPhones: phones.size });
});

// Strona główna z przyciskami
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔔 Sound Alarm Control</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        h1 {
            color: #e94560;
            margin: 0 0 10px 0;
            font-size: 2em;
        }
        .status {
            color: #aaa;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .status.connected { color: #16c79a; }
        .phones-count {
            font-size: 48px;
            color: white;
            margin: 20px 0;
        }
        .phones-label {
            color: #888;
            margin-bottom: 30px;
        }
        button {
            width: 100%;
            padding: 20px;
            margin: 10px 0;
            font-size: 18px;
            font-weight: bold;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: transform 0.1s, box-shadow 0.1s;
        }
        button:active {
            transform: scale(0.98);
        }
        .play-btn {
            background: linear-gradient(135deg, #e94560, #ff6b6b);
            color: white;
            box-shadow: 0 4px 15px rgba(233, 69, 96, 0.4);
        }
        .stop-btn {
            background: linear-gradient(135deg, #0f3460, #16213e);
            color: white;
            box-shadow: 0 4px 15px rgba(15, 52, 96, 0.4);
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 8px;
            color: white;
            display: none;
        }
        .result.show { display: block; }
        .result.success { background: rgba(22, 199, 154, 0.3); }
        .result.error { background: rgba(233, 69, 96, 0.3); }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔔 Sound Alarm</h1>
        <p class="status" id="status">Łączenie...</p>
        
        <div class="phones-count" id="phones">0</div>
        <div class="phones-label">połączonych telefonów</div>
        
        <button class="play-btn" onclick="sendCommand('play')">
            ▶️ PLAY ALARM
        </button>
        
        <button class="stop-btn" onclick="sendCommand('stop')">
            ⏹️ STOP
        </button>
        
        <div class="result" id="result"></div>
    </div>

    <script>
        // Sprawdzaj status co 2 sekundy
        async function checkStatus() {
            try {
                const res = await fetch('/status');
                const data = await res.json();
                document.getElementById('phones').textContent = data.connectedPhones;
                document.getElementById('status').textContent = 'Serwer online';
                document.getElementById('status').className = 'status connected';
            } catch (e) {
                document.getElementById('status').textContent = 'Błąd połączenia';
                document.getElementById('status').className = 'status';
            }
        }
        
        async function sendCommand(cmd) {
            const resultEl = document.getElementById('result');
            try {
                const res = await fetch('/' + cmd);
                const data = await res.json();
                resultEl.textContent = data.message;
                resultEl.className = 'result show success';
                checkStatus();
            } catch (e) {
                resultEl.textContent = 'Błąd: ' + e.message;
                resultEl.className = 'result show error';
            }
            setTimeout(() => resultEl.className = 'result', 3000);
        }
        
        checkStatus();
        setInterval(checkStatus, 2000);
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serwer działa na porcie ${PORT}`);
});
