export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export const badRequest = (m = 'Некорректный запрос', code = 'BAD_REQUEST') => new AppError(400, code, m);
export const unauthorized = (m = 'Требуется вход в аккаунт') => new AppError(401, 'UNAUTHORIZED', m);
export const forbidden = (m = 'Недостаточно прав', code = 'FORBIDDEN') => new AppError(403, code, m);
export const notFound = (m = 'Не найдено') => new AppError(404, 'NOT_FOUND', m);
export const conflict = (m: string, fields?: Record<string, string>) => new AppError(409, 'CONFLICT', m, fields);
export const tooMany = (m = 'Слишком много попыток. Попробуйте позже.') => new AppError(429, 'RATE_LIMITED', m);
