export function mountVehicleDashTick() {
  function tick(active, vState, isDrone, els) {
    const { vehicleDash, vdSpeed, vdGear } = els;
    if (!vehicleDash) return;
    if (active) {
      vehicleDash.style.display = "block";
      const kmh = vState ? Math.abs(vState.speed * 3.6).toFixed(0) : "0";
      const gear = isDrone
        ? `ALT ${((vState && vState.altY) || 0).toFixed(1)}m`
        : (vState ? (vState.gearName || "N") : "N");
      if (vdSpeed) vdSpeed.textContent = isDrone ? `${kmh} km/h` : kmh;
      if (vdGear) {
        vdGear.textContent = gear;
        vdGear.style.color = isDrone ? "#00bbff" : (gear === "R" ? "#ff4466" : "#ffd166");
      }
    } else {
      vehicleDash.style.display = "none";
    }
  }
  return { tick };
}
