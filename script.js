import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const rho = 1.2;
const cp = 1006;
const btuToW = 0.29307107;
const cfmToM3s = 0.00047194745;
const storageKey = 'airflow-simulator-layout-v2';

let id = 1;
const state = {
  run: true,
  T: 31,
  selectedId: null,
  g: { L: 4, W: 4, H: 2.6, Tin0: 31, Tout: 34, Qload: 550, mass: 12, wind: 1.2, leak: 0.25 },
  dev: { ac: [], fan: [], door: [], window: [] },
  met: {}
};

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x020617, 8, 30);
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(5, 8, 3);
scene.add(sun);

let roomGroup;
let deviceGroup;
let particles;
let particleGeom;
let particlePos;
let particleCol;
let particleTemp = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const drag = { active: false, device: null, plane: new THREE.Plane(), offset: new THREE.Vector3() };

function makeDevice(type, overrides = {}) {
  const d = { id: 'd' + id++, type, on: true, x: 0, y: 1.3, z: 0, yaw: 0, pitch: 0 };
  if (type === 'ac') Object.assign(d, {
    x: -1.65,
    y: 2.25,
    z: -1.75,
    yaw: 55,
    pitch: -12,
    btu: 12000,
    cfm: 420,
    target: 25,
    supply: 14,
    range: 4.5,
    modelW: 0.9,
    modelH: 0.3,
    modelD: 0.22
  });
  if (type === 'fan') Object.assign(d, { x: 1.1, y: 1.2, z: 0.8, yaw: 220, pitch: 0, cfm: 900, range: 4, radius: 1.1 });
  if (type === 'door') Object.assign(d, { x: 2, y: 1, z: 0.8, yaw: 180, open: 50, width: 0.8, height: 2, cd: 0.62 });
  if (type === 'window') Object.assign(d, { x: 0, y: 1.35, z: -2, yaw: 90, open: 45, width: 1.2, height: 1.1, cd: 0.55 });
  return Object.assign(d, overrides);
}

const presets = {
  meeting: {
    g: { L: 8, W: 5, H: 2.8, Tin0: 31, Tout: 34, Qload: 1400, mass: 18, wind: 1.1, leak: 0.35 },
    dev: {
      ac: [makeDevice('ac', { x: -3.2, y: 2.45, z: -1.9, yaw: 25, btu: 18000, cfm: 620, modelW: 1.05, modelH: 0.32, modelD: 0.24 }), makeDevice('ac', { x: 3.2, y: 2.45, z: -1.9, yaw: 155, btu: 18000, cfm: 620, modelW: 1.05, modelH: 0.32, modelD: 0.24 })],
      fan: [makeDevice('fan', { x: 0, y: 1.4, z: 0.8, yaw: 270, cfm: 1200 })],
      door: [makeDevice('door', { x: 4, y: 1, z: 1.4, yaw: 180, open: 35, width: 0.9, height: 2 })],
      window: [makeDevice('window', { x: -2.2, y: 1.4, z: -2.5, yaw: 90, open: 30, width: 1.5, height: 1.1 }), makeDevice('window', { x: 2.2, y: 1.4, z: -2.5, yaw: 90, open: 30, width: 1.5, height: 1.1 })]
    }
  },
  office: {
    g: { L: 4, W: 4, H: 2.6, Tin0: 31, Tout: 34, Qload: 550, mass: 12, wind: 1.2, leak: 0.25 },
    dev: {
      ac: [makeDevice('ac', { x: -1.65, y: 2.25, z: -1.75, yaw: 55, btu: 12000, cfm: 420, modelW: 0.9, modelH: 0.3, modelD: 0.22 })],
      fan: [makeDevice('fan', { x: 1.1, y: 1.2, z: 0.8, yaw: 220, cfm: 900 })],
      door: [makeDevice('door', { x: 2, y: 1, z: 0.8, yaw: 180, open: 50, width: 0.8, height: 2 })],
      window: [makeDevice('window', { x: 0, y: 1.35, z: -2, yaw: 90, open: 45, width: 1.2, height: 1.1 })]
    }
  },
  bedroom: {
    g: { L: 4.2, W: 3.4, H: 2.6, Tin0: 30, Tout: 33, Qload: 280, mass: 16, wind: 0.8, leak: 0.18 },
    dev: {
      ac: [makeDevice('ac', { x: -1.7, y: 2.25, z: -1.25, yaw: 35, btu: 9000, cfm: 330, target: 25, modelW: 0.8, modelH: 0.28, modelD: 0.21 })],
      fan: [],
      door: [makeDevice('door', { x: 2.1, y: 1, z: 1.1, yaw: 180, open: 20, width: 0.8, height: 2 })],
      window: [makeDevice('window', { x: -1.2, y: 1.35, z: -1.7, yaw: 90, open: 20, width: 1.2, height: 1.1 })]
    }
  }
};

function initDefault() {
  state.dev.ac = [makeDevice('ac')];
  state.dev.fan = [makeDevice('fan')];
  state.dev.door = [makeDevice('door')];
  state.dev.window = [makeDevice('window')];
}

function bounds() {
  const g = state.g;
  return { minX: -g.L / 2, maxX: g.L / 2, minY: 0.05, maxY: g.H - 0.05, minZ: -g.W / 2, maxZ: g.W / 2 };
}
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function fmt(x, n = 1) { return Number.isFinite(x) ? x.toFixed(n) : '-'; }
function volume() { return Math.max(0.1, state.g.L * state.g.W * state.g.H); }
function allDevices() { return Object.values(state.dev).flat(); }
function findDevice(deviceId) { return allDevices().find(d => d.id === deviceId); }
function dir(yaw, pitch = 0) {
  const y = THREE.MathUtils.degToRad(yaw);
  const p = THREE.MathUtils.degToRad(pitch);
  return new THREE.Vector3(Math.cos(y) * Math.cos(p), Math.sin(p), Math.sin(y) * Math.cos(p)).normalize();
}
function deviceColor(type) {
  return { ac: 0x38bdf8, fan: 0xfbbf24, door: 0x34d399, window: 0xa78bfa }[type] || 0xffffff;
}
function colorCss(type) {
  return { ac: '#38bdf8', fan: '#fbbf24', door: '#34d399', window: '#a78bfa' }[type] || '#ffffff';
}
function faceRotationY(yaw) {
  return Math.PI / 2 - THREE.MathUtils.degToRad(yaw || 0);
}
function attachDeviceId(obj, deviceId) {
  obj.traverse(child => { child.userData.deviceId = deviceId; });
}

function centerRoom() {
  const r = Math.max(state.g.L, state.g.W, state.g.H);
  camera.position.set(r * 0.95, r * 0.75, r * 1.05);
  controls.target.set(0, state.g.H / 2, 0);
  controls.update();
}

function rebuildRoom() {
  if (roomGroup) scene.remove(roomGroup);
  roomGroup = new THREE.Group();
  const g = state.g;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(g.L, 0.04, g.W), new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.55 }));
  floor.position.y = -0.02;
  roomGroup.add(floor);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(g.L, g.H, g.W)), new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 }));
  edges.position.y = g.H / 2;
  roomGroup.add(edges);
  const grid = new THREE.GridHelper(Math.max(g.L, g.W), Math.ceil(Math.max(g.L, g.W)), 0x475569, 0x1e293b);
  grid.position.y = 0.01;
  roomGroup.add(grid);
  scene.add(roomGroup);
}

function labelTexture(text, bg) {
  const ca = document.createElement('canvas');
  ca.width = 256;
  ca.height = 128;
  const c = ca.getContext('2d');
  c.fillStyle = bg;
  roundRect(c, 8, 18, 240, 82, 20);
  c.fill();
  c.fillStyle = 'white';
  c.font = 'bold 34px system-ui';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 128, 60);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(ca), transparent: true });
}
function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function acModel(d) {
  const g = new THREE.Group();
  const w = d.modelW || 0.9;
  const h = d.modelH || 0.3;
  const dep = d.modelD || 0.22;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, dep),
    new THREE.MeshStandardMaterial({ color: 0xe5eef7, roughness: 0.52 })
  );
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.86, h * 0.12, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
  );
  grille.position.set(0, -h * 0.25, dep / 2 + 0.009);
  const display = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.18, h * 0.08, 0.014),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.25 })
  );
  display.position.set(w * 0.27, h * 0.16, dep / 2 + 0.011);
  g.add(body, grille, display);
  g.rotation.y = faceRotationY(d.yaw);
  return g;
}

function doorModel(d) {
  const g = new THREE.Group();
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(d.width || 0.8, d.height || 2, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.75 })
  );
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry((d.width || 0.8) + 0.08, (d.height || 2) + 0.08, 0.065)),
    new THREE.LineBasicMaterial({ color: 0xffedd5 })
  );
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.25, roughness: 0.35 })
  );
  knob.position.set((d.width || 0.8) * 0.35, 0, 0.05);
  g.add(leaf, frame, knob);
  g.rotation.y = faceRotationY(d.yaw);
  return g;
}

function windowModel(d) {
  const g = new THREE.Group();
  const w = d.width || 1.2;
  const h = d.height || 1.1;
  const pane = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.035),
    new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.35, roughness: 0.12 })
  );
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.05)),
    new THREE.LineBasicMaterial({ color: 0xe2e8f0 })
  );
  const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.055), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  const mullionH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, 0.055), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  g.add(pane, frame, mullionV, mullionH);
  g.rotation.y = faceRotationY(d.yaw);
  return g;
}

function fanModel(d) {
  const g = new THREE.Group();
  const color = deviceColor(d.type);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22 }));
  hub.rotation.x = Math.PI / 2;
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.45 });
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.045, 0.018), bladeMat);
    blade.position.x = 0.25;
    blade.rotation.z = i * Math.PI * 2 / 3;
    g.add(blade);
  }
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.7, 0.035), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
  stand.position.y = -0.42;
  g.add(hub, stand);
  g.rotation.y = faceRotationY(d.yaw);
  return g;
}

function marker(d) {
  const group = new THREE.Group();
  group.userData.deviceId = d.id;
  group.userData.draggable = true;
  const color = deviceColor(d.type);
  let model;
  if (d.type === 'ac') model = acModel(d);
  else if (d.type === 'door') model = doorModel(d);
  else if (d.type === 'window') model = windowModel(d);
  else model = fanModel(d);
  attachDeviceId(model, d.id);
  group.add(model);

  const outline = new THREE.BoxHelper(model, d.id === state.selectedId ? 0xffffff : color);
  outline.userData.deviceId = d.id;
  group.add(outline);

  const arrow = new THREE.ArrowHelper(dir(d.yaw, d.pitch || 0), new THREE.Vector3(0, 0, 0), 0.75, color);
  arrow.userData.deviceId = d.id;
  group.add(arrow);

  const labelText = { ac: 'AIR', fan: 'FAN', door: 'DOOR', window: 'WIN' }[d.type];
  const labelBg = { ac: '#0284c7', fan: '#a16207', door: '#047857', window: '#7c3aed' }[d.type];
  const sprite = new THREE.Sprite(labelTexture(labelText, labelBg));
  sprite.scale.set(0.7, 0.35, 1);
  const labelY = d.type === 'door' ? (d.height || 2) / 2 + 0.32 : d.type === 'window' ? (d.height || 1.1) / 2 + 0.25 : 0.45;
  sprite.position.y = labelY;
  sprite.userData.deviceId = d.id;
  group.add(sprite);
  group.position.set(d.x, d.y, d.z);
  return group;
}

function rebuildDevices() {
  if (deviceGroup) scene.remove(deviceGroup);
  deviceGroup = new THREE.Group();
  allDevices().forEach(d => deviceGroup.add(marker(d)));
  scene.add(deviceGroup);
  renderPlan();
}

function randomPos() {
  const q = bounds();
  return new THREE.Vector3(THREE.MathUtils.randFloat(q.minX, q.maxX), THREE.MathUtils.randFloat(q.minY, q.maxY), THREE.MathUtils.randFloat(q.minZ, q.maxZ));
}
function tempColor(t) {
  const u = clamp((t - 14) / 22, 0, 1);
  return new THREE.Color().setHSL(0.58 - 0.58 * u, 0.9, 0.58);
}
function rebuildParticles() {
  if (particles) scene.remove(particles);
  const n = +document.getElementById('npart').value || 420;
  particleGeom = new THREE.BufferGeometry();
  particlePos = new Float32Array(n * 3);
  particleCol = new Float32Array(n * 3);
  particleTemp = [];
  for (let i = 0; i < n; i++) {
    const p = randomPos();
    particlePos.set([p.x, p.y, p.z], i * 3);
    particleTemp[i] = state.T;
    tempColor(state.T).toArray(particleCol, i * 3);
  }
  particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  particleGeom.setAttribute('color', new THREE.BufferAttribute(particleCol, 3));
  particles = new THREE.Points(particleGeom, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.9 }));
  scene.add(particles);
}

function airflowField(p) {
  const v = new THREE.Vector3();
  let local = state.T;
  for (const d of allDevices()) {
    if (!d.on) continue;
    const origin = new THREE.Vector3(d.x, d.y, d.z);
    const delta = p.clone().sub(origin);
    const dist = delta.length() + 0.001;
    if (d.type === 'ac' || d.type === 'fan') {
      const D = dir(d.yaw, d.pitch || 0);
      const along = delta.dot(D);
      if (along > 0 && along < d.range) {
        const perp = delta.clone().sub(D.clone().multiplyScalar(along)).length();
        const rad = d.radius || (0.32 + along * 0.18);
        const cone = Math.exp(-(perp * perp) / (rad * rad));
        const power = (d.cfm * cfmToM3s) * cone * (1 - along / d.range) * 1.55;
        v.addScaledVector(D, power);
        if (d.type === 'ac') local = THREE.MathUtils.lerp(local, d.supply, cone * 0.45);
      }
    }
    if (d.type === 'door' || d.type === 'window') {
      const reach = 2.8 + d.open / 100 * 2.5;
      if (dist < reach) v.addScaledVector(dir(d.yaw, 0), (1 - dist / reach) * (d.open / 100) * state.g.wind * 0.45);
    }
  }
  v.y += clamp((state.T - 26) * 0.008, -0.02, 0.05);
  v.x += (Math.random() - 0.5) * 0.01;
  v.z += (Math.random() - 0.5) * 0.01;
  return { v, local };
}

function stepParticles(dt) {
  const q = bounds();
  const n = particlePos.length / 3;
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    const p = new THREE.Vector3(particlePos[k], particlePos[k + 1], particlePos[k + 2]);
    const f = airflowField(p);
    p.addScaledVector(f.v, dt);
    if (p.x < q.minX || p.x > q.maxX || p.y < q.minY || p.y > q.maxY || p.z < q.minZ || p.z > q.maxZ) {
      p.copy(randomPos());
      particleTemp[i] = state.T;
    } else {
      particleTemp[i] = THREE.MathUtils.lerp(particleTemp[i], f.local, 0.035);
    }
    particlePos.set([p.x, p.y, p.z], k);
    tempColor(particleTemp[i]).toArray(particleCol, k);
  }
  particleGeom.attributes.position.needsUpdate = true;
  particleGeom.attributes.color.needsUpdate = true;
}

function thermal(dt) {
  const g = state.g;
  const V = volume();
  const cap = rho * V * cp * g.mass;
  let qac = 0;
  let cfm = 0;
  for (const a of state.dev.ac) {
    if (!a.on) continue;
    cfm += a.cfm;
    qac += a.btu * btuToW * clamp((state.T - a.target) / 4, 0, 1);
  }
  let vent = V * g.leak / 3600;
  for (const o of [...state.dev.door, ...state.dev.window]) {
    if (!o.on || o.open <= 0) continue;
    vent += o.cd * o.width * o.height * (o.open / 100) * g.wind;
  }
  const qVent = rho * cp * vent * (g.Tout - state.T);
  const dT = (g.Qload + qVent - qac) / cap * dt;
  state.T = clamp(state.T + dT, 5, 55);
  state.met = { V, qac, qVent, Q: g.Qload, ach: vent * 3600 / V, cfm };
}

function validInputCount() {
  let bad = 0;
  document.querySelectorAll('input[required]').forEach(i => { if (!i.checkValidity() || i.value === '') bad++; });
  return bad;
}
function metric(k, v, c = '') { return `<div class="metric"><span>${k}</span><span class="val ${c}">${v}</span></div>`; }
function renderMetrics() {
  const m = state.met;
  const bad = validInputCount();
  const tc = state.T <= 27 ? 'ok' : state.T <= 30 ? 'warn' : 'bad';
  document.getElementById('metrics').innerHTML = [
    metric('สถานะข้อมูล', bad ? 'ผิด/ขาด ' + bad + ' ช่อง' : 'ครบถ้วน', bad ? 'bad' : 'ok'),
    metric('อุณหภูมิห้องเฉลี่ย', fmt(state.T, 2) + ' °C', tc),
    metric('ปริมาตรห้อง', fmt(m.V, 1) + ' m³'),
    metric('กำลังทำความเย็น', fmt(m.qac, 0) + ' W'),
    metric('Heat load', fmt(m.Q, 0) + ' W'),
    metric('Ventilation ACH', fmt(m.ach, 2) + ' /h'),
    metric('ผลช่องเปิด', fmt(m.qVent, 0) + ' W'),
    metric('Airflow แอร์รวม', fmt(m.cfm, 0) + ' CFM'),
    metric('CFD status', 'Preliminary / not certified', 'warn')
  ].join('');
}

function numInput(d, key, label, min, max, step) {
  return `<div><label>${label}</label><input data-id="${d.id}" data-k="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${d[key]}" required></div>`;
}
function deviceCard(d, i) {
  let spec = '';
  if (d.type === 'ac') spec = `<div class="g2 row">${numInput(d, 'btu', 'BTU/hr', 1000, 100000, 500)}${numInput(d, 'cfm', 'Airflow CFM', 50, 3000, 10)}</div><div class="g3 row">${numInput(d, 'target', 'Target °C', 16, 35, 0.5)}${numInput(d, 'supply', 'Supply °C', 8, 25, 0.5)}${numInput(d, 'range', 'ระยะลม m', 0.5, 20, 0.5)}</div><div class="g3 row">${numInput(d, 'modelW', 'กว้างตัวแอร์ m', 0.4, 2, 0.01)}${numInput(d, 'modelH', 'สูงตัวแอร์ m', 0.15, 0.7, 0.01)}${numInput(d, 'modelD', 'ลึกตัวแอร์ m', 0.1, 0.6, 0.01)}</div>`;
  if (d.type === 'fan') spec = `<div class="g3 row">${numInput(d, 'cfm', 'Airflow CFM', 50, 8000, 10)}${numInput(d, 'range', 'ระยะลม m', 0.5, 20, 0.5)}${numInput(d, 'radius', 'รัศมีลม m', 0.1, 5, 0.05)}</div>`;
  if (d.type === 'door' || d.type === 'window') spec = `<div class="g3 row">${numInput(d, 'width', 'กว้าง m', 0.1, 20, 0.1)}${numInput(d, 'height', 'สูง m', 0.1, 20, 0.1)}${numInput(d, 'cd', 'Cd', 0, 1, 0.01)}</div>`;
  const pitchOrOpen = (d.type === 'ac' || d.type === 'fan') ? numInput(d, 'pitch', 'Pitch °', -80, 80, 1) : numInput(d, 'open', 'เปิด %', 0, 100, 1);
  return `<div class="dev ${d.id === state.selectedId ? 'selected' : ''}"><div class="devHead"><b>${d.type.toUpperCase()} #${i + 1}</b><span><label style="display:inline;color:#cbd5e1"><input data-id="${d.id}" data-k="on" type="checkbox" ${d.on ? 'checked' : ''}>เปิด</label> <button data-select="${d.id}">เลือก</button> <button data-del="${d.id}">ลบ</button></span></div><div class="g3 row">${numInput(d, 'x', 'X m', -50, 50, 0.1)}${numInput(d, 'y', 'Y m', 0, 50, 0.1)}${numInput(d, 'z', 'Z m', -50, 50, 0.1)}</div><div class="g2 row">${numInput(d, 'yaw', 'Yaw °', 0, 360, 1)}${pitchOrOpen}</div>${spec}<p class="help">ลากใน 3D หรือในแปลนเพื่อเปลี่ยน X/Z. Y คือความสูงจากพื้น</p></div>`;
}
function renderLists() {
  ['ac', 'fan', 'door', 'window'].forEach(t => document.getElementById(t + 'List').innerHTML = state.dev[t].map(deviceCard).join(''));
  bindDeviceInputs();
}
function bindDeviceInputs() {
  document.querySelectorAll('[data-id][data-k]').forEach(input => {
    input.oninput = () => {
      const d = findDevice(input.dataset.id);
      if (!d) return;
      d[input.dataset.k] = input.type === 'checkbox' ? input.checked : parseFloat(input.value);
      clampDeviceToRoom(d);
      rebuildDevices();
      renderPlan();
    };
  });
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = () => {
      for (const t in state.dev) state.dev[t] = state.dev[t].filter(d => d.id !== btn.dataset.del);
      if (state.selectedId === btn.dataset.del) state.selectedId = null;
      renderLists(); rebuildDevices(); renderPlan();
    };
  });
  document.querySelectorAll('[data-select]').forEach(btn => {
    btn.onclick = () => {
      state.selectedId = btn.dataset.select;
      renderLists(); rebuildDevices(); renderPlan();
    };
  });
}

function clampDeviceToRoom(d) {
  const q = bounds();
  d.x = clamp(d.x, q.minX, q.maxX);
  d.z = clamp(d.z, q.minZ, q.maxZ);
  d.y = clamp(d.y, 0, state.g.H);
}
function updateRoomInputs() {
  document.querySelectorAll('[data-g]').forEach(input => { input.value = state.g[input.dataset.g]; });
}
function fullRefresh(resetParticles = true) {
  allDevices().forEach(clampDeviceToRoom);
  rebuildRoom();
  rebuildDevices();
  renderLists();
  renderPlan();
  if (resetParticles) rebuildParticles();
  centerRoom();
}

function screenToNdc(event) {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((event.clientY - r.top) / r.height) * 2 + 1;
}
function intersectDragPlane(event) {
  screenToNdc(event);
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(drag.plane, hit) ? hit : null;
}
canvas.addEventListener('pointerdown', event => {
  screenToNdc(event);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(deviceGroup ? deviceGroup.children : [], true);
  const hit = hits.find(h => h.object.userData.deviceId);
  if (!hit) return;
  const d = findDevice(hit.object.userData.deviceId);
  if (!d) return;
  state.selectedId = d.id;
  drag.active = true;
  drag.device = d;
  drag.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, d.y, 0));
  drag.offset.copy(new THREE.Vector3(d.x, d.y, d.z)).sub(hit.point);
  controls.enabled = false;
  canvas.setPointerCapture(event.pointerId);
  renderLists(); rebuildDevices(); renderPlan();
});
canvas.addEventListener('pointermove', event => {
  if (!drag.active || !drag.device) return;
  const hit = intersectDragPlane(event);
  if (!hit) return;
  drag.device.x = Number((hit.x + drag.offset.x).toFixed(2));
  drag.device.z = Number((hit.z + drag.offset.z).toFixed(2));
  clampDeviceToRoom(drag.device);
  rebuildDevices();
  renderLists();
  renderPlan();
});
canvas.addEventListener('pointerup', event => {
  if (!drag.active) return;
  drag.active = false;
  drag.device = null;
  controls.enabled = true;
  try { canvas.releasePointerCapture(event.pointerId); } catch {}
});

function renderPlan() {
  const svg = document.getElementById('planSvg');
  const w = 360, h = 240, pad = 24;
  const scale = Math.min((w - pad * 2) / state.g.L, (h - pad * 2) / state.g.W);
  const rw = state.g.L * scale, rh = state.g.W * scale;
  const ox = (w - rw) / 2, oy = (h - rh) / 2;
  const toSvg = d => ({ x: ox + (d.x + state.g.L / 2) * scale, y: oy + (d.z + state.g.W / 2) * scale });
  let html = `<rect class="plan-room" x="${ox}" y="${oy}" width="${rw}" height="${rh}" rx="8"></rect>`;
  for (let gx = Math.ceil(-state.g.L / 2); gx <= state.g.L / 2; gx++) {
    const x = ox + (gx + state.g.L / 2) * scale;
    html += `<line class="plan-grid" x1="${x}" y1="${oy}" x2="${x}" y2="${oy + rh}"></line>`;
  }
  for (let gz = Math.ceil(-state.g.W / 2); gz <= state.g.W / 2; gz++) {
    const y = oy + (gz + state.g.W / 2) * scale;
    html += `<line class="plan-grid" x1="${ox}" y1="${y}" x2="${ox + rw}" y2="${y}"></line>`;
  }
  allDevices().forEach((d, idx) => {
    const p = toSvg(d);
    const rectW = d.type === 'door' || d.type === 'window' ? Math.max(14, (d.width || 1) * scale) : Math.max(14, (d.modelW || 0.8) * scale);
    const rectH = d.type === 'door' || d.type === 'window' ? 8 : 10;
    if (d.type === 'ac' || d.type === 'door' || d.type === 'window') {
      html += `<rect class="plan-dot" data-plan-id="${d.id}" x="${p.x - rectW / 2}" y="${p.y - rectH / 2}" width="${rectW}" height="${rectH}" rx="3" fill="${colorCss(d.type)}"></rect>`;
    } else {
      html += `<circle class="plan-dot" data-plan-id="${d.id}" cx="${p.x}" cy="${p.y}" r="${d.id === state.selectedId ? 8 : 6}" fill="${colorCss(d.type)}"></circle>`;
    }
    html += `<text class="plan-label" x="${p.x}" y="${p.y - 11}">${d.type.toUpperCase()}${idx + 1}</text>`;
  });
  svg.innerHTML = html;
  bindPlan(svg, { ox, oy, rw, rh, scale });
}
function bindPlan(svg, m) {
  let planDragId = null;
  const toRoom = evt => {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const x = clamp((p.x - m.ox) / m.scale - state.g.L / 2, -state.g.L / 2, state.g.L / 2);
    const z = clamp((p.y - m.oy) / m.scale - state.g.W / 2, -state.g.W / 2, state.g.W / 2);
    return { x: Number(x.toFixed(2)), z: Number(z.toFixed(2)) };
  };
  svg.querySelectorAll('[data-plan-id]').forEach(dot => {
    dot.addEventListener('pointerdown', evt => {
      planDragId = dot.dataset.planId;
      state.selectedId = planDragId;
      svg.setPointerCapture(evt.pointerId);
      renderLists(); rebuildDevices();
    });
  });
  svg.onpointermove = evt => {
    if (!planDragId) return;
    const d = findDevice(planDragId);
    if (!d) return;
    const p = toRoom(evt);
    d.x = p.x; d.z = p.z;
    rebuildDevices(); renderLists(); renderPlan();
  };
  svg.onpointerup = evt => {
    planDragId = null;
    try { svg.releasePointerCapture(evt.pointerId); } catch {}
  };
}

function serialize() {
  return JSON.stringify({ version: 2, savedAt: new Date().toISOString(), g: state.g, dev: state.dev, T: state.T }, null, 2);
}
function loadLayout(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || !data.g || !data.dev) throw new Error('Invalid layout file');
  state.g = Object.assign(state.g, data.g);
  state.dev = data.dev;
  state.T = Number(data.T || state.g.Tin0);
  id = Math.max(1, ...allDevices().map(d => Number(String(d.id).replace('d', '')) || 0)) + 1;
  updateRoomInputs();
  fullRefresh(true);
}
function applyPreset(name) {
  const p = presets[name];
  if (!p) return;
  const cloned = JSON.parse(JSON.stringify({ g: p.g, dev: p.dev }));
  state.g = cloned.g;
  state.dev = cloned.dev;
  state.T = state.g.Tin0;
  id = Math.max(1, ...allDevices().map(d => Number(String(d.id).replace('d', '')) || 0)) + 1;
  updateRoomInputs();
  fullRefresh(true);
}
function exportPdf() {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) { alert('PDF library is not ready. Please check internet connection.'); return; }
  const pdf = new jsPDF();
  const lines = [
    'Interactive 3D Airflow Simulator Report',
    'Status: Preliminary CFD-inspired model, NOT engineering-certified CFD',
    'Generated: ' + new Date().toLocaleString(),
    '',
    `Room: L ${state.g.L} m x W ${state.g.W} m x H ${state.g.H} m`,
    `Temperature: ${fmt(state.T, 2)} C, Outdoor: ${state.g.Tout} C`,
    `Heat load: ${state.g.Qload} W, Leakage: ${state.g.leak} ACH, Wind: ${state.g.wind} m/s`,
    `Cooling: ${fmt(state.met.qac, 0)} W, Ventilation: ${fmt(state.met.ach, 2)} ACH`,
    '',
    'Devices:'
  ];
  allDevices().forEach(d => lines.push(`${d.type.toUpperCase()} ${d.id}: ${d.on ? 'ON' : 'OFF'}, x=${d.x}, y=${d.y}, z=${d.z}, yaw=${d.yaw}`));
  lines.push('', 'Use this report for preliminary discussion only. Engineering approval requires validated CFD workflow and professional review.');
  let y = 14;
  pdf.setFontSize(12);
  lines.forEach(line => {
    if (y > 280) { pdf.addPage(); y = 14; }
    pdf.text(String(line), 12, y);
    y += 7;
  });
  pdf.save('airflow-simulation-report.pdf');
}

function bindUi() {
  document.querySelectorAll('[data-g]').forEach(input => input.oninput = () => {
    state.g[input.dataset.g] = parseFloat(input.value);
    allDevices().forEach(clampDeviceToRoom);
    rebuildRoom(); rebuildDevices(); rebuildParticles(); renderLists(); renderPlan(); centerRoom();
  });
  document.querySelectorAll('[data-add]').forEach(btn => btn.onclick = () => {
    const d = makeDevice(btn.dataset.add);
    state.dev[btn.dataset.add].push(d);
    state.selectedId = d.id;
    renderLists(); rebuildDevices(); renderPlan();
  });
  document.getElementById('run').onclick = e => {
    state.run = !state.run;
    e.target.textContent = state.run ? 'Pause' : 'Run';
    e.target.classList.toggle('primary', state.run);
  };
  document.getElementById('resetP').onclick = rebuildParticles;
  document.getElementById('resetT').onclick = () => { state.T = state.g.Tin0; particleTemp = particleTemp.map(() => state.T); };
  document.getElementById('centerRoom').onclick = centerRoom;
  document.getElementById('exportPdf').onclick = exportPdf;
  document.getElementById('npart').onchange = rebuildParticles;
  document.getElementById('preset').onchange = e => applyPreset(e.target.value);
  document.getElementById('saveLocal').onclick = () => { localStorage.setItem(storageKey, serialize()); alert('Saved layout in this browser.'); };
  document.getElementById('loadLocal').onclick = () => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) { alert('No saved layout found.'); return; }
    try { loadLayout(saved); } catch (e) { alert(e.message); }
  };
  document.getElementById('downloadJson').onclick = () => {
    const blob = new Blob([serialize()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'airflow-layout.json'; a.click();
    URL.revokeObjectURL(url);
  };
  document.getElementById('loadJsonBtn').onclick = () => document.getElementById('loadJson').click();
  document.getElementById('loadJson').onchange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { loadLayout(await file.text()); } catch (err) { alert(err.message); }
    e.target.value = '';
  };
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.04, clock.getDelta()) * (+document.getElementById('speed').value || 1);
  thermal(state.run ? dt : 0);
  if (state.run) stepParticles(dt);
  renderMetrics();
  resize();
  controls.update();
  renderer.render(scene, camera);
}

initDefault();
bindUi();
updateRoomInputs();
state.T = state.g.Tin0;
fullRefresh(true);
thermal(0);
loop();
