import type { CSSProperties } from 'react';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Из одного акцентного цвета получаем пару для градиента: второй — со сдвигом оттенка. */
export function accentPair(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [r2, g2, b2] = hslToRgb((h + 48) % 360, Math.min(1, s * 1.05), Math.min(0.72, Math.max(0.58, l + 0.04)));
  return { a: `${r} ${g} ${b}`, b: `${r2} ${g2} ${b2}` };
}

export function accentVars(hex?: string | null): CSSProperties | undefined {
  if (!hex) return undefined;
  const { a, b } = accentPair(hex);
  return { '--c-accent': a, '--c-accent2': b } as CSSProperties;
}

export const ACCENTS = [
  { name: 'Сумерки', hex: '#8f7bff' },
  { name: 'Рассвет', hex: '#ff7a9a' },
  { name: 'Бирюза', hex: '#2dd4bf' },
  { name: 'Янтарь', hex: '#f5a524' },
  { name: 'Океан', hex: '#4f9dff' },
  { name: 'Мята', hex: '#4ade80' },
];

export const BG_PRESETS: Record<string, { name: string; css: string }> = {
  dusk: { name: 'Сумерки', css: 'linear-gradient(120deg,#2b2160 0%,#6a3fa8 45%,#d4577f 100%)' },
  aurora: { name: 'Аврора', css: 'linear-gradient(120deg,#0b3b4a 0%,#1f8a8a 45%,#7be0a8 100%)' },
  ember: { name: 'Янтарь', css: 'linear-gradient(120deg,#3b1320 0%,#a8392f 50%,#f5a24b 100%)' },
  ocean: { name: 'Океан', css: 'linear-gradient(120deg,#0e1a4a 0%,#2c4fb3 50%,#5cc3ff 100%)' },
  forest: { name: 'Лес', css: 'linear-gradient(120deg,#0e2a22 0%,#1f6b4f 50%,#a6d96a 100%)' },
  graphite: { name: 'Графит', css: 'linear-gradient(120deg,#14161f 0%,#2a2e3f 55%,#4a4f66 100%)' },
};
