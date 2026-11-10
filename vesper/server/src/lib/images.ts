import sharp from 'sharp';
import { badRequest } from './errors';

/** Проверяет, что файл — настоящее изображение, и приводит к WebP нужного размера (метаданные удаляются). */
export async function toWebp(buf: Buffer, width: number, height: number): Promise<Buffer> {
  try {
    const img = sharp(buf, { limitInputPixels: 40_000_000, failOn: 'error' });
    const meta = await img.metadata();
    if (!meta.format || !['jpeg', 'png', 'webp', 'gif'].includes(meta.format)) throw new Error('format');
    return await img.rotate().resize(width, height, { fit: 'cover' }).webp({ quality: 86 }).toBuffer();
  } catch {
    throw badRequest('Не удалось обработать изображение. Загрузите JPG, PNG, WebP или GIF.', 'BAD_IMAGE');
  }
}
