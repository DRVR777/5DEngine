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

`.glb` is best (single binary file, embedded textures). Plain `.gltf`
also works but expects separate `.bin` + texture files next to it.
For rigged characters use `.fbx` only if you also drop a converter.

See `ASSET_LIST.md` at the repo root for source recommendations and a
full shopping list of what to grab per `abstractifyThis.pdf` +
`conviction.pdf`.
