import fs from 'node:fs/promises';
import path from 'node:path';

const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxBytes = 2 * 1024 * 1024;

interface StoredLogo {
  mime: string;
  base64: string;
  updatedAt: string;
}

export class BrandStore {
  constructor(private readonly filePath: string) {}

  async get(): Promise<{ mime: string; data: Buffer } | null> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as StoredLogo;
      if (!allowedMimes.has(parsed.mime) || typeof parsed.base64 !== 'string') return null;
      return { mime: parsed.mime, data: Buffer.from(parsed.base64, 'base64') };
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(mime: string, base64: string) {
    if (!allowedMimes.has(mime)) throw new Error('Logo must be PNG, JPEG, or WebP.');

    const data = Buffer.from(base64, 'base64');
    if (data.length === 0 || data.length > maxBytes) {
      throw new Error('Logo must be between 1 byte and 2 MB.');
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload: StoredLogo = { mime, base64: data.toString('base64'), updatedAt: new Date().toISOString() };
    const temp = `${this.filePath}.tmp`;
    await fs.writeFile(temp, JSON.stringify(payload), 'utf8');
    await fs.rename(temp, this.filePath);
    return { mime, data };
  }

  async clear() {
    try {
      await fs.unlink(this.filePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}
