import { logs } from './logger';
import { prisma } from './prisma';
import { removePrivate } from './storage';

const DAY = 86_400_000;
let timer: NodeJS.Timeout | null = null;

async function cleanup() {
  try {
    const week = new Date(Date.now() - 7 * DAY);
    const sessions = await prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: week } }, { revokedAt: { lt: week } }] } });
    const tokens = await prisma.emailToken.deleteMany({ where: { expiresAt: { lt: week } } });
    const events = await prisma.loginEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * DAY) } } });
    const orphans = await prisma.attachment.findMany({ where: { messageId: null, createdAt: { lt: new Date(Date.now() - DAY) } } });
    for (const a of orphans) await removePrivate(a.storageKey);
    if (orphans.length) await prisma.attachment.deleteMany({ where: { id: { in: orphans.map((a) => a.id) } } });
    logs.app.info({ event: 'cleanup_done', sessions: sessions.count, emailTokens: tokens.count, loginEvents: events.count, orphanFiles: orphans.length }, 'Housekeeping finished');
  } catch (err) {
    logs.errors.error({ event: 'cleanup_failed', err }, 'Housekeeping failed');
  }
}

export function startJobs() {
  setTimeout(cleanup, 30_000).unref();
  timer = setInterval(cleanup, 3_600_000);
  timer.unref();
}
export function stopJobs() {
  if (timer) clearInterval(timer);
}
