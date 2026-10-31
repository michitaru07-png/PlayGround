import { Game } from './game.js';

const canvas = document.getElementById('game');
const errorPanel = document.getElementById('bootError');
const errorText = document.getElementById('bootErrorText');

try {
  const game = new Game(canvas);
  game.draw();

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      game.update(dt);
      game.draw();
    } catch (error) {
      console.error(error);
      if (errorPanel && errorText) {
        errorPanel.classList.remove('hidden');
        errorText.textContent = error instanceof Error ? error.message : String(error);
      }
    } finally {
      game.input.endFrame();
      requestAnimationFrame(frame);
    }
  };
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') game.togglePause();
  });

  // Prevent browser pinch-zoom on the play surface while keeping UI accessible.
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false });
} catch (error) {
  console.error(error);
  if (errorPanel && errorText) {
    errorPanel.classList.remove('hidden');
    errorText.textContent = error instanceof Error ? error.message : String(error);
  }
}
