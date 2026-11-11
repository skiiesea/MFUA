import { useState } from 'react';

const APPLE_EMOJI_BASE = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/';

export function emojiUnified(value: string): string {
  return Array.from(value)
    .map((char) => char.codePointAt(0)!.toString(16))
    .join('-');
}

export function AppleEmoji({ value, size = 22, className = '' }: { value: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={className}>{value}</span>;
  return (
    <img
      src={`${APPLE_EMOJI_BASE}${emojiUnified(value)}.png`}
      alt={value}
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', verticalAlign: '-0.18em', display: 'inline-block' }}
    />
  );
}

const graphemeSegmenter = typeof Intl.Segmenter !== 'undefined'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

function isEmoji(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value) || /[0-9#*]\uFE0F?\u20E3/u.test(value) || /\p{Regional_Indicator}{2}/u.test(value);
}

export function AppleEmojiText({ text, size = 18 }: { text: string; size?: number }) {
  if (!graphemeSegmenter) return <>{text}</>;
  return (
    <>
      {[...graphemeSegmenter.segment(text)].map(({ segment }, index) =>
        isEmoji(segment)
          ? <AppleEmoji key={index} value={segment} size={size} />
          : <span key={index}>{segment}</span>,
      )}
    </>
  );
}
