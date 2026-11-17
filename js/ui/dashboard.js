// 智能儀表版
import { state, filterState } from '../core/state.js';
import { isMobile } from '../core/controls.js';
import { ensureWeatherData } from './weatherPanel.js';
import {
  FILTER_DEVICES, FILTER_LIFETIME_SECONDS, FILTER_RING_ZONES, DEVICE_LABEL,
} from '../data/constants.js';
import { formatRemainingParts } from '../utils/math.js';

const DASH_RING_R = 22;
const DASH_RING_C = 2 * Math.PI * DASH_RING_R;
const DASH_FILTER_R = 26;
const DASH_FILTER_C = 2 * Math.PI * DASH_FILTER_R;

const dashStyleTag = document.createElement('style');
dashStyleTag.textContent = `
.dash-dock {
  --dash-font: 13px; --dash-title-font: 15px;
  position: fixed; left: 0; top: 12px; bottom: 12px; z-index: 260;
  display: flex; align-items: center;
  transform: translateX(calc(-100% + 52px));
  transition: transform 0.6s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.3s ease;
  opacity: 0; pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.dash-dock.open { transform: translateX(0); transition: transform 0.4s cubic-bezier(0.34, 1.1, 0.64, 1), opacity 0.3s ease; }
.dash-dock::before {
  content: ""; position: absolute; top: 0; bottom: 0; left: -60px; width: 60px;
  background: rgba(14, 18, 30, 0.78); pointer-events: none;
}
.dash-dock.available { opacity: 1; pointer-events: none; }
.dash-panel, .dash-tab { pointer-events: auto; }
.dash-panel {
  width: min(86vw, 360px); height: 100%; display: flex; flex-direction: column;
  box-sizing: border-box; padding: 14px; overflow-x: hidden; overflow-y: auto;
  background: rgba(14, 18, 30, 0.75);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.3); border-left: none; border-radius: 0 24px 24px 0;
  box-shadow: 0 10px 40px rgba(0,0,0,0.4);
  color: #f0f4f8; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 7px rgba(0, 0, 0, 0.72);
}
.light-blue-square {
  display: inline-block;
  width: 12px;
  height: 12px;
  background-color: #e1f501;
  margin-right: 3px;
  border-radius: 1px;
}
.dash-panel::-webkit-scrollbar { width: 6px; }
.dash-panel::-webkit-scrollbar-thumb { background: rgba(14, 18, 30, 0.78); border-radius: 3px; }
.dash-panel { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) transparent; }
.dash-title { font-size: var(--dash-title-font); font-weight: 600; letter-spacing: 1px; color: #fff; margin-bottom: 10px; flex-shrink: 0; }
.dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; flex-shrink: 0; }
.dash-card {
  background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px; padding: 9px 10px; display: flex; flex-direction: column; gap: 4px; min-width: 0;
}
.dash-card-label { font-size: var(--dash-font); font-weight: 500; color: #ffffff; }
.dash-card-value { font-size: 22px; font-weight: 700; }
.dash-sub { font-size: var(--dash-font); line-height: 1.3; color: #ffffff; }
.dash-section-title { margin: 12px 0 8px; font-size: var(--dash-title-font); font-weight: 600; opacity: 0.9; flex-shrink: 0; }
.dash-status { align-items: flex-start; gap: 6px; }
.dash-status .state {
  font-size: var(--dash-font); font-weight: 600; padding: 3px 12px; border-radius: 999px;
  background: rgba(255,255,255,0.22); color: #ffffff; white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0,0,0,0.7);
}
.dash-status.on.ac .state { background: #0e9fc4; box-shadow: 0 0 10px rgba(79,220,255,0.6); }
.dash-status.on.dehu .state { background: #14a37a; box-shadow: 0 0 10px rgba(90,220,170,0.6); }
.dash-humi { flex-direction: row; align-items: center; gap: 8px; }
.dash-ring-wrap { position: relative; width: 48px; height: 48px; flex-shrink: 0; }
.dash-ring-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.dash-ring-center { position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; font-size: 11px; font-weight: 700; text-align: center; line-height: 1.1; }
.dash-filter-list { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 8px; flex: 1; min-height: 300px; }
.dash-filter { align-items: center; justify-content: center; text-align: center; gap: 4px; padding: 6px; }
.dash-filter .name { font-size: var(--dash-font); font-weight: 600; line-height: 1.2; color: #ffffff; }
.dash-filter .time { font-size: var(--dash-font); font-weight: 600; color: #ffffff; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dash-filter .flow { font-size: var(--dash-font); font-weight: 600; color: #8fe9ff; min-height: 16px; }
.dash-tab {
  width: 52px; height: 64px; margin-left: -1px; flex-shrink: 0; align-self: flex-start;
  margin-top: calc(33.333vh - 44px);
  display: flex; align-items: center; justify-content: center;
  background: rgba(20, 26, 40, 0.6); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.16); border-left: none; border-radius: 0 32px 32px 0;
  color: #4fdcff; cursor: pointer; padding: 0; box-shadow: 4px 4px 20px rgba(0,0,0,0.3);
}
.dash-tab svg { width: 26px; height: 26px; filter: drop-shadow(0 0 4px rgba(79,220,255,0.7)); transition: transform 0.4s ease; }
.dash-dock.open .dash-tab svg { transform: rotate(180deg); }
@media (max-height: 640px) {
  .dash-panel { padding: 10px; }
  .dash-title { margin-bottom: 6px; }
  .dash-card { padding: 6px 8px; }
  .dash-card-value { font-size: 18px; }
  .dash-status .dash-sub { display: none; }
  .dash-section-title { margin: 8px 0 6px; }
}
@media (max-width: 768px) { .dash-dock { --dash-font: 16px; --dash-title-font: 18px; } }`;
document.head.appendChild(dashStyleTag);

export const dashDock = document.createElement('div');
dashDock.className = 'dash-dock';
dashDock.innerHTML = `
  <div class="dash-panel">
    <div class="dash-title"><span class="light-blue-square"></span>智慧儀表板</div>
    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-card-label">🌡️ 溫度</div>
        <div class="dash-card-value"><span id="dash-temp">--</span>°C</div>
      </div>
      <div class="dash-card dash-humi">
        <div class="dash-ring-wrap">
          <svg viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="${DASH_RING_R}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="6"/>
            <circle id="dash-humi-ring" cx="28" cy="28" r="${DASH_RING_R}" fill="none" stroke="#60a5fa"
              stroke-width="6" stroke-linecap="round" stroke-dasharray="0 ${DASH_RING_C}"/>
          </svg>
          <div class="dash-ring-center">💧</div>
        </div>
        <div>
          <div class="dash-card-label">濕度</div>
          <div class="dash-card-value" style="font-size:20px"><span id="dash-humi">--</span>%</div>
        </div>
      </div>
      <div class="dash-card dash-status ac" id="dash-ac">
        <div><div class="dash-card-label">❄️ 冷氣</div><div class="dash-sub">&gt; 28°C 啟動</div></div>
        <div class="state">--</div>
      </div>
      <div class="dash-card dash-status dehu" id="dash-dehu">
        <div><div class="dash-card-label">💧 除濕</div><div class="dash-sub">&gt; 60% 啟動</div></div>
        <div class="state">--</div>
      </div>
    </div>
    <div class="dash-section-title"><span class="light-blue-square"></span>淨水濾心剩餘</div>
    <div class="dash-filter-list" id="dash-filter-list"></div>
  </div>
<button class="dash-tab" aria-label="智慧儀表板">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.5 1.1 L3.5 1.1 Q4.2 1.1 4.74 1.55 L16.26 11.15 Q16.8 11.6 16.27 12.06 L4.53 22.34 Q4.0 22.8 3.3 22.8 L2.5 22.8 Q1.8 22.8 1.8 22.1 L1.8 1.8 Q1.8 1.1 2.5 1.1 Z"/>
  </svg>
</button>`;
document.body.appendChild(dashDock);

const dashFilterEls = {};
const dashFilterList = dashDock.querySelector('#dash-filter-list');
FILTER_DEVICES.forEach(device => {
  const card = document.createElement('div');
  card.className = 'dash-card dash-filter';
  card.innerHTML = `
    <div class="dash-ring-wrap" style="width:56px;height:56px">
      <svg viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="${DASH_FILTER_R}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="5"/>
        <circle class="ring" cx="28" cy="28" r="${DASH_FILTER_R}" fill="none" stroke="#60a5fa"
          stroke-width="5" stroke-linecap="round" stroke-dasharray="0 ${DASH_FILTER_C}"/>
      </svg>
      <div class="dash-ring-center pct" style="font-size:12px">--%</div>
    </div>
    <div class="name">${DEVICE_LABEL[device] ?? device}</div>
    <div class="dash-sub time">--</div>
    <div class="flow"></div>`;
  dashFilterList.appendChild(card);
  dashFilterEls[device] = {
    ring: card.querySelector('.ring'),
    pct: card.querySelector('.pct'),
    time: card.querySelector('.time'),
    flow: card.querySelector('.flow'),
  };
});

const dashTempEl = dashDock.querySelector('#dash-temp');
const dashHumiEl = dashDock.querySelector('#dash-humi');
const dashHumiRing = dashDock.querySelector('#dash-humi-ring');
const dashAcEl = dashDock.querySelector('#dash-ac');
const dashDehuEl = dashDock.querySelector('#dash-dehu');

export function updateDashboard() {
  const t = state.currentOutdoorTemp, h = state.currentOutdoorHumidity;

  if (t === null || h === null) {
    dashTempEl.textContent = '--';
    dashHumiEl.textContent = '--';
    dashAcEl.classList.remove('on'); dashAcEl.querySelector('.state').textContent = '讀取中';
    dashDehuEl.classList.remove('on'); dashDehuEl.querySelector('.state').textContent = '讀取中';
  } else {
    dashTempEl.textContent = Math.round(t);
    dashHumiEl.textContent = Math.round(h);
    const len = Math.min(100, Math.max(0, h)) / 100 * DASH_RING_C;
    dashHumiRing.setAttribute('stroke-dasharray', `${len} ${DASH_RING_C - len}`);

    const acOn = t > 28, dehuOn = h > 60;
    dashAcEl.classList.toggle('on', acOn);
    dashAcEl.querySelector('.state').textContent = acOn ? '已開啟' : '待機';
    dashDehuEl.classList.toggle('on', dehuOn);
    dashDehuEl.querySelector('.state').textContent = dehuOn ? '已開啟' : '待機';
  }

  FILTER_DEVICES.forEach(device => {
    const st = filterState[device], el = dashFilterEls[device];
    if (!st || !el) return;
    const usedPercent = Math.min(100, (st.usedSeconds / FILTER_LIFETIME_SECONDS) * 100);
    const remainPercent = 100 - usedPercent;
    const zone = FILTER_RING_ZONES.find((z, i) =>
      usedPercent >= z.min && (i === FILTER_RING_ZONES.length - 1 ? usedPercent <= z.max : usedPercent < z.max)
    ) || FILTER_RING_ZONES[FILTER_RING_ZONES.length - 1];

    const len = remainPercent / 100 * DASH_FILTER_C;
    el.ring.setAttribute('stroke-dasharray', `${len} ${DASH_FILTER_C - len}`);
    el.ring.setAttribute('stroke', zone.color);
    el.pct.textContent = `${Math.round(remainPercent)}%`;

    const p = formatRemainingParts(Math.max(0, FILTER_LIFETIME_SECONDS - st.usedSeconds));
    el.time.textContent = `${p.h}時${p.m}分${p.s}秒`;
    el.flow.textContent = st.isActive ? '💦 出水中' : '';
  });
}

let dashOpen = false;
let dashAvailable = false;
let dashTimer = null;
let dashSuppressOpen = false;

export function setDashOpen(open) {
  if (open && !dashAvailable) return;
  if (dashOpen === open) return;
  dashOpen = open;
  dashDock.classList.toggle('open', open);
  clearInterval(dashTimer);
  dashTimer = null;
  if (open) {
    requestAnimationFrame(() => {
      if (!dashOpen) return;
      ensureWeatherData().then(updateDashboard);
      updateDashboard();
      dashTimer = setInterval(updateDashboard, 1000);
    });
  }
}

export function setDashboardAvailable(v) {
  dashAvailable = v;
  dashDock.classList.toggle('available', v);
  if (!v) {
    dashSuppressOpen = false;
    setDashOpen(false);
  }
}

const DASH_TAB_VISIBLE_W = 52;
const DASH_TRIGGER_NEAR = 160;
const DASH_LEAVE_MARGIN = 5;
let dashMouseRaf = 0;

// 電腦：滑鼠靠近圖示展開，離開面板範圍收回
window.addEventListener('mousemove', (e) => {
  if (isMobile || !dashAvailable) return;
  if (dashMouseRaf) return;
  const mx = e.clientX, my = e.clientY;
  dashMouseRaf = requestAnimationFrame(() => {
    dashMouseRaf = 0;
    const r = dashDock.getBoundingClientRect();
    const tr = dashDock.querySelector('.dash-tab').getBoundingClientRect();
    const midY = (tr.top + tr.bottom) / 2;

    const inTriggerZone = mx <= DASH_TAB_VISIBLE_W + DASH_TRIGGER_NEAR &&
      Math.abs(my - midY) <= 32 + DASH_TRIGGER_NEAR;

    if (dashOpen) {
      const stillInside = mx <= dashDock.offsetWidth + DASH_LEAVE_MARGIN &&
        my >= r.top - DASH_LEAVE_MARGIN && my <= r.bottom + DASH_LEAVE_MARGIN;
      setDashOpen(stillInside);
    } else {
      if (dashSuppressOpen) {
        if (!inTriggerZone) dashSuppressOpen = false;
        return;
      }
      setDashOpen(inTriggerZone);
    }
  });
});

// 手機：按圖示切換
dashDock.querySelector('.dash-tab').addEventListener('click', (e) => {
  e.stopPropagation();
  if (dashOpen) {
    dashSuppressOpen = true;
    setDashOpen(false);
  } else {
    setDashOpen(true);
  }
});
dashDock.addEventListener('mousedown', e => e.stopPropagation());