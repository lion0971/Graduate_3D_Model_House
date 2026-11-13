// ═══════════════════════════════════════════
// 共用狀態中心
// 可變純量一律放在 state 物件上（跨模組修改才會同步）；
// 集合（陣列 / Map / 物件）引用固定，可直接 export const。
// ═══════════════════════════════════════════

// 每次開啟網頁唯一的會話 ID
export const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2);

export const state = {
  sessionId,

  // 操作輸入
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  prevTime: performance.now() / 1000,

  // 手機觸控輸入
  isTouchMoving: false,
  isHoldWalking: false,
  isHoldWalkingBackward: false,
  mobileTapNDC: null,

  // 模式旗標
  isXRayMode: false,
  isNoclipMode: false,
  isStuckInWall: false,
  unlockFromButton: false,
  sceneRenderEnabled: false,
  isAnimating: true,

  // 樓梯軌道
  isOnStairRail: false,
  stairHeight: 0,
  stairAngleOffset: 0,
  stairEntryHeight: 0,
  stairCommitted: false,

  // 水池
  waterDepthCurrent: 0,
  waterDepthTarget: 0,
  appliedWaterOffset: 0,
  waterBobStrength: 0,
  wasInPool: false,

  // 燈泡 / 日夜
  targetBulbStrength: 1.0,
  currentBulbStrength: 1.0,
  daySliderValueBeforeXRay: null,

  // 門提示
  doorHintSeen: false,

  // 溫濕度 / 天氣
  climateAutoStarted: false,
  currentOutdoorTemp: null,
  currentOutdoorHumidity: null,
  lastWeatherFetchTime: 0,
  weatherPromise: null,
};

// 場景物件集合（引用固定，內容可變）
export const interactiveDevices = [];
export const doorObjects = [];
export const doorAnimations = {};
export const doorIndicatorInstances = {};
export const doorHintInstances = {};
export const switchHintCards = {};
export const filterUICards = {};

export const outletObjects = {};
export const drainObjects = {};
export const flowingPipes = new Map();
export const waterFlows = {};
export const drainFlows = {};
export const deviceWaterSounds = {};
export const audioBuffers = {};
export const bulbMeshes = [];

export const cachedSceneMeshes = [];
export const hintOccluders = [];
export const poolWaterMeshes = [];

export const collidableObjects = [];
export const strictCollidableObjects = [];

// 警告 / Firebase 監聽
export const activeTimers = {};
export const currentWarningToken = {};
export const activeListeners = {};
export const warningQueue = [];

// 濾心狀態（由 filter/filterState.js 於模組載入時逐裝置填入）
export const filterState = {};

// 碰撞包圍球與水池範圍（GLTF 載入後由 buildScene 填入）
export const collisionData = {
  collidableSpheres: [],
  strictCollidableSpheres: [],
  poolBounds: null,
};