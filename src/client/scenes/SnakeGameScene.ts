import { Scene } from 'phaser';
import type { LevelConfig } from '../../shared/puzzles';
import { CSS, FONT } from '../../shared/theme';
import { PlayField } from '../PlayField';

export class SnakeGameScene extends Scene {
  private level!: LevelConfig;
  private completeCallback: (() => void) | undefined;
  private playField?: PlayField;

  constructor() {
    super('SnakeGame');
  }

  init(data: { level: LevelConfig; onComplete?: () => void }) {
    this.level = data.level;
    this.completeCallback = data.onComplete;
  }

  create() {
    this.cameras.main.setBackgroundColor(CSS.boardBg);

    this.add.text(512, 30, this.level.name, {
      fontFamily: FONT.mono,
      fontSize: '24px',
      color: CSS.primary,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.playField = new PlayField(this, {
      level: this.level,
      top: 74,
      onComplete: () => this.completeCallback?.(),
      onExit: () => this.scene.start('Hub'),
    });

    this.events.once('shutdown', () => this.playField?.destroy());
  }
}
