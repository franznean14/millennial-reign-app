"use client";

import { useEffect, useRef, useState } from "react";

function drawIcon({ size, src, bg = "#000000" }: { size: number; src: HTMLImageElement; bg?: string }) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Fill background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  // Draw source centered and scaled to cover (assumes square source)
  ctx.drawImage(src, 0, 0, size, size);
  return canvas;
}

function drawMaskable({ size, src, padding = 0.14 }: { size: number; src: HTMLImageElement; padding?: number }) {
  // Transparent background, content inset by padding percent on all sides
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round(size * padding);
  ctx.drawImage(src, offset, offset, inner, inner);
  return canvas;
}

export default function IconGeneratorPage() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [urls, setUrls] = useState<{ s192?: string; s512?: string; m192?: string; m512?: string; apple180?: string }>({});

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
      try {
        const c192 = drawIcon({ size: 192, src: img });
        const c512 = drawIcon({ size: 512, src: img });
        const m192 = drawMaskable({ size: 192, src: img });
        const m512 = drawMaskable({ size: 512, src: img });
        const apple = drawIcon({ size: 180, src: img, bg: "#000000" });
        setUrls({
          s192: c192.toDataURL("image/png"),
          s512: c512.toDataURL("image/png"),
          m192: m192.toDataURL("image/png"),
          m512: m512.toDataURL("image/png"),
          apple180: apple.toDataURL("image/png"),
        });
      } catch (e: any) {
        setError(e?.message || "Failed to render icons");
      }
    };
    img.onerror = () => setError("Could not load /icon-source.png. Put your source image in public/icon-source.png");
    img.src = "/icon-source.png";
  }, []);

  const download = (dataUrl: string | undefined, filename: string) => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  return (
    <div className="mx-auto max-w-screen-md p-4 space-y-4">
      <h1 className="text-xl font-semibold">Icon Generator</h1>
      <p className="text-sm opacity-80">Loads /icon-source.png and generates backgrounded 192×192 and 512×512 PNGs (black background), maskable variants (transparent with padding), and an Apple touch icon (180×180).</p>
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="grid grid-cols-3 gap-6 items-start">
        <div>
          <div className="text-sm font-medium mb-2">Preview 192×192</div>
          {urls.s192 ? <img src={urls.s192} alt="192 preview" className="h-24 w-24 rounded" /> : <div className="h-24 w-24 rounded bg-muted" />}
          <div className="mt-2">
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={!urls.s192}
              onClick={() => download(urls.s192, "icon-192.png")}
            >
              Download icon-192.png
            </button>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Preview 512×512</div>
          {urls.s512 ? <img src={urls.s512} alt="512 preview" className="h-24 w-24 rounded" /> : <div className="h-24 w-24 rounded bg-muted" />}
          <div className="mt-2">
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={!urls.s512}
              onClick={() => download(urls.s512, "icon-512.png")}
            >
              Download icon-512.png
            </button>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Apple Touch 180×180</div>
          {urls.apple180 ? <img src={urls.apple180} alt="apple 180" className="h-24 w-24 rounded" /> : <div className="h-24 w-24 rounded bg-muted" />}
          <div className="mt-2">
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={!urls.apple180}
              onClick={() => download(urls.apple180, "apple-touch-icon.png")}
            >
              Download apple-touch-icon.png
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 items-start">
        <div>
          <div className="text-sm font-medium mb-2">Maskable 192×192 (transparent + padding)</div>
          {urls.m192 ? <img src={urls.m192} alt="maskable 192" className="h-24 w-24 rounded bg-checker" /> : <div className="h-24 w-24 rounded bg-muted" />}
          <div className="mt-2">
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={!urls.m192}
              onClick={() => download(urls.m192, "icon-maskable-192.png")}
            >
              Download icon-maskable-192.png
            </button>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Maskable 512×512 (transparent + padding)</div>
          {urls.m512 ? <img src={urls.m512} alt="maskable 512" className="h-24 w-24 rounded bg-checker" /> : <div className="h-24 w-24 rounded bg-muted" />}
          <div className="mt-2">
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={!urls.m512}
              onClick={() => download(urls.m512, "icon-maskable-512.png")}
            >
              Download icon-maskable-512.png
            </button>
          </div>
        </div>
      </div>
      <div className="text-xs opacity-70">
        Place the PNGs into <code>/public/icons/</code> (backgrounded and maskable), and the Apple icon into <code>/public/</code>. Then bump the versions in <code>src/app/manifest.ts</code> if needed and reinstall the PWA.
      </div>
    </div>
  );
}
