import nodemailer from 'nodemailer';
import { env, isProd } from '../config/env';
import { logs } from './logger';

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

if (!transport && isProd) logs.app.warn({ event: 'smtp_missing' }, 'SMTP не настроен: письма подтверждения не будут отправляться');

export async function sendMail(opts: { to: string; subject: string; text: string; html: string }) {
  if (!transport) {
    // Только консоль разработчика — в файлы логов ссылки и токены не попадают.
    console.log(`\n──────── DEV MAIL ────────\nTo: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}\n──────────────────────────\n`);
    return;
  }
  await transport.sendMail({ from: env.SMTP_FROM, ...opts });
}

export function mailTemplate(title: string, lead: string, buttonText: string, link: string) {
  const html = `<div style="font-family:Arial,sans-serif;background:#0d0f17;padding:32px"><div style="max-width:480px;margin:auto;background:#161926;border-radius:16px;padding:32px;color:#e9ebf5">
<h2 style="margin:0 0 12px;font-size:22px">${title}</h2><p style="color:#a3a8c0;line-height:1.5">${lead}</p>
<p style="margin:28px 0"><a href="${link}" style="background:linear-gradient(135deg,#8f7bff,#ff7a9a);color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">${buttonText}</a></p>
<p style="color:#7d829c;font-size:12px">Если кнопка не работает, откройте ссылку: ${link}<br/>Если это были не вы — просто проигнорируйте письмо.</p></div></div>`;
  return { html, text: `${title}\n\n${lead}\n\n${link}\n\nЕсли это были не вы — просто проигнорируйте письмо.` };
}
