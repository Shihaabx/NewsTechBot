export type EventLevel = 'info' | 'success' | 'warning' | 'error';

export interface NewsTechEvent {
  id: number;
  at: string;
  level: EventLevel;
  message: string;
  detail?: string;
}

export class EventLog {
  private items: NewsTechEvent[] = [];
  private nextId = 1;

  constructor(private readonly limit = 200) {}

  add(level: EventLevel, message: string, detail?: string) {
    this.items.unshift({
      id: this.nextId++,
      at: new Date().toISOString(),
      level,
      message,
      detail,
    });
    if (this.items.length > this.limit) this.items.length = this.limit;
  }

  list(max = 80) {
    return this.items.slice(0, Math.max(1, Math.min(max, this.limit)));
  }
}
