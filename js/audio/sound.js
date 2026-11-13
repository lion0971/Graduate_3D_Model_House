import * as THREE from 'three';
import { audioListener } from '../core/renderer.js';
import { audioBuffers, deviceWaterSounds, outletObjects } from '../core/state.js';
import { audioLoader } from '../core/loaders.js';
import { PIPE_CONFIG, AUDIO_FILES, SWIM_SOUND_VOLUME, SWIM_LOOP_ENABLED } from '../data/constants.js';

// 載入所有音效 buffer（由 main.js 呼叫一次）
export function loadAllAudio() {
  Object.entries(AUDIO_FILES).forEach(([type, url]) => {
    audioLoader.load(url, (buffer) => {
      audioBuffers[type] = buffer;
    }, undefined, (err) => {
      console.warn(`[音效] 載入 ${type} 音效失敗`, err);
    });
  });
}

// 為指定裝置建立掛在出水口上的空間音源（由 buildScene 呼叫）
export function createDeviceWaterSound(deviceName) {
  const cfg = PIPE_CONFIG[deviceName];
  if (!cfg) return;
  const buffer = audioBuffers[cfg.type];
  if (!buffer) {
    console.warn(`[音效] ${cfg.type} 音效尚未載入完成，${deviceName} 無法建立音源`);
    return;
  }
  const anchor = outletObjects[cfg.outletKey];
  if (!anchor) return;

  const sound = new THREE.PositionalAudio(audioListener);
  sound.setBuffer(buffer);
  sound.setLoop(true);
  sound.setRefDistance(1.5);
  sound.setMaxDistance(12);
  sound.setVolume(cfg.type === 'shower' ? 0.6 : 0.4);
  anchor.add(sound);
  deviceWaterSounds[deviceName] = sound;
}

let splashSound = null;
function ensureSplashSound() {
  if (splashSound) return splashSound;
  const buffer = audioBuffers.splash;
  if (!buffer) return null;
  splashSound = new THREE.Audio(audioListener);
  splashSound.setBuffer(buffer);
  splashSound.setLoop(false);
  splashSound.setVolume(0.6);
  return splashSound;
}

// 入水 / 出水的一次性水聲
export function playSplash() {
  const s = ensureSplashSound();
  if (!s) return;
  if (s.isPlaying) s.stop();
  s.play();
}

let swimSound = null;
function ensureSwimSound() {
  if (swimSound) return swimSound;
  const buffer = audioBuffers.swim;
  if (!buffer) return null;
  swimSound = new THREE.Audio(audioListener);
  swimSound.setBuffer(buffer);
  swimSound.setLoop(false);
  swimSound.setVolume(SWIM_SOUND_VOLUME);
  return swimSound;
}

export function playSwimOnce() {
  const s = ensureSwimSound();
  if (!s) return;
  s.setLoop(false);
  if (!s.isPlaying) s.play();
}

// 在水中移動時循環播放（目前由 SWIM_LOOP_ENABLED 關閉）
export function setSwimLoop(on) {
  if (!SWIM_LOOP_ENABLED) return;
  const s = ensureSwimSound();
  if (!s) return;
  s.setLoop(on);
  if (on && !s.isPlaying) s.play();
}