// Shared Pomodoro chime synthesis — used by the new-tab page (preview + the
// no-service-worker fallback) and by the offscreen document (background sound).
// Pure Web Audio so there are no audio files to bundle.
// Exposes a single global: ttPlayChime(name).
(function (root) {
  const CHIMES = {
    chime:   'chime',
    bell:    'bell',
    beep:    'beep',
    marimba: 'marimba',
  };

  function ttPlayChime(name) {
    try {
      const Ctx = root.AudioContext || root.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const t0 = ctx.currentTime;

      const tone = (freq, start, dur, type, peak) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0 + start);
        g.gain.exponentialRampToValueAtTime(peak || 0.28, t0 + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0 + start);
        o.stop(t0 + start + dur + 0.05);
      };

      let life = 1000;
      switch (name) {
        case 'bell':
          // Rich, slowly-decaying bell (fundamental + inharmonic partials).
          tone(660, 0, 1.4, 'sine', 0.3);
          tone(990, 0, 1.2, 'sine', 0.12);
          tone(1980, 0, 0.9, 'sine', 0.06);
          life = 1600;
          break;
        case 'beep':
          // Crisp double square beep.
          tone(1046, 0.00, 0.12, 'square', 0.18);
          tone(1046, 0.16, 0.12, 'square', 0.18);
          life = 500;
          break;
        case 'marimba':
          // Quick warm three-note arpeggio.
          tone(523, 0.00, 0.28, 'triangle', 0.3);
          tone(659, 0.12, 0.28, 'triangle', 0.3);
          tone(784, 0.24, 0.40, 'triangle', 0.3);
          life = 900;
          break;
        case 'chime':
        default:
          // Bright two-tone rise.
          tone(880, 0.00, 0.32, 'sine', 0.28);
          tone(1320, 0.18, 0.45, 'sine', 0.28);
          life = 900;
      }
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, life);
    } catch (e) {}
  }

  root.ttPlayChime = ttPlayChime;
  root.TT_CHIMES = CHIMES;
})(typeof self !== 'undefined' ? self : this);
