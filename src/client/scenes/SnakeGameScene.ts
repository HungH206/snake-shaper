import { Scene } from 'phaser';
import type { LevelConfig } from '../../shared/puzzles';
import { CSS, FONT } from '../../shared/theme';
import { PlayField } from '../PlayField';

export class SnakeGameScene extends Scene {
  private level!: LevelConfig;
  private completeCallback: (() => void) | undefined;
  private publishable = false;
  private playField?: PlayField;

  constructor() {
    super('SnakeGame');
  }

  init(data: { level?: LevelConfig; onComplete?: () => void; publishable?: boolean } = {}) {
    if (data.level) this.level = data.level;
    if (data.onComplete) this.completeCallback = data.onComplete;
    if (data.publishable !== undefined) this.publishable = data.publishable;
  }

  create() {
    if (!this.level) {
      this.scene.start('Hub');
      return;
    }

    this.cameras.main.setBackgroundColor(CSS.boardBg);

    this.add.text(this.scale.width / 2, 30, this.level.name, {
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
      publishable: this.publishable,
      onPublished: () => this.scene.start('Community'),
    });

    this.events.once('shutdown', () => this.playField?.destroy());
  }
}
