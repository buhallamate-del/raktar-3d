// Hangok (config.js: hang): minden hang a böngészőben, Web Audio API-val készül (nincs hangfájl).
// hang(nev, hol): egyszeri hang; hol = a forrás világkoordinátája ({x, y, z}, y = fel) – ilyenkor a
// távolsággal halkul, és jobbra/balra szól aszerint, merre van; hol nélkül teljes hangerővel szól.
// hurok(nev): folyamatos hang (pl. a lidérc suttogása), a hangerejét és a helyét képkockánként állítjuk.
// A böngészők csak az első kattintás / billentyű után engedik a hangot: addig minden hívás néma.
import * as THREE from 'three';

const TAROL = 'raktar3d.hang';
let ctx = null, fo = null, kamera = null, zajBuf = null;
let be = true, hangero = 0.6, maxTav = 60;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

export function hangInit({ C, camera }) {
  const H = C.hang || {};
  kamera = camera;
  maxTav = Number(H.maxTavolsag ?? 60);
  let t = {};
  try { t = JSON.parse(localStorage.getItem(TAROL)) || {}; } catch { /* nincs tárhely */ }
  be = t.be ?? (H.bekapcsolva !== false);
  hangero = Number(t.hangero ?? H.hangero ?? 0.6);
  const el = id => document.getElementById(id);
  const ment = () => { try { localStorage.setItem(TAROL, JSON.stringify({ be, hangero })); } catch { /* nincs tárhely */ } };
  if (el('hangBe')) { el('hangBe').checked = be; el('hangBe').addEventListener('change', e => { be = e.target.checked; ment(); if (fo) fo.gain.value = be ? hangero : 0; }); }
  if (el('hangEro')) { el('hangEro').value = Math.round(hangero * 100); el('hangEro').addEventListener('input', e => { hangero = Number(e.target.value) / 100; ment(); if (fo) fo.gain.value = be ? hangero : 0; hang('felvesz'); }); }
  const indit = () => {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
      fo = ctx.createGain(); fo.gain.value = be ? hangero : 0; fo.connect(ctx.destination);
      zajBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = zajBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, indit, { passive: true });
}

// a forrás hangereje és iránya a hallgatóhoz (a kamerához) képest
function terben(hol) {
  if (!hol || !kamera) return { g: 1, pan: 0 };
  kamera.getWorldPosition(v1);
  v2.set(hol.x, hol.y ?? v1.y, hol.z).sub(v1);
  const d = v2.length();
  if (d > maxTav) return null;
  const g = 1 / (1 + (d / 6) ** 1.6);
  // jobbra-balra: a kamera jobb oldali irányára vetítve
  const jobb = new THREE.Vector3(1, 0, 0).applyQuaternion(kamera.getWorldQuaternion(new THREE.Quaternion()));
  const pan = d > 0.01 ? Math.max(-1, Math.min(1, v2.normalize().dot(jobb))) * 0.8 : 0;
  return { g, pan };
}

// építőkockák: kimenet (hangerő + térbeli irány), zaj, oszcillátor, burkológörbe
function kimenet(t, g, pan) {
  const gain = ctx.createGain(); gain.gain.value = g;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; gain.connect(p); p.connect(fo); }
  else gain.connect(fo);
  return gain;
}
function burok(cel, t, csucs, fel, le) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(csucs, t + fel);
  g.gain.exponentialRampToValueAtTime(0.0001, t + fel + le);
  g.connect(cel);
  return g;
}
function zaj(cel, t, hossz, szuro, f0, f1 = f0, q = 1) {
  const s = ctx.createBufferSource(); s.buffer = zajBuf;
  const f = ctx.createBiquadFilter(); f.type = szuro; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + hossz);
  s.connect(f); f.connect(cel);
  s.start(t, Math.random() * 1.5); s.stop(t + hossz + 0.05);
}
function hangjegy(cel, t, hossz, tipus, f0, f1 = f0) {
  const o = ctx.createOscillator(); o.type = tipus;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + hossz);
  o.connect(cel); o.start(t); o.stop(t + hossz + 0.05);
}

const RECEPTEK = {
  ak(k, t) { zaj(burok(k, t, 0.6, 0.002, 0.07), t, 0.08, 'highpass', 900); hangjegy(burok(k, t, 0.5, 0.002, 0.06), t, 0.06, 'sine', 110, 50); },
  puska(k, t) { zaj(burok(k, t, 0.9, 0.002, 0.25), t, 0.3, 'bandpass', 2200, 500, 0.7); hangjegy(burok(k, t, 0.7, 0.002, 0.18), t, 0.18, 'sine', 80, 35); },
  bazooka(k, t) { zaj(burok(k, t, 0.7, 0.02, 0.55), t, 0.6, 'bandpass', 300, 2400, 1.5); hangjegy(burok(k, t, 0.5, 0.005, 0.15), t, 0.15, 'sine', 90, 40); },
  robbanas(k, t) { zaj(burok(k, t, 1.0, 0.005, 1.3), t, 1.4, 'lowpass', 1400, 90); hangjegy(burok(k, t, 0.9, 0.005, 0.8), t, 0.8, 'sine', 70, 28); },
  uveg(k, t) { zaj(burok(k, t, 0.4, 0.002, 0.12), t, 0.15, 'highpass', 3500); for (const [d, f] of [[0, 2600], [0.04, 3400], [0.09, 2900]]) hangjegy(burok(k, t + d, 0.15, 0.001, 0.12), t + d, 0.12, 'sine', f); },
  lokes(k, t) { hangjegy(burok(k, t, 0.6, 0.003, 0.12), t, 0.12, 'sine', 150, 55); zaj(burok(k, t, 0.2, 0.002, 0.06), t, 0.06, 'lowpass', 600); },
  talalat(k, t) { hangjegy(burok(k, t, 0.25, 0.003, 0.14), t, 0.14, 'square', 240, 110); },
  halal(k, t) { hangjegy(burok(k, t, 0.35, 0.01, 0.8), t, 0.8, 'sawtooth', 320, 70); },
  felvesz(k, t) { hangjegy(burok(k, t, 0.3, 0.005, 0.09), t, 0.09, 'sine', 660); hangjegy(burok(k, t + 0.09, 0.3, 0.005, 0.12), t + 0.09, 0.12, 'sine', 990); },
  tolt(k, t) { zaj(burok(k, t, 0.35, 0.001, 0.03), t, 0.04, 'bandpass', 2500, 2500, 3); zaj(burok(k, t + 0.22, 0.4, 0.001, 0.04), t + 0.22, 0.05, 'bandpass', 1600, 1600, 3); },
  katana(k, t) { zaj(burok(k, t, 0.5, 0.03, 0.18), t, 0.22, 'bandpass', 4200, 700, 2); },
  ugatas(k, t) {
    for (const d of [0, 0.22]) { hangjegy(burok(k, t + d, 0.45, 0.005, 0.12), t + d, 0.12, 'sawtooth', 420, 230); zaj(burok(k, t + d, 0.15, 0.003, 0.08), t + d, 0.08, 'bandpass', 900, 900, 2); }
  },
  harapas(k, t) { zaj(burok(k, t, 0.6, 0.001, 0.06), t, 0.07, 'bandpass', 1800, 900, 1); hangjegy(burok(k, t, 0.3, 0.002, 0.08), t, 0.08, 'square', 300, 160); },
  kattan(k, t) { zaj(burok(k, t, 0.3, 0.001, 0.03), t, 0.03, 'highpass', 3000); hangjegy(burok(k, t + 0.05, 0.12, 0.002, 0.1), t + 0.05, 0.1, 'sine', 1800); },
  koppan(k, t) { hangjegy(burok(k, t, 0.25, 0.001, 0.05), t, 0.05, 'triangle', 700, 400); },
  csipog(k, t) { hangjegy(burok(k, t, 0.18, 0.005, 0.18), t, 0.18, 'square', 1250); },
  jel(k, t) { hangjegy(burok(k, t, 0.25, 0.01, 0.25), t, 0.25, 'triangle', 880); hangjegy(burok(k, t + 0.12, 0.2, 0.01, 0.3), t + 0.12, 0.3, 'triangle', 1320); },
  dicsoseg(k, t) { [523, 659, 784, 1047].forEach((f, i) => hangjegy(burok(k, t + i * 0.12, 0.3, 0.01, 0.35), t + i * 0.12, 0.35, 'triangle', f)); },
  kurt(k, t) { for (const f of [220, 277, 330]) hangjegy(burok(k, t, 0.18, 0.05, 0.9), t, 0.95, 'sawtooth', f); },
  szirena(k, t) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(600, t); o.frequency.linearRampToValueAtTime(1150, t + 0.6); o.frequency.linearRampToValueAtTime(600, t + 1.2); o.connect(burok(k, t, 0.22, 0.05, 1.15)); o.start(t); o.stop(t + 1.3); },
  sikoly(k, t) { hangjegy(burok(k, t, 0.4, 0.05, 1.0), t, 1.0, 'sawtooth', 500, 1300); zaj(burok(k, t, 0.3, 0.05, 1.0), t, 1.0, 'bandpass', 1500, 3000, 4); },
};

export function hang(nev, hol, ero = 1) {
  if (!ctx || !be || ctx.state !== 'running' || !RECEPTEK[nev]) return;
  const tr = terben(hol);
  if (!tr) return;
  try { RECEPTEK[nev](kimenet(ctx.currentTime, tr.g * ero, tr.pan), ctx.currentTime + 0.005); } catch { /* egy hiba ne állítsa meg a játékot */ }
}

// folyamatos hang: a lidérc suttogása (zaj + lassan mozgó szűrő) és mély zúgás
export function hurok(nev) {
  let lanc = null;
  function felepit() {
    const t = ctx.currentTime;
    const ki = ctx.createGain(); ki.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { ki.connect(pan); pan.connect(fo); } else ki.connect(fo);
    const s = ctx.createBufferSource(); s.buffer = zajBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7;
    const lfoG = ctx.createGain(); lfoG.gain.value = 500;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    const zg = ctx.createGain(); zg.gain.value = 0.9;
    s.connect(f); f.connect(zg); zg.connect(ki);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 98;
    const og = ctx.createGain(); og.gain.value = 0.25;
    const trem = ctx.createOscillator(); trem.frequency.value = 3.1;
    const tremG = ctx.createGain(); tremG.gain.value = 0.15;
    trem.connect(tremG); tremG.connect(og.gain);
    o.connect(og); og.connect(ki);
    s.start(t); lfo.start(t); o.start(t); trem.start(t);
    lanc = { ki, pan };
  }
  return {
    // hol: a forrás helye; ero: 0–1 (pl. éjszaka mennyire sötét); hol nélkül elnémul
    allit(hol, ero = 1) {
      if (!ctx || ctx.state !== 'running') return;
      if (!lanc) felepit();
      const tr = be && hol ? terben(hol) : null;
      const g = tr ? tr.g * ero * 0.8 : 0;
      lanc.ki.gain.setTargetAtTime(g, ctx.currentTime, 0.1);
      if (lanc.pan && tr) lanc.pan.pan.setTargetAtTime(tr.pan, ctx.currentTime, 0.1);
    },
  };
}
