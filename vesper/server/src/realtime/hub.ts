import type { Server } from 'socket.io';

let io: Server | null = null;
const sockets = new Map<string, Set<string>>();

export const setIo = (s: Server) => {
  io = s;
};
export const getIo = () => io;

export function emitToUser(userId: string, event: string, payload?: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
export function emitToUsers(ids: Iterable<string>, event: string, payload?: unknown) {
  for (const id of new Set(ids)) emitToUser(id, event, payload);
}

/** Возвращает true, если это первое соединение пользователя. */
export function addSocket(userId: string, socketId: string): boolean {
  let set = sockets.get(userId);
  if (!set) sockets.set(userId, (set = new Set()));
  set.add(socketId);
  return set.size === 1;
}
/** Возвращает true, если это было последнее соединение пользователя. */
export function removeSocket(userId: string, socketId: string): boolean {
  const set = sockets.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    sockets.delete(userId);
    return true;
  }
  return false;
}
export const isOnline = (userId: string) => (sockets.get(userId)?.size ?? 0) > 0;
export const onlineCount = () => sockets.size;

export const disconnectSession = (sessionId: string) => void io?.in(`session:${sessionId}`).disconnectSockets(true);
export const disconnectUser = (userId: string) => void io?.in(`user:${userId}`).disconnectSockets(true);
