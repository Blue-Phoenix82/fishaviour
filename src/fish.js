import * as THREE from 'three';

export const FISH_DEPTH = -1.5;
export const HOOK_RADIUS = 1.35;
const BITE_TIME = 1.35;
const RESPAWN_DELAY = 6;

const PALETTE = [
  0x5ed3cb, 0x6fa8dc, 0xf2b25c, 0xc7d86a, 0xe08fb5,
  0x9ad0ec, 0xff9a76, 0x8f7ae0, 0x7fd6a0, 0xb9c7d6,
];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

const shortestAngle = (from, to) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/* ------------------------------- fish model ------------------------------- */

const bodyGeo = new THREE.SphereGeometry(0.4, 9, 7);
const tailGeo = new THREE.ConeGeometry(0.36, 0.72, 4);
const finGeo = new THREE.ConeGeometry(0.2, 0.34, 4);
const eyeGeo = new THREE.SphereGeometry(0.062, 6, 4);
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.35 });

let markerTexture = null;
function getMarkerTexture() {
  if (markerTexture) return markerTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb020';
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#42250a';
  ctx.stroke();
  ctx.fillStyle = '#2b1705';
  ctx.font = 'bold 78px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 64, 70);
  markerTexture = new THREE.CanvasTexture(canvas);
  markerTexture.colorSpace = THREE.SRGBColorSpace;
  return markerTexture;
}

/**
 * Low-poly fish facing +X. Returns { group, bodyMat, tail, finMat }.
 */
export function createFishMesh(color) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.42, metalness: 0.12, flatShading: true,
    emissive: 0xffe6a8, emissiveIntensity: 0,
  });
  const finColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.48);
  const finMat = new THREE.MeshStandardMaterial({
    color: finColor, roughness: 0.6, metalness: 0.05,
    flatShading: true, side: THREE.DoubleSide,
  });

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(2.05, 0.95, 0.6);
  body.castShadow = false;
  group.add(body);

  // tail (flaps on Y)
  const tail = new THREE.Group();
  tail.position.x = -0.72;
  const tailFin = new THREE.Mesh(tailGeo, finMat);
  tailFin.rotation.z = -Math.PI / 2;
  tailFin.position.x = -0.3;
  tailFin.scale.z = 0.22;
  tail.add(tailFin);
  group.add(tail);

  // dorsal fin
  const dorsal = new THREE.Mesh(finGeo, finMat);
  dorsal.position.set(-0.1, 0.4, 0);
  dorsal.scale.set(1.9, 1.15, 0.18);
  dorsal.rotation.z = -0.28;
  group.add(dorsal);

  // pectoral fins
  for (const side of [-1, 1]) {
    const pectoral = new THREE.Mesh(finGeo, finMat);
    pectoral.position.set(0.3, -0.08, side * 0.26);
    pectoral.rotation.z = 1.9;
    pectoral.rotation.x = side * 0.5;
    pectoral.scale.set(0.9, 0.75, 0.16);
    group.add(pectoral);
  }

  // eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.56, 0.1, side * 0.16);
    group.add(eye);
  }

  return { group, bodyMat, tail, finMat };
}

/* --------------------------------- a fish --------------------------------- */

export class Fish {
  constructor(scene, color) {
    const built = createFishMesh(color);
    this.mesh = built.group;
    this.bodyMat = built.bodyMat;
    this.tail = built.tail;
    this.baseScale = rand(0.82, 1.18);
    this.mesh.scale.setScalar(this.baseScale);

    this.vel = new THREE.Vector3();
    this.wander = new THREE.Vector3();
    this.wanderTimer = 0;
    this.phase = rand(0, Math.PI * 2);
    this.speedBase = rand(2.5, 3.7);
    this.heading = rand(0, Math.PI * 2);
    this.state = 'swim';
    this.ignoreBait = 0;
    this.lureSpeed = rand(4.4, 5.4);
    this.flash = 0;
    this.lured = false;
    this.bait = null;
    this.biting = false;
    this.biteTimer = 0;
    this.justBit = false;
    this.pushLock = 0;
    this.catchT = 0;
    this.catchFrom = new THREE.Vector3();
    this.catchTo = new THREE.Vector3();
    this.respawnIn = 0;
    this.spawnAnim = 0;
    this.biteHuman = null;

    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getMarkerTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    }));
    this.marker.position.y = 2.4;
    this.marker.scale.setScalar(0.9);
    this.marker.visible = false;
    this.mesh.add(this.marker);

    this.spawn(6 + Math.random() * 16);
    scene.add(this.mesh);
  }

  spawn(minR = 6, maxR = 22) {
    const a = rand(0, Math.PI * 2);
    const r = rand(minR, maxR);
    this.mesh.position.set(Math.cos(a) * r, FISH_DEPTH, Math.sin(a) * r);
    this.vel.set(0, 0, 0);
    this.state = 'swim';
    this.retargetWander();
    this.wanderTimer = rand(1.5, 4.5);
    this.ignoreBait = 0;
    this.spawnAnim = 0.65;
    this.flash = 0;
    this.lured = false;
    this.bait = null;
    this.biting = false;
    this.biteTimer = 0;
    this.justBit = false;
    this.pushLock = 0;
    this.marker.visible = false;
    this.mesh.visible = true;
  }

  retargetWander() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 20;
    this.wander.set(Math.cos(a) * r, FISH_DEPTH, Math.sin(a) * r);
  }

  push(dir, strength) {
    this.state = 'swim';
    this.vel.copy(dir).multiplyScalar(strength);
    this.ignoreBait = 10;
    this.flash = 1;
    this.biting = false;
    this.biteTimer = 0;
    this.bait = null;
    this.wander.set(
      this.mesh.position.x + dir.x * rand(7, 11),
      FISH_DEPTH,
      this.mesh.position.z + dir.z * rand(7, 11)
    );
    this.wanderTimer = rand(2.5, 4);
    this.spawnAnim = 0;
  }

  beginCatch(human, baitPos) {
    this.state = 'caught';
    this.catchT = 0;
    this.biteHuman = human;
    this.catchFrom.copy(this.mesh.position);
    this.catchTo.set(baitPos.x, 0.9, baitPos.z);
    this.vel.set(0, 0, 0);
    this.lured = false;
    this.biting = false;
    this.marker.visible = false;
  }

  update(dt, ctx) {
    const m = this.mesh;

    if (this.state === 'gone') {
      this.respawnIn -= dt;
      if (this.respawnIn <= 0) {
        this.spawn(8, 22);
      }
      return;
    }

    if (this.state === 'caught') {
      this.catchT += dt;
      const k = Math.min(1, this.catchT / 0.32);
      const e = 1 - Math.pow(1 - k, 3);
      m.position.lerpVectors(this.catchFrom, this.catchTo, e);
      if (this.catchT > 0.32) {
        const up = Math.min(1, (this.catchT - 0.32) / 0.45);
        m.position.y = 0.9 + up * up * 3.2;
        m.rotation.z += dt * 9;
        m.rotation.x += dt * 5;
      }
      this.tail.rotation.y = Math.sin(this.catchT * 30) * 0.7;
      if (this.catchT > 0.85) {
        m.visible = false;
        m.rotation.set(0, 0, 0);
        this.state = 'gone';
        this.respawnIn = RESPAWN_DELAY;
      }
      return;
    }

    if (this.spawnAnim > 0) {
      this.spawnAnim = Math.max(0, this.spawnAnim - dt);
      const k = 1 - this.spawnAnim / 0.65;
      m.scale.setScalar(this.baseScale * (0.35 + 0.65 * k));
    }

    this.ignoreBait = Math.max(0, this.ignoreBait - dt);
    this.pushLock = Math.max(0, this.pushLock - dt);

    const pos = m.position;
    let speed = this.speedBase;
    let target = null;
    let baited = false;

    const bait = this.bait;
    if (bait && bait.active && this.ignoreBait <= 0) {
      baited = true;
      this.lured = true;
      const dist = Math.hypot(bait.pos.x - pos.x, bait.pos.z - pos.z);

      if (this.biting) {
        if (bait.human) bait.human.biting = true;
        if (dist > HOOK_RADIUS + 1.6) {
          this.biting = false;
          this.biteTimer = 0;
        } else {
          this.biteTimer -= dt;
          if (bait.human) bait.human.biteProgress = 1 - Math.max(0, this.biteTimer) / BITE_TIME;
          speed = 1.1;
          if (this.biteTimer <= 0) {
            this.beginCatch(bait.human, bait.pos);
            ctx.onCatch(this, bait.human);
            return;
          }
        }
      } else if (dist < HOOK_RADIUS + 0.6) {
        this.biting = true;
        this.biteTimer = BITE_TIME;
        this.justBit = true;
        speed = 1.1;
      } else {
        speed = this.lureSpeed;
      }
      target = bait;
    } else {
      this.lured = false;
      this.biting = false;
    }

    this.marker.visible = this.lured;
    if (this.lured) {
      const beat = 0.5 + 0.5 * Math.sin(ctx.time * (this.biting ? 14 : 6) + this.phase);
      this.marker.scale.setScalar((this.biting ? 1.45 : 1.05) * (1 + beat * 0.14));
      this.marker.position.y = 2.4 + Math.sin(ctx.time * 3 + this.phase) * 0.12;
      this.marker.material.opacity = 0.7 + beat * 0.3;
    }

    if (!baited) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.retargetWander();
        this.wanderTimer = rand(2.5, 5.5);
      }
      target = { pos: this.wander };
    }

    // steering
    let tx = target.pos.x - pos.x;
    let tz = target.pos.z - pos.z;
    let tlen = Math.hypot(tx, tz);
    if (tlen < 0.001) { tx = 1; tz = 0; tlen = 1; }
    tx /= tlen; tz /= tlen;

    let desiredX = tx * speed;
    let desiredZ = tz * speed;

    // keep the school from stacking up
    for (const other of ctx.fish) {
      if (other === this || other.state === 'gone' || other.state === 'caught') continue;
      const dx = pos.x - other.mesh.position.x;
      const dz = pos.z - other.mesh.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.44 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const w = (1.2 - d) * 4.5;
        desiredX += (dx / d) * w;
        desiredZ += (dz / d) * w;
      }
    }

    // stay in the lake
    const fromCenter = Math.hypot(pos.x, pos.z);
    if (fromCenter > ctx.lakeRadius - 3) {
      const w = (fromCenter - (ctx.lakeRadius - 3)) * 2.6;
      desiredX -= (pos.x / fromCenter) * w;
      desiredZ -= (pos.z / fromCenter) * w;
    }

    const accel = baited ? 3.4 : 2.2;
    const k = 1 - Math.exp(-accel * dt);
    const desired = ctx.tmp.set(desiredX, 0, desiredZ);
    this.vel.x += (desired.x - this.vel.x) * k;
    this.vel.z += (desired.z - this.vel.z) * k;

    pos.x += this.vel.x * dt;
    pos.z += this.vel.z * dt;

    const clamped = Math.min(Math.hypot(pos.x, pos.z), ctx.lakeRadius - 1.2);
    if (clamped > 0) {
      const len = Math.hypot(pos.x, pos.z) || 1;
      pos.x = (pos.x / len) * clamped;
      pos.z = (pos.z / len) * clamped;
    }

    // heading + bobbing
    const vlen = Math.hypot(this.vel.x, this.vel.z);
    if (vlen > 0.25) {
      const want = -Math.atan2(this.vel.z, this.vel.x);
      this.heading += shortestAngle(this.heading, want) * (1 - Math.exp(-9 * dt));
    }
    m.rotation.y = this.heading;
    pos.y = FISH_DEPTH + Math.sin(ctx.time * 2 + this.phase) * 0.075;

    // tail wag + threat glow
    const wag = 5 + vlen * 1.6;
    this.tail.rotation.y = Math.sin(ctx.time * wag + this.phase) * 0.5;

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
    if (this.flash > 0.01) {
      this.bodyMat.emissive.setHex(0xffe6a8);
      this.bodyMat.emissiveIntensity = this.flash * 0.9;
    } else if (this.lured) {
      this.bodyMat.emissive.setHex(0xff6a00);
      this.bodyMat.emissiveIntensity = 0.28 + 0.22 * (0.5 + 0.5 * Math.sin(ctx.time * 9 + this.phase));
    } else if (this.bodyMat.emissiveIntensity > 0) {
      this.bodyMat.emissiveIntensity = Math.max(0, this.bodyMat.emissiveIntensity - dt * 2);
    }
  }
}

/* --------------------------------- school --------------------------------- */

export class School {
  constructor(scene, count, onCatch) {
    this.scene = scene;
    this.onCatch = onCatch;
    this.fish = [];
    this.tmp = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      this.fish.push(new Fish(scene, pick(PALETTE)));
    }
  }

  reset() {
    for (const f of this.fish) {
      f.mesh.visible = true;
      f.mesh.rotation.set(0, 0, 0);
      f.spawn(5, 22);
      f.ignoreBait = rand(0, 1.5);
    }
  }

  update(dt, ctx) {
    const c = {
      time: ctx.time,
      fish: this.fish,
      baits: ctx.baits,
      lakeRadius: ctx.lakeRadius,
      tmp: this.tmp,
      onCatch: this.onCatch,
    };

    // Each bobber can only tempt one fish at a time, so the player always has
    // a readable number of fish to rescue (at most one per human).
    const baits = ctx.baits;
    const claimed = new Set();

    for (const bait of baits) {
      const f = bait.claimedFish;
      if (!bait.active || !f) { bait.claimedFish = null; continue; }
      const d = Math.hypot(f.mesh.position.x - bait.pos.x, f.mesh.position.z - bait.pos.z);
      if (f.state !== 'swim' || f.ignoreBait > 0 || claimed.has(f) || d > bait.lureRadius * 1.8) {
        bait.claimedFish = null;
        continue;
      }
      claimed.add(f);
    }

    for (const bait of baits) {
      if (!bait.active || bait.claimedFish) continue;
      let best = null;
      let bestD = bait.lureRadius;
      for (const f of this.fish) {
        if (f.state !== 'swim' || f.ignoreBait > 0 || claimed.has(f)) continue;
        const d = Math.hypot(f.mesh.position.x - bait.pos.x, f.mesh.position.z - bait.pos.z);
        if (d < bestD) { bestD = d; best = f; }
      }
      if (best) {
        bait.claimedFish = best;
        claimed.add(best);
      }
    }

    for (const f of this.fish) f.bait = null;
    for (const bait of baits) {
      if (bait.claimedFish) bait.claimedFish.bait = bait;
    }

    for (const f of this.fish) {
      f.update(dt, c);
      if (f.justBit) {
        f.justBit = false;
        ctx.onBite?.(f);
      }
    }
  }
}
