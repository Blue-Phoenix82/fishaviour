import * as THREE from 'three';
import { LAKE_RADIUS, HUMAN_SPOTS, createWorld } from './world.js';
import { School } from './fish.js';
import { Player } from './player.js';
import { Human } from './humans.js';
import { audio } from './audio.js';

const ROUND_TIME = 60;
const FISH_COUNT = 30;
const BEST_KEY = 'fishaviour.best.v1';

const tmpTarget = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

export class Game {
  constructor({ renderer, camera, scene }) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;
    this.world = createWorld(scene);

    this.player = new Player(scene);
    this.humans = HUMAN_SPOTS.map(spot => new Human(scene, spot));
    this.baits = this.humans.map(h => h.bait);
    this.school = new School(scene, FISH_COUNT, (fish, human) => this.onFishCaught(fish, human));

    this.clock = new THREE.Clock();
    this.time = 0;
    this.state = 'menu';
    this.keys = new Set();
    this.timer = ROUND_TIME;
    this.caught = 0;
    this.pushes = 0;
    this.shake = 0;
    this.lastShown = ROUND_TIME;
    this.effects = [];
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.best = this.loadBest();

    this.ringGeo = new THREE.RingGeometry(0.55, 0.72, 36);
    this.ringGeo.rotateX(-Math.PI / 2);

    this.cacheDom();
    this.bindUi();
    this.bindInput();
    this.refreshBestLines();

    this.camera.position.set(38, 16, 0);
    this.camera.lookAt(0, 0, 0);

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* --------------------------------- setup -------------------------------- */

  cacheDom() {
    const $ = id => document.getElementById(id);
    this.hud = $('hud');
    this.overlay = $('overlay');
    this.timerEl = $('timer');
    this.timerCard = $('timerCard');
    this.caughtEl = $('caught');
    this.caughtCard = $('caughtCard');
    this.panelMenu = $('panel-menu');
    this.panelPause = $('panel-pause');
    this.panelOver = $('panel-over');
    this.bestline = $('bestline');
    this.bestline2 = $('bestline2');
    this.overCaught = $('overCaught');
    this.overPushes = $('overPushes');
    this.overVerdict = $('overVerdict');
    this.overTag = $('overTag');
  }

  bindUi() {
    document.getElementById('btn-start').addEventListener('click', () => this.startRound());
    document.getElementById('btn-resume').addEventListener('click', () => this.resume());
    document.getElementById('btn-restart-pause').addEventListener('click', () => this.startRound());
    document.getElementById('btn-again').addEventListener('click', () => this.startRound());
  }

  bindInput() {
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      this.keys.add(k);

      if (k === 'escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        return;
      }
      if ((k === 'enter' || k === ' ') && (this.state === 'menu' || this.state === 'over')) {
        this.startRound();
      }
    });

    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      if (this.state === 'playing') this.pause();
    });
  }

  /* ------------------------------- game flow ------------------------------- */

  startRound() {
    audio.init();
    audio.start();
    this.state = 'playing';
    this.timer = ROUND_TIME;
    this.lastShown = ROUND_TIME;
    this.caught = 0;
    this.pushes = 0;
    this.shake = 0;
    this.keys.clear();
    this.player.reset();
    this.school.reset();
    for (const h of this.humans) h.reset();
    this.clearEffects();

    this.timerEl.textContent = String(ROUND_TIME);
    this.timerCard.classList.remove('warn');
    this.caughtEl.textContent = '0';
    this.hud.classList.remove('hidden');
    this.hideOverlay();
  }

  endRound() {
    this.state = 'over';
    this.keys.clear();
    audio.end();

    const prev = this.best;
    if (!prev || this.caught < prev.caught || (this.caught === prev.caught && this.pushes > prev.pushes)) {
      this.best = { caught: this.caught, pushes: this.pushes };
      try { localStorage.setItem(BEST_KEY, JSON.stringify(this.best)); } catch { /* ignore */ }
    }
    this.refreshBestLines();

    this.overCaught.textContent = String(this.caught);
    this.overPushes.textContent = String(this.pushes);

    let verdict;
    if (this.caught === 0) verdict = 'Not one fish lost. The humans go home hungry.';
    else if (this.caught <= 2) verdict = 'Excellent work — the school is almost untouched.';
    else if (this.caught <= 6) verdict = 'A decent rescue. A few friends got careless.';
    else if (this.caught <= 12) verdict = 'The humans had a good day out there.';
    else if (this.caught <= 20) verdict = 'Rough day on the lake. Try herding them early.';
    else verdict = 'The humans are eating well tonight.';

    this.overVerdict.textContent = verdict;
    this.overTag.textContent = this.caught <= 2 ? 'A quiet, safe lake.' : 'The humans pack up and head home.';

    this.showPanel(this.panelOver);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.keys.clear();
    this.showPanel(this.panelPause);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.classList.remove('hidden');
    this.hideOverlay();
    this.clock.getDelta();
  }

  /* --------------------------------- events -------------------------------- */

  onFishCaught(fish, human) {
    if (this.state !== 'playing') return;
    this.caught++;
    this.caughtEl.textContent = String(this.caught);
    this.caughtCard.classList.remove('flash');
    void this.caughtCard.offsetWidth;
    this.caughtCard.classList.add('flash');

    human.handleCatch();
    this.addRing(fish.mesh.position.x, fish.mesh.position.z, 0xff8a6b, 1.2);
    this.addRing(human.bobberPos.x, human.bobberPos.z, 0xffd6a0, 1);
    this.shake = Math.min(0.5, this.shake + 0.2);
    audio.catch();
  }

  onFishBite(fish) {
    if (this.state !== 'playing') return;
    this.addRing(fish.mesh.position.x, fish.mesh.position.z, 0xffc247, 0.6);
    audio.bite();
  }

  handlePushes() {
    const p = this.player.mesh.position;
    const pSpeed = this.player.speed || 0;

    for (const fish of this.school.fish) {
      if (fish.state !== 'swim' || fish.pushLock > 0) continue;
      const f = fish.mesh.position;
      const dx = f.x - p.x;
      const dz = f.z - p.z;
      const d2 = dx * dx + dz * dz;
      const reach = this.player.radius + 0.55;
      if (d2 > reach * reach) continue;

      const d = Math.sqrt(d2) || 1;
      const dir = tmpTarget.set(dx / d, 0, dz / d);
      if (d2 < 0.0001) {
        dir.set(-Math.sin(this.player.heading), 0, Math.cos(this.player.heading)).multiplyScalar(-1);
      }

      const strength = Math.min(17, 7 + pSpeed * 0.8);
      const wasLured = fish.lured;
      fish.push(dir, strength);
      fish.pushLock = 0.55;

      if (wasLured) {
        this.pushes++;
        this.addRing(f.x, f.z, 0x9df0c8, 0.9);
        this.shake = Math.min(0.35, this.shake + 0.08);
        audio.push();
      } else {
        this.addRing(f.x, f.z, 0xcfeaff, 0.55);
        audio.whoosh(0.1);
      }
    }
  }

  /* -------------------------------- effects -------------------------------- */

  addRing(x, z, color, scale = 1) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(x, 0.09, z);
    mesh.scale.setScalar(0.6 * scale);
    this.scene.add(mesh);
    this.effects.push({ mesh, age: 0, life: 0.8, growth: 4.5 * scale });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dt;
      const k = e.age / e.life;
      if (k >= 1) {
        this.scene.remove(e.mesh);
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
        continue;
      }
      e.mesh.scale.setScalar(0.6 + k * e.growth);
      e.mesh.material.opacity = 0.8 * Math.pow(1 - k, 1.4);
    }
  }

  clearEffects() {
    for (const e of this.effects) {
      this.scene.remove(e.mesh);
      e.mesh.material.dispose();
    }
    this.effects.length = 0;
  }

  /* ---------------------------------- hud ---------------------------------- */

  refreshBestLines() {
    const text = this.best
      ? `Best run: ${this.best.caught} fish caught`
      : 'No record yet — set the standard.';
    this.bestline.textContent = text;
    this.bestline2.textContent = text;
  }

  tickTimer(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      this.timerEl.textContent = '0';
      this.endRound();
      return;
    }
    const shown = Math.ceil(this.timer);
    if (shown !== this.lastShown) {
      this.lastShown = shown;
      this.timerEl.textContent = String(shown);
      this.timerCard.classList.toggle('warn', shown <= 10);
      if (shown <= 10) audio.tick();
    }
  }

  loadBest() {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.caught !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /* --------------------------------- screens -------------------------------- */

  showPanel(panel) {
    this.overlay.classList.remove('hidden');
    for (const p of [this.panelMenu, this.panelPause, this.panelOver]) {
      p.classList.toggle('hidden', p !== panel);
    }
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }

  /* ---------------------------------- loop ---------------------------------- */

  updateCamera(dt) {
    if (this.state === 'menu') {
      const a = this.time * 0.07;
      tmpTarget.set(Math.cos(a) * 38, 16, Math.sin(a) * 38);
      this.camera.position.lerp(tmpTarget, 1 - Math.exp(-1.5 * dt));
      this.camLook.lerp(tmpLook.set(0, 0, 0), 1 - Math.exp(-2 * dt));
      this.camera.lookAt(this.camLook);
      return;
    }

    const p = this.player.mesh.position;
    tmpTarget.set(p.x * 0.96, p.y + 17, p.z + 21);
    this.camera.position.lerp(tmpTarget, 1 - Math.exp(-5 * dt));
    tmpLook.set(p.x, p.y + 0.6, p.z - 2);
    this.camLook.lerp(tmpLook, 1 - Math.exp(-7 * dt));
    this.camera.lookAt(this.camLook);

    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.world.updateWater(this.time);

    if (this.state === 'playing') {
      this.player.update(dt, this.keys, this.time);
      const playerPos = this.player.mesh.position;
      for (const h of this.humans) {
        h.update(dt, { time: this.time, playerPos, active: true });
      }
      this.school.update(dt, {
        time: this.time,
        baits: this.baits,
        lakeRadius: LAKE_RADIUS,
        onBite: fish => this.onFishBite(fish),
      });
      this.handlePushes();
      this.updateEffects(dt);
      this.tickTimer(dt);
    } else if (this.state === 'menu') {
      this.school.update(dt, {
        time: this.time,
        baits: this.baits,
        lakeRadius: LAKE_RADIUS,
        onBite: fish => this.onFishBite(fish),
      });
      this.player.tail.rotation.y = Math.sin(this.time * 4) * 0.28;
      this.player.mesh.position.y = -1.15 + Math.sin(this.time * 1.8) * 0.07;
    }

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
