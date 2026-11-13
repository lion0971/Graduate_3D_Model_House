import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { camera } from '../core/renderer.js';
import { state, interactiveDevices, doorAnimations, switchHintCards, doorHintInstances, hintOccluders } from '../core/state.js';
import {
  SWITCH_HINT_DEVICES, SWITCH_HINT_RADIUS, SWITCH_HINT_HEIGHT_OFFSET,
  DOOR_HINT_DEVICES, DOOR_HINT_RADIUS, DOOR_HINT_HEIGHT_OFFSET,
} from '../data/constants.js';

// ════════ 開關魚形提示 ════════
const switchHintStyleTag = document.createElement('style');
switchHintStyleTag.textContent = `
.switch-hint-root {
  position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
  opacity: 0; pointer-events: none; transition: opacity 200ms ease-out;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.switch-hint-root.visible { opacity: 1; }
.switch-hint-label { color: rgba(255,255,255,0.9); font-size: 15px; font-weight: 700; white-space: nowrap; }
.switch-hint-fish-group { position: relative; width: 80px; height: 33px; }
.switch-hint-fish-slot { position: absolute; top: 4px; }
.switch-hint-fish-slot.slot-left { left: -10px; transform: rotate(55deg); }
.switch-hint-fish-slot.slot-right { right: -10px; transform: rotate(135deg); }
.switch-hint-fish-h { display: flex; align-items: center; animation: switchHintNibble 0.95s linear infinite; will-change: transform; }
.switch-hint-fish-h.delayed { animation-duration: 1.25s; animation-delay: 0.3s; }
@keyframes switchHintNibble {
  0%   { transform: translateX(0) scaleX(1); }
  22%  { transform: translateX(9px) scaleX(0.88); }
  38%  { transform: translateX(8px) scaleX(0.92); }
  100% { transform: translateX(0) scaleX(1); }
}
.fish-body-h {
  width: 25px; height: 16px;
  background: linear-gradient(180deg, #ffb454, #fb7a1f); border-radius: 50%;
  box-shadow: 0 0 8px rgba(251, 146, 60, 0.7), 0 2px 5px rgba(0,0,0,0.4);
}
.fish-head-h {
  width: 0; height: 0;
  border-top: 7px solid transparent; border-bottom: 7px solid transparent;
  border-left: 9px solid #fb7a1f; margin-left: -5px;
  filter: drop-shadow(1px 0 2px rgba(0,0,0,0.3));
}
.fish-tailfin-h {
  width: 24px; height: 20px; background-color: #fb7a1f; margin-right: -10px;
  filter: drop-shadow(-1px 0 2px rgba(0,0,0,0.25));
  clip-path: polygon(0% 0%, 100% 50%, 0% 100%, 35% 50%);
}`;
document.head.appendChild(switchHintStyleTag);

function buildSwitchHintFish(extraClass) {
  const fish = document.createElement('div');
  fish.className = extraClass ? `switch-hint-fish-h ${extraClass}` : 'switch-hint-fish-h';
  const tailFin = document.createElement('div'); tailFin.className = 'fish-tailfin-h';
  const body = document.createElement('div'); body.className = 'fish-body-h';
  const head = document.createElement('div'); head.className = 'fish-head-h';
  fish.appendChild(tailFin);
  fish.appendChild(body);
  fish.appendChild(head);
  return fish;
}

function createSwitchHint(device) {
  const wrapper = document.createElement('div');
  const root = document.createElement('div');
  root.className = 'switch-hint-root';

  const label = document.createElement('div');
  label.className = 'switch-hint-label';
  label.textContent = '按開關';

  const group = document.createElement('div');
  group.className = 'switch-hint-fish-group';

  const slotLeft = document.createElement('div');
  slotLeft.className = 'switch-hint-fish-slot slot-left';
  slotLeft.appendChild(buildSwitchHintFish());

  const slotRight = document.createElement('div');
  slotRight.className = 'switch-hint-fish-slot slot-right';
  slotRight.appendChild(buildSwitchHintFish('delayed'));

  group.appendChild(slotLeft);
  group.appendChild(slotRight);
  root.appendChild(label);
  root.appendChild(group);
  wrapper.appendChild(root);

  switchHintCards[device] = { wrapper, root, cssObject: null, isVisible: false, dismissedUntilLeave: false };
}
SWITCH_HINT_DEVICES.forEach(createSwitchHint);

// 需於 buildScene 中 interactiveDevices 填好後呼叫
export function attachSwitchHintsToScene() {
  SWITCH_HINT_DEVICES.forEach(device => {
    const hint = switchHintCards[device];
    if (!hint || hint.cssObject) return;
    const anchorParent = interactiveDevices.find(m => m.name.toLowerCase() === device);
    if (!anchorParent) {
      console.warn(`[SwitchHint] 找不到 ${device} 對應的3D物件`);
      return;
    }
    const cssObject = new CSS2DObject(hint.wrapper);
    cssObject.position.set(0, SWITCH_HINT_HEIGHT_OFFSET, 0);
    anchorParent.add(cssObject);
    hint.cssObject = cssObject;
  });
}

function setSwitchHintVisible(device, visible) {
  const hint = switchHintCards[device];
  if (!hint || !hint.cssObject || hint.isVisible === visible) return;
  hint.isVisible = visible;
  hint.root.classList.toggle('visible', visible);
}

// 按下開關後，本次靠近期間不再彈出
export function dismissSwitchHint(device) {
  const hint = switchHintCards[device];
  if (!hint) return;
  hint.dismissedUntilLeave = true;
  setSwitchHintVisible(device, false);
}

const _hintRaycaster = new THREE.Raycaster();
_hintRaycaster.firstHitOnly = true;
const _hintDir = new THREE.Vector3();
const _switchHintWorldPos = new THREE.Vector3();

function isHintOccluded(targetPos, dist) {
  if (hintOccluders.length === 0) return false;
  _hintDir.copy(targetPos).sub(camera.position).normalize();
  _hintRaycaster.set(camera.position, _hintDir);
  _hintRaycaster.far = Math.max(0, dist - 0.1);
  return _hintRaycaster.intersectObjects(hintOccluders, false).length > 0;
}

// 由 animate.js 每 SWITCH_HINT_CHECK_INTERVAL 秒呼叫一次
export function updateSwitchHintVisibility() {
  SWITCH_HINT_DEVICES.forEach(device => {
    const hint = switchHintCards[device];
    if (!hint || !hint.cssObject) return;

    hint.cssObject.getWorldPosition(_switchHintWorldPos);
    const dist = camera.position.distanceTo(_switchHintWorldPos);
    const inDistance = dist <= SWITCH_HINT_RADIUS;
    if (!inDistance) hint.dismissedUntilLeave = false;

    const occluded = inDistance && isHintOccluded(_switchHintWorldPos, dist);
    setSwitchHintVisible(device, inDistance && !occluded && !hint.dismissedUntilLeave);
  });
}

// ════════ 門靠近提示（光暈 + 文字浮現） ════════
const doorHintStyleTag = document.createElement('style');
doorHintStyleTag.textContent = `
.door-hint-root {
  position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
  opacity: 0; pointer-events: none; transition: opacity 150ms ease-out;
  display: flex; align-items: center; justify-content: center;
}
.door-hint-root.visible { opacity: 1; }
.door-hint-glow {
  position: absolute; left: 50%; top: 50%; width: 220px; height: 220px;
  transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255,255,255,0.5) 0%, rgba(191,219,254,0.3) 30%,
    rgba(147,197,253,0.12) 55%, rgba(147,197,253,0) 75%);
  pointer-events: none; opacity: 0;
}
.door-hint-glow.glowing { opacity: 1; animation: doorHintGlowBreathe 2.6s ease-in-out infinite; }
@keyframes doorHintGlowBreathe {
  0%, 100% { opacity: 0.65; transform: translate(-50%, -50%) scale(0.92); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
}
.door-hint-label {
  position: absolute; z-index: 2; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0;
  color: #ffffff; font-weight: bold; font-size: 17px; pointer-events: none; white-space: nowrap;
  letter-spacing: 1px; text-shadow: 0 0 6px rgba(0,0,0,0.7), 0 0 12px rgba(0,0,0,0.5);
  clip-path: inset(0 100% 0 0);
}
.door-hint-label.appearing { animation: doorHintLabelAppear 0.12s 0s ease-out both; }
@keyframes doorHintLabelAppear {
  0% { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0% 0 0); }
}
.door-hint-leaf-wrap {
  position: absolute; left: 50%; top: 50%; width: 52px; height: 52px;
  transform: translate(-50%, -50%); pointer-events: none;
}
.door-hint-leaf-mask { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; filter: blur(3px); }
.door-hint-leaf-bubble-base {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 30% 28%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 24%),
    radial-gradient(circle at 50% 55%, rgba(196,181,253,0.45) 0%, rgba(147,112,219,0.35) 55%, rgba(126,58,242,0.2) 100%);
}
.door-hint-leaf-sweep {
  position: absolute; top: -30%; left: -60%; width: 55%; height: 160%;
  background: linear-gradient(100deg,
    rgba(147,197,253,0) 0%, rgba(147,197,253,0.9) 35%,
    rgba(240,235,255,1) 50%, rgba(168,85,247,0.9) 65%, rgba(147,197,253,0) 100%);
  transform: translateX(-100%); opacity: 0;
}
.door-hint-leaf-wrap.leaf-playing .door-hint-leaf-sweep { animation: doorHintLeafSweep 0.45s ease-in-out forwards; }
@keyframes doorHintLeafSweep {
  0% { transform: translateX(-100%); opacity: 0; filter: brightness(1); }
  8% { opacity: 1; filter: brightness(1); }
  50% { opacity: 1; filter: brightness(1.9); }
  92% { opacity: 1; filter: brightness(1); }
  100% { transform: translateX(220%); opacity: 0; filter: brightness(1); }
}
.door-hint-drift-group { position: absolute; inset: 0; }
.door-hint-drift-group.drifting { animation: doorHintLeafDrift 3.2s ease-in-out infinite; }
@keyframes doorHintLeafDrift {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-4px) rotate(2deg); }
}`;
document.head.appendChild(doorHintStyleTag);

// 共用旗標：按過任一扇門後，所有門提示永久不再顯示
export function dismissDoorHintPermanently() {
  state.doorHintSeen = true;
  DOOR_HINT_DEVICES.forEach(({ name }) => setDoorHintVisible(name, false));
}

function buildDoorHintLeaf() {
  const wrap = document.createElement('div');
  wrap.className = 'door-hint-leaf-wrap';
  const mask = document.createElement('div');
  mask.className = 'door-hint-leaf-mask';
  const bubbleBase = document.createElement('div');
  bubbleBase.className = 'door-hint-leaf-bubble-base';
  const sweep = document.createElement('div');
  sweep.className = 'door-hint-leaf-sweep';
  mask.appendChild(bubbleBase);
  mask.appendChild(sweep);
  wrap.appendChild(mask);
  return wrap;
}

function createDoorHint(config) {
  const wrapper = document.createElement('div');
  const root = document.createElement('div');
  root.className = 'door-hint-root';

  const glow = document.createElement('div');
  glow.className = 'door-hint-glow';

  const driftGroup = document.createElement('div');
  driftGroup.className = 'door-hint-drift-group';

  const leafWrap = buildDoorHintLeaf();

  const label = document.createElement('div');
  label.className = 'door-hint-label';
  label.textContent = '按門開關';

  driftGroup.appendChild(leafWrap);
  driftGroup.appendChild(label);
  root.appendChild(glow);
  root.appendChild(driftGroup);
  wrapper.appendChild(root);

  doorHintInstances[config.name] = {
    wrapper, root, label, leafWrap, driftGroup, glow, cssObject: null,
    offsetX: config.offsetX || 0, isVisible: false,
  };
}
DOOR_HINT_DEVICES.forEach(createDoorHint);

// 需於 buildScene 中 doorAnimations 填好後呼叫
export function attachDoorHintsToScene() {
  DOOR_HINT_DEVICES.forEach(({ name }) => {
    const hint = doorHintInstances[name];
    if (!hint || hint.cssObject) return;
    const anim = doorAnimations[name];
    if (!anim || !anim.mesh) {
      console.warn(`[DoorHint] 找不到 ${name} 對應的3D物件`);
      return;
    }
    const cssObject = new CSS2DObject(hint.wrapper);
    cssObject.position.set(hint.offsetX, DOOR_HINT_HEIGHT_OFFSET, 0);
    anim.mesh.add(cssObject);
    hint.cssObject = cssObject;
  });
}

function triggerDoorHintAppear(device) {
  const hint = doorHintInstances[device];
  if (!hint) return;
  hint.leafWrap.classList.remove('leaf-playing');
  void hint.leafWrap.offsetWidth;
  hint.leafWrap.classList.add('leaf-playing');

  hint.label.classList.remove('appearing');
  void hint.label.offsetWidth;
  hint.label.classList.add('appearing');

  hint.driftGroup.classList.remove('drifting');
  void hint.driftGroup.offsetWidth;
  hint.driftGroup.classList.add('drifting');

  hint.glow.classList.remove('glowing');
  void hint.glow.offsetWidth;
  hint.glow.classList.add('glowing');
}

function setDoorHintVisible(device, visible) {
  const hint = doorHintInstances[device];
  if (!hint || hint.isVisible === visible) return;
  hint.isVisible = visible;
  hint.root.classList.toggle('visible', visible);
  if (visible) triggerDoorHintAppear(device);
}

const _doorHintWorldPos = new THREE.Vector3();

// 由 animate.js 每幀呼叫
export function updateDoorHintsVisibility() {
  if (state.doorHintSeen) return;
  DOOR_HINT_DEVICES.forEach(({ name }) => {
    const hint = doorHintInstances[name];
    if (!hint || !hint.cssObject) return;
    hint.cssObject.getWorldPosition(_doorHintWorldPos);
    const dist = camera.position.distanceTo(_doorHintWorldPos);
    setDoorHintVisible(name, dist <= DOOR_HINT_RADIUS);
  });
}