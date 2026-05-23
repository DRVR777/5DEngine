// Game Config Editor — K key in build mode.
// mountConfigEditor(GameConfig) wires the cfgEditor panel (already in DOM via hud_template).
export function mountConfigEditor(GameConfig) {
  if (typeof document === "undefined") return;
  const defaults = JSON.parse(JSON.stringify(GameConfig || {}));

  const SECTIONS = [
    { label: "PLAYER MOVEMENT", keys: ["walkSpeed","sprintSpeed","jumpVelocity","gravity"] },
    { label: "PLAYER HEALTH",   keys: ["heroMaxHp","heroRegenDelay","heroRegenRate"] },
    { label: "CAMERA",          keys: ["camDistMin","camDistMax","camDefaultDist","camAimShrink","camPitchMin","camPitchMax","camLookAheadDist"] },
    { label: "WORLD",           keys: ["arenaHalfExtent","computerInteractDist","vehicleInteractDist","pickupRadius"] },
    { label: "BUILDER",         keys: ["snapGridSize"] },
  ];

  const META = {
    walkSpeed:          { min:1,   max:20,  step:0.5  },
    sprintSpeed:        { min:1,   max:40,  step:0.5  },
    jumpVelocity:       { min:1,   max:30,  step:0.5  },
    gravity:            { min:-60, max:-5,  step:1    },
    heroMaxHp:          { min:10,  max:500, step:10   },
    heroRegenDelay:     { min:0,   max:30,  step:0.5  },
    heroRegenRate:      { min:0,   max:50,  step:0.5  },
    camDistMin:         { min:0,   max:5,   step:0.1  },
    camDistMax:         { min:1,   max:40,  step:0.5  },
    camDefaultDist:     { min:0,   max:30,  step:0.5  },
    camAimShrink:       { min:0,   max:1,   step:0.05 },
    camPitchMin:        { min:-2,  max:0,   step:0.05 },
    camPitchMax:        { min:0,   max:1.5, step:0.05 },
    camLookAheadDist:   { min:0,   max:60,  step:1    },
    arenaHalfExtent:    { min:10,  max:200, step:5    },
    computerInteractDist:{ min:0.5,max:10,  step:0.5  },
    vehicleInteractDist: { min:0.5,max:10,  step:0.5  },
    pickupRadius:       { min:0.2, max:5,   step:0.1  },
    snapGridSize:       { min:0.1, max:5,   step:0.1  },
  };

  function build() {
    const container = document.getElementById("cfgSections");
    if (!container) return;
    const cfg = GameConfig || {};
    let html = "";
    for (const sec of SECTIONS) {
      html += `<div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:4px;margin-top:8px">${sec.label}</div>`;
      for (const key of sec.keys) {
        const val = cfg[key] != null ? cfg[key] : 0;
        const m = META[key] || { min: -100, max: 100, step: 0.1 };
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
        html += `<div style="display:grid;grid-template-columns:1fr 80px 44px;gap:4px;align-items:center;margin-bottom:3px">
          <span style="color:#b8e8ff;font-size:10px">${label}</span>
          <input type="range" data-cfgkey="${key}" min="${m.min}" max="${m.max}" step="${m.step}" value="${val}"
            style="accent-color:#00ccff" oninput="document.getElementById('cfgv_${key}').textContent=parseFloat(this.value)">
          <span id="cfgv_${key}" style="color:#ffd166;font-size:10px;text-align:right">${val}</span>
        </div>`;
      }
    }
    container.innerHTML = html;
    if (Array.isArray(cfg.weapons)) {
      html = "";
      for (const wep of cfg.weapons) {
        html += `<div style="color:#00ccff;font-size:9px;letter-spacing:0.15em;margin-bottom:4px;margin-top:10px">WEAPON · ${wep.name || wep.id}</div>`;
        const wepFields = [
          ["damage",         {min:1,   max:200,  step:1    }],
          ["fireRate",       {min:0.1, max:30,   step:0.1  }],
          ["range",          {min:5,   max:200,  step:1    }],
          ["speed",          {min:10,  max:400,  step:5    }],
          ["magCap",         {min:1,   max:100,  step:1    }],
          ["reloadDuration", {min:200, max:8000, step:100  }],
          ["spread",         {min:0,   max:0.5,  step:0.005}],
          ["pellets",        {min:1,   max:20,   step:1    }],
        ];
        for (const [field, m] of wepFields) {
          const val = wep[field] != null ? wep[field] : 0;
          const id = `cfgv_wep_${wep.id}_${field}`;
          const label = field.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
          html += `<div style="display:grid;grid-template-columns:1fr 80px 44px;gap:4px;align-items:center;margin-bottom:3px">
            <span style="color:#b8e8ff;font-size:10px">${label}</span>
            <input type="range" data-wepid="${wep.id}" data-wepfield="${field}" min="${m.min}" max="${m.max}" step="${m.step}" value="${val}"
              style="accent-color:#00ccff" oninput="document.getElementById('${id}').textContent=parseFloat(this.value)">
            <span id="${id}" style="color:#ffd166;font-size:10px;text-align:right">${val}</span>
          </div>`;
        }
      }
      container.innerHTML += html;
    }
  }

  function apply() {
    const cfg = GameConfig;
    if (!cfg) return;
    document.querySelectorAll("#cfgSections input[data-cfgkey]").forEach(sl => {
      const val = parseFloat(sl.value);
      if (!isNaN(val)) cfg[sl.dataset.cfgkey] = val;
    });
    document.querySelectorAll("#cfgSections input[data-wepid]").forEach(sl => {
      const wep = (cfg.weapons || []).find(w => w.id === sl.dataset.wepid);
      if (wep) wep[sl.dataset.wepfield] = parseFloat(sl.value);
    });
    const msg = document.getElementById("cfgMsg");
    if (msg) {
      msg.textContent = "Applied — changes are live.";
      msg.style.color = "#00ffaa";
      setTimeout(() => { msg.textContent = ""; }, 2000);
    }
  }

  function reset() {
    if (!GameConfig) return;
    Object.assign(GameConfig, JSON.parse(JSON.stringify(defaults)));
    build();
    const msg = document.getElementById("cfgMsg");
    if (msg) {
      msg.textContent = "Reset to defaults.";
      msg.style.color = "#ffd166";
      setTimeout(() => { msg.textContent = ""; }, 2000);
    }
  }

  document.getElementById("cfgApply")?.addEventListener("click", apply);
  document.getElementById("cfgReset")?.addEventListener("click", reset);

  // Build the editor immediately so it's ready when K is pressed
  build();

  return { build, apply, reset };
}
