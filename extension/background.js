// ───────────────────────── TigerTracks background service worker ─────────────────────────
// Owns the Pomodoro timer's authority so it completes even with no tab open.
//
// Source of truth: chrome.storage.local['tt_pomodoro'] — the same object the
// new-tab page reads/writes. The page is just a controller/viewer; this worker:
//   • watches storage for changes and (re)arms a chrome.alarms alarm at endsAt
//   • on completion: advances the phase, writes it back, notifies, chimes, badges
//   • keeps a toolbar badge counting down the remaining minutes (phase-colored)
//
// Alarms fire even when the worker is asleep and no tab is open, which is the
// whole point — Chrome wakes the worker to run onAlarm.

const KEY = 'tt_pomodoro';
const ALARM_END = 'pomo-end';     // precise completion
const ALARM_BADGE = 'pomo-badge'; // 1-min badge refresh while running

const POMO_DEFAULTS = { focus: 25, short: 5, long: 15, every: 4, soundEnabled: true, chime: 'chime' };
const PHASE_LABEL = { focus: 'Focus', short: 'Break', long: 'Long break' };
const PHASE_COLOR = { focus: '#229FA1', short: '#e8a020', long: '#8a78e8' };
const PHASE_NEXT_MSG = {
  focus: 'Focus session complete — time for a break.',
  short: 'Break over — back to focus.',
  long:  'Long break over — back to focus.',
};

// ── helpers ──
function phaseMs(s, mode) {
  const cfg = s.config || POMO_DEFAULTS;
  const m = mode || s.mode;
  const min = m === 'focus' ? cfg.focus : m === 'short' ? cfg.short : cfg.long;
  return (min || POMO_DEFAULTS[m]) * 60000;
}

async function getState() {
  const r = await chrome.storage.local.get(KEY);
  return r[KEY] || null;
}
async function setState(s) {
  await chrome.storage.local.set({ [KEY]: s });
}

// ── badge ──
async function setBadge(mode, minutes, dim) {
  try {
    await chrome.action.setBadgeText({ text: String(Math.max(0, minutes)) });
    await chrome.action.setBadgeBackgroundColor({ color: dim ? '#5b6b78' : (PHASE_COLOR[mode] || '#229FA1') });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: '#ffffff' });
    }
  } catch (e) {}
}
async function clearBadge() {
  try { await chrome.action.setBadgeText({ text: '' }); } catch (e) {}
}

// ── notification + sound ──
async function notifyComplete(prevMode) {
  try {
    await chrome.notifications.create('pomo-' + Date.now(), {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon.png'),
      title: `${PHASE_LABEL[prevMode]} complete`,
      message: PHASE_NEXT_MSG[prevMode] || 'Timer complete.',
      priority: 2,
    });
  } catch (e) {}
}

let creatingOffscreen = null;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (creatingOffscreen) { await creatingOffscreen; return; }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play the Pomodoro completion chime when no tab is open.',
  });
  try { await creatingOffscreen; } finally { creatingOffscreen = null; }
}
async function playChime(chime) {
  try {
    await ensureOffscreen();
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'play-chime', chime: chime || 'chime' });
  } catch (e) {}
}

// ── core ──
function advance(s) {
  const prev = s.mode;
  if (s.mode === 'focus') {
    s.focusCount = (s.focusCount || 0) + 1;
    const every = (s.config && s.config.every) || POMO_DEFAULTS.every;
    s.mode = (s.focusCount % every === 0) ? 'long' : 'short';
  } else {
    s.mode = 'focus';
  }
  s.running = false;
  s.endsAt = 0;
  s.remaining = phaseMs(s);
  return prev;
}

// Read state and reconcile alarms + badge with it. Completes the phase if the
// running timer has already elapsed.
async function reconcile() {
  const s = await getState();
  if (!s) { await clearAlarms(); await clearBadge(); return; }

  if (s.running) {
    const rem = s.endsAt - Date.now();
    if (rem <= 0) {
      const prev = advance(s);
      await setState(s);                 // triggers storage.onChanged in any open tab
      await clearAlarms();
      await clearBadge();
      await notifyComplete(prev);
      if (s.config && s.config.soundEnabled !== false) await playChime(s.config && s.config.chime);
      return;
    }
    // Still running: keep the completion alarm + a 1-min badge refresh armed.
    await chrome.alarms.create(ALARM_END, { when: s.endsAt });
    await chrome.alarms.create(ALARM_BADGE, { periodInMinutes: 1 });
    await setBadge(s.mode, Math.ceil(rem / 60000), false);
  } else {
    await clearAlarms();
    const total = phaseMs(s);
    if (s.remaining > 0 && s.remaining < total) {
      // Paused mid-phase — dim badge so it reads as "held".
      await setBadge(s.mode, Math.ceil(s.remaining / 60000), true);
    } else {
      await clearBadge();
    }
  }
}

async function clearAlarms() {
  try { await chrome.alarms.clear(ALARM_END); } catch (e) {}
  try { await chrome.alarms.clear(ALARM_BADGE); } catch (e) {}
}

// ── wiring ──
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY]) reconcile();
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM_END || a.name === ALARM_BADGE) reconcile();
});
chrome.runtime.onStartup.addListener(reconcile);
chrome.runtime.onInstalled.addListener(reconcile);

// Clicking the notification opens (or focuses) the TigerTracks dashboard.
chrome.notifications.onClicked.addListener((id) => {
  const url = chrome.runtime.getURL('newtab.html');
  chrome.tabs.query({}, (tabs) => {
    const existing = tabs.find(t => t.url && t.url.startsWith(url));
    if (existing) chrome.tabs.update(existing.id, { active: true });
    else chrome.tabs.create({ url });
    chrome.notifications.clear(id);
  });
});

// First run after the worker (re)spawns.
reconcile();
