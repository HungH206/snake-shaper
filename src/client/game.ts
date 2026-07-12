import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { HubScene } from './scenes/HubScene';
import { TutorialScene } from './scenes/TutorialScene';
import { DailyScene } from './scenes/DailyScene';
import { DesignerScene } from './scenes/DesignerScene';
import { SnakeGameScene } from './scenes/SnakeGameScene';
import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'game-container',
  backgroundColor: '#09090f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1024,
    height: 768,
  },
  scene: [Boot, Preloader, HubScene, TutorialScene, DailyScene, DesignerScene, SnakeGameScene],
};

export const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
};
