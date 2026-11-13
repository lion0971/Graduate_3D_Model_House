import { state } from '../core/state.js';
import { ensureWeatherData } from './weatherPanel.js';
import { SHOW_CLIMATE_PANEL_IN_MENU } from '../config/flags.js';
import { WEATHER_CACHE_MS, DOOR_HINT_DEVICES } from '../data/constants.js';

const climateCardStyleTag = document.createElement('style');
climateCardStyleTag.textContent = `
.climate-card {
  display: flex; flex-direction: column; align-items: stretch; gap: 0;
  background: rgba(15, 20, 30, 0.55);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255,255,255,0.12); border-right: none;
  border-radius: 16px 0 0 16px; padding: 16px 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  color: #f0f4f8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  width: fit-content;
  text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.6);
  transition: transform 0.6s ease, opacity 0.6s ease;
  opacity: 0; transform: translate(80px, -50%);
}
.climate-card.is-visible { opacity: 1; transform: translate(0, -50%); }
.climate-card-section { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
.climate-card-section:first-child { padding-top: 0; }
.climate-card-section:last-child { padding-bottom: 0; }
.climate-card-divider {
  width: 100%; height: 1.5px; flex-shrink: 0;
  background: linear-gradient(90deg, rgba(79,220,255,0) 0%, rgba(79,220,255,0.85) 50%, rgba(79,220,255,0) 100%);
}
.climate-icon-ring {
  position: relative; width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  background: radial-gradient(circle, rgba(79,220,255,0.18) 0%, rgba(79,220,255,0.05) 65%, rgba(79,220,255,0) 100%);
  border: 1px solid rgba(79,220,255,0.4);
  box-shadow: 0 0 10px rgba(79,220,255,0.35), inset 0 0 6px rgba(79,220,255,0.15);
}
.climate-icon { width: 20px; height: 20px; flex-shrink: 0; color: #4fdcff; filter: drop-shadow(0 0 3px rgba(79,220,255,0.6)); }
.climate-icon svg { width: 100%; height: 100%; display: block; }
.climate-label-group { display: flex; flex-direction: column; gap: 2px; }
.climate-title { font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; }
.climate-subtitle { font-size: 13px; color: #fff; white-space: nowrap; }
.climate-value-label { font-size: 13px; color: #fff; white-space: nowrap; }
.climate-value { font-size: 20px; font-weight: 700; color: #fff; white-space: nowrap; }
.climate-badges { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.climate-badge {
  display: flex; align-items: center; gap: 6px; padding: 8px 18px;
  border-radius: 999px; font-size: 15px; font-weight: 600; white-space: nowrap;
  border: 1.5px solid transparent; box-sizing: border-box; width: fit-content;
}
.climate-badge.ac { background: rgba(79,220,255,0.14); color: #7fe0ff; border-color: rgba(79,220,255,0.85);
  box-shadow: 0 0 10px rgba(79,220,255,0.45), inset 0 0 6px rgba(79,220,255,0.12); }
.climate-badge.dehumid { background: rgba(90,220,170,0.14); color: #7fe8c0; border-color: rgba(90,220,170,0.85);
  box-shadow: 0 0 10px rgba(90,220,170,0.45), inset 0 0 6px rgba(90,220,170,0.12); }
.climate-badge.ok { background: rgba(255,255,255,0.08); color: rgba(240,244,248,0.65); border-color: rgba(255,255,255,0.15); }
.climate-card-section:last-child .climate-label-group { align-items: center; }
@media (max-width: 768px) {
  .climate-card { padding: 10px 16px; gap: 0; }
  .climate-card-section { padding: 0 12px; gap: 8px; }
  .climate-icon-ring { width: 32px; height: 32px; }
  .climate-icon { width: 16px; height: 16px; }
  .climate-card {
    flex-direction: row !important; flex-wrap: wrap !important; align-items: center !important;
    right: auto !important; left: 50% !important; top: 10px !important; bottom: auto !important;
    width: max-content !important; max-width: calc(100vw - 24px) !important; row-gap: 6px !important;
    border-radius: 16px !important; border: 1px solid rgba(255,255,255,0.12) !important;
    transform: translate(-50%, -140%);
  }
  .climate-card.is-visible { transform: translate(-50%, 0); }
  .climate-card-section { padding: 0 12px !important; }
  .climate-card-section:first-child { padding-left: 0 !important; }
  .climate-card-section:last-child { padding-right: 0 !important; }
  .climate-card-divider { width: 1px !important; height: 30px !important; }
  .climate-badges { flex-direction: row !important; gap: 8px !important; }
}`;
document.head.appendChild(climateCardStyleTag);

export const climatePanel = document.createElement('div');
climatePanel.className = 'climate-card';
Object.assign(climatePanel.style, {
  position: 'fixed', right: '0', top: '50%', zIndex: '250', pointerEvents: 'none',
});

const climateTempSection = document.createElement('div');
climateTempSection.className = 'climate-card-section';
climateTempSection.innerHTML = `
  <div class="climate-icon-ring"><div class="climate-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
    </svg></div></div>
  <div class="climate-label-group">
    <div class="climate-value-label">現在溫度</div>
    <div class="climate-value"><span class="climate-temp-value">--</span>°C</div>
  </div>`;

const climateDividerB = document.createElement('div');
climateDividerB.className = 'climate-card-divider';

const climateHumiditySection = document.createElement('div');
climateHumiditySection.className = 'climate-card-section';
climateHumiditySection.innerHTML = `
  <div class="climate-icon-ring"><div class="climate-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2.69s6 7.19 6 11.14a6 6 0 0 1-12 0c0-3.95 6-11.14 6-11.14z"/>
    </svg></div></div>
  <div class="climate-label-group">
    <div class="climate-value-label">現在濕度</div>
    <div class="climate-value"><span class="climate-humidity-value">--</span>%</div>
  </div>`;

const climateDividerC = document.createElement('div');
climateDividerC.className = 'climate-card-divider';

const climateStatusSection = document.createElement('div');
climateStatusSection.className = 'climate-card-section';
climateStatusSection.innerHTML = `<div class="climate-label-group"><div class="climate-badges"></div></div>`;

climatePanel.appendChild(climateTempSection);
climatePanel.appendChild(climateDividerB);
climatePanel.appendChild(climateHumiditySection);
climatePanel.appendChild(climateDividerC);
climatePanel.appendChild(climateStatusSection);
document.body.appendChild(climatePanel);

const climateTempValueEl = climateTempSection.querySelector('.climate-temp-value');
const climateHumidityValueEl = climateHumiditySection.querySelector('.climate-humidity-value');
const climateBadgesEl = climateStatusSection.querySelector('.climate-badges');

function getClimateStatusBadges(temp, humidity) {
  const badges = [];
  if (temp > 28) badges.push({ cls: 'ac', icon: '❄️', text: '已開啟冷氣' });
  if (humidity > 60) badges.push({ cls: 'dehumid', icon: '💧', text: '已開啟除濕' });
  if (badges.length === 0) badges.push({ cls: 'ok', icon: '✅', text: '環境舒適' });
  return badges;
}

let climateHideTimer = null;

export function showClimateHintBoxes() {
  const t = state.currentOutdoorTemp;
  const h = state.currentOutdoorHumidity;
  if (t === null || h === null) {
    climateTempValueEl.textContent = '--';
    climateHumidityValueEl.textContent = '--';
    climateBadgesEl.innerHTML = `<div class="climate-badge ok">⚙️ 讀取中...</div>`;
  } else {
    climateTempValueEl.textContent = Math.round(t);
    climateHumidityValueEl.textContent = Math.round(h);
    climateBadgesEl.innerHTML = getClimateStatusBadges(t, h)
      .map(b => `<div class="climate-badge ${b.cls}">${b.icon} ${b.text}</div>`)
      .join('');
  }
  climatePanel.classList.add('is-visible');
  clearTimeout(climateHideTimer);
  climateHideTimer = setTimeout(() => {
    climatePanel.classList.remove('is-visible');
  }, 3500);
}

// 立即切換顯示狀態（跳過動畫），供選單 / 鎖定狀態同步使用
export function setClimatePanelInstantVisible(visible) {
  if (!SHOW_CLIMATE_PANEL_IN_MENU) return;
  const prevTransition = climatePanel.style.transition;
  climatePanel.style.transition = 'none';
  clearTimeout(climateHideTimer);
  climatePanel.classList.toggle('is-visible', visible);
  void climatePanel.offsetWidth;
  climatePanel.style.transition = prevTransition || '';
}

// 以 id 查選單是否開啟，避免 import menu.js 造成循環依賴
function isMenuOpen() {
  const el = document.getElementById('menu-panel');
  return !!el && el.style.display === 'flex';
}

const CLIMATE_HINT_DOORS = new Set(DOOR_HINT_DEVICES.map(d => d.name));

export async function runClimatePopup() {
  if (isMenuOpen()) return;
  await ensureWeatherData();
  showClimateHintBoxes();
}

// 第一次開門時立即彈出，之後每個快取週期自動彈出
export function startClimateOnFirstDoorOpen(doorName, partners = []) {
  if (state.climateAutoStarted) return;
  const isTriggerDoor = [doorName, ...partners].some(n => CLIMATE_HINT_DOORS.has(n));
  if (!isTriggerDoor) return;
  state.climateAutoStarted = true;
  runClimatePopup();
  setInterval(runClimatePopup, WEATHER_CACHE_MS);
}