import { db, authReadyPromise } from '../core/firebase.js';
import { ref, set, remove, onValue, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js';
import {
  state, flowingPipes, waterFlows, drainFlows, deviceWaterSounds, activeTimers,
  currentWarningToken, activeListeners, warningQueue,
} from '../core/state.js';
import { controls } from '../core/controls.js';
import { PIPE_CONFIG, DEVICE_LABEL } from '../data/constants.js';
import { LINE_NOTIFY_ENABLED } from '../config/flags.js';
import { setPipeState, isPipeStillUsed } from '../water/pipes.js';
import { setFilterActive, resetFilterUsage } from '../filter/filterState.js';
import { menuPanel } from './menu.js';

// ── 濾心低量警告彈窗 ──
export const filterWarningModal = document.createElement('div');
Object.assign(filterWarningModal.style, {
  display: 'none', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  background: 'rgba(0, 90, 130, 0.93)', color: 'white', padding: '28px 40px', borderRadius: '12px',
  fontSize: '20px', fontWeight: 'bold', textAlign: 'center', zIndex: '999',
  boxShadow: '0 0 30px rgba(0,180,255,0.8)', border: '2px solid #00cfff',
  minWidth: '300px', lineHeight: '1.6', pointerEvents: 'auto',
});
document.body.appendChild(filterWarningModal);

const filterWarningText = document.createElement('div');
filterWarningModal.appendChild(filterWarningText);

const filterWarningCloseBtn = document.createElement('button');
filterWarningCloseBtn.innerText = '我知道了';
Object.assign(filterWarningCloseBtn.style, {
  padding: '8px 24px', cursor: 'pointer', background: 'white', color: '#005a82',
  border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px',
  display: 'block', margin: '16px auto 0',
});
filterWarningCloseBtn.onclick = () => {
  filterWarningModal.style.display = 'none';
  if (menuPanel.style.display !== 'flex') setTimeout(() => controls.lock(), 80);
};
filterWarningModal.appendChild(filterWarningCloseBtn);

const filterReplaceBtn = document.createElement('button');
filterReplaceBtn.innerText = '已更換濾心，重新計時';
Object.assign(filterReplaceBtn.style, {
  padding: '8px 24px', cursor: 'pointer', background: '#005a82', color: 'white',
  border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px',
  display: 'block', margin: '10px auto 0',
});
filterReplaceBtn.onclick = () => {
  resetFilterUsage(filterReplaceBtn.dataset.device);
  filterWarningModal.style.display = 'none';
  if (menuPanel.style.display !== 'flex') setTimeout(() => controls.lock(), 80);
};
filterWarningModal.appendChild(filterReplaceBtn);

export async function markFilterLowAlert(device) {
  if (!LINE_NOTIFY_ENABLED) return;
  await authReadyPromise;
  try {
    await set(ref(db, `filterAlerts/${device}`), {
      status: 'filter_low_alert', notified: false, timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('[Firebase] 寫入濾心低量警告失敗', err);
  }
}

export function showFilterWarning(device) {
  const label = DEVICE_LABEL[device] ?? device;
  filterWarningText.innerHTML =
    `💧 濾心即將到期<br>
     <span style="color:#aef2ff;font-size:22px">${label}</span><br>
     濾心剩餘容量已低於 <span style="color:#aef2ff">5%</span>！<br>
     請盡快更換濾心。`;
  filterWarningCloseBtn.dataset.device = device;
  filterReplaceBtn.dataset.device = device;
  filterWarningModal.style.display = 'block';
  controls.unlock();
  markFilterLowAlert(device);
}

// ── 出水超時警告彈窗 ──
export const warningModal = document.createElement('div');
Object.assign(warningModal.style, {
  display: 'none', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  background: 'rgba(180, 40, 0, 0.93)', color: 'white', padding: '28px 40px', borderRadius: '12px',
  fontSize: '20px', fontWeight: 'bold', textAlign: 'center', zIndex: '999',
  boxShadow: '0 0 30px rgba(255,100,0,0.8)', border: '2px solid orange',
  minWidth: '300px', lineHeight: '1.6', pointerEvents: 'auto',
});
document.body.appendChild(warningModal);

const warningText = document.createElement('div');
warningModal.appendChild(warningText);

const warningCloseBtn = document.createElement('button');
warningCloseBtn.innerText = '我知道了';
Object.assign(warningCloseBtn.style, {
  padding: '8px 24px', cursor: 'pointer', background: 'white', color: '#c03000',
  border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px',
  display: 'block', margin: '16px auto 0',
});
warningModal.appendChild(warningCloseBtn);

const warningOffBtn = document.createElement('button');
warningOffBtn.innerText = '關閉水流';
Object.assign(warningOffBtn.style, {
  padding: '8px 24px', cursor: 'pointer', background: '#c03000', color: 'white',
  border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px',
  display: 'block', margin: '10px auto 0',
});
warningModal.appendChild(warningOffBtn);

export async function markTimeoutAlert(deviceName, token) {
  if (!LINE_NOTIFY_ENABLED) return;
  await authReadyPromise;
  const nodeRef = ref(db, `sessions/${token}/${deviceName}`);
  try {
    await set(nodeRef, { status: 'timeout_alert', notified: false, timestamp: Date.now() });
    // 連線斷開時由 Firebase 伺服器自動刪除節點
    onDisconnect(nodeRef).remove();
  } catch (err) {
    console.warn('[Firebase] 寫入超時警告失敗', err);
  }
}

export function stopPollingRemoteClose(deviceName) {
  if (activeListeners[deviceName]) {
    activeListeners[deviceName]();
    delete activeListeners[deviceName];
  }
}

export async function startPollingRemoteClose(deviceName, token) {
  await authReadyPromise;
  stopPollingRemoteClose(deviceName);
  const nodeRef = ref(db, `sessions/${token}/${deviceName}`);
  activeListeners[deviceName] = onValue(nodeRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.shouldClose) {
      closeDeviceWater(deviceName);
      stopPollingRemoteClose(deviceName);
      dismissCurrentWarning(deviceName);
      remove(nodeRef);
    }
  }, (err) => {
    console.warn('[Firebase] 監聽失敗', err);
  });
}

// 關閉某裝置的水流（按鈕關閉與遠端關閉共用）
export function closeDeviceWater(deviceName) {
  const cfg = PIPE_CONFIG[deviceName];
  if (!cfg) return;

  cfg.coldPipes.forEach(pipeName => {
    const p = flowingPipes.get(pipeName);
    if (p && !isPipeStillUsed(pipeName, deviceName, 'cold')) setPipeState(p, 'inactive');
  });
  cfg.drainPipes.forEach(pipeName => {
    const p = flowingPipes.get(pipeName);
    if (p && !isPipeStillUsed(pipeName, deviceName, 'drain')) setPipeState(p, 'inactive');
  });

  waterFlows[deviceName]?.setActive(false);
  drainFlows[cfg.drainKey]?.setActive(false);
  setFilterActive(deviceName, false);

  const sound = deviceWaterSounds[deviceName];
  if (sound && sound.isPlaying) sound.stop();

  if (activeTimers[deviceName]) {
    activeTimers[deviceName].startTime = null;
    activeTimers[deviceName].alerted = false;
    activeTimers[deviceName].repeatMode = false;
  }
}

export function showWarning(deviceName) {
  if (warningQueue.includes(deviceName)) return;
  warningQueue.push(deviceName);

  const token = state.sessionId + '_' + Date.now();
  currentWarningToken[deviceName] = token;

  markTimeoutAlert(deviceName, token);
  if (LINE_NOTIFY_ENABLED) startPollingRemoteClose(deviceName, token);

  if (warningQueue.length === 1) displayNextWarning();
}

export function displayNextWarning() {
  if (warningQueue.length === 0) {
    warningModal.style.display = 'none';
    return;
  }
  const deviceName = warningQueue[0];
  const label = DEVICE_LABEL[deviceName] ?? deviceName;
  warningText.innerHTML =
    `⚠️ 警告<br>
     <span style="color:#ffdd00;font-size:22px">${label}</span><br>
     已持續出水超過 <span style="color:#ffdd00">1 分鐘</span>！<br>
     請確認是否忘記關閉。`;
  warningModal.style.display = 'block';
  warningCloseBtn.dataset.device = deviceName;
  warningOffBtn.dataset.device = deviceName;
  controls.unlock();
}

export function dismissCurrentWarning(deviceName) {
  const idx = warningQueue.indexOf(deviceName);
  if (idx !== -1) warningQueue.splice(idx, 1);
  displayNextWarning();
}

warningCloseBtn.onclick = () => {
  const deviceName = warningCloseBtn.dataset.device;
  if (activeTimers[deviceName]) {
    if (activeTimers[deviceName].startTime) activeTimers[deviceName].startTime = Date.now();
    activeTimers[deviceName].alerted = false;
    activeTimers[deviceName].repeatMode = true;
  }
  const ackToken = currentWarningToken[deviceName];
  if (ackToken) {
    stopPollingRemoteClose(deviceName);
    remove(ref(db, `sessions/${ackToken}/${deviceName}`)).catch(err =>
      console.warn('[Firebase] 刪除超時警告節點失敗', err));
  }
  dismissCurrentWarning(deviceName);
  if (menuPanel.style.display !== 'flex' && warningQueue.length === 0) {
    setTimeout(() => controls.lock(), 80);
  }
};

warningOffBtn.onclick = () => {
  const deviceName = warningOffBtn.dataset.device;
  closeDeviceWater(deviceName);
  const offToken = currentWarningToken[deviceName];
  if (offToken) {
    remove(ref(db, `sessions/${offToken}/${deviceName}`)).catch(err =>
      console.warn('[Firebase] 刪除超時警告節點失敗', err));
  }
  stopPollingRemoteClose(deviceName);
  dismissCurrentWarning(deviceName);
  if (menuPanel.style.display !== 'flex' && warningQueue.length === 0) {
    setTimeout(() => controls.lock(), 80);
  }
};