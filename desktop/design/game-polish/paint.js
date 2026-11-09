  // Design preview: original simulation, new data-driven pixel painting.
  // Render at a fixed logical resolution, then scale with nearest neighbours.
  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width = 640;
  pixelCanvas.height = 280;
  const ink = pixelCanvas.getContext('2d');
  ink.imageSmoothingEnabled = false;
  const scene = t.scene, L = 640, V = 280, floor = ground * 2 / 3;
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const rect = (x, y, w, h, color) => {
    ink.fillStyle = color;
    ink.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  };
  const circle = (x, y, radius, color) => {
    for (let j = -radius; j <= radius; j += 2) {
      const w = Math.floor(Math.sqrt(Math.max(0, radius * radius - j * j)) / 2) * 2;
      rect(x - w, y + j, w * 2, 2, color);
    }
  };
  const panel = (x, y, w, h, color) => {
    rect(x + 4, y, w - 8, h, color);
    rect(x, y + 4, w, h - 8, color);
    rect(x + 2, y + 2, w - 4, h - 4, color);
  };
  function sky() {
    const gradient = ink.createLinearGradient(0, 0, 0, floor);
    scene.sky.forEach((color, i) => gradient.addColorStop(scene.sky.length === 1 ? 0 : i / (scene.sky.length - 1), color));
    ink.fillStyle = gradient;
    ink.fillRect(0, 0, L, V);
    for (let i = 0; i < scene.stars.count; i++) {
      const x = Math.floor(hash(i + 2) * L), y = Math.floor(hash(i + 67) * floor * .64);
      ink.globalAlpha = .35 + .65 * Math.pow((Math.sin(s.time * 1.2 + i) + 1) / 2, 2);
      rect(x, y, 1, 1, scene.stars.color);
      if (i % 13 === 0) { rect(x - 2, y, 5, 1, scene.stars.color); rect(x, y - 2, 1, 5, scene.stars.color); }
    }
    ink.globalAlpha = 1;
    const moon = scene.celestial, x = L * moon.x, y = V * moon.y;
    ink.globalAlpha = .05;
    circle(x, y, moon.radius + 11, moon.color);
    ink.globalAlpha = .1;
    circle(x, y, moon.radius + 5, moon.color);
    ink.globalAlpha = 1;
    if (moon.radius > 0) circle(x, y, moon.radius, moon.color);
    if (moon.kind === 'moon') {
      ink.globalAlpha = .16;
      rect(x - 9, y - 7, 6, 4, scene.hud.surface);
      rect(x + 5, y + 5, 4, 3, scene.hud.surface);
      rect(x - 3, y + 10, 3, 2, scene.hud.surface);
      ink.globalAlpha = 1;
    } else if (moon.rays) {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + Math.sin(s.time * .2) * .08;
        const r = moon.radius + 7 + Math.sin(s.time + i) * 1.5;
        rect(x + Math.cos(a) * r - 1, y + Math.sin(a) * r - 1, 2, 2, moon.color);
      }
    }
    const clouds = scene.clouds;
    for (let i = 0; i < clouds.count; i++) {
      const x = (hash(i + 29) * (L + 160) - s.time * clouds.speed + L * 4) % (L + 160) - 80;
      const y = 23 + hash(i + 12) * 66, z = .65 + hash(i + 80) * .8;
      ink.globalAlpha = .64;
      const cloud = (dx, dy, w, h, col) => rect(x + dx * z, y + dy * z, w * z, h * z, col);
      cloud(0, 8, 62, 6, clouds.shade);
      cloud(7, 4, 48, 7, clouds.color);
      cloud(16, 0, 26, 6, clouds.color);
      cloud(32, 3, 16, 5, clouds.color);
      cloud(-6, 9, 12, 3, clouds.color);
      ink.globalAlpha = 1;
    }
    for (let i = 0; i < scene.birds.count; i++) {
      const x = (L + i * 83 - s.time * 13) % L, y = 51 + i * 13 + Math.sin(s.time * 1.4 + i) * 3;
      const wing = Math.sin(s.time * 6 + i) > 0 ? -2 : 1;
      rect(x, y, 2, 1, scene.birds.color);
      rect(x - 2, y + wing, 2, 1, scene.birds.color);
      rect(x + 2, y + wing, 2, 1, scene.birds.color);
    }
  }
  function mountain(x, layer) {
    const peaks = [0, 27, 3, -27, 11, -8, -43, -15, 20, -5, -34, 2, 24];
    const u = ((x + s.distance * layer.speed * 2 / 3) % (peaks.length * 58) + peaks.length * 58) % (peaks.length * 58);
    const i = Math.floor(u / 58), q = u / 58 - i;
    return { y: V * layer.height + peaks[i] * (1 - q) + peaks[(i + 1) % peaks.length] * q, slope: peaks[(i + 1) % peaks.length] - peaks[i], q };
  }
  function mountains(layer) {
    for (let x = 0; x < L; x += 2) {
      const ridge = mountain(x, layer), y = Math.floor(ridge.y / 2) * 2;
      rect(x, y, 2, floor - y, ridge.slope > 0 ? layer.colors[0] : layer.colors[2]);
      // Pixel-cut ridgelines, broken highlights and scree, no smooth triangles.
      if (ridge.slope > 0) {
        rect(x, y, 2, 2 + Math.floor(hash(Math.floor(x / 8) + layer.seed) * 3) * 2, layer.colors[1]);
        if (hash(x + layer.seed) > .87) rect(x, y + 8 + hash(x) * 8, 2, 2, layer.colors[1]);
      }
      if (hash(x + layer.seed) > .87) rect(x, y + 24 + hash(x + 99) * 30, 2, 3, layer.colors[2]);
    }
  }
  function hills(layer) {
    for (let x = 0; x < L; x += 2) {
      const u = x + s.distance * layer.speed * 2 / 3;
      const y = Math.floor((V * layer.height + Math.sin(u / 105) * 15 + Math.sin(u / 44 + 2) * 7) / 2) * 2;
      rect(x, y, 2, floor - y, layer.colors[0]);
      rect(x, y, 2, 3, layer.colors[1]);
      if (hash(Math.floor(u / 4)) > .6) rect(x, y + 8, 2, 1, layer.colors[2]);
      const y2 = y + 24 + Math.sin(u / 37) * 4;
      rect(x, y2, 2, floor - y2, layer.colors[2]);
    }
  }
  function pine(x, bottom, h, layer, seed) {
    rect(x - 2, bottom - h * .6, 4, h * .6, layer.trunk ?? scene.ground.soil[0]);
    for (let k = 0; k < 4; k++) {
      const start = bottom - h + k * h * .19, rows = h * .36;
      for (let y = 0; y < rows; y += 2) {
        const width = Math.floor((y / rows * h * (.25 + k * .025) + 1) / 2) * 2;
        rect(x - width, start + y, width * 2, 2, layer.colors[0]);
        rect(x - width, start + y, width + 1, 2, layer.colors[1]);
        if (y > 5 && Math.floor(y / 4 + seed) % 3 === 0)
          rect(x - width + 2, start + y, width * .7, 2, layer.colors[2]);
      }
    }
  }
  function forest(layer) {
    for (let i = 0; i < 18; i++) {
      const span = 930, x = ((i * 57 + hash(i + layer.seed) * 20 - s.distance * layer.speed * 2 / 3) % span + span) % span - 90;
      const bottom = floor - 8 + hash(i + 4) * 4, h = 40 + hash(i + layer.seed) * 46;
      pine(x, bottom, h, layer, i);
    }
  }
  function meadow(layer) {
    for (let x = 0; x < L; x += 2) {
      const u = x + s.distance * layer.speed * 2 / 3;
      const y = floor - 6 - Math.sin(u / 73) * 5 - Math.sin(u / 27) * 2;
      rect(x, y, 2, floor - y + 1, layer.colors[0]);
      if (hash(Math.floor(u / 5)) > .63) rect(x, y, 2, 2, layer.colors[1]);
    }
  }
  function groundArt() {
    const g = scene.ground;
    rect(0, floor, L, V - floor, g.soil[0]);
    rect(0, floor, L, 3, g.grass[2]);
    rect(0, floor + 3, L, 5, g.grass[0]);
    rect(0, floor + 9, L, 3, g.soil[1]);
    for (let i = 0; i < 48; i++) {
      const x = ((i * 29 - s.distance * 2 / 3) % (L + 60) + L * 100) % (L + 60) - 30;
      const drop = 2 + Math.floor(hash(i + 72) * 4);
      rect(x, floor + 6, 5 + hash(i) * 8, drop, g.grass[0]);
      if (i % 3 === 0) {
        rect(x + 4, floor + 10, 1, 5 + hash(i) * 5, g.soil[2]);
        rect(x + 3, floor + 16, 4, 1, g.soil[2]);
      }
    }
    for (let i = 0; i < 125; i++) {
      const x = ((i * 17 - s.distance * 2 / 3) % (L + 20) + L * 100) % (L + 20) - 10;
      const y = floor + 13 + hash(i + 81) * (V - floor - 15);
      rect(x, y, 2 + hash(i) * 4, 1 + hash(i + 3) * 2, g.soil[i % 3]);
      if (i % 5 === 0) rect(x + 2, y + 3, 5, 1, g.soil[1]);
      if (i % 4 === 0) rect(x, floor + 6, 3, 2 + hash(i) * 4, g.grass[0]);
    }
    for (let i = 0; i < 48; i++) {
      const x = ((i * 23 - s.distance * 2 / 3) % (L + 50) + L * 100) % (L + 50) - 25;
      const y = floor - 1, sway = Math.round(Math.sin(s.time * 2.2 + i) * 1.5);
      rect(x, y - 4, 1, 5, g.grass[1]);
      rect(x + sway - 2, y - 6, 1, 3, g.grass[2]);
      rect(x + 2, y - 3, 1, 3, g.grass[1]);
      if (i % 6 === 0) {
        rect(x + 5, y - 6, 1, 6, g.grass[0]);
        rect(x + 3, y - 8, 5, 2, g.flowers[i % 2]);
        rect(x + 5, y - 10, 1, 6, g.flowers[i % 2]);
        rect(x + 5, y - 8, 1, 1, g.grass[2]);
      } else if (i % 8 === 0) {
        rect(x - 4, y - 3, 7, 3, g.rock);
        rect(x - 2, y - 4, 3, 1, g.soil[2]);
      }
    }
  }
  function pixels(rows, x, y, scale) {
    const z = scale * 2 / 3;
    for (let yy = 0; yy < rows.length; yy++) for (let xx = 0; xx < rows[yy].length; xx++) {
      const color = t.spritePalette[rows[yy][xx]];
      if (color) rect(x + xx * z, y + yy * z, z, z, color);
    }
  }
  function ambience() {
    const a = scene.ambience;
    for (let i = 0; i < a.count; i++) {
      const x = (hash(i + 74) * L - s.time * (a.kind === 'leaves' ? 9 : 1) + L * 10) % L;
      const y = floor - 12 - hash(i + 53) * 55 + Math.sin(s.time * 1.3 + i) * 5;
      ink.globalAlpha = a.kind === 'fireflies' ? .2 + .8 * Math.pow((Math.sin(s.time * 1.7 + i) + 1) / 2, 2) : .7;
      rect(x, y, 2, 1, a.color);
      if (a.kind === 'fireflies') { ink.globalAlpha *= .2; rect(x - 2, y - 2, 6, 5, a.color); }
    }
    ink.globalAlpha = 1;
    const w = t.weather;
    for (let i = 0; i < w.intensity && w.kind !== 'none'; i++) {
      const x = (i * 97 + s.time * w.speed * .3) % L, y = (i * 41 + s.time * w.speed) % floor;
      rect(x, y, w.kind === 'rain' ? 1 : 2, w.kind === 'rain' ? 7 : 2, w.color);
    }
  }
  let wasAirborne = false, landingAt = -10, wasOver = false, hitAt = -10;
  function feedback(now) {
    if (wasAirborne && s.y === 0) landingAt = now;
    wasAirborne = s.y > 0;
    if (s.over && !wasOver) hitAt = now;
    wasOver = s.over;
    const age = now - landingAt;
    if (age < .35) for (let i = 0; i < 7; i++) {
      ink.globalAlpha = Math.max(0, .7 * (1 - age / .35));
      rect(px * 2 / 3 + 14 + (i - 3) * age * 22, floor - age * 20 - hash(i) * 3, 2 + (1 - age) * 2, 2, scene.effects.dust);
    }
    ink.globalAlpha = 1;
  }
  function hud() {
    const h = scene.hud;
    ink.globalAlpha = .88;
    panel(14, 13, 178, 28, h.surface);
    panel(L - 133, 13, 119, 28, h.surface);
    ink.globalAlpha = 1;
    ink.font = 'bold 12px monospace';
    ink.fillStyle = h.text;
    ink.fillText(t.title, 25, 31);
    ink.font = '8px monospace';
    ink.fillStyle = h.muted;
    ink.fillText(t.scoreLabel, L - 122, 24);
    ink.fillText('BEST ' + best, L - 122, 35);
    ink.font = 'bold 14px monospace';
    ink.fillStyle = h.text;
    ink.fillText(String(s.score).padStart(4, '0'), L - 60, 32);
  }
  function endCard(now) {
    if (!paused && !s.over) return;
    if (s.over && now - hitAt < .25) return;
    const h = scene.hud, x = 209, y = 77, width = 222, height = 121;
    ink.globalAlpha = .25;
    rect(0, 0, L, V, h.surface);
    ink.globalAlpha = .25;
    panel(x + 3, y + 5, width, height, h.surface);
    ink.globalAlpha = 1;
    panel(x, y, width, height, h.surface);
    ink.textAlign = 'center';
    ink.font = 'bold 8px monospace';
    ink.fillStyle = h.accent;
    ink.fillText(s.over ? h.overLabel : t.title.toUpperCase(), L / 2, y + 20);
    ink.font = 'bold 20px monospace';
    ink.fillStyle = h.text;
    ink.fillText(s.over ? h.overTitle : h.readyTitle, L / 2, y + 48);
    ink.font = '10px monospace';
    ink.fillStyle = h.muted;
    ink.fillText(t.scoreLabel + ' ' + s.score + '   ·   BEST ' + best, L / 2, y + 68);
    panel(x + 39, y + 83, width - 78, 23, h.accent);
    ink.fillStyle = h.surface;
    ink.font = 'bold 8px monospace';
    ink.fillText(h.restartLabel, L / 2, y + 98);
    ink.textAlign = 'left';
  }
  function render() {
    const now = performance.now() / 1000;
    sky();
    for (const layer of scene.layers) {
      if (layer.kind === 'mountains') mountains(layer);
      if (layer.kind === 'hills') hills(layer);
      if (layer.kind === 'forest') forest(layer);
      if (layer.kind === 'meadow') meadow(layer);
    }
    groundArt();
    for (const o of s.obstacles) {
      const f = o.sprite.frames[Math.floor(s.time * 9) % o.sprite.frames.length];
      pixels(f, o.x * 2 / 3, ((o.sprite.flying ? ground - 33 : ground) - o.height) * 2 / 3, o.sprite.scale);
    }
    const player = playerSize();
    pixels(player.a, px * 2 / 3, (ground - s.y - player.h) * 2 / 3, t.player.scale);
    ambience();
    feedback(now);
    if (s.over && now - hitAt < .16) {
      ink.globalAlpha = .28 * (1 - (now - hitAt) / .16);
      rect(0, 0, L, V, scene.effects.flash);
      ink.globalAlpha = 1;
    }
    hud();
    endCard(now);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(pixelCanvas, 0, 0, W, H);
  }
