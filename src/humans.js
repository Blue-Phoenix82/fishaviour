import * as THREE from 'three';
import { LAKE_RADIUS } from './world.js';

export const LURE_RADIUS = 9;
const CAST_TIME = 1.15;
const ROD_BASE_ANGLE = 1.02;
const ROD_LENGTH = 3.4;

const rand = (a, b) => a + Math.random() * (b - a);

const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a072, roughness: 0.85, flatShading: true });
const bootMat = new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.9, flatShading: true });
const rodMat = new THREE.MeshStandardMaterial({ color: 0x2f3a44, roughness: 0.5, metalness: 0.4 });
const lineMat = new THREE.LineBasicMaterial({ color: 0xe8f2f7, transparent: true, opacity: 0.55 });

function makeBody(spot) {
  const g = new THREE.Group();
  const jacketMat = new THREE.MeshStandardMaterial({ color: spot.color, roughness: 0.85, flatShading: true });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2f3b4a, roughness: 0.9, flatShading: true });
  const hatMat = new THREE.MeshStandardMaterial({ color: spot.hat, roughness: 0.8, flatShading: true });

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.62, 3, 6), pantsMat);
    leg.position.set(side * 0.16, 0.46, 0);
    leg.castShadow = true;
    g.add(leg);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.36), bootMat);
    boot.position.set(side * 0.16, 0.08, 0.05);
    boot.castShadow = true;
    g.add(boot);
  }

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.48, 4, 8), jacketMat);
  torso.position.y = 1.14;
  torso.castShadow = true;
  g.add(torso);

  // life vest stripe
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8), new THREE.MeshStandardMaterial({
    color: 0xffd15c, roughness: 0.7, flatShading: true,
  }));
  stripe.position.y = 1.16;
  g.add(stripe);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6), skinMat);
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.045, 10), hatMat);
  brim.position.y = 1.83;
  brim.castShadow = true;
  g.add(brim);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.18, 10), hatMat);
  crown.position.y = 1.93;
  crown.castShadow = true;
  g.add(crown);

  // arm holding the rod
  const armGroup = new THREE.Group();
  armGroup.position.set(0.34, 1.44, 0.02);
  armGroup.rotation.set(-0.85, 0, 0.3);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.58, 3, 6), jacketMat);
  arm.position.y = -0.32;
  arm.castShadow = true;
  armGroup.add(arm);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), skinMat);
  hand.position.y = -0.63;
  armGroup.add(hand);
  g.add(armGroup);

  // other arm, resting
  const arm2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.56, 3, 6), jacketMat);
  arm2.position.set(-0.36, 1.15, 0.04);
  arm2.rotation.z = -0.14;
  arm2.castShadow = true;
  g.add(arm2);

  // rod
  const rod = new THREE.Group();
  rod.position.set(0.46, 1.16, 0.34);
  rod.rotation.x = ROD_BASE_ANGLE;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.038, ROD_LENGTH, 5), rodMat);
  shaft.position.y = ROD_LENGTH / 2 - 0.5;
  rod.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 6), new THREE.MeshStandardMaterial({
    color: 0x7a4f36, roughness: 0.95,
  }));
  grip.position.y = -0.42;
  rod.add(grip);

  const tip = new THREE.Object3D();
  tip.position.y = ROD_LENGTH - 0.5;
  rod.add(tip);
  g.add(rod);

  return { group: g, rod, rodTip: tip, armGroup };
}

export class Human {
  constructor(scene, spot) {
    this.spot = spot;
    const built = makeBody(spot);
    this.group = built.group;
    this.rod = built.rod;
    this.rodTip = built.rodTip;
    this.armGroup = built.armGroup;

    const a = spot.angle;
    this.group.position.set(Math.cos(a) * spot.radius, 0, Math.sin(a) * spot.radius);
    this.group.lookAt(0, 0, 0);
    scene.add(this.group);

    // bobber: red float with white band
    this.bobber = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xff4433, roughness: 0.3, emissive: 0xaa2200, emissiveIntensity: 0.9 })
    );
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.185, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4f7f8, roughness: 0.4 })
    );
    this.bobber.add(red, band);
    this.bobber.visible = false;
    scene.add(this.bobber);

    // fishing line
    this.lineGeo = new THREE.BufferGeometry();
    this.linePositions = new Float32Array(6 * 3);
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    this.line = new THREE.Line(this.lineGeo, lineMat);
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);

    // ripple around the bobber
    const rippleGeo = new THREE.RingGeometry(0.32, 0.48, 24);
    rippleGeo.rotateX(-Math.PI / 2);
    this.ripple = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({
      color: 0xeaf7ff, transparent: true, opacity: 0.45,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.ripple.position.y = 0.07;
    this.ripple.visible = false;
    scene.add(this.ripple);

    const biteGeo = new THREE.RingGeometry(0.9, 1.0, 32);
    biteGeo.rotateX(-Math.PI / 2);
    this.biteRing = new THREE.Mesh(biteGeo, new THREE.MeshBasicMaterial({
      color: 0xff6a4a, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    this.biteRing.position.y = 0.08;
    this.biteRing.visible = false;
    scene.add(this.biteRing);

    this.bobberPos = new THREE.Vector3();
    this.castFrom = new THREE.Vector3();
    this.castTo = new THREE.Vector3();
    this.state = 'idle';
    this.timer = 0;
    this.castT = 0;
    this.phase = rand(0, Math.PI * 2);
    this.biting = false;
    this.biteProgress = 0;

    this.bait = {
      human: this,
      pos: this.bobberPos,
      lureRadius: LURE_RADIUS,
      active: false,
      claimedFish: null,
    };
  }

  reset() {
    this.state = 'wait';
    this.timer = rand(0.4, 2.2);
    this.bobber.visible = false;
    this.line.visible = false;
    this.ripple.visible = false;
    this.biteRing.visible = false;
    this.bait.active = false;
    this.bait.claimedFish = null;
    this.biting = false;
    this.biteProgress = 0;
    this.rod.rotation.x = ROD_BASE_ANGLE;
  }

  handleCatch() {
    if (this.state !== 'fishing') return;
    this.state = 'reeling';
    this.timer = 0;
    this.bait.active = false;
    this.bait.claimedFish = null;
    this.biting = false;
    this.biteProgress = 0;
    this.biteRing.visible = false;
  }

  beginCast(playerPos) {
    // pick a spot in the lake, away from the player and the other bobbers
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 16; attempt++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(Math.random()) * (LAKE_RADIUS - 4);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      const dPlayer = Math.hypot(x - playerPos.x, z - playerPos.z);
      if (dPlayer < 8.5) continue;
      break;
    }

    this.castTo.set(x, 0, z);
    this.group.updateMatrixWorld(true);
    this.rodTip.getWorldPosition(this.castFrom);

    this.bobber.visible = true;
    this.line.visible = true;
    this.ripple.visible = false;
    this.state = 'casting';
    this.castT = 0;
  }

  update(dt, ctx) {
    const { time, playerPos, active } = ctx;
    const biting = this.biting;
    const biteProgress = this.biteProgress;
    this.biting = false;
    this.biteProgress = 0;
    this.biteRing.visible = false;

    if (this.state === 'idle') {
      this.bobber.visible = false;
      this.line.visible = false;
      this.ripple.visible = false;
      return;
    }

    if (this.state === 'wait') {
      this.bobber.visible = false;
      this.line.visible = false;
      this.ripple.visible = false;
      this.rod.rotation.x += (ROD_BASE_ANGLE - this.rod.rotation.x) * (1 - Math.exp(-6 * dt));
      if (active) {
        this.timer -= dt;
        if (this.timer <= 0) this.beginCast(playerPos);
      }
      return;
    }

    if (this.state === 'casting') {
      this.castT += dt;
      const t = Math.min(1, this.castT / CAST_TIME);
      const ease = t * t * (3 - 2 * t);

      this.rod.rotation.x = ROD_BASE_ANGLE + Math.sin(t * Math.PI) * 0.55;

      this.bobberPos.lerpVectors(this.castFrom, this.castTo, ease);
      this.bobberPos.y = 0.12 + Math.sin(ease * Math.PI) * 4.2;
      this.bobber.position.copy(this.bobberPos);

      this.updateLine();
      this.ripple.visible = false;

      if (t >= 1) {
        this.state = 'fishing';
        this.bobberPos.y = 0.12;
        this.bait.active = true;
        this.ripple.visible = true;
        this.ripple.position.set(this.bobberPos.x, 0.07, this.bobberPos.z);
      }
      return;
    }

    if (this.state === 'fishing') {
      const dip = biting ? -0.16 - Math.abs(Math.sin(time * 15)) * 0.1 : 0;
      this.bobberPos.y = 0.12 + dip + Math.sin(time * 2.6 + this.phase) * 0.045
        + Math.sin(time * 9.1 + this.phase) * 0.012;
      this.bobber.position.copy(this.bobberPos);

      const pulse = (time * (biting ? 1.9 : 0.8) + this.phase) % 1;
      this.ripple.position.set(this.bobberPos.x, 0.07, this.bobberPos.z);
      this.ripple.scale.setScalar(1 + pulse * (biting ? 3.2 : 2.4));
      this.ripple.material.opacity = (biting ? 0.7 : 0.42) * (1 - pulse);

      if (biting) {
        const k = Math.min(1, Math.max(0, biteProgress));
        this.biteRing.visible = true;
        this.biteRing.position.set(this.bobberPos.x, 0.08, this.bobberPos.z);
        this.biteRing.scale.setScalar(3.6 - 2.7 * k);
        this.biteRing.material.opacity = 0.22 + 0.68 * k;
      }

      this.rod.rotation.x += (ROD_BASE_ANGLE + Math.sin(time * 1.4 + this.phase) * 0.02 - this.rod.rotation.x) * (1 - Math.exp(-5 * dt));
      this.updateLine();
      return;
    }

    if (this.state === 'reeling') {
      this.timer += dt;
      const k = Math.min(1, this.timer / 0.85);
      this.bobberPos.x += (this.castFrom.x - this.bobberPos.x) * k * dt * 3.2;
      this.bobberPos.z += (this.castFrom.z - this.bobberPos.z) * k * dt * 3.2;
      this.bobberPos.y = 0.12 + Math.sin(this.timer * 22) * 0.12 * (1 - k);
      this.bobber.position.copy(this.bobberPos);
      this.rod.rotation.x = ROD_BASE_ANGLE + 0.5 - k * 0.75;
      this.ripple.visible = false;
      this.updateLine();

      if (this.timer > 1.05) {
        this.state = 'wait';
        this.timer = rand(1.5, 2.8);
        this.bobber.visible = false;
        this.line.visible = false;
      }
    }
  }

  updateLine() {
    const p = this.linePositions;
    const from = this.castFrom;
    this.group.updateMatrixWorld(true);
    this.rodTip.getWorldPosition(from);
    const to = this.bobberPos;
    const sag = 0.35;
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = from.x + (to.x - from.x) * t;
      const z = from.z + (to.z - from.z) * t;
      const y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * sag;
      p[i * 3] = x;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = z;
    }
    this.lineGeo.attributes.position.needsUpdate = true;
    this.lineGeo.computeBoundingSphere();
  }
}
