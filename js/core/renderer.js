import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { CONFIG } from '../../scene-config.js';

export const scene = new THREE.Scene();
window.scene = scene;

export const camera = new THREE.PerspectiveCamera(
  CONFIG.CAMERA.fov,
  window.innerWidth / window.innerHeight,
  0.1, 1000
);
camera.position.set(CONFIG.CAMERA.startPos.x, CONFIG.CAMERA.startPos.y, CONFIG.CAMERA.startPos.z);
camera.rotation.order = 'YXZ';
if (CONFIG.CAMERA.lookAtPos) {
  camera.lookAt(CONFIG.CAMERA.lookAtPos.x, CONFIG.CAMERA.lookAtPos.y, CONFIG.CAMERA.lookAtPos.z);
}
window.camera = camera;

export const audioListener = new THREE.AudioListener();
camera.add(audioListener);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.debug.checkShaderErrors = false;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth * 0.2, window.innerHeight * 0.2),
  0.2, 0.5, 0.85
));

export const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;width:100%;height:100%';
document.body.appendChild(labelRenderer.domElement);

RectAreaLightUniformsLib.init();

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
});