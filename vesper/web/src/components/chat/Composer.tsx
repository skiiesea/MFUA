import clsx from 'clsx';
import { Ban, FileText, Loader2, Paperclip, Pencil, Reply, Send, Smile, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errMsg } from '../../lib/api';
import { fmtSize } from '../../lib/format';
import { fire } from '../../lib/socket';
import { toast } from '../../store/ui';
import type { AttachmentDto, Chat, Message } from '../../types';
import { EmojiPicker } from '../EmojiPicker';
import { IconButton } from '../ui';

const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.zip,.docx,.xlsx,.pptx,.mp3,.mp4';

interface Props {
  chat: Chat;
  replyTo: Message | null;
  editing: Message | null;
  onCancel: () => void;
  onSend: (text: string, attachments: AttachmentDto[]) => void;
  onEdit: (text: string) => void;
}

export function Composer({ chat, replyTo, editing, onCancel, onSend, onEdit }: Props) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<AttachmentDto[]>([]);
  const [uploading, setUploading] = useState(0);
  const [emoji, setEmoji] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingSent = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  useEffect(() => {
    if (editing) setText(editing.text);
    else if (!replyTo) setText((t) => t);
    ref.current?.focus();
    setTimeout(resize, 0);
  }, [editing, replyTo, resize]);

  useEffect(() => {
    setText('');
    setFiles([]);
    setTimeout(resize, 0);
  }, [chat.id, resize]);

  const stopTyping = () => {
    clearTimeout(stopTimer.current);
    if (typingSent.current) fire('typing', { chatId: chat.id, typing: false });
    typingSent.current = 0;
  };
  useEffect(() => stopTyping, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (v: string) => {
    setText(v);
    resize();
    if (editing) return;
    const now = Date.now();
    if (v && now - typingSent.current > 2500) {
      fire('typing', { chatId: chat.id, typing: true });
      typingSent.current = now;
    }
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(stopTyping, 3000);
  };

  const upload = async (list: FileList | File[]) => {
    const arr = [...list];
    if (!arr.length) return;
    if (files.length + arr.length > 5) return toast.error('Можно прикрепить не больше 5 файлов');
    const fd = new FormData();
    arr.forEach((f) => fd.append('files', f));
    setUploading((n) => n + arr.length);
    try {
      const r = await api.post<{ attachments: AttachmentDto[] }>('/uploads', fd);
      setFiles((f) => [...f, ...r.attachments]);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading((n) => n - arr.length);
    }
  };

  const removeFile = (a: AttachmentDto) => {
    setFiles((f) => f.filter((x) => x.id !== a.id));
    api.del(`/uploads/${a.id}`).catch(() => {});
  };

  const canSubmit = !uploading && (editing ? text.trim().length > 0 : text.trim().length > 0 || files.length > 0);
  const submit = () => {
    if (!canSubmit) return;
    stopTyping();
    if (editing) onEdit(text.trim());
    else onSend(text.trim(), files);
    setText('');
    setFiles([]);
    setEmoji(false);
    setTimeout(resize, 0);
  };

  if (!chat.canSend && !editing) {
    return (
      <div className="safe-b flex items-center justify-center gap-2 border-t border-line/10 bg-surface/60 px-4 py-4 text-sm text-muted">
        <Ban className="h-4 w-4" />
        {chat.sendBlockReason === 'BLOCKED' ? 'Вы не можете писать этому пользователю' : 'Пользователь ограничил круг тех, кто может ему писать'}
      </div>
    );
  }

  return (
    <div className="safe-b relative border-t border-line/10 bg-surface/60 px-3 pb-3 pt-2 backdrop-blur-xl sm:px-5">
      {(replyTo || editing) && (
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-raised px-3 py-2">
          {editing ? <Pencil className="h-4 w-4 shrink-0 text-accent" /> : <Reply className="h-4 w-4 shrink-0 text-accent" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold text-accent">{editing ? 'Редактирование' : replyTo!.sender.displayName}</p>
            <p className="truncate text-muted">{(editing ?? replyTo)!.text || 'Вложение'}</p>
          </div>
          <IconButton label="Отменить" onClick={() => { onCancel(); if (editing) setText(''); }} className="h-8 w-8"><X className="h-4 w-4" /></IconButton>
        </div>
      )}
      {(files.length > 0 || uploading > 0) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((a) => (
            <div key={a.id} className="group relative flex items-center gap-2 rounded-xl bg-raised p-1.5 pr-8">
              {a.kind === 'IMAGE' ? <img src={a.url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent"><FileText className="h-5 w-5" /></span>}
              <span className="max-w-[140px] text-xs"><span className="block truncate font-semibold">{a.name}</span><span className="text-muted">{fmtSize(a.size)}</span></span>
              <button onClick={() => removeFile(a)} aria-label={`Убрать ${a.name}`} className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-line/20 text-muted hover:bg-danger hover:text-white"><X className="h-3 w-3" /></button>
            </div>
          ))}
          {uploading > 0 && <div className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-raised"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        {!editing && (
          <>
            <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
            <IconButton label="Прикрепить файл" onClick={() => fileRef.current?.click()}><Paperclip className="h-5 w-5" /></IconButton>
          </>
        )}
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={ref}
            value={text}
            rows={1}
            maxLength={4000}
            placeholder="Написать сообщение…"
            aria-label="Сообщение"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover)').matches) {
                e.preventDefault();
                submit();
              }
              if (e.key === 'Escape' && (editing || replyTo)) onCancel();
            }}
            onPaste={(e) => {
              const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
              if (imgs.length && !editing) {
                e.preventDefault();
                void upload(imgs.map((f, i) => (f.name === 'image.png' ? new File([f], `screenshot-${Date.now()}-${i}.png`, { type: f.type }) : f)));
              }
            }}
            className="no-scrollbar block max-h-[150px] w-full resize-none rounded-2xl border border-line/10 bg-raised py-3 pl-4 pr-11 text-[15px] leading-snug placeholder:text-muted/70 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
          <button type="button" onClick={() => setEmoji((v) => !v)} aria-label="Эмодзи" className={clsx('absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-line/10', emoji ? 'text-accent' : 'text-muted')}>
            <Smile className="h-5 w-5" />
          </button>
          {emoji && <EmojiPicker onClose={() => setEmoji(false)} onPick={(e) => { setText((t) => t + e); ref.current?.focus(); }} />}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          aria-label={editing ? 'Сохранить' : 'Отправить'}
          className="grad flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow transition active:scale-90 disabled:opacity-40 disabled:shadow-none"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
