import * as THREE from 'three';

// ── 人體與碰撞 ──
export const COLLISION_EYE_HEIGHT_OFFSET = 0;
export const COLLISION_LATERAL_HEIGHT_OFFSET = -1.1;
export const COLLISION_HEIGHT_OFFSETS = [COLLISION_EYE_HEIGHT_OFFSET];
export const PLAYER_HALF_WIDTH = 0.2;
export const collisionDistance = 0.5;
export const MAX_SLIDE_ITERATIONS = 3;
export const NEARBY_COLLISION_RADIUS = 8;
export const STAIRCASE_COLLISION_HEIGHT = 5.5;

// 透視模式下仍需碰撞的外牆
export const STRICT_COLLISION_NAMES = new Set([
  'wall_outside_2',
  'tearoom_big_w_f_2_wall',
  'tearoom_big_w_2_wall',
  'balcony_big_w_f_2_wall',
  'balcony_big_w_2_wall',
]);

// 需要套用 AO 貼圖的物件
export const AO_BAKE_TARGETS = new Set([
  'ceiling', 'wall_inside_1', 'wall_inside_2', 'wall_inside_2_1',
  'wall_inside_2_2', 'fwall_inside_2_3', 'floor', 'kitchen_carpet',
  'Cube082_1', 'Cube082_2', 'floor_2', 'girl_carpet',
]);

// ── 移動 ──
export const WALK_HOLD_ACCEL = 24;

// ── 旋轉樓梯 ──
export const STAIRCASE = {
  center: new THREE.Vector3(10.65, 1.6, -5.78),
  radius: 1.0,
  walkRadius: 0.6,
  totalHeight: 3.4,
  stepHeight: 0.2,
  turns: 1,
  radiusMargin: 0.3,
  climbSpeed: 1.0,
  entranceAngle: THREE.MathUtils.degToRad(109.7),
  entranceAngleTolerance: THREE.MathUtils.degToRad(50),
  entranceAngleTop: THREE.MathUtils.degToRad(25),
  entranceAngleToleranceTop: THREE.MathUtils.degToRad(50),
};
export const STAIR_MID_Y = STAIRCASE.center.y + STAIRCASE.totalHeight / 2;
export const STAIR_COMMIT_MARGIN = 0.15;

// ── 桌子虛擬碰撞（座標由 buildScene 載入後自動量測填入）──
export const DINING_TABLE_BOUNDS = {
  minX: 0, maxX: 0, minZ: 0, maxZ: 0,
  margin: 0.1,
  maxY: 2.5,
};

// ── 水池 ──
export const WATER_SINK_DEPTH = 1.1;
export const WATER_SINK_LERP_SPEED = 6.0;
export const WATER_BOB_AMPLITUDE = 0.03;
export const WATER_BOB_SPEED = 0.5;
export const WATER_ENTRY_OVERSHOOT = 0.4;
export const WATER_EXIT_JUMP = 0.5;
export const WATER_ENTRY_RECOVER_SPEED = 3.0;
export const WATER_EXIT_RECOVER_SPEED = 4.0;

// ── 門 ──
export const SLIDE_AXIS_OVERRIDE = {};
export const SLIDE_SIGN_OVERRIDE = { 'kit_sliding_door': 1 };
export const SWING_SIGN_OVERRIDE = {
  'door_restroom_2': 1,
  'door_livingroom': 1,
  'door_livingroom_1': 1,
};
export const DOOR_FRONT_NORMAL_AXIS_OVERRIDE = {};
export const DOOR_FRONT_NORMAL_SIGN_OVERRIDE = {};
export const TURN_UP_SIGN_OVERRIDE = {};
export const TURN_UP_OPEN_ANGLE = THREE.MathUtils.degToRad(60);
export const TURN_UP_AXIS_OVERRIDE = {};

export const DOOR_GROUPS = [['door_livingroom', 'door_livingroom_1']];
export const DOOR_PARTNER_MAP = {};
DOOR_GROUPS.forEach(group => {
  group.forEach(name => {
    DOOR_PARTNER_MAP[name] = group.filter(n => n !== name);
  });
});

export const DOOR_OPEN_MARGIN = 0.1;
export const DOOR_INDICATOR_RADIUS = 3.5;
export const DOOR_INDICATOR_INTERVAL = 3.0;
export const DOOR_INDICATOR_HEIGHT_OFFSET = 1.0;
export const DOOR_INDICATOR_DIR_SAMPLE_DIST = 0.6;

export const DOOR_HINT_DEVICES = [
  { name: 'door_livingroom', offsetX: 0.8 },
  { name: 'kit_sliding_door', offsetX: 0 },
];
export const DOOR_HINT_RADIUS = 3.5;
export const DOOR_HINT_HEIGHT_OFFSET = 0.4;

// ── 開關提示 ──
export const SWITCH_HINT_RADIUS = 2.4;
export const SWITCH_HINT_HEIGHT_OFFSET = 0.15;
export const SWITCH_HINT_CHECK_INTERVAL = 0.2;

// ── 濾心 ──
export const FILTER_DEVICES = ['kit_faucet_1', 'kit_faucet_2', 'restroom_faucet', 'restroom_faucet_2'];
export const FILTER_LIFETIME_HOURS = 2000;
export const FILTER_LIFETIME_SECONDS = FILTER_LIFETIME_HOURS * 3600;
export const FILTER_LOW_RATIO = 0.05;
export const FILTER_UI_UPDATE_INTERVAL = 1.0;
export const FILTER_SAVE_INTERVAL = 10.0;
export const FILTER_CARD_SHOW_MS = 320;
export const FILTER_CARD_HEIGHT_OFFSET = 0.2;
export const FILTER_CARD_GAP = 14;
export const FILTER_CARD_VISIBILITY_INTERVAL = 0.15;
export const RING_RADIUS = 30;
export const RING_CIRC = 2 * Math.PI * RING_RADIUS;
export const FILTER_RING_BRIGHTEN_RATIO = 0.35;
export const FILTER_RING_ZONES = [
  { min: 0, max: 25, color: '#60a5fa', dim: 'rgba(59,130,246,0.25)' },
  { min: 25, max: 50, color: '#4ade80', dim: 'rgba(34,197,94,0.25)' },
  { min: 50, max: 75, color: '#facc15', dim: 'rgba(234,179,8,0.25)' },
  { min: 75, max: 90, color: '#fb923c', dim: 'rgba(251,146,60,0.3)' },
  { min: 90, max: 100, color: '#ef4444', dim: 'rgba(220,38,38,0.3)' },
];

// ── 警告 ──
export const WARNING_MS = 60 * 1000;
export const WARNING_REPEAT_MS = 10 * 60 * 1000;

// ── 日夜 / 透視 ──
export const DEFAULT_DAY_VALUE = 50;
export const XRAY_TONE_EXPOSURE = 0.3;
export const XRAY_AMBIENT_INTENSITY = 0.2;
export const LIGHTS_ON_SLIDER_VALUE = 30;
export const LIGHTS_ON_ELEV_RATIO = Math.sin((LIGHTS_ON_SLIDER_VALUE / 100) * Math.PI);
export const BULB_LERP_SPEED = 30.0;
export const SHOW_SUN_MESH = false;

// ── 天氣 ──
export const WEATHER_LAT = 25.0439;
export const WEATHER_LON = 121.5358;
export const WEATHER_CACHE_MS = 60 * 60 * 1000;

// ── 渲染幀率 ──
export const TARGET_FPS = 60;
export const FRAME_INTERVAL = 1000 / TARGET_FPS;

// ── 管路配置 ──
export const PIPE_CONFIG = {
  'kit_faucet_1': {
    outletKey: 'kit_faucet_1_outlet', drainKey: 'kit_faucet_1_drain',
    coldPipes: ['pipe_main', 'pipe_kit', 'pipe_kit_1', 'pipe_kit_faucet_1'],
    drainPipes: ['pipe_main_w', 'pipe_kit_w', 'pipe_kit_faucet_1_w'],
    type: 'faucet',
  },
  'kit_faucet_2': {
    outletKey: 'kit_faucet_2_outlet', drainKey: 'kit_faucet_2_drain',
    coldPipes: ['pipe_main', 'pipe_kit', 'pipe_kit', 'pipe_kit_1', 'pipe_kit_faucet_2'],
    drainPipes: ['pipe_main_w', 'pipe_kit_w', 'pipe_kit_faucet_2_w'],
    type: 'faucet',
  },
  'restroom_shower': {
    outletKey: 'restroom_shower_outlet', drainKey: 'restroom_shower_drain',
    coldPipes: ['pipe_main', 'pipe_restroom', 'pipe_restroom_1', 'pipe_restroom_st', 'pipe_restroom_shower'],
    drainPipes: ['pipe_main_w', 'pipe_restroom_w', 'pipe_restroom_shower_w'],
    type: 'shower',
  },
  'restroom_toilet': {
    outletKey: 'restroom_toilet_outlet', drainKey: 'restroom_toilet_drain',
    drainRadius: 0.18,
    coldPipes: ['pipe_main', 'pipe_restroom', 'pipe_restroom_1', 'pipe_restroom_st', 'pipe_restroom_toilet'],
    drainPipes: ['pipe_restroom_toilet_w'],
    type: 'faucet',
  },
  'restroom_faucet': {
    outletKey: 'restroom_faucet_outlet', drainKey: 'restroom_faucet_drain',
    coldPipes: ['pipe_main', 'pipe_restroom', 'pipe_restroom_1', 'pipe_restroom_faucet'],
    drainPipes: ['pipe_main_w', 'pipe_restroom_w', 'pipe_restroom_faucet_w'],
    type: 'faucet',
  },
  'restroom_shower_2': {
    outletKey: 'restroom_shower_outlet_2', drainKey: 'restroom_shower_drain_2',
    coldPipes: ['pipe_main', 'pipe_restroom', 'pipe_restroom_2', 'pipe_restroom_st_2', 'pipe_restroom_shower_2'],
    drainPipes: ['pipe_restroom_w_2', 'pipe_restroom_shower_w_2'],
    type: 'shower',
  },
  'restroom_toilet_2': {
    outletKey: 'restroom_toilet_outlet_2', drainKey: 'restroom_toilet_drain_2',
    drainRadius: 0.10,
    coldPipes: ['pipe_main', 'pipe_restroom', 'pipe_restroom_2', 'pipe_restroom_st_2', 'pipe_restroom_toilet_2'],
    drainPipes: ['pipe_restroom_toilet_w_2'],
    type: 'faucet',
  },
  'restroom_faucet_2': {
    outletKey: 'restroom_faucet_outlet_2', drainKey: 'restroom_faucet_drain_2',
    coldPipes: ['pipe_main', 'pipe_restroom', 'pipe_restroom_2', 'pipe_restroom_faucet_2'],
    drainPipes: ['pipe_restroom_w_2', 'pipe_restroom_faucet_w_2'],
    type: 'faucet',
  },
};

export const SHARED_COLD_PIPES = new Set([
  'pipe_main', 'pipe_kit', 'pipe_restroom', 'pipe_restroom_1',
  'pipe_restroom_st', 'pipe_restroom_2', 'pipe_restroom_st_2',
]);
export const SHARED_WASTE_PIPES = new Set(['pipe_main_w', 'pipe_kit_w', 'pipe_restroom_w']);

export const DEVICE_LABEL = {
  'kit_faucet_1': '廚房水龍頭1',
  'kit_faucet_2': '廚房水龍頭2',
  'restroom_shower': '一樓浴室蓮蓬頭',
  'restroom_toilet': '一樓浴室馬桶',
  'restroom_faucet': '一樓浴室洗手台',
  'restroom_shower_2': '二樓浴室蓮蓬頭',
  'restroom_toilet_2': '二樓浴室馬桶',
  'restroom_faucet_2': '二樓室洗手台',
};

// ── 音效 ──
export const AUDIO_FILES = {
  faucet: 'audio/faucet_loop.ogg',
  shower: 'audio/shower_loop.ogg',
  swim: 'audio/swim.ogg',
  splash: 'audio/splash.ogg',
};
export const SWIM_SOUND_VOLUME = 0.5;
export const SWIM_LOOP_ENABLED = false;
export const SWIM_MOVE_THRESHOLD_SQ = 1e-6;

// ── 其他衍生常數 ──
export const SWITCH_HINT_DEVICES = Object.keys(PIPE_CONFIG);