import * as THREE from 'three';
import { createFishMesh } from './fish.js';
import { LAKE_RADIUS } from './world.js';

const PLAYER_DEPTH = -1.15;
const MAX_SPEED = 12.5;
const SPRINT_SPEED = 18.5;

const shortestAngle = (from, to) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export class Player {
  constructor(scene) {
    const built = createFishMesh(0xffa63c);
    this.mesh = built.group;
    this.mesh.scale.setScalar(1.7);
    this.bodyMat = built.bodyMat;
    this.tail = built.tail;
    this.baseScale = 1.7;

    // the player is the one fish you must never lose: warm glow + white saddle
    this.bodyMat.color.set(0xff8b2e);
    this.bodyMat.emissive.set(0xff5a00);
    this.bodyMat.emissiveIntensity = 0.3;
    built.finMat.color.set(0xfff0d4);

    const saddleMat = new THREE.MeshStandardMaterial({
      color: 0xfff3dc, roughness: 0.5,
      emissive: 0xffb066, emissiveIntensity: 0.35,
    });
    const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 7), saddleMat);
    saddle.scale.set(1.15, 0.3, 0.36);
    saddle.position.set(0.12, 0.3, 0);
    this.mesh.add(saddle);

    this.heading = -Math.PI / 2;
    this.vel = new THREE.Vector3();
    this.radius = 2.05;
    this.phase = 0;
    this.bank = 0;
    this.moving = false;
    this.trail = 0;
    scene.add(this.mesh);
    this.reset();
  }

  reset() {
    this.mesh.position.set(0, PLAYER_DEPTH, 8);
    this.mesh.rotation.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    this.heading = -Math.PI / 2;
    this.bank = 0;
  }

  update(dt, input, time) {
    const right = (input.has('d') || input.has('arrowright') ? 1 : 0) -
                  (input.has('a') || input.has('arrowleft') ? 1 : 0);
    const down = (input.has('s') || input.has('arrowdown') ? 1 : 0) -
                 (input.has('w') || input.has('arrowup') ? 1 : 0);
    const sprint = input.has('shift') || input.has('shiftleft') || input.has('shiftright');
    const maxSpeed = sprint ? SPRINT_SPEED : MAX_SPEED;

    let ax = 0;
    let az = 0;
    const len = Math.hypot(right, down);
    if (len > 0) {
      ax = (right / len) * maxSpeed;
      az = (down / len) * maxSpeed;
      this.moving = true;
    } else {
      this.moving = false;
    }

    const accel = len > 0 ? (sprint ? 8 : 6) : 4.2;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (ax - this.vel.x) * k;
    this.vel.z += (az - this.vel.z) * k;

    const pos = this.mesh.position;
    pos.x += this.vel.x * dt;
    pos.z += this.vel.z * dt;

    const d = Math.hypot(pos.x, pos.z);
    const maxR = LAKE_RADIUS - 1.3;
    if (d > maxR) {
      pos.x = (pos.x / d) * maxR;
      pos.z = (pos.z / d) * maxR;
      this.vel.multiplyScalar(0.55);
    }

    const speed = Math.hypot(this.vel.x, this.vel.z);
    let turn = 0;
    if (speed > 0.4) {
      const want = -Math.atan2(this.vel.z, this.vel.x);
      const delta = shortestAngle(this.heading, want);
      turn = delta;
      this.heading += delta * (1 - Math.exp(-10 * dt));
    }
    this.mesh.rotation.y = this.heading;

    const targetBank = THREE.MathUtils.clamp(turn * speed * 0.05, -0.55, 0.55);
    this.bank += (targetBank - this.bank) * (1 - Math.exp(-8 * dt));
    this.mesh.rotation.z = this.bank;

    pos.y = PLAYER_DEPTH + Math.sin(time * 2.2) * 0.06;
    this.tail.rotation.y = Math.sin(time * (6 + speed * 1.5)) * 0.55;
    this.speed = speed;
  }
}
