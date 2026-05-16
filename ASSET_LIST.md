# 5DEngine — Asset List

Source priority for everything: **`.glb`** (one file with mesh + textures + animations + materials).
Fall back to `.fbx` for rigged characters, `.obj`+`.mtl` for static props if no glb exists.

Recommended free CC0 sources: **kenney.nl**, **quaternius.com**, **polypizza.com**, **sketchfab.com** (filter Downloadable + CC0), **mixamo.com** (rigged character anims).

Pulled from `abstractifyThis.pdf` (Dreamworld implementation plan) + `conviction.pdf` (Dreamworld PRD). Items are grouped so you can buy/download a whole category-pack at once.

---

## 1. Player character (must-have, rig with animations)
| Asset | Format | Notes |
|---|---|---|
| Humanoid base mesh | `.glb` rigged | Low-poly, ~1500–5000 tris. Quaternius "Ultimate Animated Character Pack" or Mixamo's Y-Bot |
| Walk / Run / Idle / Jump anims | embedded in `.glb` or separate `.fbx` | Mixamo exports these for free |
| Sit / Wave / Dance / Salute emotes | embedded | Mixamo "social" pack |
| Drive-pose | embedded | One pose for in-car |
| Swim / Climb anims | embedded | For diving + parkour iters |
| Hair styles (separate meshes) | `.glb` | 4–5 variants (short / long / buzz / ponytail / bald) |
| Clothing layer meshes (head/torso/legs/feet) | `.glb` | One mesh per slot, rigged to the same skeleton |
| Tattoo decals | `.png` (RGBA, 512×512) | Decal projector — not a 3D mesh |

## 2. Weapons
| Asset | Format | Notes |
|---|---|---|
| Pistol | `.glb` | Already have a placeholder block-mesh; replace |
| Assault rifle (AK-47-style) | `.glb` | Kenney's weapon pack has this |
| Shotgun / SMG / sniper | `.glb` | One pack covers all of them |
| Sword (melee) | `.glb` | Static, no animation |
| Bow + arrow (iter 132 archery) | `.glb` rigged | Draw animation on the bow |
| Muzzle flash + bullet impact | sprite sheet `.png` or particle config | 2D billboard |

## 3. Vehicles
| Asset | Format | Notes |
|---|---|---|
| Civilian car (sedan) | `.glb` | Already have a block placeholder; replace |
| Truck / off-roader | `.glb` | Different physics tunings later |
| Plane (small cessna) | `.glb` | iter 18 already has flight physics — needs visual |
| Helicopter | `.glb` | Future |
| Motorcycle | `.glb` | Future |
| Boat | `.glb` | Pairs with `diving.js` shipwrecks |
| Drone (quadcopter) | `.glb` | iter 35-style, separate flight controls |
| Wheels (4 separate meshes per car) | inside the `.glb` | Needed so they can rotate independently |

## 4. Buildings + interior (House / Office)
| Asset | Format | Notes |
|---|---|---|
| Modular wall / floor / ceiling tiles | `.glb` | Build the house from snapping kit (Kenney "House Pack") |
| Window frames + glass | `.glb` | Transparent material |
| Door (hinge-rigged so it can swing) | `.glb` | Hinge constraint per Phase 2 Week 26 |
| Desk + chair + bookshelf | `.glb` | Office set |
| Bed / sofa / coffee table | `.glb` | Living room set |
| Lamp (with emissive material) | `.glb` | Casts a real light |
| Kitchen set (fridge / sink / cabinets) | `.glb` | For when farming + cooking get wired |

## 5. Computer / screens / wires (Dreamworld "any surface = screen")
| Asset | Format | Notes |
|---|---|---|
| Desktop tower | `.glb` | Several tiers visually (basic → power) |
| Monitor (with stand) | `.glb` | The screen face is a child mesh tagged `screen_surface` |
| Keyboard + mouse | `.glb` | Desk dressing |
| Wire / cable | spline mesh, runtime | Generated via Catmull-Rom spline between two ports — no asset needed; just a tube geometry |
| Speaker | `.glb` | Audio output device |
| CD (disc) | `.glb` | Storage media — pickable inventory item |
| USB stick | `.glb` | Storage media — pickable inventory item |
| Big-screen TV / projector screen | `.glb` (or runtime PlaneGeometry) | Wall-mounted, large-format `screen_surface` |
| Phone (handheld) | `.glb` | Small `screen_surface` per Dreamworld "Working Phones" expansion |

## 6. Radio + telecommunications
| Asset | Format | Notes |
|---|---|---|
| Handheld walkie-talkie | `.glb` | RF transmitter/receiver device |
| Radio tower / antenna | `.glb` | World-placed; extends RF range |
| Satellite dish | `.glb` | High-power transmitter |
| Infrared transmitter / receiver | `.glb` | Line-of-sight raycast device |

## 7. World props
| Asset | Format | Notes |
|---|---|---|
| Tree pack (oak, pine, palm) | `.glb` | Quaternius nature pack |
| Rock / boulder set | `.glb` | Different sizes |
| Grass / flower decals | `.png` billboards | GPU instanced |
| Streetlight | `.glb` | Emissive at night |
| Bench | `.glb` | Sittable trigger later |
| Trash can | `.glb` | Destructible (`destruction.js` material: thin metal) |
| Pickup truck / mailbox / sign | `.glb` | Dressing |
| Crops (wheat / carrot / pumpkin / rice — iter 120) | `.glb` per growth stage | 4 stages each |
| Sprinkler + water pipe | `.glb` | Farming infrastructure |

## 8. Portals + UI 3D
| Asset | Format | Notes |
|---|---|---|
| Portal mesh (glowing doorway) | `.glb` w/ emissive | Per `world_graph.js` |
| Map table / holographic display | `.glb` | The "constellation map" surface — emissive + PlaneGeometry above it |
| Bookshelf with individual book spines | `.glb` (one shelf + 30 spine variants) | Each spine = one knowledge node |

## 9. Skybox / world themes (per `physics_profile.js`)
| World theme | What to fetch | Notes |
|---|---|---|
| Floating cloud islands (flagship) | cloud texture + island GLBs | Per conviction.pdf §4.2 |
| Underwater | water shader + coral/wreck GLBs | Pairs with `diving.js` |
| Moon (low-gravity) | crater terrain mesh + lunar skybox | `physics_profile.js` already supports |
| Dreamworld (surreal) | abstract distorted props | Per `physics_profile.js` |
| Medieval / cyberpunk subgraph kits | full Kenney/Quaternius packs | Drop in entire kit per subgraph |

## 10. NPCs / robots / mounts
| Asset | Format | Notes |
|---|---|---|
| Civilian NPC variants (4–6) | `.glb` rigged | Reuse hero rig with different mesh |
| Robot guard | `.glb` rigged | For `crime_police.js` enforcers + Phase 3 robot guards |
| Horse / camel / pony (iter 126) | `.glb` rigged | Mount system needs the mesh, idle/walk/trot/canter/gallop anims |
| Dog / cat (iter 121 pets) | `.glb` rigged | Walk/sit/fetch anims |

## 11. Effects (these are configs, not files — but you'll want texture sources)
| Effect | What to fetch | Notes |
|---|---|---|
| Fire / smoke / sparks | particle textures (`.png` 256×256) | Used by `env_hazards.js` |
| Muzzle flash | sprite sheet `.png` | Per shot |
| Bullet tracer | white line — runtime mesh | No file |
| Water splash | sprite sheet `.png` | For diving |
| Lightning bolt | runtime billboard | `weather_damage.js` |

---

## Recommended starter shopping list (minimum to make the game *look like a game*)

1. **Quaternius "Ultimate Modular Character Pack"** (free, CC0) — covers asset #1 entirely
2. **Kenney "Car Kit"** + "Vehicle Pack" (free, CC0) — covers vehicles
3. **Kenney "Furniture Kit" + "Toon House"** — covers buildings + office furniture
4. **Quaternius "Nature Pack"** — trees, rocks, terrain dressing
5. **Mixamo** (free, Adobe account) — download walk/run/idle/jump/sit anims, retarget onto the Quaternius character
6. **Kenney "Weapon Kit"** — pistols / rifles
7. For radios, monitors, drones — search **Sketchfab** for "low poly drone CC0", "old monitor CC0", etc.

Drop everything into `5DEngine/assets/` then reference via `new GLTFLoader().load('./assets/X.glb', cb)`. I'll wire up the loader + asset registry as iter 130 (or whichever number you want it).
