import * as THREE from 'three';
import { scene } from '../core/renderer.js';
import { SHOW_SUN_MESH } from '../data/constants.js';

export const sunLight = new THREE.DirectionalLight(0xfff5e0, 0);
scene.add(sunLight);
scene.add(sunLight.target);

export const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.8, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffee88 })
);
export const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(3.2, 16, 16),
  new THREE.MeshBasicMaterial({
    color: 0xffcc33, transparent: true, opacity: 0.18,
    side: THREE.BackSide, depthWrite: false,
  })
);
sunMesh.add(sunGlow);
sunMesh.visible = SHOW_SUN_MESH;
scene.add(sunMesh);