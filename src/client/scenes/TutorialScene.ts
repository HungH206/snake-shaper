import { Scene, GameObjects } from 'phaser';
import { LEVELS } from '../../shared/puzzles';
import { PALETTE, CSS, FONT } from '../../shared/theme';
import { PlayField } from '../PlayField';

const HOW_TO: { icon: string; title: string; color: string; body: string }[] = [
  { icon: '←', title: 'back', color: CSS.primary, body: 'Moving into the previous cell is a free undo — no cost.' },
  { icon: '✳', title: 'crash', color: CSS.destructive, body: 'Hitting a wall or your own tail costs 1 Rewind (3 total).' },
  { icon: '◆', title: 'win', color: CSS.accent, body: 'Cover every gold cell and finish with your head on the diamond.' },
];

export class TutorialScene extends Scene {
  private levelIndex = 0;
  private playField?: PlayField;
  private tabBorders: GameObjects.Rectangle[] = [];
  private tabLabels: GameObjects.Text[] = [];

  constructor() {
    super('Tutorial');
  }

  init() {
    this.levelIndex = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor(CSS.backgroundAlt);
    this.tabBorders = [];
    this.tabLabels = [];

    this.buildTabs();
    this.buildHowTo();

    const level = LEVELS[this.levelIndex] ?? LEVELS[0];
    if (level) {
      this.playField = new PlayField(this, {
        level,
        top: 224,
        leaderboard: true,
        onComplete: () => this.scene.start('Hub'),
        onExit: () => this.scene.start('Hub'),
      });
    }

    this.events.once('shutdown', () => this.playField?.destroy());
  }

  private buildTabs() {
    const gap = 12;
    const tabW = 172;
    const tabH = 30;
    const total = LEVELS.length * tabW + (LEVELS.length - 1) * gap;
    const startX = Math.round((1024 - total) / 2);
    const y = 18;

    LEVELS.forEach((level, index) => {
      const cx = startX + index * (tabW + gap) + tabW / 2;
      const border = this.add.rectangle(cx, y, tabW, tabH, PALETTE.card, 0.95).setStrokeStyle(1.5, PALETTE.cellBorder);
      const label = this.add.text(cx, y, `${index + 1}. ${level.name}`, {
        fontFamily: FONT.mono,
        fontSize: '14px',
        color: CSS.mutedForeground,
      }).setOrigin(0.5);
      border.setInteractive({ useHandCursor: true });
      label.setInteractive({ useHandCursor: true });
      const pick = () => this.selectLevel(index);
      border.on('pointerdown', pick);
      label.on('pointerdown', pick);
      this.tabBorders.push(border);
      this.tabLabels.push(label);
    });

    this.highlightTabs();
  }

  private buildHowTo() {
    const panelX = 62;
    const panelY = 48;
    const panelW = 1024 - panelX * 2;
    const panelH = 158;
    this.add.rectangle(panelX, panelY, panelW, panelH, PALETTE.card, 0.9).setOrigin(0, 0).setStrokeStyle(1, PALETTE.cellBorder);

    this.add.text(panelX + 18, panelY + 12, 'ⓘ How to play', {
      fontFamily: FONT.mono,
      fontSize: '15px',
      color: CSS.foreground,
      fontStyle: 'bold',
    });

    const colW = (panelW - 36) / 3;
    HOW_TO.forEach((entry, i) => {
      const x = panelX + 18 + i * colW;
      const y = panelY + 44;
      this.add.text(x, y, `${entry.icon} ${entry.title}`, {
        fontFamily: FONT.mono,
        fontSize: '15px',
        color: entry.color,
        fontStyle: 'bold',
      });
      this.add.text(x, y + 26, entry.body, {
        fontFamily: FONT.mono,
        fontSize: '13px',
        color: CSS.mutedForeground,
        wordWrap: { width: colW - 20 },
        lineSpacing: 3,
      });
    });
  }

  private selectLevel(index: number) {
    if (index === this.levelIndex) return;
    this.levelIndex = index;
    this.highlightTabs();
    const level = LEVELS[index];
    if (level) this.playField?.loadLevel(level);
  }

  private highlightTabs() {
    this.tabBorders.forEach((border, i) => {
      const active = i === this.levelIndex;
      border.setStrokeStyle(1.5, active ? PALETTE.primary : PALETTE.cellBorder);
      border.setFillStyle(active ? PALETTE.primary : PALETTE.card, active ? 0.22 : 0.95);
      this.tabLabels[i]?.setColor(active ? CSS.primary : CSS.mutedForeground);
    });
  }
}
