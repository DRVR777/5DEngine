// In-game shop overlay — Tab to open, coin-based purchases.
// mountShopPanel({ items, getScore, setScore, showToast, playSfx, isBlocked })
//   items = [{ id, name, desc, cost, action() }]  — actions are pre-bound by caller
//   isBlocked() → true when shop should not open (computerOpen || buildMode)
// Returns { open(), close(), isOpen }
export function mountShopPanel({ items, getScore, setScore, showToast, playSfx, isBlocked }) {
  if (typeof document === "undefined") {
    return { open: () => {}, close: () => {}, get isOpen() { return false; } };
  }

  let _isOpen = false;

  function _renderGrid() {
    const grid = document.getElementById("shopGrid");
    const coinEl = document.getElementById("shopCoinDisplay");
    const score = getScore();
    if (coinEl) coinEl.textContent = score;
    if (!grid) return;
    grid.innerHTML = items.map(item => {
      const canAfford = score >= item.cost;
      return `<div class="shopItem${canAfford ? "" : " disabled"}" data-id="${item.id}">
        <div class="iName">${item.name}</div>
        <div class="iDesc">${item.desc}</div>
        <div class="iCost">${item.cost} coins</div>
      </div>`;
    }).join("");
    grid.querySelectorAll(".shopItem:not(.disabled)").forEach(el => {
      el.addEventListener("click", () => {
        const item = items.find(i => i.id === el.dataset.id);
        const cur = getScore();
        if (!item || cur < item.cost) return;
        setScore(cur - item.cost);
        item.action();
        if (playSfx) playSfx("tone:900:80:sine", 0.5);
        if (showToast) showToast(`Bought: ${item.name}`, "success", 1200);
        _renderGrid();
      });
    });
  }

  function open() {
    if (isBlocked && isBlocked()) return;
    _isOpen = true;
    document.exitPointerLock && document.exitPointerLock();
    const el = document.getElementById("shopOverlay");
    if (el) el.classList.add("open");
    _renderGrid();
  }

  function close() {
    _isOpen = false;
    const el = document.getElementById("shopOverlay");
    if (el) el.classList.remove("open");
    document.getElementById("gameCanvas")?.requestPointerLock?.();
  }

  const closeBtn = document.getElementById("shopClose");
  if (closeBtn) closeBtn.addEventListener("click", close);

  return {
    open,
    close,
    get isOpen() { return _isOpen; },
  };
}
