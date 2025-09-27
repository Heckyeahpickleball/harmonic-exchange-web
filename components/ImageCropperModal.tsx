// /components/ImageCropperModal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  src: string;            // object URL
  aspect: number;         // width / height (e.g., 1 for square, 3 for banner)
  targetWidth: number;    // output pixels
  targetHeight: number;   // output pixels
  title?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export default function ImageCropperModal({
  src,
  aspect,
  targetWidth,
  targetHeight,
  title = 'Crop image',
  onCancel,
  onConfirm,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // preview canvas size (CSS pixels); fixed ratio
  const [cw, ch] = useCanvasSize(aspect);

  // transform state in CANVAS pixel space
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const minScaleRef = useRef(1);

  // pointer drag
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // load image and initialize transform
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;

      // compute minimum scale to fully cover the canvas
      const sMin = Math.max(cw / img.width, ch / img.height);
      minScaleRef.current = sMin;

      setScale(sMin);
      setOffset({
        x: (cw - img.width * sMin) / 2,
        y: (ch - img.height * sMin) / 2,
      });

      draw(img, canvasRef.current, sMin, {
        x: (cw - img.width * sMin) / 2,
        y: (ch - img.height * sMin) / 2,
      });
    };
    img.src = src;
    return () => {
      imgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, cw, ch]);

  // redraw when transform changes
  useEffect(() => {
    if (!imgRef.current || !canvasRef.current) return;
    draw(imgRef.current, canvasRef.current, scale, offset);
  }, [scale, offset]);

  // wheel to zoom (center on pointer)
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (!imgRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const sMin = minScaleRef.current;
    const sMax = sMin * 5;
    const next = clamp(scale * (1 - e.deltaY * 0.001), sMin, sMax);

    // keep point under cursor stable
    const imgX = (px - offset.x) / scale;
    const imgY = (py - offset.y) / scale;

    const nextOffset = {
      x: px - imgX * next,
      y: py - imgY * next,
    };

    setScale(next);
    setOffset(clampOffset(nextOffset, next, imgRef.current.width, imgRef.current.height, cw, ch));
  }

  // drag to pan
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

  async function handleConfirm() {
    if (!imgRef.current) return;

    // render to output size with equivalent transform
    const out = document.createElement('canvas');
    out.width = targetWidth;
    out.height = targetHeight;
    const ctx = out.getContext('2d')!;

    const sx = offset.x * (targetWidth / cw);
    const sy = offset.y * (targetHeight / ch);
    const s = scale * (targetWidth / cw);

    ctx.setTransform(s, 0, 0, s, sx, sy);
    ctx.drawImage(imgRef.current, 0, 0);

    const blob: Blob = await new Promise((res) => out.toBlob((b) => res(b!), 'image/jpeg', 0.92));
    const file = new File([blob], 'crop.jpg', { type: 'image/jpeg' });
    onConfirm(file);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onCancel} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">Cancel</button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr,220px]">
          {/* Canvas preview */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={cw}
              height={ch}
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="mx-auto block w-full max-w-full touch-none rounded border bg-black/5"
              aria-label="Crop area"
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3">
            <div className="rounded border p-3">
              <div className="mb-2 text-sm font-medium">Zoom</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sMin = minScaleRef.current;
                    const next = clamp(scale * 0.9, sMin, sMin * 5);
                    setScale(next);
                    if (imgRef.current) {
                      setOffset(clampOffset(offset, next, imgRef.current.width, imgRef.current.height, cw, ch));
                    }
                  }}
                  className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  −
                </button>
                <div className="min-w-[80px] text-center text-sm">{(scale / minScaleRef.current).toFixed(2)}×</div>
                <button
                  type="button"
                  onClick={() => {
                    const sMin = minScaleRef.current;
                    const next = clamp(scale * 1.1, sMin, sMin * 5);
                    setScale(next);
                    if (imgRef.current) {
                      setOffset(clampOffset(offset, next, imgRef.current.width, imgRef.current.height, cw, ch));
                    }
                  }}
                  className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!imgRef.current) return;
                  const sMin = minScaleRef.current;
                  setScale(sMin);
                  setOffset({
                    x: (cw - imgRef.current.width * sMin) / 2,
                    y: (ch - imgRef.current.height * sMin) / 2,
                  });
                }}
                className="mt-3 w-full rounded border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Reset
              </button>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              className="rounded bg-black px-4 py-2 text-sm text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function useCanvasSize(aspect: number): [number, number] {
  // choose a pleasant preview size while keeping the aspect
  // desktop ~900px wide for banners, ~400px for square
  const [size, setSize] = useState<[number, number]>(() => {
    if (aspect >= 2) return [900, Math.round(900 / aspect)];
    if (aspect >= 1) return [420, Math.round(420 / aspect)];
    // tall (not used here)
    return [360, Math.round(360 / aspect)];
  });

  useEffect(() => {
    function onResize() {
      const maxW = Math.min(window.innerWidth - 64, 900);
      const w = aspect >= 1 ? maxW : Math.min(420, maxW);
      setSize([w, Math.round(w / aspect)]);
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [aspect]);

  return size;
}

function draw(img: HTMLImageElement, canvas: HTMLCanvasElement | null, scale: number, offset: { x: number; y: number }) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
  ctx.restore();
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

  // Keep image covering the canvas (no gaps)
  const minX = Math.min(0, cw - w);
  const minY = Math.min(0, ch - h);
  const maxX = Math.max(0, cw - w);
  const maxY = Math.max(0, ch - h);

  return {
    x: clamp(next.x, minX, maxX),
    y: clamp(next.y, minY, maxY),
  };
}
