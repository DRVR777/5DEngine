const EYE_H_STAND  = 1.78;
const EYE_H_TP     = 1.20;
const CROUCH_FP    = 0.75;
const CROUCH_TP    = 0.40;
const BOB_WALK_AMP = 0.014;
const BOB_RUN_AMP  = 0.028;
const BOB_AIM_SCALE = 0.15;
const AIM_DIST     = 18;
const SIDE_MAX     = 2.2;
const SIDE_FRAC    = 0.38;
const ROLL_SCALE   = 0.025;

export function mountCameraPosTick({ vectors, actions }) {
  function tick(_dt, { buildMode, firstPerson, heroPos, freeCamPos, freeCamYaw, freeCamPitch,
                       camYaw, camPitch, dist, crouchAmt, gunBobPhase,
                       aiming, canSprint, camSide, strafeRollAmt }) {
    const camera = actions.getCamera();
    const { camTarget, camOff, camLook, camAimTarget, camBuildLook } = vectors;

    // Eye height and camTarget in render space
    const eyeH = firstPerson
      ? EYE_H_STAND - crouchAmt * CROUCH_FP
      : EYE_H_TP    - crouchAmt * CROUCH_TP;
    camTarget.set(heroPos.x, heroPos.y + eyeH, heroPos.z);

    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const sx = Math.cos(camYaw), sz = -Math.sin(camYaw);

    if (buildMode) {
      camera.position.copy(freeCamPos);
      camBuildLook.set(
        freeCamPos.x + Math.sin(freeCamYaw) * Math.cos(freeCamPitch) * 10,
        freeCamPos.y + Math.sin(freeCamPitch) * 10,
        freeCamPos.z + Math.cos(freeCamYaw) * Math.cos(freeCamPitch) * 10
      );
      camera.lookAt(camBuildLook);
    } else if (firstPerson) {
      const bobScale = aiming ? BOB_AIM_SCALE : 1;
      const bobY = Math.sin(gunBobPhase) * (canSprint ? BOB_RUN_AMP : BOB_WALK_AMP) * bobScale;
      camera.position.set(heroPos.x, heroPos.y + (EYE_H_STAND - crouchAmt * CROUCH_FP) + bobY, heroPos.z);
      camLook.set(
        fx * Math.cos(camPitch),
        Math.sin(camPitch),
        fz * Math.cos(camPitch)
      ).multiplyScalar(10).add(camera.position);
      camera.lookAt(camLook);
      camera.rotateZ(-strafeRollAmt * ROLL_SCALE);
    } else {
      const sideAmt = Math.min(SIDE_MAX, dist * SIDE_FRAC) * camSide;
      camOff.set(
        -fx * Math.cos(camPitch) * dist + sx * sideAmt,
         Math.sin(-camPitch) * dist + 1.2,
        -fz * Math.cos(camPitch) * dist + sz * sideAmt
      );
      camera.position.copy(camTarget).add(camOff);
      camAimTarget.set(
        heroPos.x + fx * AIM_DIST * Math.cos(camPitch) + sx * sideAmt,
        heroPos.y + 1.2 + Math.sin(camPitch) * AIM_DIST,
        heroPos.z + fz * AIM_DIST * Math.cos(camPitch) + sz * sideAmt
      );
      camera.lookAt(camAimTarget);
    }
  }

  return { tick };
}
