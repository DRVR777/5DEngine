/** day_night — 13 keyframes exactly from legacy DayNight cycle. hour→sky/fog/ambI/sunI/sunColor */
export default {
  priority: 8,
  tick(_t, data, dt, _r) {
    if (!data._init) { data._init = true; data.hour = 8.0; data.speed = 1.0; data.paused = false;
      data.keyframes = [
        [ 0, 0x020818, 0x030c1e, 0.05, 0.0,  0x102040 ],
        [ 4, 0x040c22, 0x050e28, 0.06, 0.0,  0x1a2a50 ],
        [ 5, 0x1a2040, 0x202848, 0.15, 0.05, 0x4060a0 ],
        [ 6, 0xf4a147, 0xe8956c, 0.30, 0.4,  0xff9955 ],
        [ 7, 0x87b8e8, 0xa0c4e4, 0.50, 0.7,  0xffeedd ],
        [ 9, 0x87ceeb, 0xaad4f0, 0.60, 1.0,  0xffffff ],
        [12, 0x6ab4e8, 0x88c8f0, 0.65, 1.2,  0xfff9f0 ],
        [15, 0x78bce8, 0x90caf0, 0.60, 1.0,  0xffeedd ],
        [17, 0xe87848, 0xe8946a, 0.40, 0.6,  0xff6600 ],
        [18, 0xb04020, 0xb05030, 0.25, 0.2,  0xff4400 ],
        [19, 0x301828, 0x280e1a, 0.12, 0.0,  0x301828 ],
        [21, 0x060c1c, 0x050a18, 0.07, 0.0,  0x101838 ],
        [24, 0x020818, 0x030c1e, 0.05, 0.0,  0x102040 ],
      ];
    }
    if (data.paused) return;
    data.hour = ((data.hour + (data.speed / 60) * dt) % 24 + 24) % 24;
  }
};
