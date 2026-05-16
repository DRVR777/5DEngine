# 5DEngine — Implementation Queue

Running list of everything the user has asked for, plus architectural pieces from `abstractifyThis.pdf` (Dreamworld plan) + `conviction.pdf` (Dreamworld PRD). Items get crossed off as they ship. Add to this file when new asks come in; never rely on memory.

---

## ✅ Done this session
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

## 🔥 In-flight (this session, before next commit)
- [ ] Stackable platforms abstraction — jump on hood, then on roof, then on any future object
- [ ] Real interaction test — simulates keypresses + clicks via jsdom-style sandbox, catches "computer opens but is empty"-type bugs without you having to test by hand
- [ ] Honest integration audit — which of the 130+ iter modules are actually wired into `index.html` vs sitting orphan

## 🎯 Next session (queued)
- [ ] **`devices.js` + `wires.js`** — generic device-graph: typed ports, cable-type matching. Foundation for: computers, monitors, wires, speakers, radios, antennas, CD drives, USB sticks, walkie-talkies. (Maps onto Dreamworld PRD §6.3 Wire System.)
- [ ] **`screen_mesh.js`** — any 3D surface can be a `screen_surface`. Press E → enter "mouse-mode" on that surface, raycast UV → DOM hit-test, click anything. Big-screen TVs, projector walls, etc. (Maps onto conviction.pdf §6.1.)
- [ ] **Camera spine — 4 named zones** per conviction.pdf §5.1:
  - INSIDE (0–12%): camera at character center, fades transparent
  - FIRST_PERSON (12–30%): just outside surface, FPS view
  - THIRD_PERSON (30–60%): orbitable, wall-collision raycast
  - BIRD_VIEW (60–100%): far back, flying mode activates
- [ ] **Storage media** (CD / USB) as inventory items — slot into a device's port → virtual filesystem visible
- [ ] **Radio frequency pairing** — two radio devices on the same freq + within range = virtual wire (passes audio/data)
- [ ] **GLTFLoader integration** + `assets/` dir — replace placeholder block meshes with the `.glb` files from `ASSET_LIST.md`
- [ ] **In-world screens** that anyone can wire to a computer (extra-large meshes the user mentioned: 50ft, 1000ft)

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

---

## How to add to this list
Drop new requests under **🎯 Next session** or **🧩 verbatim** as they come in. Strike through with `~~~` when done. Move to **✅ Done** when shipped + committed.
