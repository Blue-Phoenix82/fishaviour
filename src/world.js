import * as THREE from 'three';

export const LAKE_RADIUS = 26;
export const WATER_Y = 0;

const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------------------------- sky ---------------------------------- */

function createSky(scene) {
  const geo = new THREE.SphereGeometry(420, 32, 20);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x2d6fb5) },
      horizonColor: { value: new THREE.Color(0xd7ecf5) },
      exponent: { value: 0.8 },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform float exponent;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        float t = pow(max(h, 0.0), exponent);
        vec3 col = mix(horizonColor, topColor, t);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);

  // sun disc + glow
  const sunDir = new THREE.Vector3(-0.55, 0.52, -0.65).normalize();
  const sunPos = sunDir.clone().multiplyScalar(330);
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(12, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff6d2, fog: false })
  );
  sun.position.copy(sunPos);
  scene.add(sun);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(26, 20, 14),
    new THREE.MeshBasicMaterial({
      color: 0xffe9ab, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    })
  );
  glow.position.copy(sunPos);
  scene.add(glow);

  return sunDir;
}

function createClouds(scene) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, metalness: 0,
    flatShading: true, emissive: 0x93b8cc, emissiveIntensity: 0.22,
  });
  const puffGeo = new THREE.SphereGeometry(1, 8, 6);

  for (let i = 0; i < 11; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, mat);
      puff.position.set(p * 7 + rand(-3, 3), rand(-1.5, 1.5), rand(-3, 3));
      const s = rand(5, 10);
      puff.scale.set(s, s * 0.62, s);
      cloud.add(puff);
    }
    const a = rand(0, Math.PI * 2);
    const r = rand(150, 300);
    cloud.position.set(Math.cos(a) * r, rand(58, 110), Math.sin(a) * r);
    cloud.rotation.y = rand(0, Math.PI);
    scene.add(cloud);
  }
}

function createDistantHills(scene) {
  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x5b7f68, roughness: 1, flatShading: true,
  });
  const farMat = new THREE.MeshStandardMaterial({
    color: 0x6d90a2, roughness: 1, flatShading: true,
  });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand(-0.13, 0.13);
    const r = rand(175, 250);
    const h = rand(16, 42);
    const hill = new THREE.Mesh(new THREE.ConeGeometry(rand(35, 70), h, 7), i % 3 ? hillMat : farMat);
    hill.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r);
    hill.rotation.y = rand(0, Math.PI);
    scene.add(hill);
  }
}

/* -------------------------------- humans' spots ------------------------------- */

export const HUMAN_SPOTS = [
  { angle: -0.62, radius: 30.4, color: 0xd94f3d, hat: 0xf0f2f0 },
  { angle: 2.02, radius: 31.0, color: 0x3b6fd4, hat: 0xe8c86a },
  { angle: 3.86, radius: 30.2, color: 0x4c9a58, hat: 0x2f3b46 },
];

export const DOCK_ANGLE = 1.25;

/* --------------------------------- props --------------------------------- */

function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.42, 3.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a34, roughness: 1, flatShading: true })
  );
  trunk.position.y = 1.7;
  trunk.castShadow = true;
  g.add(trunk);

  const leafMats = [0x3f7a3c, 0x4c8b42, 0x326a3a];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(2.3 - i * 0.5, 2.8 - i * 0.3, 7),
      new THREE.MeshStandardMaterial({
        color: leafMats[i % leafMats.length], roughness: 0.95, flatShading: true,
      })
    );
    m.position.y = 3.1 + i * 1.25;
    m.rotation.y = rand(0, Math.PI);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function makeRock() {
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(rand(0.5, 1.3), 0),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.08, 0.06, rand(0.42, 0.6)),
      roughness: 1, flatShading: true,
    })
  );
  m.position.y = rand(-0.1, 0.3);
  m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeReeds() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a9c4a, roughness: 0.9 });
  const n = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const h = rand(0.9, 1.8);
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, h, 4), mat);
    reed.position.set(rand(-0.5, 0.5), h / 2, rand(-0.5, 0.5));
    reed.rotation.z = rand(-0.16, 0.16);
    reed.castShadow = true;
    g.add(reed);
  }
  return g;
}

function makeDock() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6242, roughness: 0.9, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5f4330, roughness: 1, flatShading: true });

  // Deck runs along local +Z, from shore (z = +7) out into the water (z = -7)
  for (let i = 0; i < 15; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.78), i % 2 ? wood : dark);
    plank.position.set(0, 0.42, 6.5 - i * 0.92);
    plank.rotation.y = rand(-0.012, 0.012);
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
  }
  for (const z of [-6.4, -2.2, 2.0, 6.2]) {
    for (const x of [-1.5, 1.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.2, 6), dark);
      post.position.set(x, -0.95, z);
      post.castShadow = true;
      g.add(post);
    }
  }
  // a little mooring post with a rope coil at the end
  const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 8), dark);
  bollard.position.set(1.25, 0.9, -5.6);
  bollard.castShadow = true;
  g.add(bollard);

  return g;
}

function makeBucket(x, z) {
  const g = new THREE.Group();
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.26, 0.55, 10),
    new THREE.MeshStandardMaterial({ color: 0x3d6f7d, roughness: 0.7, metalness: 0.25, flatShading: true })
  );
  bucket.position.set(x, 0.28, z);
  bucket.castShadow = true;
  g.add(bucket);
  return g;
}

/* -------------------------------- the world ------------------------------- */

export function createWorld(scene) {
  const sunDir = createSky(scene);
  createClouds(scene);
  createDistantHills(scene);

  scene.fog = new THREE.Fog(0xb6d7e4, 70, 320);

  /* lights */
  scene.add(new THREE.HemisphereLight(0xc4e4ff, 0x53703f, 0.85));

  const sun = new THREE.DirectionalLight(0xfff0c8, 2.3);
  sun.position.copy(sunDir).multiplyScalar(90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 240;
  sun.shadow.camera.left = -58;
  sun.shadow.camera.right = 58;
  sun.shadow.camera.top = 58;
  sun.shadow.camera.bottom = -58;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0, 0);

  const fill = new THREE.DirectionalLight(0x9fd4ff, 0.35);
  fill.position.set(60, 40, 70);
  scene.add(fill);

  /* ground */
  const grass = new THREE.Mesh(
    new THREE.RingGeometry(LAKE_RADIUS - 0.5, 400, 96, 4),
    new THREE.MeshStandardMaterial({ color: 0x6c9150, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.1;
  grass.receiveShadow = true;
  scene.add(grass);

  const sand = new THREE.Mesh(
    new THREE.RingGeometry(LAKE_RADIUS - 0.8, LAKE_RADIUS + 10, 96, 4),
    new THREE.MeshStandardMaterial({ color: 0xd7bd8c, roughness: 1, side: THREE.DoubleSide })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.04;
  sand.receiveShadow = true;
  scene.add(sand);

  const wetSand = new THREE.Mesh(
    new THREE.RingGeometry(LAKE_RADIUS - 1.4, LAKE_RADIUS + 1.2, 96, 2),
    new THREE.MeshStandardMaterial({ color: 0xbda173, roughness: 0.85, side: THREE.DoubleSide })
  );
  wetSand.rotation.x = -Math.PI / 2;
  wetSand.position.y = -0.02;
  wetSand.receiveShadow = true;
  scene.add(wetSand);

  /* lake bed */
  const bed = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE_RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0x5c6f45, roughness: 1 })
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = -4.6;
  bed.receiveShadow = false;
  scene.add(bed);

  const bedRockMat = new THREE.MeshStandardMaterial({ color: 0x4a5840, roughness: 1, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(3, LAKE_RADIUS - 3);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.4, 1.4)), bedRockMat);
    rock.position.set(Math.cos(a) * r, -4.4, Math.sin(a) * r);
    rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    scene.add(rock);
  }

  /* water */
  const waterGeo = new THREE.RingGeometry(0.01, LAKE_RADIUS, 100, 44);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x35a3ce,
    transparent: true,
    opacity: 0.56,
    roughness: 0.2,
    metalness: 0.2,
    side: THREE.DoubleSide,
    flatShading: true,
    emissive: 0x0a2635,
    emissiveIntensity: 0.28,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = WATER_Y;
  water.receiveShadow = false;
  scene.add(water);

  const base = Float32Array.from(waterGeo.attributes.position.array);

  function updateWater(t) {
    const pos = waterGeo.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      arr[i + 1] =
        Math.sin(x * 0.34 + t * 1.3) * 0.085 +
        Math.sin(z * 0.27 - t * 1.05) * 0.075 +
        Math.sin((x + z) * 0.14 + t * 0.65) * 0.05;
    }
    pos.needsUpdate = true;
  }

  /* shoreline props */
  const nearHuman = (a, r, spread = 0.3, dist = 7) =>
    HUMAN_SPOTS.some(h => {
      const da = Math.abs(Math.atan2(Math.sin(a - h.angle), Math.cos(a - h.angle)));
      return da < spread && Math.abs(r - h.radius) < dist;
    });

  const nearDock = (a, r) => {
    const da = Math.abs(Math.atan2(Math.sin(a - DOCK_ANGLE), Math.cos(a - DOCK_ANGLE)));
    return da < 0.34 && r > 18 && r < 40;
  };

  // trees
  for (let i = 0; i < 58; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(37, 130);
    if (nearHuman(a, r) || nearDock(a, r)) continue;
    const tree = makeTree();
    tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    tree.rotation.y = rand(0, Math.PI * 2);
    const s = rand(0.85, 1.7);
    tree.scale.setScalar(s);
    scene.add(tree);
  }

  // a denser band framing the fishing spot
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(36, 62);
    if (nearHuman(a, r) || nearDock(a, r)) continue;
    const tree = makeTree();
    tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    tree.rotation.y = rand(0, Math.PI * 2);
    tree.scale.setScalar(rand(0.7, 1.25));
    scene.add(tree);
  }

  // rocks around the shore
  for (let i = 0; i < 34; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(LAKE_RADIUS + 0.5, 46);
    if (nearHuman(a, r) || nearDock(a, r)) continue;
    const rock = makeRock();
    rock.position.set(Math.cos(a) * r, rock.position.y, Math.sin(a) * r);
    scene.add(rock);
  }

  // reeds hugging the waterline
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(LAKE_RADIUS - 1.6, LAKE_RADIUS + 1.1);
    if (nearHuman(a, r) || nearDock(a, r)) continue;
    const reeds = makeReeds();
    reeds.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    scene.add(reeds);
  }

  // dock
  const dock = makeDock();
  dock.position.set(Math.cos(DOCK_ANGLE) * (LAKE_RADIUS + 3), 0, Math.sin(DOCK_ANGLE) * (LAKE_RADIUS + 3));
  dock.rotation.y = -DOCK_ANGLE - Math.PI / 2;
  scene.add(dock);

  // buckets + a bench near the humans
  for (const h of HUMAN_SPOTS) {
    const bx = Math.cos(h.angle) * (h.radius + 1.5);
    const bz = Math.sin(h.angle) * (h.radius + 1.5);
    scene.add(makeBucket(bx, bz));
  }

  return { water, updateWater, sun, sunDir };
}
