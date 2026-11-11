import clsx from 'clsx';
import { Check, CheckCheck, Download, FileText, MoreHorizontal, Pin, RotateCcw, Loader2 } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { fmtSize, fmtTime } from '../../lib/format';
import type { Chat, Message } from '../../types';
import { Avatar } from '../Avatar';
import { AppleEmoji, AppleEmojiText } from '../AppleEmoji';

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]"'])/g;
const MENTION_RE = /(@[a-z0-9_]{3,24})/gi;

function Rich({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-2 hover:opacity-80">{p}</a>
        ) : (
          p.split(MENTION_RE).map((q, j) => (j % 2 === 1 ? <span key={`${i}-${j}`} className={clsx('font-semibold', mine ? 'text-white' : 'text-accent')}>{q}</span> : <AppleEmojiText text={q} />))
        ),
      )}
    </>
  );
}

export function Ticks({ status, mine }: { status: 'sent' | 'delivered' | 'read'; mine?: boolean }) {
  const cls = status === 'read' ? (mine ? 'text-white' : 'text-accent') : mine ? 'text-white/60' : 'text-muted';
  return status === 'sent' ? <Check className={clsx('h-3.5 w-3.5', cls)} aria-label="отправлено" /> : <CheckCheck className={clsx('h-3.5 w-3.5', cls)} aria-label={status === 'read' ? 'прочитано' : 'доставлено'} />;
}

interface Props {
  m: Message;
  chat: Chat;
  mine: boolean;
  meId: string;
  first: boolean;
  last: boolean;
  status: 'sent' | 'delivered' | 'read';
  highlight: boolean;
  onMenu: (e: React.MouseEvent, m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
  onJump: (id: string) => void;
  onImage: (url: string) => void;
  onRetry: (m: Message) => void;
}

function BubbleImpl({ m, chat, mine, meId, first, last, status, highlight, onMenu, onReact, onJump, onImage, onRetry }: Props) {
  const images = m.attachments.filter((a) => a.kind === 'IMAGE');
  const files = m.attachments.filter((a) => a.kind === 'FILE');
  const group = chat.type === 'GROUP';
  const imageOnly = images.length > 0 && !m.text && files.length === 0 && !m.replyTo;

  const radius = mine
    ? clsx('rounded-2xl', first ? '' : 'rounded-tr-md', last ? 'rounded-br-md' : 'rounded-br-md')
    : clsx('rounded-2xl', first ? '' : 'rounded-tl-md', last ? 'rounded-bl-md' : 'rounded-bl-md');

  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMenu(e, m);
  };

  return (
    <div id={`msg-${m.id}`} className={clsx('group flex gap-2 rounded-xl px-1 sm:px-2', mine ? 'justify-end' : 'justify-start', first ? 'mt-3' : 'mt-0.5', highlight && 'animate-flash')} onContextMenu={(e) => { e.preventDefault(); onMenu(e, m); }}>
      {!mine && group && (
        <div className="w-8 shrink-0 self-end">{last && <Avatar name={m.sender.displayName} src={m.sender.avatarUrl} seed={m.senderId} size={32} />}</div>
      )}
      <div className={clsx('flex max-w-[85%] items-center gap-1 sm:max-w-[68%]', mine ? 'flex-row-reverse' : 'flex-row')}>
        <div className={clsx('min-w-0', mine ? 'items-end' : 'items-start', 'flex flex-col')}>
          <div
            className={clsx(
              'relative overflow-hidden text-[15px] leading-snug shadow-sm',
              radius,
              imageOnly ? 'bg-transparent p-0' : mine ? 'grad px-3.5 py-2 text-white' : 'bg-raised px-3.5 py-2',
              m.pending === 'sending' && 'opacity-70',
            )}
          >
            {group && !mine && first && <p className="mb-0.5 text-[13px] font-bold text-accent">{m.sender.displayName}</p>}
            {m.replyTo && (
              <button onClick={() => onJump(m.replyTo!.id)} className={clsx('mb-1.5 block w-full rounded-lg border-l-[3px] py-1 pl-2.5 pr-2 text-left text-[13px] transition hover:opacity-80', mine ? 'border-white/70 bg-black/15' : 'border-accent bg-accent/10')}>
                <span className={clsx('block font-bold', mine ? 'text-white' : 'text-accent')}>{m.replyTo.senderName}</span>
                <span className={clsx('line-clamp-2 break-words', mine ? 'text-white/85' : 'text-muted')}>
                  {m.replyTo.deleted ? 'Сообщение удалено' : <AppleEmojiText text={m.replyTo.text || (m.replyTo.hasAttachment ? 'Вложение' : '')} />}
                </span>
              </button>
            )}
            {images.length > 0 && (
              <div className={clsx('grid gap-1', images.length > 1 ? 'grid-cols-2' : 'grid-cols-1', (m.text || files.length > 0) && '-mx-1 mb-1.5 mt-0.5')}>
                {images.map((a) => (
                  <button key={a.id} onClick={() => onImage(a.url)} className="block overflow-hidden rounded-xl bg-black/20" aria-label={`Открыть изображение ${a.name}`}>
                    <img src={a.url} alt={a.name} loading="lazy" className="max-h-72 w-full object-cover transition hover:scale-[1.02]" style={{ aspectRatio: images.length === 1 && a.width && a.height ? `${a.width}/${a.height}` : '1/1', maxWidth: 360 }} />
                  </button>
                ))}
              </div>
            )}
            {files.map((a) => (
              <a key={a.id} href={a.url} download={a.name} className={clsx('mb-1.5 flex items-center gap-3 rounded-xl p-2 pr-3 transition hover:opacity-85', mine ? 'bg-black/15' : 'bg-line/10')}>
                <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', mine ? 'bg-white/20' : 'bg-accent/15 text-accent')}><FileText className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.name}</span><span className={clsx('text-xs', mine ? 'text-white/70' : 'text-muted')}>{fmtSize(a.size)}</span></span>
                <Download className="h-4 w-4 shrink-0 opacity-70" />
              </a>
            ))}
            {m.text && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"><Rich text={m.text} mine={mine} /></p>}
            <div className={clsx('mt-0.5 flex items-center justify-end gap-1 text-[11px]', mine ? 'text-white/70' : 'text-muted', imageOnly && 'absolute bottom-1.5 right-1.5 rounded-full bg-black/55 px-2 py-0.5 text-white/90')}>
              {m.pinned && <Pin className="h-3 w-3" />}
              {m.editedAt && <span>изм.</span>}
              <span>{fmtTime(m.createdAt)}</span>
              {mine && (m.pending === 'sending' ? <Loader2 className="h-3 w-3 animate-spin" /> : m.pending === 'failed' ? null : <Ticks status={status} mine />)}
            </div>
          </div>
          {m.pending === 'failed' && (
            <button onClick={() => onRetry(m)} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-danger hover:underline"><RotateCcw className="h-3.5 w-3.5" />Не отправлено. Повторить</button>
          )}
          {m.reactions.length > 0 && (
            <div className={clsx('mt-1 flex flex-wrap gap-1', mine ? 'justify-end' : 'justify-start')}>
              {m.reactions.map((r) => {
                const meReacted = r.userIds.includes(meId);
                return (
                  <button key={r.emoji} onClick={() => onReact(m, r.emoji)} className={clsx('inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold transition active:scale-90', meReacted ? 'border-accent/60 bg-accent/20 text-fg' : 'border-line/10 bg-raised text-muted hover:border-line/25')}>
                    <AppleEmoji value={r.emoji} size={17} />{r.userIds.length}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {!m.pending && (
          <button onClick={open} aria-label="Действия с сообщением" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted opacity-0 transition hover:bg-line/10 hover:text-fg focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = memo(BubbleImpl);

export function DaySeparator({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-2 z-10 my-4 flex justify-center">
      <span className="glass rounded-full px-3.5 py-1 text-xs font-semibold text-muted shadow-soft">{children}</span>
    </div>
  );
}
