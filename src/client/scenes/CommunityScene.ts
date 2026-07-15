import { Scene, GameObjects } from 'phaser';
import { GRID_SIZE, type Coord, type LevelConfig } from '../../shared/puzzles';
import { CSS, FONT, PALETTE } from '../../shared/theme';
import type { CommunityPuzzle, CommunityPuzzleListResponse } from '../../shared/api';

export class CommunityScene extends Scene {
  private rows: GameObjects.Container[] = [];
  private statusText?: GameObjects.Text;

  constructor() {
    super('Community');
  }

  create() {
    this.cameras.main.setBackgroundColor(CSS.backgroundAlt);
    this.rows = [];

    const centerX = this.scale.width / 2;
    const back = this.add.text(40, 30, '← Hub', {
      fontFamily: FONT.mono,
      fontSize: '16px',
      color: CSS.foreground,
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Hub'));

    this.add.text(centerX, 30, 'Community Puzzles', {
      fontFamily: FONT.mono,
      fontSize: '24px',
      color: CSS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    const makeBg = this.add.rectangle(centerX, 92, 300, 40, PALETTE.card, 0.95).setStrokeStyle(1.5, PALETTE.cyan);
    const makeText = this.add.text(centerX, 92, '✎ Make a Puzzle', {
      fontFamily: FONT.mono,
      fontSize: '16px',
      color: CSS.cyan,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    makeBg.setInteractive({ useHandCursor: true });
    makeText.setInteractive({ useHandCursor: true });
    const make = () => this.scene.start('Designer');
    makeBg.on('pointerdown', make);
    makeText.on('pointerdown', make);

    this.statusText = this.add.text(centerX, 132, 'loading…', {
      fontFamily: FONT.mono,
      fontSize: '14px',
      color: CSS.mutedForeground,
    }).setOrigin(0.5, 0);

    void this.loadPuzzles();
  }

  private async loadPuzzles() {
    try {
      const res = await fetch('/api/community-puzzles');
      const data: CommunityPuzzleListResponse = await res.json();
      this.renderPuzzles(data.puzzles);
    } catch {
      this.statusText?.setText('could not load community puzzles');
    }
  }

  private renderPuzzles(puzzles: CommunityPuzzle[]) {
    this.rows.forEach((row) => row.destroy(true));
    this.rows = [];

    if (puzzles.length === 0) {
      this.statusText?.setText('No community puzzles yet. Make the first one.');
      return;
    }

    this.statusText?.setText(`${puzzles.length} latest community puzzles`);
    puzzles.forEach((puzzle, index) => this.addPuzzleRow(puzzle, index));
  }

  private addPuzzleRow(puzzle: CommunityPuzzle, index: number) {
    const centerX = this.scale.width / 2;
    const y = 176 + index * 44;
    const row = this.add.container(centerX, y);
    const bg = this.add.rectangle(0, 0, 470, 38, PALETTE.card, 0.95).setStrokeStyle(1, PALETTE.cellBorder);
    const preview = this.buildGridPreview(puzzle.level.targets);
    preview.setPosition(-200, 0);

    const name = this.add.text(-158, -9, `by u/${puzzle.author}`, {
      fontFamily: FONT.mono,
      fontSize: '13px',
      color: CSS.foreground,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    const meta = this.add.text(94, -9, `${puzzle.level.targets.length} cells`, {
      fontFamily: FONT.mono,
      fontSize: '13px',
      color: CSS.mutedForeground,
    }).setOrigin(0, 0.5);
    const play = this.add.text(170, 8, 'Play ->', {
      fontFamily: FONT.mono,
      fontSize: '13px',
      color: CSS.primary,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const start = () => this.playPuzzle(puzzle.level);
    bg.setInteractive({ useHandCursor: true });
    play.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', start);
    play.on('pointerdown', start);

    row.add([bg, preview, name, meta, play]);
    this.rows.push(row);
  }

  private playPuzzle(level: LevelConfig) {
    this.scene.start('SnakeGame', { level, onComplete: () => this.scene.start('Community') });
  }

  private buildGridPreview(targets: Coord[]): GameObjects.Container {
    const container = this.add.container(0, 0);
    const cellSize = 3;
    const gap = 1;
    const boardSize = GRID_SIZE * cellSize + (GRID_SIZE - 1) * gap;
    const targetKeys = new Set(targets.map(([row, col]) => `${row},${col}`));

    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const isTarget = targetKeys.has(`${row},${col}`);
        const fill = isTarget ? PALETTE.cyan : PALETTE.cellEmpty;
        const alpha = isTarget ? 0.95 : 0.55;
        const x = col * (cellSize + gap) - boardSize / 2 + cellSize / 2;
        const y = row * (cellSize + gap) - boardSize / 2 + cellSize / 2;
        container.add(this.add.rectangle(x, y, cellSize, cellSize, fill, alpha));
      }
    }

    return container;
  }
}
