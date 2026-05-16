// test_iter_24.js — custom OBJ/GLB upload + auto-AABB hitbox.
const Co = require("./custom_objects.js");
const Reg = require("./registry.js");
const Entity = require("./entity.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. detectFormat
ok(Co.detectFormat("car.obj")  === "obj",  "obj detected");
ok(Co.detectFormat("ship.glb") === "glb",  "glb detected");
ok(Co.detectFormat("tree.gltf") === "gltf", "gltf detected");
ok(Co.detectFormat("README.md") === null,   "md rejected");
ok(Co.detectFormat(null) === null,           "null filename rejected");

// 2. aabbFromVertices
const verts = [
  -1, -2, -3,   // x range: -1..4, y: -2..5, z: -3..6
   4,  5,  6,
   2,  3,  0,
];
const aabb = Co.aabbFromVertices(verts);
ok(aabb.min.x === -1 && aabb.max.x === 4, "x extents");
ok(aabb.min.y === -2 && aabb.max.y === 5, "y extents");
ok(aabb.min.z === -3 && aabb.max.z === 6, "z extents");
ok(aabb.hitbox.w === 5 && aabb.hitbox.h === 7 && aabb.hitbox.d === 9, "hitbox dims");
ok(aabb.center.x === 1.5, `center x = 1.5 (got ${aabb.center.x})`);

// Bad input
ok(Co.aabbFromVertices([]) === null, "empty array rejected");
ok(Co.aabbFromVertices([1, 2]) === null, "non-multiple-of-3 rejected");

// 3. parseObjVertices
const objText = `# a tiny triangle
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
vn 0 0 1
`;
const objVerts = Co.parseObjVertices(objText);
ok(objVerts.length === 9, `parsed 9 floats (3 vertices), got ${objVerts.length}`);
ok(objVerts[3] === 1 && objVerts[7] === 1, "second vertex correct");

// Empty text → empty array (not null since String is valid)
const empty = Co.parseObjVertices("");
ok(empty.length === 0, "empty text → no vertices");

// 4. processUpload — full path with OBJ content
const uploadOk = Co.processUpload({
  filename: "tri.obj",
  content: objText,
});
ok(uploadOk.ok === true, "OBJ upload ok");
ok(uploadOk.format === "obj", "format = obj");
ok(uploadOk.vertexCount === 3, "3 vertices");
ok(uploadOk.aabb.hitbox.w === 1, "AABB w=1 from triangle");

// 5. processUpload — GLB with pre-extracted vertices (browser supplies them)
const glbUpload = Co.processUpload({
  filename: "model.glb",
  vertices: [-2, 0, -2,  2, 4, 2,  0, 0, 0],
});
ok(glbUpload.ok === true, "GLB upload ok with pre-extracted vertices");
ok(glbUpload.format === "glb", "format = glb");
ok(glbUpload.aabb.hitbox.w === 4, "GLB AABB w=4");

// 6. processUpload — failure paths
ok(Co.processUpload({ filename: "x.png" }).ok === false, "png rejected");
ok(Co.processUpload({ filename: "empty.obj", content: "" }).ok === false, "empty obj rejected");

// 7. registerAsCustomEntity — adds a new TYPE in the registry. Spawning
//    that type produces an entity whose hitbox came from the upload.
const registry = Reg.createRegistry();
const reg1 = Co.registerAsCustomEntity(registry, "spaceship", uploadOk, { source: "user_upload" });
ok(reg1.ok === true, "registered spaceship type");
ok(registry.getType("spaceship") !== null, "spaceship in registry");

// Build an instance
const ship = registry.getType("spaceship").build({ position: { u: 5, v: 5, y: 0 } });
ok(ship.$header.$type === "spaceship", "instance type = spaceship");
ok(ship.hitbox.w === 1, "instance hitbox came from upload");
ok(ship.position.u === 5, "spawn position honored");
ok(ship.custom_mesh.format === "obj", "custom_mesh facet preserved");

// 8. Re-register same name fails
const reg2 = Co.registerAsCustomEntity(registry, "spaceship", uploadOk);
ok(reg2.ok === false && reg2.reason === "type_exists", "duplicate type rejected");

// 9. Bad upload won't register
const badReg = Co.registerAsCustomEntity(registry, "broken", { ok: false, reason: "no_vertices" });
ok(badReg.ok === false, "failed upload doesn't register");

// 10. Multiple custom types live side by side
Co.registerAsCustomEntity(registry, "tree", glbUpload);
ok(registry.typeNames().includes("spaceship") && registry.typeNames().includes("tree"),
   "multiple custom types coexist");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
