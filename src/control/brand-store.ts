import fs from 'node:fs/promises';
import path from 'node:path';

const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxBytes = 2 * 1024 * 1024;

function matchesMime(mime: string, data: Buffer) {
  if (mime === 'image/png') {
    return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  }
  if (mime === 'image/jpeg') {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (mime === 'image/webp') {
    return data.length >= 12
      && data.subarray(0, 4).toString('ascii') === 'RIFF'
      && data.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

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
    if (!matchesMime(mime, data)) {
      throw new Error('Uploaded logo bytes do not match the selected image type.');
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
