import { io, type Socket } from 'socket.io-client';
import { ApiError } from './api';

let socket: Socket | null = null;

export const getSocket = () => socket;

export function openSocket(): Socket {
  if (!socket) socket = io({ withCredentials: true, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
  return socket;
}

export function closeSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

/** Событие с подтверждением от сервера (ack). Ошибки приходят как ApiError. */
export function request<T = Record<string, unknown>>(event: string, data: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new ApiError(0, 'OFFLINE', 'Нет соединения с сервером. Переподключаемся…'));
      return;
    }
    socket.timeout(10_000).emit(event, data, (err: Error | null, res: { ok?: boolean; error?: { code: string; message: string } } & T) => {
      if (err) return reject(new ApiError(0, 'TIMEOUT', 'Сервер не ответил. Попробуйте ещё раз.'));
      if (!res?.ok) return reject(new ApiError(0, res?.error?.code ?? 'ERROR', res?.error?.message ?? 'Не удалось выполнить действие'));
      resolve(res);
    });
  });
}

export function fire(event: string, data: unknown) {
  if (socket?.connected) socket.emit(event, data);
}
