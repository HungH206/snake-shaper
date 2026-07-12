import type { LevelConfig } from './puzzles';

export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export type PuzzleBundleResponse = {
  levels: LevelConfig[];
  dailyPool: LevelConfig[];
  daily: {
    level: LevelConfig;
    dateStr: string;
    dayIndex: number;
  };
};

// --- Leaderboard (per puzzle, ranked by fewest moves) ---

export type LeaderboardEntry = {
  username: string;
  moves: number;
  rank: number;
};

export type LeaderboardSubmitRequest = {
  levelId: number;
  moves: number;
};

export type LeaderboardSubmitResponse = {
  ok: boolean;
  /** The player's best (fewest) moves for this puzzle after this submission. */
  best: number | null;
};

export type LeaderboardResponse = {
  levelId: number;
  entries: LeaderboardEntry[];
  /** The current player's own entry, even if outside the top slice. */
  you: LeaderboardEntry | null;
  total: number;
};
