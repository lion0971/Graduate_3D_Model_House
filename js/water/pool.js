import * as THREE from 'three';
import { camera } from '../core/renderer.js';
import { state, poolWaterMeshes, collisionData } from '../core/state.js';
import {
  WATER_SINK_DEPTH, WATER_SINK_LERP_SPEED, WATER_BOB_AMPLITUDE, WATER_BOB_SPEED,
  WATER_ENTRY_OVERSHOOT, WATER_EXIT_JUMP, WATER_ENTRY_RECOVER_SPEED, WATER_EXIT_RECOVER_SPEED,
} from '../data/constants.js';

// 由 buildScene 在 GLTF 載入後呼叫，計算水面包圍盒
export function initPoolBounds() {
  if (poolWaterMeshes.length > 0) {
    const box = new THREE.Box3();
    poolWaterMeshes.forEach(m => box.union(new THREE.Box3().setFromObject(m)));
    collisionData.poolBounds = box;
  }
}

// 攝影機是否位於水池水平範圍內
export function isCameraInPool() {
  const b = collisionData.poolBounds;
  if (!b) return false;
  return (
    camera.position.x >= b.min.x && camera.position.x <= b.max.x &&
    camera.position.z >= b.min.z && camera.position.z <= b.max.z
  );
}

// 每幀更新水池下沉與漂浮；入水 / 出水瞬間觸發 playSplash 回呼
// 回傳是否在水中（供游泳聲判斷使用）
export function updatePool(time, delta, playSplash) {
  const inPool = !state.isNoclipMode && isCameraInPool();
  state.waterDepthTarget = inPool ? WATER_SINK_DEPTH : 0;

  if (inPool && !state.wasInPool) {
    state.waterDepthCurrent = WATER_SINK_DEPTH + WATER_ENTRY_OVERSHOOT;
    playSplash();
  } else if (!inPool && state.wasInPool) {
    state.waterDepthCurrent = -WATER_EXIT_JUMP;
    playSplash();
  }
  state.wasInPool = inPool;

  camera.position.y += state.appliedWaterOffset;

  let lerpSpeed = WATER_SINK_LERP_SPEED;
  if (inPool && state.waterDepthCurrent > state.waterDepthTarget) {
    lerpSpeed = WATER_ENTRY_RECOVER_SPEED;
  } else if (!inPool && state.waterDepthCurrent < state.waterDepthTarget) {
    lerpSpeed = WATER_EXIT_RECOVER_SPEED;
  }
  state.waterDepthCurrent += (state.waterDepthTarget - state.waterDepthCurrent) * Math.min(lerpSpeed * delta, 1.0);

  if (inPool) {
    state.waterBobStrength += (1.0 - state.waterBobStrength) * Math.min(3.0 * delta, 1.0);
  } else {
    state.waterBobStrength = 0;
  }
  const bob = Math.sin(time * WATER_BOB_SPEED * Math.PI * 2) * WATER_BOB_AMPLITUDE * state.waterBobStrength;

  state.appliedWaterOffset = state.waterDepthCurrent + bob;
  camera.position.y -= state.appliedWaterOffset;

  return inPool;
}