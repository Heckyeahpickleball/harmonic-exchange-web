// /components/ImageCropperModal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  src: string;            // object URL from file picker
  aspect: number;         // width / height (1 for avatar, 3 for cover)
  targetWidth: number;    // output width in px
  targetHeight: number;   // output height in px
  title?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export default function ImageCropperModal({
  src,
  aspect,
  targetWidth,
  targetHeight,
  title = 'Position your photo',
  onCancel,
  onConfirm,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Preview canvas size (kept modest + always within viewport)
  const [cw, ch] = usePreviewSize(aspect);

  // Transform state (in canvas pixels)
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const minScaleRef = useRef(1);

  // Dragging
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // Load image and initialize transform
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;

      // Minimum scale so image fully covers canvas
      const sMin = Math.max(cw / img.width, ch / img.height);
      minScaleRef.current = sMin;

      const initOffset = {
        x: (cw - img.width * sMin) / 2,
        y: (ch - img.height * sMin) / 2,
      };
      setScale(sMin);
      setOffset(initOffset);
      draw(img, canvasRef.current, sMin, initOffset);
    };
    img.src = src;
    return () => {
      imgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, cw, ch]);

  // Redraw when transform changes
  useEffect(() => {
    if (!imgRef.current || !canvasRef.current) return;
    draw(imgRef.current, canvasRef.current, scale, offset);
  }, [scale, offset]);

  // Pan
  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !imgRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    const next = { x: offset.x + dx, y: offset.y + dy };
    setOffset(clampOffset(next, scale, imgRef.current.width, imgRef.current.height, cw, ch));
  }
  function onPointerUp(e: React.PointerEvent) {
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  // Zoom via slider (1.00x to 5.00x relative to min scale)
  const zoomRatio = scale / minScaleRef.current;
  function setZoomRatio(r: number) {
    if (!imgRef.current) return;
    const sMin = minScaleRef.current;
    const nextScale = clamp(r * sMin, sMin, sMin * 5);
    // Keep centered when using slider (simple UX)
    const nextOffset = {
      x: (cw - imgRef.current.width * nextScale) / 2,
      y: (ch - imgRef.current.height * nextScale) / 2,
    };
    setScale(nextScale);
    setOffset(clampOffset(nextOffset, nextScale, imgRef.current.width, imgRef.current.height, cw, ch));
  }

  function resetView() {
    if (!imgRef.current) return;
    const sMin = minScaleRef.current;
    setScale(sMin);
    setOffset({
      x: (cw - imgRef.current.width * sMin) / 2,
      y: (ch - imgRef.current.height * sMin) / 2,
    });
  }

  async function handleConfirm() {
    if (!imgRef.current) return;
    // Render to final size
    const out = document.createElement('canvas');
    out.width = targetWidth;
    out.height = targetHeight;
    const ctx = out.getContext('2d')!;

    const sx = offset.x * (targetWidth / cw);
    const sy = offset.y * (targetHeight / ch);
    const s = scale * (targetWidth / cw);

    ctx.setTransform(s, 0, 0, s, sx, sy);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgRef.current, 0, 0);

    const blob: Blob = await new Promise((res) => out.toBlob((b) => res(b!), 'image/jpeg', 0.92));
    const file = new File([blob], 'crop.jpg', { type: 'image/jpeg' });
    onConfirm(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="grid w-full max-w-[900px] max-h-[90vh] grid-rows-[auto_1fr_auto] overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onCancel} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">
            Cancel
          </button>
        </div>

        {/* Preview (kept compact + scroll-safe) */}
        <div className="flex items-center justify-center overflow-auto p-3">
          <canvas
            ref={canvasRef}
            width={cw}
            height={ch}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="block max-w-full rounded border bg-black/5"
            aria-label="Crop area"
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Footer controls (sticky, always visible) */}
        <div className="grid gap-3 border-t p-3">
          <div className="flex items-center gap-3">
            <span className="w-12 text-sm">Zoom</span>
            <input
              type="range"
              min={1}
              max={5}
              step={0.01}
              value={zoomRatio}
              onChange={(e) => setZoomRatio(parseFloat(e.currentTarget.value))}
              className="flex-1 accent-black"
            />
            <span className="w-14 text-right text-sm tabular-nums">{zoomRatio.toFixed(2)}×</span>
            <button type="button" onClick={resetView} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
              Reset
            </button>
          </div>

          <div className="flex justify-end">
            <button onClick={handleConfirm} className="rounded bg-black px-4 py-2 text-sm text-white">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- sizing + drawing helpers ---------- */

// Keep canvas comfortably within viewport (no overflow)
function usePreviewSize(aspect: number): [number, number] {
  const calc = () => {
    const vw = Math.max(320, window.innerWidth);
    const vh = Math.max(480, window.innerHeight);

    // panel paddings + header/footer ≈ 220px; leave margin
    const availW = Math.min(vw - 64, 860);
    const availH = Math.min(vh - 260, 520);

    let w = availW;
    let h = w / aspect;
    if (h > availH) {
      h = availH;
      w = h * aspect;
    }
    return [Math.round(w), Math.round(h)] as [number, number];
  };

  const [size, setSize] = useState<[number, number]>(calc);
  useEffect(() => {
    const onResize = () => setSize(calc());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);
  return size;
}

function draw(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement | null,
  scale: number,
  offset: { x: number; y: number }
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function clampOffset(
  next: { x: number; y: number },
  scale: number,
  iw: number,
  ih: number,
  cw: number,
  ch: number
) {
  const w = iw * scale;
  const h = ih * scale;
  const minX = Math.min(0, cw - w);
  const minY = Math.min(0, ch - h);
  const maxX = Math.max(0, cw - w);
  const maxY = Math.max(0, ch - h);
  return { x: clamp(next.x, minX, maxX), y: clamp(next.y, minY, maxY) };
}
