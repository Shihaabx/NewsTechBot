export interface PollCycle {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  fetched: number;
  published: number;
  filtered: number;
  duplicates: number;
  failedSources: number;
  skipped?: 'paused' | 'already-running';
}

export interface RuntimeStatus {
  startedAt: string;
  lastPollAt?: string;
  lastPollDurationMs?: number;
  enabledSources: number;
  fetched: number;
  published: number;
  filtered: number;
  duplicates: number;
  failedSources: number;
  running: boolean;
}
