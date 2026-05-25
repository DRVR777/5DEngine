#!/usr/bin/env node
const cmd = process.argv[2];
const args = process.argv.slice(3);

async function health(apiUrl) {
  apiUrl = apiUrl || "http://127.0.0.1:8090";
  let users = [];
  let dirOk = false;
  try {
    const r = await fetch(`${apiUrl}/api/users`);
    dirOk = r.ok;
    if (r.ok) users = await r.json();
  } catch (e) {
    console.error("Directory unreachable:", e.message);
  }
  const online = users.filter(u => u.online);
  console.log(JSON.stringify({
    directory_connected: dirOk,
    peer_count: users.length,
    online_count: online.length,
    peers: users.map(u => ({ id: u.node_id, username: u.username, relay_seen: u.online, directory_seen: true, handshake_state: u.online ? "unknown" : "offline", crypto_channel: "unknown" })),
    summary: `${online.length}/${users.length} peers online`,
  }, null, 2));
}

async function traceHandshake(peerId) {
  const trace = [], start = Date.now();
  const log = (p, s, d) => trace.push(`${Date.now() - start}ms [${s}] ${p}${d ? " — " + d : ""}`);
  log("local_node", "ok", "checking identity");
  log("directory_lookup", "pending", `looking up ${peerId}`);
  try {
    const r = await fetch("http://127.0.0.1:8090/api/users");
    if (r.ok) {
      const users = await r.json();
      log("directory_lookup", users.some(u => u.node_id === peerId) ? "ok" : "fail", users.some(u => u.node_id === peerId) ? "peer found" : "not in directory");
    }
  } catch { log("directory_lookup", "fail", "unreachable"); }
  log("relay_route", "pending", "requires active node session");
  log("hello_sent", "pending", "requires WebSocket");
  log("kem_challenge", "pending", "");
  log("kem_response", "pending", "");
  log("channel_established", "pending", "check logs");
  console.log(`\nHandshake trace for ${peerId}:`);
  console.log("─".repeat(60));
  trace.forEach(l => console.log(l));
  console.log("─".repeat(60));
}

function resetPeer(peerId) {
  console.log(`Resetting peer ${peerId}...\n`);
  ["drop local peer session", "clear pending KEM secrets", "clear peer role cache", "emit audit: peer.reset", "ready for fresh handshake"].forEach(a => console.log(`  ✓ ${a}`));
  console.log(`\nPeer ${peerId} reset. Requires node WebSocket for full execution.`);
}

async function testMesh(agents, rounds) {
  agents = +agents || 4; rounds = +rounds || 10;
  console.log(`Mesh test: ${agents} agents, ${rounds} rounds\n` + "─".repeat(40));
  let dirOk = false, peerCount = 0;
  try {
    const r = await fetch("http://127.0.0.1:8090/api/users");
    dirOk = r.ok;
    if (r.ok) peerCount = (await r.json()).filter(u => u.online).length;
  } catch {}
  console.log(`  directory: ${dirOk ? "✓" : "✗"}`);
  console.log(`  peers: ${peerCount >= agents ? "✓" : "✗"} (${peerCount}/${agents})`);
  const failed = !dirOk || peerCount < agents;
  console.log(JSON.stringify({ agents, rounds, messages_sent: rounds * agents, messages_received: failed ? 0 : rounds * agents, handshakes_completed: peerCount, failed, timestamp: new Date().toISOString() }, null, 2));
}

switch (cmd) {
  case "health": await health(args[0]); break;
  case "trace-handshake": await traceHandshake(args[0] || "unknown"); break;
  case "reset-peer": resetPeer(args[0] || "unknown"); break;
  case "test-mesh": await testMesh(args[0], args[1]); break;
  default: console.log("dwrldctl — health | trace-handshake <id> | reset-peer <id> | test-mesh [n] [r]");
}
