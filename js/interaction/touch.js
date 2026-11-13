import * as THREE from 'three';
import { camera, renderer } from '../core/renderer.js';
import { controls, isMobile } from '../core/controls.js';
import { raycaster } from '../core/raycaster.js';
import { state, doorObjects, interactiveDevices } from '../core/state.js';
import { hideTapPrompt, fadeOutBlackCover, tapPrompt, instructions, instructionsFab } from '../ui/loadingScreen.js';
import { hideWeatherPanel } from '../ui/weatherPanel.js';
import { sliderWrap } from '../ui/slider.js';
import { setClimatePanelInstantVisible } from '../ui/climate.js';
import { setDashboardAvailable } from '../ui/dashboard.js';
import { menuPanel, openMenu, closeMenu } from '../ui/menu.js';
import { warningModal } from '../ui/warnings.js';

// 僅手機啟用觸控邏輯
if (isMobile) {
  let isMobileLocked = false;
  let lastTapTime = 0;
  let tapTimer = null;
  let touchStartX = 0, touchStartY = 0;
  let lastTouchX = 0, lastTouchY = 0;
  let holdTimer = null;
  let holdTimerTwo = null;

  const DOUBLE_TAP_MS = 300;
  const MOVE_THRESHOLD = 8;
  const TOUCH_SENSITIVITY = 0.003;

  function mobileLock() {
    if (isMobileLocked) return;
    isMobileLocked = true;
    sliderWrap.style.opacity = '0';
    sliderWrap.style.pointerEvents = 'none';
    setClimatePanelInstantVisible(false);
    setDashboardAvailable(false);
  }

  function mobileUnlock() {
    if (!isMobileLocked) return;
    isMobileLocked = false;
    if (warningModal.style.display !== 'block' && !state.isXRayMode) {
      sliderWrap.style.opacity = '1';
      sliderWrap.style.pointerEvents = 'auto';
      setClimatePanelInstantVisible(true);
    }
  }

  // 讓既有的 controls.isLocked 判斷在手機上也能運作
  Object.defineProperty(controls, 'isLocked', {
    get: () => isMobileLocked,
    configurable: true,
  });

  // 說明面板上點擊也視為「開始」
  instructions.addEventListener('touchend', (e) => {
    if (e.target.closest('.instructions-close-btn')) return;
    if (isMobileLocked) return;
    e.preventDefault();
    e.stopPropagation();
    hideTapPrompt();
    hideWeatherPanel();
    fadeOutBlackCover();
    mobileLock();
    instructions.classList.remove('expanded');
    if (instructionsFab) instructionsFab.classList.add('show');
  }, { passive: false });

  renderer.domElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      clearTimeout(holdTimer);
      state.isHoldWalking = false;
      holdTimerTwo = setTimeout(() => { state.isHoldWalkingBackward = true; }, 300);
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    lastTouchX = t.clientX;
    lastTouchY = t.clientY;
    state.isTouchMoving = false;

    holdTimer = setTimeout(() => {
      if (!state.isTouchMoving) state.isHoldWalking = true;
    }, 300);
  }, { passive: true });

  renderer.domElement.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - lastTouchX;
    const dy = t.clientY - lastTouchY;
    lastTouchX = t.clientX;
    lastTouchY = t.clientY;

    if (Math.abs(t.clientX - touchStartX) > MOVE_THRESHOLD || Math.abs(t.clientY - touchStartY) > MOVE_THRESHOLD) {
      state.isTouchMoving = true;
    }

    if (isMobileLocked) {
      camera.rotation.y -= dx * TOUCH_SENSITIVITY * 2;
      camera.rotation.x -= dy * TOUCH_SENSITIVITY * 2;
      camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camera.rotation.x));
    }
  }, { passive: true });

  renderer.domElement.addEventListener('touchend', (e) => {
    e.preventDefault(); // 擋掉瀏覽器補發的 ghost click
    clearTimeout(holdTimer);
    clearTimeout(holdTimerTwo);
    state.isHoldWalking = false;
    state.isHoldWalkingBackward = false;

    if (e.touches.length !== 0) return;
    if (state.isTouchMoving) return;

    const now = Date.now();
    const diff = now - lastTapTime;

    if (diff < DOUBLE_TAP_MS && diff > 0) {
      clearTimeout(tapTimer);
      lastTapTime = 0;

      if (tapPrompt.style.display !== 'none') {
        hideTapPrompt();
        hideWeatherPanel();
        fadeOutBlackCover();
        instructions.classList.remove('expanded');
        if (instructionsFab) instructionsFab.classList.add('show');
      }
      mobileUnlock();
      openMenu();
    } else {
      lastTapTime = now;
      tapTimer = setTimeout(() => {
        if (menuPanel.style.display === 'flex') {
          closeMenu();
          mobileLock();
          return;
        }
        if (!isMobileLocked) {
          hideTapPrompt();
          hideWeatherPanel();
          fadeOutBlackCover();
          mobileLock();
          instructions.classList.remove('expanded');
          if (instructionsFab) instructionsFab.classList.add('show');
          return;
        }

        const rect = renderer.domElement.getBoundingClientRect();
        const tapNDC = new THREE.Vector2(
          ((touchStartX - rect.left) / rect.width) * 2 - 1,
          -((touchStartY - rect.top) / rect.height) * 2 + 1
        );

        raycaster.setFromCamera(tapNDC, camera);
        const intersects = raycaster.intersectObjects([...doorObjects, ...interactiveDevices]);
        if (!intersects.length) return;

        state.mobileTapNDC = tapNDC;
        renderer.domElement.dispatchEvent(new MouseEvent('click', { bubbles: false }));
      }, DOUBLE_TAP_MS);
    }
  }, { passive: false });

  renderer.domElement.addEventListener('touchcancel', () => {
    clearTimeout(holdTimer);
    clearTimeout(holdTimerTwo);
    state.isHoldWalking = false;
    state.isHoldWalkingBackward = false;
  }, { passive: true });
}