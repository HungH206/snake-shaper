import { StartGame } from './game';

let gameStarted = false;

function init() {
  const existingHost = document.getElementById('game-container');
  if (existingHost && !gameStarted) {
    existingHost.style.display = 'block';
    StartGame('game-container');
    gameStarted = true;
  }
}

init();
