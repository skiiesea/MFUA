import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from './ui';

interface Props {
  file: File;
  aspect: number;
  outWidth: number;
  round?: boolean;
  title: string;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}

export function ImageCropper({ file, aspect, outWidth, round, title, onCancel, onDone }: Props) {
  const [url] = useState(() => URL.createObjectURL(file));
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const vw = Math.min(360, window.innerWidth - 72);
  const vh = vw / aspect;

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const base = nat ? Math.max(vw / nat.w, vh / nat.h) : 1;
  const scale = base * zoom;
  const clamp = (x: number, y: number, s = scale) => nat ? { x: Math.min(0, Math.max(vw - nat.w * s, x)), y: Math.min(0, Math.max(vh - nat.h * s, y)) } : { x, y };

  useEffect(() => {
    if (nat) setPos(clamp((vw - nat.w * base) / 2, (vh - nat.h * base) / 2, base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat]);

  const changeZoom = (z: number) => {
    if (!nat) return;
    const s2 = base * z;
    // зум относительно центра рамки
    const cx = (vw / 2 - pos.x) / scale;
    const cy = (vh / 2 - pos.y) / scale;
    setZoom(z);
    setPos(clamp(vw / 2 - cx * s2, vh / 2 - cy * s2, s2));
  };

  const confirm = () => {
    if (!nat || !imgRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = Math.round(outWidth / aspect);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgRef.current, -pos.x / scale, -pos.y / scale, vw / scale, vh / scale, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => b && onDone(b), 'image/jpeg', 0.92);
  };

  return (
    <Modal open onClose={onCancel} title={title} size="sm">
      <div className="flex flex-col items-center gap-5">
        <div
          className="relative touch-none select-none overflow-hidden rounded-2xl bg-black"
          style={{ width: vw, height: vh, cursor: 'grab' }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
          }}
          onPointerMove={(e) => drag.current && setPos(clamp(drag.current.x + e.clientX - drag.current.px, drag.current.y + e.clientY - drag.current.py))}
          onPointerUp={() => (drag.current = null)}
          onWheel={(e) => changeZoom(Math.min(4, Math.max(1, zoom - e.deltaY * 0.002)))}
        >
          <img
            ref={imgRef}
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
            style={{ width: nat ? nat.w : undefined, transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
          />
          <div className={round ? 'pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.55)]' : 'pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/30'} />
        </div>
        <label className="flex w-full items-center gap-3 text-sm text-muted">
          Масштаб
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => changeZoom(+e.target.value)} className="h-1.5 flex-1 cursor-pointer accent-[rgb(var(--c-accent))]" />
        </label>
        <div className="flex w-full gap-3">
          <Button variant="soft" className="flex-1" onClick={onCancel}>Отмена</Button>
          <Button className="flex-1" onClick={confirm} disabled={!nat}>Применить</Button>
        </div>
      </div>
    </Modal>
  );
}
