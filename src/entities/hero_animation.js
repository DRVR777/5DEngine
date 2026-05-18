// Hero AnimationMixer state machine — loaded GLB clips, crossfade transitions.
// createHeroAnimSystem(THREE, heroGroup) → { tick, loadGLB, refreshCharEditor }
export function createHeroAnimSystem(THREE, heroGroup) {
  let heroMixer      = null;
  let _heroClips     = {};
  let _heroModelName = "primitive";
  let _heroSMCurrent = "";

  // Public knobs — settable from charEditor oninput handlers
  globalThis._heroSMMap       = { idle: "", walk: "", run: "", jump: "", attack: "", die: "" };
  globalThis._heroSMBlend     = 0.2;
  globalThis._heroSMTimeScale = 1.0;

  function _transition(stateKey) {
    if (!heroMixer || _heroSMCurrent === stateKey) return;
    const clipName = globalThis._heroSMMap[stateKey];
    if (!clipName || !_heroClips[clipName]) return;
    const incoming = _heroClips[clipName];
    incoming.timeScale = globalThis._heroSMTimeScale;
    if (globalThis._heroSMBlend > 0) {
      for (const [, action] of Object.entries(_heroClips)) {
        if (action !== incoming && action.isRunning()) action.crossFadeTo(incoming, globalThis._heroSMBlend, true);
      }
      incoming.reset().play();
    } else {
      heroMixer.stopAllAction();
      incoming.reset().play();
    }
    _heroSMCurrent = stateKey;
  }

  function tick(onGround, moving, sprinting, jumping, dead, dt) {
    if (heroMixer) {
      let target;
      if (dead)                     target = "die";
      else if (!onGround || jumping) target = "jump";
      else if (moving && sprinting)  target = "run";
      else if (moving)               target = "walk";
      else                           target = "idle";
      _transition(target);
      // Sync active action timeScale every tick
      if (_heroSMCurrent && globalThis._heroSMMap[_heroSMCurrent]) {
        const a = _heroClips[globalThis._heroSMMap[_heroSMCurrent]];
        if (a) a.timeScale = globalThis._heroSMTimeScale;
      }
      heroMixer.update(dt);
    }
  }

  function refreshCharEditor() {
    if (typeof document === "undefined") return;
    const panel = document.getElementById("charEditor");
    if (!panel || panel.style.display === "none") return;
    const nameEl = document.getElementById("charModelName");
    if (nameEl) nameEl.textContent = _heroModelName;

    const smEl = document.getElementById("charStateMachine");
    if (smEl) {
      const clipNames = Object.keys(_heroClips);
      const optionHtml = ['<option value="">-- none --</option>',
        ...clipNames.map(n => `<option value="${n}">${n}</option>`)].join("");
      const states = Object.keys(globalThis._heroSMMap);
      smEl.innerHTML = states.map(s => {
        const cur = globalThis._heroSMMap[s] || "";
        const isActive = _heroSMCurrent === s;
        return `<div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
          <span style="color:${isActive ? "#00ffaa" : "#778899"};font-size:9px;width:42px;text-align:right">${s}</span>
          <select data-sm-state="${s}"
            style="flex:1;background:rgba(0,8,20,0.9);border:1px solid rgba(0,200,255,0.25);
            color:#b8e8ff;border-radius:3px;font-size:9px;padding:1px 3px"
            onchange="globalThis._heroSMMap['${s}']=this.value;globalThis._heroSMCurrent_reset&&globalThis._heroSMCurrent_reset()">
            ${optionHtml.replace(`value="${cur}"`, `value="${cur}" selected`)}
          </select>
        </div>`;
      }).join("");
    }

    const clipList = document.getElementById("charClipList");
    if (!clipList) return;
    const names = Object.keys(_heroClips);
    if (names.length === 0) {
      clipList.innerHTML = `<div style="color:#334455">no clips loaded</div>`;
      return;
    }
    clipList.innerHTML = names.map(n => `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="color:#b8e8ff;font-size:10px;overflow:hidden;text-overflow:ellipsis;max-width:120px" title="${n}">${n}</span>
        <span style="display:flex;gap:3px">
          <button onclick="globalThis._heroPlayClip('${n}')"
            style="background:rgba(0,200,255,0.12);border:1px solid rgba(0,200,255,0.3);
            color:#00ccff;border-radius:3px;padding:1px 5px;font-size:9px;cursor:pointer">▶</button>
          <button onclick="globalThis._heroStopClip('${n}')"
            style="background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);
            color:#ff4466;border-radius:3px;padding:1px 5px;font-size:9px;cursor:pointer">■</button>
        </span>
      </div>`).join("");
  }

  function loadGLB(url, nameHint) {
    if (!globalThis.AssetLoader || !globalThis.AssetLoader.loadUrl) return;
    globalThis.AssetLoader.loadUrl(url, nameHint || "hero_model", (obj) => {
      while (heroGroup.children.length) heroGroup.remove(heroGroup.children[0]);
      obj.scale.setScalar(1);
      obj.position.set(0, 0, 0);
      heroGroup.add(obj);
      heroMixer = new THREE.AnimationMixer(obj);
      _heroClips = {};
      const srcClips = obj.animations || (obj._gltf && obj._gltf.animations) || [];
      for (const clip of srcClips) {
        _heroClips[clip.name] = heroMixer.clipAction(clip);
      }
      _heroModelName = nameHint || url.split("/").pop();
      refreshCharEditor();
    });
  }

  // Allow select onchange to reset the SM current state
  globalThis._heroSMCurrent_reset = () => { _heroSMCurrent = ""; };

  globalThis._heroPlayClip = (name) => {
    const action = _heroClips[name];
    if (!action) return;
    heroMixer.stopAllAction();
    action.reset().play();
  };
  globalThis._heroStopClip = (name) => {
    const action = _heroClips[name];
    if (action) action.stop();
  };

  return { tick, loadGLB, refreshCharEditor };
}
