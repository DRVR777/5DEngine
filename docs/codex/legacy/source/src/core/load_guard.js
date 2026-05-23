// Loading screen progress bar — animates to 85% while JS parses, then first tick finishes it
(function () {
  var lb = document.getElementById("loadBar");
  if (!lb) return;
  var pct = 0;
  var iv = setInterval(function () {
    pct = Math.min(85, pct + (85 - pct) * 0.14 + 0.3);
    lb.style.width = pct.toFixed(1) + "%";
    if (pct >= 84.9) clearInterval(iv);
  }, 50);
})();
function _showLoadError(msg) {
  var ls = document.getElementById("loadingScreen");
  var lb = document.getElementById("loadBar");
  var sub = document.getElementById("loadSub");
  if (lb) lb.style.background = "#ff3344";
  if (sub) { sub.style.color = "#ff5d5d"; sub.textContent = msg; }
  var hud = document.getElementById("hud");
  if (hud) hud.innerHTML = "<b style='color:#ff5d5d'>ERR</b> " + msg;
  if (ls) ls.style.display = "flex";
}
// If loading screen not dismissed after 8s, surface error
setTimeout(() => { if (!window._loadingDismissed) _showLoadError("load failed — check console (F12)"); }, 8000);
// Catch unhandled JS errors
window.addEventListener("error", function (e) {
  _showLoadError((e.message || "JS error") + " " + (e.filename ? e.filename.split("/").pop() + ":" + e.lineno : ""));
});
window.addEventListener("unhandledrejection", function (e) {
  _showLoadError("promise rejected: " + (e.reason && e.reason.message || e.reason || "?"));
});
