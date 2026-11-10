import type { NotifSettings } from '../types';

let ctx: AudioContext | null = null;
const TONES: Record<NotifSettings['tone'], { f: number[]; type: OscillatorType; dur: number }> = {
  soft: { f: [660, 880], type: 'sine', dur: 0.16 },
  bell: { f: [988, 1319, 1568], type: 'triangle', dur: 0.14 },
  pop: { f: [520, 390], type: 'square', dur: 0.07 },
};

/** Короткие тоны синтезируются на лету — никаких аудиофайлов. */
export function playTone(tone: NotifSettings['tone'], volume: number) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const { f, type, dur } = TONES[tone];
    const t0 = ctx.currentTime;
    f.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const start = t0 + i * dur * 0.9;
      const peak = Math.max(0.0001, (volume / 100) * (type === 'square' ? 0.06 : 0.16));
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  } catch {
    /* звук недоступен — не критично */
  }
}
