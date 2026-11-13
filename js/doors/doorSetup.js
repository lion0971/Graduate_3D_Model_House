import { doorObjects, doorAnimations } from '../core/state.js';
import { computeDoorIndicatorMeta } from '../utils/math.js';
import * as THREE from 'three';
import {
  SLIDE_AXIS_OVERRIDE, SLIDE_SIGN_OVERRIDE, SWING_SIGN_OVERRIDE,
  TURN_UP_SIGN_OVERRIDE, TURN_UP_AXIS_OVERRIDE, DOOR_FRONT_NORMAL_AXIS_OVERRIDE, DOOR_OPEN_MARGIN,
} from '../data/constants.js';

// 第一遍 traverse：登記滑門（sliding_door / sliding_up_door / sliding_down_door）與上掀門（turn_up_door）
export function registerDoorFromTraverse(obj) {
  const name = obj.name.toLowerCase();
  const isUpSlidingDoor = name.includes('sliding_up_door');
  const isDownSlidingDoor = name.includes('sliding_down_door');
  const isTurnUpDoor = name.includes('turn_up_door');

  if (isTurnUpDoor) {
    if (doorAnimations[name]) return;
    const meta = computeDoorIndicatorMeta(obj);
    doorAnimations[name] = {
      mesh: obj,
      isOpen: false,
      progress: 0,
      direction: 0,
      type: 'turn_up',
      turnUpSign: TURN_UP_SIGN_OVERRIDE[name] ?? -1,
      turnUpAxis: TURN_UP_AXIS_OVERRIDE[name] ?? 'z',
      baseRotationX: obj.rotation.x,
      baseRotationY: obj.rotation.y,
      baseRotationZ: obj.rotation.z,
      frontAxis: DOOR_FRONT_NORMAL_AXIS_OVERRIDE[name] ?? meta.frontAxis,
      indicatorLocalX: meta.doorCenterX,
      indicatorLocalY: meta.doorCenterY,
    };
    obj.traverse((child) => { if (child.isMesh) doorObjects.push(child); });
    return;
  }

  if (!name.includes('sliding_door') && !isUpSlidingDoor && !isDownSlidingDoor) return;
  if (doorAnimations[name]) return;

  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);

  const slideAxis = (isUpSlidingDoor || isDownSlidingDoor)
    ? 'y'
    : (SLIDE_AXIS_OVERRIDE[name] ?? (size.x >= size.z ? 'x' : 'z'));
  const slideDistance = (isUpSlidingDoor || isDownSlidingDoor)
    ? Math.max(0, size.y - DOOR_OPEN_MARGIN)
    : Math.max(0, (slideAxis === 'z' ? size.z : size.x) - DOOR_OPEN_MARGIN);
  const slideSign = SLIDE_SIGN_OVERRIDE[name] ?? (isUpSlidingDoor ? 1 : -1);

  const meta = computeDoorIndicatorMeta(obj);
  doorAnimations[name] = {
    mesh: obj,
    isOpen: false,
    progress: 0,
    direction: 0,
    type: 'sliding',
    slideAxis,
    slideSign,
    slideDistance,
    startX: obj.position.x,
    startY: obj.position.y,
    startZ: obj.position.z,
    frontAxis: DOOR_FRONT_NORMAL_AXIS_OVERRIDE[name] ?? meta.frontAxis,
    indicatorLocalX: meta.doorCenterX,
    indicatorLocalY: meta.doorCenterY,
  };
  obj.traverse((child) => { if (child.isMesh) doorObjects.push(child); });
}

// 第二遍 mesh 迴圈：登記旋轉門（名稱含 door_，且未被上面登記過）
export function registerSwingDoorFromTraverse(mesh) {
  const name = mesh.name.toLowerCase();
  if (!name.includes('door_') || doorAnimations[name]) return;

  doorObjects.push(mesh);
  const meta = computeDoorIndicatorMeta(mesh);
  doorAnimations[name] = {
    mesh,
    isOpen: false,
    progress: 0,
    direction: 0,
    type: 'swing',
    swingSign: SWING_SIGN_OVERRIDE[name] ?? -1,
    baseRotationY: mesh.rotation.y,
    frontAxis: DOOR_FRONT_NORMAL_AXIS_OVERRIDE[name] ?? meta.frontAxis,
    indicatorLocalX: meta.doorCenterX,
    indicatorLocalY: meta.doorCenterY,
  };
}