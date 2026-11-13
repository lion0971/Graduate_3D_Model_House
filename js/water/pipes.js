import * as THREE from 'three';
import { flowingPipes } from '../core/state.js';
import { PIPE_CONFIG } from '../data/constants.js';

function makePipeMat(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}

// 管路共用材質池：同狀態只建立一份材質，減少 GPU 切換 shader 次數
export const PIPE_MATERIALS = {
  cold: {
    active_shared: makePipeMat(0x00aaff, 0.6),
    active_own: makePipeMat(0x00aaff, 0.75),
    inactive: makePipeMat(0x00aaff, 0.12),
  },
  drain: {
    active_shared: makePipeMat(0xff6600, 0.6),
    active_own: makePipeMat(0xff6600, 0.75),
    inactive: makePipeMat(0xff6600, 0.12),
  },
};

// 出水中的管路改用疊加混合，做出發光效果
PIPE_MATERIALS.cold.active_shared.blending = THREE.AdditiveBlending;
PIPE_MATERIALS.cold.active_own.blending = THREE.AdditiveBlending;
PIPE_MATERIALS.drain.active_shared.blending = THREE.AdditiveBlending;
PIPE_MATERIALS.drain.active_own.blending = THREE.AdditiveBlending;

// 切換單一管路的視覺狀態（指派共用材質參照）
export function setPipeState(p, state) {
  if (!p || !p.mesh) return;
  const pool = PIPE_MATERIALS[p.colorType];
  if (!pool) return;
  if (state === 'active') {
    p.active = true;
    p.mesh.material = p.isShared ? pool.active_shared : pool.active_own;
  } else {
    p.active = false;
    p.mesh.material = pool.inactive;
  }
}

// 建立管路 mesh 的初始材質與渲染設定
export function setupPipeMaterial(mesh, colorType = 'cold') {
  mesh.material = PIPE_MATERIALS[colorType].inactive;
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
}

// 判斷某管路是否仍被其他「正在出水」的裝置使用（關閉時避免誤關共用幹管）
// kind：'cold' 或 'drain'
// 注意：原程式是把這段判斷展開寫在 closeDeviceWater / click 處理內，
// 這裡抽成函式僅為重用，邏輯與原版一致。
export function isPipeStillUsed(pipeName, excludeDevice, kind) {
  const key = kind === 'drain' ? 'drainPipes' : 'coldPipes';
  return Object.entries(PIPE_CONFIG).some(([dName, dCfg]) => {
    if (dName === excludeDevice) return false;
    if (!dCfg[key].includes(pipeName)) return false;
    const endPipe = flowingPipes.get(dCfg.coldPipes[dCfg.coldPipes.length - 1]);
    return endPipe?.active ?? false;
  });
}