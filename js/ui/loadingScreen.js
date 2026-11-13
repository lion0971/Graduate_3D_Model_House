import { state } from '../core/state.js';
import { manager } from '../core/loaders.js';
import { cubicBezier } from '../utils/math.js';
import { ensureWeatherData, showWeatherPanel } from './weatherPanel.js';
import { SHOW_WEATHER_PANEL_ON_LOAD } from '../config/flags.js';

const loadingScreen = document.getElementById('loading-screen');
export const instructions = document.getElementById('instructions');
export const instructionsFab = document.getElementById('instructions-fab');
const instructionsCloseBtn = document.querySelector('.instructions-close-btn');

// 預設展開說明面板
instructions.classList.add('expanded');

if (instructionsFab) {
  instructionsFab.addEventListener('click', (e) => {
    e.stopPropagation();
    instructions.classList.add('expanded');
    instructionsFab.classList.remove('show');
  });
}
if (instructionsCloseBtn) {
  instructionsCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    instructions.classList.remove('expanded');
    if (instructionsFab) instructionsFab.classList.add('show');
  });
}

manager.onProgress = (url, loaded, total) => {
  const percent = (loaded / total) * 100;
  const bar = document.getElementById('loader-bar');
  const percentText = document.getElementById('loader-percent');
  if (bar) bar.style.width = percent + '%';
  if (percentText) percentText.textContent = `${Math.round(percent)}%`;
};

// ── 點擊提示 DOM ──
export const tapPrompt = document.createElement('div');
Object.assign(tapPrompt.style, {
  position: 'fixed',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'none',
  flexDirection: 'column',
  alignItems: 'center',
  zIndex: '400',
  pointerEvents: 'none',
  opacity: '0',
  transition: 'opacity 0.4s ease',
});

const tapPromptWelcome = document.createElement('div');
tapPromptWelcome.textContent = '該回家了吧 ！';
Object.assign(tapPromptWelcome.style, {
  marginBottom: '18px',
  color: 'white',
  fontSize: '32px',
  fontWeight: 'bold',
  letterSpacing: '8px',
  textShadow: '0 2px 12px rgba(0,0,0,0.85)',
  opacity: '0',
  transition: 'opacity 3.5s ease-out',
});
tapPrompt.appendChild(tapPromptWelcome);

const leafStage = document.createElement('div');
Object.assign(leafStage.style, {
  position: 'relative',
  width: '90px',
  height: '90px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const tapPromptLeaf = document.createElement('div');
tapPromptLeaf.textContent = '🌿';
tapPromptLeaf.className = 'tap-prompt-leaf';
leafStage.appendChild(tapPromptLeaf);

const tapPromptRipple = document.createElement('div');
tapPromptRipple.className = 'tap-prompt-ripple';
leafStage.appendChild(tapPromptRipple);
tapPrompt.appendChild(leafStage);

const tapPromptText = document.createElement('div');
tapPromptText.textContent = '點擊畫面開始';
Object.assign(tapPromptText.style, {
  marginTop: '14px',
  color: 'white',
  fontSize: '20px',
  fontWeight: 'bold',
  letterSpacing: '4px',
  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
  background: 'rgba(0,0,0,0.35)',
  padding: '10px 24px',
  borderRadius: '30px',
  opacity: '0',
  transition: 'opacity 1.2s ease',
});
tapPrompt.appendChild(tapPromptText);
document.body.appendChild(tapPrompt);

const tapPromptStyleTag = document.createElement('style');
tapPromptStyleTag.textContent = `
@keyframes tapRippleExpand {
  0%   { opacity: 0.55; transform: translate(-50%, -50%) scale(0.2); }
  100% { opacity: 0;    transform: translate(-50%, -50%) scale(1.6); }
}
.tap-prompt-leaf {
  font-size: 100px; line-height: 1; transform-origin: center center;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)); opacity: 0;
}
.tap-prompt-ripple {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 60px; height: 60px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.8);
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%);
  opacity: 0;
}
.tap-prompt-ripple.rippling {
  animation: tapRippleExpand 1.2s ease-out forwards;
  animation-iteration-count: 1;
}`;
document.head.appendChild(tapPromptStyleTag);

// ── 全黑遮罩 ──
const blackCover = document.createElement('div');
Object.assign(blackCover.style, {
  position: 'fixed',
  inset: '0',
  background: '#000',
  zIndex: '150',
  pointerEvents: 'none',
  opacity: '1',
  transition: 'opacity 0.9s ease-out',
});
document.body.appendChild(blackCover);

let blackCoverFaded = false;

export function fadeOutBlackCover() {
  if (blackCoverFaded) return;
  blackCoverFaded = true;
  state.sceneRenderEnabled = true;
  blackCover.style.opacity = '0';
  ensureWeatherData();
  blackCover.addEventListener('transitionend', () => {
    blackCover.remove();
    if (SHOW_WEATHER_PANEL_ON_LOAD) showWeatherPanel();
  }, { once: true });
}

// ── 葉子飛行與晃動 ──
const LEAF_FLIGHT_DURATION = 2400;
let leafFlightRafId = null;
let leafSwayRafId = null;
let leafEntryDelayTimeoutId = null;

function computeLeafEntry() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const distance = Math.max(w, h) * 0.42 + 140;
  const angleDeg = -150 + Math.random() * 120;
  const rad = angleDeg * Math.PI / 180;

  const p0x = Math.cos(rad) * distance;
  const p0y = Math.sin(rad) * distance;
  const p3x = 0, p3y = 0;

  const mag = Math.hypot(p0x, p0y) || 1;
  const perpX = -p0y / mag;
  const perpY = p0x / mag;
  const swayMagnitude = mag * 0.32;

  const p1x = p0x * 0.66 + perpX * swayMagnitude;
  const p1y = p0y * 0.66 + perpY * swayMagnitude;
  const p2x = p0x * 0.28 - perpX * swayMagnitude * 0.8;
  const p2y = p0y * 0.28 - perpY * swayMagnitude * 0.8;

  return { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y };
}

function animateLeafFlight(points, duration) {
  if (leafFlightRafId !== null) {
    cancelAnimationFrame(leafFlightRafId);
    leafFlightRafId = null;
  }
  const { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y } = points;
  const start = performance.now();
  const SCALE_START = 1.6;
  const SCALE_END = 0.34;
  let rippleTriggered = false;
  const RIPPLE_TRIGGER_RATIO = 0.85;

  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function frame(now) {
    const elapsed = now - start;
    const rawT = Math.min(elapsed / duration, 1);
    const t = easeInOutCubic(rawT);

    const x = cubicBezier(t, p0x, p1x, p2x, p3x);
    const y = cubicBezier(t, p0y, p1y, p2y, p3y);
    leafStage.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;

    const scale = SCALE_START + (SCALE_END - SCALE_START) * t;
    const opacity = rawT < 0.08 ? rawT / 0.08 : 1;
    tapPromptLeaf.style.transform = `scale(${scale.toFixed(3)})`;
    tapPromptLeaf.style.opacity = opacity.toFixed(2);

    if (!rippleTriggered && rawT >= RIPPLE_TRIGGER_RATIO) {
      rippleTriggered = true;
      tapPromptRipple.classList.add('rippling');
    }

    if (rawT < 1) {
      leafFlightRafId = requestAnimationFrame(frame);
    } else {
      leafStage.style.transform = 'translate(0px, 0px)';
      tapPromptLeaf.style.opacity = '1';
      leafFlightRafId = null;
      startLeafSway(SCALE_END);
      tapPromptWelcome.style.opacity = '0';
      tapPromptText.style.opacity = '1';
      fadeOutBlackCover();
    }
  }
  leafFlightRafId = requestAnimationFrame(frame);
}

function startLeafSway(baseScale) {
  if (leafSwayRafId !== null) {
    cancelAnimationFrame(leafSwayRafId);
    leafSwayRafId = null;
  }
  const start = performance.now();
  const duration = 2600;
  function frame(now) {
    const elapsed = (now - start) % duration;
    const phase = (elapsed / duration) * Math.PI * 2;
    const rotateDeg = Math.sin(phase) * 4;
    const translateXpx = Math.sin(phase) * 2;
    tapPromptLeaf.style.transform =
      `scale(${baseScale}) rotate(${rotateDeg.toFixed(2)}deg) translateX(${translateXpx.toFixed(2)}px)`;
    leafSwayRafId = requestAnimationFrame(frame);
  }
  leafSwayRafId = requestAnimationFrame(frame);
}

function stopLeafSway() {
  if (leafSwayRafId !== null) {
    cancelAnimationFrame(leafSwayRafId);
    leafSwayRafId = null;
  }
}

export function showTapPrompt() {
  stopLeafSway();
  if (leafFlightRafId !== null) {
    cancelAnimationFrame(leafFlightRafId);
    leafFlightRafId = null;
  }
  if (leafEntryDelayTimeoutId !== null) {
    clearTimeout(leafEntryDelayTimeoutId);
    leafEntryDelayTimeoutId = null;
  }

  tapPromptRipple.classList.remove('rippling');
  tapPromptText.style.opacity = '0';
  tapPromptWelcome.style.opacity = '0';
  tapPromptLeaf.style.opacity = '0';
  tapPrompt.style.display = 'flex';
  tapPrompt.style.opacity = '1';

  void tapPromptWelcome.offsetWidth;
  requestAnimationFrame(() => { tapPromptWelcome.style.opacity = '1'; });

  leafEntryDelayTimeoutId = setTimeout(() => {
    const points = computeLeafEntry();
    leafStage.style.transform = `translate(${points.p0x.toFixed(1)}px, ${points.p0y.toFixed(1)}px)`;
    void leafStage.offsetWidth;
    animateLeafFlight(points, LEAF_FLIGHT_DURATION);
    leafEntryDelayTimeoutId = null;
  }, 500);
}

export function hideTapPrompt() {
  tapPrompt.style.opacity = '0';
  if (leafEntryDelayTimeoutId !== null) {
    clearTimeout(leafEntryDelayTimeoutId);
    leafEntryDelayTimeoutId = null;
  }
  setTimeout(() => {
    tapPrompt.style.display = 'none';
    tapPromptRipple.classList.remove('rippling');
    if (leafFlightRafId !== null) {
      cancelAnimationFrame(leafFlightRafId);
      leafFlightRafId = null;
    }
    stopLeafSway();
    leafStage.style.transform = 'translate(0px, 0px)';
    tapPromptWelcome.style.opacity = '0';
  }, 400);
}

// 載入完成：顯示說明面板並啟動點擊提示（由 buildScene 的 warmUpAndReveal 呼叫）
export function finishLoading() {
  loadingScreen.classList.add('fade-out');
  setTimeout(() => {
    document.body.appendChild(instructions);
    if (instructionsFab) document.body.appendChild(instructionsFab);
    loadingScreen.style.display = 'none';
    instructions.classList.add('ready');
    setTimeout(showTapPrompt, 5);
  }, 300);
}