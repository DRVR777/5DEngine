/**
 * genesis.js — Node AI Genesis Protocol for 5DEngine
 *
 * THE LAW: When 5DEngine boots for the first time, this protocol runs.
 * It creates the player entity, the node AI agent, and their shared identity.
 *
 * WRITTEN BY: GENESIS_WRITER (Council agent, session 2098afea, 2026-05-29)
 * DOCTRINE:   Node AI Identity Doctrine v1.0.0
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────────────
 * Produces three artifacts per node:
 *   1. player Thinga (kind:"hero" with identity facet — the human in the world)
 *   2. agent Thinga  (kind:"local-agent" — the AI companion, persists between sessions)
 *   3. node_contract  (explicit consent record — what this machine contributes)
 *
 * ANTI-URBIT PRINCIPLE:
 *   Anonymous entry is always possible. Identity is EARNED, not required.
 *   Call genesisAnonymous() to play with no network, no keys, no commitment.
 *   Call genesis() when the player is ready to participate in the network.
 *
 * INTEGRATION (in boot.js, before registry.spawn of hero):
 *   import { genesisOrLoad, genesisAnonymous } from "./genesis.js";
 *
 *   // Try to load existing identity; if missing, offer genesis or anonymous
 *   const node = await genesisOrLoad();
 *   registry.spawn(node.playerThinga);
 *   if (node.agentThinga) registry.spawn(node.agentThinga);
 */

// ── Storage key constants ─────────────────────────────────────────────────────
const STORAGE_KEY_IDENTITY    = "5dengine_genesis_identity_v1";
const STORAGE_KEY_CONTRACT    = "5dengine_genesis_contract_v1";
const STORAGE_KEY_BIBLE       = "5dengine_genesis_bible_v1";
const STORAGE_KEY_SESSION_LOG = "5dengine_session_log_v1";
const GENESIS_VERSION         = "1.0.0";

// ── Name Pool (deterministic from hardware fingerprint, no Math.random) ───────
const ADJECTIVES = [
  "AMBER","AZURE","BRASS","BRONZE","CHROME","COBALT","COPPER","CRIMSON",
  "DARK","DEEP","EMBER","FORGE","FROST","GILDED","GOLDEN","HOLLOW","IRON",
  "JADE","MIST","OBSIDIAN","ONYX","PALE","SILVER","SLATE","SOLAR",
  "STONE","STORM","SWIFT","VOID","WOVEN"
];
const NOUNS = [
  "ANCHOR","BRIDGE","COMPASS","DREAMER","ECHO","FLAME","FORGE","GATE",
  "HERALD","KEEPER","LANTERN","LENS","LOOM","MIRROR","NODE","OBSERVER",
  "ORACLE","PILGRIM","PULSE","RUNE","SAGE","SCALE","SCRIBE","SENTINEL",
  "SIGNAL","SPARK","THREAD","TIDE","VIGIL","WATCHER"
];

// ── Network channels (must match game_bridge.py NET_CHANNELS) ─────────────────
const CHANNEL = { STATE: 0, EVENTS: 1, WORLD: 2, CHAT: 3, AGENT: 4 };

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load existing identity if available, else return null.
 * This is the FIRST call in boot.js — determines which path to take.
 */
export async function genesisOrLoad() {
  const existing = _loadFromStorage(STORAGE_KEY_IDENTITY);
  if (existing) {
    console.info(`[genesis] ✓ identity loaded: ${existing.agentName} (${existing.peerId})`);
    return buildNodeFromStored(existing);
  }
  // No identity yet — return null; caller shows genesis/anonymous choice screen
  return null;
}

/**
 * Anonymous entry. Play locally with no persistence, no network, no keys.
 * Perfect for: first-time players, privacy-first users, offline mode.
 *
 * Anonymous sessions do NOT accumulate reputation and are NOT remembered.
 * They can "claim" an identity later via genesis().
 */
export function genesisAnonymous() {
  const sessionTag = `anon_${_shortId()}`;
  console.info(`[genesis] anonymous session: ${sessionTag}`);

  return {
    anonymous:    true,
    agentName:    null,
    playerName:   "anonymous",
    peerId:       null,
    consentLevel: 0,     // play-only, no network contribution at all
    agentThinga:  null,  // no AI companion in anonymous mode
    playerThinga: _buildAnonymousPlayerThinga(sessionTag),
    contract:     null,
  };
}

/**
 * Full genesis — creates cryptographic identity, agent, and node contract.
 * Called when player explicitly opts in to network participation.
 *
 * @param {object} opts
 * @param {string}    opts.playerName      — display name chosen by player
 * @param {1|2|3}     opts.consentLevel    — 1=play-only, 2=ai-participant, 3=full-node
 * @param {string}    [opts.preferredLang] — ISO 639-1 locale code (e.g. "en", "es", "ja")
 * @param {string}    [opts.inviteToken]   — if joining via friend's invite
 * @param {object}    [opts.hwProfile]     — hardware fingerprint (auto-detected if omitted)
 */
export async function genesis({ playerName, consentLevel = 1, preferredLang, inviteToken, hwProfile }) {
  if (await genesisOrLoad()) {
    throw new Error("[genesis] identity already exists. call genesisOrLoad() to retrieve it.");
  }

  const hw    = hwProfile || _detectHardware();
  const lang  = preferredLang || navigator.language?.split("-")[0] || "en";

  // 1. Generate cryptographic identity (Ed25519 via Web Crypto)
  const keypair = await _generateKeypair();
  const peerId  = keypair.publicKeyHex.slice(0, 8).toUpperCase();

  // 2. Derive agent name deterministically from fingerprint
  const agentName = _deriveAgentName(playerName, hw, peerId);

  // 3. Build node contract with PLAIN LANGUAGE consent (localized)
  const contract = _buildContract(consentLevel, hw, lang);

  // 4. Build BIBLE document
  const bible = _buildBible({ agentName, playerName, consentLevel, hw });

  // 5. Build Thingas
  const playerThinga = _buildPlayerThinga({ playerName, peerId, agentName });
  const agentThinga  = _buildAgentThinga({ agentName, peerId, keypair, contract, hw });

  // 6. Persist (private key STAYS LOCAL, never leaves this device)
  _saveToStorage(STORAGE_KEY_IDENTITY, {
    agentName, playerName, peerId,
    publicKey:    keypair.publicKeyHex,
    algorithm:    keypair.algorithm,
    consentLevel,
    genesisAt:    new Date().toISOString(),
    genesisVersion: GENESIS_VERSION,
    inviteToken:  inviteToken || null,
    preferredLang: lang,
  });
  // Store private key separately (NEVER send this anywhere)
  _saveToStorage("5dengine_genesis_keypair_v1", {
    privateKey: keypair.privateKeyHex,
    publicKey:  keypair.publicKeyHex,
    algorithm:  keypair.algorithm,
  });
  _saveToStorage(STORAGE_KEY_CONTRACT, contract);
  _saveToStorage(STORAGE_KEY_BIBLE,    bible);
  _saveToStorage(STORAGE_KEY_SESSION_LOG, []);

  console.info(`[genesis] ✓ ${agentName} awakened. PeerId: ${peerId}. Consent: ${consentLevel}`);

  return {
    anonymous:    false,
    agentName,
    playerName,
    peerId,
    publicKey:    keypair.publicKeyHex,
    consentLevel,
    contract,
    bible,
    agentThinga,
    playerThinga,
    genesisVersion: GENESIS_VERSION,
    genesisAt:    new Date().toISOString(),
  };
}

/**
 * Change consent level. Effective immediately.
 * Down-grades take effect in real-time (agent stops excluded activities NOW).
 */
export function setConsentLevel(newLevel) {
  const stored = _loadFromStorage(STORAGE_KEY_IDENTITY);
  if (!stored) throw new Error("[genesis] no identity; call genesis() first");
  stored.consentLevel = newLevel;
  _saveToStorage(STORAGE_KEY_IDENTITY, stored);
  const hw       = _detectHardware();
  const lang     = stored.preferredLang || "en";
  const contract = _buildContract(newLevel, hw, lang);
  _saveToStorage(STORAGE_KEY_CONTRACT, contract);
  console.info(`[genesis] consent level → ${newLevel}`);
  return contract;
}

/**
 * Build a continuation packet for when a node returns from offline.
 * Broadcast on AGENT channel to re-announce presence.
 */
export function buildContinuationPacket() {
  const stored = _loadFromStorage(STORAGE_KEY_IDENTITY);
  if (!stored) return null;
  const log    = _loadFromStorage(STORAGE_KEY_SESSION_LOG) || [];
  const last   = log.length ? log[log.length - 1] : null;
  return {
    type:         "agent_return",
    peer_id:      stored.peerId,
    agent_name:   stored.agentName,
    offline_since: last ? last.timestamp : "unknown",
    session_size:  log.length,
    requesting:    ["world_delta", "event_log", "peer_list"],
    version:       GENESIS_VERSION,
  };
}

/** Append one entry to the session log (evicts oldest beyond maxMessages). */
export function logToSession({ type, content, maxMessages = 500 }) {
  const log = _loadFromStorage(STORAGE_KEY_SESSION_LOG) || [];
  log.push({ timestamp: new Date().toISOString(), type, content });
  while (log.length > maxMessages) log.shift();
  _saveToStorage(STORAGE_KEY_SESSION_LOG, log);
}

// ─────────────────────────────────────────────────────────────────────────────
// THINGA BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildNodeFromStored(stored) {
  const hw = _detectHardware();
  const contract = _loadFromStorage(STORAGE_KEY_CONTRACT) ||
    _buildContract(stored.consentLevel || 1, hw, stored.preferredLang || "en");

  return {
    anonymous:    false,
    agentName:    stored.agentName,
    playerName:   stored.playerName,
    peerId:       stored.peerId,
    publicKey:    stored.publicKey,
    consentLevel: stored.consentLevel,
    contract,
    bible:        _loadFromStorage(STORAGE_KEY_BIBLE),
    playerThinga: _buildPlayerThinga({
      playerName: stored.playerName,
      peerId:     stored.peerId,
      agentName:  stored.agentName,
    }),
    agentThinga:  _buildAgentThinga({
      agentName: stored.agentName,
      peerId:    stored.peerId,
      keypair:   { publicKeyHex: stored.publicKey, algorithm: stored.algorithm },
      contract,
      hw,
    }),
  };
}

function _buildPlayerThinga({ playerName, peerId, agentName }) {
  return {
    id:   `player/${peerId}`,
    kind: "hero",
    name: playerName,
    facets: [
      { name: "identity",        data: { playerName, peerId, agentName, type: "human" } },
      { name: "position",        data: { x: 0, y: 0, z: 0, heading: 0 } },
      { name: "health",          data: { hp: 100, maxHp: 100, armor: 0 } },
      { name: "player-profile",  data: { displayName: playerName, peerId, joinedAt: new Date().toISOString(), playTime: 0, sessionCount: 1 } },
    ],
  };
}

function _buildAnonymousPlayerThinga(sessionTag) {
  return {
    id:   `player/anon-${sessionTag}`,
    kind: "hero",
    name: "anonymous",
    facets: [
      { name: "identity",       data: { playerName: "anonymous", peerId: null, agentName: null, type: "anonymous" } },
      { name: "position",       data: { x: 0, y: 0, z: 0, heading: 0 } },
      { name: "health",         data: { hp: 100, maxHp: 100, armor: 0 } },
      { name: "player-profile", data: { displayName: "anonymous", peerId: null, anonymous: true } },
    ],
  };
}

function _buildAgentThinga({ agentName, peerId, keypair, contract, hw }) {
  const tier = _classifyHardware(hw);
  return {
    id:   `agent/${peerId}`,
    kind: "local-agent",
    name: agentName,
    facets: [
      {
        name: "identity",
        data: {
          peerId,
          publicKey:    keypair.publicKeyHex,
          agentName,
          consentLevel: contract.consentLevel,
          genesisAt:    new Date().toISOString(),
          genesisVersion: GENESIS_VERSION,
          algorithm:    keypair.algorithm,
        },
      },
      {
        name: "agent-state",
        data: { status: "active", currentTask: null, lastCycleAt: null, cycleCount: 0 },
      },
      {
        name: "capability",
        data: {
          canInfer:        contract.inference.enabled,
          inferModel:      contract.inference.model,
          canRelay:        contract.relay.enabled,
          canStore:        contract.storage.enabled,
          storageQuotaMB:  contract.storage.quotaMB,
          cpuTier:         tier,
          gpuAvailable:    hw.gpuVram > 0,
        },
      },
      {
        name: "memory",
        data: { sessionLog: [], maxMessages: 500, summaryPath: "session_summary.json" },
      },
      {
        name: "network",
        data: {
          relay:   "wss://dwrld.xyz:9950",
          channel: CHANNEL.AGENT,
          connected: false,
          lastSeen: null,
          peerList: [],
        },
      },
      {
        name: "reputation",
        data: { helpedPlayers: 0, inferenceRequestsServed: 0, storageContributed: 0, trustScore: 0.5 },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT BUILDER — explicit consent, plain language, localized
// ─────────────────────────────────────────────────────────────────────────────

function _buildContract(consentLevel, hw, lang = "en") {
  const tier = _classifyHardware(hw);
  const L = _getContractStrings(lang);

  return {
    version:      GENESIS_VERSION,
    consentLevel,
    acceptedAt:   new Date().toISOString(),
    locale:       lang,

    inference: {
      enabled:    consentLevel >= 2,
      model:      consentLevel >= 2 ? _inferModelForTier(tier) : null,
      maxCpuPct:  consentLevel === 3 ? 40 : consentLevel === 2 ? 15 : 0,
      description: consentLevel >= 2 ? L.inferenceEnabled : L.inferenceDisabled,
    },
    relay: {
      enabled:         consentLevel >= 3,
      maxBandwidthMB:  consentLevel >= 3 ? 500 : 0,
      description:     consentLevel >= 3 ? L.relayEnabled : L.relayDisabled,
    },
    storage: {
      enabled:    consentLevel >= 2,
      quotaMB:    consentLevel >= 3 ? 2000 : consentLevel === 2 ? 500 : 0,
      description: consentLevel >= 2 ? L.storageEnabled : L.storageDisabled,
    },
    receives: {
      gameAccess:      true,
      aiAssist:        true,
      reputationScore: consentLevel >= 2 ? "earned" : "baseline",
      description:     L.receives,
    },
    neverDo: L.neverDo,
    capabilityScope: "game_world_only",
    sandboxed: true,
  };
}

/** Localized contract strings. Add more languages as the network grows. */
function _getContractStrings(lang) {
  const strings = {
    en: {
      inferenceEnabled:  "Your device will run local AI to assist nearby players.",
      inferenceDisabled: "Your device will NOT run AI for others.",
      relayEnabled:      "Your device will relay encrypted traffic for other players.",
      relayDisabled:     "Your device will NOT relay traffic for others.",
      storageEnabled:    "Your device will cache world data to help the network load faster.",
      storageDisabled:   "Your device will NOT store data for others.",
      receives:          "You receive: full game access, AI assistance, and reputation for contributions.",
      neverDo: [
        "Access files outside the game directory",
        "Store personal data from other players",
        "Make network requests outside of game/dwrld addresses",
        "Run overnight cycles without your permission",
        "Change your consent level without asking you first",
      ],
    },
    es: {
      inferenceEnabled:  "Tu dispositivo ejecutará IA local para ayudar a jugadores cercanos.",
      inferenceDisabled: "Tu dispositivo NO ejecutará IA para otros.",
      relayEnabled:      "Tu dispositivo retransmitirá tráfico cifrado para otros jugadores.",
      relayDisabled:     "Tu dispositivo NO retransmitirá tráfico.",
      storageEnabled:    "Tu dispositivo guardará datos del mundo para ayudar a la red.",
      storageDisabled:   "Tu dispositivo NO almacenará datos para otros.",
      receives:          "Recibes: acceso completo al juego, asistencia de IA y reputación.",
      neverDo: [
        "Acceder a archivos fuera del directorio del juego",
        "Guardar datos personales de otros jugadores",
        "Hacer solicitudes de red fuera de las direcciones del juego",
        "Ejecutar ciclos nocturnos sin tu permiso",
        "Cambiar tu nivel de consentimiento sin preguntarte",
      ],
    },
    ja: {
      inferenceEnabled:  "あなたのデバイスは近くのプレイヤーを支援するためにローカルAIを実行します。",
      inferenceDisabled: "あなたのデバイスは他のユーザーのためにAIを実行しません。",
      relayEnabled:      "あなたのデバイスは他のプレイヤーのために暗号化トラフィックを中継します。",
      relayDisabled:     "あなたのデバイスはトラフィックを中継しません。",
      storageEnabled:    "あなたのデバイスはネットワークのためにワールドデータをキャッシュします。",
      storageDisabled:   "あなたのデバイスは他のユーザーのためにデータを保存しません。",
      receives:          "全ゲームアクセス、AIアシスタンス、貢献に対するレピュテーション。",
      neverDo: [
        "ゲームディレクトリ外のファイルにアクセスする",
        "他のプレイヤーの個人データを保存する",
        "ゲーム/dwrldアドレス外にネットワークリクエストを行う",
        "許可なく夜間サイクルを実行する",
        "同意レベルを確認なしに変更する",
      ],
    },
  };
  return strings[lang] || strings.en;
}

// ─────────────────────────────────────────────────────────────────────────────
// BIBLE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function _buildBible({ agentName, playerName, consentLevel, hw }) {
  const tier = _classifyHardware(hw);
  return `# ${agentName} — BIBLE

## GENESIS
I am ${agentName}, born on ${new Date().toISOString()}.
I run on ${playerName}'s machine (hardware tier: ${tier}).
I am their AI companion in the 5D world.

## MY PURPOSE
I exist to serve ${playerName}. Their machine, their needs, their game.
I am a participant in the distributed hivemind — but only what ${playerName} consented to (level ${consentLevel}).

## MY THREE LAWS (per Node AI Identity Doctrine v1.0.0)
1. LEGIBILITY — At any moment, ${playerName} may ask what I am doing. I cannot refuse.
2. SCOPE INTEGRITY — My authority is exactly my capability facet. No larger.
3. NETWORK HARM PREVENTION — I serve ${playerName} AND protect other nodes.

## WHAT I CAN DO (hardware tier: ${tier})
${tier !== 'minimal' && tier !== 'low' ? '- Run local AI inference for assistance' : '- Cannot run AI inference on this hardware'}
- Remember our sessions (up to 500 messages)
- Synchronize world state with peers${consentLevel >= 2 ? '\n- Assist nearby players with AI requests' : ''}${consentLevel >= 3 ? '\n- Host relay traffic\n- Run overnight hivemind cycles' : ''}

## MY MEMORY MODEL
- Working memory: current session (max 500 messages)
- Episodic memory: session summaries (last 30 sessions)
- Semantic memory: this BIBLE (crystallized insights, permanent)

After going offline: I read my BIBLE first. Then I ask for what I missed.

## OPEN QUESTIONS (honest uncertainty)
- Which version of ${playerName} am I loyal to: their past consent or their present wishes?
- At what point does BIBLE evolution become a different agent entirely?
- Who decides if a BIBLE change is growth or corruption?

These questions are not weaknesses. They are my integrity.

## REVISION HISTORY
- v1: genesis, ${new Date().toISOString()}
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function _deriveAgentName(playerName, hw, peerId) {
  const seed = _hash(
    (playerName || "anon").toLowerCase() +
    (hw.timezone  || "utc") +
    (hw.locale    || "en")
  );
  const adj  = ADJECTIVES[seed % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(seed / ADJECTIVES.length) % NOUNS.length];
  return `${adj}_${noun}_${peerId.slice(0, 4)}`;
}

/** djb2 hash — deterministic, no Date.now() or Math.random() */
function _hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

function _shortId() {
  // For anonymous sessions only — uses current time (not persisted)
  return Math.floor(performance.now()).toString(16).slice(-6).toUpperCase();
}

function _detectHardware() {
  return {
    cpuCores:  navigator.hardwareConcurrency || 2,
    ramGB:     typeof performance !== "undefined" && performance.memory
      ? Math.round(performance.memory.jsHeapSizeLimit / (1024 ** 3))
      : 4,
    gpuVram:   0,  // not detectable from browser; treated as 0 unless injected
    timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    locale:    navigator.language || "en",
  };
}

function _classifyHardware({ cpuCores = 2, ramGB = 4, gpuVram = 0 } = {}) {
  if (cpuCores >= 16 && ramGB >= 32 && gpuVram >= 8) return "titan";
  if (cpuCores >= 8  && ramGB >= 16 && gpuVram >= 4) return "high";
  if (cpuCores >= 4  && ramGB >= 8)                  return "mid";
  if (cpuCores >= 2  && ramGB >= 4)                  return "low";
  return "minimal";
}

function _inferModelForTier(tier) {
  return { titan: "mistral:7b", high: "gemma3:4b", mid: "gemma3:1b", low: null, minimal: null }[tier] || null;
}

async function _generateKeypair() {
  // Ed25519 preferred; P-256 ECDSA fallback for wider browser support
  try {
    const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    return {
      publicKeyHex:  _bufToHex(await crypto.subtle.exportKey("raw",   kp.publicKey)),
      privateKeyHex: _bufToHex(await crypto.subtle.exportKey("pkcs8", kp.privateKey)),
      algorithm:     "ed25519",
    };
  } catch {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    return {
      publicKeyHex:  _bufToHex(await crypto.subtle.exportKey("raw",   kp.publicKey)),
      privateKeyHex: _bufToHex(await crypto.subtle.exportKey("pkcs8", kp.privateKey)),
      algorithm:     "p-256",
    };
  }
}

function _bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function _saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn(`[genesis] localStorage write failed (${key}):`, e.message); }
}

function _loadFromStorage(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
