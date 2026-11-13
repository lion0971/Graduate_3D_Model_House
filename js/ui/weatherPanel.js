import { state } from '../core/state.js';
import { SHOW_WEATHER_PANEL_ON_LOAD } from '../config/flags.js';
import { WEATHER_LAT, WEATHER_LON, WEATHER_CACHE_MS } from '../data/constants.js';

// 天氣代碼轉文字（Open-Meteo WMO 代碼）
export function describeWeatherCode(code) {
  if (code === 0) return '☀️ 晴天';
  if (code <= 2) return '⛅ 多雲';
  if (code === 3) return '☁️ 陰天';
  if (code >= 45 && code <= 48) return '🌫️ 有霧';
  if (code >= 51 && code <= 67) return '🌦️ 有雨';
  if (code >= 71 && code <= 77) return '🌨️ 下雪';
  if (code >= 80 && code <= 82) return '🌧️ 陣雨';
  if (code >= 95) return '⛈️ 雷雨';
  return '🌤️ 天氣';
}

function makeWeatherBox() {
  const box = document.createElement('div');
  Object.assign(box.style, {
    background: 'rgba(18, 24, 38, 0.55)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '12px',
    padding: '8px 14px',
    color: '#f0f4f8',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
  });
  box.textContent = '讀取中...';
  return box;
}

const weatherPanel = document.createElement('div');
Object.assign(weatherPanel.style, {
  position: 'fixed',
  display: 'flex',
  gap: '8px',
  zIndex: '250',
  pointerEvents: 'none',
  opacity: '0',
  transform: 'translateX(-60px)',
  transition: 'transform 0.6s ease, opacity 0.6s ease',
});
const weatherBox = makeWeatherBox();
const temperatureBox = makeWeatherBox();
const humidityBox = makeWeatherBox();
weatherPanel.appendChild(weatherBox);
weatherPanel.appendChild(temperatureBox);
weatherPanel.appendChild(humidityBox);
document.body.appendChild(weatherPanel);

// 以 id 取得說明面板位置，避免 import loadingScreen.js 造成循環依賴
function positionWeatherPanel() {
  const instructions = document.getElementById('instructions');
  if (!instructions) return;
  const rect = instructions.getBoundingClientRect();
  weatherPanel.style.left = `${rect.right + 12}px`;
  weatherPanel.style.bottom = `${window.innerHeight - rect.bottom}px`;
}

export function showWeatherPanel() {
  positionWeatherPanel();
  weatherPanel.style.opacity = '1';
  weatherPanel.style.transform = 'translateX(0)';
}

export function hideWeatherPanel() {
  weatherPanel.style.opacity = '0';
  weatherPanel.style.transform = 'translateX(-60px)';
}

window.addEventListener('resize', () => {
  if (weatherPanel.style.opacity === '1') positionWeatherPanel();
});

async function fetchWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,relative_humidity_2m,weather_code`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const current = data.current;
    if (!current) return;

    weatherBox.textContent = describeWeatherCode(current.weather_code);
    temperatureBox.textContent = `🌡️ ${Math.round(current.temperature_2m)}°C`;
    humidityBox.textContent = `💧 ${Math.round(current.relative_humidity_2m)}%`;

    state.currentOutdoorTemp = current.temperature_2m;
    state.currentOutdoorHumidity = current.relative_humidity_2m;
    state.lastWeatherFetchTime = Date.now();
  } catch (err) {
    console.warn('[Weather] 取得氣象資料失敗', err);
    weatherBox.textContent = '氣象資料暫時無法取得';
  }
}

// 天氣資料唯一入口：1 小時內沿用快取，過期或從未抓過才重新請求
export function ensureWeatherData() {
  const isFresh = state.currentOutdoorTemp !== null &&
    Date.now() - state.lastWeatherFetchTime < WEATHER_CACHE_MS;
  if (isFresh) return Promise.resolve();
  if (state.weatherPromise) return state.weatherPromise;
  state.weatherPromise = fetchWeather().finally(() => { state.weatherPromise = null; });
  return state.weatherPromise;
}

if (SHOW_WEATHER_PANEL_ON_LOAD) ensureWeatherData();