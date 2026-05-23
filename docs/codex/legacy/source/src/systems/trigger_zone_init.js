// Initialises TriggerZones, adds example zones, and wires ScriptRunner events.
// Safe to call even if TriggerZones is undefined — all calls are guarded.
export function mountTriggerZoneInit({ THREE, scene, showToast }) {
  if (typeof TriggerZones === "undefined") return;

  TriggerZones.init(THREE, scene);

  TriggerZones.addBox("zone_shop",
    { minU: -10, maxU: -4, minV: -6, maxV: 0, minY: 0, maxY: 5 },
    {
      onEnter: (eid) => { if (eid === "hero") showToast("SHOP — Press E to browse", "info", 2500); },
      onExit:  (eid) => { if (eid === "hero") showToast("Left SHOP", "info", 1500); },
    },
    { label: "SHOP", color: 0x00ffaa, debug: true }
  );

  TriggerZones.addBox("zone_danger",
    { minU: 10, maxU: 30, minV: 10, maxV: 30, minY: 0, maxY: 8 },
    { onEnter: (eid) => { if (eid === "hero") showToast("⚠ DANGER ZONE", "danger", 2000); } },
    { label: "DANGER", color: 0xff4466, debug: true }
  );

  window.addEventListener("zoneEnter", (e) => {
    const { entityId, zoneId } = e.detail;
    if (typeof ScriptRunner !== "undefined" && typeof ScriptRunner.dispatchZoneEvent === "function")
      ScriptRunner.dispatchZoneEvent("enter", zoneId, entityId);
  });
  window.addEventListener("zoneExit", (e) => {
    const { entityId, zoneId } = e.detail;
    if (typeof ScriptRunner !== "undefined" && typeof ScriptRunner.dispatchZoneEvent === "function")
      ScriptRunner.dispatchZoneEvent("exit", zoneId, entityId);
  });
}
