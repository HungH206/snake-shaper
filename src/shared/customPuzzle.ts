import { GRID_SIZE, type Coord, type LevelConfig } from './puzzles';

const PREFIX = 'snake-shaper-puzzle:';

type EncodedPuzzle = {
  v: 1;
  name: string;
  start: Coord;
  finalNode: Coord;
  targets: Coord[];
};

function isCoord(value: unknown): value is Coord {
  return Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    value[0] >= 0 &&
    value[0] < GRID_SIZE &&
    value[1] >= 0 &&
    value[1] < GRID_SIZE;
}

function isEncodedPuzzle(value: unknown): value is EncodedPuzzle {
  if (value === null || typeof value !== 'object') return false;
  if (!('v' in value) || value.v !== 1) return false;
  if (!('name' in value) || typeof value.name !== 'string') return false;
  if (!('start' in value) || !isCoord(value.start)) return false;
  if (!('finalNode' in value) || !isCoord(value.finalNode)) return false;
  if (!('targets' in value) || !Array.isArray(value.targets)) return false;
  return value.targets.length >= 3 && value.targets.every(isCoord);
}

function toBase64Url(value: string): string {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string): string {
  const padded = value.padEnd(value.length + ((4 - value.length % 4) % 4), '=');
  return atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
}

export function encodeCustomPuzzle(level: LevelConfig): string {
  const payload: EncodedPuzzle = {
    v: 1,
    name: level.name,
    start: level.start,
    finalNode: level.finalNode,
    targets: level.targets,
  };

  return `${PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

export function decodeCustomPuzzle(value: string | undefined): LevelConfig | null {
  if (!value?.startsWith(PREFIX)) return null;

  try {
    const decoded = JSON.parse(fromBase64Url(value.slice(PREFIX.length)));
    if (!isEncodedPuzzle(decoded)) return null;
    const targetKeys = new Set(decoded.targets.map(([row, col]) => `${row},${col}`));
    if (!targetKeys.has(`${decoded.start[0]},${decoded.start[1]}`)) return null;
    if (!targetKeys.has(`${decoded.finalNode[0]},${decoded.finalNode[1]}`)) return null;

    return {
      id: 999,
      name: decoded.name.trim() || 'Shared Puzzle',
      shape: '✏',
      difficulty: 'Medium',
      start: decoded.start,
      finalNode: decoded.finalNode,
      targets: decoded.targets,
    };
  } catch {
    return null;
  }
}

export function buildPuzzleShareText(level: LevelConfig): string {
  return [
    `🐍 I made a Lil Shaper puzzle: ${level.name}`,
    `Target cells: ${level.targets.length}`,
    'Open this shared challenge and try to shape it.',
  ].join('\n');
}
