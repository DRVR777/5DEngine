// Scene Hierarchy panel — H key in build mode. Lists managed + notable scene objects.
// mountSceneHierarchy({ getWorldBuilder, scene }) → render()
export function mountSceneHierarchy({ getWorldBuilder, scene }) {
  if (typeof document === "undefined") return () => {};

  function render() {
    const tree     = document.getElementById("shTree");
    const countEl  = document.getElementById("shCount");
    const searchEl = document.getElementById("shSearch");
    if (!tree) return;

    const worldBuilder = getWorldBuilder();
    const filter   = searchEl ? searchEl.value.toLowerCase() : "";
    const managed  = worldBuilder ? worldBuilder.getManagedMap() : new Map();
    const sel      = worldBuilder ? worldBuilder.getSelected() : null;
    const rows     = [];

    function _makeRow(obj, depth, isManaged, meta) {
      const name   = obj.name || (meta && meta.primitive ? meta.primitive : "") || obj.type || "object";
      if (filter && !name.toLowerCase().includes(filter)) return;

      const locked  = !!(obj.userData && obj.userData.locked);
      const visible = obj.visible !== false;
      const isSel   = obj === sel;

      const row = document.createElement("div");
      row.className = "sh-row" + (isSel ? " sh-selected" : "");
      row.style.paddingLeft = (4 + depth * 10) + "px";

      const visBtn = document.createElement("button");
      visBtn.className = "sh-btn";
      visBtn.title = visible ? "Hide" : "Show";
      visBtn.textContent = visible ? "◉" : "○";
      visBtn.onclick = (ev) => {
        ev.stopPropagation();
        obj.visible = !obj.visible;
        render();
      };

      const lockBtn = document.createElement("button");
      lockBtn.className = "sh-btn";
      lockBtn.title = locked ? "Unlock" : "Lock";
      lockBtn.textContent = locked ? "■" : "□";
      lockBtn.onclick = (ev) => {
        ev.stopPropagation();
        obj.userData = obj.userData || {};
        obj.userData.locked = !locked;
        render();
      };

      const nameEl = document.createElement("span");
      nameEl.className = "sh-name";
      nameEl.textContent = name;
      nameEl.style.opacity = visible ? "1" : "0.4";
      nameEl.style.color = isManaged ? "#b8e8ff" : "#556677";

      const typeEl = document.createElement("span");
      typeEl.className = "sh-type";
      typeEl.textContent = meta ? (meta.primitive || "mesh") : obj.type.replace("Mesh","").replace("Group","grp").toLowerCase();

      row.appendChild(visBtn);
      row.appendChild(lockBtn);
      row.appendChild(nameEl);
      row.appendChild(typeEl);

      if (worldBuilder && (isManaged || obj.isMesh || obj.isGroup)) {
        row.onclick = () => { worldBuilder.select(obj); render(); };
      }
      rows.push(row);
    }

    const managedSet = new Set(managed.keys());
    for (const [mesh, meta] of managed) _makeRow(mesh, 0, true, meta);

    for (const obj of scene.children) {
      if (managedSet.has(obj)) continue;
      const t = obj.type || "";
      if (t.includes("Light") || obj.isMesh || obj.isGroup) {
        _makeRow(obj, 0, false, null);
      }
    }

    tree.innerHTML = "";
    if (rows.length === 0) {
      tree.innerHTML = '<div style="color:#334455;font-size:10px;padding:4px">No objects' + (filter ? ' matching "' + filter + '"' : '') + '</div>';
    } else {
      for (const r of rows) tree.appendChild(r);
    }
    if (countEl) countEl.textContent = managed.size + " obj";
  }

  const shSearchEl = document.getElementById("shSearch");
  if (shSearchEl) shSearchEl.addEventListener("input", () => { if (getWorldBuilder()) render(); });

  return render;
}
