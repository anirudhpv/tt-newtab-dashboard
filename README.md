# TigerTracks New Tab Dashboard

A Chrome/Edge extension that replaces the default new tab page with a custom agency dashboard built for TigerTracks (tigertracks.ai).

## Features

- **Live world clocks** — Hawaii, Pacific, Mountain, CDMX, Central, Eastern, London, India with day/night icons and DST-aware offsets
- **Interactive map** — Canvas-rendered Natural Earth world map with timezone hotspots, day/night shadow overlay
- **Weather** — Open-Meteo (no API key required), °F/°C toggle, Nominatim reverse geocoding
- **Multi-session AI chat** — GLM via Z.ai API, labeled + searchable sessions, markdown rendering, web search tool, source cards
- **Persistent memory** — GLM-suggested cross-chat context, accept/edit/reject flow, manual edit in settings
- **Quick links** — Google multi-account rows (Gmail, Sheets, Docs, Drive, Calendar with 0–7 account switcher), Claude, ChatGPT, Gemini, agency tools
- **Dark/light mode**, comfortable/compact density toggle
- **No external CDN dependencies** — all libraries bundled locally (topojson, marked, DOMPurify)

## Version History

| Version | Description |
|---------|-------------|
| v0.1 | Basic manifest + URL redirect |
| v0.2 | CSP fix — inline JS moved to external file |
| v0.3 | Dashboard shell — clock, weather (OpenWeatherMap), quick links, Claude chat |
| v0.4 | Real TT logo, canvas world map with TopoJSON/Natural Earth |
| v0.5 | CDMX timezone, Z.ai GLM chat, web search tool |
| v0.6 | marked.js + DOMPurify — markdown rendering in chat |
| v0.7 | Open-Meteo (no key), Nominatim geocoding, design refresh |
| v2.0 | Multi-session chat, GLM memory system, Google multi-account links, °F/°C toggle |

## Installation

1. Clone this repo
2. Open Chrome/Edge → `edge://extensions` or `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `extension/` folder
5. Open a new tab

## Setup

Open a new tab → click ⚙ → add your **Z.ai API key** (get it at `app.z.ai` → API Keys).

Weather works automatically with no key — it uses your browser's geolocation.

## Tech Stack

- Manifest V3 Chrome extension (plain HTML/CSS/JS, no build step)
- [Open-Meteo](https://open-meteo.com/) — free weather API
- [Nominatim](https://nominatim.org/) — free reverse geocoding
- [Z.ai GLM](https://app.z.ai) — AI chat
- [Natural Earth / world-atlas](https://github.com/topojson/world-atlas) — map data
- [topojson-client](https://github.com/topojson/topojson-client) — TopoJSON decoder
- [marked.js](https://marked.js.org/) — markdown rendering
- [DOMPurify](https://github.com/cure53/DOMPurify) — HTML sanitization

## Fonts

- [Fraunces](https://fonts.google.com/specimen/Fraunces) — display/headlines
- [DM Sans](https://fonts.google.com/specimen/DM+Sans) — body
- [DM Mono](https://fonts.google.com/specimen/DM+Mono) — monospace/labels

## Brand

- Tiger Teal: `#229FA1`
- Ink: `#0A1119`
- Charcoal: `#1B2126`
