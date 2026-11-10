import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { env } from '../../config/env';
import { AppError, notFound } from '../../lib/errors';
import { ah } from '../../lib/http';
import { logs } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { privatePath, removePrivate, savePrivate } from '../../lib/storage';
import { requireAuth } from '../../middleware/auth';
import { uploadLimiter } from '../../middleware/rateLimit';

export const filesRouter = Router();
filesRouter.use(requireAuth);

const MAX_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 5 } });

const startsWith = (b: Buffer, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const isText = (b: Buffer) => {
  const head = b.subarray(0, 8192);
  if (head.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head.length === b.length ? head : head.subarray(0, head.length - 4));
    return true;
  } catch {
    return false;
  }
};

type Rule = { mime: string; image?: 'jpeg' | 'png' | 'webp' | 'gif'; sniff?: (b: Buffer) => boolean };
const ZIP = (b: Buffer) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);
const RULES: Record<string, Rule> = {
  jpg: { mime: 'image/jpeg', image: 'jpeg' },
  jpeg: { mime: 'image/jpeg', image: 'jpeg' },
  png: { mime: 'image/png', image: 'png' },
  webp: { mime: 'image/webp', image: 'webp' },
  gif: { mime: 'image/gif', image: 'gif' },
  pdf: { mime: 'application/pdf', sniff: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  txt: { mime: 'text/plain; charset=utf-8', sniff: isText },
  csv: { mime: 'text/csv; charset=utf-8', sniff: isText },
  zip: { mime: 'application/zip', sniff: ZIP },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sniff: ZIP },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sniff: ZIP },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sniff: ZIP },
  mp3: { mime: 'audio/mpeg', sniff: (b) => startsWith(b, [0x49, 0x44, 0x33]) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  mp4: { mime: 'video/mp4', sniff: (b) => startsWith(b, [0x66, 0x74, 0x79, 0x70], 4) },
};
export const ALLOWED_EXTENSIONS = Object.keys(RULES);

function cleanName(raw: string) {
  let name = raw;
  const utf = Buffer.from(raw, 'latin1').toString('utf8'); // multer отдаёт имя как latin1
  if (!utf.includes('\uFFFD')) name = utf;
  name = path.basename(name).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim();
  return (name || 'file').slice(0, 120);
}

filesRouter.post('/uploads', uploadLimiter, upload.array('files', 5), ah(async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw new AppError(400, 'NO_FILE', 'Выберите файл');
  const saved: string[] = [];
  try {
    const out = [];
    for (const f of files) {
      const name = cleanName(f.originalname);
      const ext = path.extname(name).slice(1).toLowerCase();
      const rule = RULES[ext];
      if (!rule) throw new AppError(415, 'UNSUPPORTED_TYPE', `Тип файла «.${ext || '?'}» не поддерживается`);
      if (f.size > MAX_BYTES) throw new AppError(413, 'TOO_LARGE', `Файл «${name}» больше ${env.MAX_UPLOAD_MB} МБ`);
      let buf = f.buffer;
      let width: number | undefined;
      let height: number | undefined;
      if (rule.image) {
        try {
          const img = sharp(buf, { limitInputPixels: 50_000_000, animated: rule.image === 'gif' });
          const meta = await img.metadata();
          if (meta.format !== rule.image) throw new Error('mismatch');
          if (rule.image !== 'gif') {
            // пересборка изображения удаляет EXIF (геолокацию и т.п.) и любые встроенные данные
            const r = img.rotate();
            buf = await (rule.image === 'jpeg' ? r.jpeg({ quality: 90 }) : rule.image === 'png' ? r.png() : r.webp({ quality: 90 })).toBuffer();
          }
          const m2 = await sharp(buf).metadata();
          width = m2.width;
          height = m2.pageHeight ?? m2.height;
        } catch {
          throw new AppError(400, 'BAD_IMAGE', `Файл «${name}» не является корректным изображением`);
        }
      } else if (!rule.sniff!(buf)) {
        throw new AppError(400, 'BAD_CONTENT', `Содержимое файла «${name}» не соответствует его типу`);
      }
      const key = await savePrivate(buf, ext === 'jpeg' ? 'jpg' : ext);
      saved.push(key);
      const att = await prisma.attachment.create({
        data: { uploaderId: req.auth!.user.id, kind: rule.image ? 'IMAGE' : 'FILE', storageKey: key, originalName: name, mime: rule.mime, size: buf.length, width, height },
      });
      out.push({ id: att.id, kind: att.kind, name: att.originalName, mime: att.mime, size: att.size, width: att.width, height: att.height, url: `/api/files/${att.id}` });
    }
    res.status(201).json({ attachments: out });
  } catch (e) {
    await Promise.all(saved.map((k) => removePrivate(k)));
    throw e;
  }
}));

filesRouter.delete('/uploads/:id', ah(async (req, res) => {
  const a = await prisma.attachment.findFirst({ where: { id: req.params.id, uploaderId: req.auth!.user.id, messageId: null } });
  if (!a) throw notFound('Файл не найден');
  await prisma.attachment.delete({ where: { id: a.id } });
  await removePrivate(a.storageKey);
  res.json({ ok: true });
}));

// Скачивание: только участникам чата, к которому прикреплён файл (или автору, пока файл не отправлен)
filesRouter.get('/files/:id', ah(async (req, res) => {
  const a = await prisma.attachment.findUnique({ where: { id: req.params.id }, include: { message: { select: { chatId: true, deletedAt: true } } } });
  if (!a) throw notFound('Файл не найден');
  const userId = req.auth!.user.id;
  if (a.message) {
    const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId: a.message.chatId, userId } } });
    if (!member || a.message.deletedAt) throw notFound('Файл не найден');
  } else if (a.uploaderId !== userId) throw notFound('Файл не найден');

  res.setHeader('Content-Type', a.mime);
  res.setHeader('Content-Length', String(a.size));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Content-Disposition', `${a.kind === 'IMAGE' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.originalName)}`);
  const stream = fs.createReadStream(privatePath(a.storageKey));
  stream.on('error', (err) => {
    logs.errors.error({ event: 'file_stream_error', err, attachmentId: a.id }, 'File stream failed');
    if (!res.headersSent) res.status(404).end();
    else res.destroy();
  });
  stream.pipe(res);
}));
