import { state } from '../core/state.js';

function setKey(code, pressed) {
  if (code === 'KeyW' || code === 'ArrowUp') state.moveForward = pressed;
  if (code === 'KeyS' || code === 'ArrowDown') state.moveBackward = pressed;
  if (code === 'KeyA' || code === 'ArrowLeft') state.moveLeft = pressed;
  if (code === 'KeyD' || code === 'ArrowRight') state.moveRight = pressed;
}

document.addEventListener('keydown', (e) => setKey(e.code, true));
document.addEventListener('keyup', (e) => setKey(e.code, false));