import { Scene, GameObjects } from 'phaser';
import { GRID_SIZE, LEVELS, getDailyLevel, type Coord } from '../../shared/puzzles';
import { PALETTE, CSS, FONT } from '../../shared/theme';

type HubPage = {
  label: string;
  subtitle: string;
  preview: Coord[];
  accent: number;
  accentCss: string;
  onClick: () => void;
};

export class HubScene extends Scene {
  private cards: GameObjects.Container[] = [];
  private clockText?: GameObjects.Text;

  constructor() {
    super('Hub');
  }

  create() {
    this.cameras.main.setBackgroundColor(CSS.backgroundAlt);
    const centerX = this.scale.width / 2;
    this.add.text(centerX, 24, 'LIL SHAPER', {
      fontFamily: FONT.mono,
      fontSize: '32px',
      color: CSS.primary,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(centerX, 56, 'The New Snake', {
      fontFamily: FONT.mono,
      fontSize: '14px',
      color: CSS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.clockText = this.add.text(centerX, 82, '', {
      fontFamily: FONT.mono,
      fontSize: '13px',
      color: CSS.mutedForeground,
      align: 'center',
    }).setOrigin(0.5, 0);
    this.updateClock();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateClock() });

    const daily = getDailyLevel();
    const designerPreview: Coord[] = [
      [2, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 2],
      [4, 2],
      [5, 2],
      [5, 3],
      [5, 4],
      [4, 5],
      [5, 5],
      [6, 5],
      [7, 5],
      [7, 6],
      [7, 7],
    ];
    const pages: HubPage[] = [
      {
        label: 'Tutorial',
        subtitle: `${LEVELS.length} hand-crafted puzzles`,
        preview: LEVELS[0]?.targets ?? [],
        accent: PALETTE.primary,
        accentCss: CSS.primary,
        onClick: () => this.scene.start('Tutorial', { levels: LEVELS }),
      },
      {
        label: 'Daily',
        subtitle: daily.level.name,
        preview: daily.level.targets,
        accent: PALETTE.accent,
        accentCss: CSS.accent,
        onClick: () => this.scene.start('Daily', { level: daily.level }),
      },
      {
        label: 'Designer',
        subtitle: 'Create your own silhouette',
        preview: designerPreview,
        accent: PALETTE.cyan,
        accentCss: CSS.cyan,
        onClick: () => this.scene.start('Designer'),
      },
      {
        label: 'Community',
        subtitle: 'Play puzzles made by redditors',
        preview: designerPreview,
        accent: PALETTE.purple,
        accentCss: CSS.purple,
        onClick: () => this.scene.start('Community'),
      },
    ];

    const cardWidth = 430;
    const cardHeight = 132;
    const gap = 12;
    const startY = 166;

    pages.forEach((page, index) => {
      const x = centerX;
      const y = startY + index * (cardHeight + gap);
      const card = this.add.container(x, y);
      const rect = this.add.rectangle(0, 0, cardWidth, cardHeight, PALETTE.card, 0.95).setOrigin(0.5).setStrokeStyle(1.5, page.accent);
      const label = this.add.text(-cardWidth / 2 + 24, -44, page.label, {
        fontFamily: FONT.mono,
        fontSize: '22px',
        color: page.accentCss,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const subtitle = this.add.text(-cardWidth / 2 + 24, -16, page.subtitle, {
        fontFamily: FONT.mono,
        fontSize: '15px',
        color: CSS.foreground,
        wordWrap: { width: 220 },
      }).setOrigin(0, 0.5);
      const preview = this.buildGridPreview(page.preview, page.accent);
      preview.setPosition(126, 0);
      preview.setScale(0.82);
      const enter = this.add.text(-cardWidth / 2 + 24, 42, 'Enter ->', {
        fontFamily: FONT.mono,
        fontSize: '16px',
        color: CSS.accent,
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', page.onClick);
      enter.on('pointerdown', page.onClick);
      card.add([rect, label, subtitle, preview, enter]);
      card.setSize(cardWidth, cardHeight);
      this.cards.push(card);
    });
  }

  private buildGridPreview(targets: Coord[], accent: number): GameObjects.Container {
    const container = this.add.container(0, 0);
    const cellSize = 10;
    const gap = 2;
    const boardSize = GRID_SIZE * cellSize + (GRID_SIZE - 1) * gap;
    const targetKeys = new Set(targets.map(([row, col]) => `${row},${col}`));
    const board = this.add.rectangle(0, 0, boardSize + 18, boardSize + 18, PALETTE.boardBg, 1)
      .setStrokeStyle(1, PALETTE.cellBorder);

    container.add(board);

    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const isTarget = targetKeys.has(`${row},${col}`);
        const fill = isTarget ? accent : PALETTE.cellEmpty;
        const alpha = isTarget ? 0.95 : 0.7;
        const cellX = col * (cellSize + gap) - boardSize / 2 + cellSize / 2;
        const cellY = row * (cellSize + gap) - boardSize / 2 + cellSize / 2;
        const cell = this.add.rectangle(cellX, cellY, cellSize, cellSize, fill, alpha);
        container.add(cell);
      }
    }

    return container;
  }

  private updateClock() {
    const now = new Date();
    const locale = navigator.language || undefined;
    const date = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(now);
    const time = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    }).format(now);
    this.clockText?.setText(`${date} · ${time}`);
  }
}
