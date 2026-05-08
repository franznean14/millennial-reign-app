import type { Map as MapLibreMap } from "maplibre-gl";

export type EstablishmentLabelBgBundle = {
  segment: string;
  fillCss: string;
  strokeCss: string;
};

/** Wide, short stadium / full pill — height drives 100% round caps (r = H/2). */
const LABEL_BG_W = 220;
const LABEL_BG_H = 36;
/** Left/right cap width equals radius = H/2 (semicircle ends). */
const LABEL_BG_R = LABEL_BG_H / 2;
/** Tight content box: small vertical inset so text fits like a single cap line. */
const LABEL_CONTENT_INSET_X = 12;
const LABEL_CONTENT_INSET_Y = 4;

/** Stable id for MapLibre `icon-image` — matches `sanitizeStatusSegment` bucket. */
export function establishmentLabelBgImageId(segment: string): string {
  return `est-lbl-pill-v2-${segment}`;
}

function pathRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/**
 * 9-slice pill bitmap for `icon-text-fit`: horizontal stretch only in the flat middle;
 * wide+short `content` box avoids a square intrinsic aspect ratio (reduces extra vertical slack).
 */
export function ensureEstablishmentLabelBackgroundImages(map: MapLibreMap, bundles: EstablishmentLabelBgBundle[]): void {
  const W = LABEL_BG_W;
  const H = LABEL_BG_H;
  const R = LABEL_BG_R;
  const cx0 = LABEL_CONTENT_INSET_X;
  const cy0 = LABEL_CONTENT_INSET_Y;
  const cx1 = W - LABEL_CONTENT_INSET_X;
  const cy1 = H - LABEL_CONTENT_INSET_Y;

  for (const { segment, fillCss, strokeCss } of bundles) {
    const id = establishmentLabelBgImageId(segment);
    if (map.hasImage(id)) {
      continue;
    }
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      continue;
    }
    ctx.clearRect(0, 0, W, H);
    pathRoundRect(ctx, 0, 0, W, H, R);
    ctx.fillStyle = fillCss;
    ctx.fill();
    ctx.strokeStyle = strokeCss;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const imageData = ctx.getImageData(0, 0, W, H);
    map.addImage(id, imageData, {
      pixelRatio: 2,
      sdf: false,
      content: [cx0, cy0, cx1, cy1],
      stretchX: [[R, W - R]],
      /** Minimal vertical slice so height tracks text without inflating like a tall 9-slice. */
      stretchY: [
        [Math.floor(H / 2) - 1, Math.floor(H / 2) + 1],
      ],
    });
  }
}
