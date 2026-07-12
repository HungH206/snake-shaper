export type Coord = [number, number];
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface LevelConfig {
  id: number;
  name: string;
  shape: string;
  difficulty: Difficulty;
  start: Coord;
  finalNode: Coord;
  targets: Coord[];
}

export const GRID_SIZE = 10;
export const MAX_REWINDS = 3;
export const REWIND_POP = 5;

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: 'The L-Turn',
    shape: 'L',
    difficulty: 'Easy',
    start: [0, 2],
    finalNode: [9, 8],
    targets: [
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => [r, 2] as Coord),
      ...[3, 4, 5, 6, 7, 8].map((c) => [9, c] as Coord),
    ],
  },
  {
    id: 2,
    name: 'The Crescent',
    shape: 'C',
    difficulty: 'Medium',
    start: [0, 7],
    finalNode: [6, 7],
    targets: [
      ...[2, 3, 4, 5, 6, 7].map((c) => [0, c] as Coord),
      ...[1, 2, 3, 4, 5, 6].map((r) => [r, 2] as Coord),
      ...[3, 4, 5, 6, 7].map((c) => [6, c] as Coord),
    ],
  },
  {
    id: 3,
    name: 'The Zigzag',
    shape: 'Z',
    difficulty: 'Medium',
    start: [1, 2],
    finalNode: [7, 8],
    targets: [
      ...[2, 3, 4, 5, 6, 7].map((c) => [1, c] as Coord),
      ...[2, 3].map((r) => [r, 7] as Coord),
      ...[3, 4, 5, 6, 7].map((c) => [4, c] as Coord),
      ...[5, 6, 7].map((r) => [r, 3] as Coord),
      ...[4, 5, 6, 7, 8].map((c) => [7, c] as Coord),
    ],
  },
  {
    id: 4,
    name: 'The Serpentine',
    shape: 'S',
    difficulty: 'Hard',
    start: [1, 1],
    finalNode: [9, 8],
    targets: [
      ...[1, 2, 3, 4, 5, 6, 7].map((c) => [1, c] as Coord),
      ...[2, 3].map((r) => [r, 7] as Coord),
      ...[3, 4, 5, 6, 7].map((c) => [4, c] as Coord),
      ...[5, 6, 7].map((r) => [r, 3] as Coord),
      ...[4, 5, 6, 7, 8].map((c) => [7, c] as Coord),
      ...[8, 9].map((r) => [r, 8] as Coord),
    ],
  },
];

export const DAILY_POOL: LevelConfig[] = [
  {
    id: 101,
    name: 'The Arch',
    shape: '∩',
    difficulty: 'Easy',
    start: [1, 2],
    finalNode: [1, 7],
    targets: [
      ...[1, 2, 3, 4, 5, 6, 7].map((r) => [r, 2] as Coord),
      ...[3, 4, 5, 6, 7].map((c) => [7, c] as Coord),
      ...[1, 2, 3, 4, 5, 6].map((r) => [r, 7] as Coord),
    ],
  },
  {
    id: 102,
    name: 'The Staircase',
    shape: '⌐',
    difficulty: 'Easy',
    start: [0, 0],
    finalNode: [6, 9],
    targets: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 5],
      [4, 5],
      [4, 6],
      [4, 7],
      [4, 8],
      [5, 8],
      [6, 8],
      [6, 9],
    ],
  },
  {
    id: 103,
    name: 'The Hook',
    shape: 'J',
    difficulty: 'Medium',
    start: [0, 3],
    finalNode: [6, 7],
    targets: [
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => [r, 3] as Coord),
      ...[4, 5, 6, 7].map((c) => [8, c] as Coord),
      ...[6, 7].map((r) => [r, 7] as Coord),
    ],
  },
  {
    id: 104,
    name: 'The Long S',
    shape: '~',
    difficulty: 'Medium',
    start: [0, 0],
    finalNode: [8, 7],
    targets: [
      ...[0, 1, 2, 3, 4, 5].map((c) => [0, c] as Coord),
      ...[1, 2, 3, 4].map((r) => [r, 5] as Coord),
      ...[2, 3, 4].map((c) => [4, c] as Coord),
      ...[5, 6, 7, 8].map((r) => [r, 2] as Coord),
      ...[3, 4, 5, 6, 7].map((c) => [8, c] as Coord),
    ],
  },
  {
    id: 105,
    name: 'The River',
    shape: '≋',
    difficulty: 'Hard',
    start: [0, 2],
    finalNode: [9, 6],
    targets: [
      ...[2, 3, 4, 5].map((c) => [0, c] as Coord),
      ...[1, 2, 3].map((r) => [r, 5] as Coord),
      ...[2, 3, 4].map((c) => [3, c] as Coord),
      ...[4, 5, 6].map((r) => [r, 2] as Coord),
      ...[3, 4, 5, 6].map((c) => [6, c] as Coord),
      ...[7, 8, 9].map((r) => [r, 6] as Coord),
    ],
  },
];

export function getDailyLevel(now = new Date()): {
  level: LevelConfig;
  dateStr: string;
  dayIndex: number;
} {
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  const dayIndex = dayOfYear % DAILY_POOL.length;
  const level = DAILY_POOL[dayIndex];
  if (!level) {
    throw new Error('Daily puzzle pool is empty');
  }
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return { level, dateStr, dayIndex };
}

export function buildTargetSet(targets: Coord[]): Set<string> {
  return new Set(targets.map(([r, c]) => `${r},${c}`));
}
