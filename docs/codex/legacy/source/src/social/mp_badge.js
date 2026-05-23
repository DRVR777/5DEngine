export function mountMpBadge({ getPeersSize }) {
  let _badge = null;
  function _ensureBadge() {
    if (_badge) return;
    _badge = document.createElement("div");
    _badge.id = "mpBadge";
    _badge.style.cssText = [
      "position:fixed;top:10px;right:14px;background:rgba(4,14,30,0.88)",
      "border:1px solid #4488cc66;border-radius:5px;padding:4px 10px",
      "color:#88ddff;font-family:monospace;font-size:11px;z-index:8888",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(_badge);
  }
  function _update() {
    _ensureBadge();
    const n = getPeersSize();
    _badge.textContent = n > 0 ? `\u{1F7E2} ${n + 1} players online` : "\u{1F534} solo";
    _badge.style.borderColor = n > 0 ? "#44cc6688" : "#4488cc66";
    _badge.style.color       = n > 0 ? "#44ff88"   : "#88ddff";
  }
  setInterval(_update, 2000);
  setTimeout(_update, 1500);
}
