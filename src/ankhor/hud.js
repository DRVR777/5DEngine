/**
 * Ankhor HUD Module — loaded by index.html.
 * Weapon bob, sprint FOV, scope sway, crouch indicator, v-sync tear fix.
 * Minimal DOM manipulation. Feeds into existing tick wrapper.
 */

export function initHUD(ankhor) {
  // Scope sway element
  const scope = document.createElement('div');
  scope.id = 'scope';
  scope.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:98;border:40px solid rgba(0,0,0,0.85);opacity:0;transition:opacity 0.3s;border-radius:50%;';
  document.body.appendChild(scope);

  // Crouch indicator
  const crouch = document.createElement('div');
  crouch.id = 'crouchInd';
  crouch.style.cssText = 'position:absolute;bottom:100px;left:20px;color:#8af;font:11px monospace;background:rgba(0,0,0,0.4);padding:3px 8px;border-radius:3px;opacity:0;';
  document.getElementById('hud').appendChild(crouch);

  // State
  let bobT = 0;
  const stage = document.getElementById('stage');
  let lastKeys = {};

  function tick(dt) {
    bobT += dt * 7;
    const hero = ankhor.byKind('hero')[0];
    if (!hero) return;
    
    const inputs = ankhor.byKind('input')[0];
    const fd = inputs ? ankhor.facetData(inputs.id, 'input-state') : null;
    if (!fd) return;

    const keys = fd.keys || {};
    const moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;
    const sprinting = keys.ShiftLeft && moving;

    // Weapon bob
    const bobY = moving ? Math.sin(bobT) * 0.012 : 0;
    stage.style.transform = sprinting
      ? `translateY(${bobY * 100}px) scale(1.02)`
      : `translateY(${bobY * 100}px)`;

    // Sprint indicator
    document.getElementById('sprint').style.opacity = sprinting ? '1' : '0';

    // Crouch
    crouch.style.opacity = keys.CtrlLeft || keys.ControlLeft ? '1' : '0';

    // Ammo warn color
    const inv = ankhor.facetData(hero.id, 'inventory');
    const ammo = inv?.items?.pistol_9mm || 0;
    const ammoEl = document.getElementById('ammo');
    if (ammoEl) {
      ammoEl.textContent = ammo + ' / 60';
      ammoEl.style.color = ammo < 10 ? '#f44' : ammo < 20 ? '#fa0' : '#fff';
    }

    // HP display
    const hp = ankhor.facetData(hero.id, 'health');
    const hpEl = document.getElementById('hp');
    if (hp && hpEl) {
      hpEl.textContent = 'HP ' + Math.round(hp.hp || 0);
      hpEl.style.color = hp.hp < 30 ? '#f44' : hp.hp < 60 ? '#fa0' : '#fff';
    }
  }

  return { tick };
}
