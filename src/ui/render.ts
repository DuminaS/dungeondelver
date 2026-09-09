import { Hex, Layout, eq, hexToPixel, key, pixelToHex } from "../core/hex";
import { Encounter } from "../game/encounter";
import { Tile } from "../core/grid";
import { Unit } from "../game/types";

const TERRAIN_FILL: Record<string, string> = {
  open: "#2a2320",
  difficult: "#332a22",
  rubble: "#3a322a",
  water: "#1f3540",
  wall: "#0c0a09",
  chasm: "#050505",
};
const HAZARD: Record<string, { fill: string; label: string }> = {
  acid: { fill: "rgba(120,170,60,0.30)", label: "≈" },
  spikes: { fill: "rgba(150,150,160,0.22)", label: "^" },
  fire: { fill: "rgba(200,90,40,0.34)", label: "*" },
  gas: { fill: "rgba(150,120,180,0.30)", label: "~" },
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

  /** overlays set by the HUD each frame */
  reachable: Map<string, number> = new Map();
  attackable: Set<string> = new Set();
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
    const scaleX = this.canvas.width / this.dpr / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleX;
    const h = pixelToHex(x, y, this.layout);
    return this.enc?.grid.has(h) ? h : null;
  }

  fit(): void {
    if (!this.enc) return;
    const tiles = this.enc.grid.all();
    const holder = this.canvas.parentElement!;
    const cssW = holder.clientWidth || 640;
    // compute needed extent at size 1 then scale
    const pts = tiles.map((t) => hexToPixel({ q: t.q, r: t.r }, { size: 1, originX: 0, originY: 0 }));
    const minX = Math.min(...pts.map((p) => p.x)) - 1;
    const maxX = Math.max(...pts.map((p) => p.x)) + 1;
    const minY = Math.min(...pts.map((p) => p.y)) - Math.sqrt(3) / 2;
    const maxY = Math.max(...pts.map((p) => p.y)) + Math.sqrt(3) / 2;
    const size = Math.min(30, Math.max(15, (cssW - 8) / (maxX - minX)));
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
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  }

  draw(): void {
    const enc = this.enc;
    const c = this.ctx;
    c.save();
    c.scale(this.dpr, this.dpr);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!enc) {
      c.restore();
      return;
    }
    const L = this.layout;
    const s = L.size;

    for (const t of enc.grid.all()) {
      const { x, y } = hexToPixel({ q: t.q, r: t.r }, L);
      this.drawTile(t, x, y, s);
    }

    // deploy zone
    for (const h of this.deploy) {
      const { x, y } = hexToPixel(h, L);
      this.hexPath(x, y, s * 0.92);
      c.strokeStyle = "rgba(111,143,78,0.9)";
      c.lineWidth = 2;
      c.stroke();
    }

    // reachable
    for (const k of this.reachable.keys()) {
      const [q, r] = k.split(",").map(Number);
      const { x, y } = hexToPixel({ q, r }, L);
      this.hexPath(x, y, s * 0.9);
      c.fillStyle = "rgba(90,127,168,0.16)";
      c.fill();
    }

    // path preview
    if (this.pathPreview.length > 1) {
      c.strokeStyle = "rgba(216,162,74,0.85)";
      c.lineWidth = 2;
      c.beginPath();
      this.pathPreview.forEach((h, i) => {
        const { x, y } = hexToPixel(h, L);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.stroke();
    }

    // attackable rings
    for (const k of this.attackable) {
      const u = enc.units.find((z) => z.alive && key(z.pos) === k);
      if (!u) continue;
      const { x, y } = hexToPixel(u.pos, L);
      this.hexPath(x, y, s * 0.95);
      c.strokeStyle = "rgba(165,52,43,0.95)";
      c.lineWidth = 2.5;
      c.stroke();
    }

    // enemy intent lines
    for (const u of enc.units) {
      if (u.team !== "enemy" || !u.alive || !u.intent) continue;
      const from = hexToPixel(u.pos, L);
      if (u.intent.kind === "attack" && u.intent.targetId) {
        const tgt = enc.units.find((z) => z.id === u.intent!.targetId);
        if (tgt) {
          const to = hexToPixel(tgt.pos, L);
          c.strokeStyle = "rgba(165,52,43,0.55)";
          c.setLineDash([4, 3]);
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(from.x, from.y);
          c.lineTo(to.x, to.y);
          c.stroke();
          c.setLineDash([]);
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
      this.hexPath(x, y, s * 0.96);
      c.strokeStyle = "rgba(231,221,208,0.7)";
      c.lineWidth = 1.5;
      c.stroke();
    }

    // units
    for (const u of enc.units) {
      if (!u.alive && !u.downed) continue;
      this.drawUnit(u, L);
    }

    c.restore();
  }

  private drawTile(t: Tile, x: number, y: number, s: number): void {
    const c = this.ctx;
    this.hexPath(x, y, s * 0.96);
    let fill = TERRAIN_FILL[t.terrain] ?? "#2a2320";
    if (t.terrain === "open" || t.terrain === "difficult" || t.terrain === "rubble") {
      const lift = 12 * t.elevation;
      fill = shade(fill, lift);
    }
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = "rgba(0,0,0,0.5)";
    c.lineWidth = 1;
    c.stroke();

    if (t.elevation > 0 && t.terrain !== "wall" && t.terrain !== "chasm") {
      c.fillStyle = "rgba(231,221,208,0.28)";
      c.font = `${Math.round(s * 0.4)}px monospace`;
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillText("·".repeat(t.elevation), x - s * 0.55, y - s * 0.55);
    }
    if (t.hazard) {
      const hz = HAZARD[t.hazard.kind];
      this.hexPath(x, y, s * 0.96);
      c.fillStyle = hz.fill;
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.5)";
      c.font = `${Math.round(s * 0.7)}px monospace`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(hz.label, x, y);
    }
    if (t.feature === "extract") {
      c.strokeStyle = "rgba(216,162,74,0.95)";
      c.lineWidth = 2;
      this.hexPath(x, y, s * 0.6);
      c.stroke();
      c.fillStyle = "rgba(216,162,74,0.9)";
      c.font = `${Math.round(s * 0.55)}px monospace`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("↑", x, y);
    }
  }

  private drawUnit(u: Unit, L: Layout): void {
    const c = this.ctx;
    const { x, y } = hexToPixel(u.pos, L);
    const s = L.size;
    const r = s * 0.62;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (u.downed) c.fillStyle = "#4a3a34";
    else c.fillStyle = u.team === "player" ? "#3a5a7a" : "#7a332c";
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle =
      this.enc?.active?.id === u.id ? "#d8a24a" : u.team === "player" ? "#8fb4d8" : "#d88f88";
    c.stroke();

    // initial
    c.fillStyle = "#f0e8dc";
    c.font = `${Math.round(s * 0.62)}px serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(u.name[0] ?? "?", x, y + 1);

    // hp bar
    const bw = s * 1.1;
    const frac = Math.max(0, u.hp / u.maxHp);
    c.fillStyle = "#1a0d0b";
    c.fillRect(x - bw / 2, y + r + 2, bw, 4);
    c.fillStyle = frac > 0.5 ? "#6f8f4e" : frac > 0.25 ? "#d8a24a" : "#a5342b";
    c.fillRect(x - bw / 2, y + r + 2, bw * frac, 4);

    if (u.downed) {
      c.fillStyle = "#e0a49c";
      c.font = `${Math.round(s * 0.5)}px serif`;
      c.fillText("✝", x, y - r - 4);
    }
    for (const cond of u.conditions) {
      if (cond.kind === "blessed") { c.fillStyle = "#e8d48a"; c.fillText("+", x + r, y - r); }
      if (cond.kind === "burning") { c.fillStyle = "#e07a3a"; c.fillText("*", x + r, y - r); }
      if (cond.kind === "prone") { c.fillStyle = "#c9c9c9"; c.fillText("_", x + r, y + r); }
      if (cond.kind === "poisoned") { c.fillStyle = "#a9d488"; c.fillText("•", x + r, y); }
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
