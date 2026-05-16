# `/assets/` — drop your `.glb` files here

The engine looks for assets via `manifest.json` (in this directory).
Each slot maps an in-game role (e.g. `pistol`, `car`, `hero`) to a `.glb`
path **relative to this folder**.

## How to add an asset

1. Download or export a `.glb` (preferred) or `.gltf` from
   [Kenney](https://kenney.nl/), [Quaternius](https://quaternius.com/),
   [PolyPizza](https://poly.pizza/), or your own modeling tool.
2. Drop it under the path the manifest expects, e.g.
   `assets/weapons/pistol.glb`.
3. Refresh the page. `gltf_loader.js` will try to load each manifest entry;
   if it succeeds it replaces the placeholder block mesh, otherwise it
   silently falls back to the existing primitive.

## Slot list

| Slot       | Default path                  | Mounted to        |
|------------|-------------------------------|-------------------|
| `pistol`   | `weapons/pistol.glb`          | hero's right arm  |
| `car`      | `vehicles/sedan.glb`          | car group         |
| `hero`     | `characters/hero.glb`         | hero group        |
| `tree`     | `props/tree_oak.glb`          | (decor)           |
| `lamp`     | `props/lamp_post.glb`         | (decor)           |
| `computer` | `props/computer.glb`          | computer pickup   |
| `monitor`  | `props/monitor.glb`           | mon1 mesh         |
| `speaker`  | `props/speaker.glb`           | spk1 mesh         |
| `radio`    | `props/walkie.glb`            | radioA / radioB   |
| `usb`      | `props/usb_stick.glb`         | usb1 mesh         |
| `cd`       | `props/cd.glb`                | (inventory icon)  |
| `coin`     | `props/coin.glb`              | pickup meshes     |
| `antenna`  | `props/antenna.glb`           | (future)          |

Sub-directories are by convention only — change `path` in
`manifest.json` if your layout differs.

## What format?

All three formats work — the loader dispatches by file extension:

| Ext     | Loader      | Notes                                            |
|---------|-------------|--------------------------------------------------|
| `.glb`  | GLTFLoader  | Best (single file, embedded textures, PBR, anim) — Kenney's default |
| `.gltf` | GLTFLoader  | Same loader; needs companion `.bin` + textures next to it |
| `.obj`  | OBJLoader   | Static geometry only. Drops a `.mtl` next to it if you want materials — Quaternius's default for static packs |
| `.fbx`  | FBXLoader   | Use for rigged characters with animations (Mixamo, some Quaternius character packs) — heavier than GLB but Mixamo's only export |

Just change the path in `manifest.json` to whatever extension you have.
**You don't need to convert anything.** Drop a `.obj` directly if that's
what Quaternius gave you.

**Scale hints:** FBX from Mixamo is usually in centimetres — set
`"scale": 0.01` for those. OBJ varies widely; tweak after you see the
in-game size.

See `ASSET_LIST.md` at the repo root for source recommendations and a
full shopping list of what to grab per `abstractifyThis.pdf` +
`conviction.pdf`.
