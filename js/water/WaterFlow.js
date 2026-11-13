import * as THREE from 'three';

// 出水口的水柱粒子系統（faucet 細流 / shower 大水柱）
export class WaterFlow {
  constructor(scene, emitPosition, type = 'faucet') {
    this.scene = scene;
    this.emitPosition = emitPosition.clone();
    this.type = type;
    this.active = false;
    this.count = type === 'shower' ? 150 : 80;
    this.velocities = [];
    this.lifetimes = [];
    this._build();
  }

  _build() {
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const initJitter = this.type === 'shower' ? 0.01 : 0.006;
      this.positions[i * 3] = this.emitPosition.x + (Math.random() - 0.5) * initJitter;
      this.positions[i * 3 + 1] = this.emitPosition.y;
      this.positions[i * 3 + 2] = this.emitPosition.z + (Math.random() - 0.5) * initJitter;

      const b = 0.7 + Math.random() * 0.3;
      colors[i * 3] = 0.3 * b;
      colors[i * 3 + 1] = 0.75 * b;
      colors[i * 3 + 2] = 1.0 * b;

      const maxLifeForInit = this.type === 'faucet' ? 0.4 : 1.4;
      this.lifetimes[i] = Math.random() * maxLifeForInit;
      this._resetVelocity(i);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: this.type === 'shower' ? 0.025 : 0.015,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.visible = false;
    this.points.renderOrder = 10;
    // 粒子會飄散，關閉 frustum culling 避免整組被誤剔除
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  _resetVelocity(i) {
    if (this.type === 'faucet') {
      this.velocities[i] = new THREE.Vector3(
        (Math.random() - 0.5) * 0.015,
        -(0.025 + Math.random() * 0.015),
        (Math.random() - 0.5) * 0.015
      );
    } else {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.010 + Math.random() * 0.03;
      this.velocities[i] = new THREE.Vector3(
        Math.cos(angle) * radius,
        -(0.02 + Math.random() * 0.02),
        Math.sin(angle) * radius
      );
    }
  }

  _resetParticle(i) {
    const jitter = this.type === 'shower' ? 0.015 : 0.01;
    this.positions[i * 3] = this.emitPosition.x + (Math.random() - 0.5) * jitter;
    this.positions[i * 3 + 1] = this.emitPosition.y;
    this.positions[i * 3 + 2] = this.emitPosition.z + (Math.random() - 0.5) * jitter;
    this.lifetimes[i] = 0;
    this._resetVelocity(i);
  }

  setActive(isActive) {
    this.active = isActive;
    this.points.visible = isActive;
  }

  update(delta) {
    if (!this.active) return;
    const gravity = -0.002;
    const maxLife = this.type === 'faucet' ? 0.3 : 1.4;

    for (let i = 0; i < this.count; i++) {
      this.lifetimes[i] += delta;
      if (this.lifetimes[i] > maxLife) { this._resetParticle(i); continue; }
      this.velocities[i].y += gravity * delta * 60;
      this.positions[i * 3] += this.velocities[i].x;
      this.positions[i * 3 + 1] += this.velocities[i].y;
      this.positions[i * 3 + 2] += this.velocities[i].z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.material.opacity = 0.75 + Math.sin(performance.now() * 0.003) * 0.1;
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}