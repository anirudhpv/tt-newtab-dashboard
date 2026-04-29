// v0.7 — Open-Meteo weather (no API key), Nominatim geocoding, design refresh

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

const WMO = {
  0:{d:'Clear sky',e:'☀️'},1:{d:'Mainly clear',e:'🌤️'},2:{d:'Partly cloudy',e:'⛅'},
  3:{d:'Overcast',e:'☁️'},45:{d:'Foggy',e:'🌫️'},61:{d:'Slight rain',e:'🌧️'},63:{d:'Rain',e:'🌧️'},
  65:{d:'Heavy rain',e:'🌧️'},71:{d:'Light snow',e:'❄️'},80:{d:'Showers',e:'🌦️'},95:{d:'Thunderstorm',e:'⛈️'},
};

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
let isDark  = true;
let wxUnit  = 'F';
let wxData  = null;
let tzView  = 'grid';
let mapReady = false, mapCtx = null, mapPaths = [];
let messages = [];

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MAP_W = 900, MAP_H = 460;

function pad(n) { return String(n).padStart(2,'0'); }
function lonToX(lon) { return ((lon + 180) / 360) * MAP_W; }
function latToY(lat) { return ((90 - lat) / 180) * MAP_H; }
function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fToC(f) { return (f - 32) * 5 / 9; }
function displayTemp(f) { return wxUnit === 'F' ? `${Math.round(f)}°F` : `${Math.round(fToC(f))}°C`; }

function renderMarkdown(text) {
  marked.setOptions({ breaks: true, gfm: true });
  const raw = marked.parse(text);
  return DOMPurify.sanitize(raw, { FORBID_TAGS: ['script','style'] })
    .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

function tick() {
  const now = new Date();
  document.getElementById('hero-time').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById('hero-date').textContent =
    `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  document.getElementById('hero-tz').textContent =
    Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');
  document.getElementById('footer-date').textContent =
    now.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  renderTZGrid(now);
  if (tzView === 'map' && mapReady) drawMap(now);
}

function renderTZGrid(now) {
  document.getElementById('tz-grid').innerHTML = TIMEZONES.map(tz => {
    const d = new Date(now.toLocaleString('en-US', { timeZone: tz.tz }));
    const h = d.getHours(), m = pad(d.getMinutes());
    const ampm = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    return `<div class="tz-cell">
      <div class="tz-short">${tz.short}</div>
      <div class="tz-time">${h12}:${m}</div>
      <div class="tz-ampm">${ampm}</div>
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
    mapReady = true; drawMap(new Date());
  } catch { mapCtx.fillStyle = '#7a92a4'; mapCtx.fillText('Map unavailable', MAP_W/2-60, MAP_H/2); }
}

function drawMap(now) {
  if (!mapCtx || !mapReady) return;
  const ctx = mapCtx, isDk = isDark;
  ctx.fillStyle = isDk ? '#0a1520' : '#c0d8ec'; ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.fillStyle = isDk ? '#1e3448' : '#c8ddb0'; ctx.strokeStyle = isDk ? '#2a4a60' : '#a8c090'; ctx.lineWidth = 0.5;
  for (const path of mapPaths) { ctx.fill(path); ctx.stroke(path); }
  TIMEZONES.forEach(tz => {
    const x = lonToX(tz.lon), y = latToY(tz.lat);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2);
    ctx.fillStyle = '#229FA1'; ctx.fill();
    ctx.fillStyle = isDk ? 'rgba(228,236,242,.7)' : 'rgba(10,28,40,.7)';
    ctx.font = '8.5px DM Mono,monospace'; ctx.fillText(tz.short, x+8, y+4);
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

// Weather via Open-Meteo + Nominatim (no API key required)
async function fetchWeather() {
  document.getElementById('weather').innerHTML =
    '<div style="color:var(--text-muted);font-size:12px">Detecting location…</div>';
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const [wxRes, geoRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto`),
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
      ]);
      const wx = await wxRes.json(), geo = await geoRes.json();
      wxData = {
        tempF:    wx.current.temperature_2m,
        feelsF:   wx.current.apparent_temperature,
        humidity: wx.current.relative_humidity_2m,
        wind:     wx.current.wind_speed_10m,
        code:     wx.current.weather_code,
        city:     geo.address?.city || geo.address?.town || geo.address?.county || 'Your location',
        state:    geo.address?.state_code || '',
      };
      renderWeather();
    } catch {
      document.getElementById('weather').innerHTML =
        '<div style="color:#d95050;font-size:12px">Could not load weather.</div>';
    }
  }, () => {
    document.getElementById('weather').innerHTML =
      '<div style="color:var(--text-muted);font-size:12px">Location access denied.</div>';
  });
}

function renderWeather() {
  if (!wxData) return;
  const wmo = WMO[wxData.code] || { d:'Unknown', e:'🌡️' };
  document.getElementById('weather').innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
      <div class="wx-icon">${wmo.e}</div>
      <div>
        <div class="wx-temp">${displayTemp(wxData.tempF)}</div>
        <div class="wx-desc">${wmo.d}</div>
        <div class="wx-loc">📍 ${esc(wxData.city)}${wxData.state ? ', ' + wxData.state : ''}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)">
      <div><div style="font-size:8.5px;color:var(--text-muted);font-family:var(--font-mono);letter-spacing:.8px;text-transform:uppercase">Feels Like</div><div style="font-size:14px;font-weight:500;margin-top:1px">${displayTemp(wxData.feelsF)}</div></div>
      <div><div style="font-size:8.5px;color:var(--text-muted);font-family:var(--font-mono);letter-spacing:.8px;text-transform:uppercase">Humidity</div><div style="font-size:14px;font-weight:500;margin-top:1px">${wxData.humidity}%</div></div>
    </div>`;
}

function setWxUnit(u) {
  wxUnit = u;
  document.getElementById('wx-f-btn').classList.toggle('active', u === 'F');
  document.getElementById('wx-c-btn').classList.toggle('active', u === 'C');
  if (wxData) renderWeather();
}
document.getElementById('wx-f-btn').addEventListener('click', () => setWxUnit('F'));
document.getElementById('wx-c-btn').addEventListener('click', () => setWxUnit('C'));

// Links
function renderLinks() {
  document.getElementById('links-list').innerHTML = LINKS.map(l => {
    const d = new URL(l.url).hostname;
    return `<a class="link-item" href="${l.url}" target="_blank" rel="noopener">
      <img class="link-fav" src="https://www.google.com/s2/favicons?domain=${d}&sz=32" alt="" style="width:15px;height:15px;border-radius:3px">
      <span>${esc(l.name)}</span>
    </a>`;
  }).join('');
}

// Z.ai GLM Chat with markdown
document.getElementById('chat-send').addEventListener('click', sendChat);
document.getElementById('chat-in').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});

async function sendChat() {
  const input = document.getElementById('chat-in');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendMsg('user', msg);
  messages.push({ role: 'user', content: msg });
  if (!apiKey) { appendMsg('assistant', 'Add your Z.ai API key in settings to use GLM.'); return; }
  const thinking = appendThinking();
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
    thinking.remove();
    const reply = data.choices?.[0]?.message?.content || 'Error.';
    messages.push({ role: 'assistant', content: reply });
    appendMsg('assistant', reply);
  } catch { thinking.remove(); appendMsg('assistant', 'Network error.'); }
}

function appendMsg(role, text) {
  const c = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  if (role === 'assistant') {
    const md = document.createElement('div');
    md.className = 'msg-md';
    md.innerHTML = renderMarkdown(text);
    el.appendChild(md);
  } else {
    el.textContent = text;
  }
  c.appendChild(el);
  c.scrollTop = c.scrollHeight;
  return el;
}

function appendThinking() {
  const c = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'msg assistant';
  el.innerHTML = '<span style="font-style:italic;color:var(--text-muted);font-size:11px">Thinking…</span>';
  c.appendChild(el);
  c.scrollTop = c.scrollHeight;
  return el;
}

// Theme
document.getElementById('theme-btn').addEventListener('click', () => {
  isDark = !isDark;
  document.documentElement.classList.toggle('lm', !isDark);
  document.getElementById('theme-btn').textContent = isDark ? '☀' : '☾';
  document.getElementById('tt-logo').src = isDark ? 'tt_white_logo.png' : 'tt_black_logo.png';
  document.getElementById('tt-logo').style.mixBlendMode = isDark ? 'screen' : 'multiply';
  if (tzView === 'map' && mapReady) drawMap(new Date());
});

document.addEventListener('DOMContentLoaded', () => {
  tick();
  setInterval(tick, 1000);
  fetchWeather();
  renderLinks();
});
