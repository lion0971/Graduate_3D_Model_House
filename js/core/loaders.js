import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export const manager = new THREE.LoadingManager();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

export const gltfLoader = new GLTFLoader(manager);
gltfLoader.setDRACOLoader(dracoLoader);

export const rgbeLoader = new RGBELoader(manager);
export const textureLoader = new THREE.TextureLoader(manager);
export const audioLoader = new THREE.AudioLoader(manager);
window.audioLoader = audioLoader;

export const aoMap = textureLoader.load('textures/bake_ao.png');
aoMap.colorSpace = THREE.NoColorSpace;
aoMap.flipY = false;