const SPK_ATTN_DIST  = 30;  // max spatial attenuation distance for spk1
const SPK_VOL_DEFAULT = 0.4;
const BROADCAST_INTERVAL_MS = 500;

export function mountDeviceBusTick({ actions }) {
  function tick(_dt, { nowMs, lastMs, score, pickupCount }) {
    const bus = actions.getDeviceBus();
    if (!bus) return;

    // PC video broadcast every 500ms — feeds mon1's video_in channel
    if (Math.floor(nowMs / BROADCAST_INTERVAL_MS) !== Math.floor(lastMs / BROADCAST_INTERVAL_MS)) {
      const hp = actions.getHeroPos();
      bus.send("pc1", "video_out", { kind: "video", payload: { frame:
        "DWRLD OS v0.1\n" +
        "uptime: " + (nowMs / 1000).toFixed(0) + "s\n" +
        "score:  " + score + " / " + pickupCount + "\n" +
        "pos:    " + hp.u.toFixed(1) + ", " + hp.v.toFixed(1) + "\n" +
        "spk:    " + (bus.peek("spk1", "audio_in").length) + " queued\n" +
        "radioB heard: " + (bus.peek("radioB", "rf").length) + " msgs"
      } });
    }

    // Drain spk1's audio_in inbox — play each packet with spatial attenuation
    if (actions.hasAudioMixer()) {
      const pkts = bus.drain("spk1", "audio_in");
      for (const p of pkts) {
        if (p && p.payload && p.payload.src) {
          const sp = bus.getDevice("spk1");
          let vol = p.payload.volume != null ? p.payload.volume : SPK_VOL_DEFAULT;
          if (sp && sp.position) {
            const hp = actions.getHeroPos();
            const d = Math.hypot(sp.position.u - hp.u, sp.position.v - hp.v);
            vol *= Math.max(0, 1 - d / SPK_ATTN_DIST);
          }
          actions.playSfx(p.payload.src, vol);
        }
      }
    }

    actions.pollMon1Bridge();
  }

  return { tick };
}
