import { Scene, GameObjects } from 'phaser';
import { LEVELS, getDailyLevel } from '../../shared/puzzles';
import { PALETTE, CSS, FONT } from '../../shared/theme';

export class HubScene extends Scene {
  private cards: GameObjects.Container[] = [];

  constructor() {
    super('Hub');
  }

  create() {
    this.cameras.main.setBackgroundColor(CSS.backgroundAlt);
    this.add.text(this.scale.width / 2, 70, 'SNAKE SHAPER', {
      fontFamily: FONT.mono,
      fontSize: '32px',
      color: CSS.primary,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const daily = getDailyLevel();
    const pages = [
      {
        label: 'Tutorial',
        subtitle: `${LEVELS.length} hand-crafted puzzles`,
        onClick: () => this.scene.start('Tutorial', { levels: LEVELS }),
      },
      {
        label: 'Daily',
        subtitle: daily.level.name,
        onClick: () => this.scene.start('Daily', { level: daily.level }),
      },
      {
        label: 'Designer',
        subtitle: 'Create your own silhouette',
        onClick: () => this.scene.start('Designer'),
      },
    ];

    const cardWidth = 220;
    const cardHeight = 140;
    const gap = 24;
    const startX = this.scale.width / 2 - ((cardWidth * pages.length) + gap * (pages.length - 1)) / 2;

    pages.forEach((page, index) => {
      const x = startX + index * (cardWidth + gap);
      const card = this.add.container(x, 220);
      const rect = this.add.rectangle(0, 0, cardWidth, cardHeight, PALETTE.card, 0.95).setOrigin(0.5).setStrokeStyle(1, PALETTE.primary);
      const label = this.add.text(0, -18, page.label, {
        fontFamily: FONT.mono,
        fontSize: '22px',
        color: CSS.primary,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const subtitle = this.add.text(0, 18, page.subtitle, {
        fontFamily: FONT.mono,
        fontSize: '15px',
        color: CSS.foreground,
        align: 'center',
        wordWrap: { width: cardWidth - 24 },
      }).setOrigin(0.5);
      const enter = this.add.text(0, 54, 'Enter →', {
        fontFamily: FONT.mono,
        fontSize: '16px',
        color: CSS.accent,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      enter.on('pointerdown', page.onClick);
      card.add([rect, label, subtitle, enter]);
      card.setSize(cardWidth, cardHeight);
      this.cards.push(card);
    });
  }
}
