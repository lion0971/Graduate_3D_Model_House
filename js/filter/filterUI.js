import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { camera } from '../core/renderer.js';
import { filterState, filterUICards, interactiveDevices, outletObjects } from '../core/state.js';
import {
  FILTER_DEVICES, FILTER_LIFETIME_SECONDS, FILTER_RING_ZONES, FILTER_RING_BRIGHTEN_RATIO,
  RING_RADIUS, RING_CIRC, FILTER_CARD_SHOW_MS, FILTER_CARD_HEIGHT_OFFSET, FILTER_CARD_GAP,
  PIPE_CONFIG, FILTER_CARD_VISIBILITY_INTERVAL,
} from '../data/constants.js';
import { mixWithWhite, formatRemainingParts } from '../utils/math.js';

const filterGlowStyleTag = document.createElement('style');
filterGlowStyleTag.textContent = `
@keyframes filterRingGlowBreathe {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.06); }
}
.filter-ring-glow {
  transform-origin: 40px 40px;
  animation: filterRingGlowBreathe 1.8s ease-in-out infinite;
  will-change: opacity, transform;
}`;
document.head.appendChild(filterGlowStyleTag);

const _filterCardWorldPos = new THREE.Vector3();

function applyCardOffsetAndScale(card) {
  card.offsetWrapper.style.transform = `translateX(${card.offsetX}px)`;
}

function createFilterCard(device) {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.pointerEvents = 'none';

  const offsetWrapper = document.createElement('div');
  offsetWrapper.style.position = 'absolute';
  offsetWrapper.style.left = '0';
  offsetWrapper.style.top = '0';
  offsetWrapper.style.transform = 'translateX(0px)';
  wrapper.appendChild(offsetWrapper);

  const root = document.createElement('div');
  Object.assign(root.style, {
    display: 'none',
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
    borderRadius: '50%',
    padding: '4px',
    position: 'absolute',
    left: '50%',
    bottom: '0',
    marginLeft: '-46px',
    marginBottom: '10px',
    opacity: '0',
    transformOrigin: 'center center',
    transform: 'scale(0.4)',
    transition: `transform ${FILTER_CARD_SHOW_MS}ms ease-out, opacity ${FILTER_CARD_SHOW_MS}ms ease-out`,
  });
  root.classList.add('filter-card-glow');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '92');
  svg.setAttribute('height', '92');
  svg.setAttribute('viewBox', '0 0 92 92');
  svg.style.overflow = 'visible';

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', '46'); bg.setAttribute('cy', '46'); bg.setAttribute('r', String(RING_RADIUS));
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'rgba(255,255,255,0.15)'); bg.setAttribute('stroke-width', '6');
  svg.appendChild(bg);

  const trackCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  trackCircle.setAttribute('cx', '46'); trackCircle.setAttribute('cy', '46'); trackCircle.setAttribute('r', String(RING_RADIUS));
  trackCircle.setAttribute('fill', 'none'); trackCircle.setAttribute('stroke-width', '6');
  trackCircle.setAttribute('stroke-dasharray', `${RING_CIRC} 0`);
  trackCircle.setAttribute('stroke', FILTER_RING_ZONES[0].dim);
  svg.appendChild(trackCircle);

  const haloCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  haloCircle.setAttribute('cx', '46'); haloCircle.setAttribute('cy', '46'); haloCircle.setAttribute('r', String(RING_RADIUS));
  haloCircle.setAttribute('fill', 'none'); haloCircle.setAttribute('stroke-width', '10');
  haloCircle.setAttribute('stroke-dasharray', `${RING_CIRC} 0`);
  haloCircle.setAttribute('transform', 'rotate(-90 46 46)');
  haloCircle.style.filter = 'blur(4px)';
  haloCircle.classList.add('filter-ring-glow');
  svg.appendChild(haloCircle);

  const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progressCircle.setAttribute('cx', '46'); progressCircle.setAttribute('cy', '46'); progressCircle.setAttribute('r', String(RING_RADIUS));
  progressCircle.setAttribute('fill', 'none'); progressCircle.setAttribute('stroke-width', '6');
  progressCircle.setAttribute('stroke-linecap', 'round');
  progressCircle.setAttribute('stroke-dasharray', `0 ${RING_CIRC}`);
  progressCircle.setAttribute('transform', 'rotate(-90 46 46)');
  svg.appendChild(progressCircle);

  root.appendChild(svg);

  const ringLabel = document.createElement('div');
  ringLabel.textContent = '淨水餘時';
  ringLabel.className = 'ring-label';
  Object.assign(ringLabel.style, {
    fontSize: '14px', fontWeight: '600', letterSpacing: '2px',
    color: 'rgba(255, 255, 255, 0.85)',
    textShadow: `
      0 0 4px rgba(255, 255, 255, 0.5),
      0 0 10px rgba(120, 200, 255, 0.5),
      -1px -1px 2px rgba(0,0,0,0.8), 1px -1px 2px rgba(0,0,0,0.8),
      -1px 1px 2px rgba(0,0,0,0.8), 1px 1px 2px rgba(0,0,0,0.8)`,
  });
  root.appendChild(ringLabel);

  const timeText = document.createElement('div');
  Object.assign(timeText.style, {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    color: '#fff', textAlign: 'center', lineHeight: '1.15', whiteSpace: 'nowrap',
    textShadow: `
      -1px -1px 2px rgba(0,0,0,0.85), 1px -1px 2px rgba(0,0,0,0.85),
      -1px 1px 2px rgba(0,0,0,0.85), 1px 1px 2px rgba(0,0,0,0.85),
      0 2px 4px rgba(0,0,0,0.6)`,
    pointerEvents: 'none',
  });

  function makeRemainingTimeLine(unitLabel) {
    const line = document.createElement('div');
    Object.assign(line.style, { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px' });
    const valueSpan = document.createElement('span');
    valueSpan.style.fontSize = '16px';
    valueSpan.style.fontWeight = '700';
    const unitSpan = document.createElement('span');
    unitSpan.textContent = unitLabel;
    unitSpan.style.fontSize = '13px';
    unitSpan.style.fontWeight = '600';
    unitSpan.style.opacity = '0.9';
    line.appendChild(valueSpan);
    line.appendChild(unitSpan);
    timeText.appendChild(line);
    return valueSpan;
  }

  const hourValueEl = makeRemainingTimeLine('時');
  const minuteValueEl = makeRemainingTimeLine('分');
  const secondValueEl = makeRemainingTimeLine('秒');
  root.appendChild(timeText);
  offsetWrapper.appendChild(root);

  filterUICards[device] = {
    wrapper, offsetWrapper, root, cssObject: null,
    trackCircle, progressCircle, haloCircle,
    hourValueEl, minuteValueEl, secondValueEl,
    hideTimer: null, isVisible: false, offsetX: 0,
  };
}
FILTER_DEVICES.forEach(createFilterCard);

// 掛到出水口（找不到則退回裝置 mesh）；由 buildScene 於 GLTF 載入後呼叫
export function attachFilterCardsToScene() {
  FILTER_DEVICES.forEach(device => {
    const card = filterUICards[device];
    if (!card || card.cssObject) return;
    const cfg = PIPE_CONFIG[device];
    const anchorParent =
      (cfg && outletObjects[cfg.outletKey]) ||
      interactiveDevices.find(m => m.name.toLowerCase() === device);
    if (!anchorParent) {
      console.warn(`[FilterUI] 找不到 ${device} 對應的3D物件，濾心卡片無法定位`);
      return;
    }
    const cssObject = new CSS2DObject(card.wrapper);
    cssObject.position.set(0, FILTER_CARD_HEIGHT_OFFSET, 0);
    anchorParent.add(cssObject);
    card.cssObject = cssObject;
  });
}

export function updateFilterUI(device) {
  const card = filterUICards[device];
  const st = filterState[device];
  if (!card || !st) return;

  const usedPercent = Math.min(100, (st.usedSeconds / FILTER_LIFETIME_SECONDS) * 100);
  const remainSeconds = Math.max(0, FILTER_LIFETIME_SECONDS - st.usedSeconds);
  const remainPercent = 100 - usedPercent;

  const currentZone = FILTER_RING_ZONES.find((zone, i) => {
    const isLast = i === FILTER_RING_ZONES.length - 1;
    return usedPercent >= zone.min && (isLast ? usedPercent <= zone.max : usedPercent < zone.max);
  }) || FILTER_RING_ZONES[FILTER_RING_ZONES.length - 1];

  card.trackCircle.setAttribute('stroke', currentZone.dim);

  const progressLen = (remainPercent / 100) * RING_CIRC;
  const coreColor = mixWithWhite(currentZone.color, FILTER_RING_BRIGHTEN_RATIO);
  card.progressCircle.setAttribute('stroke-dasharray', `${progressLen} ${RING_CIRC - progressLen}`);
  card.progressCircle.setAttribute('stroke', coreColor);
  card.progressCircle.style.filter =
    `saturate(1.6) brightness(1.25) drop-shadow(0 0 4px ${currentZone.color}) drop-shadow(0 0 8px ${currentZone.color})`;

  card.haloCircle.setAttribute('stroke', currentZone.color);

  const parts = formatRemainingParts(remainSeconds);
  card.hourValueEl.textContent = parts.h;
  card.minuteValueEl.textContent = parts.m;
  card.secondValueEl.textContent = parts.s;
}

// 卡片互相重疊時，用鬆弛演算法水平推開
export function resolveFilterCardOverlaps() {
  const visibleDevices = FILTER_DEVICES.filter(
    d => filterUICards[d] && filterUICards[d].root.style.display === 'flex'
  );
  if (visibleDevices.length === 0) return;

  if (visibleDevices.length === 1) {
    const card = filterUICards[visibleDevices[0]];
    card.offsetX = 0;
    card.offsetWrapper.style.transition = 'transform 0.25s ease';
    applyCardOffsetAndScale(card);
    return;
  }

  visibleDevices.forEach(d => {
    const card = filterUICards[d];
    card.offsetX = 0;
    card.offsetWrapper.style.transition = 'none';
    applyCardOffsetAndScale(card);
  });
  void filterUICards[visibleDevices[0]].offsetWrapper.offsetWidth;

  const rects = visibleDevices.map(d => {
    const r = filterUICards[d].root.getBoundingClientRect();
    return { device: d, left: r.left, right: r.right, offset: 0 };
  });

  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const aLeft = a.left + a.offset, aRight = a.right + a.offset;
        const bLeft = b.left + b.offset, bRight = b.right + b.offset;
        const overlap = Math.min(aRight, bRight) - Math.max(aLeft, bLeft) + FILTER_CARD_GAP;
        if (overlap > 0) {
          const push = overlap / 2;
          if (aLeft <= bLeft) { a.offset -= push; b.offset += push; }
          else { a.offset += push; b.offset -= push; }
        }
      }
    }
  }

  rects.forEach(r => {
    const card = filterUICards[r.device];
    card.offsetX = r.offset;
    card.offsetWrapper.style.transition = 'transform 0.25s ease';
    applyCardOffsetAndScale(card);
  });
}

export function showFilterCard(card) {
  if (card.hideTimer) { clearTimeout(card.hideTimer); card.hideTimer = null; }
  const el = card.root;
  el.style.display = 'flex';

  // 先量測最終尺寸再播放展開動畫
  el.style.transition = 'none';
  el.style.transform = 'scale(1)';
  el.style.opacity = '1';
  resolveFilterCardOverlaps();

  el.style.transform = 'scale(0.4)';
  el.style.opacity = '0';
  void el.offsetWidth;
  el.style.transition = `transform ${FILTER_CARD_SHOW_MS}ms ease-out, opacity ${FILTER_CARD_SHOW_MS}ms ease-out`;
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';
  });
}

export function hideFilterCard(card) {
  if (card.hideTimer) { clearTimeout(card.hideTimer); card.hideTimer = null; }
  card.root.style.transition = 'none';
  card.root.style.display = 'none';
  resolveFilterCardOverlaps();
}

let filterCardVisibilityElapsed = 0;

function updateFilterCardVisibility(device) {
  const card = filterUICards[device];
  const st = filterState[device];
  if (!card || !st || !card.cssObject) return;

  let shouldShow = false;
  if (st.isActive) {
    card.cssObject.getWorldPosition(_filterCardWorldPos);
    _filterCardWorldPos.project(camera);
    shouldShow =
      _filterCardWorldPos.z < 1 &&
      _filterCardWorldPos.x >= -1 && _filterCardWorldPos.x <= 1 &&
      _filterCardWorldPos.y >= -1 && _filterCardWorldPos.y <= 1;
  }

  if (shouldShow !== !!card.isVisible) {
    card.isVisible = shouldShow;
    if (shouldShow) showFilterCard(card);
    else hideFilterCard(card);
  }
  if (card.isVisible) applyCardOffsetAndScale(card);
}

// 傳入 delta 時做節流（動畫迴圈用）；不傳則立即執行（開關水時用）
export function updateFilterUIVisibility(delta = 0) {
  if (delta) {
    filterCardVisibilityElapsed += delta;
    if (filterCardVisibilityElapsed < FILTER_CARD_VISIBILITY_INTERVAL) return;
    filterCardVisibilityElapsed = 0;
  }
  FILTER_DEVICES.forEach(device => updateFilterCardVisibility(device));
}