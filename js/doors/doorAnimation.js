import { doorAnimations } from '../core/state.js';
import { DOOR_PARTNER_MAP, DOOR_HINT_DEVICES, TURN_UP_OPEN_ANGLE } from '../data/constants.js';
import { dismissDoorHintPermanently } from '../ui/hints.js';
import { startClimateOnFirstDoorOpen } from '../ui/climate.js';

// 點擊門：切換開關，並同步連動門、關閉教學提示、觸發溫濕度彈窗
export function toggleDoor(doorName) {
  const anim = doorAnimations[doorName];
  if (!anim) return;

  const newIsOpen = !anim.isOpen;
  anim.direction = newIsOpen ? 1 : -1;
  anim.isOpen = newIsOpen;

  const partners = DOOR_PARTNER_MAP[doorName] || [];
  partners.forEach(partnerName => {
    const partnerAnim = doorAnimations[partnerName];
    if (partnerAnim && partnerAnim.isOpen !== newIsOpen) {
      partnerAnim.direction = newIsOpen ? 1 : -1;
      partnerAnim.isOpen = newIsOpen;
    }
  });

  const namesAffected = [doorName, ...partners];
  if (DOOR_HINT_DEVICES.some(d => namesAffected.includes(d.name))) {
    dismissDoorHintPermanently();
  }

  if (newIsOpen) startClimateOnFirstDoorOpen(doorName, partners);
}

// 每幀更新門的開關動畫（由 animate.js 呼叫）
export function updateDoorAnimations(delta) {
  for (const key in doorAnimations) {
    const anim = doorAnimations[key];
    if (anim.direction === 0) continue;

    anim.progress += anim.direction * delta * 1.5;
    anim.progress = Math.max(0, Math.min(1, anim.progress));

    const eased = anim.progress < 0.5
      ? 2 * anim.progress * anim.progress
      : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;

    if (anim.type === 'sliding') {
      const offset = anim.slideSign * eased * anim.slideDistance;
      if (anim.slideAxis === 'z') anim.mesh.position.z = anim.startZ + offset;
      else if (anim.slideAxis === 'y') anim.mesh.position.y = anim.startY + offset;
      else anim.mesh.position.x = anim.startX + offset;
    } else if (anim.type === 'turn_up') {
      const rot = (anim.turnUpSign ?? -1) * eased * TURN_UP_OPEN_ANGLE;
      if (anim.turnUpAxis === 'y') anim.mesh.rotation.y = (anim.baseRotationY ?? 0) + rot;
      else if (anim.turnUpAxis === 'z') anim.mesh.rotation.z = (anim.baseRotationZ ?? 0) + rot;
      else anim.mesh.rotation.x = (anim.baseRotationX ?? 0) + rot;
    } else {
      anim.mesh.rotation.y = (anim.baseRotationY ?? 0) + (anim.swingSign ?? -1) * eased * Math.PI / 2;
    }

    if (anim.progress === 0 || anim.progress === 1) anim.direction = 0;
  }
}