import type { LookRecipe } from "./types";
import { createPRNG } from "./math";

/**
 * 2D Canvas Post-Processing:
 * - Orange 7-segment digital date stamp ('YY MM DD)
 * - Polaroid / Instant Film white border + handwritten caption
 * - Procedural dust specks & emulsion scratches
 *
 * Drawn at full native resolution directly on the canvas after shader passes.
 */

export interface StampFrameOptions {
  seed: number;
  date?: Date;
  coupleNames?: string;
}

export function drawEmulsionExtras(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  look: LookRecipe,
  seed: number
) {
  const rng = createPRNG(seed);

  // 1. Procedural Dust Specks
  if (look.dust.density > 0) {
    const speckCount = Math.floor(look.dust.density * 45);
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    for (let i = 0; i < speckCount; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const radius = (0.5 + rng() * 1.5) * (h / 1000);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 2. Procedural Emulsion Scratches
  if (look.dust.scratches > 0) {
    const scratchCount = Math.floor(look.dust.scratches * 6);
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = Math.max(1, 0.8 * (h / 1000));
    for (let i = 0; i < scratchCount; i++) {
      const x1 = rng() * w;
      const y1 = rng() * h;
      const length = (20 + rng() * 80) * (h / 1000);
      const angle = (rng() - 0.5) * 0.4; // near vertical
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.sin(angle) * length, y1 + Math.cos(angle) * length);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Procedural Light Leaks
  if (look.lightLeak.probability > 0 && rng() < look.lightLeak.probability) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const leakStrength = look.lightLeak.strength || 0.3;
    const side = rng() > 0.5 ? "right" : "left";
    const lx = side === "right" ? w : 0;
    const ly = rng() * h;
    const lr = Math.max(w, h) * (0.4 + rng() * 0.4);

    const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    const colors = look.lightLeak.palette || ["#ff5500", "#ffaa00", "#ff1144"];
    grad.addColorStop(0, `rgba(255, 120, 40, ${0.45 * leakStrength})`);
    grad.addColorStop(0.5, `rgba(255, 50, 10, ${0.25 * leakStrength})`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

export function drawDateStamp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  look: LookRecipe,
  date: Date = new Date()
) {
  if (!look.dateStamp.enabled) return;

  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const stampText = `'${yy} ${mm} ${dd}`;

  const fontSize = Math.max(14, Math.round(h * (look.dateStamp.size || 0.026)));
  const marginX = Math.round(w * 0.04);
  const marginY = Math.round(h * 0.04);

  ctx.save();
  // Monospace 7-segment style
  ctx.font = `bold ${fontSize}px "Courier New", Courier, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";

  const color = look.dateStamp.color || "#ff7700";

  if (look.dateStamp.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = fontSize * 0.4;
  }

  // Double draw for LED intensity
  ctx.fillStyle = color;
  ctx.fillText(stampText, w - marginX, h - marginY);
  ctx.fillText(stampText, w - marginX, h - marginY);

  ctx.restore();
}

export function drawInstantFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  look: LookRecipe,
  captionText?: string
) {
  if (look.frame.type !== "instant") return;

  const border = look.frame.border || 0.055;
  const sideBorder = Math.round(w * border);
  const topBorder = Math.round(h * border);
  const bottomBorder = Math.round(h * (border * 2.8)); // Thicker bottom polaroid margin

  ctx.save();

  // Draw warm off-white polaroid frame
  ctx.fillStyle = "#f6f3ea"; // creamy instant film paper

  // Top bar
  ctx.fillRect(0, 0, w, topBorder);
  // Bottom bar
  ctx.fillRect(0, h - bottomBorder, w, bottomBorder);
  // Left bar
  ctx.fillRect(0, topBorder, sideBorder, h - topBorder - bottomBorder);
  // Right bar
  ctx.fillRect(w - sideBorder, topBorder, sideBorder, h - topBorder - bottomBorder);

  // Handwritten / retro caption on bottom bar
  const text = captionText || look.frame.caption;
  if (text) {
    const fontSize = Math.max(12, Math.round(h * 0.022));
    ctx.fillStyle = "#2c2a27";
    ctx.font = `italic ${fontSize}px "Georgia", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h - bottomBorder / 2);
  }

  ctx.restore();
}
