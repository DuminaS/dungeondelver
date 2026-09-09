import { Hex, Layout, eq, hexToPixel, key, neighbors, pixelToHex } from "../core/hex";
import { Encounter } from "../game/encounter";
import { Tile } from "../core/grid";
import { Unit } from "../game/types";

/* palette pulled from the CSS tokens so board == panels */
const C = {
  void: "#080605",
  open: "#2b211a",
  difficult: "#37281c",
  rubble: "#43362b",
  water: "#1e3a44",
  wall: "#0c0806",
  wallEdge: "#2a2018",
  chasm: "#030202",
  ink: "#ece0cd",
  inkFaint: "#6d5d4c",
  player: "#6ea6cc",
  playerLo: "#1f3038",
  enemy: "#c65a3a",
  enemyLo: "#3a2017",
  gold: "#d9a441",
  bad: "#b0413b",
  hazAcid: "#93a14f",
  hazFire: "#d5713a",
  hazSpikes: "#9a9384",
  hazGas: "#9276b6",
};
const HAZ_COLOR: Record<string, string> = {
  acid: C.hazAcid,
  fire: C.hazFire,
  spikes: C.hazSpikes,
  gas: C.hazGas,
};

export interface BoardCallbacks {
  onHexClick?: (h: Hex) => void;
  onHexHover?: (h: Hex | null) => void;
}

export class BoardView {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private enc: Encounter | null = null;
  private layout: Layout = { size: 24, originX: 0, originY: 0 };
  private dpr = Math.min(2, window.devicePixelRatio || 1);
  hover: Hex | null = null;

  reachable: Map<string, number> = new Map();
  attackable: Set<string> = new Set();
  threatened: Set<string> = new Set();
  pathPreview: Hex[] = [];
  deploy: Hex[] = [];

  cb: BoardCallbacks = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    canvas.addEventListener("pointermove", (e) => {
      const h = this.eventHex(e);
      if (!this.hover || !h || !eq(this.hover, h)) {
        this.hover = h;
        this.cb.onHexHover?.(h);
        this.draw();
      }
    });
    canvas.addEventListener("pointerleave", () => {
      this.hover = null;
      this.cb.onHexHover?.(null);
      this.draw();
    });
    canvas.addEventListener("pointerdown", (e) => {
      const h = this.eventHex(e);
      if (h) this.cb.onHexClick?.(h);
    });
  }

  setEncounter(enc: Encounter): void {
    this.enc = enc;
    this.fit();
  }

  private eventHex(e: PointerEvent): Hex | null {
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / this.dpr / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const h = pixelToHex(x, y, this.layout);
    return this.enc?.grid.has(h) ? h : null;
  }

  fit(): void {
    if (!this.enc) return;
    const tiles = this.enc.grid.all();
    const holder = this.canvas.parentElement!;
    const cssW = holder.clientWidth || 640;
    const pts = tiles.map((t) => hexToPixel({ q: t.q, r: t.r }, { size: 1, originX: 0, originY: 0 }));
    const minX = Math.min(...pts.map((p) => p.x)) - 1;
    const maxX = Math.max(...pts.map((p) => p.x)) + 1;
    const minY = Math.min(...pts.map((p) => p.y)) - Math.sqrt(3) / 2;
    const maxY = Math.max(...pts.map((p) => p.y)) + Math.sqrt(3) / 2;
    const size = Math.min(32, Math.max(15, (cssW - 8) / (maxX - minX)));
    const cssH = Math.ceil((maxY - minY) * size + 8);
    this.layout = { size, originX: -minX * size + 4, originY: -minY * size + 4 };
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
    this.canvas.style.height = `${cssH}px`;
    this.draw();
  }

  private hexPath(cx: number, cy: number, size: number): void {
    const c = this.ctx;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i);
      const x = cx + size * Math.cos(a);
      const y = cy + size * Math.sin(a);
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.closePath();
  }

  private corner(cx: number, cy: number, size: number, i: number): { x: number; y: number } {
    const a = (Math.PI / 180) * (60 * i);
    return { x: cx + size * Math.cos(a), y: cy + size * Math.sin(a) };
  }

  /** stroke only the outer edges of a set of hexes (current strokeStyle/lineWidth) */
  private strokeBoundary(set: Set<string>, L: Layout, size: number): void {
    const c = this.ctx;
    c.beginPath();
    for (const k of set) {
      const [q, r] = k.split(",").map(Number);
      const { x, y } = hexToPixel({ q, r }, L);
      neighbors({ q, r }).forEach((n, i) => {
        if (set.has(key(n))) return;
        const a = this.corner(x, y, size, (i + 4) % 6);
        const b = this.corner(x, y, size, (i + 5) % 6);
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
      });
    }
    c.stroke();
  }

  draw(): void {
    const enc = this.enc;
    const c = this.ctx;
    c.save();
    c.scale(this.dpr, this.dpr);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!enc) { c.restore(); return; }
    const L = this.layout;
    const s = L.size;

    for (const t of enc.grid.all()) {
      const { x, y } = hexToPixel({ q: t.q, r: t.r }, L);
      this.drawTile(t, x, y, s);
    }

    // threatened wash: fill + a soft boundary edge (player turn / deploy)
    if (this.threatened.size) {
      for (const k of this.threatened) {
        if (this.reachable.has(k)) continue; // don't double-tint your own move zone
        const [q, r] = k.split(",").map(Number);
        const { x, y } = hexToPixel({ q, r }, L);
        this.hexPath(x, y, s * 0.98);
        c.fillStyle = "rgba(198,90,58,0.15)";
        c.fill();
      }
      c.strokeStyle = "rgba(198,90,58,0.45)";
      c.lineWidth = 1;
      this.strokeBoundary(this.threatened, L, s);
    }

    // reachable "zone": fill carries it, a light boundary line frames it
    if (this.reachable.size) {
      for (const k of this.reachable.keys()) {
        const [q, r] = k.split(",").map(Number);
        const { x, y } = hexToPixel({ q, r }, L);
        this.hexPath(x, y, s * 0.96);
        c.fillStyle = "rgba(110,166,204,0.17)";
        c.fill();
      }
      c.strokeStyle = "rgba(120,178,214,0.55)";
      c.lineWidth = 1.25;
      this.strokeBoundary(new Set(this.reachable.keys()), L, s * 0.98);
    }

    // deploy zone
    for (const h of this.deploy) {
      const { x, y } = hexToPixel(h, L);
      this.hexPath(x, y, s * 0.9);
      c.setLineDash([4, 3]);
      c.strokeStyle = "rgba(134,167,88,0.95)";
      c.lineWidth = 2;
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = "rgba(134,167,88,0.08)";
      c.fill();
    }

    // path preview
    if (this.pathPreview.length > 1) {
      c.strokeStyle = "rgba(217,164,65,0.9)";
      c.lineWidth = 2;
      c.setLineDash([2, 4]);
      c.beginPath();
      this.pathPreview.forEach((h, i) => {
        const { x, y } = hexToPixel(h, L);
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      });
      c.stroke();
      c.setLineDash([]);
      const end = hexToPixel(this.pathPreview[this.pathPreview.length - 1], L);
      c.fillStyle = "rgba(217,164,65,0.9)";
      c.beginPath();
      c.arc(end.x, end.y, 3, 0, Math.PI * 2);
      c.fill();
    }

    // attackable enemies: crosshair corner ticks
    for (const k of this.attackable) {
      const u = enc.units.find((z) => z.alive && key(z.pos) === k);
      if (!u) continue;
      const { x, y } = hexToPixel(u.pos, L);
      c.strokeStyle = C.enemy;
      c.lineWidth = 2.5;
      const r = s * 0.82;
      for (let i = 0; i < 4; i++) {
        const ax = x + (i < 2 ? -r : r);
        const ay = y + (i % 2 === 0 ? -r : r);
        const dx = i < 2 ? 1 : -1;
        const dy = i % 2 === 0 ? 1 : -1;
        c.beginPath();
        c.moveTo(ax, ay + dy * s * 0.28);
        c.lineTo(ax, ay);
        c.lineTo(ax + dx * s * 0.28, ay);
        c.stroke();
      }
    }

    // enemy intent
    for (const u of enc.units) {
      if (u.team !== "enemy" || !u.alive || !u.intent) continue;
      const from = hexToPixel(u.pos, L);
      if (u.intent.kind === "attack" && u.intent.targetId) {
        const tgt = enc.units.find((z) => z.id === u.intent!.targetId);
        if (tgt) {
          const to = hexToPixel(tgt.pos, L);
          c.strokeStyle = "rgba(198,90,58,0.6)";
          c.setLineDash([5, 3]);
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(from.x, from.y);
          c.lineTo(to.x, to.y);
          c.stroke();
          c.setLineDash([]);
          // reticle on the target (thin ring + cross — distinct from player crosshair)
          c.strokeStyle = "rgba(198,90,58,0.85)";
          c.lineWidth = 1.25;
          c.beginPath();
          c.arc(to.x, to.y, s * 0.7, 0, Math.PI * 2);
          c.moveTo(to.x - s * 0.7, to.y);
          c.lineTo(to.x + s * 0.7, to.y);
          c.moveTo(to.x, to.y - s * 0.7);
          c.lineTo(to.x, to.y + s * 0.7);
          c.stroke();
        }
      } else if (u.intent.kind === "move" && u.intent.toHex) {
        const to = hexToPixel(u.intent.toHex, L);
        c.strokeStyle = "rgba(150,120,90,0.5)";
        c.setLineDash([2, 3]);
        c.beginPath();
        c.moveTo(from.x, from.y);
        c.lineTo(to.x, to.y);
        c.stroke();
        c.setLineDash([]);
      }
    }

    // hover
    if (this.hover) {
      const { x, y } = hexToPixel(this.hover, L);
      this.hexPath(x, y, s * 0.98);
      c.strokeStyle = "rgba(236,224,205,0.85)";
      c.lineWidth = 1.75;
      c.stroke();
    }

    for (const u of enc.units) {
      if (!u.alive && !u.downed) continue;
      this.drawUnit(u, L);
    }

    c.restore();
  }

  private drawTile(t: Tile, x: number, y: number, s: number): void {
    const c = this.ctx;
    this.hexPath(x, y, s * 0.97);
    let fill: string =
      t.terrain === "open" ? C.open :
      t.terrain === "difficult" ? C.difficult :
      t.terrain === "rubble" ? C.rubble :
      t.terrain === "water" ? C.water :
      t.terrain === "wall" ? C.wall : C.chasm;
    if (t.elevation > 0 && t.terrain !== "wall" && t.terrain !== "chasm") {
      fill = shade(fill, 10 + t.elevation * 11);
    }
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = "rgba(0,0,0,0.55)";
    c.lineWidth = 1;
    c.stroke();

    // elevation: top-edge highlight + tick
    if (t.elevation > 0 && t.terrain !== "wall" && t.terrain !== "chasm") {
      const a = this.corner(x, y, s * 0.97, 4);
      const b = this.corner(x, y, s * 0.97, 5);
      c.strokeStyle = `rgba(236,224,205,${0.06 + t.elevation * 0.05})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.fillStyle = `rgba(236,224,205,${0.18 + t.elevation * 0.12})`;
      c.font = `${Math.round(s * 0.34)}px ${"ui-monospace, monospace"}`;
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillText(t.elevation >= 2 ? "▲▲" : "▲", x - s * 0.5, y - s * 0.62);
    }
    if (t.terrain === "wall") {
      c.strokeStyle = "rgba(90,70,55,0.5)";
      c.lineWidth = 1;
      this.hexPath(x, y, s * 0.62);
      c.stroke();
    }

    if (t.hazard) {
      const col = HAZ_COLOR[t.hazard.kind] ?? C.hazGas;
      this.hexPath(x, y, s * 0.97);
      c.fillStyle = hexA(col, 0.2);
      c.fill();
      // soft glow
      const g = c.createRadialGradient(x, y, s * 0.1, x, y, s * 0.95);
      g.addColorStop(0, hexA(col, 0.28));
      g.addColorStop(1, hexA(col, 0));
      c.fillStyle = g;
      this.hexPath(x, y, s * 0.97);
      c.fill();
      this.drawHazardGlyph(t.hazard.kind, x, y, s, col);
    }

    if (t.feature === "extract") {
      c.strokeStyle = C.gold;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y + s * 0.4);
      c.lineTo(x, y - s * 0.42);
      c.moveTo(x - s * 0.26, y - s * 0.12);
      c.lineTo(x, y - s * 0.42);
      c.lineTo(x + s * 0.26, y - s * 0.12);
      c.moveTo(x - s * 0.34, y + s * 0.5);
      c.lineTo(x + s * 0.34, y + s * 0.5);
      c.stroke();
    }
  }

  private drawHazardGlyph(kind: string, x: number, y: number, s: number, col: string): void {
    const c = this.ctx;
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineWidth = Math.max(1.4, s * 0.06);
    c.lineCap = "round";
    const u = s * 0.24;
    if (kind === "acid") {
      for (const [dx, dy, r] of [[-0.5, 0.2, 0.7], [0.5, 0.35, 0.55], [0, -0.4, 0.6]]) {
        c.beginPath();
        c.arc(x + dx * u, y + dy * u, r * u, 0, Math.PI * 2);
        c.stroke();
      }
    } else if (kind === "spikes") {
      for (const dx of [-1, 0, 1]) {
        c.beginPath();
        c.moveTo(x + dx * u - u * 0.6, y + u);
        c.lineTo(x + dx * u, y - u);
        c.lineTo(x + dx * u + u * 0.6, y + u);
        c.stroke();
      }
    } else if (kind === "fire") {
      c.beginPath();
      c.moveTo(x, y - u * 1.3);
      c.quadraticCurveTo(x + u * 1.1, y - u * 0.1, x + u * 0.5, y + u);
      c.quadraticCurveTo(x, y + u * 1.3, x - u * 0.5, y + u);
      c.quadraticCurveTo(x - u * 1.1, y - u * 0.1, x, y - u * 1.3);
      c.stroke();
    } else {
      // gas: three drifting dots
      for (const [dx, dy] of [[-0.7, 0.4], [0.2, -0.2], [0.75, 0.6]]) {
        c.beginPath();
        c.arc(x + dx * u, y + dy * u, u * 0.32, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.lineCap = "butt";
  }

  private drawUnit(u: Unit, L: Layout): void {
    const c = this.ctx;
    const { x, y } = hexToPixel(u.pos, L);
    const s = L.size;
    const r = s * 0.6;
    const isActive = this.enc?.active?.id === u.id;
    const isPlayer = u.team === "player";

    if (isActive) {
      const g = c.createRadialGradient(x, y, r * 0.6, x, y, r * 1.9);
      g.addColorStop(0, "rgba(217,164,65,0.5)");
      g.addColorStop(1, "rgba(217,164,65,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r * 1.9, 0, Math.PI * 2);
      c.fill();
    }

    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = u.downed ? "#2a201a" : isPlayer ? C.playerLo : C.enemyLo;
    c.fill();
    c.lineWidth = isActive ? 3 : 2;
    c.strokeStyle = u.downed ? C.bad : isActive ? C.gold : isPlayer ? C.player : C.enemy;
    c.stroke();

    if (u.downed) {
      c.strokeStyle = C.bad;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y - r * 0.15, r * 0.4, Math.PI, 0);
      c.moveTo(x - r * 0.4, y - r * 0.15);
      c.lineTo(x - r * 0.4, y + r * 0.3);
      c.lineTo(x + r * 0.4, y + r * 0.3);
      c.lineTo(x + r * 0.4, y - r * 0.15);
      c.stroke();
    } else {
      c.fillStyle = C.ink;
      c.font = `${Math.round(s * 0.6)}px ${"Cinzel, Georgia, serif"}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText((u.name[0] ?? "?").toUpperCase(), x, y + s * 0.03);
    }

    // hp bar
    if (!u.downed) {
      const bw = s * 1.15;
      const frac = Math.max(0, u.hp / u.maxHp);
      const by = y + r + 3;
      c.fillStyle = "#2a1512";
      c.fillRect(x - bw / 2, by, bw, 4);
      c.fillStyle = frac > 0.5 ? "#86a758" : frac > 0.25 ? "#dc8a3a" : "#b0413b";
      c.fillRect(x - bw / 2, by, bw * frac, 4);
      c.strokeStyle = "rgba(0,0,0,0.6)";
      c.lineWidth = 1;
      for (const at of [0.25, 0.5]) {
        c.beginPath();
        c.moveTo(x - bw / 2 + bw * at, by);
        c.lineTo(x - bw / 2 + bw * at, by + 4);
        c.stroke();
      }
    }

    // condition dots
    let cx = x - r * 0.7;
    for (const cond of u.conditions) {
      const col =
        cond.kind === "blessed" ? "#86a758" :
        cond.kind === "burning" ? "#dc8a3a" :
        cond.kind === "poisoned" ? "#9276b6" :
        cond.kind === "prone" ? "#9a9384" :
        cond.kind === "bleeding" ? "#b0413b" : "#6ea6cc";
      c.fillStyle = col;
      c.beginPath();
      c.arc(cx, y - r - 3, 2.4, 0, Math.PI * 2);
      c.fill();
      cx += 6;
    }

    // enemy intent badge
    if (u.team === "enemy" && u.alive && u.intent && u.intent.kind !== "wait") {
      c.fillStyle = C.enemy;
      c.beginPath();
      c.arc(x + r * 0.75, y - r * 0.75, s * 0.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#17100a";
      c.font = `${Math.round(s * 0.26)}px ui-monospace, monospace`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(u.intent.kind === "attack" ? "!" : "»", x + r * 0.75, y - r * 0.72);
    }
  }
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
