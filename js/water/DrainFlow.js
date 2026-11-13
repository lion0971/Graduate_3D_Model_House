import * as THREE from 'three';

// 排水口漩渦粒子系統
export class DrainFlow {
  constructor(scene, drainPosition, radius = 0.6) {
    this.scene = scene;
    this.drainPosition = drainPosition.clone();
    this.radius = radius;
    this.active = false;
    this.count = 200;
    this.particles = [];
    this.fadeOpacity = 0;
    this.fadeDuration = 2.0;
    this.fadeElapsed = 0;
    this._build();
  }

  _build() {
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) this._initParticle(i, true);

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const mat = new THREE.PointsMaterial({
      size: this.radius * 0.038,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  _initParticle(i, randomStart = false) {
    // pow 指數 > 1：粒子集中在內圈，外圍稀疏
    const u = Math.random();
    const r = this.radius * Math.pow(u, 2.5);
    const spiralOffset = (r / this.radius) * Math.PI * 4;
    const angle = Math.random() * Math.PI * 2 - spiralOffset;

    this.particles[i] = {
      r,
      angle,
      baseSpeed: 0.6 + Math.random() * 0.8,
      driftSpeed: 0.0002 + Math.random() * 0.0003,
      life: randomStart ? Math.random() * 3.0 : 0,
      maxLife: 2.0 + Math.random() * 3.0,
    };

    this._updateColor(i);
    this._applyPosition(i);
  }

  // 中心偏亮白藍，外圈偏深藍
  _updateColor(i) {
    const p = this.particles[i];
    const t = 1.0 - (p.r / this.radius);
    this.colors[i * 3] = 0.25 + t * 0.65;
    this.colors[i * 3 + 1] = 0.60 + t * 0.38;
    this.colors[i * 3 + 2] = 1.0;
  }

  _applyPosition(i) {
    const p = this.particles[i];
    this.positions[i * 3] = this.drainPosition.x + Math.cos(p.angle) * p.r;
    this.positions[i * 3 + 1] = this.drainPosition.y;
    this.positions[i * 3 + 2] = this.drainPosition.z + Math.sin(p.angle) * p.r;
  }

  setActive(isActive) {
    this.active = isActive;
    this.points.visible = isActive;
    if (isActive) {
      this.fadeOpacity = 0;
      this.fadeElapsed = 0;
    }
  }

  update(delta) {
    if (!this.active) return;

    this.fadeElapsed += delta;
    this.fadeOpacity = Math.min(this.fadeElapsed / this.fadeDuration, 1.0);

    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      const omega = p.baseSpeed * Math.pow(this.radius / (p.r + 0.012), 2.2);
      p.angle += omega * delta;
      p.r -= p.driftSpeed * this.radius * delta;
      p.life += delta;

      if (p.life >= p.maxLife || p.r < 0.008) {
        this._initParticle(i, false);
      } else {
        this._updateColor(i);
        this._applyPosition(i);
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    const flicker = 0.78 + Math.sin(performance.now() * 0.004) * 0.15;
    this.points.material.opacity = flicker * this.fadeOpacity;
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}