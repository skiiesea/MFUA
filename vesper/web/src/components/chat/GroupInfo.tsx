import { Camera, Crown, LogOut, Plus, Shield, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../../lib/api';
import { presenceText } from '../../lib/format';
import { useAuth } from '../../store/auth';
import { useChats } from '../../store/chat';
import { useFriends } from '../../store/friends';
import { toast } from '../../store/ui';
import type { Chat, ChatMember } from '../../types';
import { Avatar } from '../Avatar';
import { ImageCropper } from '../ImageCropper';
import { Button, IconButton, Input, Modal, Spinner, Textarea } from '../ui';

const ROLE: Record<ChatMember['role'], string> = { OWNER: 'Владелец', ADMIN: 'Администратор', MEMBER: '' };

export function GroupInfo({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  const me = useAuth((s) => s.user)!;
  const upsert = useChats((s) => s.upsertChat);
  const removeChat = useChats((s) => s.removeChat);
  const navigate = useNavigate();
  const friends = useFriends((s) => s.data?.friends);
  const staff = chat.myRole !== 'MEMBER';
  const isOwner = chat.myRole === 'OWNER';
  const [title, setTitle] = useState(chat.title ?? '');
  const [desc, setDesc] = useState(chat.description ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [crop, setCrop] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const call = async <T,>(key: string, fn: () => Promise<T>) => {
    setBusy(key);
    try {
      return await fn();
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    } finally {
      setBusy(null);
    }
  };
  const apply = (r: { chat: Chat } | null) => r && upsert(r.chat);

  const save = async () => {
    const r = await call('save', () => api.patch<{ chat: Chat }>(`/chats/${chat.id}`, { title: title.trim(), description: desc.trim() }));
    if (r) { apply(r); toast.success('Изменения сохранены'); }
  };
  const uploadAvatar = async (blob: Blob) => {
    setCrop(null);
    const fd = new FormData();
    fd.append('file', blob, 'group.jpg');
    apply(await call('avatar', () => api.post<{ chat: Chat }>(`/chats/${chat.id}/avatar`, fd)));
  };
  const leave = async () => {
    const r = await call('leave', () => api.post(`/chats/${chat.id}/leave`));
    if (r) { removeChat(chat.id); onClose(); navigate('/messages'); toast.success('Вы вышли из группы'); }
  };
  const canRemove = (m: ChatMember) => m.userId !== me.id && m.role !== 'OWNER' && (isOwner || (chat.myRole === 'ADMIN' && m.role === 'MEMBER'));
  const candidates = (friends ?? []).filter((f) => !chat.members.some((m) => m.userId === f.user.id));

  return (
    <Modal open onClose={onClose} title="О группе" size="lg">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar name={chat.title ?? 'Группа'} src={chat.avatarUrl} seed={chat.id} size={72} />
            {staff && (
              <>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop(f); e.target.value = ''; }} />
                <button onClick={() => fileRef.current?.click()} aria-label="Сменить аватар группы" className="grad absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-glow ring-2 ring-surface">
                  {busy === 'avatar' ? <Spinner className="h-4 w-4 text-white" /> : <Camera className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {staff ? <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /> : <><h3 className="truncate font-display text-lg font-semibold">{chat.title}</h3><p className="mt-1 text-sm text-muted">{chat.description || 'Без описания'}</p></>}
          </div>
        </div>
        {staff && (
          <>
            <Textarea label="Описание" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} placeholder="О чём эта группа?" />
            <Button onClick={save} loading={busy === 'save'} disabled={!title.trim() || (title.trim() === chat.title && desc.trim() === (chat.description ?? ''))}>Сохранить</Button>
          </>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">Участники · {chat.members.length}</h3>
            {staff && <Button size="sm" variant="soft" icon={<UserPlus className="h-4 w-4" />} onClick={() => { setAdding((v) => !v); if (!friends) void useFriends.getState().load(); }}>Добавить</Button>}
          </div>
          {adding && (
            <div className="mb-3 rounded-2xl bg-raised/60 p-3">
              {!friends ? <Spinner className="mx-auto" /> : candidates.length === 0 ? <p className="py-3 text-center text-sm text-muted">Все ваши друзья уже в группе. В группу можно добавлять только друзей.</p> : (
                <>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {candidates.map((f) => (
                      <label key={f.user.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-line/10">
                        <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-accent))]" checked={picked.includes(f.user.id)} onChange={() => setPicked((p) => (p.includes(f.user.id) ? p.filter((x) => x !== f.user.id) : [...p, f.user.id]))} />
                        <Avatar name={f.user.displayName} src={f.user.avatarUrl} seed={f.user.id} size={32} />
                        <span className="truncate text-sm font-medium">{f.user.displayName}</span>
                      </label>
                    ))}
                  </div>
                  <Button className="mt-3 w-full" size="sm" icon={<Plus className="h-4 w-4" />} disabled={!picked.length} loading={busy === 'add'}
                    onClick={async () => { const r = await call('add', () => api.post<{ chat: Chat }>(`/chats/${chat.id}/members`, { userIds: picked })); if (r) { apply(r); setPicked([]); setAdding(false); toast.success('Участники добавлены'); } }}>
                    Добавить ({picked.length})
                  </Button>
                </>
              )}
            </div>
          )}
          <ul className="divide-y divide-line/5">
            {chat.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.user.displayName} src={m.user.avatarUrl} seed={m.userId} size={40} presence={m.user.presence} />
                <button className="min-w-0 flex-1 text-left" onClick={() => { onClose(); navigate(`/@${m.user.username}`); }}>
                  <span className="flex items-center gap-2 truncate text-sm font-semibold">{m.user.displayName}{m.userId === me.id && <span className="text-xs font-normal text-muted">(вы)</span>}</span>
                  <span className="block truncate text-xs text-muted">{ROLE[m.role] ? <span className="inline-flex items-center gap-1 text-accent">{m.role === 'OWNER' ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}{ROLE[m.role]}</span> : presenceText(m.user.presence) || `@${m.user.username}`}</span>
                </button>
                {isOwner && m.role !== 'OWNER' && (
                  <IconButton label={m.role === 'ADMIN' ? 'Снять права администратора' : 'Назначить администратором'} active={m.role === 'ADMIN'} disabled={busy === `r${m.userId}`}
                    onClick={async () => apply(await call(`r${m.userId}`, () => api.patch<{ chat: Chat }>(`/chats/${chat.id}/members/${m.userId}`, { role: m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN' })))}>
                    <Shield className="h-5 w-5" />
                  </IconButton>
                )}
                {canRemove(m) && (
                  <IconButton label={`Удалить ${m.user.displayName} из группы`} className="hover:!text-danger" disabled={busy === `d${m.userId}`}
                    onClick={async () => apply(await call(`d${m.userId}`, () => api.del<{ chat: Chat }>(`/chats/${chat.id}/members/${m.userId}`)))}>
                    <UserMinus className="h-5 w-5" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </div>

        {confirmLeave ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4">
            <p className="text-sm">{isOwner && chat.members.length > 1 ? 'Вы владелец: права перейдут другому участнику. Выйти из группы?' : chat.members.length === 1 ? 'Вы последний участник — группа будет удалена вместе с перепиской.' : 'Выйти из группы?'}</p>
            <div className="mt-3 flex gap-3"><Button variant="soft" size="sm" onClick={() => setConfirmLeave(false)}>Отмена</Button><Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} loading={busy === 'leave'} onClick={leave}>Выйти</Button></div>
          </div>
        ) : (
          <Button variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={() => setConfirmLeave(true)}>Покинуть группу</Button>
        )}
      </div>
      {crop && <ImageCropper file={crop} aspect={1} outWidth={512} round title="Аватар группы" onCancel={() => setCrop(null)} onDone={uploadAvatar} />}
    </Modal>
  );
}
