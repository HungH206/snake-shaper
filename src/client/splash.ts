import { requestExpandedMode, showToast } from '@devvit/web/client';

const playButton = document.querySelector<HTMLButtonElement>('[data-play]');

playButton?.addEventListener('click', (event) => {
  try {
    requestExpandedMode(event, 'game');
  } catch {
    showToast('Open the post to play wide');
  }
});
