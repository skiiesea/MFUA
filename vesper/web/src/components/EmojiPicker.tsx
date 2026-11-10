import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

const SETS: Record<string, string[]> = {
  '😀': '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😋 😛 😜 🤪 😎 🤓 🥳 🤩 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫡 🤭 🤫 😶 😐 😑 😬 🙄 😯 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒'.split(' '),
  '👋': '👍 👎 👌 ✌️ 🤞 🫶 🤝 🙏 👏 🙌 👋 🤙 💪 🫰 🤟 🤘 👀 🧠 ✍️ 🙈 🙉 🙊'.split(' '),
  '❤️': '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 ✨ ⭐ 🌟 💫 🔥 💥 🎉 🎊 🎁 🏆 🥇'.split(' '),
  '🐱': '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🦄 🐝 🦋 🐢 🐙 🐬 🌸 🌹 🌻 🌲 🍀 🌈 ☀️ 🌙 ⚡ ❄️ 🌊'.split(' '),
  '🍕': '🍎 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🥑 🍕 🍔 🍟 🌭 🌮 🍣 🍜 🍩 🍪 🎂 🍫 🍿 ☕ 🍵 🍺 🍷 🥂'.split(' '),
  '⚽': '⚽ 🏀 🏈 🎾 🏐 🎮 🎲 🎯 🎵 🎧 🎸 📚 💻 📱 📷 ✈️ 🚗 🚀 🏠 💡 🔑 💰 📌 ✅ ❌ ❗ ❓ 💯'.split(' '),
};

export function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(Object.keys(SETS)[0]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', h);
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('pointerdown', h);
      window.removeEventListener('keydown', k);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="glass absolute bottom-full left-0 z-30 mb-2 w-[min(320px,calc(100vw-2rem))] rounded-2xl p-2 shadow-soft">
      <div className="mb-1 flex gap-1 border-b border-line/10 pb-1.5">
        {Object.keys(SETS).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={clsx('flex h-9 flex-1 items-center justify-center rounded-lg text-lg transition', tab === k ? 'bg-line/15' : 'opacity-60 hover:bg-line/10 hover:opacity-100')}>{k}</button>
        ))}
      </div>
      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto">
        {SETS[tab].map((e) => (
          <button key={e} onClick={() => onPick(e)} className="flex h-9 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-line/10">{e}</button>
        ))}
      </div>
    </div>
  );
}
