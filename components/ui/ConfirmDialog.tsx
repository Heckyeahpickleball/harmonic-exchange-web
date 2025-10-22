// /components/ui/ConfirmDialog.tsx
'use client';

import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string; // default: "Continue"
  cancelLabel?: string;  // default: "Cancel"
  tone?: 'default' | 'danger'; // affects confirm button style only
};

function DialogUI({
  opts,
  resolve,
  cleanup,
}: {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
  cleanup: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resolve(false);
        cleanup();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [resolve, cleanup]);

  // Prevent scroll under modal
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const confirmLabel = opts.confirmLabel || 'Continue';
  const cancelLabel = opts.cancelLabel || 'Cancel';
  const danger = opts.tone === 'danger';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] grid place-items-center bg-black/40 p-3"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) {
          resolve(false);
          cleanup();
        }
      }}
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl ring-1 ring-gray-200">
        <div className="p-4 sm:p-5">
          {opts.title && <h3 className="text-base font-semibold">{opts.title}</h3>}
          {opts.description && <p className="mt-2 text-sm text-gray-600">{opts.description}</p>}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="hx-btn hx-btn--secondary"
              onClick={() => {
                resolve(false);
                cleanup();
              }}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={
                danger
                  ? 'hx-btn hx-btn--secondary border-red-300 text-red-600 hover:bg-red-50'
                  : 'hx-btn hx-btn--primary'
              }
              onClick={() => {
                resolve(true);
                cleanup();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Friendly, promise-based confirm dialog.
 * Usage:
 *   const ok = await confirm({ title: 'Delete this?', description: "You can't undo this.", tone: 'danger', confirmLabel: 'Delete' });
 *   if (!ok) return;
 */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // SSR guard: default to false in non-browser environments
    return Promise.resolve(false);
  }

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  return new Promise<boolean>((resolve) => {
    const cleanup = () => {
      try {
        root.unmount();
      } catch {}
      if (host.parentNode) host.parentNode.removeChild(host);
    };

    root.render(<DialogUI opts={opts} resolve={resolve} cleanup={cleanup} />);
  });
}
