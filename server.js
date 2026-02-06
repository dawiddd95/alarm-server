const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Przechowuj połączone telefony z ich lokalizacjami
const phones = new Map(); // ws -> { id, lat, lng, lastUpdate }

// WebSocket - połączenia z telefonów
wss.on('connection', (ws) => {
    const phoneId = Date.now().toString();
    console.log('📱 Telefon połączony:', phoneId);
    phones.set(ws, { id: phoneId, lat: null, lng: null, lastUpdate: null, locationEnabled: false });
    
    ws.on('close', () => {
        console.log('📱 Telefon rozłączony:', phoneId);
        phones.delete(ws);
    });
    
    ws.on('message', (message) => {
        console.log('Otrzymano:', message.toString());
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'location') {
                const phone = phones.get(ws);
                if (phone) {
                    phone.lat = data.lat;
                    phone.lng = data.lng;
                    phone.lastUpdate = new Date().toISOString();
                    phone.locationEnabled = true;
                }
            }
        } catch (e) {
            console.error('Błąd parsowania:', e);
        }
    });
});

// Funkcja wysyłania komendy do wszystkich telefonów
function sendToAllPhones(command) {
    phones.forEach((info, ws) => {
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

app.get('/location/on', (req, res) => {
    sendToAllPhones('location_on');
    res.json({ status: 'ok', message: 'Włączono śledzenie lokalizacji', connectedPhones: phones.size });
});

app.get('/location/off', (req, res) => {
    sendToAllPhones('location_off');
    phones.forEach((info) => {
        info.locationEnabled = false;
        info.lat = null;
        info.lng = null;
    });
    res.json({ status: 'ok', message: 'Wyłączono śledzenie lokalizacji', connectedPhones: phones.size });
});

app.get('/status', (req, res) => {
    const phoneList = [];
    phones.forEach((info) => {
        phoneList.push({
            id: info.id,
            lat: info.lat,
            lng: info.lng,
            lastUpdate: info.lastUpdate,
            locationEnabled: info.locationEnabled
        });
    });
    res.json({ status: 'ok', connectedPhones: phones.size, phones: phoneList });
});

// Strona główna z przyciskami i mapą
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔔 Sound Alarm Control</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        .card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 20px;
        }
        h1 {
            color: #e94560;
            text-align: center;
            margin-bottom: 8px;
            font-size: 1.8em;
        }
        .status {
            color: #aaa;
            text-align: center;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .status.connected { color: #16c79a; }
        .phones-count {
            font-size: 48px;
            color: white;
            text-align: center;
        }
        .phones-label {
            color: #888;
            text-align: center;
            margin-bottom: 20px;
        }
        .buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 16px;
        }
        button {
            padding: 16px;
            font-size: 16px;
            font-weight: bold;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: transform 0.1s, opacity 0.2s;
        }
        button:active { transform: scale(0.98); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .play-btn {
            background: linear-gradient(135deg, #e94560, #ff6b6b);
            color: white;
        }
        .stop-btn {
            background: linear-gradient(135deg, #0f3460, #16213e);
            color: white;
            border: 1px solid #0f3460;
        }
        .loc-on-btn {
            background: linear-gradient(135deg, #16c79a, #12a883);
            color: white;
        }
        .loc-off-btn {
            background: linear-gradient(135deg, #6c757d, #495057);
            color: white;
        }
        .result {
            padding: 12px;
            border-radius: 8px;
            color: white;
            text-align: center;
            display: none;
            margin-bottom: 16px;
        }
        .result.show { display: block; }
        .result.success { background: rgba(22, 199, 154, 0.3); }
        .result.error { background: rgba(233, 69, 96, 0.3); }
        
        .section-title {
            color: #e94560;
            font-size: 1.1em;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #map {
            height: 300px;
            border-radius: 12px;
            margin-top: 12px;
        }
        .map-placeholder {
            height: 300px;
            border-radius: 12px;
            background: rgba(0,0,0,0.3);
            display: flex;
            justify-content: center;
            align-items: center;
            color: #666;
            text-align: center;
            padding: 20px;
        }
        .location-info {
            color: #aaa;
            font-size: 12px;
            margin-top: 8px;
            text-align: center;
        }
        .coords {
            color: #16c79a;
            font-family: monospace;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>🔔 Sound Alarm</h1>
            <p class="status" id="status">Łączenie...</p>
            
            <div class="phones-count" id="phones">0</div>
            <div class="phones-label">połączonych telefonów</div>
            
            <div class="buttons">
                <button class="play-btn" onclick="sendCommand('play')">▶️ PLAY</button>
                <button class="stop-btn" onclick="sendCommand('stop')">⏹️ STOP</button>
            </div>
            
            <div class="result" id="result"></div>
        </div>
        
        <div class="card">
            <div class="section-title">📍 Lokalizacja</div>
            
            <div class="buttons">
                <button class="loc-on-btn" onclick="sendCommand('location/on')" id="locOnBtn">📍 WŁĄCZ GPS</button>
                <button class="loc-off-btn" onclick="sendCommand('location/off')" id="locOffBtn">🚫 WYŁĄCZ GPS</button>
            </div>
            
            <div id="mapContainer">
                <div class="map-placeholder" id="mapPlaceholder">
                    📍 Włącz lokalizację aby zobaczyć mapę
                </div>
            </div>
            <div class="location-info" id="locationInfo"></div>
        </div>
    </div>

    <script>
        let map = null;
        let marker = null;
        let locationEnabled = false;
        
        function initMap(lat, lng) {
            if (map) {
                map.setView([lat, lng], 15);
                if (marker) {
                    marker.setLatLng([lat, lng]);
                } else {
                    marker = L.marker([lat, lng]).addTo(map);
                }
            } else {
                document.getElementById('mapPlaceholder').style.display = 'none';
                const mapDiv = document.createElement('div');
                mapDiv.id = 'map';
                document.getElementById('mapContainer').appendChild(mapDiv);
                
                map = L.map('map').setView([lat, lng], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(map);
                marker = L.marker([lat, lng]).addTo(map)
                    .bindPopup('📱 Telefon tutaj!')
                    .openPopup();
            }
        }
        
        function hideMap() {
            if (map) {
                map.remove();
                map = null;
                marker = null;
            }
            const mapEl = document.getElementById('map');
            if (mapEl) mapEl.remove();
            document.getElementById('mapPlaceholder').style.display = 'flex';
            document.getElementById('locationInfo').innerHTML = '';
        }
        
        async function checkStatus() {
            try {
                const res = await fetch('/status');
                const data = await res.json();
                document.getElementById('phones').textContent = data.connectedPhones;
                document.getElementById('status').textContent = 'Serwer online';
                document.getElementById('status').className = 'status connected';
                
                // Sprawdź lokalizację
                if (data.phones && data.phones.length > 0) {
                    const phone = data.phones[0];
                    if (phone.locationEnabled && phone.lat && phone.lng) {
                        initMap(phone.lat, phone.lng);
                        document.getElementById('locationInfo').innerHTML = 
                            'Koordynaty: <span class="coords">' + phone.lat.toFixed(6) + ', ' + phone.lng.toFixed(6) + '</span><br>' +
                            'Ostatnia aktualizacja: ' + new Date(phone.lastUpdate).toLocaleTimeString();
                        locationEnabled = true;
                    } else if (!phone.locationEnabled && locationEnabled) {
                        hideMap();
                        locationEnabled = false;
                    }
                }
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
    console.log('🚀 Serwer działa na porcie ' + PORT);
});
