import { renderer } from '../core/renderer.js';
import { state, filterState } from '../core/state.js';
import { FILTER_DEVICES } from '../data/constants.js';
import { saveFilterUsage } from '../filter/filterState.js';

let endScreenRafId = null;
let endScreenAmbience = null;

function createEndScreenAmbience() {
  const layer = document.createElement('div');
  layer.id = 'end-screen-ambience';
  document.body.appendChild(layer);

  const LEAF_COUNT = 6;
  const leaves = [];
  for (let i = 0; i < LEAF_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'end-leaf';
    el.textContent = '🌿';
    Object.assign(el.style, {
      left: `${5 + Math.random() * 90}%`,
      top: `${5 + Math.random() * 85}%`,
      fontSize: `${20 + Math.random() * 20}px`,
      opacity: `${0.5 + Math.random() * 0.4}`,
    });
    layer.appendChild(el);
    leaves.push({
      el,
      duration: 2200 + Math.random() * 1600,
      phaseOffset: Math.random() * Math.PI * 2,
      rotateAmp: 3 + Math.random() * 4,
      translateAmp: 1.5 + Math.random() * 2.5,
      baseScale: 0.8 + Math.random() * 0.5,
    });
  }

  const FISH_COUNT = 5;
  const fish = [];
  for (let i = 0; i < FISH_COUNT; i++) {
    const w = 22 + Math.random() * 18;
    const h = w * 0.45;

    const el = document.createElement('div');
    el.className = 'end-fish';
    Object.assign(el.style, { width: `${w}px`, height: `${h}px` });

    const body = document.createElement('div');
    body.className = 'end-fish-body';

    const forkAngle = 24;
    const middleTailConfig = { tailLen: w * 0.93, tailWidth: h * 0.9, tailOverlap: w * 0.2 };
    const sideTailConfig = { tailLen: w * 0.7, tailWidth: h * 0.7, tailOverlap: w * 0.1 };
    const tailConfigs = [
      { fork: 0, ...middleTailConfig },
      { fork: forkAngle, ...sideTailConfig },
      { fork: -forkAngle, ...sideTailConfig },
    ];

    const tailEls = tailConfigs.map(({ fork, tailLen, tailWidth, tailOverlap }) => {
      const fin = document.createElement('div');
      fin.className = 'end-fish-tail';
      Object.assign(fin.style, {
        left: `${-(tailLen - tailOverlap)}px`,
        width: `${tailLen}px`,
        height: `${tailWidth}px`,
      });
      el.appendChild(fin);
      return { el: fin, fork };
    });

    el.appendChild(body);
    layer.appendChild(el);
    fish.push({
      el,
      tailEls,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      angle: Math.random() * Math.PI * 2,
      speed: 18 + Math.random() * 22,
      turnRate: 0.6 + Math.random() * 0.6,
      tailPhase: Math.random() * Math.PI * 2,
      tailAmp: 22 + Math.random() * 10,
    });
  }

  return { layer, leaves, fish, startTime: performance.now() };
}

function stepEndScreenAmbience(ambience, now, prevNow) {
  const dt = Math.min((now - prevNow) / 1000, 0.1);
  const elapsed = now - ambience.startTime;

  for (const leaf of ambience.leaves) {
    const phase = ((elapsed % leaf.duration) / leaf.duration) * Math.PI * 2 + leaf.phaseOffset;
    const rotateDeg = Math.sin(phase) * leaf.rotateAmp;
    const translateXpx = Math.sin(phase) * leaf.translateAmp;
    const translateYpx = Math.cos(phase * 0.7) * (leaf.translateAmp * 0.6);
    leaf.el.style.transform =
      `translate(${translateXpx.toFixed(2)}px, ${translateYpx.toFixed(2)}px) ` +
      `scale(${leaf.baseScale.toFixed(2)}) rotate(${rotateDeg.toFixed(2)}deg)`;
  }

  const w = ambience.layer.clientWidth || window.innerWidth;
  const h = ambience.layer.clientHeight || window.innerHeight;
  const margin = 24;

  for (const f of ambience.fish) {
    f.angle += (Math.random() - 0.5) * f.turnRate * dt;
    f.x += Math.cos(f.angle) * f.speed * dt;
    f.y += Math.sin(f.angle) * f.speed * dt;

    if (f.x < margin) { f.x = margin; f.angle = Math.PI - f.angle; }
    if (f.x > w - margin) { f.x = w - margin; f.angle = Math.PI - f.angle; }
    if (f.y < margin) { f.y = margin; f.angle = -f.angle; }
    if (f.y > h - margin) { f.y = h - margin; f.angle = -f.angle; }

    const deg = (f.angle * 180) / Math.PI;
    f.el.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px) rotate(${deg.toFixed(1)}deg)`;

    const wagFreqHz = 1.2 + f.speed * 0.06;
    const wagDeg = Math.sin(elapsed / 1000 * wagFreqHz * Math.PI * 2 + f.tailPhase) * f.tailAmp;
    f.tailEls.forEach(({ el: finEl, fork }) => {
      finEl.style.transform = `translateY(-50%) rotate(${(fork + wagDeg).toFixed(1)}deg)`;
    });
  }
}

export function startEndScreenAmbience() {
  stopEndScreenAmbience();
  endScreenAmbience = createEndScreenAmbience();
  let prevNow = performance.now();
  function frame(now) {
    stepEndScreenAmbience(endScreenAmbience, now, prevNow);
    prevNow = now;
    endScreenRafId = requestAnimationFrame(frame);
  }
  endScreenRafId = requestAnimationFrame(frame);
}

export function stopEndScreenAmbience() {
  if (endScreenRafId !== null) {
    cancelAnimationFrame(endScreenRafId);
    endScreenRafId = null;
  }
  if (endScreenAmbience) {
    endScreenAmbience.layer.remove();
    endScreenAmbience = null;
  }
}

export function showCloseFallback() {
  let fallback = document.getElementById('close-fallback');

  if (fallback) {
    if (!document.getElementById('end-screen-ambience')) startEndScreenAmbience();
    return;
  }

  fallback = document.createElement('div');
  fallback.id = 'close-fallback';
  fallback.innerHTML = `
    <div class="close-fallback-box">
      <div class="close-fallback-icon">🌿</div>
      <div class="close-fallback-title">體驗結束，期待重逢</div>
      <div class="close-fallback-tip">To be continued</div>
    </div>`;
  document.body.appendChild(fallback);

  const box = fallback.querySelector('.close-fallback-box');
  if (box) {
    if (!box.style.position) box.style.position = 'relative';
    if (!box.style.zIndex) box.style.zIndex = '1';
  }
  startEndScreenAmbience();
}

export function exitApp() {
  if (document.pointerLockElement) document.exitPointerLock();

  state.isAnimating = false;

  FILTER_DEVICES.forEach(device => {
    if (filterState[device]?.isActive) saveFilterUsage(device);
  });

  renderer.dispose();
  showCloseFallback();
}

window.exitApp = exitApp;
window.showCloseFallback = showCloseFallback;