// Lazily loads and wires bloom post-processing via dynamic imports.
// onReady(composer) is called when all modules resolve; composer stays null until then.
export function mountPostProcessing({ THREE, renderer, scene, camera, onReady }) {
  Promise.all([
    import("three/addons/postprocessing/EffectComposer.js"),
    import("three/addons/postprocessing/RenderPass.js"),
    import("three/addons/postprocessing/UnrealBloomPass.js"),
  ]).then(([compMod, renderMod, bloomMod]) => {
    const { EffectComposer }  = compMod;
    const { RenderPass }      = renderMod;
    const { UnrealBloomPass } = bloomMod;
    const composer = new EffectComposer(renderer);
    // Match RT color space to renderer output so Three.js reuses shader variants
    // instead of recompiling. Mismatched spaces cause refreshUniformsCommon to crash
    // when the new variant's uniform map is empty (uniforms.opacity === undefined).
    composer.renderTarget1.texture.colorSpace = THREE.SRGBColorSpace;
    composer.renderTarget2.texture.colorSpace = THREE.SRGBColorSpace;
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.55,  // strength
      0.40,  // radius
      0.82   // threshold — only bright surfaces bloom
    );
    composer.addPass(bloom);
    window._bloomPass = bloom;
    onReady(composer);
    console.log("[5DEngine] bloom post-processing active");
  }).catch((e) => {
    console.warn("Bloom post-processing unavailable:", e.message);
  });
}
