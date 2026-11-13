import * as THREE from 'three';
import { camera } from '../core/renderer.js';
import { state } from '../core/state.js';
import { STAIRCASE, STAIR_MID_Y, STAIR_COMMIT_MARGIN } from '../data/constants.js';
import { angleDiff } from '../utils/math.js';

const _stairYawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _stairUpAxis = new THREE.Vector3(0, 1, 0);

// 依高度取得樓上 / 樓下各自的入口角度與容差
export function getStairEntranceConfig(cameraY) {
  const isUpper = cameraY > STAIR_MID_Y;
  return isUpper
    ? { angle: STAIRCASE.entranceAngleTop, tolerance: STAIRCASE.entranceAngleToleranceTop }
    : { angle: STAIRCASE.entranceAngle, tolerance: STAIRCASE.entranceAngleTolerance };
}

// 依爬行進度，把終點角度修正到另一端真正的入口角度
export function getStairAngleAtHeight(height) {
  const rawAngle = state.stairAngleOffset - (height / STAIRCASE.totalHeight) * (Math.PI * 2 * STAIRCASE.turns);
  const enteredFromBottom = state.stairEntryHeight <= STAIRCASE.totalHeight / 2;
  const farHeight = enteredFromBottom ? STAIRCASE.totalHeight : 0;
  const farTargetAngle = enteredFromBottom ? STAIRCASE.entranceAngleTop : STAIRCASE.entranceAngle;
  const rawFarAngle = state.stairAngleOffset - (farHeight / STAIRCASE.totalHeight) * (Math.PI * 2 * STAIRCASE.turns);
  const rawDelta = farTargetAngle - rawFarAngle;
  const delta = Math.atan2(Math.sin(rawDelta), Math.cos(rawDelta));
  const progress = Math.min(1, Math.abs(height - state.stairEntryHeight) / STAIRCASE.totalHeight);
  return rawAngle + delta * progress;
}

// 每幀更新樓梯軌道移動（由 animate.js 在 controls.isLocked 時呼叫）
export function updateStaircase(delta) {
  const dx = camera.position.x - STAIRCASE.center.x;
  const dz = camera.position.z - STAIRCASE.center.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (!state.isOnStairRail && dist <= STAIRCASE.radius + STAIRCASE.radiusMargin) {
    const entryAngle = Math.atan2(dz, dx);
    const { angle, tolerance } = getStairEntranceConfig(camera.position.y);
    if (Math.abs(angleDiff(entryAngle, angle)) <= tolerance) {
      state.isOnStairRail = true;
      state.stairCommitted = false;
      state.stairHeight = (camera.position.y > STAIRCASE.center.y + STAIRCASE.totalHeight / 2)
        ? STAIRCASE.totalHeight : 0;
      state.stairEntryHeight = state.stairHeight;
      state.stairAngleOffset = entryAngle + (state.stairHeight / STAIRCASE.totalHeight) * (Math.PI * 2 * STAIRCASE.turns);
    }
  }

  if (!state.isOnStairRail) return;

  const inputZ = Number(state.moveForward) - Number(state.moveBackward)
    + (state.isHoldWalking ? 1 : 0) - (state.isHoldWalkingBackward ? 1 : 0);
  const inputX = Number(state.moveRight) - Number(state.moveLeft);
  let inputDir = 0;
  let outwardAmount = 0;

  if (inputZ !== 0 || inputX !== 0) {
    const localDir = new THREE.Vector3(inputX, 0, -inputZ).normalize();
    _stairYawEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    const worldDir = localDir.applyAxisAngle(_stairUpAxis, _stairYawEuler.y);
    worldDir.y = 0;
    worldDir.normalize();

    const angleNow = getStairAngleAtHeight(state.stairHeight);
    const tangentUp = new THREE.Vector3(Math.sin(angleNow), 0, -Math.cos(angleNow));
    inputDir = worldDir.dot(tangentUp);

    const outDx = camera.position.x - STAIRCASE.center.x;
    const outDz = camera.position.z - STAIRCASE.center.z;
    const outLen = Math.hypot(outDx, outDz) || 1;
    outwardAmount = worldDir.x * (outDx / outLen) + worldDir.z * (outDz / outLen);
  }

  state.stairHeight += inputDir * STAIRCASE.climbSpeed * delta;

  if (state.stairHeight > STAIR_COMMIT_MARGIN && state.stairHeight < STAIRCASE.totalHeight - STAIR_COMMIT_MARGIN) {
    state.stairCommitted = true;
  }

  const canLeaveTop = state.stairCommitted ? outwardAmount > 0 : inputDir > 0;
  const canLeaveBottom = state.stairCommitted ? outwardAmount > 0 : inputDir < 0;

  if (state.stairHeight >= STAIRCASE.totalHeight && canLeaveTop) {
    state.stairHeight = STAIRCASE.totalHeight;
    state.isOnStairRail = false;
    return;
  }
  if (state.stairHeight <= 0 && canLeaveBottom) {
    state.stairHeight = 0;
    state.isOnStairRail = false;
    return;
  }
  state.stairHeight = Math.max(0, Math.min(STAIRCASE.totalHeight, state.stairHeight));

  const angle = getStairAngleAtHeight(state.stairHeight);
  camera.position.x = STAIRCASE.center.x + Math.cos(angle) * STAIRCASE.walkRadius;
  camera.position.z = STAIRCASE.center.z + Math.sin(angle) * STAIRCASE.walkRadius;

  const steppedHeight = Math.round(state.stairHeight / STAIRCASE.stepHeight) * STAIRCASE.stepHeight;
  const targetY = STAIRCASE.center.y + steppedHeight;
  camera.position.y += (targetY - camera.position.y) * Math.min(delta * 10, 1);
}