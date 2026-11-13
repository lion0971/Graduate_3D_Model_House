import * as THREE from 'three';
import { camera } from '../core/renderer.js';
import { state, collidableObjects, strictCollidableObjects, collisionData } from '../core/state.js';
import {
  COLLISION_EYE_HEIGHT_OFFSET, COLLISION_LATERAL_HEIGHT_OFFSET, PLAYER_HALF_WIDTH,
  collisionDistance, MAX_SLIDE_ITERATIONS, NEARBY_COLLISION_RADIUS,
  STAIRCASE_COLLISION_HEIGHT, STAIRCASE, DINING_TABLE_BOUNDS,
} from '../data/constants.js';
import { angleDiff } from '../utils/math.js';
import { getStairEntranceConfig } from './staircase.js';
import { raycaster } from '../core/raycaster.js';

const _tmpWorldDir = new THREE.Vector3();
const _tmpOrigin = new THREE.Vector3();
const _tmpMoveDir = new THREE.Vector3();
const _tmpHitNormal = new THREE.Vector3();
const _tmpLateral = new THREE.Vector3();
const _nearbyFilterResult = [];

const rayDirections = [
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(1, 0, 0),
];

// 依玩家位置篩出附近的牆，減少射線檢測數量
export function getNearbyCollidables(sourceObjects, sourceSpheres) {
  _nearbyFilterResult.length = 0;
  for (let i = 0; i < sourceObjects.length; i++) {
    const sphere = sourceSpheres[i];
    if (!sphere) continue;
    const dx = sphere.center.x - camera.position.x;
    const dy = sphere.center.y - camera.position.y;
    const dz = sphere.center.z - camera.position.z;
    const maxDist = NEARBY_COLLISION_RADIUS + sphere.radius;
    if (dx * dx + dy * dy + dz * dz <= maxDist * maxDist) {
      _nearbyFilterResult.push(sourceObjects[i]);
    }
  }
  return _nearbyFilterResult;
}

// 切回一般模式時判斷是否仍卡在牆內或樓梯圓柱中
export function checkCurrentCollision() {
  if (!state.isOnStairRail) {
    const yLow = STAIRCASE.center.y - 0.3;
    const yHigh = STAIRCASE.center.y + STAIRCASE_COLLISION_HEIGHT;
    if (camera.position.y >= yLow && camera.position.y <= yHigh) {
      const dx = camera.position.x - STAIRCASE.center.x;
      const dz = camera.position.z - STAIRCASE.center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= STAIRCASE.radius) {
        const approachAngle = Math.atan2(dz, dx);
        const { angle, tolerance } = getStairEntranceConfig(camera.position.y);
        if (Math.abs(angleDiff(approachAngle, angle)) > tolerance) return true;
      }
    }
  }

  if (collidableObjects.length === 0) return false;
  const nearby = getNearbyCollidables(collidableObjects, collisionData.collidableSpheres);

  for (const dir of rayDirections) {
    _tmpWorldDir.copy(dir).applyQuaternion(camera.quaternion).normalize();

    _tmpOrigin.copy(camera.position);
    _tmpOrigin.y += COLLISION_EYE_HEIGHT_OFFSET;
    raycaster.set(_tmpOrigin, _tmpWorldDir);
    let hits = raycaster.intersectObjects(nearby);
    if (hits.length > 0 && hits[0].distance < 0.2) return true;

    _tmpLateral.set(-_tmpWorldDir.z, 0, _tmpWorldDir.x).normalize();
    for (const lateralOffset of [-PLAYER_HALF_WIDTH, PLAYER_HALF_WIDTH]) {
      _tmpOrigin.copy(camera.position);
      _tmpOrigin.y += COLLISION_LATERAL_HEIGHT_OFFSET;
      _tmpOrigin.x += _tmpLateral.x * lateralOffset;
      _tmpOrigin.z += _tmpLateral.z * lateralOffset;
      raycaster.set(_tmpOrigin, _tmpWorldDir);
      hits = raycaster.intersectObjects(nearby);
      if (hits.length > 0 && hits[0].distance < 0.2) return true;
    }
  }
  return false;
}

// 沿牆面滑動的碰撞修正
export function resolveCollisionSlide(moveVelocity, targetObjects, targetSpheres) {
  if (targetObjects.length === 0 || (moveVelocity.x === 0 && moveVelocity.z === 0)) return;

  const originalX = moveVelocity.x;
  const originalZ = moveVelocity.z;
  const nearby = getNearbyCollidables(targetObjects, targetSpheres);
  if (nearby.length === 0) return;

  for (let iter = 0; iter < MAX_SLIDE_ITERATIONS; iter++) {
    if (moveVelocity.x === 0 && moveVelocity.z === 0) return;

    _tmpMoveDir.copy(moveVelocity).normalize();
    _tmpLateral.set(-_tmpMoveDir.z, 0, _tmpMoveDir.x);

    let closestHit = null;

    for (const lateralOffset of [-PLAYER_HALF_WIDTH, PLAYER_HALF_WIDTH]) {
      _tmpOrigin.copy(camera.position);
      _tmpOrigin.y += COLLISION_LATERAL_HEIGHT_OFFSET;
      _tmpOrigin.x += _tmpLateral.x * lateralOffset;
      _tmpOrigin.z += _tmpLateral.z * lateralOffset;
      raycaster.set(_tmpOrigin, _tmpMoveDir);
      const hits = raycaster.intersectObjects(nearby);
      if (hits.length > 0 && hits[0].distance < collisionDistance) {
        if (!closestHit || hits[0].distance < closestHit.distance) closestHit = hits[0];
      }
    }

    _tmpOrigin.copy(camera.position);
    _tmpOrigin.y += COLLISION_EYE_HEIGHT_OFFSET;
    raycaster.set(_tmpOrigin, _tmpMoveDir);
    const centerHits = raycaster.intersectObjects(nearby);
    if (centerHits.length > 0 && centerHits[0].distance < collisionDistance) {
      if (!closestHit || centerHits[0].distance < closestHit.distance) closestHit = centerHits[0];
    }

    if (!closestHit) return;

    _tmpHitNormal.copy(closestHit.face.normal);
    _tmpHitNormal.applyQuaternion(closestHit.object.quaternion);
    _tmpHitNormal.y = 0;
    _tmpHitNormal.normalize();

    const dotProduct = moveVelocity.dot(_tmpHitNormal);
    if (dotProduct < 0) {
      moveVelocity.sub(_tmpHitNormal.multiplyScalar(dotProduct));
    }
  }

  // 迭代用完仍卡住：退回原始方向，避免夾在牆角時卡死
  moveVelocity.x = -originalX;
  moveVelocity.z = -originalZ;
}

// 樓梯圓柱：非入口角度一律視為牆面
export function resolveStaircaseCylinderCollision(moveVelocity) {
  if (state.isOnStairRail) return;
  if (moveVelocity.x === 0 && moveVelocity.z === 0) return;

  const yLow = STAIRCASE.center.y - 0.3;
  const yHigh = STAIRCASE.center.y + STAIRCASE_COLLISION_HEIGHT;
  if (camera.position.y < yLow || camera.position.y > yHigh) return;

  const curDx = camera.position.x - STAIRCASE.center.x;
  const curDz = camera.position.z - STAIRCASE.center.z;
  const curDist = Math.sqrt(curDx * curDx + curDz * curDz);
  if (curDist <= STAIRCASE.radius) return;

  const nextDx = (camera.position.x + moveVelocity.x) - STAIRCASE.center.x;
  const nextDz = (camera.position.z + moveVelocity.z) - STAIRCASE.center.z;
  const nextDist = Math.sqrt(nextDx * nextDx + nextDz * nextDz);
  if (nextDist > STAIRCASE.radius) return;

  const approachAngle = Math.atan2(curDz, curDx);
  const { angle, tolerance } = getStairEntranceConfig(camera.position.y);
  if (Math.abs(angleDiff(approachAngle, angle)) <= tolerance) return;

  const nx = curDx / curDist;
  const nz = curDz / curDist;
  const dot = moveVelocity.x * nx + moveVelocity.z * nz;
  if (dot < 0) {
    moveVelocity.x -= dot * nx;
    moveVelocity.z -= dot * nz;
  }
}

// 桌子：水平矩形範圍內的虛擬碰撞
export function resolveDiningTableCollision(moveVelocity) {
  const b = DINING_TABLE_BOUNDS;
  if (b.minX === b.maxX) return;
  if (camera.position.y > b.maxY) return;

  const nextX = camera.position.x + moveVelocity.x;
  const nextZ = camera.position.z + moveVelocity.z;
  const inX = nextX >= b.minX - b.margin && nextX <= b.maxX + b.margin;
  const inZ = nextZ >= b.minZ - b.margin && nextZ <= b.maxZ + b.margin;
  if (!(inX && inZ)) return;

  const curInX = camera.position.x >= b.minX - b.margin && camera.position.x <= b.maxX + b.margin;
  const curInZ = camera.position.z >= b.minZ - b.margin && camera.position.z <= b.maxZ + b.margin;

  if (!curInX) moveVelocity.x = 0;
  else if (!curInZ) moveVelocity.z = 0;
  else { moveVelocity.x = 0; moveVelocity.z = 0; }
}

// 統一入口：依模式套用碰撞並位移攝影機
export function handleMovementAndCollision(moveVelocity) {
  if (moveVelocity.lengthSq() < 0.000001) return;

  if (state.isNoclipMode) {
    resolveCollisionSlide(moveVelocity, strictCollidableObjects, collisionData.strictCollidableSpheres);
    camera.position.add(moveVelocity);
    return;
  }

  if (state.isStuckInWall) {
    if (!checkCurrentCollision()) state.isStuckInWall = false;
    camera.position.add(moveVelocity);
    return;
  }

  for (let i = 0; i < MAX_SLIDE_ITERATIONS; i++) {
    const beforeX = moveVelocity.x;
    const beforeZ = moveVelocity.z;
    resolveCollisionSlide(moveVelocity, collidableObjects, collisionData.collidableSpheres);
    resolveStaircaseCylinderCollision(moveVelocity);
    resolveDiningTableCollision(moveVelocity);
    if (moveVelocity.x === beforeX && moveVelocity.z === beforeZ) break;
  }

  camera.position.add(moveVelocity);
}