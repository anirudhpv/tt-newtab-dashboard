// v0.3 — Dashboard shell: clock, OpenWeatherMap weather, world clocks, links, Claude chat

const TIMEZONES = [
  { label:'Pacific',  tz:'America/Los_Angeles', short:'PT',  city:'Los Angeles' },
  { label:'Mountain', tz:'America/Denver',      short:'MT',  city:'Denver' },
  { label:'Central',  tz:'America/Chicago',     short:'CT',  city:'Chicago' },
  { label:'Eastern',  tz:'America/New_York',    short:'ET',  city:'New York' },
  { label:'London',   tz:'Europe/London',       short:'GMT', city:'London' },
  { label:'India',    tz:'Asia/Kolkata',        short:'IST', city:'Mumbai' },
  { label:'Hawaii',   tz:'Pacific/Honolulu',    short:'HST', city:'Honolulu' },
];

const LINKS = [
  { name:'Google Ads',       url:'https://ads.google.com' },
  { name:'Meta Ads',         url:'https://business.facebook.com' },
  { name:'Google Analytics', url:'https://analytics.google.com' },
  { name:'Claude',           url:'https://claude.ai' },
  { name:'Slack',            url:'https://slack.com' },
  { name:'tigertracks.ai',   url:'https://tigertracks.ai' },
];

let apiKey = localStorage.getItem('tt_apikey') || '';
let wxApiKey = localStorage.getItem('tt_wxapikey') || '';

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n) { return String(n).padStart(2,'0'); }

function tick() {
  const now = new Date();
  document.getElementById('hero-time').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById('hero-date').textContent =
    `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  document.getElementById('footer-date').textContent = now.toLocaleDateString();
  renderTZGrid(now);
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

// Weather via OpenWeatherMap (requires API key)
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
          <div class="wx-main">
            <div class="wx-icon">🌡️</div>
            <div>
              <div class="wx-temp">${Math.round(data.main.temp)}°F</div>
              <div class="wx-desc">${data.weather[0].description}</div>
              <div style="font-size:10px;color:#7a92a4;margin-top:2px">📍 ${data.name}</div>
            </div>
          </div>`;
      })
      .catch(() => {
        document.getElementById('weather').innerHTML =
          '<div style="font-size:11px;color:#d95050">Weather unavailable.</div>';
      });
  }, () => {
    document.getElementById('weather').innerHTML =
      '<div style="font-size:11px;color:#7a92a4">Location denied.</div>';
  });
}

// Quick links
function renderLinks() {
  document.getElementById('links-list').innerHTML = LINKS.map(l => {
    const d = new URL(l.url).hostname;
    return `<a class="link-item" href="${l.url}" target="_blank" rel="noopener">
      <img class="link-fav" src="https://www.google.com/s2/favicons?domain=${d}&sz=32" alt="">
      <span>${l.name}</span>
    </a>`;
  }).join('');
}

// Chat (Claude API — Anthropic)
let messages = [];

document.getElementById('chat-send').addEventListener('click', sendChat);
document.getElementById('chat-in').addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChat();
});

async function sendChat() {
  const input = document.getElementById('chat-in');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  if (!apiKey) {
    appendMsg('assistant', 'Add your Anthropic API key in settings to use chat.');
    return;
  }
  appendMsg('user', msg);
  messages.push({ role: 'user', content: msg });
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages
      })
    });
    const data = await res.json();
    const reply = data.content?.[0]?.text || 'Error getting response.';
    messages.push({ role: 'assistant', content: reply });
    appendMsg('assistant', reply);
  } catch {
    appendMsg('assistant', 'Network error.');
  }
}

function appendMsg(role, text) {
  const c = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  c.appendChild(el);
  c.scrollTop = c.scrollHeight;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  tick();
  setInterval(tick, 1000);
  fetchWeather();
  renderLinks();
});
