# 5DEngine — Implementation Queue

Running list of everything the user has asked for, plus architectural pieces from `abstractifyThis.pdf` (Dreamworld plan) + `conviction.pdf` (Dreamworld PRD). Items get crossed off as they ship. Add to this file when new asks come in; never rely on memory.

---

## ✅ Done — Session 1 (camera/gun/computer/car gears)
- [x] Fix W/S inversion (W was walking *toward* camera)
- [x] Fix bullet direction (was firing opposite to aim)
- [x] Car becomes blocker so hero can't walk through it
- [x] Car physics gets blocker check vs buildings (no more phasing through walls)
- [x] Car gears (R/N/1–5 auto-shift) + handbrake (Space) + bigger top speed
- [x] Visible pistol mesh attached to right arm
- [x] Scroll-wheel zoom (3rd → 1st person; character hidden in 1st)
- [x] Side-shoulder camera offset; **L** flips left/right
- [x] **R** reloads pistol from inventory bag
- [x] Computer opens a real desktop UI (8 apps wired + Browser iframe)
- [x] Browser app — sandboxed iframe inside the in-game computer
- [x] Stackable platforms abstraction — jump on hood, then on roof, then on any future object
- [x] Real interaction test — simulates keypresses + clicks via jsdom-style sandbox
- [x] Asset list per the two PDFs

## ✅ Done — Session 6 (sound + storage media UX, iter 135)
- [x] **Audio actually plays** — WebAudio adapter for the existing audio.js mixer. Synth tones from string specs ("beep", "beep:440", "click", "blip", "noise", "tone:F:MS:type"). Bus → spk1 inbox → mixer dispatch happens every tick.
- [x] **Spatial attenuation** — sound volume scales by distance from hero to speaker (0 at 30m).
- [x] **Sounds wired**: gunshot pop on LMB shoot; HYPE/RF/COIN jumbotron buttons each play distinct tones; pickup blip on CD/USB pickup; insert/eject sounds.
- [x] **CD + USB as world pickups** — walk within 1.5m of them near spawn → auto-pickup into `heroMedia`. Visible 3D cylinder (CD) + box (USB) meshes; bob + spin while uncollected.
- [x] **Devices app extended** — lists carried media with [Insert → cd_slot] / [Insert → usb_b] buttons. Slotted media row has [Eject] button. Click → calls `deviceBus.insertMedia` / `ejectMedia`; UI re-renders live.
- [x] **Files app added** — shows the slotted media's filesystem as a clickable file tree; click a file → reveals its contents inline.

## ✅ Done — Session 5 (mouse-mode cursor + GLTF scaffold, iter 133)
- [x] **TDZ bug fixed** — `worldScreens` was used before declaration (user-reported JS error); hoisted to before the device-graph block.
- [x] **Full mouse-mode cursor on big screens** — press E on the jumbotron (or M near it) → enter mouse mode. Mouse movement drives a yellow crosshair cursor painted on the screen. LMB invokes the region under the cursor.
- [x] **HUD shows "🖱 MOUSE MODE"** indicator with ESC/M-to-exit hint.
- [x] **GLTFLoader scaffold** — `gltf_loader.js` module with `parseManifest`, `load`, `onSlotReady`, `replacePlaceholder` API. Wired into index.html via the importmap `three/addons/`. Pistol / car body / coins auto-swap when .glb files appear.
- [x] **assets/manifest.json** — 13 slots mapped to expected .glb paths.
- [x] **assets/README.md** — instructions for the user.
- [x] **iter 133 test suite** — 32 passing (manifest parsing + screen-click round-trip).

## ✅ Done — Session 4 (interactive screens + snap-zoom + mon1 mirror, iter 132)
- [x] **E + raycast → click in-world screens** — `tryClickWorldScreen()` shoots a ray through the crosshair, finds the screen + UV, invokes the region's onClick.
- [x] **Jumbotron has 3 clickable buttons** — HYPE (counter), 📻 RF (broadcasts on radioA), + COIN (gives score)
- [x] **Snap-zone keybinds**: **Q** → FIRST_PERSON, **V** → THIRD_PERSON, **Z** → BIRD_VIEW. Smooth lerp via `CameraSpine.lerpZoom`.
- [x] **M** toggles mouse-mode (releases pointer lock for screen interaction)
- [x] **mon1 mirror** — the physical monitor mesh next to the PC now shows the device-graph's mon1 video_in inbox; PC broadcasts a live video frame every 500ms.

## ✅ Done — Session 3 (camera spine + in-world screens, iter 131)
- [x] **camera_spine.js** — pure module mapping camDist→4 named zones (INSIDE/FIRST_PERSON/THIRD_PERSON/BIRD_VIEW) per conviction.pdf §5.1. Per-zone params: distance, heightOffset, heroVisible, heroOpacity, inputMode, allowShooting, fovBias.
- [x] **screen_mesh.js** — any 3D plane can become a clickable HTML-rendered screen via CanvasTexture; raycast UV → DOM hit-test; SIZE_PRESETS for small/big/jumbotron(50ft)/colossal(1000ft).
- [x] **50ft jumbotron in-world** — placed at city edge, paints hero pos, coins, HP, current camera zone live each frame.
- [x] **1000ft sky screen** — way up in the sky, scrolling marquee + score, visible from anywhere.
- [x] Spine wired into camera positioning — hero visibility now zone-driven (INSIDE/FP hide hero, TP/BIRD show).
- [x] HUD shows current camera zone + localT percentage.
- [x] 50 tests passing (test_iter_131.js).

## ✅ Done — Session 2 (devices/wires + UX polish, iter 130)
- [x] **A/D inversion fixed** (user said W/S correct but A/D reversed)
- [x] **Right-click to aim** — camera pulls in 40%, arms raise to sighting pose
- [x] **Walking leg animation amplified** — 1.5× swing visible at the hip pivot
- [x] **Cinematic computer entry** — camera dollies in over 0.45s before overlay shows
- [x] **E-close conflict fixed** — when computer open, E flows to DOM (no slam-shut). Close via ESC or red ✕ button only
- [x] **Mouse cursor freed** on computer entry — exitPointerLock so user can click apps
- [x] **devices.js + wires.js shipped** — generic typed-port device graph (55 tests)
- [x] **Computer ↔ Monitor (video) + Computer ↔ Speaker (audio) + Computer ↔ USB (data)** wired and rendered in-world as 3D bezier cables
- [x] **Two walkie-talkie radios** placed at desk + across map, both on 94.7 MHz
- [x] **Devices app** in DWRLD OS — shows live device graph
- [x] **Radio app** — text input + broadcast button; messages physically traverse the bus to the other radio
- [x] **Cables color-coded by kind** — video=blue, audio=orange, data=green, power=yellow, rf=purple

## 🔥 In-flight
- [ ] Honest integration audit — which of the 130+ iter modules are actually wired into `index.html` vs sitting orphan

## 🎯 Next session (queued)
- [ ] **Screen-to-DOM interactivity** — currently screens are render-only. Wire E + raycast → SM.hitTest → invoke the region's onClick. Should let the player "click" buttons painted on the jumbotron.
- [ ] **Mouse-mode on big screens** — user spec: "switch to mouse mode" on the 50ft/1000ft screens so the cursor is unlocked and movement controls the screen instead of the camera.
- [ ] **Mirror computer's monitor content onto a 3D in-world monitor mesh** — wire the device-graph's `mon1` to its physical mesh via screen_mesh.
- [ ] **CD / USB as inventory pickups** that you carry — currently devices live in the world. Player should pick up a USB, walk to a computer, insert it via UI.
- [ ] **GLTFLoader integration** + `assets/` dir — replace placeholder block meshes with the `.glb` files from `ASSET_LIST.md`
- [ ] **FP camera reticle / FOV widen on aim** (currently only camDist shrinks; FOV is static)
- [ ] **Snap-to-zone keybinds** — Q=FIRST_PERSON, Z=BIRD_VIEW using CameraSpine.zoomForZone + lerpZoom
- [ ] **test_iter_109.js flaky decay/clamp** — reputation system clamps right but timing of `_applyDecay` between `standing()` and the actual `delta` is causing intermittent mismatches under load. Fix: hoist `now` once per call and reuse.

## 📚 Architectural debt from the two PDFs (medium-term)
- [ ] **Universal Packet protocol** (conviction.pdf §3) — every interaction is a `{header, body}` packet. Already roughly aligned with `cwp:"1.0"` envelope from `net.js` (iter 20). Formalize.
- [ ] **Knowledge graph** — IndexedDB local store, agent-emitted node CRUD. (Dreamworld plan Week 11.)
- [ ] **Agent service** — Anthropic API integration, decomposition prompt, braindump. (Dreamworld plan Week 3.)
- [ ] **VPS containers** behind in-game computers (Dreamworld plan Week 41) — for now, every "computer" is a static UI; later, each one is a real Hetzner container.
- [ ] **Multiplayer world processes** (Dreamworld plan Week 17) — gateway forks a child process per world.
- [ ] **Soul check loop** — every shipped feature should pass "would I show this to a stranger?" before moving on. (This was the gap that produced 130 iters of orphan modules.)

## 🧩 User-stated requirements — captured verbatim so the spirit doesn't get lost
> "guns and live multiplayer, hitboxes, so u cant walk thru walls, jump on objects, health, ai enemies, open shops, sell cars, import custom objects, modular asf, interiors to all the buildings, coordinate system of nested buildings so that buildings can have impossible interior geometry per conviction.pdf, commit every change to github, run it when ur done"

> "the cam — w should make you walk forward, but w makes you walk towards the camera"

> "scroll wheel make it so the position of the camera is on an axis from the head of the player... third person to first person... line is on an angle a little to the right or left... L to switch off-center... character to the side, scroll in, make sure reload works, see visible gun"

> "abstraction that makes it so you can add the ability for all objects to actually be physical — jump on hood, jump on roof, feet be on the roof, applies to all future objects"

> "wires you can wire your computers together, radios, telecommunications, speakers, CDs, USBs"

> "computer could actually run like a browser inside the browser game... big 50 foot, 1000 foot screens inside the game, switch to mouse mode"

> "make a list of every object file that i should get according to abstractifyThis.pdf and conviction.pdf"

> "scroll wheel zoom should make you be able to go all the way to first person where you can not see the character anymore"

> "everything I'm saying make sure you add it to what you need to implement and look above to"

> "you should have known that the computer doesn't actually open up because you're supposed to have tests, right... figure out what you would have to do for the tests to actually verify without having a visual"

> "a and d are reversed but s and w are correct, make the legs actually move when you walk, make a way to right click hold to aim your gun, and then your camera should zoom in a little bit, and make it so that when you click E to like get to the computer make it so it like zooms in..."

> "make it so that E, once you're in the computer, it automatically frees up your mouse. And also that once you're in the computer, that it doesn't use E to close the computer and it uses like, it uses just like the mouse or like a different button. Because when you get in the computer and you want to type E while you're in the computer just like closes the computer and you can never type E while you're in the computer"

> "Fix the wires, CDs, speakers. You know, all that stuff. Just keep fixing shit keep doing everything you should have started on devices and wires without asking me loop infinitely and keep bashing so that you keep going"

---

## How to add to this list
Drop new requests under **🎯 Next session** or **🧩 verbatim** as they come in. Strike through with `~~~` when done. Move to **✅ Done** when shipped + committed.
