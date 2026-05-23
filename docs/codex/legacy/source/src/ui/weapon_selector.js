// Weapon selector bar — momentarily shown when switching weapons.
// mountWeaponSelector({ getCFG, getActiveWeaponId }) → { show() }
export function mountWeaponSelector({ getCFG, getActiveWeaponId }) {
  if (typeof document === "undefined") return { show: () => {} };

  let _timeout = null;

  function show() {
    const el = document.getElementById("weaponSelector");
    if (!el) return;
    const cfg = getCFG ? getCFG() : {};
    const weps = cfg.weapons || [];
    const activeId = getActiveWeaponId ? getActiveWeaponId() : null;
    el.style.display = "flex";
    el.style.opacity = "1";
    el.innerHTML = weps.map((w, i) => {
      const isActive = w.id === activeId;
      return `<div style="background:${isActive ? "rgba(0,200,255,0.18)" : "rgba(2,8,22,0.88)"};border:1px solid ${isActive ? "rgba(0,200,255,0.6)" : "rgba(0,200,255,0.2)"};border-radius:5px;padding:5px 14px;font-family:ui-monospace,monospace;font-size:10px;color:${isActive ? "#00ccff" : "#4488aa"};display:flex;gap:8px;align-items:center">
        <span style="color:#4488aa;font-size:9px">${i + 1}</span>
        <span>${(w.name || w.id).toUpperCase()}</span>
        ${isActive ? '<span style="color:#ffd166;font-size:9px">▶</span>' : ""}
      </div>`;
    }).join("");
    if (_timeout) clearTimeout(_timeout);
    _timeout = setTimeout(() => {
      el.style.transition = "opacity 0.4s";
      el.style.opacity = "0";
      setTimeout(() => { el.style.display = "none"; el.style.transition = ""; }, 420);
    }, 1800);
  }

  return { show };
}
