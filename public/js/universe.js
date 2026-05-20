const STAR_BASE_RADIUS = 14;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class GalaxyRenderer {
  constructor(canvas, { onStarClick, onPlanetClick }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onStarClick = onStarClick;
    this.onPlanetClick = onPlanetClick;
    this.mode = "universe";
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.dragging = false;
    this.moved = false;
    this.lastPointer = { x: 0, y: 0 };
    this.stars = [];
    this.planets = [];
    this.selectedStar = null;
    this.planetScreenCache = new Map();
    this.thumbCache = new Map();
    this.initEvents();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame((t) => this.loop(t));
  }

  initEvents() {
    const begin = (x, y) => {
      this.dragging = true;
      this.moved = false;
      this.lastPointer = { x, y };
    };
    const move = (x, y) => {
      if (!this.dragging) return;
      const dx = x - this.lastPointer.x;
      const dy = y - this.lastPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.moved = true;
      this.camera.x -= dx / this.camera.zoom;
      this.camera.y -= dy / this.camera.zoom;
      this.lastPointer = { x, y };
      this.persistCamera();
    };
    const end = (x, y) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.moved) this.handleClick(x, y);
    };

    this.canvas.addEventListener("mousedown", (e) => begin(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
    window.addEventListener("mouseup", (e) => end(e.clientX, e.clientY));

    this.canvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) begin(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: true }
    );
    this.canvas.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: true }
    );
    window.addEventListener(
      "touchend",
      (e) => {
        const t = e.changedTouches?.[0];
        if (t) end(t.clientX, t.clientY);
      },
      { passive: true }
    );

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.08 : 0.92;
      const worldBefore = this.screenToWorld(e.clientX, e.clientY);
      this.camera.zoom = clamp(this.camera.zoom * delta, 0.15, 3.5);
      const worldAfter = this.screenToWorld(e.clientX, e.clientY);
      this.camera.x += worldBefore.x - worldAfter.x;
      this.camera.y += worldBefore.y - worldAfter.y;
      this.persistCamera();
    });
  }

  resize() {
    this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
    this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  setUniverse(stars) {
    this.mode = "universe";
    this.stars = stars || [];
    this.selectedStar = null;
    this.planets = [];
    this.planetScreenCache.clear();
    this.restoreCamera();
  }

  setSolar(star, planets) {
    this.mode = "solar";
    this.selectedStar = star;
    this.planets = (planets || []).map((p) => ({
      ...p,
      _phase: (this.hashCode(p.id) % 360) * (Math.PI / 180),
    }));
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.planetScreenCache.clear();
  }

  focusOnStar(star) {
    this.mode = "universe";
    this.camera.x = star.x_coord;
    this.camera.y = star.y_coord;
    this.camera.zoom = 1.8;
    this.persistCamera();
  }

  getSelectedStar() {
    return this.selectedStar;
  }

  updatePlanetStats(planetId, updates) {
    const p = this.planets.find((x) => x.id === planetId);
    if (p) Object.assign(p, updates);
  }

  worldToScreen(wx, wy) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return {
      x: (wx - this.camera.x) * this.camera.zoom + w / 2,
      y: (wy - this.camera.y) * this.camera.zoom + h / 2,
    };
  }

  screenToWorld(sx, sy) {
    const rect = this.canvas.getBoundingClientRect();
    const x = sx - rect.left;
    const y = sy - rect.top;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return {
      x: (x - w / 2) / this.camera.zoom + this.camera.x,
      y: (y - h / 2) / this.camera.zoom + this.camera.y,
    };
  }

  handleClick(clientX, clientY) {
    const world = this.screenToWorld(clientX, clientY);
    if (this.mode === "universe") {
      for (const star of this.stars) {
        const r = STAR_BASE_RADIUS + Math.min(star.planet_count || 0, 12);
        const d = Math.hypot(world.x - star.x_coord, world.y - star.y_coord);
        if (d <= r * 1.5) {
          this.onStarClick?.(star);
          return;
        }
      }
    } else if (this.mode === "solar") {
      for (const [planetId, cache] of this.planetScreenCache.entries()) {
        const d = Math.hypot(cache.x - (clientX - this.canvas.getBoundingClientRect().left), cache.y - (clientY - this.canvas.getBoundingClientRect().top));
        if (d <= cache.radius + 5) {
          const p = this.planets.find((planet) => planet.id === planetId);
          if (p) this.onPlanetClick?.(p);
          return;
        }
      }
    }
  }

  drawUniverse() {
    const ctx = this.ctx;
    for (const star of this.stars) {
      const s = this.worldToScreen(star.x_coord, star.y_coord);
      const radius = (STAR_BASE_RADIUS + Math.min(star.planet_count || 0, 15)) * this.camera.zoom * 0.65;
      ctx.beginPath();
      ctx.fillStyle = star.color || "#ffaa44";
      ctx.shadowColor = star.color || "#ffaa44";
      ctx.shadowBlur = 18;
      ctx.arc(s.x, s.y, clamp(radius, 5, 34), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#d9e7ff";
      ctx.font = "600 12px Inter";
      ctx.fillText(star.name, s.x + 10, s.y - 10);
      ctx.fillStyle = "#9fc2ff";
      ctx.fillText(`🪐 ${star.planet_count || 0}`, s.x + 10, s.y + 6);
    }
  }

  getPlanetThumb(url) {
    if (!url) return null;
    if (this.thumbCache.has(url)) return this.thumbCache.get(url);
    const img = new Image();
    img.src = url;
    this.thumbCache.set(url, img);
    return img;
  }

  drawSolar(timestamp) {
    const ctx = this.ctx;
    const center = this.worldToScreen(0, 0);
    this.planetScreenCache.clear();

    ctx.beginPath();
    ctx.fillStyle = this.selectedStar?.color || "#ffaa44";
    ctx.shadowColor = this.selectedStar?.color || "#ffaa44";
    ctx.shadowBlur = 25;
    ctx.arc(center.x, center.y, 28 * this.camera.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "700 16px Inter";
    ctx.fillText(this.selectedStar?.name || "Stella", center.x + 34, center.y + 5);

    for (const p of this.planets) {
      const orbit = p.orbit_radius || 120;
      const speed = p.orbit_speed || 0.00012;
      const angle = timestamp * speed + p._phase;
      const worldX = Math.cos(angle) * orbit;
      const worldY = Math.sin(angle) * orbit;
      const s = this.worldToScreen(worldX, worldY);
      const radius = clamp(10 * this.camera.zoom, 6, 18);

      ctx.beginPath();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "rgba(200,220,255,.22)";
      ctx.arc(center.x, center.y, orbit * this.camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.fillStyle = "#6cc3ff";
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.fill();

      const thumb = this.getPlanetThumb(p.thumbnail_url);
      if (thumb?.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(thumb, s.x - radius, s.y - radius, radius * 2, radius * 2);
        ctx.restore();
      }

      ctx.fillStyle = "#d9e7ff";
      ctx.font = "12px Inter";
      ctx.fillText(`${p.title}`, s.x + 12, s.y - 4);
      ctx.fillStyle = "#9fc2ff";
      ctx.fillText(`❤️ ${p.like_count || 0}   🌙 ${p.moon_count || 0}`, s.x + 12, s.y + 12);

      this.planetScreenCache.set(p.id, { x: s.x, y: s.y, radius });
    }
  }

  drawGrid() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const spacing = 120 * this.camera.zoom;
    if (spacing < 28) return;
    ctx.strokeStyle = "rgba(110,160,255,0.08)";
    ctx.lineWidth = 1;

    for (let x = ((w / 2 - (this.camera.x * this.camera.zoom)) % spacing); x < w; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = ((h / 2 - (this.camera.y * this.camera.zoom)) % spacing); y < h; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  loop(timestamp) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    this.drawGrid();
    if (this.mode === "universe") this.drawUniverse();
    else this.drawSolar(timestamp);
    requestAnimationFrame((t) => this.loop(t));
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  persistCamera() {
    if (this.mode !== "universe") return;
    localStorage.setItem("galaxy_camera", JSON.stringify(this.camera));
  }

  restoreCamera() {
    const raw = localStorage.getItem("galaxy_camera");
    if (!raw) return;
    try {
      const cam = JSON.parse(raw);
      this.camera = {
        x: Number(cam.x || 0),
        y: Number(cam.y || 0),
        zoom: clamp(Number(cam.zoom || 1), 0.15, 3.5),
      };
    } catch (_) {
      this.camera = { x: 0, y: 0, zoom: 1 };
    }
  }
}
