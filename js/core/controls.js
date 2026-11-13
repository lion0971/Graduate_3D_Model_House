import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { camera, renderer } from './renderer.js';

// 桌機用 PointerLock 控制器；手機端由 interaction/touch.js 覆寫 isLocked
export const controls = new PointerLockControls(camera, renderer.domElement);

export const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);