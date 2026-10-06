/**
 * Canvas hair engine for the haircut scroll scene.
 *
 * Everything here is a pure function of `time` (the GSAP timeline's playhead),
 * so scrubbing backwards reverses the cut perfectly: segments re-attach,
 * clippings fly back up. No state accumulates between frames.
 */

export type CutLine = {
  /** y as a fraction of height at x = 0 */
  y0: number;
  /** y as a fraction of height at x = width */
  y1: number;
};

/** A single "close" of the scissors: every lock whose x lies in [from, to) is cut at `time`. */
export type Snip = { time: number; from: number; to: number };

export type HairOptions = {
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
  /** cuts[0] = lower cut (first pass), cuts[1] = upper cut (second pass) */
  cuts: [CutLine, CutLine];
  snips: [Snip[], Snip[]];
};

type StrandGroup = { path: Path2D; width: number };

type Segment = {
  cutIndex: 0 | 1;
  cutTime: number;
  rotSpeed: number;
  drift: number;
  depth: number;
  delay: number;
  wobble: number;
};

type Lock = {
  x: number;
  minX: number;
  maxX: number;
  body: Path2D;
  groups: StrandGroup[];
  low: Segment;
  mid: Segment;
};

type Clipping = {
  x: number;
  y: number;
  len: number;
  bend: number;
  rot0: number;
  rotSpeed: number;
  vt: number;
  flutterAmp: number;
  flutterFreq: number;
  phase: number;
  drift: number;
  delay: number;
  cutTime: number;
  shade: 0 | 1;
};

const FALL_LIFETIME = 1.7;
const CLIP_LIFETIME = 2.4;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class HairScene {
  private ctx: CanvasRenderingContext2D;
  private opts: HairOptions;
  private locks: Lock[] = [];
  private clippings: Clipping[] = [];
  private spacing = 30;
  private highlight!: CanvasGradient;
  private mid!: CanvasGradient;
  private lastKey = "";

  constructor(private canvas: HTMLCanvasElement, opts: HairOptions) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.opts = opts;
    this.build();
  }

  update(opts: HairOptions) {
    this.opts = opts;
    this.build();
  }

  /** y (px) of a cut line at x (px) */
  cutY(index: 0 | 1, x: number) {
    const { width, height, cuts } = this.opts;
    const c = cuts[index];
    return height * (c.y0 + (c.y1 - c.y0) * (x / width));
  }

  private cutTimeFor(index: 0 | 1, x: number) {
    const snips = this.opts.snips[index];
    for (const s of snips) {
      const lo = Math.min(s.from, s.to);
      const hi = Math.max(s.from, s.to);
      if (x >= lo && x < hi) return s.time;
    }
    return snips[snips.length - 1]?.time ?? Infinity;
  }

  private build() {
    const { width: W, height: H, dpr, mobile } = this.opts;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.lastKey = "";

    const rand = mulberry32(1987);
    const r = (a: number, b: number) => a + (b - a) * rand();

    this.spacing = mobile ? 20 : Math.max(26, Math.min(36, W / 42));
    const sp = this.spacing;
    const count = Math.ceil(W / sp) + 3;
    const strandsPerLock = mobile ? 9 : 15;

    this.locks = [];
    for (let i = 0; i < count; i++) {
      const x = (i - 1) * sp + r(-0.2, 0.2) * sp;
      // Coherent flow across the whole head of hair + per-lock variation.
      const wave = Math.sin(i * 0.31) * sp * 1.3;
      const c1 = x + wave + r(-1, 1) * sp;
      const c2 = x - wave * 0.9 + r(-1.1, 1.1) * sp;
      const end = x + wave * 0.4 + r(-0.7, 0.7) * sp;
      const top = -0.05 * H;
      const bottom = 1.06 * H;

      const body = new Path2D();
      body.moveTo(x, top);
      body.bezierCurveTo(c1, H * 0.36, c2, H * 0.7, end, bottom);

      const groupPaths = [new Path2D(), new Path2D(), new Path2D()];
      for (let s = 0; s < strandsPerLock; s++) {
        const g = s % 7 === 0 ? 2 : s % 2 === 0 ? 1 : 0;
        const dx = r(-1.05, 1.05) * sp;
        const p = groupPaths[g];
        p.moveTo(x + dx, top);
        p.bezierCurveTo(
          c1 + dx * r(0.6, 1.3) + r(-0.35, 0.35) * sp,
          H * r(0.3, 0.42),
          c2 + dx * r(0.5, 1.4) + r(-0.45, 0.45) * sp,
          H * r(0.62, 0.76),
          end + dx * r(0.4, 1.6) + r(-0.6, 0.6) * sp,
          bottom + r(-0.02, 0.04) * H
        );
      }
      // A stray flyaway every few locks breaks the uniformity.
      if (i % 3 === 0) {
        const p = groupPaths[1];
        const dx = r(-0.5, 0.5) * sp;
        p.moveTo(x + dx, top);
        p.bezierCurveTo(c1 + sp * r(-1.4, 1.4), H * 0.4, c2 + sp * r(-1.8, 1.8), H * 0.75, end + sp * r(-1.6, 1.6), bottom);
      }

      const xs = [x, c1, c2, end];
      const make = (cutIndex: 0 | 1): Segment => ({
        cutIndex,
        cutTime: 0,
        rotSpeed: r(0.25, 0.95) * (rand() > 0.5 ? 1 : -1),
        drift: r(-0.06, 0.06) * W,
        depth: r(-0.04, 0.22),
        delay: r(0, 0.07),
        wobble: r(0.5, 1.5),
      });

      this.locks.push({
        x,
        minX: Math.min(...xs) - sp * 2,
        maxX: Math.max(...xs) + sp * 2,
        body,
        groups: [
          { path: groupPaths[0], width: mobile ? 1.6 : 2.1 },
          { path: groupPaths[1], width: mobile ? 1.1 : 1.4 },
          { path: groupPaths[2], width: mobile ? 0.8 : 0.9 },
        ],
        low: make(0),
        mid: make(1),
      });
    }

    this.assignCutTimes(rand);

    const ctx = this.ctx;
    this.highlight = ctx.createLinearGradient(0, 0, 0, H);
    this.highlight.addColorStop(0, "rgba(120,88,66,0)");
    this.highlight.addColorStop(0.18, "rgba(176,132,102,0.55)");
    this.highlight.addColorStop(0.3, "rgba(120,88,66,0.08)");
    this.highlight.addColorStop(0.6, "rgba(120,88,66,0.05)");
    this.highlight.addColorStop(0.72, "rgba(176,132,102,0.4)");
    this.highlight.addColorStop(0.9, "rgba(120,88,66,0.05)");

    this.mid = ctx.createLinearGradient(0, 0, 0, H);
    this.mid.addColorStop(0, "#1b1411");
    this.mid.addColorStop(0.22, "#3a2b22");
    this.mid.addColorStop(0.45, "#221a15");
    this.mid.addColorStop(0.74, "#33261e");
    this.mid.addColorStop(1, "#1a1310");
  }

  private assignCutTimes(rand: () => number) {
    const { mobile, snips, width: W } = this.opts;
    for (const lock of this.locks) {
      lock.low.cutTime = this.cutTimeFor(0, lock.x);
      lock.mid.cutTime = this.cutTimeFor(1, lock.x);
    }

    // Short clippings released at every snip, spread along the cut range.
    this.clippings = [];
    const perSnip = mobile ? 7 : 16;
    ([0, 1] as const).forEach((ci) => {
      for (const s of snips[ci]) {
        const lo = Math.max(-20, Math.min(s.from, s.to));
        const hi = Math.min(W + 20, Math.max(s.from, s.to));
        if (hi <= lo) continue;
        const n = Math.max(2, Math.round(perSnip * Math.min(1, (hi - lo) / (W / 6))));
        for (let i = 0; i < n; i++) {
          const x = lo + (hi - lo) * rand();
          this.clippings.push({
            x,
            y: this.cutY(ci, x) + (rand() - 0.5) * 14,
            len: 5 + rand() * (mobile ? 12 : 18),
            bend: (rand() - 0.5) * 0.8,
            rot0: rand() * Math.PI * 2,
            rotSpeed: (2 + rand() * 5) * (rand() > 0.5 ? 1 : -1),
            vt: 0.35 + rand() * 0.45,
            flutterAmp: 4 + rand() * 16,
            flutterFreq: 4 + rand() * 6,
            phase: rand() * Math.PI * 2,
            drift: (rand() - 0.5) * 0.08 * W,
            delay: rand() * 0.1,
            cutTime: s.time,
            shade: rand() > 0.6 ? 1 : 0,
          });
        }
      }
    });
  }

  /** Clip to the band between two edges, sampled so cut edges get a fine, uneven bite. */
  private clipBand(minX: number, maxX: number, top: (x: number) => number, bottom: (x: number) => number) {
    const ctx = this.ctx;
    const steps = 8;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = minX + ((maxX - minX) * i) / steps;
      if (i === 0) ctx.moveTo(x, top(x));
      else ctx.lineTo(x, top(x));
    }
    for (let i = steps; i >= 0; i--) {
      const x = minX + ((maxX - minX) * i) / steps;
      ctx.lineTo(x, bottom(x));
    }
    ctx.closePath();
    ctx.clip();
  }

  private strokeLock(lock: Lock, fan = 0, loose = false) {
    const ctx = this.ctx;
    ctx.strokeStyle = "#0d0a09";
    ctx.lineWidth = this.spacing * (loose ? 0.7 : 1.35);
    ctx.stroke(lock.body);

    const styles = ["#120e0c", this.mid, this.highlight];
    for (let g = 0; g < 3; g++) {
      const group = lock.groups[g];
      if (fan) {
        ctx.save();
        ctx.translate((g - 1) * fan, 0);
      }
      ctx.strokeStyle = styles[g];
      ctx.lineWidth = group.width;
      ctx.stroke(group.path);
      if (fan) ctx.restore();
    }
  }

  /** Draw the scene at timeline time `t`. */
  render(t: number) {
    const key = t.toFixed(4);
    if (key === this.lastKey) return;
    this.lastKey = key;

    const { width: W, height: H, dpr } = this.opts;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";

    const top = () => -0.1 * H;
    const floor = () => 1.2 * H;
    // Tiny deterministic jitter so a cut edge reads as many strands, not a ruler line.
    const bite = (x: number) => Math.sin(x * 0.91) * 1.6 + Math.sin(x * 2.37 + 1.3) * 1.2;
    const lower = (x: number) => this.cutY(0, x) + bite(x);
    const upper = (x: number) => this.cutY(1, x) + bite(x + 50);

    // 1. Attached hair (everything not yet cut)
    for (const lock of this.locks) {
      const lowGone = t >= lock.low.cutTime;
      const midGone = t >= lock.mid.cutTime;
      const bottom = midGone ? upper : lowGone ? lower : floor;

      ctx.save();
      if (lowGone || midGone) this.clipBand(lock.minX, lock.maxX, top, bottom);

      // Solid backing for this lock's column so the wall never peeks through uncut hair.
      ctx.fillStyle = "#0e0b0a";
      ctx.fillRect(lock.x - this.spacing * 0.75, -0.1 * H, this.spacing * 1.5, 1.3 * H);
      this.strokeLock(lock);
      ctx.restore();
    }

    // 2. Falling segments (drawn in front of the attached hair)
    for (const lock of this.locks) {
      for (const seg of [lock.low, lock.mid]) {
        const tau = t - seg.cutTime - seg.delay;
        if (tau <= 0 || tau > FALL_LIFETIME) continue;
        const isLow = seg.cutIndex === 0;
        const segTop = isLow ? lower : upper;
        const segBottom = isLow ? floor : lower;
        const pivotY = (segTop(lock.x) + Math.min(H, segBottom(lock.x))) / 2;

        const g = 2.3 * H;
        const dy = 0.05 * H * tau + 0.5 * g * tau * tau;
        const dx = seg.drift * tau + Math.sin(tau * 5 * seg.wobble) * 6 * tau;
        const rot = seg.rotSpeed * tau * tau * 0.9;
        const scale = 1 + seg.depth * tau;
        const alpha = 1 - smoothstep(1.0, FALL_LIFETIME, tau);
        if (alpha <= 0.01) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(lock.x + dx, pivotY + dy);
        ctx.rotate(rot);
        ctx.scale(scale, scale);
        ctx.translate(-lock.x, -pivotY);
        this.clipBand(lock.minX, lock.maxX, segTop, segBottom);
        this.strokeLock(lock, this.spacing * 1.4 * tau, true);
        ctx.restore();
      }
    }

    // 3. Fine clippings — batched into two paths
    const paths = [new Path2D(), new Path2D()];
    let any = false;
    for (const c of this.clippings) {
      const tau = t - c.cutTime - c.delay;
      if (tau <= 0 || tau > CLIP_LIFETIME) continue;
      const k = 3.5;
      const fall = c.vt * H * (tau - (1 - Math.exp(-k * tau)) / k);
      const y = c.y + fall;
      if (y > H + 30) continue;
      const x = c.x + c.drift * tau + Math.sin(tau * c.flutterFreq + c.phase) * c.flutterAmp * Math.min(1, tau * 2);
      const a = c.rot0 + c.rotSpeed * tau;
      const hx = (Math.cos(a) * c.len) / 2;
      const hy = (Math.sin(a) * c.len) / 2;
      const p = paths[c.shade];
      p.moveTo(x - hx, y - hy);
      p.quadraticCurveTo(x - hy * c.bend * 2, y + hx * c.bend * 2, x + hx, y + hy);
      any = true;
    }
    if (any) {
      ctx.strokeStyle = "#16110e";
      ctx.lineWidth = 1.1;
      ctx.stroke(paths[0]);
      ctx.strokeStyle = "#4a3629";
      ctx.lineWidth = 0.8;
      ctx.stroke(paths[1]);
    }
  }
}
