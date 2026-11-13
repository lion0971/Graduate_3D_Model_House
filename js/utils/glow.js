import * as THREE from 'three';

// 圓錐體體積光 Shader（一般燈泡的光柱）
export function createConeVolumetricLight(color) {
  const h = 3.2;
  const geo = new THREE.ConeGeometry(0.55, h, 32, 1, true);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uHeight: { value: h }
    },
    vertexShader: `
      varying float vY; varying vec3 vNormal, vViewDir;
      void main() {
        vY = position.y;
        vec4 wp = modelMatrix * vec4(position,1.0);
        vNormal  = normalize(normalMatrix * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uHeight;
      varying float vY; varying vec3 vNormal, vViewDir;
      void main() {
        float tF = smoothstep(uHeight/2.0, uHeight/2.0-0.6, vY);
        float bF = smoothstep(-uHeight/2.0, -uHeight/2.0+1.8, vY);
        float rF = smoothstep(0.0, 0.4, abs(dot(vNormal,vViewDir)));
        gl_FragColor = vec4(uColor, 0.22*tF*bF*rF);
      }`,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -h / 2;
  return mesh;
}

// 徑向漸層光暈貼圖（快取，只建立一次）
let _radialGlowTexture = null;
export function getRadialGlowTexture() {
  if (_radialGlowTexture) return _radialGlowTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0.0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(255,235,200,0.95)');
  gradient.addColorStop(0.35, 'rgba(255,204,136,0.45)');
  gradient.addColorStop(0.65, 'rgba(255,204,136,0.12)');
  gradient.addColorStop(1.0, 'rgba(255,204,136,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  _radialGlowTexture = new THREE.CanvasTexture(canvas);
  return _radialGlowTexture;
}