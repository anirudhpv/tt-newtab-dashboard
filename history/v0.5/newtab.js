// v0.5 — CDMX timezone, Z.ai GLM chat, web search tool, source cards

const TIMEZONES = [
  { label:'Hawaii',   tz:'Pacific/Honolulu',    short:'HST', city:'Honolulu',    lat:21.31,  lon:-157.82 },
  { label:'Pacific',  tz:'America/Los_Angeles', short:'PT',  city:'Los Angeles', lat:34.05,  lon:-118.24 },
  { label:'Mountain', tz:'America/Denver',      short:'MT',  city:'Denver',      lat:39.74,  lon:-104.98 },
  { label:'CDMX',     tz:'America/Mexico_City', short:'CST', city:'Mexico City', lat:19.43,  lon:-99.13  },
  { label:'Central',  tz:'America/Chicago',     short:'CT',  city:'Chicago',     lat:41.88,  lon:-87.63  },
  { label:'Eastern',  tz:'America/New_York',    short:'ET',  city:'New York',    lat:40.71,  lon:-74.01  },
  { label:'London',   tz:'Europe/London',       short:'GMT', city:'London',      lat:51.51,  lon:-0.13   },
  { label:'India',    tz:'Asia/Kolkata',        short:'IST', city:'Mumbai',      lat:19.08,  lon:72.88   },
];

const LINKS = [
  { name:'Google Ads',       url:'https://ads.google.com' },
  { name:'Meta Ads',         url:'https://business.facebook.com' },
  { name:'Google Analytics', url:'https://analytics.google.com' },
  { name:'Claude',           url:'https://claude.ai' },
  { name:'ChatGPT',          url:'https://chatgpt.com' },
  { name:'Slack',            url:'https://slack.com' },
  { name:'tigertracks.ai',   url:'https://tigertracks.ai' },
];

let apiKey  = localStorage.getItem('tt_apikey') || '';
let wxApiKey = localStorage.getItem('tt_wxapikey') || '';
let isDark  = true;
let tzView  = 'grid';
let mapReady = false, mapCtx = null, mapPaths = [];
let messages = [];

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MAP_W = 900, MAP_H = 460;

function pad(n) { return String(n).padStart(2,'0'); }
function lonToX(lon) { return ((lon + 180) / 360) * MAP_W; }
function latToY(lat) { return ((90 - lat) / 180) * MAP_H; }
function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function tick() {
  const now = new Date();
  document.getElementById('hero-time').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById('hero-date').textContent =
    `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  document.getElementById('footer-date').textContent = now.toLocaleDateString();
  renderTZGrid(now);
  if (tzView === 'map' && mapReady) drawMap(now);
}

function renderTZGrid(now) {
  document.getElementById('tz-grid').innerHTML = TIMEZONES.map(tz => {
    const d = new Date(now.toLocaleString('en-US', { timeZone: tz.tz }));
    const h = d.getHours(), m = pad(d.getMinutes());
    const ampm = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    return `<div class="tz-cell">
      <div class="tz-city">${tz.short}</div>
      <div class="tz-time">${h12}:${m}</div>
      <div style="font-size:8px;color:#7a92a4">${ampm}</div>
    </div>`;
  }).join('');
}

async function initMap() {
  if (mapReady) { drawMap(new Date()); return; }
  const canvas = document.getElementById('world-canvas');
  mapCtx = canvas.getContext('2d');
  try {
    const res = await fetch('js/countries-110m.json');
    const world = await res.json();
    const land = topojson.feature(world, world.objects.countries);
    mapPaths = land.features.map(f => {
      const p = new Path2D();
      const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates]
                  : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
      for (const poly of rings) for (const ring of poly) {
        if (!ring.length) continue;
        p.moveTo(lonToX(ring[0][0]), latToY(ring[0][1]));
        for (let k = 1; k < ring.length; k++) p.lineTo(lonToX(ring[k][0]), latToY(ring[k][1]));
        p.closePath();
      }
      return p;
    });
    mapReady = true;
    drawMap(new Date());
  } catch(e) {
    mapCtx.fillStyle = '#7a92a4';
    mapCtx.fillText('Map unavailable', MAP_W/2-60, MAP_H/2);
  }
}

function drawMap(now) {
  if (!mapCtx || !mapReady) return;
  const ctx = mapCtx;
  ctx.fillStyle = '#0a1520'; ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.fillStyle = '#1e3448'; ctx.strokeStyle = '#2a4a60'; ctx.lineWidth = 0.5;
  for (const path of mapPaths) { ctx.fill(path); ctx.stroke(path); }
  TIMEZONES.forEach(tz => {
    const x = lonToX(tz.lon), y = latToY(tz.lat);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2);
    ctx.fillStyle = '#229FA1'; ctx.fill();
    ctx.fillStyle = 'rgba(228,236,242,.7)';
    ctx.font = '8.5px monospace'; ctx.fillText(tz.short, x+8, y+4);
  });
}

document.getElementById('tz-grid-btn').addEventListener('click', () => {
  tzView = 'grid';
  document.getElementById('tz-grid-view').style.display = 'block';
  document.getElementById('tz-map-view').style.display = 'none';
  document.getElementById('tz-grid-btn').classList.add('active');
  document.getElementById('tz-map-btn').classList.remove('active');
});
document.getElementById('tz-map-btn').addEventListener('click', () => {
  tzView = 'map';
  document.getElementById('tz-grid-view').style.display = 'none';
  document.getElementById('tz-map-view').style.display = 'block';
  document.getElementById('tz-grid-btn').classList.remove('active');
  document.getElementById('tz-map-btn').classList.add('active');
  initMap();
});

// Weather via OpenWeatherMap
function fetchWeather() {
  if (!wxApiKey) {
    document.getElementById('weather').innerHTML =
      '<div style="font-size:11px;color:#7a92a4">Add OpenWeatherMap API key in settings.</div>';
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${wxApiKey}`)
      .then(r => r.json())
      .then(data => {
        document.getElementById('weather').innerHTML = `
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:40px">🌡️</div>
            <div>
              <div class="wx-temp">${Math.round(data.main.temp)}°F</div>
              <div style="font-size:12px;color:#7a92a4">${data.weather[0].description}</div>
              <div style="font-size:10px;color:#7a92a4;margin-top:2px">📍 ${esc(data.name)}</div>
            </div>
          </div>`;
      }).catch(() => {
        document.getElementById('weather').innerHTML =
          '<div style="font-size:11px;color:#d95050">Weather unavailable.</div>';
      });
  }, () => {
    document.getElementById('weather').innerHTML =
      '<div style="font-size:11px;color:#7a92a4">Location denied.</div>';
  });
}

// Links
function renderLinks() {
  document.getElementById('links-list').innerHTML = LINKS.map(l => {
    const d = new URL(l.url).hostname;
    return `<a class="link-item" href="${l.url}" target="_blank" rel="noopener">
      <img class="link-fav" src="https://www.google.com/s2/favicons?domain=${d}&sz=32" alt="">
      <span>${esc(l.name)}</span>
    </a>`;
  }).join('');
}

// Z.ai GLM Chat with web search tool
document.getElementById('chat-send').addEventListener('click', sendChat);
document.getElementById('chat-in').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

async function sendChat() {
  const input = document.getElementById('chat-in');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendMsg('user', msg);
  messages.push({ role: 'user', content: msg });
  if (!apiKey) { appendMsg('assistant', 'Add your Z.ai API key in settings to use GLM.'); return; }
  try {
    const res = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+apiKey },
      body: JSON.stringify({
        model: 'glm-4.5', max_tokens: 1024,
        tools: [{ type:'web_search', web_search:{ enable:true, search_result:true } }],
        messages: [
          { role:'system', content:'You are a concise AI assistant for a performance marketing agency. Be brief and practical.' },
          ...messages
        ]
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Error getting response.';
    const sources = data.web_search || [];
    messages.push({ role: 'assistant', content: reply });
    appendMsg('assistant', reply, sources);
  } catch { appendMsg('assistant', 'Network error.'); }
}

function appendMsg(role, text, sources = []) {
  const c = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  let html = `<div>${esc(text)}</div>`;
  if (sources.length) {
    html += sources.slice(0, 3).map(s => {
      const d = (() => { try { return new URL(s.link).hostname; } catch { return 'source'; } })();
      return `<a class="source-card" href="${s.link}" target="_blank" rel="noopener">
        <img src="https://www.google.com/s2/favicons?domain=${d}&sz=16" width="12" height="12" alt="">
        <span>${esc(s.title || d)}</span>
      </a>`;
    }).join('');
  }
  el.innerHTML = html;
  c.appendChild(el);
  c.scrollTop = c.scrollHeight;
}

document.getElementById('theme-btn').addEventListener('click', () => {
  isDark = !isDark;
  document.getElementById('tt-logo').src = isDark ? 'tt_white_logo.png' : 'tt_black_logo.png';
  document.getElementById('tt-logo').style.mixBlendMode = isDark ? 'screen' : 'multiply';
});

document.addEventListener('DOMContentLoaded', () => {
  tick();
  setInterval(tick, 1000);
  fetchWeather();
  renderLinks();
});
