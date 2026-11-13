import { db, authReadyPromise } from '../core/firebase.js';
import { ref, update, set, increment, onValue } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js';
import { filterState } from '../core/state.js';
import { FILTER_DEVICES, FILTER_LIFETIME_SECONDS } from '../data/constants.js';
import { FILTER_PERSIST_ENABLED } from '../config/flags.js';
import { updateFilterUI, updateFilterUIVisibility } from './filterUI.js';

// 初始化每個裝置的本機濾心狀態
FILTER_DEVICES.forEach(name => {
  filterState[name] = {
    usedSeconds: 0,
    remoteTotal: 0,
    pendingDelta: 0,
    isActive: false,
    uiElapsed: 0,
    saveElapsed: 0,
    alerted: false,
    ready: false,
  };
});

// 持續監聽遠端用量，任何分頁寫入都會即時同步
// 注意：由 main.js 呼叫一次，不在模組載入時自動執行，避免重複監聽
export async function subscribeFilterUsage() {
  if (!FILTER_PERSIST_ENABLED) {
    FILTER_DEVICES.forEach(name => { filterState[name].ready = true; });
    return;
  }
  await authReadyPromise;
  FILTER_DEVICES.forEach(name => {
    const st = filterState[name];
    onValue(ref(db, `filters/${name}`), (snap) => {
      const data = snap.exists() ? snap.val() : null;
      st.remoteTotal = data?.usedSeconds ?? 0;
      if (data?.alerted) st.alerted = true;
      st.usedSeconds = Math.min(st.remoteTotal + st.pendingDelta, FILTER_LIFETIME_SECONDS);
      st.ready = true;
      updateFilterUI(name);
    }, (err) => {
      console.warn(`[Filter] 監聽 ${name} 濾心用量失敗`, err);
      st.ready = true; // 監聽失敗也要放行，否則本機永遠不計時
    });
  });
}

// 節流寫入：每 FILTER_SAVE_INTERVAL 秒或關水時呼叫
export async function saveFilterUsage(device) {
  if (!FILTER_PERSIST_ENABLED) return;
  const st = filterState[device];
  const deltaToFlush = st.pendingDelta;
  if (deltaToFlush <= 0) return;

  try {
    await update(ref(db, `filters/${device}`), {
      usedSeconds: increment(deltaToFlush),
      alerted: st.alerted,
      updatedAt: Date.now(),
    });
    st.pendingDelta -= deltaToFlush;
  } catch (err) {
    console.warn(`[Filter] 寫入 ${device} 濾心用量失敗`, err);
  }
}

// 更換濾心：用 set 覆寫為 0（increment 只能累加，無法清零）
export function resetFilterUsage(device) {
  const st = filterState[device];
  st.usedSeconds = 0;
  st.remoteTotal = 0;
  st.pendingDelta = 0;
  st.alerted = false;
  if (FILTER_PERSIST_ENABLED) {
    set(ref(db, `filters/${device}`), {
      usedSeconds: 0,
      alerted: false,
      updatedAt: Date.now(),
    }).catch(err => console.warn(`[Filter] 重設 ${device} 濾心失敗`, err));
  }
  updateFilterUI(device);
}

// 裝置開 / 關水時呼叫，切換是否累加濾心用量
export function setFilterActive(device, isActive) {
  if (!filterState[device]) return;
  filterState[device].isActive = isActive;
  if (!isActive) {
    filterState[device].saveElapsed = 0;
    saveFilterUsage(device);
  }
  updateFilterUIVisibility();
}