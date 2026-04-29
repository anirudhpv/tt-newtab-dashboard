# Claude Code Handoff Prompt — TigerTracks New Tab Extension

Paste this entire prompt into Claude Code to continue development.

---

## Project Overview

You are continuing development of **TigerTracks New Tab** — a Chrome/Edge Manifest V3 extension that replaces the default new tab page with a custom agency dashboard for TigerTracks (tigertracks.ai), a performance marketing agency.

The extension is built with **plain HTML/CSS/JS — no framework, no build step**. All libraries are bundled locally in `extension/js/`. The extension must remain CSP-compliant (no inline scripts, no inline event handlers, no external script tags).

The current version is **v2.0**. The codebase is in the `extension/` folder of this repo.

---

## Current File Structure

```
extension/
├── manifest.json          # MV3 manifest
├── newtab.html            # Main dashboard page (537 lines)
├── newtab.js              # All JS logic (840 lines)
├── popup.html             # Toolbar icon popup
├── icon.png               # 128x128 extension icon
├── icon16.png             # 16x16 extension icon
├── js/
│   ├── countries-110m.json   # Natural Earth TopoJSON world map data
│   ├── topojson.min.js       # TopoJSON decoder (bundled locally)
│   ├── marked.umd.js         # Markdown renderer (bundled locally)
│   └── purify.min.js         # DOMPurify HTML sanitizer (bundled locally)
```

---

## Brand & Design Tokens

```css
--teal: #229FA1          /* Primary accent */
--teal-dim: #1a7b7d      /* Hover state */
--ink: #080e14           /* Dark mode background */
--surface: #101820       /* Dark mode card */
--surface2: #182028      /* Dark mode input/secondary */
--surface3: #1e2c38      /* Dark mode tertiary */
--text: #e4ecf2          /* Primary text */
--text-dim: #7a92a4      /* Secondary text */
--text-muted: #3f5566    /* Placeholder/disabled */
--danger: #d95050

/* Light mode overrides applied via .lm class on <html> */
```

**Fonts:** Fraunces (display), DM Sans (body), DM Mono (mono) — loaded from Google Fonts.

---

## Architecture

### Storage
- `localStorage['tt_settings']` — `{ apiKey, isDark, density, wxUnit }`
- `localStorage['tt_sessions']` — array of chat sessions `[{ id, label, messages:[], createdAt, updatedAt }]`
- `localStorage['tt_memory']`  — string, persistent cross-chat memory injected as system context
- `localStorage['tt_links']`   — array of link objects (see Links section)

### Key APIs Used
- **Weather:** `https://api.open-meteo.com/v1/forecast` — free, no key required
- **Reverse geocoding:** `https://nominatim.openstreetmap.org/reverse` — free, no key
- **AI Chat:** `https://api.z.ai/api/coding/paas/v4/chat/completions` — Z.ai GLM, requires API key, OpenAI-compatible response format (`choices[0].message.content`)
- **Web search:** Passed as a tool in the GLM request: `{ type: 'web_search', web_search: { enable: true, search_result: true } }`

### Timezones
```js
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
```
All timezone conversion uses `new Date(now.toLocaleString('en-US', { timeZone: tz.tz }))` — DST is handled automatically by the browser's Intl API.

### Links Format
```js
// Standard link
{ type: 'link', name: 'Claude', url: 'https://claude.ai' }

// Google multi-account row (shows 0-7 account switcher buttons)
{ type: 'multi', name: 'Gmail', base: 'https://mail.google.com/mail/u/{n}/#inbox', fav: 'mail.google.com' }
```

---

## Pending Features (Next Build — v3.0)

Build all of these in a single pass:

### 1. Fix Logo
The current inline SVG recreation of the TigerTracks logo doesn't look right. Replace it with the PNG files:
- `tt_white_logo.png` for dark mode
- `tt_black_logo.png` for light mode (apply `filter: invert(0)` — it's already black)
- Use `<img id="tt-logo">` and swap `src` on theme toggle
- Apply CSS to handle the black background in the PNGs: use `mix-blend-mode: screen` in dark mode and `mix-blend-mode: multiply` in light mode on the img tag to make the background disappear

### 2. Hourly Forecast Strip
Add a scrollable horizontal strip below the current weather conditions showing the next 12 hours.
- Use Open-Meteo `hourly` endpoint: `temperature_2m,weather_code,precipitation_probability`
- Add `&hourly=temperature_2m,weather_code,precipitation_probability` to the existing weather fetch
- Show: time, weather emoji, temp in selected unit (°F/°C), precipitation probability %
- Scrollable horizontally, current hour highlighted with teal border
- Same `fetchWeather()` call — just parse both `current` and `hourly` from the same response

### 3. Quick Links — Left Sidebar + Right Panel, Both Toggleable
Restructure the layout so links can appear in two places:

**Left sidebar:**
- Fixed left column, always in view regardless of page scroll
- Toggle show/hide with a button in the header (e.g. `⊟` / `⊞`)
- Two display modes, toggled independently:
  - **Icon rail (minimized):** ~48px wide, favicon only, tooltip on hover showing the link name
  - **Expanded:** ~200px wide, favicon + label text always visible
- For multi-account rows in minimized mode: show just the favicon, on hover show a small popover with the 0–7 buttons
- Persist sidebar state (visible/hidden, minimized/expanded) to localStorage

**Right panel:**
- The existing right-side card, now also independently toggleable (show/hide button in header)
- Persist state to localStorage

Both panels show the same links list. Editing (add/remove) in one reflects in the other since they share `localStorage['tt_links']`.

### 4. Fix Google Product Favicons
The Google S2 favicon service returns a generic Google icon for Docs/Sheets/Drive/Calendar. Hardcode the correct favicon URLs:

```js
const FAVICON_OVERRIDES = {
  'docs.google.com':      'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  'drive.google.com':     'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
  'calendar.google.com':  'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_31.ico',
};
// For Sheets specifically, detect from the base URL pattern
// 'spreadsheets' in base URL → 'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico'
```

For multi-links, check the `base` URL to determine which product it is rather than just using the `fav` domain.

---

## GitHub Repo Setup Instructions

1. Create a new GitHub repo: `tigertracks-newtab` (or `tt-newtab-dashboard`)
2. Initialize with this folder structure:
```
/
├── README.md
├── CLAUDE.md              (this file, renamed)
├── extension/             (current v2.0 — the working extension)
│   ├── manifest.json
│   ├── newtab.html
│   ├── newtab.js
│   ├── popup.html
│   ├── icon.png
│   ├── icon16.png
│   └── js/
│       ├── countries-110m.json
│       ├── topojson.min.js
│       ├── marked.umd.js
│       └── purify.min.js
└── history/               (version history for reference)
    ├── v0.1/
    ├── v0.2/
    ├── ...
    └── v2.0/              (copy of extension/)
```

3. Reconstruct version history based on the changelog in README.md — each version in `history/` should be a functional snapshot. v0.1 through v0.7 can be reconstructed from the README descriptions. They progressively add features as documented.

4. Commit message convention:
```
feat(v0.1): basic manifest + URL redirect
feat(v0.2): CSP fix - move inline JS to external file
feat(v0.3): dashboard shell - clock, weather, links, chat
feat(v0.4): real TT logo, canvas world map with TopoJSON
feat(v0.5): CDMX timezone, Z.ai GLM, web search tool
feat(v0.6): markdown rendering with marked.js + DOMPurify
feat(v0.7): Open-Meteo weather, Nominatim geocoding, design refresh
feat(v2.0): multi-session chat, memory system, Google multi-account links, temp toggle
```

5. Then build v3.0 with the pending features listed above as a new branch `feat/v3.0`, merge to main when complete.

---

## Key Constraints (Never Break These)

- **No inline JS** — all event handlers must use `addEventListener`, never `onclick=` in HTML
- **No inline `<script>` blocks** — all JS in external `.js` files
- **No external script tags** — CDN scripts are blocked by MV3 CSP; all libraries must be bundled locally in `extension/js/`
- **External `fetch()` is fine** — network requests from JS are allowed (Open-Meteo, Nominatim, Z.ai, Google favicons)
- **`localStorage` only** — no `chrome.storage` API needed, `localStorage` works fine for this use case
- **Single-file extension pages** — `newtab.html` and `popup.html` are self-contained; no separate CSS files needed

---

## Owner

Anirudh — TigerTracks (tigertracks.ai)
Built with Claude (Anthropic) — April 2026
