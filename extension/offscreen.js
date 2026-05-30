// Receives play requests from the service worker and plays the chime.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.target === 'offscreen' && msg.type === 'play-chime') {
    ttPlayChime(msg.chime || 'chime');
  }
});
