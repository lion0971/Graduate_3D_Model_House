import * as THREE from 'three';
import {
  state, interactiveDevices, outletObjects, drainObjects, flowingPipes, cachedSceneMeshes,
  hintOccluders, poolWaterMeshes, collidableObjects, strictCollidableObjects,
  doorAnimations, collisionData, waterFlows, drainFlows, activeTimers,
} from './state.js';
import {
  PIPE_CONFIG, AO_BAKE_TARGETS, SHARED_COLD_PIPES, SHARED_WASTE_PIPES,
  STRICT_COLLISION_NAMES, DINING_TABLE_BOUNDS,
} from '../data/constants.js';
import { aoMap } from './loaders.js';
import { scene, renderer, composer } from './renderer.js';
import { setupPipeMaterial } from '../water/pipes.js';
import { WaterFlow } from '../water/WaterFlow.js';
import { DrainFlow } from '../water/DrainFlow.js';
import { createDeviceWaterSound } from '../audio/sound.js';
import { registerDoorFromTraverse, registerSwingDoorFromTraverse } from '../doors/doorSetup.js';
import { createLightsForBulb, collectBulbs, applyBulbStrength } from '../loop/bulbs.js';
import { initPoolBounds } from '../water/pool.js';
import { attachFilterCardsToScene } from '../filter/filterUI.js';
import { attachSwitchHintsToScene, attachDoorHintsToScene } from '../ui/hints.js';
import { attachDoorIndicatorsToScene } from '../doors/doorIndicator.js';
import { applyDayNight, daySlider } from '../ui/slider.js';
import { finishLoading } from '../ui/loadingScreen.js';

// 整棟建築 GLTF 載入完成後的組裝入口（由 main.js 呼叫）
export function buildScene(gltf) {
  scene.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);

  // 第一遍：登記滑門 / 上掀門
  gltf.scene.traverse((obj) => registerDoorFromTraverse(obj));

  // 第一遍（續）：收集出水口 / 排水口空物件
  gltf.scene.traverse((obj) => {
    const name = obj.name.toLowerCase();
    if (Object.values(PIPE_CONFIG).some(cfg => cfg.outletKey === name)) outletObjects[name] = obj;
    if (Object.values(PIPE_CONFIG).some(cfg => cfg.drainKey === name)) drainObjects[name] = obj;
  });

  const allColdPipeNames = new Set(Object.values(PIPE_CONFIG).flatMap(cfg => cfg.coldPipes));
  const allDrainPipeNames = new Set(Object.values(PIPE_CONFIG).flatMap(cfg => cfg.drainPipes));

  // 第二遍：處理 mesh
  gltf.scene.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const name = mesh.name.toLowerCase();
    const parentName = (mesh.parent && mesh.parent.name) ? mesh.parent.name.toLowerCase() : '';

    const isBulb = name.includes('bulb');
    const isPipe = allColdPipeNames.has(name) || allDrainPipeNames.has(name);
    const isDevice = !!PIPE_CONFIG[name];

    if (!isBulb && !isPipe && !isDevice) cachedSceneMeshes.push(mesh);
    if (name === 'floor_pool_water') poolWaterMeshes.push(mesh);

    // 烘焙 AO 貼圖（需要第三組 uv2）
    if ((AO_BAKE_TARGETS.has(name) || AO_BAKE_TARGETS.has(parentName)) && mesh.material) {
      if (mesh.geometry.attributes.uv2) {
        mesh.material = mesh.material.clone();
        if (aoMap) aoMap.channel = 2;
        mesh.material.aoMap = aoMap;
        mesh.material.aoMapIntensity = 0.4;
        mesh.material.needsUpdate = true;
      } else {
        console.warn(`[AO 錯誤] ${name} 缺少真正的 uv2 通道`);
      }
    }

    // 地板改為不受光源影響的 MeshBasicMaterial
    if (name === 'floor' || name === 'floor_2') {
      const old = mesh.material;
      mesh.material = new THREE.MeshBasicMaterial({
        map: old.map ?? null,
        color: old.color ? old.color.clone() : new THREE.Color(0xffffff),
        aoMap: old.aoMap ?? null,
        aoMapIntensity: old.aoMapIntensity ?? 1,
        transparent: old.transparent,
        opacity: old.opacity,
      });
    }

    // 燈泡材質與光源
    if (isBulb) createLightsForBulb(mesh, name);

    // 可點擊裝置
    if (isDevice) {
      interactiveDevices.push(mesh);
      activeTimers[name] = { startTime: null, alerted: false, repeatMode: false };
    }

    // 管路
    if (allColdPipeNames.has(name)) {
      setupPipeMaterial(mesh, 'cold');
      flowingPipes.set(name, { mesh, active: false, colorType: 'cold', isShared: SHARED_COLD_PIPES.has(name) });
    }
    if (allDrainPipeNames.has(name)) {
      setupPipeMaterial(mesh, 'drain');
      flowingPipes.set(name, { mesh, active: false, colorType: 'drain', isShared: SHARED_WASTE_PIPES.has(name) });
    }

    // 旋轉門登記（已被滑門 / 上掀門登記過的名稱會跳過）
    registerSwingDoorFromTraverse(mesh);

    // 碰撞分類
    const nameForCollision = (name.includes('wall') || name.includes('floor') || name.includes('door') || name.includes('stairs'))
      ? name : parentName;

    if (nameForCollision !== 'floor_pool_water' &&
      (nameForCollision.includes('wall') || nameForCollision.includes('floor') ||
       nameForCollision.includes('door') || nameForCollision.includes('stairs'))) {
      collidableObjects.push(mesh);
      if (mesh.geometry && !mesh.geometry.boundsTree) mesh.geometry.computeBoundsTree();
    }
    if (nameForCollision.includes('wall')) hintOccluders.push(mesh);
    if (STRICT_COLLISION_NAMES.has(name) || STRICT_COLLISION_NAMES.has(parentName)) {
      strictCollidableObjects.push(mesh);
      if (mesh.geometry && !mesh.geometry.boundsTree) mesh.geometry.computeBoundsTree();
    }

    // 靜態物件關閉 autoUpdate
    const isDoor = name.includes('door') || Object.keys(doorAnimations).includes(name);
    if (!isDoor && !isPipe) {
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
    }
  });

  // 水池範圍
  initPoolBounds();

  // 桌子虛擬碰撞範圍（自動量測）
  const diningTableMesh = cachedSceneMeshes.find(m => m.name.toLowerCase().includes('dining_table'))
    ?? gltf.scene.getObjectByName('dining_table');
  if (diningTableMesh) {
    const box = new THREE.Box3().setFromObject(diningTableMesh);
    DINING_TABLE_BOUNDS.minX = box.min.x;
    DINING_TABLE_BOUNDS.maxX = box.max.x;
    DINING_TABLE_BOUNDS.minZ = box.min.z;
    DINING_TABLE_BOUNDS.maxZ = box.max.z;
  } else {
    console.warn('[DiningTable] 找不到 dining_table，虛擬碰撞範圍未套用');
  }

  // 碰撞包圍球（供距離篩選用）
  collisionData.collidableSpheres = collidableObjects.map(mesh => {
    const s = new THREE.Sphere();
    new THREE.Box3().setFromObject(mesh).getBoundingSphere(s);
    return s;
  });
  collisionData.strictCollidableSpheres = strictCollidableObjects.map(mesh => {
    const s = new THREE.Sphere();
    new THREE.Box3().setFromObject(mesh).getBoundingSphere(s);
    return s;
  });

  // 水流粒子
  interactiveDevices.forEach(mesh => createWaterFlowFor(mesh.name.toLowerCase()));

  // 水流音效
  interactiveDevices.forEach(mesh => createDeviceWaterSound(mesh.name.toLowerCase()));

  // 排水漩渦粒子
  Object.values(PIPE_CONFIG).forEach(cfg => {
    const anchor = drainObjects[cfg.drainKey];
    if (!anchor) {
      console.warn(`[Drain] 找不到 ${cfg.drainKey}`);
      return;
    }
    const worldPos = new THREE.Vector3();
    anchor.getWorldPosition(worldPos);
    const radius = cfg.drainRadius ?? (cfg.type === 'shower' ? 0.6 : 0.2);
    drainFlows[cfg.drainKey] = new DrainFlow(scene, worldPos, radius);
  });

  // 3D 提示 / 卡片掛載（需在 outlet 與 doorAnimations 都填好之後）
  attachFilterCardsToScene();
  attachSwitchHintsToScene();
  attachDoorHintsToScene();
  attachDoorIndicatorsToScene();

  // 燈泡登記與初始日夜同步（與原程式 onLoad 順序一致）
  collectBulbs();
  applyDayNight(parseFloat(daySlider.value));
  state.currentBulbStrength = state.targetBulbStrength;
  applyBulbStrength(state.currentBulbStrength);

  // 編譯預熱後才揭曉畫面
  warmUpAndReveal();
}

// 為指定裝置建立水流粒子
function createWaterFlowFor(deviceName) {
  const cfg = PIPE_CONFIG[deviceName];
  if (!cfg) return;

  let emitPos;
  if (outletObjects[cfg.outletKey]) {
    emitPos = new THREE.Vector3();
    outletObjects[cfg.outletKey].getWorldPosition(emitPos);
  } else {
    const deviceMesh = interactiveDevices.find(m => m.name.toLowerCase() === deviceName);
    if (!deviceMesh) {
      console.warn(`[WaterFlow] 找不到 ${deviceName}`);
      return;
    }
    const box = new THREE.Box3().setFromObject(deviceMesh);
    emitPos = new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      box.min.y,
      (box.min.z + box.max.z) / 2
    );
  }
  waterFlows[deviceName] = new WaterFlow(scene, emitPos, cfg.type);
}

// 上帝視角正交攝影機預熱：編譯 shader、上傳貼圖，之後揭曉畫面
function warmUpAndReveal() {
  const sceneBox = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  sceneBox.getSize(size);
  sceneBox.getCenter(center);

  const MARGIN = 2;
  const halfX = size.x / 2 + MARGIN;
  const halfZ = size.z / 2 + MARGIN;
  const compileCam = new THREE.OrthographicCamera(-halfX, halfX, halfZ, -halfZ, 0.1, size.y + MARGIN * 2);
  compileCam.position.set(center.x, sceneBox.max.y + MARGIN, center.z);
  compileCam.lookAt(center.x, sceneBox.min.y, center.z);
  compileCam.updateMatrixWorld();

  // 1. 同步編譯場景材質的 shader
  renderer.compile(scene, compileCam);

  // 2. 離屏渲染一次，強迫貼圖上傳 GPU
  const target = new THREE.WebGLRenderTarget(64, 64);
  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, compileCam);
  renderer.setRenderTarget(prevTarget);
  target.dispose();

  // 3. 預先編譯後製管線（Bloom 等）的 shader
  composer.render();

  // 4. 等兩幀讓驅動完成背景工作，再揭曉遊戲
  requestAnimationFrame(() => requestAnimationFrame(() => finishLoading()));
}