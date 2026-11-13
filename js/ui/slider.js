import * as THREE from 'three';
import { state } from '../core/state.js';
import { scene, renderer } from '../core/renderer.js';
import { sunLight, sunMesh } from '../loop/sun.js';
import { LIGHTS_ON_ELEV_RATIO, DEFAULT_DAY_VALUE } from '../data/constants.js';

export const sliderWrap = document.createElement('div');
Object.assign(sliderWrap.style, {
  position: 'fixed',
  bottom: '28px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  height: '48px',
  boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '40px',
  padding: '0 22px',
  zIndex: '300',
  pointerEvents: 'none',
  userSelect: 'none',
  opacity: '0',
  transition: 'opacity 0.3s ease',
});
document.body.appendChild(sliderWrap);

sliderWrap.appendChild(Object.assign(document.createElement('span'), {
  textContent: '🌙', style: 'font-size:22px',
}));

export const daySlider = document.createElement('input');
Object.assign(daySlider, { type: 'range', min: '0', max: '100', value: '15' });
Object.assign(daySlider.style, { width: '200px', cursor: 'pointer', accentColor: '#ffd97a' });
sliderWrap.appendChild(daySlider);

sliderWrap.appendChild(Object.assign(document.createElement('span'), {
  textContent: '☀️', style: 'font-size:22px',
}));

// 日夜核心：t 為滑桿值 0~100
// n 只用來算太陽方位角；elevRatio（兩端 0、中間 1）用來算亮度、色溫、曝光
export function applyDayNight(t) {
  const n = t / 100;

  const MAX_ELEVATION = Math.PI / 4;
  const elevation = Math.sin(n * Math.PI) * MAX_ELEVATION;
  const elevRatio = elevation / MAX_ELEVATION;

  const SUNSET_AZIMUTH = THREE.MathUtils.degToRad(75);
  const azimuth = SUNSET_AZIMUTH * (1 - 2 * n);
  const dist = 60;

  const sx = Math.cos(elevation) * Math.sin(azimuth) * dist;
  const sy = Math.sin(elevation) * dist;
  const sz = Math.cos(elevation) * Math.cos(azimuth) * dist;

  sunLight.position.set(sx, sy, sz);
  sunMesh.position.set(sx, sy, sz);

  sunLight.intensity = Math.sin(elevation) * 3.6;

  const dawnColor = new THREE.Color(0xffd0a0);
  const noonColor = new THREE.Color(0xfff5e0);
  const sunColor = dawnColor.clone().lerp(noonColor, elevRatio);
  sunLight.color.copy(sunColor);
  sunMesh.material.color.copy(sunColor);

  renderer.toneMappingExposure = 0.2 + elevRatio * 1.0;

  const ambLight = scene.children.find(o => o.isAmbientLight);
  if (ambLight) ambLight.intensity = 0.005 + elevRatio * 0.5;

  if (scene.background instanceof THREE.Color) {
    scene.background.lerpColors(new THREE.Color(0x0d0503), new THREE.Color(0x87ceeb), elevRatio);
  }

  // 燈泡目標亮度：日出 / 日落附近開燈，正午熄燈
  if (elevRatio <= 0.5) {
    const refExp = 1.8;
    const curExp = 1.3 + elevRatio;
    state.targetBulbStrength = Math.min(refExp / curExp, 3.0);
  } else if (elevRatio <= LIGHTS_ON_ELEV_RATIO) {
    state.targetBulbStrength = 1.0;
  } else {
    state.targetBulbStrength = 0.0;
  }
}

daySlider.addEventListener('input', () => {
  if (state.isXRayMode) return;
  applyDayNight(parseFloat(daySlider.value));
});
daySlider.addEventListener('mousedown', e => e.stopPropagation());
daySlider.addEventListener('click', e => e.stopPropagation());

export { DEFAULT_DAY_VALUE };