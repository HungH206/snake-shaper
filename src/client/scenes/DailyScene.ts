import { Scene } from 'phaser';
import { getDailyLevel, type LevelConfig } from '../../shared/puzzles';
import { PALETTE, CSS, FONT } from '../../shared/theme';
import { PlayField } from '../PlayField';

export class DailyScene extends Scene {
  private level!: LevelConfig;
  private dateStr = '';
  private playField?: PlayField;

  constructor() {
    super('Daily');
  }

  init(data: { level?: LevelConfig } = {}) {
    const daily = getDailyLevel();
    this.level = data.level ?? daily.level;
    this.dateStr = daily.dateStr;
  }

  create() {
    this.cameras.main.setBackgroundColor(CSS.backgroundAlt);

    const centerX = this.scale.width / 2;
    this.add.text(centerX, 14, '📅 Daily Challenge', {
      fontFamily: FONT.mono,
      fontSize: '22px',
      color: CSS.foreground,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.add.text(centerX, 44, this.dateStr, {
      fontFamily: FONT.mono,
      fontSize: '14px',
      color: CSS.accent,
    }).setOrigin(0.5, 0);

    this.buildPill(centerX, 78, `#${this.level.id} — ${this.level.name}`, PALETTE.accent, CSS.accent);

    this.playField = new PlayField(this, {
      level: this.level,
      top: 108,
      leaderboard: true,
      onComplete: () => this.scene.start('Hub'),
      onExit: () => this.scene.start('Hub'),
    });

    this.events.once('shutdown', () => this.playField?.destroy());
  }

  private buildPill(cx: number, y: number, label: string, stroke: number, textColor: string) {
    const text = this.add.text(cx, y, label, {
      fontFamily: FONT.mono,
      fontSize: '14px',
      color: textColor,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    const pad = 12;
    this.add.rectangle(cx, y + text.height / 2, text.width + pad * 2, text.height + 8, PALETTE.card, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(1.5, stroke);
    text.setDepth(1);
  }
}
