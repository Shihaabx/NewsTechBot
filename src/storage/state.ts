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

export class StateStore {
  private state: StateFile = { seen: {} };
  constructor(private readonly filePath: string) {}

  async load() {
    try {
      this.state = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as StateFile;
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      await this.save();
    }
    this.prune();
  }

  has(fingerprint: string): boolean {
    return Boolean(this.state.seen[fingerprint]);
  }

  async mark(fingerprint: string, title: string, url: string) {
    this.state.seen[fingerprint] = { seenAt: new Date().toISOString(), title, url };
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
