import * as THREE from 'three';

// 兩角度的最短差值，結果落在 -π ~ π
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// 由管路設定取得裝置類型（faucet / shower）
export function getDeviceType(name, PIPE_CONFIG) {
  const cfg = PIPE_CONFIG[name];
  return cfg ? cfg.type : null;
}

// 計算門的本地座標包圍盒中心與薄軸方向
export function computeDoorIndicatorMeta(target) {
  const box = new THREE.Box3();
  const invMatrix = new THREE.Matrix4().copy(target.matrixWorld).invert();
  const tmpBox = new THREE.Box3();

  target.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    child.geometry.computeBoundingBox();
    tmpBox.copy(child.geometry.boundingBox);
    tmpBox.applyMatrix4(child.matrixWorld);
    tmpBox.applyMatrix4(invMatrix);
    box.union(tmpBox);
  });

  if (box.isEmpty()) {
    return { frontAxis: 'z', doorCenterX: 0, doorCenterY: 0 };
  }

  const sizeX = box.max.x - box.min.x;
  const sizeY = box.max.y - box.min.y;
  const sizeZ = box.max.z - box.min.z;

  let frontAxis = 'z';
  if (sizeX <= sizeY && sizeX <= sizeZ) frontAxis = 'x';
  else if (sizeZ <= sizeX && sizeZ <= sizeY) frontAxis = 'z';
  else frontAxis = 'y';

  return {
    frontAxis,
    doorCenterX: (box.min.x + box.max.x) / 2,
    doorCenterY: (box.min.y + box.max.y) / 2,
  };
}

// 顏色與白色混合，ratio 0 = 原色，1 = 全白
export function mixWithWhite(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 三次貝茲曲線
export function cubicBezier(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

// 剩餘秒數拆成 時 / 分 / 秒 字串
export function formatRemainingParts(remainSeconds) {
  const s = Math.max(0, Math.floor(remainSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return {
    h: String(h),
    m: String(m).padStart(2, '0'),
    s: String(sec).padStart(2, '0'),
  };
}