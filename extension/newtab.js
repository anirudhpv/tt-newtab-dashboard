// ── CONSTANTS ──
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
  3:{d:'Overcast',e:'☁️'},45:{d:'Foggy',e:'🌫️'},48:{d:'Rime fog',e:'🌫️'},
  51:{d:'Light drizzle',e:'🌦️'},53:{d:'Drizzle',e:'🌦️'},55:{d:'Heavy drizzle',e:'🌧️'},
  61:{d:'Slight rain',e:'🌧️'},63:{d:'Rain',e:'🌧️'},65:{d:'Heavy rain',e:'🌧️'},
  71:{d:'Light snow',e:'❄️'},73:{d:'Snow',e:'❄️'},75:{d:'Heavy snow',e:'❄️'},
  80:{d:'Showers',e:'🌦️'},81:{d:'Showers',e:'🌧️'},82:{d:'Heavy showers',e:'🌧️'},
  95:{d:'Thunderstorm',e:'⛈️'},96:{d:'Thunderstorm',e:'⛈️'},99:{d:'Thunderstorm',e:'⛈️'},
};

// Correct favicons for Google products that S2 gets wrong
const FAVICON_OVERRIDES = {
  'docs.google.com':     'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  'drive.google.com':    'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
  'calendar.google.com': 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico',
};

// ── STATE ──
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

// Sidebar / panel visibility
let sbVisible   = true;   // sidebar shown or hidden
let sbExpanded  = true;   // sidebar expanded (true) or icon-rail (false)
let rpVisible   = true;   // right panel visible

// Chat sessions
let sessions    = [];
let activeId    = null;

const SK = {
  settings: 'tt_settings',
  sessions: 'tt_sessions',
  memory:   'tt_memory',
  sidebar:  'tt_sidebar',
};

// ── INIT ──
function init() {
  loadStorage();
  renderTZGrid();
  tick();
  setInterval(tick, 1000);
  fetchWeather();
  renderLinks();
  renderSidebarLinks();
  renderSessions();
  loadActiveSession();
  checkApiKey();
  updateFooter();
  setInterval(updateFooter, 60000);
  bindEvents();
}

function bindEvents() {
  // Density
  document.getElementById('density-toggle').querySelectorAll('.pill-btn').forEach(b =>
    b.addEventListener('click', () => setDensity(b.dataset.density)));
  // Theme
  document.getElementById('theme-btn').addEventListener('click', toggleTheme);
  // Settings
  document.getElementById('settings-open-btn').addEventListener('click', openSettings);
  document.getElementById('settings-cancel').addEventListener('click', closeSettings);
  document.getElementById('settings-save').addEventListener('click', saveSettings);
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('settings-modal')) closeSettings();
  });
  // Settings tabs
  document.querySelectorAll('.modal-tab').forEach(t =>
    t.addEventListener('click', () => switchSettingsTab(t.dataset.tab)));
  // Weather unit
  document.getElementById('wx-f-btn').addEventListener('click', () => setWxUnit('F'));
  document.getElementById('wx-c-btn').addEventListener('click', () => setWxUnit('C'));
  document.getElementById('weather-content').addEventListener('click', e => {
    if (e.target.classList.contains('wx-retry')) fetchWeather();
  });
  // TZ toggle
  document.getElementById('tz-btn-grid').addEventListener('click', () => setTZView('grid'));
  document.getElementById('tz-btn-map').addEventListener('click',  () => setTZView('map'));
  // Chat input
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  document.getElementById('chat-send').addEventListener('click', sendChat);
  document.getElementById('api-key-link').addEventListener('click', openSettings);
  // Chat session controls
  document.getElementById('sessions-btn').addEventListener('click', openDrawer);
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('new-chat-btn').addEventListener('click', newSession);
  document.getElementById('drawer-new-btn').addEventListener('click', () => { newSession(); closeDrawer(); });
  document.getElementById('drawer-search').addEventListener('input', renderSessions);
  document.getElementById('memory-suggest-btn').addEventListener('click', () => suggestMemory(true));
  // Links
  document.getElementById('link-input').addEventListener('keydown', e => { if (e.key==='Enter') addLink(); });
  document.getElementById('add-link-btn').addEventListener('click', addLink);
  // Memory toast
  document.getElementById('mt-accept').addEventListener('click', acceptMemory);
  document.getElementById('mt-reject').addEventListener('click', () => hideMemoryToast());
  document.getElementById('mt-edit-btn').addEventListener('click', toggleMemoryEdit);
  // Sidebar toggle buttons
  document.getElementById('sb-toggle-btn').addEventListener('click', toggleSidebar);
  document.getElementById('sb-rail-btn').addEventListener('click', toggleSidebarExpand);
  // Right panel toggle
  document.getElementById('right-panel-btn').addEventListener('click', toggleRightPanel);
}

// ── STORAGE ──
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
    rpVisible  = sb.rpVisible  !== false;
  } catch {}
  applyTheme(); applyDensity(); applyWxUnit(); applySidebarState(); applyRightPanel();
  if (!sessions.length) newSession(false);
  else activeId = sessions[0].id;
}

function saveSettings_storage() {
  localStorage.setItem(SK.settings, JSON.stringify({ apiKey, isDark, density, wxUnit }));
}
function saveSessions() { localStorage.setItem(SK.sessions, JSON.stringify(sessions)); }
function saveMemory()   { localStorage.setItem(SK.memory, memory); }
function saveSidebarState() {
  localStorage.setItem(SK.sidebar, JSON.stringify({ sbVisible, sbExpanded, rpVisible }));
}
function links_get() {
  try { return JSON.parse(localStorage.getItem('tt_links') || 'null') || defaultLinks(); } catch { return defaultLinks(); }
}
function links_save(l) { localStorage.setItem('tt_links', JSON.stringify(l)); }

// ── SIDEBAR ──
function applySidebarState() {
  const sb = document.getElementById('left-sidebar');
  const btn = document.getElementById('sb-toggle-btn');
  const railBtn = document.getElementById('sb-rail-btn');
  sb.classList.toggle('hidden', !sbVisible);
  sb.classList.toggle('rail', !sbExpanded);
  railBtn.textContent = sbExpanded ? '⊟' : '⊞';
  btn.classList.toggle('active-btn', sbVisible);
}

function toggleSidebar() {
  sbVisible = !sbVisible;
  applySidebarState();
  saveSidebarState();
}

function toggleSidebarExpand() {
  sbExpanded = !sbExpanded;
  applySidebarState();
  saveSidebarState();
}

function applyRightPanel() {
  const grid = document.getElementById('main-grid');
  const btn  = document.getElementById('right-panel-btn');
  grid.classList.toggle('with-right', rpVisible);
  btn.textContent = rpVisible ? '⊟' : '⊞';
  btn.title = rpVisible ? 'Hide links panel' : 'Show links panel';
}

function toggleRightPanel() {
  rpVisible = !rpVisible;
  applyRightPanel();
  saveSidebarState();
}

// ── CLOCK ──
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function tick() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  document.getElementById('hh').textContent = pad(h);
  document.getElementById('mm').textContent = pad(m);
  document.getElementById('ss').textContent = pad(s);
  document.getElementById('hero-date').textContent =
    `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('hero-tz').textContent = tz.replace(/_/g,' ');
  const greet = h<12 ? 'Good morning,' : h<17 ? 'Good afternoon,' : 'Good evening,';
  document.getElementById('hero-greeting').innerHTML = `${greet}<br><span>Anirudh</span>`;
  document.getElementById('footer-date').textContent =
    now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  updateTZGrid(now);
  if (tzView==='map' && mapReady) drawMap(now);
}
function pad(n) { return String(n).padStart(2,'0'); }

// ── DAY/NIGHT ──
function dayNightIcon(h) {
  if (h>=6  && h<8)  return { icon:'🌅', cls:'is-dawn' };
  if (h>=8  && h<20) return { icon:'☀️',  cls:'' };
  return                    { icon:'🌙', cls:'is-night' };
}

// ── TZ GRID ──
function renderTZGrid() {
  const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('tz-grid-view').innerHTML = TIMEZONES.map((tz,i) => `
    <div class="tz-item${localTZ===tz.tz?' local-tz':''}" id="tz-${i}">
      <span class="tz-icon" id="tz-icon-${i}">☀️</span>
      <span class="tz-label-text">${tz.label}</span>
      <span class="tz-time-val" id="tz-time-${i}">--:--</span>
      <span class="tz-ampm" id="tz-ampm-${i}">--</span>
      <span class="tz-off" id="tz-off-${i}"></span>
      <span class="tz-daybadge" id="tz-day-${i}">+1</span>
    </div>`).join('');
}

function updateTZGrid(now) {
  const localOff = -now.getTimezoneOffset();
  const localDay = now.getDate();
  const localTZ  = Intl.DateTimeFormat().resolvedOptions().timeZone;
  TIMEZONES.forEach((tz,i) => {
    const tzDate = new Date(now.toLocaleString('en-US',{timeZone:tz.tz}));
    const h=tzDate.getHours(), m=pad(tzDate.getMinutes());
    const ampm=h>=12?'PM':'AM', h12=h%12||12;
    const {icon,cls} = dayNightIcon(h);
    document.getElementById(`tz-time-${i}`).textContent=`${h12}:${m}`;
    document.getElementById(`tz-ampm-${i}`).textContent=ampm;
    document.getElementById(`tz-icon-${i}`).textContent=icon;
    const tzOff=-tzDate.getTimezoneOffset(), diffH=(tzOff-localOff)/60;
    const sign=diffH>=0?'+':'';
    document.getElementById(`tz-off-${i}`).textContent=
      diffH===0?'local':`${sign}${diffH%1===0?diffH:diffH.toFixed(1)}h`;
    const tzDay=tzDate.getDate();
    const badge=document.getElementById(`tz-day-${i}`);
    if(tzDay>localDay){badge.textContent='+1';badge.classList.add('on');}
    else if(tzDay<localDay){badge.textContent='-1';badge.classList.add('on');}
    else badge.classList.remove('on');
    document.getElementById(`tz-${i}`).className=
      `tz-item${localTZ===tz.tz?' local-tz':''}${cls?' '+cls:''}`;
  });
}

// ── TZ VIEW TOGGLE ──
function setTZView(v) {
  tzView=v;
  document.getElementById('tz-grid-view').style.display=v==='grid'?'grid':'none';
  document.getElementById('tz-map-view').style.display=v==='map'?'block':'none';
  document.getElementById('tz-btn-grid').classList.toggle('active',v==='grid');
  document.getElementById('tz-btn-map').classList.toggle('active',v==='map');
  if(v==='map') initMap();
}

// ── MAP ──
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
  ctx.fillStyle=isDk?'#0a1520':'#c0d8ec';
  ctx.fillRect(0,0,MAP_W,MAP_H);
  const utcH=now.getUTCHours()+now.getUTCMinutes()/60;
  const sunLon=180-(utcH/24)*360;
  const sunX=lonToX(sunLon);
  const nightCol=isDk?'rgba(0,0,20,0.45)':'rgba(20,30,80,0.2)';
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
  ctx.fillStyle=isDk?'#1e3448':'#c8ddb0';
  ctx.strokeStyle=isDk?'#2a4a60':'#a8c090';
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
  const tzDate=new Date(now.toLocaleString('en-US',{timeZone:tz.tz}));
  const h=tzDate.getHours(),m=pad(tzDate.getMinutes());
  const ampm=h>=12?'PM':'AM',h12=h%12||12;
  const{icon}=dayNightIcon(h);
  const tzOff=-tzDate.getTimezoneOffset(),localOff=-now.getTimezoneOffset();
  const diffH=(tzOff-localOff)/60, sign=diffH>=0?'+':'';
  const offStr=diffH===0?'local time':`${sign}${diffH%1===0?diffH:diffH.toFixed(1)}h from you`;
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

// ── WEATHER ──
async function fetchWeather() {
  const el=document.getElementById('weather-content');
  el.innerHTML=`<div class="wx-loading"><div class="spin"></div><span>Detecting location…</span></div>`;
  navigator.geolocation.getCurrentPosition(
    async pos=>{
      const{latitude:lat,longitude:lon}=pos.coords;
      try {
        const[wxRes,geoRes]=await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&hourly=temperature_2m,weather_code,precipitation_probability&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto&forecast_days=2`),
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
        ]);
        const wx=await wxRes.json(), geo=await geoRes.json();
        wxData={
          tempF:    wx.current.temperature_2m,
          feelsF:   wx.current.apparent_temperature,
          humidity: wx.current.relative_humidity_2m,
          wind:     wx.current.wind_speed_10m,
          precip:   wx.current.precipitation,
          code:     wx.current.weather_code,
          city:     geo.address?.city||geo.address?.town||geo.address?.village||geo.address?.county||'Your location',
          state:    geo.address?.state_code||geo.address?.country_code?.toUpperCase()||'',
        };
        // Store hourly data
        wxHourly = {
          times:  wx.hourly.time,
          temps:  wx.hourly.temperature_2m,
          codes:  wx.hourly.weather_code,
          precip: wx.hourly.precipitation_probability,
          currentTime: wx.current_weather?.time || wx.current.time,
        };
        renderWeather();
      } catch {
        el.innerHTML=`<div class="wx-error">Couldn't load weather.<br><span class="wx-link wx-retry">Retry</span></div>`;
      }
    },
    ()=>{el.innerHTML=`<div class="wx-error">Location access denied.<br><span class="wx-link wx-retry">Retry</span></div>`;}
  );
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
    <div class="wx-main">
      <div class="wx-icon">${wmo.e}</div>
      <div>
        <div class="wx-temp">${displayTemp(wxData.tempF)}<span class="wx-unit-sym">${unitSym()}</span></div>
        <div class="wx-desc">${wmo.d}</div>
        <div class="wx-loc">📍 ${esc(wxData.city)}${wxData.state?', '+wxData.state:''}</div>
      </div>
    </div>
    <div class="wx-grid">
      <div><span class="wx-stat-label">Feels Like</span><div class="wx-stat-val">${displayTemp(wxData.feelsF)}${unitSym()}</div></div>
      <div><span class="wx-stat-label">Humidity</span><div class="wx-stat-val">${wxData.humidity}%</div></div>
      <div><span class="wx-stat-label">Wind</span><div class="wx-stat-val">${Math.round(wxData.wind)} mph</div></div>
      <div><span class="wx-stat-label">Precip</span><div class="wx-stat-val">${wxData.precip} mm</div></div>
    </div>
    ${renderHourlyStrip()}
    <div style="text-align:right;margin-top:8px">
      <span class="wx-link wx-retry" style="font-size:9.5px">↻ Refresh</span>
    </div>`;
}

function renderHourlyStrip() {
  if(!wxHourly || !wxHourly.times) return '';
  const now = new Date();
  const currentHour = now.getHours();
  const currentDate = now.toISOString().slice(0,10);

  // Find the index of the current hour in the hourly data
  let startIdx = wxHourly.times.findIndex(t => {
    const d = new Date(t);
    return d >= now;
  });
  if(startIdx < 0) startIdx = 0;

  const hours = [];
  for(let i=startIdx; i<Math.min(startIdx+12, wxHourly.times.length); i++) {
    const t = new Date(wxHourly.times[i]);
    const h = t.getHours();
    const ampm = h>=12 ? 'PM' : 'AM';
    const h12  = h%12||12;
    const wmo  = WMO[wxHourly.codes[i]]||{e:'🌡️'};
    const precip = wxHourly.precip[i] ?? 0;
    const isCurrent = i===startIdx;
    hours.push(`<div class="wx-hour${isCurrent?' current-hour':''}">
      <div class="wx-hour-time">${h12}${ampm}</div>
      <div class="wx-hour-icon">${wmo.e}</div>
      <div class="wx-hour-temp">${displayTemp(wxHourly.temps[i])}°</div>
      <div class="wx-hour-precip">${precip}%</div>
    </div>`);
  }

  return `<div class="wx-hourly">
    <div class="wx-hourly-label">Next 12 Hours</div>
    <div class="wx-hourly-scroll">${hours.join('')}</div>
  </div>`;
}

function setWxUnit(u) {
  wxUnit=u;
  saveSettings_storage();
  applyWxUnit();
  if(wxData) renderWeather();
}
function applyWxUnit() {
  document.getElementById('wx-f-btn').classList.toggle('active',wxUnit==='F');
  document.getElementById('wx-c-btn').classList.toggle('active',wxUnit==='C');
}

// ── SESSIONS ──
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

function newSession(switchTo=true) {
  const sess = { id:genId(), label:'New Chat', messages:[], createdAt:Date.now(), updatedAt:Date.now() };
  sessions.unshift(sess);
  saveSessions();
  if(switchTo) { activeId=sess.id; loadActiveSession(); renderSessions(); }
  return sess;
}

function getSession(id) { return sessions.find(s=>s.id===id); }

function loadActiveSession() {
  const sess=getSession(activeId)||sessions[0];
  if(!sess) return;
  activeId=sess.id;
  document.getElementById('chat-session-label').textContent=sess.label;
  const c=document.getElementById('chat-messages');
  c.innerHTML='';
  if(!sess.messages.length) {
    c.innerHTML=`<div class="chat-empty" id="chat-empty">Ask anything — strategy, copy, analysis, research.</div>`;
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
  saveSessions(); renderSessions();
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
    <div class="session-item${s.id===activeId?' active':''}" data-id="${s.id}">
      <button class="session-item-del" data-del="${s.id}">×</button>
      <div class="session-item-label">${esc(s.label)}</div>
      <div class="session-item-meta">${new Date(s.updatedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
    </div>`).join('');
  container.querySelectorAll('.session-item').forEach(el=>{
    el.addEventListener('click',()=>switchSession(el.dataset.id));
  });
  container.querySelectorAll('.session-item-del').forEach(btn=>{
    btn.addEventListener('click',e=>deleteSession(btn.dataset.del,e));
  });
}

async function autoLabelSession(sess, firstMsg) {
  if(!apiKey) { sess.label=firstMsg.slice(0,40)+(firstMsg.length>40?'…':''); saveSessions(); renderSessions(); return; }
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
    saveSessions(); renderSessions();
    document.getElementById('chat-session-label').textContent=sess.label;
  } catch { sess.label=firstMsg.slice(0,40); saveSessions(); renderSessions(); }
}

// ── DRAWER ──
function openDrawer() { document.getElementById('chat-drawer').classList.add('open'); renderSessions(); }
function closeDrawer() { document.getElementById('chat-drawer').classList.remove('open'); }

// ── CHAT ──
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
  saveSessions();

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
    saveSessions();
    if(sess.messages.length>0 && sess.messages.length%6===0) suggestMemory(false);
  } catch {
    thinking.remove();
    appendMsg('assistant','Network error. Check your connection.',true,[]);
  }
  document.getElementById('chat-send').disabled=false;
}

// ── MEMORY ──
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
    saveMemory();
  }
  hideMemoryToast();
}

// ── MARKDOWN ──
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
          return `<a class="chat-source-card" href="${escAttr(s.link)}" target="_blank" rel="noopener">
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
function escAttr(s) { return s.replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// ── FAVICON HELPERS ──
function getFaviconUrl(url, fav) {
  // For multi-links, check base URL patterns first
  const checkUrl = url || fav || '';
  if (/spreadsheets/.test(checkUrl)) return 'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico';
  const d = fav || (url ? domain(url) : null);
  if (!d) return null;
  if (FAVICON_OVERRIDES[d]) return FAVICON_OVERRIDES[d];
  return `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
}

// ── LINKS ──
function defaultLinks() {
  return [
    { type:'multi', name:'Gmail',    base:'https://mail.google.com/mail/u/{n}/#inbox',      fav:'mail.google.com' },
    { type:'multi', name:'Sheets',   base:'https://docs.google.com/spreadsheets/u/{n}/',    fav:'docs.google.com' },
    { type:'multi', name:'Docs',     base:'https://docs.google.com/document/u/{n}/',        fav:'docs.google.com' },
    { type:'multi', name:'Drive',    base:'https://drive.google.com/drive/u/{n}/',          fav:'drive.google.com' },
    { type:'multi', name:'Calendar', base:'https://calendar.google.com/calendar/u/{n}/r',   fav:'calendar.google.com' },
    { type:'link',  name:'Google Ads',       url:'https://ads.google.com'          },
    { type:'link',  name:'Meta Ads',         url:'https://business.facebook.com'   },
    { type:'link',  name:'Google Analytics', url:'https://analytics.google.com'    },
    { type:'link',  name:'Slack',            url:'https://slack.com'               },
    { type:'link',  name:'Claude',           url:'https://claude.ai'               },
    { type:'link',  name:'ChatGPT',          url:'https://chatgpt.com'             },
    { type:'link',  name:'Gemini',           url:'https://gemini.google.com'       },
    { type:'link',  name:'tigertracks.ai',   url:'https://tigertracks.ai'          },
  ];
}

function renderLinks() {
  const list=links_get();
  const grid=document.getElementById('links-grid');
  grid.innerHTML=list.map((l,i)=>{
    if(l.type==='multi') return renderMultiLink(l,i);
    return renderSingleLink(l,i);
  }).join('');
  grid.querySelectorAll('.link-del').forEach(b=>b.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    const ll=links_get(); ll.splice(Number(b.dataset.i),1); links_save(ll); renderLinks(); renderSidebarLinks();
  }));
  grid.querySelectorAll('.multi-link-del').forEach(b=>b.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    const ll=links_get(); ll.splice(Number(b.dataset.i),1); links_save(ll); renderLinks(); renderSidebarLinks();
  }));
}

function renderSingleLink(l,i) {
  const favUrl=getFaviconUrl(l.url, null);
  const fav=favUrl
    ? `<img class="link-fav" src="${escAttr(favUrl)}" alt="">`
    : `<div class="link-fav-ph">${esc(l.name[0].toUpperCase())}</div>`;
  return `<a class="link-item" href="${escAttr(l.url)}" target="_blank" rel="noopener">
    ${fav}<span class="link-name">${esc(l.name)}</span>
    <button class="link-del" data-i="${i}">×</button>
  </a>`;
}

function renderMultiLink(l,i) {
  const favUrl=getFaviconUrl(l.base, l.fav);
  const accts=[0,1,2,3,4,5,6,7].map(n=>
    `<a class="acct-btn" href="${escAttr(l.base.replace('{n}',n))}" target="_blank" rel="noopener">${n}</a>`
  ).join('');
  return `<div class="multi-link">
    <div class="multi-link-icon">
      <img class="link-fav" src="${escAttr(favUrl)}" alt="">
      <span class="multi-link-label">${esc(l.name)}</span>
    </div>
    <div class="multi-link-divider"></div>
    <div class="multi-link-accounts">${accts}</div>
    <button class="multi-link-del" data-i="${i}">×</button>
  </div>`;
}

// ── SIDEBAR LINKS ──
function renderSidebarLinks() {
  const list = links_get();
  const container = document.getElementById('sb-links');
  container.innerHTML = list.map(l => {
    if (l.type === 'multi') return renderSidebarMultiLink(l);
    return renderSidebarSingleLink(l);
  }).join('');
}

function renderSidebarSingleLink(l) {
  const favUrl = getFaviconUrl(l.url, null);
  const fav = favUrl
    ? `<img class="sb-fav" src="${escAttr(favUrl)}" alt="">`
    : `<div class="sb-fav-ph">${esc(l.name[0].toUpperCase())}</div>`;
  return `<a class="sb-link" href="${escAttr(l.url)}" target="_blank" rel="noopener" data-tip="${escAttr(l.name)}">
    ${fav}<span class="sb-name">${esc(l.name)}</span>
  </a>`;
}

function renderSidebarMultiLink(l) {
  const favUrl = getFaviconUrl(l.base, l.fav);
  const accts = [0,1,2,3,4,5,6,7].map(n =>
    `<a class="sb-acct-btn" href="${escAttr(l.base.replace('{n}',n))}" target="_blank" rel="noopener">${n}</a>`
  ).join('');
  return `<div class="sb-multi" data-tip="${escAttr(l.name)}">
    <div class="sb-multi-row">
      <img class="sb-fav" src="${escAttr(favUrl)}" alt="">
      <span class="sb-multi-name">${esc(l.name)}</span>
      <div class="sb-multi-accts">${accts}</div>
    </div>
  </div>`;
}

function domain(url) { try{return new URL(url).hostname;}catch{return null;} }

function addLink() {
  let url=document.getElementById('link-input').value.trim();
  if(!url) return;
  if(!url.includes('://')) url='https://'+url;
  let name; try{name=new URL(url).hostname.replace('www.','');}catch{name=url;}
  const ll=links_get();
  ll.push({type:'link',name,url});
  links_save(ll); renderLinks(); renderSidebarLinks();
  document.getElementById('link-input').value='';
}

// ── THEME ──
function toggleTheme() {
  isDark=!isDark;
  applyTheme();
  saveSettings_storage();
}
function applyTheme() {
  document.documentElement.classList.toggle('lm',!isDark);
  document.getElementById('theme-btn').textContent=isDark?'☀':'☾';
  // Swap logo sources for dark/light
  const logoSrc = isDark ? 'tt_white_logo.png' : 'tt_black_logo.png';
  const el = document.getElementById('tt-logo');
  const sbEl = document.getElementById('sb-logo');
  if(el) el.src = logoSrc;
  if(sbEl) sbEl.src = logoSrc;
  if(tzView==='map'&&mapReady) drawMap(new Date());
}

// ── DENSITY ──
function setDensity(d){density=d;applyDensity();saveSettings_storage();}
function applyDensity(){
  document.body.classList.toggle('compact',density==='compact');
  document.querySelectorAll('#density-toggle .pill-btn').forEach(b=>
    b.classList.toggle('active',b.dataset.density===density));
}

// ── SETTINGS ──
function openSettings(){
  document.getElementById('api-key-input').value=apiKey;
  document.getElementById('memory-edit-input').value=memory;
  switchSettingsTab('api');
  document.getElementById('settings-modal').classList.add('open');
}
function closeSettings(){document.getElementById('settings-modal').classList.remove('open');}
function switchSettingsTab(tab){
  document.querySelectorAll('.modal-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.getElementById('tab-api').style.display=tab==='api'?'block':'none';
  document.getElementById('tab-memory').style.display=tab==='memory'?'block':'none';
}
function saveSettings(){
  apiKey=document.getElementById('api-key-input').value.trim();
  memory=document.getElementById('memory-edit-input').value.trim();
  saveSettings_storage(); saveMemory();
  closeSettings(); checkApiKey();
}

// ── FOOTER ──
function updateFooter(){
  const mins=Math.floor((Date.now()-sessionStart)/60000);
  document.getElementById('footer-uptime').textContent=
    mins<1?'Session just started':`Session: ${mins}m`;
}

document.addEventListener('DOMContentLoaded',init);
