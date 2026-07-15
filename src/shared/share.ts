import { GRID_SIZE, MAX_REWINDS, buildTargetSet, type LevelConfig } from './puzzles';

export type ChallengeShareStats = {
  moves: number;
  rewindsUsed: number;
};

export function buildChallengeShareText(level: LevelConfig, stats: ChallengeShareStats): string {
  const targetSet = buildTargetSet(level.targets);
  const lines: string[] = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    let line = '';
    for (let col = 0; col < GRID_SIZE; col += 1) {
      line += targetSet.has(`${row},${col}`) ? '🟩' : '⬛';
    }
    if (line.includes('🟩')) lines.push(line);
  }

  const rewindsUsed = Math.max(0, Math.min(MAX_REWINDS, stats.rewindsUsed));
  const grade = rewindsUsed === 0 ? ' 🏆 Perfect Run!' : '';

  return [
    `🐍 Lil Shaper #${level.id}: ${level.name}`,
    ...lines,
    `Moves: ${stats.moves}`,
    `Rewinds Used: ${rewindsUsed}${grade}`,
    '',
    'Can you shape it faster?',
  ].join('\n');
}
