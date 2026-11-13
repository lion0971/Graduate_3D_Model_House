import * as THREE from 'three';
import { camera, composer, labelRenderer, scene } from '../core/renderer.js';
import { state, waterFlows, drainFlows, activeTimers, filterState } from '../core/state.js';
import { controls } from '../core/controls.js';
import { PIPE_MATERIALS } from '../water/pipes.js';
import { updatePool } from '../water/pool.js';
import { playSplash, setSwimLoop } from '../audio/sound.js';
import { handleMovementAndCollision } from '../physics/collision.js';
import { updateStaircase } from '../physics/staircase.js';
import { updateDoorAnimations } from '../doors/doorAnimation.js';
import { updateDoorIndicators } from '../doors/doorIndicator.js';
import { updateFilterUI, updateFilterUIVisibility } from '../filter/filterUI.js';
import { saveFilterUsage } from '../filter/filterState.js';
import { showFilterWarning, showWarning } from '../ui/warnings.js';
import { updateSwitchHintVisibility, updateDoorHintsVisibility } from '../ui/hints.js';
import { applyBulbStrength } from '../loop/bulbs.js';
import {
  WALK_HOLD_ACCEL, FRAME_INTERVAL, WARNING_MS, WARNING_REPEAT_MS, BULB_LERP_SPEED,
  FILTER_DEVICES, FILTER_LIFETIME_SECONDS, FILTER_UI_UPDATE_INTERVAL, FILTER_SAVE_INTERVAL,
  FILTER_LOW_RATIO, SWIM_MOVE_THRESHOLD_SQ, SWITCH_HINT_CHECK_INTERVAL,
} from '../data/constants.js';

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let lastRenderTimeMs = performance.now();
let swimLastX = 0;
let swimLastZ = 0;
let switchHintCheckElapsed = 0;

function tick(nowMs) {
  if (!state.isAnimating) return;
  requestAnimationFrame(tick);

  // 限制最高 60 FPS，避免高刷新率螢幕每秒執行 120~165 次完整運算
  if (nowMs - lastRenderTimeMs < FRAME_INTERVAL) return;
  lastRenderTimeMs = nowMs;

  const time = nowMs / 1000;
  const delta = Math.min(time - state.prevTime, 0.1);

  // 門開關動畫
  updateDoorAnimations(delta);

  // 水流 / 排水粒子
  for (const key in waterFlows) waterFlows[key].update(delta);
  for (const key in drainFlows) drainFlows[key].update(delta);

  // 透視模式管路呼吸光
  if (state.isXRayMode) {
    const activeOpacity = 0.5 + Math.sin(time * 10) * 0.3;
    PIPE_MATERIALS.cold.active_shared.opacity = activeOpacity;
    PIPE_MATERIALS.cold.active_own.opacity = activeOpacity;
    PIPE_MATERIALS.drain.active_shared.opacity = activeOpacity;
    PIPE_MATERIALS.drain.active_own.opacity = activeOpacity;
  }

  // 出水超時警告
  for (const key in activeTimers) {
    const timer = activeTimers[key];
    if (timer.startTime && !timer.alerted) {
      const threshold = timer.repeatMode ? WARNING_REPEAT_MS : WARNING_MS;
      if (Date.now() - timer.startTime >= threshold) {
        timer.alerted = true;
        showWarning(key);
      }
    }
  }

  // 濾心用量累加（封頂於壽命上限）
  for (const device of FILTER_DEVICES) {
    const st = filterState[device];
    if (!st.isActive || !st.ready) continue;

    if (st.remoteTotal + st.pendingDelta < FILTER_LIFETIME_SECONDS) st.pendingDelta += delta;
    st.usedSeconds = Math.min(st.remoteTotal + st.pendingDelta, FILTER_LIFETIME_SECONDS);
    st.uiElapsed += delta;
    st.saveElapsed += delta;

    if (st.uiElapsed >= FILTER_UI_UPDATE_INTERVAL) {
      st.uiElapsed = 0;
      updateFilterUI(device);
      const remainRatio = 1 - st.usedSeconds / FILTER_LIFETIME_SECONDS;
      if (remainRatio <= FILTER_LOW_RATIO && !st.alerted) {
        st.alerted = true;
        showFilterWarning(device);
        saveFilterUsage(device);
      }
    }
    if (st.saveElapsed >= FILTER_SAVE_INTERVAL) {
      st.saveElapsed = 0;
      saveFilterUsage(device);
    }
  }

  // 濾心卡片可見性（內部自行節流）
  updateFilterUIVisibility(delta);

  // 開關提示距離判斷節流
  switchHintCheckElapsed += delta;
  if (switchHintCheckElapsed >= SWITCH_HINT_CHECK_INTERVAL) {
    switchHintCheckElapsed = 0;
    updateSwitchHintVisibility();
  }

  updateDoorHintsVisibility();
  updateDoorIndicators(delta);

  // 移動
  if (controls.isLocked) {
    const moveDelta = Math.min(delta, 0.05);

    velocity.x -= velocity.x * 10.0 * moveDelta;
    velocity.z -= velocity.z * 10.0 * moveDelta;

    direction.z = Number(state.moveForward) - Number(state.moveBackward);
    direction.x = Number(state.moveLeft) - Number(state.moveRight);

    const hasInput = state.moveForward || state.moveBackward || state.moveLeft || state.moveRight ||
      state.isHoldWalking || state.isHoldWalkingBackward;

    if (hasInput) {
      direction.normalize();
      if (state.moveForward || state.moveBackward) velocity.z -= direction.z * 40.0 * moveDelta;
      if (state.moveLeft || state.moveRight) velocity.x -= direction.x * 40.0 * moveDelta;
      if (state.isHoldWalking) velocity.z -= WALK_HOLD_ACCEL * moveDelta;
      if (state.isHoldWalkingBackward) velocity.z += WALK_HOLD_ACCEL * moveDelta;
    }

    const moveVelocity = new THREE.Vector3(velocity.x * moveDelta, 0, velocity.z * moveDelta);
    moveVelocity.applyQuaternion(camera.quaternion);
    moveVelocity.y = 0;

    if (!state.isOnStairRail && moveVelocity.lengthSq() > 0.000001) {
      handleMovementAndCollision(moveVelocity);
    }
    updateStaircase(delta);
  }

  // 水池
  const inPool = updatePool(time, delta, playSplash);

  // 游泳聲：在水中且有水平位移才循環
  const dxs = camera.position.x - swimLastX;
  const dzs = camera.position.z - swimLastZ;
  swimLastX = camera.position.x;
  swimLastZ = camera.position.z;
  setSwimLoop(inPool && (dxs * dxs + dzs * dzs) > SWIM_MOVE_THRESHOLD_SQ);

  // 燈泡平滑亮度
  if (Math.abs(state.currentBulbStrength - state.targetBulbStrength) > 0.001) {
    state.currentBulbStrength += (state.targetBulbStrength - state.currentBulbStrength) *
      Math.min(BULB_LERP_SPEED * delta, 1.0);
    applyBulbStrength(state.currentBulbStrength);
  }

  state.prevTime = time;

  // 黑幕蓋著時不渲染，避免與葉子動畫搶執行緒
  if (state.sceneRenderEnabled) {
    composer.render();
    labelRenderer.render(scene, camera);
  }
}

export function startAnimationLoop() {
  requestAnimationFrame(tick);
}