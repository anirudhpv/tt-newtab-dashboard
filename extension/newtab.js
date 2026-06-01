// ───── CONSTANTS ─────
const TIMEZONES = [
  { label:'Hawaii',   tz:'Pacific/Honolulu',    short:'HST', city:'Honolulu',    lat:21.31,  lon:-157.82 },
  { label:'Pacific',  tz:'America/Los_Angeles', short:'PT',  city:'Los Angeles', lat:34.05,  lon:-118.24 },
  { label:'Mountain', tz:'America/Denver',      short:'MT',  city:'Denver',      lat:39.74,  lon:-104.98 },
  { label:'CDMX',     tz:'America/Mexico_City', short:'CST', city:'Mexico City', lat:19.43,  lon:-99.13  },
  { label:'Central',  tz:'America/Chicago',     short:'CT',  city:'Chicago',     lat:41.88,  lon:-87.63  },
  { label:'Eastern',  tz:'America/New_York',    short:'ET',  city:'New York',    lat:40.71,  lon:-74.01  },
  { label:'London',   tz:'Europe/London',       short:'GMT', city:'London',      lat:51.51,  lon:-0.13   },
  { label:'Dubai',    tz:'Asia/Dubai',          short:'GST', city:'Dubai',       lat:25.20,  lon:55.27   },
  { label:'India',    tz:'Asia/Kolkata',        short:'IST', city:'Mumbai',      lat:19.08,  lon:72.88   },
];

const WMO = {
  0:{d:'Clear sky',e:'☀️'},1:{d:'Mainly clear',e:'🌤️'},2:{d:'Partly cloudy',e:'⛅'},
  3:{d:'Overcast',e:'☁️'},45:{d:'Foggy',e:'🌫️'},48:{d:'Rime fog',e:'🌫️'},
  51:{d:'Light drizzle',e:'🌦️'},53:{d:'Drizzle',e:'🌦️'},55:{d:'Heavy drizzle',e:'🌧️'},
  61:{d:'Slight rain',e:'🌧️'},63:{d:'Rain',e:'🌧️'},65:{d:'Heavy rain',e:'🌧️'},
  71:{d:'Light snow',e:'❄️'},73:{d:'Snow',e:'❄️'},75:{d:'Heavy snow',e:'❄️'},
  80:{d:'Showers',e:'🌦️'},81:{d:'Showers',e:'🌧️'},82:{d:'Heavy showers',e:'🌧️'},
  95:{d:'Thunderstorm',e:'⛈️'},96:{d:'Thunderstorm',e:'⛈️'},99:{d:'Thunderstorm',e:'⛈️'},
};

// Google products S2 favicon service gets wrong — hard-pin to product-specific icons.
// Analytics is encoded inline as a base64 data URI so we don't depend on an external CDN.
const GA_ICON = 'data:image/svg+xml;base64,' + btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect x="42" y="6" width="14" height="52" rx="7" fill="#F9AB00"/>` +
  `<rect x="22" y="22" width="14" height="36" rx="7" fill="#E37400"/>` +
  `<circle cx="13" cy="51" r="7" fill="#E37400"/></svg>`
);

// Brand-aligned "TT" monogram for tigertracks.ai — the real favicon's tiger
// silhouette extends edge to edge and visually crops in a small rounded container.
const TT_ICON = 'data:image/svg+xml;base64,' + btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<text x="32" y="46" text-anchor="middle" font-family="Georgia,serif" ` +
  `font-size="38" font-style="italic" font-weight="400" fill="#229FA1">TT</text></svg>`
);

const FAVICON_OVERRIDES = {
  'docs.google.com':       'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  'drive.google.com':      'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_32dp.png',
  'calendar.google.com':   'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico',
  'mail.google.com':       'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  'analytics.google.com':  GA_ICON,
  'tigertracks.ai':        TT_ICON,
};

// Editorial quotes rotated daily — gentle agency-style flavor under the greeting
const QUOTES = [
  '“Performance is a habit, not an event.”',
  '“Strategy without execution is hallucination.”',
  '“Half the work is choosing what not to ship.”',
  '“The brief is the work.”',
  '“Brands compound. So do mistakes.”',
  '“Measure what matters, ignore what flatters.”',
  '“Clarity is a competitive advantage.”',
];

// ───── STATE ─────
let apiKey      = '';
let isDark      = true;
let density     = 'comfortable';
let wxUnit      = 'F';
let wxData      = null;
let wxHourly    = null;
let memory      = '';
let tzView      = 'grid';
let mapReady    = false;
let mapWorld    = null;
let mapCtx      = null;
let mapPaths    = [];
let sessionStart= Date.now();

let sbVisible   = true;
let sbExpanded  = true;

let sessions    = [];
let activeId    = null;

// Which multi-link rows are open in the sidebar (by index in the links array)
let openMultis  = new Set();

const SK = {
  settings: 'tt_settings',
  sessions: 'tt_sessions',
  memory:   'tt_memory',
  sidebar:  'tt_sidebar',
  geo:      'tt_geo',
  pomo:     'tt_pomodoro',
};

// ───── INIT ─────
function init() {
  loadStorage();
  renderTZGrid();
  tick();
  setInterval(tick, 1000);
  fetchWeather();
  renderSidebarLinks();
  renderDock();
  renderSessions();
  loadActiveSession();
  checkApiKey();
  updateFooter();
  setInterval(updateFooter, 60000);
  setQuote();
  pomoInit();
  bindEvents();
}

function bindEvents() {
  document.getElementById('theme-btn').addEventListener('click', toggleTheme);

  // Settings
  document.getElementById('settings-open-btn').addEventListener('click', openSettings);
  document.getElementById('settings-cancel').addEventListener('click', closeSettings);
  document.getElementById('settings-save').addEventListener('click', saveSettings);
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('settings-modal')) closeSettings();
  });
  document.querySelectorAll('.modal-tab').forEach(t =>
    t.addEventListener('click', () => switchSettingsTab(t.dataset.tab)));

  // Density (lives in settings modal now)
  document.querySelectorAll('#density-seg .seg-btn').forEach(b =>
    b.addEventListener('click', () => setDensity(b.dataset.density)));

  // Weather unit
  document.getElementById('wx-f-btn').addEventListener('click', () => setWxUnit('F'));
  document.getElementById('wx-c-btn').addEventListener('click', () => setWxUnit('C'));
  document.getElementById('weather-content').addEventListener('click', e => {
    if (e.target.classList.contains('wx-retry')) fetchWeather();
    if (e.target.classList.contains('wx-hourly-refresh')) fetchWeather();
  });

  // TZ view
  document.getElementById('tz-btn-grid').addEventListener('click', () => setTZView('grid'));
  document.getElementById('tz-btn-map').addEventListener('click',  () => setTZView('map'));

  // Chat
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  document.getElementById('chat-send').addEventListener('click', sendChat);
  document.getElementById('api-key-link').addEventListener('click', openSettings);

  // Sessions / drawer
  document.getElementById('sessions-btn').addEventListener('click', openDrawer);
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('new-chat-btn').addEventListener('click', newSession);
  document.getElementById('drawer-new-btn').addEventListener('click', () => { newSession(); closeDrawer(); });
  document.getElementById('drawer-search').addEventListener('input', renderSessions);
  document.getElementById('memory-suggest-btn').addEventListener('click', () => suggestMemory(true));

  // Memory toast
  document.getElementById('mt-accept').addEventListener('click', acceptMemory);
  document.getElementById('mt-reject').addEventListener('click', () => hideMemoryToast());
  document.getElementById('mt-edit-btn').addEventListener('click', toggleMemoryEdit);

  // Sidebar toggle
  document.getElementById('sb-toggle-btn').addEventListener('click', toggleSidebar);
  document.getElementById('sb-rail-btn').addEventListener('click', toggleSidebarExpand);

  // Manage links → open settings → Links tab
  document.getElementById('sb-add-btn').addEventListener('click', () => {
    openSettings();
    switchSettingsTab('links');
  });
  document.getElementById('link-add-btn').addEventListener('click', addLinkFromModal);
  document.getElementById('link-add-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addLinkFromModal();
  });

  // Pomodoro
  document.getElementById('pomo-toggle').addEventListener('click', pomoToggle);
  document.getElementById('pomo-reset').addEventListener('click', pomoReset);
  document.querySelectorAll('#pomo-mode-seg .seg-btn').forEach(b =>
    b.addEventListener('click', () => pomoSelectTab(b.dataset.mode)));
  document.getElementById('pomo-confirm-ok').addEventListener('click', pomoConfirmOk);
  document.getElementById('pomo-confirm-cancel').addEventListener('click', pomoConfirmCancel);
  document.getElementById('pomo-running-note').addEventListener('click', () => {
    // Jump back to the phase that is actually running.
    pomoView = pomoState.mode; pomoConfirming = false; pomoRender();
  });
  ['focus','short','long','every'].forEach(k => {
    document.getElementById('pomo-cfg-' + k).addEventListener('change', readPomoConfigFromInputs);
  });
  // Sound settings (cross-tab sync is wired in pomoInit for both SW & fallback modes)
  document.querySelectorAll('#pomo-sound-seg .seg-btn').forEach(b =>
    b.addEventListener('click', () => setPomoSound(b.dataset.sound === 'on')));
  document.getElementById('pomo-chime-select').addEventListener('change', e => setPomoChime(e.target.value));
  document.getElementById('pomo-chime-preview').addEventListener('click', () => {
    const name = document.getElementById('pomo-chime-select').value;
    if (typeof ttPlayChime === 'function') ttPlayChime(name);
  });
}

// ───── STORAGE ─────
function loadStorage() {
  try {
    const s = JSON.parse(localStorage.getItem(SK.settings) || '{}');
    apiKey  = s.apiKey   || '';
    isDark  = s.isDark   !== false;
    density = s.density  || 'comfortable';
    wxUnit  = s.wxUnit   || 'F';
  } catch {}
  try { sessions = JSON.parse(localStorage.getItem(SK.sessions) || '[]'); } catch { sessions = []; }
  memory = localStorage.getItem(SK.memory) || '';
  try {
    const sb = JSON.parse(localStorage.getItem(SK.sidebar) || '{}');
    sbVisible  = sb.sbVisible  !== false;
    sbExpanded = sb.sbExpanded !== false;
  } catch {}
  applyTheme(); applyDensity(); applyWxUnit(); applySidebarState();
  if (!sessions.length) newSession(false);
  else activeId = sessions[0].id;
}

function saveSettingsStore() {
  localStorage.setItem(SK.settings, JSON.stringify({ apiKey, isDark, density, wxUnit }));
}
function saveSessionsStore() { localStorage.setItem(SK.sessions, JSON.stringify(sessions)); }
function saveMemoryStore()   { localStorage.setItem(SK.memory, memory); }
function saveSidebarState() {
  localStorage.setItem(SK.sidebar, JSON.stringify({ sbVisible, sbExpanded }));
}
function getLinks() {
  try { return JSON.parse(localStorage.getItem('tt_links') || 'null') || defaultLinks(); }
  catch { return defaultLinks(); }
}
function saveLinks(l) { localStorage.setItem('tt_links', JSON.stringify(l)); }

// ───── SIDEBAR ─────
function applySidebarState() {
  const sb = document.getElementById('left-sidebar');
  const btn = document.getElementById('sb-toggle-btn');
  sb.classList.toggle('hidden', !sbVisible);
  sb.classList.toggle('rail', !sbExpanded);
  btn.classList.toggle('on', sbVisible);
}
function toggleSidebar() { sbVisible = !sbVisible; applySidebarState(); saveSidebarState(); }
function toggleSidebarExpand() { sbExpanded = !sbExpanded; applySidebarState(); saveSidebarState(); }

// ───── CLOCK ─────
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function tick() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  document.getElementById('hh').textContent = pad(h);
  document.getElementById('mm').textContent = pad(m);
  document.getElementById('ss').textContent = pad(s);
  const dateStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  document.getElementById('hero-date').textContent = dateStr;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('hero-tz').textContent = tz.replace(/_/g,' ').replace(/^.*\//,'');
  const greet = h<12 ? 'Good morning,' : h<17 ? 'Good afternoon,' : 'Good evening,';
  document.getElementById('hero-greeting').innerHTML = `${greet}<br><em>Anirudh</em>`;
  document.getElementById('h-greeting-mini').textContent = greet.replace(',','');
  document.getElementById('h-date-mini').textContent =
    `${SHORT_DAYS[now.getDay()]} ${MONTHS[now.getMonth()].slice(0,3)} ${now.getDate()}`;
  document.getElementById('footer-date').textContent =
    now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  updateTZGrid(now);
  if (tzView==='map' && mapReady) drawMap(now);
}
function pad(n) { return String(n).padStart(2,'0'); }

function setQuote() {
  const day = Math.floor(Date.now()/86400000);
  document.getElementById('hero-quote').textContent = QUOTES[day % QUOTES.length];
}

// ───── DAY/NIGHT ─────
function dayNightIcon(h) {
  if (h>=6  && h<8)  return { icon:'🌅', cls:'is-dawn' };
  if (h>=8  && h<19) return { icon:'☀️',  cls:'' };
  if (h>=19 && h<21) return { icon:'🌇', cls:'is-dawn' };
  return                    { icon:'🌙', cls:'is-night' };
}

// ───── TZ GRID ─────
function renderTZGrid() {
  const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('tz-grid-view').innerHTML = TIMEZONES.map((tz,i) => `
    <div class="tz-item${localTZ===tz.tz?' local':''}" id="tz-${i}">
      <span class="tz-icon" id="tz-icon-${i}">☀️</span>
      <span class="tz-label">${tz.label}</span>
      <span class="tz-time" id="tz-time-${i}">--:--</span>
      <span class="tz-ampm" id="tz-ampm-${i}">--</span>
      <span class="tz-off" id="tz-off-${i}"></span>
      <span class="tz-day" id="tz-day-${i}">+1</span>
    </div>`).join('');
}

function updateTZGrid(now) {
  const localTZ  = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Wall-clock "now" in the user's own zone — the baseline we measure against.
  const localDate = new Date(now.toLocaleString('en-US',{timeZone:localTZ}));
  const localDay = localDate.getDate();
  TIMEZONES.forEach((tz,i) => {
    const tzDate = new Date(now.toLocaleString('en-US',{timeZone:tz.tz}));
    const h=tzDate.getHours(), m=pad(tzDate.getMinutes());
    const ampm=h>=12?'PM':'AM', h12=h%12||12;
    const {icon,cls} = dayNightIcon(h);
    document.getElementById(`tz-time-${i}`).textContent=`${h12}:${m}`;
    document.getElementById(`tz-ampm-${i}`).textContent=ampm;
    document.getElementById(`tz-icon-${i}`).textContent=icon;
    // Difference = target wall time − local wall time, rounded to the nearest
    // quarter hour (covers :30 / :45 zones like India).
    const diffH = Math.round((tzDate - localDate) / 3600000 * 4) / 4;
    const sign = diffH > 0 ? '+' : '';
    document.getElementById(`tz-off-${i}`).textContent=
      tz.tz===localTZ ? 'local' : `${sign}${diffH%1===0?diffH:diffH.toFixed(2).replace(/0$/,'')}h`;
    const tzDay=tzDate.getDate();
    const badge=document.getElementById(`tz-day-${i}`);
    if(tzDay>localDay){badge.textContent='+1';badge.classList.add('on');}
    else if(tzDay<localDay){badge.textContent='-1';badge.classList.add('on');}
    else badge.classList.remove('on');
    document.getElementById(`tz-${i}`).className=
      `tz-item${localTZ===tz.tz?' local':''}${cls?' '+cls:''}`;
  });
}

// ───── TZ VIEW ─────
function setTZView(v) {
  tzView=v;
  document.getElementById('tz-grid-view').style.display=v==='grid'?'grid':'none';
  document.getElementById('tz-map-view').style.display=v==='map'?'block':'none';
  document.getElementById('tz-btn-grid').classList.toggle('on',v==='grid');
  document.getElementById('tz-btn-map').classList.toggle('on',v==='map');
  if(v==='map') initMap();
}

// ───── MAP ─────
const MAP_W=900, MAP_H=460;
function lonToX(lon){return((lon+180)/360)*MAP_W;}
function latToY(lat){return((90-lat)/180)*MAP_H;}

async function initMap() {
  if(mapReady){drawMap(new Date());return;}
  const canvas=document.getElementById('world-canvas');
  mapCtx=canvas.getContext('2d');
  try {
    const res=await fetch('js/countries-110m.json');
    mapWorld=await res.json();
    const land=topojson.feature(mapWorld,mapWorld.objects.countries);
    mapPaths=land.features.map(f=>{
      const p=new Path2D();
      projectGeom(f.geometry,p);
      return p;
    });
    mapReady=true;
    drawMap(new Date());
  } catch(e) {
    mapCtx.fillStyle='#7a92a4';
    mapCtx.font='14px DM Mono,monospace';
    mapCtx.fillText('Map unavailable',MAP_W/2-60,MAP_H/2);
  }
  canvas.addEventListener('mousemove',onMapHover);
  canvas.addEventListener('click',onMapClick);
  canvas.addEventListener('mouseleave',()=>{document.getElementById('map-tooltip').style.display='none';});
}

function projectGeom(geom,path) {
  const rings=geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[];
  for(const poly of rings) for(const ring of poly) {
    if(!ring.length) continue;
    path.moveTo(lonToX(ring[0][0]),latToY(ring[0][1]));
    for(let k=1;k<ring.length;k++) path.lineTo(lonToX(ring[k][0]),latToY(ring[k][1]));
    path.closePath();
  }
}

function drawMap(now) {
  if(!mapCtx||!mapReady) return;
  const ctx=mapCtx;
  const isDk=!document.documentElement.classList.contains('lm');
  ctx.fillStyle=isDk?'#0a1520':'#dfe9f2';
  ctx.fillRect(0,0,MAP_W,MAP_H);
  const utcH=now.getUTCHours()+now.getUTCMinutes()/60;
  const sunLon=180-(utcH/24)*360;
  const sunX=lonToX(sunLon);
  const nightCol=isDk?'rgba(0,0,20,0.45)':'rgba(20,30,80,0.18)';
  const grad=ctx.createLinearGradient(0,0,MAP_W,0);
  grad.addColorStop(0,nightCol);
  grad.addColorStop(Math.max(0,sunX/MAP_W-0.25),nightCol);
  grad.addColorStop(Math.min(1,sunX/MAP_W),'rgba(0,0,0,0)');
  grad.addColorStop(Math.min(1,sunX/MAP_W+0.5),'rgba(0,0,0,0)');
  grad.addColorStop(1,nightCol);
  ctx.strokeStyle=isDk?'rgba(34,159,161,.06)':'rgba(34,159,161,.1)';
  ctx.lineWidth=0.5;
  for(let lon=-180;lon<=180;lon+=30){ctx.beginPath();ctx.moveTo(lonToX(lon),0);ctx.lineTo(lonToX(lon),MAP_H);ctx.stroke();}
  for(let lat=-90;lat<=90;lat+=30){ctx.beginPath();ctx.moveTo(0,latToY(lat));ctx.lineTo(MAP_W,latToY(lat));ctx.stroke();}
  ctx.fillStyle=isDk?'#1a2d3e':'#c4d6c0';
  ctx.strokeStyle=isDk?'#274057':'#a0b29a';
  ctx.lineWidth=0.5;
  for(const path of mapPaths){ctx.fill(path);ctx.stroke(path);}
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,MAP_W,MAP_H);
  TIMEZONES.forEach((tz,i)=>{
    const tzDate=new Date(now.toLocaleString('en-US',{timeZone:tz.tz}));
    const h=tzDate.getHours();
    const {cls}=dayNightIcon(h);
    const x=lonToX(tz.lon), y=latToY(tz.lat);
    const color=cls==='is-night'?'#5a78e8':cls==='is-dawn'?'#e8a020':'#229FA1';
    ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle=color+'28';ctx.fill();
    ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
    ctx.strokeStyle=isDk?'rgba(255,255,255,.3)':'rgba(0,0,0,.2)';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=isDk?'rgba(228,236,242,.7)':'rgba(10,28,40,.7)';
    ctx.font='8.5px DM Mono,monospace';
    ctx.fillText(tz.short,x+8,y+4);
  });
}

function getCanvasPos(e) {
  const canvas=document.getElementById('world-canvas');
  const rect=canvas.getBoundingClientRect();
  return{x:(e.clientX-rect.left)*(MAP_W/rect.width),y:(e.clientY-rect.top)*(MAP_H/rect.height)};
}
function nearestTZ(x,y) {
  let best=null,bestDist=Infinity;
  TIMEZONES.forEach((tz,i)=>{
    const dx=x-lonToX(tz.lon),dy=y-latToY(tz.lat);
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<bestDist){bestDist=d;best=i;}
  });
  return bestDist<40?best:null;
}
function onMapHover(e) {
  const{x,y}=getCanvasPos(e);
  const i=nearestTZ(x,y);
  document.getElementById('world-canvas').style.cursor=i!==null?'pointer':'crosshair';
  if(i!==null) showMapTooltip(i,e);
  else document.getElementById('map-tooltip').style.display='none';
}
function onMapClick(e) {
  const{x,y}=getCanvasPos(e);
  const i=nearestTZ(x,y);
  if(i!==null) showMapTooltip(i,e);
}
function showMapTooltip(i,e) {
  const tz=TIMEZONES[i], now=new Date();
  const localTZ=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDate=new Date(now.toLocaleString('en-US',{timeZone:localTZ}));
  const tzDate=new Date(now.toLocaleString('en-US',{timeZone:tz.tz}));
  const h=tzDate.getHours(),m=pad(tzDate.getMinutes());
  const ampm=h>=12?'PM':'AM',h12=h%12||12;
  const{icon}=dayNightIcon(h);
  const diffH=Math.round((tzDate-localDate)/3600000*4)/4, sign=diffH>0?'+':'';
  const offStr=tz.tz===localTZ?'local time':`${sign}${diffH%1===0?diffH:diffH.toFixed(2).replace(/0$/,'')}h from you`;
  document.getElementById('tt-city').textContent=`${icon} ${tz.city} · ${tz.short}`;
  document.getElementById('tt-time').textContent=`${h12}:${m} ${ampm}`;
  document.getElementById('tt-sub').textContent=`${tz.label} · ${offStr}`;
  const tt=document.getElementById('map-tooltip');
  const cont=document.getElementById('tz-map-view');
  const cRect=cont.getBoundingClientRect();
  let left=e.clientX-cRect.left+14, top=e.clientY-cRect.top-30;
  if(left+170>cRect.width) left=e.clientX-cRect.left-170;
  if(top<0) top=8;
  tt.style.left=left+'px'; tt.style.top=top+'px'; tt.style.display='block';
}

// ───── WEATHER ─────
function getCachedGeo() {
  try { return JSON.parse(localStorage.getItem(SK.geo) || 'null'); } catch { return null; }
}
function saveCachedGeo(lat, lon) {
  localStorage.setItem(SK.geo, JSON.stringify({ lat, lon, savedAt: Date.now() }));
}

function fetchWeather() {
  const cached = getCachedGeo();
  if (cached) {
    loadWeatherFor(cached.lat, cached.lon);
    // refresh location silently in the background (don't show spinner)
    detectLocation(false);
  } else {
    document.getElementById('weather-content').innerHTML =
      `<div class="wx-loading"><div class="spin"></div><span>Detecting location…</span></div>`;
    detectLocation(true);
  }
}

function detectLocation(showError) {
  if (!navigator.geolocation) {
    if (showError) showLocationError('Geolocation not available.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      saveCachedGeo(pos.coords.latitude, pos.coords.longitude);
      // only re-load weather if we don't already have data on screen
      if (!wxData) loadWeatherFor(pos.coords.latitude, pos.coords.longitude);
    },
    err => {
      if (!showError) return;
      const msg = err.code === err.PERMISSION_DENIED
        ? 'Location access denied.'
        : err.code === err.TIMEOUT
          ? 'Location detection timed out.'
          : 'Could not detect location.';
      showLocationError(msg);
    },
    { timeout: 8000, maximumAge: 600000 }
  );
}

async function loadWeatherFor(lat, lon) {
  const el = document.getElementById('weather-content');
  // soft loading state only if no data yet on screen
  if (!wxData) el.innerHTML = `<div class="wx-loading"><div class="spin"></div><span>Loading weather…</span></div>`;
  try {
    const [wxRes, geoRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&hourly=temperature_2m,weather_code,precipitation_probability&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto&forecast_days=2`),
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
    ]);
    const wx = await wxRes.json(), geo = await geoRes.json();
    wxData = {
      tempF:    wx.current.temperature_2m,
      feelsF:   wx.current.apparent_temperature,
      humidity: wx.current.relative_humidity_2m,
      wind:     wx.current.wind_speed_10m,
      precip:   wx.current.precipitation,
      code:     wx.current.weather_code,
      city:     geo.address?.city||geo.address?.town||geo.address?.village||geo.address?.county||'Your location',
      state:    geo.address?.state_code||geo.address?.country_code?.toUpperCase()||'',
    };
    wxHourly = {
      times:  wx.hourly.time,
      temps:  wx.hourly.temperature_2m,
      codes:  wx.hourly.weather_code,
      precip: wx.hourly.precipitation_probability,
    };
    renderWeather();
  } catch {
    showLocationError("Couldn't load weather.");
  }
}

function showLocationError(msg) {
  document.getElementById('weather-content').innerHTML = `
    <div class="wx-error">
      <div>${esc(msg)}</div>
      <div class="wx-error-actions">
        <span class="wx-link wx-retry">Try detect again</span>
      </div>
      <div class="wx-manual-row">
        <input class="wx-manual-in" type="text" placeholder="Or type a city…">
        <button class="wx-manual-go">→</button>
      </div>
    </div>`;
  const input = document.querySelector('.wx-manual-in');
  const go = document.querySelector('.wx-manual-go');
  if (input && go) {
    const run = () => { const q = input.value.trim(); if (q) geocodeAndLoad(q); };
    go.addEventListener('click', run);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    setTimeout(() => input.focus(), 50);
  }
}

async function geocodeAndLoad(query) {
  document.getElementById('weather-content').innerHTML =
    `<div class="wx-loading"><div class="spin"></div><span>Finding ${esc(query)}…</span></div>`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const arr = await res.json();
    if (arr.length) {
      const lat = +arr[0].lat, lon = +arr[0].lon;
      saveCachedGeo(lat, lon);
      wxData = null;
      loadWeatherFor(lat, lon);
    } else {
      showLocationError(`City "${query}" not found.`);
    }
  } catch {
    showLocationError('Network error.');
  }
}

function fToC(f) { return (f-32)*5/9; }
function displayTemp(f) {
  return wxUnit==='F' ? `${Math.round(f)}` : `${Math.round(fToC(f))}`;
}
function unitSym() { return wxUnit==='F' ? '°F' : '°C'; }

function renderWeather() {
  if(!wxData) return;
  const wmo=WMO[wxData.code]||{d:'Unknown',e:'🌡️'};
  document.getElementById('weather-content').innerHTML=`
    <div class="wx-current">
      <div class="wx-icon">${wmo.e}</div>
      <div class="wx-tempwrap">
        <div class="wx-temp">${displayTemp(wxData.tempF)}<span class="wx-temp-sym">${unitSym()}</span></div>
        <div class="wx-desc">${wmo.d}</div>
        <div class="wx-loc">${esc(wxData.city)}${wxData.state?', '+wxData.state:''}</div>
      </div>
    </div>
    <div class="wx-stats">
      <div class="wx-stat"><span class="wx-stat-k">Feels</span><span class="wx-stat-v">${displayTemp(wxData.feelsF)}${unitSym()}</span></div>
      <div class="wx-stat"><span class="wx-stat-k">Humidity</span><span class="wx-stat-v">${wxData.humidity}%</span></div>
      <div class="wx-stat"><span class="wx-stat-k">Wind</span><span class="wx-stat-v">${Math.round(wxData.wind)} mph</span></div>
      <div class="wx-stat"><span class="wx-stat-k">Precip</span><span class="wx-stat-v">${wxData.precip} mm</span></div>
    </div>
    ${renderHourlyStrip()}`;
}

function renderHourlyStrip() {
  if(!wxHourly || !wxHourly.times) return '';
  const now = new Date();
  let startIdx = wxHourly.times.findIndex(t => new Date(t) >= now);
  if(startIdx < 0) startIdx = 0;
  const hours = [];
  for(let i=startIdx; i<Math.min(startIdx+12, wxHourly.times.length); i++) {
    const t = new Date(wxHourly.times[i]);
    const h = t.getHours();
    const h12 = h%12||12;
    const ampm = h>=12?'p':'a';
    const wmo  = WMO[wxHourly.codes[i]]||{e:'🌡️'};
    const precip = wxHourly.precip[i] ?? 0;
    const isNow = i===startIdx;
    hours.push(`<div class="wx-hour${isNow?' now':''}">
      <div class="wx-hour-time">${h12}${ampm}</div>
      <div class="wx-hour-icon">${wmo.e}</div>
      <div class="wx-hour-temp">${displayTemp(wxHourly.temps[i])}°</div>
      <div class="wx-hour-precip${precip===0?' zero':''}">${precip}%</div>
    </div>`);
  }
  return `<div class="wx-hourly">
    <div class="wx-hourly-head">
      <span class="wx-hourly-label">Next 12 hours</span>
      <span class="wx-hourly-refresh">↻ refresh</span>
    </div>
    <div class="wx-hourly-scroll">${hours.join('')}</div>
  </div>`;
}

function setWxUnit(u) {
  wxUnit=u;
  saveSettingsStore();
  applyWxUnit();
  if(wxData) renderWeather();
}
function applyWxUnit() {
  document.getElementById('wx-f-btn').classList.toggle('on',wxUnit==='F');
  document.getElementById('wx-c-btn').classList.toggle('on',wxUnit==='C');
}

// ───── SESSIONS ─────
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

function newSession(switchTo=true) {
  const sess = { id:genId(), label:'New chat', messages:[], createdAt:Date.now(), updatedAt:Date.now() };
  sessions.unshift(sess);
  saveSessionsStore();
  if(switchTo) { activeId=sess.id; loadActiveSession(); renderSessions(); }
  return sess;
}

function getSession(id) { return sessions.find(s=>s.id===id); }

function loadActiveSession() {
  const sess=getSession(activeId)||sessions[0];
  if(!sess) return;
  activeId=sess.id;
  document.getElementById('chat-session-label').innerHTML=`<em>${esc(sess.label)}</em>`;
  const c=document.getElementById('chat-messages');
  c.innerHTML='';
  if(!sess.messages.length) {
    c.innerHTML=`<div class="chat-empty" id="chat-empty">
      <div class="chat-empty-mark">TT</div>
      <div class="chat-empty-title">Ask anything — campaign strategy, copy, briefs, or quick research.</div>
      <div class="chat-empty-sub">GLM · web search enabled</div>
    </div>`;
  } else {
    sess.messages.forEach(m=>appendMsg(m.role,m.content,false,m.sources||[]));
  }
  checkApiKey();
}

function switchSession(id) { activeId=id; closeDrawer(); loadActiveSession(); renderSessions(); }

function deleteSession(id, e) {
  e.stopPropagation();
  sessions=sessions.filter(s=>s.id!==id);
  if(!sessions.length) newSession(false);
  if(activeId===id) { activeId=sessions[0].id; loadActiveSession(); }
  saveSessionsStore(); renderSessions();
}

function renderSessions() {
  const query=(document.getElementById('drawer-search')?.value||'').toLowerCase();
  const container=document.getElementById('drawer-sessions');
  const filtered=sessions.filter(s=>
    !query || s.label.toLowerCase().includes(query) ||
    s.messages.some(m=>m.content.toLowerCase().includes(query))
  );
  if(!filtered.length) {
    container.innerHTML=`<div class="drawer-empty">No sessions found</div>`;
    return;
  }
  container.innerHTML=filtered.map(s=>`
    <div class="sess-item${s.id===activeId?' on':''}" data-id="${s.id}">
      <div class="sess-item-label">${esc(s.label)}</div>
      <div class="sess-item-meta">${new Date(s.updatedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
      <button class="sess-item-del" data-del="${s.id}">×</button>
    </div>`).join('');
  container.querySelectorAll('.sess-item').forEach(el=>{
    el.addEventListener('click',()=>switchSession(el.dataset.id));
  });
  container.querySelectorAll('.sess-item-del').forEach(btn=>{
    btn.addEventListener('click',e=>deleteSession(btn.dataset.del,e));
  });
}

async function autoLabelSession(sess, firstMsg) {
  if(!apiKey) { sess.label=firstMsg.slice(0,40)+(firstMsg.length>40?'…':''); saveSessionsStore(); renderSessions(); return; }
  try {
    const res=await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body:JSON.stringify({
        model:'glm-4.5',max_tokens:20,
        messages:[
          {role:'system',content:'Generate a 3-6 word title for this chat. Reply with ONLY the title, nothing else.'},
          {role:'user',content:firstMsg}
        ]
      })
    });
    const data=await res.json();
    const label=data.choices?.[0]?.message?.content?.trim()||firstMsg.slice(0,40);
    sess.label=label.replace(/^["']|["']$/g,'');
    saveSessionsStore(); renderSessions();
    document.getElementById('chat-session-label').innerHTML=`<em>${esc(sess.label)}</em>`;
  } catch { sess.label=firstMsg.slice(0,40); saveSessionsStore(); renderSessions(); }
}

// ───── DRAWER ─────
function openDrawer() { document.getElementById('chat-drawer').classList.add('open'); renderSessions(); }
function closeDrawer() { document.getElementById('chat-drawer').classList.remove('open'); }

// ───── CHAT ─────
function checkApiKey() {
  const row=document.getElementById('chat-input-row');
  const prompt=document.getElementById('api-key-prompt-row');
  if(apiKey){row.style.display='flex';prompt.style.display='none';}
  else{row.style.display='none';prompt.style.display='block';}
}

async function sendChat() {
  const input=document.getElementById('chat-input');
  const msg=input.value.trim();
  if(!msg||!apiKey) return;
  input.value='';
  document.getElementById('chat-send').disabled=true;

  const sess=getSession(activeId);
  if(!sess) return;
  const isFirst=sess.messages.length===0;

  appendMsg('user',msg);
  sess.messages.push({role:'user',content:msg});
  sess.updatedAt=Date.now();
  saveSessionsStore();

  if(isFirst) autoLabelSession(sess,msg);

  const thinking=appendThinking();

  const systemMsg=`You are a concise AI assistant in a TigerTracks performance marketing agency dashboard. Be brief and practical.${memory?'\n\nContext about the user:\n'+memory:''}`;

  try {
    const res=await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body:JSON.stringify({
        model:'glm-4.5',max_tokens:1024,
        tools:[{type:'web_search',web_search:{enable:true,search_result:true}}],
        messages:[
          {role:'system',content:systemMsg},
          ...sess.messages.map(m=>({role:m.role,content:m.content}))
        ]
      })
    });
    const data=await res.json();
    thinking.remove();
    const reply=data.choices?.[0]?.message?.content||'Something went wrong. Check your API key.';
    const sources=data.web_search||[];
    appendMsg('assistant',reply,true,sources);
    sess.messages.push({role:'assistant',content:reply,sources});
    sess.updatedAt=Date.now();
    saveSessionsStore();
    if(sess.messages.length>0 && sess.messages.length%6===0) suggestMemory(false);
  } catch {
    thinking.remove();
    appendMsg('assistant','Network error. Check your connection.',true,[]);
  }
  document.getElementById('chat-send').disabled=false;
}

// ───── MEMORY ─────
let pendingMemory='';

async function suggestMemory(manual=false) {
  const sess=getSession(activeId);
  if(!sess||!apiKey||sess.messages.length<2) {
    if(manual) showMemoryToast('Not enough conversation to suggest memory yet.');
    return;
  }
  const recentMsgs=sess.messages.slice(-10).map(m=>`${m.role}: ${m.content}`).join('\n');
  try {
    const res=await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body:JSON.stringify({
        model:'glm-4.5',max_tokens:200,
        messages:[
          {role:'system',content:`You extract persistent facts worth remembering across chats. Given a conversation excerpt, output 1-3 bullet points of useful facts about the user, their work, clients, or preferences. Be very concise. If nothing new is worth saving, reply with exactly: NOTHING_NEW\n\nExisting memory:\n${memory||'(empty)'}`},
          {role:'user',content:`Conversation:\n${recentMsgs}`}
        ]
      })
    });
    const data=await res.json();
    const suggestion=data.choices?.[0]?.message?.content?.trim()||'';
    if(suggestion==='NOTHING_NEW'||!suggestion) {
      if(manual) showMemoryToast('No new facts worth saving from this conversation.');
      return;
    }
    pendingMemory=suggestion;
    showMemoryToast(suggestion);
  } catch {
    if(manual) showMemoryToast('Could not generate suggestion. Check your API key.');
  }
}

function showMemoryToast(text) {
  document.getElementById('memory-toast-body').textContent=text;
  document.getElementById('memory-toast-edit').value=text;
  document.getElementById('memory-toast-edit').style.display='none';
  document.getElementById('memory-toast-body').style.display='block';
  document.getElementById('mt-edit-btn').textContent='Edit';
  document.getElementById('memory-toast').classList.add('show');
}
function hideMemoryToast() { document.getElementById('memory-toast').classList.remove('show'); pendingMemory=''; }
function toggleMemoryEdit() {
  const edit=document.getElementById('memory-toast-edit');
  const body=document.getElementById('memory-toast-body');
  const btn=document.getElementById('mt-edit-btn');
  if(edit.style.display==='none') {
    edit.style.display='block'; body.style.display='none'; btn.textContent='Preview';
  } else {
    edit.style.display='none'; body.style.display='block';
    body.textContent=edit.value; btn.textContent='Edit';
    pendingMemory=edit.value;
  }
}
function acceptMemory() {
  const editEl=document.getElementById('memory-toast-edit');
  const finalText=editEl.style.display!=='none'?editEl.value:pendingMemory;
  if(finalText && finalText!=='NOTHING_NEW') {
    memory=(memory?memory+'\n':'')+finalText;
    saveMemoryStore();
  }
  hideMemoryToast();
}

// ───── MARKDOWN ─────
function renderMarkdown(text) {
  marked.setOptions({breaks:true,gfm:true});
  const raw=marked.parse(text);
  const clean=DOMPurify.sanitize(raw,{ADD_ATTR:['target','rel'],FORBID_TAGS:['script','style','iframe']});
  return clean.replace(/<a /g,'<a target="_blank" rel="noopener noreferrer" ');
}

function appendMsg(role,content,scroll=true,sources=[]) {
  document.getElementById('chat-empty')?.remove();
  const c=document.getElementById('chat-messages');
  const el=document.createElement('div');
  el.className=`chat-msg ${role}`;
  let bodyHtml;
  if(role==='assistant') {
    bodyHtml=`<div class="msg-md">${renderMarkdown(content)}</div>`;
    if(sources.length) {
      bodyHtml+=`<div class="chat-sources">
        <div class="chat-sources-label">Sources</div>
        ${sources.slice(0,4).map(s=>{
          const domain=(()=>{try{return new URL(s.link).hostname.replace('www.','');}catch{return s.media||'source';}})();
          return `<a class="chat-source" href="${escAttr(s.link)}" target="_blank" rel="noopener">
            <img class="chat-source-fav" src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt="">
            <div class="chat-source-text">
              <span class="chat-source-title">${esc(s.title||s.media||domain)}</span>
              <span class="chat-source-domain">${esc(domain)}</span>
            </div>
            <span class="chat-source-arrow">↗</span>
          </a>`;
        }).join('')}
      </div>`;
    }
  } else {
    bodyHtml=esc(content);
  }
  el.innerHTML=`<div class="msg-av">${role==='assistant'?'AI':'AN'}</div><div class="msg-bub">${bodyHtml}</div>`;
  c.appendChild(el);
  if(scroll) c.scrollTop=c.scrollHeight;
  return el;
}

function appendThinking() {
  const c=document.getElementById('chat-messages');
  const el=document.createElement('div');
  el.className='chat-msg assistant';
  el.innerHTML=`<div class="msg-av">AI</div><div class="msg-bub"><div class="spin"></div> <span style="font-size:11px;color:var(--text-muted);font-style:italic">Thinking…</span></div>`;
  c.appendChild(el);
  c.scrollTop=c.scrollHeight;
  return el;
}

function esc(t) {
  if(typeof t!=='string') return '';
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s) { return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// ───── FAVICON ─────
function getFaviconUrl(url, fav, sz=32) {
  const checkUrl = url || fav || '';
  if (/spreadsheets/.test(checkUrl)) return 'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico';
  const d = fav || (url ? domain(url) : null);
  if (!d) return null;
  if (FAVICON_OVERRIDES[d]) return FAVICON_OVERRIDES[d];
  return `https://www.google.com/s2/favicons?domain=${d}&sz=${sz}`;
}

function domain(url) { try{return new URL(url).hostname;}catch{return null;} }

// ───── LINKS DATA ─────
// Each link carries an optional `section` string. The sidebar renders sections
// in this order — anything else falls back to "Other".
const SECTION_ORDER = ['Workspace','Docs','Advertising','Analytics','AI','Inside','Other'];

function defaultLinks() {
  return [
    { type:'multi', name:'Gmail',    base:'https://mail.google.com/mail/u/{n}/#inbox',      fav:'mail.google.com',     section:'Workspace' },
    { type:'multi', name:'Calendar', base:'https://calendar.google.com/calendar/u/{n}/r',   fav:'calendar.google.com', section:'Workspace' },
    { type:'multi', name:'Drive',    base:'https://drive.google.com/drive/u/{n}/',          fav:'drive.google.com',    section:'Workspace' },
    { type:'multi', name:'Docs',     base:'https://docs.google.com/document/u/{n}/',        fav:'docs.google.com',     section:'Docs' },
    { type:'multi', name:'Sheets',   base:'https://docs.google.com/spreadsheets/u/{n}/',    fav:'docs.google.com',     section:'Docs' },
    { type:'link',  name:'Google Ads',       url:'https://ads.google.com',         section:'Advertising' },
    { type:'link',  name:'Meta Ads',         url:'https://business.facebook.com',  section:'Advertising' },
    { type:'link',  name:'Google Analytics', url:'https://analytics.google.com',   section:'Analytics' },
    { type:'link',  name:'Claude',  url:'https://claude.ai',         section:'AI' },
    { type:'link',  name:'ChatGPT', url:'https://chatgpt.com',       section:'AI' },
    { type:'link',  name:'Gemini',  url:'https://gemini.google.com', section:'AI' },
    { type:'link',  name:'Slack',         url:'https://slack.com',       section:'Inside' },
    { type:'link',  name:'tigertracks.ai', url:'https://tigertracks.ai', section:'Inside' },
  ];
}

// ───── SIDEBAR LINKS ─────
function renderSidebarLinks() {
  const list = getLinks();
  const container = document.getElementById('sb-scroll');
  // group by section
  const groups = {};
  list.forEach((l, idx) => {
    const sec = l.section || 'Other';
    (groups[sec] = groups[sec] || []).push({ l, idx });
  });
  const orderedSecs = SECTION_ORDER.filter(s => groups[s]);
  // include unknown sections at end
  Object.keys(groups).forEach(s => { if (!orderedSecs.includes(s)) orderedSecs.push(s); });

  container.innerHTML = orderedSecs.map(sec => {
    const rows = groups[sec].map(({l, idx}) =>
      l.type === 'multi' ? renderSidebarMulti(l, idx) : renderSidebarSingle(l)
    ).join('');
    return `<div class="sb-section">${esc(sec)}</div>${rows}`;
  }).join('');

  // bind multi-link toggles
  container.querySelectorAll('.sb-multi-head').forEach(head => {
    head.addEventListener('click', e => {
      e.preventDefault();
      const wrap = head.closest('.sb-multi');
      const idx = wrap.dataset.idx;
      if (openMultis.has(idx)) openMultis.delete(idx);
      else openMultis.add(idx);
      wrap.classList.toggle('open');
    });
  });
}

function renderSidebarSingle(l) {
  const favUrl = getFaviconUrl(l.url, null, 16);
  const fav = favUrl
    ? `<img class="sb-fav" src="${escAttr(favUrl)}" alt="" width="16" height="16">`
    : `<div class="sb-fav-ph">${esc((l.name[0]||'?').toUpperCase())}</div>`;
  return `<a class="sb-link" href="${escAttr(l.url)}" target="_blank" rel="noopener" data-tip="${escAttr(l.name)}">
    ${fav}<span class="sb-name">${esc(l.name)}</span>
  </a>`;
}

// ───── DOCK (quick-launch row above hero) ─────
function renderDock() {
  const list = getLinks();
  const dock = document.getElementById('dock');
  if (!dock) return;
  dock.innerHTML = list.map((l) => {
    if (l.type === 'multi') return renderDockMulti(l);
    return renderDockSingle(l);
  }).join('');
  bindDockPopovers(dock);
}

// The popover opens on hover (CSS) and is anchored under its icon by CSS
// (position:absolute on .dock-item) — no fixed-position-vs-:hover-transform race.
// On open we nudge it horizontally if the centered position would spill past the
// sidebar (left) or the viewport edge (right), so it's always fully visible and
// clickable. The arrow is repositioned to keep pointing at the icon.
function clampDockPopover(item) {
  const pop = item.querySelector('.dock-popover');
  if (!pop) return;
  // Reset to the CSS-centered position, then measure.
  pop.style.transform = '';
  pop.style.removeProperty('--arrow-left');
  const itemRect = item.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const sb = document.getElementById('left-sidebar');
  const sbRight = sb ? sb.getBoundingClientRect().right : 0;
  const minLeft = Math.max(8, sbRight + 8);
  const maxRight = window.innerWidth - 8;
  let shift = 0;
  if (popRect.left < minLeft) shift = minLeft - popRect.left;
  else if (popRect.right > maxRight) shift = maxRight - popRect.right;
  if (shift) {
    pop.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px)) translateY(0)`;
    const iconCenter = itemRect.left + itemRect.width / 2;
    let arrow = iconCenter - (popRect.left + shift);
    arrow = Math.max(14, Math.min(popRect.width - 14, arrow));
    pop.style.setProperty('--arrow-left', Math.round(arrow) + 'px');
  }
}

function bindDockPopovers(dock) {
  const closeAll = (except) => {
    dock.querySelectorAll('.dock-multi.open').forEach(o => { if (o !== except) o.classList.remove('open'); });
  };

  dock.querySelectorAll('.dock-multi').forEach(item => {
    // Hover opens via CSS; we just clamp the position so it stays on-screen.
    item.addEventListener('mouseenter', () => clampDockPopover(item));
    // The "+" badge is a click-to-pin toggle; clicking the icon still opens account 0.
    const badge = item.querySelector('.dock-multi-badge');
    if (badge) {
      badge.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !item.classList.contains('open');
        closeAll(item);
        item.classList.toggle('open', willOpen);
        if (willOpen) clampDockPopover(item);
      });
    }
    // Picking an account closes the strip; the link navigation proceeds.
    item.querySelectorAll('.dock-acct').forEach(chip => {
      chip.addEventListener('click', () => item.classList.remove('open'));
    });
  });

  // Click anywhere outside an open strip closes it. Bind once.
  if (!bindDockPopovers._docBound) {
    document.addEventListener('click', e => {
      if (!e.target.closest('.dock-multi')) {
        document.querySelectorAll('.dock-multi.open').forEach(o => o.classList.remove('open'));
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.dock-multi.open').forEach(o => o.classList.remove('open'));
    });
    bindDockPopovers._docBound = true;
  }
}

function renderDockSingle(l) {
  const favUrl = getFaviconUrl(l.url, null, 64);
  const favInner = favUrl
    ? `<img class="dock-fav" src="${escAttr(favUrl)}" alt="">`
    : `<div class="dock-fav-ph">${esc((l.name[0]||'?').toUpperCase())}</div>`;
  return `<div class="dock-item" title="${escAttr(l.name)}">
    <a class="dock-item-main" href="${escAttr(l.url)}" target="_blank" rel="noopener">
      <div class="dock-fav-wrap">${favInner}</div>
      <span class="dock-name">${esc(l.name)}</span>
    </a>
  </div>`;
}

function renderDockMulti(l) {
  const favUrl = getFaviconUrl(l.base, l.fav, 64);
  const favInner = favUrl
    ? `<img class="dock-fav" src="${escAttr(favUrl)}" alt="">`
    : `<div class="dock-fav-ph">${esc((l.name[0]||'?').toUpperCase())}</div>`;
  const chips = [0,1,2,3,4,5,6,7].map(n =>
    `<a class="dock-acct" href="${escAttr(l.base.replace('{n}',n))}" target="_blank" rel="noopener">${n}</a>`
  ).join('');
  return `<div class="dock-item dock-multi" data-name="${escAttr(l.name)}" title="${escAttr(l.name)} — click icon for default account">
    <a class="dock-item-main" href="${escAttr(l.base.replace('{n}',0))}" target="_blank" rel="noopener">
      <div class="dock-fav-wrap">${favInner}</div>
      <span class="dock-name">${esc(l.name)}</span>
    </a>
    <button class="dock-multi-badge" type="button" title="Switch account" aria-label="Switch ${escAttr(l.name)} account"></button>
    <span class="dock-popover">${chips}</span>
  </div>`;
}

function renderSidebarMulti(l, idx) {
  const favUrl = getFaviconUrl(l.base, l.fav, 16);
  const fav = favUrl
    ? `<img class="sb-fav" src="${escAttr(favUrl)}" alt="" width="16" height="16">`
    : `<div class="sb-fav-ph">${esc((l.name[0]||'?').toUpperCase())}</div>`;
  const accts = [0,1,2,3,4,5,6,7].map(n =>
    `<a class="sb-acct" href="${escAttr(l.base.replace('{n}',n))}" target="_blank" rel="noopener">${n}</a>`
  ).join('');
  const isOpen = openMultis.has(String(idx));
  return `<div class="sb-multi${isOpen?' open':''}" data-idx="${idx}" data-tip="${escAttr(l.name)}">
    <div class="sb-multi-head">
      ${fav}<span class="sb-name sb-multi-name">${esc(l.name)}</span>
      <span class="sb-multi-caret">▾</span>
    </div>
    <div class="sb-multi-accts" data-name="${escAttr(l.name)}">${accts}</div>
  </div>`;
}

// ───── LINK MANAGEMENT (settings → Links tab) ─────
let dragSrcIdx = null;

function renderLinkEditList() {
  const list = getLinks();
  const container = document.getElementById('link-edit-list');
  if (!list.length) {
    container.innerHTML = `<div style="font-size:11.5px;color:var(--text-muted);padding:10px;text-align:center">No links yet.</div>`;
    return;
  }
  container.innerHTML = list.map((l, i) => {
    const favUrl = getFaviconUrl(l.type==='multi'?l.base:l.url, l.fav, 16);
    const fav = favUrl
      ? `<img class="link-edit-fav" src="${escAttr(favUrl)}" alt="">`
      : `<div class="link-edit-fav" style="background:var(--teal)"></div>`;
    const kind = l.type === 'multi' ? 'Multi' : 'Link';
    return `<div class="link-edit-row" draggable="true" data-i="${i}">
      <span class="link-edit-handle" title="Drag to reorder">⋮⋮</span>
      ${fav}
      <span class="link-edit-name">${esc(l.name)}</span>
      <span class="link-edit-kind">${kind}</span>
      <button class="link-edit-del" data-i="${i}" title="Remove">×</button>
    </div>`;
  }).join('');

  container.querySelectorAll('.link-edit-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const ll = getLinks();
      ll.splice(Number(btn.dataset.i), 1);
      saveLinks(ll);
      renderLinkEditList();
      renderSidebarLinks();
      renderDock();
    });
  });

  // drag-and-drop to reorder
  container.querySelectorAll('.link-edit-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrcIdx = Number(row.dataset.i);
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // some browsers require data to be set for drag to work
      try { e.dataTransfer.setData('text/plain', String(dragSrcIdx)); } catch {}
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      container.querySelectorAll('.link-edit-row').forEach(r => {
        r.classList.remove('drag-over-top','drag-over-bot');
      });
      dragSrcIdx = null;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      row.classList.toggle('drag-over-top', before);
      row.classList.toggle('drag-over-bot', !before);
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-top','drag-over-bot');
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      const dstRowIdx = Number(row.dataset.i);
      const rect = row.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      row.classList.remove('drag-over-top','drag-over-bot');
      if (dragSrcIdx === null || dragSrcIdx === dstRowIdx) return;
      const ll = getLinks();
      const [moved] = ll.splice(dragSrcIdx, 1);
      // when removing earlier and inserting after, the destination index shifts left by 1
      let insertAt = dstRowIdx;
      if (dragSrcIdx < dstRowIdx) insertAt = dstRowIdx - 1;
      if (!before) insertAt += 1;
      insertAt = Math.max(0, Math.min(ll.length, insertAt));
      ll.splice(insertAt, 0, moved);
      saveLinks(ll);
      renderLinkEditList();
      renderSidebarLinks();
      renderDock();
    });
  });
}

function addLinkFromModal() {
  const input = document.getElementById('link-add-input');
  let url = input.value.trim();
  if(!url) return;
  if(!url.includes('://')) url='https://'+url;
  let name; try{name=new URL(url).hostname.replace('www.','');}catch{name=url;}
  const ll = getLinks();
  ll.push({ type:'link', name, url, section:'Other' });
  saveLinks(ll);
  input.value = '';
  renderLinkEditList();
  renderSidebarLinks();
  renderDock();
}

// ───── THEME ─────
function toggleTheme() {
  isDark=!isDark;
  applyTheme();
  saveSettingsStore();
}
function applyTheme() {
  document.documentElement.classList.toggle('lm',!isDark);
  document.getElementById('theme-btn').textContent=isDark?'☾':'☀';
  if(tzView==='map'&&mapReady) drawMap(new Date());
}

// ───── DENSITY ─────
function setDensity(d){
  density=d;
  applyDensity();
  saveSettingsStore();
}
function applyDensity(){
  document.body.classList.toggle('compact',density==='compact');
  document.querySelectorAll('#density-seg .seg-btn').forEach(b=>
    b.classList.toggle('on',b.dataset.density===density));
}

// ───── SETTINGS ─────
function openSettings(){
  document.getElementById('api-key-input').value=apiKey;
  document.getElementById('memory-edit-input').value=memory;
  applyDensity();
  renderLinkEditList();
  writePomoConfigToInputs();
  switchSettingsTab('api');
  document.getElementById('settings-modal').classList.add('open');
}
function closeSettings(){document.getElementById('settings-modal').classList.remove('open');}
function switchSettingsTab(tab){
  document.querySelectorAll('.modal-tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===tab));
  ['api','memory','links','timer','display'].forEach(t=>{
    document.getElementById('tab-'+t).style.display = t===tab ? 'block' : 'none';
  });
  if(tab==='links') renderLinkEditList();
  if(tab==='timer') writePomoConfigToInputs();
}
function saveSettings(){
  apiKey=document.getElementById('api-key-input').value.trim();
  memory=document.getElementById('memory-edit-input').value.trim();
  saveSettingsStore(); saveMemoryStore();
  closeSettings(); checkApiKey();
}

// ───── FOOTER ─────
function updateFooter(){
  const mins=Math.floor((Date.now()-sessionStart)/60000);
  document.getElementById('footer-uptime').textContent=
    mins<1?'session · just started':`session · ${mins}m`;
}

// ─────────────────────── POMODORO ───────────────────────
// State lives in localStorage so it survives tab close / new tab.
// Running state is encoded as an absolute `endsAt` timestamp — any tab opened
// later computes the true remaining time from wall-clock, not from when it loaded.
// The `storage` event keeps multiple open tabs in sync live.

const POMO_DEFAULTS = { focus: 25, short: 5, long: 15, every: 4, soundEnabled: true, chime: 'chime' };
const PHASE_LABEL  = { focus: 'Focus', short: 'Break', long: 'Long break' };
const PHASE_TITLE  = { focus: '🍅', short: '☕', long: '🌿' };

// When the extension's background service worker is present (real install),
// chrome.storage + chrome.alarms exist. It owns completion + badge + sound, so
// the page must NOT also auto-advance. In the local-server preview chrome is
// undefined → the page falls back to localStorage + its own ticking/advance.
const pomoSWMode = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local && chrome.alarms);

let pomoState = null;       // { mode, running, endsAt, remaining, focusCount, config }
let pomoLastRem = null;     // last computed remaining ms (for completion detection)
let pomoTickerId = null;
let pomoView = null;        // UI-only: which phase tab is being viewed (may differ from running mode)
let pomoConfirming = false; // UI-only: inline "stop running timer?" confirm is showing

const PHASE_DOT = { focus: '#229FA1', short: '#e8a020', long: '#8a78e8' };

async function pomoInit() {
  await pomoReloadFromStorage();
  // Fallback only: if a phase elapsed while no tab was open, advance silently.
  // In SW mode the service worker already handled completion before this loads.
  if (!pomoSWMode && pomoState.running && pomoLiveRemaining() <= 0) {
    pomoAdvancePhase(true);
  }
  pomoView = pomoState.mode;
  writePomoConfigToInputs();
  pomoRender();
  // Tick twice a second — smooth display (and completion detection in fallback).
  pomoTickerId = setInterval(pomoTick, 500);

  if (pomoSWMode) {
    // Live sync: the service worker (or another tab) writes state → reflect it.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[SK.pomo]) return;
      const nv = changes[SK.pomo].newValue;
      if (!nv || JSON.stringify(nv) === JSON.stringify(pomoState)) return; // ignore our own write
      const prevMode = pomoState.mode;
      pomoState = pomoNormalize(nv);
      pomoView = pomoState.mode;
      pomoConfirming = false;
      // A phase boundary while a tab is open → visual flash (sound is the SW's job).
      if (pomoState.mode !== prevMode) pomoFlashDone();
      pomoRender();
    });
  } else {
    // Fallback cross-tab sync via the storage event.
    window.addEventListener('storage', e => {
      if (e.key !== SK.pomo || !e.newValue) return;
      pomoState = pomoNormalize(JSON.parse(e.newValue));
      pomoView = pomoState.mode;
      pomoConfirming = false;
      pomoRender();
    });
  }
}

function pomoNormalize(raw) {
  let s = raw;
  if (!s) {
    s = { mode: 'focus', running: false, endsAt: 0,
          remaining: POMO_DEFAULTS.focus * 60000, focusCount: 0, config: { ...POMO_DEFAULTS } };
  }
  if (!s.config) s.config = { ...POMO_DEFAULTS };
  for (const k in POMO_DEFAULTS) if (s.config[k] == null) s.config[k] = POMO_DEFAULTS[k];
  return s;
}

async function pomoReloadFromStorage() {
  let raw = null;
  if (pomoSWMode) {
    try {
      const r = await chrome.storage.local.get(SK.pomo);
      raw = r[SK.pomo] || null;
    } catch {}
    if (!raw) {
      // One-time migration from any pre-existing localStorage state.
      try { raw = JSON.parse(localStorage.getItem(SK.pomo) || 'null'); } catch {}
      if (raw) { try { chrome.storage.local.set({ [SK.pomo]: raw }); } catch {} }
    }
  } else {
    try { raw = JSON.parse(localStorage.getItem(SK.pomo) || 'null'); } catch {}
  }
  pomoState = pomoNormalize(raw);
}

function pomoSave() {
  const json = JSON.stringify(pomoState);
  try { localStorage.setItem(SK.pomo, json); } catch {}
  // chrome.storage is the channel the service worker watches.
  if (pomoSWMode) { try { chrome.storage.local.set({ [SK.pomo]: pomoState }); } catch {} }
}

function pomoPhaseMs(mode) {
  const cfg = pomoState.config;
  const min = mode === 'focus' ? cfg.focus : mode === 'short' ? cfg.short : cfg.long;
  return min * 60000;
}

function pomoLiveRemaining() {
  if (pomoState.running) return Math.max(0, pomoState.endsAt - Date.now());
  return Math.max(0, pomoState.remaining);
}

function pomoStart() {
  if (pomoState.running) return;
  // Resume from `remaining`; default to full phase if reset/0.
  if (pomoState.remaining <= 0) pomoState.remaining = pomoPhaseMs(pomoState.mode);
  pomoState.endsAt = Date.now() + pomoState.remaining;
  pomoState.running = true;
  pomoSave();
  pomoRender();
}

function pomoPause() {
  if (!pomoState.running) return;
  pomoState.remaining = pomoLiveRemaining();
  pomoState.running = false;
  pomoState.endsAt = 0;
  pomoSave();
  pomoRender();
}

function pomoToggle() {
  const view = pomoView || pomoState.mode;
  // Previewing a different phase while one runs → confirm before stopping it.
  if (pomoState.running && view !== pomoState.mode) {
    pomoConfirming = true;
    pomoRender();
    return;
  }
  pomoState.running ? pomoPause() : pomoStart();
}

function pomoReset() {
  pomoState.running = false;
  pomoState.endsAt = 0;
  pomoState.remaining = pomoPhaseMs(pomoState.mode);
  pomoSave();
  pomoRender();
}

// Clicking a phase tab. While a timer runs this is a non-destructive PREVIEW —
// it never stops or resets the running timer. While idle it commits immediately.
function pomoSelectTab(mode) {
  if (!['focus','short','long'].includes(mode)) return;
  pomoConfirming = false;
  if (pomoState.running) {
    pomoView = mode;            // preview only; running timer is untouched
    pomoRender();
  } else {
    pomoState.mode = mode;
    pomoState.endsAt = 0;
    pomoState.remaining = pomoPhaseMs(mode);
    pomoView = mode;
    pomoSave();
    pomoRender();
  }
}

// User pressed "Stop & switch" in the confirm prompt.
function pomoConfirmOk() {
  pomoConfirming = false;
  pomoState.mode = pomoView;
  pomoState.running = false;    // clear the old phase first so pomoStart() re-arms cleanly
  pomoState.endsAt = 0;
  pomoState.remaining = pomoPhaseMs(pomoState.mode);
  pomoSave();
  pomoStart();                  // immediately start the newly chosen phase
}

// User chose to keep the running timer — return the view to it.
function pomoConfirmCancel() {
  pomoConfirming = false;
  pomoView = pomoState.mode;
  pomoRender();
}

function pomoAdvancePhase(silent) {
  // Auto-advance: focus → short (or long every Nth) → focus
  if (pomoState.mode === 'focus') {
    pomoState.focusCount = (pomoState.focusCount || 0) + 1;
    const every = pomoState.config.every || POMO_DEFAULTS.every;
    pomoState.mode = (pomoState.focusCount % every === 0) ? 'long' : 'short';
  } else {
    pomoState.mode = 'focus';
  }
  pomoState.running = false;
  pomoState.endsAt = 0;
  pomoState.remaining = pomoPhaseMs(pomoState.mode);
  pomoView = pomoState.mode;   // snap the view to the freshly advanced phase
  pomoConfirming = false;
  pomoSave();
  if (!silent) {
    pomoChime();
    pomoFlashDone();
  }
}

function pomoTick() {
  if (!pomoState) return;
  const rem = pomoLiveRemaining();
  // Completion: in SW mode the service worker is the authority (it advances,
  // notifies, chimes, badges), so the page only renders and waits for the
  // storage update. In fallback mode the page advances itself.
  if (!pomoSWMode && pomoState.running && rem <= 0 && (pomoLastRem == null || pomoLastRem > 0)) {
    pomoAdvancePhase(false);
    pomoLastRem = 0;
    pomoRender();
    return;
  }
  pomoLastRem = rem;
  pomoRender();
}

const POMO_RING_C = 2 * Math.PI * 54; // circumference of r=54 ring ≈ 339.292

function pomoFmt(ms) {
  const mm = Math.floor(ms / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  return `${pad(mm)}:${pad(ss)}`;
}

function pomoRender() {
  const view = pomoView || pomoState.mode;
  const realRem = pomoLiveRemaining();            // true remaining of the committed timer
  // Previewing a phase that isn't the one currently running.
  const isPreview = pomoState.running && view !== pomoState.mode;

  // What the ring + time display: the previewed phase (static, full) or the live timer.
  const total = pomoPhaseMs(view);
  const rem = isPreview ? total : realRem;
  document.getElementById('pomo-time').textContent = pomoFmt(rem);

  // Ring depletes as time runs out; full when previewing.
  const frac = total > 0 ? Math.max(0, Math.min(1, rem / total)) : 0;
  const fg = document.getElementById('pomo-ring-fg');
  if (fg) fg.style.strokeDashoffset = (POMO_RING_C * (1 - frac)).toFixed(2);

  // State caption.
  const stateEl = document.getElementById('pomo-state');
  if (isPreview)              stateEl.textContent = 'Preview';
  else if (pomoState.running) stateEl.textContent = PHASE_LABEL[pomoState.mode];
  else if (rem <= 0)          stateEl.textContent = 'Done';
  else if (rem < total)       stateEl.textContent = 'Paused';
  else                        stateEl.textContent = PHASE_LABEL[pomoState.mode];

  // Card accent follows the VIEWED phase so a previewed break shows its own color.
  document.getElementById('pomo-card').className =
    `pomo-card card m-${view}${pomoState.running ? ' running' : ''}`;

  // Mode segment: active = viewed; running dot = committed running phase.
  document.querySelectorAll('#pomo-mode-seg .seg-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.mode === view);
    const running = pomoState.running && b.dataset.mode === pomoState.mode;
    b.classList.toggle('is-running', running);
    b.style.setProperty('--run-dot', PHASE_DOT[pomoState.mode] || 'var(--teal)');
  });

  // Controls / confirm / running-note swapping.
  const controls = document.getElementById('pomo-controls');
  const confirm  = document.getElementById('pomo-confirm');
  const note     = document.getElementById('pomo-running-note');
  const tg       = document.getElementById('pomo-toggle');
  const reset    = document.getElementById('pomo-reset');

  // .pomo-controls defaults to display:flex; only force-hide while confirming.
  controls.style.display = pomoConfirming ? 'none' : 'flex';
  confirm.classList.toggle('show', pomoConfirming);

  if (pomoConfirming) {
    document.getElementById('pomo-confirm-text').innerHTML =
      `A <b>${PHASE_LABEL[pomoState.mode]}</b> timer is still running.<br>Stop it and start <b>${PHASE_LABEL[view]}</b>?`;
  } else if (isPreview) {
    tg.textContent = `Start ${PHASE_LABEL[view]}`;
    reset.style.display = 'none';
  } else {
    tg.textContent = pomoState.running ? 'Pause' : (rem > 0 && rem < total ? 'Resume' : 'Start');
    reset.style.display = '';
  }

  // "Still running" note appears only while previewing another phase.
  if (isPreview && !pomoConfirming) {
    note.classList.add('show');
    note.className = `pomo-running-note show rm-${pomoState.mode}`;
    document.getElementById('pomo-running-note-text').textContent =
      `${PHASE_LABEL[pomoState.mode]} ${pomoFmt(realRem)} running`;
  } else {
    note.classList.remove('show');
  }

  renderPomoSessions();

  // Tab title always reflects the actual committed timer, even while previewing.
  if (pomoState.running) {
    document.title = `${pomoFmt(realRem)} ${PHASE_TITLE[pomoState.mode]} · TigerTracks`;
  } else if (realRem < pomoPhaseMs(pomoState.mode)) {
    document.title = `${pomoFmt(realRem)} (paused) · TigerTracks`;
  } else {
    document.title = 'TigerTracks';
  }
}

function renderPomoSessions() {
  const wrap = document.getElementById('pomo-sessions');
  if (!wrap) return;
  const every = pomoState.config.every || POMO_DEFAULTS.every;
  // Dots filled = focus sessions done in the current cycle. A long break shows
  // a full set (the cycle just completed); otherwise show focusCount mod every.
  let filled = (pomoState.focusCount || 0) % every;
  if (pomoState.mode === 'long') filled = every;
  let dots = '';
  for (let i = 0; i < every; i++) dots += `<span class="pomo-sess-dot${i < filled ? ' on' : ''}"></span>`;
  wrap.innerHTML = `${dots}<span class="pomo-sess-label">${pomoState.focusCount || 0} done</span>`;
}

function pomoFlashDone() {
  const el = document.getElementById('pomo-card');
  el.classList.add('done');
  setTimeout(() => el.classList.remove('done'), 1300);
}

function pomoChime() {
  // Fallback-mode chime (no service worker). In SW mode the worker plays it via
  // the offscreen document instead, so we don't double up.
  if (pomoState?.config?.soundEnabled === false) return;
  if (typeof ttPlayChime === 'function') ttPlayChime(pomoState?.config?.chime || 'chime');
}

function writePomoConfigToInputs() {
  if (!pomoState) return;
  ['focus','short','long','every'].forEach(k => {
    const el = document.getElementById('pomo-cfg-' + k);
    if (el) el.value = pomoState.config[k];
  });
  // Sound controls
  const soundOn = pomoState.config.soundEnabled !== false;
  document.querySelectorAll('#pomo-sound-seg .seg-btn').forEach(b =>
    b.classList.toggle('on', (b.dataset.sound === 'on') === soundOn));
  const sel = document.getElementById('pomo-chime-select');
  if (sel) sel.value = pomoState.config.chime || 'chime';
  const row = document.getElementById('pomo-chime-row');
  if (row) row.classList.toggle('off', !soundOn);
}

function readPomoConfigFromInputs() {
  const next = { ...pomoState.config };
  ['focus','short','long','every'].forEach(k => {
    const v = parseInt(document.getElementById('pomo-cfg-' + k).value, 10);
    if (Number.isFinite(v) && v > 0) next[k] = v;
  });
  pomoState.config = next;
  // If not currently running, reflect the new duration immediately.
  if (!pomoState.running) {
    pomoState.remaining = pomoPhaseMs(pomoState.mode);
  }
  pomoSave();
  pomoRender();
}

function setPomoSound(enabled) {
  pomoState.config = { ...pomoState.config, soundEnabled: enabled };
  document.querySelectorAll('#pomo-sound-seg .seg-btn').forEach(b =>
    b.classList.toggle('on', (b.dataset.sound === 'on') === enabled));
  document.getElementById('pomo-chime-row')?.classList.toggle('off', !enabled);
  pomoSave();
}

function setPomoChime(name) {
  pomoState.config = { ...pomoState.config, chime: name };
  pomoSave();
}

document.addEventListener('DOMContentLoaded',init);
