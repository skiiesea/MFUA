import { useState } from 'react';
import { api, errMsg } from '../lib/api';
import { toast } from '../store/ui';
import { Button, Modal, Select, Textarea } from './ui';

const REASONS = [
  { value: 'SPAM', label: 'Спам или реклама' },
  { value: 'ABUSE', label: 'Оскорбления или угрозы' },
  { value: 'FAKE', label: 'Поддельный аккаунт' },
  { value: 'ILLEGAL', label: 'Незаконный контент' },
  { value: 'OTHER', label: 'Другое' },
];

export function ReportModal({ userId, userName, messageId, onClose }: { userId: string; userName: string; messageId?: string; onClose: () => void }) {
  const [reason, setReason] = useState('SPAM');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/reports', { userId, messageId, reason, details: details.trim() || undefined });
      toast.success('Жалоба отправлена. Спасибо, мы проверим.');
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={messageId ? 'Пожаловаться на сообщение' : `Пожаловаться на ${userName}`}>
      <div className="space-y-4">
        {messageId && <p className="text-sm text-muted">Администратор увидит текст этого сообщения, чтобы разобраться в ситуации. Остальная переписка ему недоступна.</p>}
        <Select label="Причина" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
        <Textarea label="Подробности (необязательно)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Что произошло?" />
        <div className="flex gap-3">
          <Button variant="soft" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" loading={busy} onClick={submit}>Отправить</Button>
        </div>
      </div>
    </Modal>
  );
}
