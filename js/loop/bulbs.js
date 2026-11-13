import * as THREE from 'three';
import { state, bulbMeshes } from '../core/state.js';
import { scene } from '../core/renderer.js';
import { createConeVolumetricLight, getRadialGlowTexture } from '../utils/glow.js';

// 掃描場景中所有燈泡，登記到 bulbMeshes（由 buildScene 在建立光源後呼叫）
export function collectBulbs() {
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.name.toLowerCase().includes('bulb')) return;
    const name = obj.name.toLowerCase();
    const isLineBulb = /line_+bulb/.test(name);
    const isBallBulb = name.includes('ball_bulb');
    const isRecBulb = name.includes('rec_bulb');

    if (isLineBulb) {
      bulbMeshes.push({
        mesh: obj, spot: null,
        lineLights: obj.children.filter(c => c.isPointLight),
        ballLight: null, rectLight: null,
      });
    } else if (isBallBulb) {
      bulbMeshes.push({
        mesh: obj, spot: null, lineLights: null,
        ballLight: obj.children.find(c => c.isPointLight) ?? null,
        rectLight: null,
      });
    } else if (isRecBulb) {
      bulbMeshes.push({
        mesh: obj, spot: null, lineLights: null, ballLight: null,
        rectLight: obj.children.find(c => c.isRectAreaLight) ?? null,
      });
    } else {
      bulbMeshes.push({
        mesh: obj,
        spot: obj.children.find(c => c.isSpotLight) ?? null,
        lineLights: null, ballLight: null, rectLight: null,
      });
    }
  });
}

const BALL_BULB_OVERRIDES = {
  'livingroom_rec_bulb_1': { emissiveIntensity: 5, lightIntensity: 1.5, lightDistance: 5, glowOpacity: 0.35, glowScaleFactor: 5 },
};

// 依燈泡類型建立材質發光與光源（由 buildScene 對每個 bulb mesh 呼叫）
export function createLightsForBulb(mesh, name) {
  if (name.includes('line_bulb')) {
    if (mesh.material) {
      mesh.material.emissive = new THREE.Color(0xffcc66);
      mesh.material.emissiveIntensity = 3;
      if (mesh.material.map) mesh.material.color.setHex(0x888866);
    }
    mesh.geometry.computeBoundingBox();
    const localBox = mesh.geometry.boundingBox;
    const localSize = new THREE.Vector3();
    localBox.getSize(localSize);
    const localCenterGeo = new THREE.Vector3();
    localBox.getCenter(localCenterGeo);

    const axis = new THREE.Vector3(0, 1, 0);
    if (localSize.x >= localSize.y && localSize.x >= localSize.z) axis.set(1, 0, 0);
    else if (localSize.z >= localSize.x && localSize.z >= localSize.y) axis.set(0, 0, 1);

    const axisLength = Math.max(localSize.x, localSize.y, localSize.z);
    const lp = new THREE.PointLight(0xffcc66, 0.5, 3.0, 1.5);
    lp.position.copy(localCenterGeo);
    mesh.add(lp);

    const glowLen = axisLength * 1.02;
    const makeGlow = (radius, color, opacity) => {
      const geo = new THREE.CylinderGeometry(radius, radius, glowLen, 8, 1, true);
      if (axis.x === 1) geo.rotateZ(Math.PI / 2);
      else if (axis.z === 1) geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, side: THREE.BackSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      m.position.copy(localCenterGeo);
      return m;
    };
    mesh.add(makeGlow(0.03, 0xffcc66, 0.1));
    mesh.add(makeGlow(0.09, 0xffaa33, 0.03));
  } else if (name.includes('ball_bulb')) {
    const ov = BALL_BULB_OVERRIDES[name] ?? {};
    const emissiveIntensity = ov.emissiveIntensity ?? 12;
    const lightIntensity = ov.lightIntensity ?? 4.0;
    const lightDistance = ov.lightDistance ?? 8.0;
    const glowOpacity = ov.glowOpacity ?? 0.85;
    const glowScaleFactor = ov.glowScaleFactor ?? 9;

    if (mesh.material) {
      mesh.material.emissive = new THREE.Color(0xffcc88);
      mesh.material.emissiveIntensity = emissiveIntensity;
      if (mesh.material.map) mesh.material.color.setHex(0x888866);
    }

    mesh.geometry.computeBoundingBox();
    const localBox = mesh.geometry.boundingBox;
    const localSize = new THREE.Vector3();
    localBox.getSize(localSize);
    const localCenterGeo = new THREE.Vector3();
    localBox.getCenter(localCenterGeo);
    const baseRadius = Math.max(localSize.x, localSize.y, localSize.z) * 0.5;

    const pt = new THREE.PointLight(0xffcc88, lightIntensity, lightDistance, 2);
    pt.position.copy(localCenterGeo);
    mesh.add(pt);

    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture(), color: 0xffcc88, transparent: true,
      opacity: glowOpacity, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const glowScale = baseRadius * glowScaleFactor;
    glowSprite.scale.set(glowScale, glowScale, 1);
    glowSprite.position.copy(localCenterGeo);
    glowSprite.userData.isBallBulbGlow = true;
    glowSprite.material.userData._baseOpacity = glowOpacity;
    mesh.add(glowSprite);
  } else if (name.includes('rec_bulb')) {
    if (mesh.material) {
      mesh.material.emissive = new THREE.Color(0xffaa44);
      mesh.material.emissiveIntensity = 10;
      if (mesh.material.map) mesh.material.color.setHex(0x444444);
    }
  } else {
    if (mesh.material) {
      mesh.material.emissive = new THREE.Color(0xffaa44);
      mesh.material.emissiveIntensity = 10;
      if (mesh.material.map) mesh.material.color.setHex(0x444444);
    }
    const cone = createConeVolumetricLight(0xffaa44);
    cone.position.y = 0.2;
    mesh.add(cone);
    const spot = new THREE.SpotLight(0xffaa44, 3, 5, Math.PI / 3.5, 0.6, 2);
    mesh.add(spot);
    mesh.add(spot.target);
    spot.target.position.set(0, -10, 0);
  }
}

// 依 s（0~1）統一調整燈泡亮度；透視模式下鎖定關閉
export function applyBulbStrength(s) {
  if (state.isXRayMode) return;
  bulbMeshes.forEach(({ mesh, spot, lineLights, ballLight, rectLight }) => {
    if (mesh.material) {
      if (lineLights) mesh.material.emissiveIntensity = s * 3;
      else if (ballLight) mesh.material.emissiveIntensity = s * 12;
      else if (rectLight) mesh.material.emissiveIntensity = s * 3;
      else mesh.material.emissiveIntensity = s * 10;
    }
    if (spot) spot.intensity = s * 3;
    if (ballLight) ballLight.intensity = s * 4.0;
    if (rectLight) rectLight.intensity = s * 3;
    if (lineLights) lineLights.forEach(l => { l.intensity = s * 0.3; });

    mesh.children.forEach(c => {
      if (!c.isMesh && !c.isSprite) return;
      if (c.userData.isBallBulbGlow || c.userData.isRecBulbGlow) {
        const base = c.material.userData._baseOpacity ?? 0.1;
        c.material.opacity = s > 0.05 ? base : 0;
      }
    });
  });
}