// Runs synchronously in <head> before <body> renders so the page paints in
// the user's saved theme — no light/dark flash.
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('tt_settings') || '{}');
    var isDark = s.isDark !== false; // default to dark
    if (!isDark) document.documentElement.classList.add('lm');
  } catch (e) {}
})();
