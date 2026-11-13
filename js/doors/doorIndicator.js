import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { camera } from '../core/renderer.js';
import { doorAnimations, doorIndicatorInstances } from '../core/state.js';
import {
  DOOR_INDICATOR_RADIUS, DOOR_INDICATOR_INTERVAL, DOOR_INDICATOR_HEIGHT_OFFSET,
  DOOR_INDICATOR_DIR_SAMPLE_DIST,
} from '../data/constants.js';

// 總開關：false 時整體隱藏所有門方向指示器
export let SHOW_DOOR_INDICATORS = false;
window.SHOW_DOOR_INDICATORS = SHOW_DOOR_INDICATORS;

const doorIndicatorStyleTag = document.createElement('style');
doorIndicatorStyleTag.textContent = `
.door-indicator-root {
  position: absolute; left: 50%; top: 0; transform: translate(-50%, -50%);
  opacity: 0; pointer-events: none; transition: opacity 200ms ease-out;
}
.door-indicator-root.visible { opacity: 1; }
.door-indicator-group { position: relative; width: 60px; height: 30px; transform-origin: center center; }
.door-indicator-triangle-svg {
  position: absolute; left: 50%; top: 50%; width: 34px; height: 26px;
  transform: translate(-50%, -50%); overflow: visible;
  filter: drop-shadow(0 0 4px rgba(147,197,253,0.8));
}
.door-indicator-triangle-base { fill: rgba(147,197,253,0.55); }
.door-indicator-triangle-sweep { opacity: 0; }
.door-indicator-triangle-svg.playing .door-indicator-triangle-sweep {
  animation: doorIndicatorTriangleSweep 0.9s ease-in-out;
}
@keyframes doorIndicatorTriangleSweep {
  0% { opacity: 0; transform: translateX(-18px); }
  8% { opacity: 1; }
  50% { opacity: 1; transform: translateX(0px); }
  92% { opacity: 1; }
  100% { opacity: 0; transform: translateX(18px); }
}`;
document.head.appendChild(doorIndicatorStyleTag);

// 依門類型算出本地座標系的開門方向
export function getDoorOpenLocalDirection(anim) {
  if (!anim) return new THREE.Vector3(1, 0, 0);
  if (anim.type === 'sliding') {
    const sign = anim.slideSign ?? -1;
    if (anim.slideAxis === 'z') return new THREE.Vector3(0, 0, sign);
    if (anim.slideAxis === 'y') return new THREE.Vector3(0, sign, 0);
    return new THREE.Vector3(sign, 0, 0);
  }
  if (anim.type === 'turn_up') return new THREE.Vector3(0, 1, 0);
  const sign = anim.swingSign ?? -1;
  return new THREE.Vector3(-sign, 0, 0);
}

let _doorIndicatorSvgIdCounter = 0;

export function createDoorIndicator(name) {
  const wrapper = document.createElement('div');
  const root = document.createElement('div');
  root.className = 'door-indicator-root';
  const group = document.createElement('div');
  group.className = 'door-indicator-group';

  const svgNS = 'http://www.w3.org/2000/svg';
  const uid = _doorIndicatorSvgIdCounter++;
  const gradId = `doorIndicatorTriGradient_${uid}`;

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'door-indicator-triangle-svg');
  svg.setAttribute('viewBox', '0 0 34 26');
  const trianglePoints = '0,0 34,13 0,26';

  const defs = document.createElementNS(svgNS, 'defs');
  const gradient = document.createElementNS(svgNS, 'linearGradient');
  gradient.setAttribute('id', gradId);
  gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
  gradient.setAttribute('x1', '-20'); gradient.setAttribute('y1', '0');
  gradient.setAttribute('x2', '14'); gradient.setAttribute('y2', '0');

  [['0%', 'rgba(147,197,253,0)'], ['35%', 'rgba(147,197,253,0.95)'], ['50%', 'rgba(240,235,255,1)'],
   ['65%', 'rgba(168,85,247,0.95)'], ['100%', 'rgba(147,197,253,0)']].forEach(([offset, color]) => {
    const stop = document.createElementNS(svgNS, 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    gradient.appendChild(stop);
  });

  const gradientAnim = document.createElementNS(svgNS, 'animateTransform');
  gradientAnim.setAttribute('attributeName', 'gradientTransform');
  gradientAnim.setAttribute('type', 'translate');
  gradientAnim.setAttribute('from', '0 0');
  gradientAnim.setAttribute('to', '34 0');
  gradientAnim.setAttribute('dur', '0.9s');
  gradientAnim.setAttribute('begin', 'indefinite');
  gradientAnim.setAttribute('fill', 'freeze');
  gradient.appendChild(gradientAnim);

  defs.appendChild(gradient);
  svg.appendChild(defs);

  const baseTriangle = document.createElementNS(svgNS, 'polygon');
  baseTriangle.setAttribute('points', trianglePoints);
  baseTriangle.setAttribute('class', 'door-indicator-triangle-base');
  svg.appendChild(baseTriangle);

  const sweepTriangle = document.createElementNS(svgNS, 'polygon');
  sweepTriangle.setAttribute('points', trianglePoints);
  sweepTriangle.setAttribute('class', 'door-indicator-triangle-sweep');
  sweepTriangle.setAttribute('fill', `url(#${gradId})`);
  svg.appendChild(sweepTriangle);

  group.appendChild(svg);
  root.appendChild(group);
  wrapper.appendChild(root);

  doorIndicatorInstances[name] = {
    wrapper, root, group, svgEl: svg,
    gradientAnimEl: gradientAnim,
    cssObject: null, isVisible: false, elapsed: 0,
  };
}

// 需於 buildScene 中 doorAnimations 填好後呼叫
export function attachDoorIndicatorsToScene() {
  Object.keys(doorAnimations).forEach(name => {
    if (!doorIndicatorInstances[name]) createDoorIndicator(name);
    const inst = doorIndicatorInstances[name];
    if (inst.cssObject) return;
    const anim = doorAnimations[name];
    if (!anim || !anim.mesh) return;

    const cssObject = new CSS2DObject(inst.wrapper);
    const x = anim.indicatorLocalX ?? 0;
    const y = anim.indicatorLocalY ?? DOOR_INDICATOR_HEIGHT_OFFSET;
    cssObject.position.set(x, y, 0);
    anim.mesh.add(cssObject);
    inst.cssObject = cssObject;
  });
}

const _doorIndicatorAnchor = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _invMatrix = new THREE.Matrix4();
const _localCenter = new THREE.Vector3();
const _localSample = new THREE.Vector3();
const _worldSample = new THREE.Vector3();

export function updateDoorIndicators(delta) {
  if (!SHOW_DOOR_INDICATORS) {
    Object.keys(doorIndicatorInstances).forEach(name => {
      const inst = doorIndicatorInstances[name];
      if (inst && inst.isVisible) {
        inst.isVisible = false;
        inst.root.classList.remove('visible');
      }
    });
    return;
  }

  Object.keys(doorAnimations).forEach(name => {
    const inst = doorIndicatorInstances[name];
    const anim = doorAnimations[name];
    if (!inst || !inst.cssObject || !anim) return;

    if (anim.isOpen) {
      if (inst.isVisible) {
        inst.isVisible = false;
        inst.root.classList.remove('visible');
      }
      return;
    }

    inst.cssObject.getWorldPosition(_doorIndicatorAnchor);
    _p0.copy(_doorIndicatorAnchor).project(camera);
    const dist = camera.position.distanceTo(_doorIndicatorAnchor);
    const inRange = dist <= DOOR_INDICATOR_RADIUS && _p0.z < 1;

    if (inRange !== inst.isVisible) {
      inst.isVisible = inRange;
      inst.root.classList.toggle('visible', inRange);
      if (inRange) inst.elapsed = DOOR_INDICATOR_INTERVAL;
    }
    if (!inRange) return;

    _localCenter.set(anim.indicatorLocalX ?? 0, anim.indicatorLocalY ?? 0, 0);
    const openDirLocal = getDoorOpenLocalDirection(anim);
    _localSample.copy(_localCenter).addScaledVector(openDirLocal, DOOR_INDICATOR_DIR_SAMPLE_DIST);
    _worldSample.copy(_localSample).applyMatrix4(anim.mesh.matrixWorld);
    _p1.copy(_worldSample).project(camera);

    const sx0 = (_p0.x + 1) / 2 * window.innerWidth;
    const sy0 = (1 - _p0.y) / 2 * window.innerHeight;
    const sx1 = (_p1.x + 1) / 2 * window.innerWidth;
    const sy1 = (1 - _p1.y) / 2 * window.innerHeight;

    const dx = sx1 - sx0;
    const dy = sy1 - sy0;
    const angleDeg = (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6)
      ? Math.atan2(dy, dx) * 180 / Math.PI : 0;
    inst.group.style.transform = `rotate(${angleDeg.toFixed(1)}deg)`;

    inst.elapsed += delta;
    if (inst.elapsed >= DOOR_INDICATOR_INTERVAL) {
      inst.elapsed = 0;
      inst.svgEl.classList.remove('playing');
      void inst.svgEl.offsetWidth;
      inst.svgEl.classList.add('playing');
      if (inst.gradientAnimEl && inst.gradientAnimEl.beginElement) {
        inst.gradientAnimEl.beginElement();
      }
    }
  });
}