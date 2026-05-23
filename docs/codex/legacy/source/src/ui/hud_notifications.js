// HUD notifications — Toast + Kill Feed — extracted from index.html
// Public API: Notifications.showToast(msg, type, duration), Notifications.addKillFeedEntry(text, color)

export function addKillFeedEntry(text, color = "#ff4466") {
  const feed = document.getElementById("killFeed");
  if (!feed) return;
  while (feed.children.length >= 5) feed.removeChild(feed.firstChild);
  const el = document.createElement("div");
  el.style.cssText = `color:${color};font-family:ui-monospace,monospace;font-size:11px;` +
    `background:rgba(2,8,22,0.88);border:1px solid rgba(255,68,102,0.3);border-radius:4px;` +
    `padding:4px 12px;animation:toastIn 0.15s ease-out forwards;letter-spacing:0.06em`;
  el.textContent = text;
  feed.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.4s";
    el.style.opacity = "0";
    setTimeout(() => feed.contains(el) && feed.removeChild(el), 420);
  }, 3200);
}

export function showToast(msg, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast" + (type !== "info" ? " " + type : "");
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s";
    el.style.opacity = "0";
    setTimeout(() => container.contains(el) && container.removeChild(el), 320);
  }, duration);
}

export const Notifications = { showToast, addKillFeedEntry };
export default Notifications;
