import * as THREE from 'three';
import { state, cachedSceneMeshes, bulbMeshes } from '../core/state.js';
import { controls } from '../core/controls.js';
import { scene, renderer } from '../core/renderer.js';
import { PIPE_MATERIALS } from '../water/pipes.js';
import { checkCurrentCollision } from '../physics/collision.js';
import { applyBulbStrength } from '../loop/bulbs.js';
import { sunLight, sunMesh } from '../loop/sun.js';
import { daySlider, applyDayNight, sliderWrap } from './slider.js';
import { setClimatePanelInstantVisible } from './climate.js';
import { setDashboardAvailable } from './dashboard.js';
import {
  SHOW_SUN_MESH, DEFAULT_DAY_VALUE, XRAY_TONE_EXPOSURE, XRAY_AMBIENT_INTENSITY,
} from '../data/constants.js';

const menuStyleTag = document.createElement('style');
menuStyleTag.textContent = `
  #xray-transition-overlay {
    position: fixed; inset: 0; z-index: 999999; display: none;
    align-items: center; justify-content: center; pointer-events: none;
  }
  #xray-transition-overlay.show { display: flex; }
  .xray-transition-dots { display: flex; gap: 10px; }
  .xray-transition-dots span {
    width: 10px; height: 10px; border-radius: 50%; background: #4facfe;
    box-shadow: 0 0 10px rgba(79, 172, 254, 0.9); opacity: 0.25;
    animation: xray-dot-blink 1.2s infinite ease-in-out;
  }
  .xray-transition-dots span:nth-child(1) { animation-delay: 0s; }
  .xray-transition-dots span:nth-child(2) { animation-delay: 0.2s; }
  .xray-transition-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes xray-dot-blink {
    0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
    40% { opacity: 1; transform: scale(1.15); }
  }`;
document.head.appendChild(menuStyleTag);

const xrayTransitionOverlay = document.createElement('div');
xrayTransitionOverlay.id = 'xray-transition-overlay';
xrayTransitionOverlay.innerHTML = `<div class="xray-transition-dots"><span></span><span></span><span></span></div>`;
document.body.appendChild(xrayTransitionOverlay);

function showXrayTransition() { xrayTransitionOverlay.classList.add('show'); }
function hideXrayTransition() { xrayTransitionOverlay.classList.remove('show'); }

// ── 中央選單 ──
export const menuPanel = document.createElement('div');
menuPanel.id = 'menu-panel';
Object.assign(menuPanel.style, {
  display: 'none',
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(0,255,255,0.4)',
  borderRadius: '12px',
  padding: '24px 36px',
  zIndex: '200',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  minWidth: '220px',
  pointerEvents: 'auto',
});
document.body.appendChild(menuPanel);

const menuTitle = document.createElement('div');
menuTitle.innerText = '選單';
Object.assign(menuTitle.style, {
  color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '4px', letterSpacing: '2px',
});
menuPanel.appendChild(menuTitle);

export const xrayBtn = document.createElement('button');
xrayBtn.innerText = '開啟管路透視模式';
Object.assign(xrayBtn.style, {
  padding: '10px 20px', cursor: 'pointer', background: 'rgba(0,255,255,0.2)',
  color: 'white', border: '1px solid cyan', borderRadius: '6px', fontSize: '15px', width: '100%',
});
menuPanel.appendChild(xrayBtn);

// ── 管路透視模式切換 ──
export function toggleXRayMode(enable) {
  state.isNoclipMode = enable;
  if (!enable) state.isStuckInWall = checkCurrentCollision();

  if (enable) {
    state.daySliderValueBeforeXRay = daySlider.value;
    daySlider.value = String(DEFAULT_DAY_VALUE);
    applyDayNight(DEFAULT_DAY_VALUE);
    renderer.toneMappingExposure = XRAY_TONE_EXPOSURE;
    const ambLight = scene.children.find(o => o.isAmbientLight);
    if (ambLight) ambLight.intensity = XRAY_AMBIENT_INTENSITY;
    sliderWrap.style.opacity = '0';
    sliderWrap.style.pointerEvents = 'none';
    setClimatePanelInstantVisible(false);
  } else if (state.daySliderValueBeforeXRay !== null) {
    daySlider.value = state.daySliderValueBeforeXRay;
    applyDayNight(parseFloat(state.daySliderValueBeforeXRay));
    state.daySliderValueBeforeXRay = null;
  }

  if (enable) {
    sunLight.userData._xray_intensity = sunLight.intensity;
    sunLight.intensity = 0;
    sunMesh.visible = false;
  } else {
    sunLight.intensity = sunLight.userData._xray_intensity ?? sunLight.intensity;
    sunMesh.visible = SHOW_SUN_MESH;
  }

  if (enable) {
    scene.userData._origBackground = scene.background;
    scene.background = new THREE.Color(0x000000);
  } else {
    scene.background = scene.userData._origBackground ?? null;
  }

  bulbMeshes.forEach(({ mesh }) => {
    if (mesh.material) {
      if (enable) {
        mesh.material.userData._xray_emissive = mesh.material.emissiveIntensity;
        mesh.material.emissiveIntensity = 0;
      }
    }
    mesh.children.forEach(c => {
      if (c.isLight) {
        if (enable) {
          c.userData._xray_intensity = c.intensity;
          c.intensity = 0;
        } else {
          c.intensity = c.userData._xray_intensity ?? c.intensity;
        }
      }
      if ((c.isMesh || c.isSprite) && (c.userData.isLineBulbGlow || c.userData.isBallBulbGlow)) {
        c.visible = !enable;
      }
    });
  });
  if (!enable) applyBulbStrength(state.currentBulbStrength);

  const processedMaterials = new Set();
  cachedSceneMeshes.forEach((obj) => {
    const mat = obj.material;
    if (!mat || processedMaterials.has(mat)) return;
    processedMaterials.add(mat);
    if (enable) {
      mat.userData._origOpacity = mat.opacity;
      mat.userData._origTransparent = mat.transparent;
      mat.userData._origDepthWrite = mat.depthWrite;
      mat.transparent = true;
      mat.opacity = 0.15;
      mat.depthWrite = false;
    } else {
      mat.opacity = mat.userData._origOpacity ?? 1.0;
      mat.transparent = mat.userData._origTransparent ?? false;
      mat.depthWrite = mat.userData._origDepthWrite ?? true;
    }
  });

  PIPE_MATERIALS.cold.inactive.opacity = enable ? 0.6 : 0.12;
  PIPE_MATERIALS.drain.inactive.opacity = enable ? 0.6 : 0.12;
}

xrayBtn.onclick = (e) => {
  e.stopPropagation();
  state.unlockFromButton = true;
  state.isXRayMode = !state.isXRayMode;
  xrayBtn.innerText = state.isXRayMode ? '關閉管路透視模式' : '開啟管路透視模式';
  xrayBtn.style.background = state.isXRayMode ? 'rgba(0,255,255,0.5)' : 'rgba(0,255,255,0.2)';

  showXrayTransition();
  setTimeout(() => {
    toggleXRayMode(state.isXRayMode);
    hideXrayTransition();
    menuPanel.style.display = 'none';
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) exitBtn.classList.remove('show');
    setTimeout(() => {
      state.unlockFromButton = false;
      controls.lock();
    }, 80);
  }, 50);
};

export function openMenu() {
  if (controls.isLocked) controls.unlock();
  menuPanel.style.display = 'flex';
  const exitBtn = document.getElementById('exit-btn');
  if (exitBtn) exitBtn.classList.add('show');
  setDashboardAvailable(true);
}

export function closeMenu() {
  state.unlockFromButton = true;
  menuPanel.style.display = 'none';
  setTimeout(() => {
    state.unlockFromButton = false;
    controls.lock();
  }, 80);
  const exitBtn = document.getElementById('exit-btn');
  if (exitBtn) exitBtn.classList.remove('show');
  setDashboardAvailable(false);
}

// 雙擊畫面開啟選單
renderer.domElement.addEventListener('dblclick', () => openMenu());