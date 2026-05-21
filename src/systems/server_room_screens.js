export const SERVER_ROOM_VIEWS = Object.freeze([
  { id: "srv_nginx", title: "NGINX LIVE", facet: "request-stream" },
  { id: "srv_procs", title: "PROCESSES", facet: "process-observer" },
  { id: "srv_db", title: "DATABASES", facet: "db-connection" },
  { id: "srv_agents", title: "AGENTS", facet: "agent-message" }
]);

export function paintServerRoomView(ctx, screen, registry, view) {
  ctx.fillStyle = "#020c16";
  ctx.fillRect(0, 0, screen.resolutionW, screen.resolutionH);
  ctx.fillStyle = "#0a2030";
  ctx.fillRect(0, 0, screen.resolutionW, 28);
  ctx.fillStyle = "#00ccff";
  ctx.font = "bold 14px monospace";
  ctx.fillText(view.title, 10, 19);

  const ids = [...registry.byFacet(view.facet)];
  ctx.fillStyle = ids.length ? "#00ff88" : "#667788";
  ctx.font = "12px monospace";
  ctx.fillText(ids.length ? "LIVE" : "WAIT", screen.resolutionW - 52, 19);

  let y = 48;
  ctx.fillStyle = "#aaccdd";
  ctx.font = "12px monospace";
  for (const id of ids.slice(-18)) {
    const data = registry.facetData(id, view.facet) || {};
    ctx.fillText(formatLine(id, data), 8, y);
    y += 16;
  }
}

function formatLine(id, data) {
  if (data.method || data.path) return `${data.method || "?"} ${data.path || id} ${data.status || ""}`.slice(0, 72);
  if (data.pid) return `${data.pid} ${data.name || id} cpu=${data.cpu_pct || 0} mem=${data.mem_mb || 0}`.slice(0, 72);
  if (data.dbname) return `${data.dbname} conns=${data.connections || 0} active=${data.active_queries || 0}`.slice(0, 72);
  if (data.agent) return `[${data.agent}] ${data.message || ""}`.slice(0, 72);
  return id.slice(0, 72);
}
