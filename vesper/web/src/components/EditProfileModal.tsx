import clsx from 'clsx';
import { Camera, CheckCircle2, Trash2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, errMsg } from '../lib/api';
import { ACCENTS, BG_PRESETS } from '../lib/color';
import { useAuth } from '../store/auth';
import { toast } from '../store/ui';
import type { Activity, Self } from '../types';
import { AppleEmojiText } from './AppleEmoji';
import { ImageCropper } from './ImageCropper';
import { ProfileHeader } from './ProfileHeader';
import { Button, Input, Modal, Segmented, Textarea } from './ui';

type Img = { blob: Blob | null; removed: boolean };
const ACTIVITY_OPTIONS: { value: Activity; label: string }[] = [
  { value: 'AUTO', label: 'В сети' },
  { value: 'FREE', label: 'Свободен' },
  { value: 'WORK', label: 'На работе' },
  { value: 'DND', label: 'Не беспокоить' },
  { value: 'OFFLINE', label: 'Не в сети' },
];

export function EditProfileModal({ user, onClose, onSaved }: { user: Self; onClose: () => void; onSaved: () => void }) {
  const setUser = useAuth((s) => s.setUser);
  const [d, setD] = useState({ displayName: user.displayName, username: user.username, statusText: user.statusText, about: user.about, accentColor: user.accentColor, profileBg: user.profileBg, activity: user.activity });
  const [avatar, setAvatar] = useState<Img>({ blob: null, removed: false });
  const [cover, setCover] = useState<Img>({ blob: null, removed: false });
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(user.avatarUrl);
  const [savedCoverUrl, setSavedCoverUrl] = useState(user.coverUrl);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [crop, setCrop] = useState<{ kind: 'avatar' | 'cover'; file: File } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uState, setUState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const statusDisplayRef = useRef<HTMLDivElement>(null);
  const aboutDisplayRef = useRef<HTMLDivElement>(null);

  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string | null>(null);
  const [coverObjectUrl, setCoverObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!avatar.blob) { setAvatarObjectUrl(null); return; }
    const objectUrl = URL.createObjectURL(avatar.blob);
    setAvatarObjectUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatar.blob]);
  useEffect(() => {
    if (!cover.blob) { setCoverObjectUrl(null); return; }
    const objectUrl = URL.createObjectURL(cover.blob);
    setCoverObjectUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [cover.blob]);
  const avatarPreview = avatar.blob ? avatarObjectUrl : avatar.removed ? null : savedAvatarUrl;
  const coverPreview = cover.blob ? coverObjectUrl : cover.removed ? null : savedCoverUrl;

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  useEffect(() => {
    const valid = /^[a-z0-9_]{3,24}$/.test(d.username);
    if (d.username === user.username || !valid) return setUState('idle');
    setUState('checking');
    const t = setTimeout(() => {
      api.get<{ available: boolean }>(`/users/availability?username=${d.username}`).then((r) => setUState(r.available ? 'free' : 'taken')).catch(() => setUState('idle'));
    }, 400);
    return () => clearTimeout(t);
  }, [d.username, user.username]);

  const pick = (kind: 'avatar' | 'cover') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return toast.error('Выберите изображение JPG, PNG, WebP или GIF');
    if (f.size > 8 * 1024 * 1024) return toast.error('Файл больше 8 МБ');
    setCrop({ kind, file: f });
  };

  const changeActivity = async (activity: Activity) => {
    set('activity', activity);
    try {
      const r = await api.patch<{ user: Self }>('/users/me', { ...d, activity });
      setUser(r.user);
      onSaved();
    } catch (e) {
      setD((current) => ({ ...current, activity: user.activity }));
      toast.error(errMsg(e));
    }
  };

  const applyImage = async (kind: 'avatar' | 'cover', blob: Blob) => {
    setMediaBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, `${kind}.jpg`);
      const r = await api.post<{ user: Self }>(`/users/me/${kind}`, fd);
      setUser(r.user);
      if (kind === 'avatar') {
        setSavedAvatarUrl(r.user.avatarUrl);
        setAvatar({ blob: null, removed: false });
      } else {
        setSavedCoverUrl(r.user.coverUrl);
        setCover({ blob: null, removed: false });
      }
      setCrop(null);
      onSaved();
      toast.success(kind === 'avatar' ? 'Аватар сохранён' : 'Обложка сохранена');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setMediaBusy(false);
    }
  };

  const removeImage = async (kind: 'avatar' | 'cover') => {
    setMediaBusy(true);
    try {
      const r = await api.del<{ user: Self }>(`/users/me/${kind}`);
      setUser(r.user);
      if (kind === 'avatar') {
        setSavedAvatarUrl(null);
        setAvatar({ blob: null, removed: false });
      } else {
        setSavedCoverUrl(null);
        setCover({ blob: null, removed: false });
      }
      onSaved();
      toast.success(kind === 'avatar' ? 'Аватар удалён' : 'Обложка удалена');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setMediaBusy(false);
    }
  };

  const save = async () => {
    const local: Record<string, string> = {};
    if (!d.displayName.trim()) local.displayName = 'Введите имя';
    if (!/^[a-z0-9_]{3,24}$/.test(d.username)) local.username = 'Логин: 3–24 символа — латиница, цифры и _';
    if (uState === 'taken') local.username = 'Этот логин уже занят';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      let r = await api.patch<{ user: Self }>('/users/me', d);
      const upload = async (kind: 'avatar' | 'cover', img: Img) => {
        if (img.blob) {
          const fd = new FormData();
          fd.append('file', img.blob, `${kind}.jpg`);
          r = await api.post<{ user: Self }>(`/users/me/${kind}`, fd);
        } else if (img.removed) r = await api.del<{ user: Self }>(`/users/me/${kind}`);
      };
      await upload('avatar', avatar);
      await upload('cover', cover);
      setUser(r.user);
      toast.success('Профиль обновлён');
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Редактирование профиля" size="xl">
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Так увидят ваш профиль</p>
          <ProfileHeader compact name={d.displayName} username={d.username} avatarUrl={avatarPreview} coverUrl={coverPreview} bg={d.profileBg} accent={d.accentColor} status={d.statusText} seed={user.id} presence={{ online: true, lastSeenAt: null, activity: d.activity === 'DND' || d.activity === 'WORK' || d.activity === 'FREE' ? d.activity : null }} />
        </div>

        <div className="flex flex-wrap gap-2">
          <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={pick('avatar')} />
          <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={pick('cover')} />
          <Button variant="soft" size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => avatarInput.current?.click()}>{avatarPreview ? 'Заменить аватар' : 'Загрузить аватар'}</Button>
          {avatarPreview && <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => void removeImage('avatar')} disabled={mediaBusy}>Удалить аватар</Button>}
          <Button variant="soft" size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => coverInput.current?.click()}>{coverPreview ? 'Заменить обложку' : 'Загрузить обложку'}</Button>
          {coverPreview && <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => void removeImage('cover')} disabled={mediaBusy}>Удалить обложку</Button>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Имя" value={d.displayName} maxLength={40} onChange={(e) => set('displayName', e.target.value)} error={errors.displayName} />
          <Input label="Username" value={d.username} maxLength={24} onChange={(e) => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))} error={errors.username}
            hint={uState === 'checking' ? 'Проверяем…' : uState === 'free' ? 'Свободен' : undefined}
            right={uState === 'free' ? <CheckCircle2 className="mx-3 h-4 w-4 text-ok" /> : uState === 'taken' ? <XCircle className="mx-3 h-4 w-4 text-danger" /> : undefined} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg/90" htmlFor="profile-status">Статус</label>
          <div className="relative">
            <div ref={statusDisplayRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 flex items-center overflow-hidden whitespace-pre px-4 text-sm text-fg">
              <AppleEmojiText text={d.statusText} size={14} />
            </div>
            <input id="profile-status" value={d.statusText} maxLength={100} onChange={(e) => set('statusText', e.target.value)} onScroll={(e) => { if (statusDisplayRef.current) statusDisplayRef.current.scrollLeft = e.currentTarget.scrollLeft; }} placeholder="Чем вы сейчас заняты?" aria-invalid={!!errors.statusText} className={clsx('w-full rounded-xl border bg-raised/70 px-4 h-11 text-sm text-transparent caret-fg placeholder:text-muted/70 selection:bg-accent/30 transition focus:outline-none focus:ring-4', errors.statusText ? 'border-danger/60 focus:border-danger focus:ring-danger/15' : 'border-line/10 hover:border-line/20 focus:border-accent/70 focus:ring-accent/15')} />
          </div>
          {errors.statusText ? <p className="mt-1.5 text-xs text-danger" role="alert">{errors.statusText}</p> : <p className="mt-1.5 text-xs text-muted">{d.statusText.length}/100</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg/90" htmlFor="profile-about">О себе</label>
          <div className="relative">
            <div ref={aboutDisplayRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 text-sm leading-5 text-fg">
              <AppleEmojiText text={d.about} size={14} />
            </div>
            <textarea id="profile-about" value={d.about} maxLength={500} onChange={(e) => set('about', e.target.value)} onScroll={(e) => { if (aboutDisplayRef.current) aboutDisplayRef.current.scrollTop = e.currentTarget.scrollTop; }} placeholder="Расскажите о себе в паре предложений" aria-invalid={!!errors.about} className={clsx('min-h-[88px] w-full resize-y rounded-xl border bg-raised/70 px-4 py-3 text-sm leading-5 text-transparent caret-fg placeholder:text-muted/70 selection:bg-accent/30 transition focus:outline-none focus:ring-4', errors.about ? 'border-danger/60 focus:border-danger focus:ring-danger/15' : 'border-line/10 hover:border-line/20 focus:border-accent/70 focus:ring-accent/15')} />
          </div>
          {errors.about ? <p className="mt-1.5 text-xs text-danger" role="alert">{errors.about}</p> : <p className="mt-1.5 text-xs text-muted">{d.about.length}/500</p>}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Доступность</p>
          <Segmented value={d.activity} onChange={(v) => void changeActivity(v)} options={ACTIVITY_OPTIONS} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Акцентный цвет профиля</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={() => set('accentColor', null)} className={clsx('flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition', d.accentColor === null ? 'border-accent text-fg' : 'border-line/15 text-muted hover:text-fg')}>Как в моих настройках</button>
            {ACCENTS.map((a) => (
              <button key={a.hex} aria-label={a.name} title={a.name} onClick={() => set('accentColor', a.hex)} className={clsx('h-9 w-9 rounded-full ring-offset-2 ring-offset-surface transition active:scale-90', d.accentColor === a.hex && 'ring-2 ring-fg')} style={{ background: a.hex }} />
            ))}
            <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border border-line/20" title="Свой цвет">
              <input type="color" value={d.accentColor ?? '#8f7bff'} onChange={(e) => set('accentColor', e.target.value)} className="absolute -inset-2 h-14 w-14 cursor-pointer" aria-label="Свой цвет" />
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Фон шапки <span className="font-normal text-muted">(если нет загруженной обложки)</span></p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <button onClick={() => set('profileBg', null)} className={clsx('h-14 rounded-xl border text-xs font-semibold transition', d.profileBg === null ? 'border-accent text-fg' : 'border-line/15 text-muted')}>Авто</button>
            {Object.entries(BG_PRESETS).map(([k, v]) => (
              <button key={k} onClick={() => set('profileBg', k)} aria-label={v.name} title={v.name} className={clsx('h-14 rounded-xl ring-offset-2 ring-offset-surface transition active:scale-95', d.profileBg === k && 'ring-2 ring-fg')} style={{ backgroundImage: v.css }} />
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="soft" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" loading={busy} onClick={save}>Сохранить</Button>
        </div>
      </div>
      {crop && (
        <ImageCropper file={crop.file} aspect={crop.kind === 'avatar' ? 1 : 1600 / 560} outWidth={crop.kind === 'avatar' ? 512 : 1600} round={crop.kind === 'avatar'} title={crop.kind === 'avatar' ? 'Кадрирование аватара' : 'Кадрирование обложки'}
          onCancel={() => setCrop(null)}
          onDone={(blob) => { void applyImage(crop.kind, blob); }} />
      )}
    </Modal>
  );
}
