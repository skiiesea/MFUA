import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { AppError } from './errors';

export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const k = issue.path.join('.') || '_';
    if (!fields[k]) fields[k] = issue.message;
  }
  throw new AppError(400, 'VALIDATION', Object.values(fields)[0] ?? 'Проверьте введённые данные', fields);
}

export const uaOf = (req: Request) => (req.get('user-agent') ?? '').slice(0, 300);
export const ipOf = (req: Request) => req.ip ?? 'unknown';
