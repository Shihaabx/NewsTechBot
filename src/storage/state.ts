import fs from 'node:fs/promises';
import path from 'node:path';

interface StoredItem {
  seenAt: string;
  title: string;
  url: string;
}

interface StateFile {
  seen: Record<string, StoredItem>;
}

function isStateFile(value: unknown): value is StateFile {
  if (!value || typeof value !== 'object') return false;
  const seen = (value as { seen?: unknown }).seen;
  return Boolean(seen && typeof seen === 'object' && !Array.isArray(seen));
}

export class StateStore {
  private state: StateFile = { seen: {} };

  constructor(private readonly filePath: string) {}

  async load() {
    let raw: string;

    try {
      raw = await fs.readFile(this.filePath, 'utf8');
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      await this.save();
      return;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStateFile(parsed)) throw new Error('state file has an invalid shape');
      this.state = parsed;
    } catch (error) {
      const backupPath = `${this.filePath}.corrupt-${Date.now()}.json`;
      console.error(`[NewsTech] Invalid state file. Backing it up to ${backupPath}.`, error);
      await fs.rename(this.filePath, backupPath);
      this.state = { seen: {} };
      await this.save();
    }

    this.prune();
  }

  has(fingerprint: string): boolean {
    return Boolean(this.state.seen[fingerprint]);
  }

  async mark(fingerprint: string, title: string, url: string) {
    this.state.seen[fingerprint] = {
      seenAt: new Date().toISOString(),
      title,
      url,
    };
    this.prune();
    await this.save();
  }

  private prune() {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const [key, value] of Object.entries(this.state.seen)) {
      if (new Date(value.seenAt).getTime() < cutoff) delete this.state.seen[key];
    }
  }

  private async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    await fs.writeFile(temp, JSON.stringify(this.state, null, 2), 'utf8');
    await fs.rename(temp, this.filePath);
  }
}
