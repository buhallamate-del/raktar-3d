import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { epitModell, normalKod, helyElotti, folyosoSzelesseg } from './modell.js';
import { inditKozos } from './kozos.js';
import { inditJatek } from './jatek.js';
import { inditTargoncak } from './targonca.js';
import { inditEjszaka } from './ejszaka.js';
import { inditCtf } from './ctf.js';
import { inditKocsi } from './kocsi.js';

const C = window.RAKTAR_CONFIG;
const D = window.RAKTAR_ADATOK;
const $ = id => document.getElementById(id);
const ERINTES = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (ERINTES) document.body.classList.add('erintes');

if (!C || !D) {
  hiba(!C ? 'A config.js nem töltődött be (vagy szintaktikai hibás).' : 'A data/adatok.js nem töltődött be.');
  throw new Error('hiányzó konfiguráció vagy adat');
}

let M;
try {
  M = epitModell(D, C);
} catch (e) {
  hiba('Hiba a modell számításakor: ' + e.message);
  throw e;
}
for (const f of M.figyelmeztetesek) console.warn('[raktár]', f);

function hiba(szoveg) {
  const b = $('betoltes');
  b.hidden = false;
  b.classList.add('hiba');
  b.textContent = szoveg;
}

// ---------------------------------------------------------------------
// Alap jelenet. Koordináták: világ X = táblázat X, világ Z = táblázat Y,
// világ Y = magasság. Felülnézetben így a táblázat Y-ja lefelé nő.
// ---------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
$('vaszon').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e4e9f0');
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 3000);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a909c, 2.2);
scene.add(hemi);
const nap = new THREE.DirectionalLight(0xffffff, 1.6);
nap.position.set(-40, 80, 30);
scene.add(nap);

const KOCKA = new THREE.BoxGeometry(1, 1, 1);
const FEHER_SZIN = new THREE.Color('#ffffff');
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
function dobozMatrix(mesh, i, cx, cy, cz, sx, sy, sz) {
  _p.set(cx, cy, cz); _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
}

const H = M.hatar;
const kozep = { x: (H.x0 + H.x1) / 2, y: (H.y0 + H.y1) / 2 };
const maxMagassag = Math.max(...M.helyek.map(h => h.H));

// ---------------------------------------------------------------------
// Szöveg-textúrák
// ---------------------------------------------------------------------
function szovegCanvas(sorok, { meret = 64, szin = '#1d2430', hatter = null, keret = null, pad = 0.35, betu = 'bold' } = {}) {
  sorok = Array.isArray(sorok) ? sorok : [sorok];
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const font = `${betu} ${meret}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.font = font;
  const szel = Math.max(...sorok.map(s => ctx.measureText(s).width));
  const p = meret * pad;
  cv.width = Math.ceil(szel + 2 * p);
  cv.height = Math.ceil(sorok.length * meret * 1.2 + 2 * p - meret * 0.2);
  if (hatter) {
    ctx.fillStyle = hatter;
    ctx.beginPath();
    ctx.roundRect(0, 0, cv.width, cv.height, meret * 0.25);
    ctx.fill();
  }
  if (keret) {
    ctx.strokeStyle = keret;
    ctx.lineWidth = meret * 0.12;
    ctx.beginPath();
    ctx.roundRect(ctx.lineWidth / 2, ctx.lineWidth / 2, cv.width - ctx.lineWidth, cv.height - ctx.lineWidth, meret * 0.25);
    ctx.stroke();
  }
  ctx.font = font;
  ctx.fillStyle = szin;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  sorok.forEach((s, i) => ctx.fillText(s, cv.width / 2, p + i * meret * 1.2));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, arany: cv.width / cv.height };
}

function szovegSprite(sorok, magassag, opciok = {}) {
  const { tex, arany } = szovegCanvas(sorok, opciok);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: opciok.depthTest ?? true, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(magassag * arany, magassag, 1);
  if (opciok.depthTest === false) s.renderOrder = 10;
  return s;
}

// Fekvő felirat a padlón; szog = 0: balról jobbra olvasható felülnézetben.
function padloFelirat(szoveg, x, y, magassag, szog = 0, opciok = {}) {
  const { tex, arany } = szovegCanvas(szoveg, opciok);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(magassag * arany, magassag),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.set(-Math.PI / 2, 0, szog);
  mesh.position.set(x, opciok.emeles ?? 0.02, y);
  mesh.renderOrder = 2;
  return mesh;
}

function csikosTextura() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#d0261b';
  for (let i = -64; i < 128; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + 16, 0); ctx.lineTo(i + 16 - 64, 64); ctx.lineTo(i - 64, 64);
    ctx.closePath(); ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const CSIKOS = csikosTextura();
function csikosAnyag(hossz, szel, opacity = 0.85) {
  const t = CSIKOS.clone();
  t.needsUpdate = true;
  t.repeat.set(Math.max(1, hossz / 0.8), Math.max(1, szel / 0.8));
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity, depthWrite: false });
}

// Fekvő téglalap a padlón (x0..x1, y0..y1).
function padloTeglalap(x0, y0, x1, y1, anyag, emeles = 0.01) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0)), anyag);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((x0 + x1) / 2, emeles, (y0 + y1) / 2);
  mesh.renderOrder = 1;
  return mesh;
}

// ---------------------------------------------------------------------
// Padló, komissiózó, kiindulópont
// ---------------------------------------------------------------------
const udvarok = [C.arukiado, ...(C.udvarok || [])].filter(Boolean);
const padloMeret = {
  x0: Math.min(H.x0, ...udvarok.map(u => u.x)) - 8,
  y0: Math.min(H.y0, ...udvarok.map(u => u.y)) - 8,
  x1: Math.max(H.x1, ...udvarok.map(u => u.x + u.szel)) + 8,
  y1: Math.max(H.y1, ...udvarok.map(u => u.y + u.mely)) + 8,
};
{
  // beton: finom, foltos zaj, 4 m-enként ismétlődve
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#b9bec4'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 150 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgba(${v},${v + 3},${v + 6},0.25)`;
    const r = 1 + Math.random() * 6;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, r, r);
  }
  ctx.strokeStyle = 'rgba(90,95,100,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, 256, 256); // dilatációs hézag
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set((padloMeret.x1 - padloMeret.x0) / 4, (padloMeret.y1 - padloMeret.y0) / 4);
  tex.anisotropy = 8;
  scene.add(padloTeglalap(padloMeret.x0, padloMeret.y0, padloMeret.x1, padloMeret.y1,
    new THREE.MeshLambertMaterial({ map: tex }), 0));
}
{
  const racs = new THREE.GridHelper(Math.ceil(Math.max(H.x1 - H.x0, H.y1 - H.y0) / 5) * 5 + 20,
    Math.ceil(Math.max(H.x1 - H.x0, H.y1 - H.y0) / 5) + 4, 0xb4bcc8, 0xb4bcc8);
  racs.position.set(Math.round(kozep.x / 5) * 5, 0.003, Math.round(kozep.y / 5) * 5);
  racs.material.transparent = true; racs.material.opacity = 0.5;
  scene.add(racs);
}
const kom = C.komissiozo;
if (kom) {
  scene.add(padloTeglalap(kom.x, kom.y, kom.x + kom.szel, kom.y + kom.mely,
    new THREE.MeshBasicMaterial({ color: '#bfe3c8', transparent: true, opacity: 0.85, depthWrite: false }), 0.006));
  scene.add(padloFelirat('KOMISSIÓZÓ – lerakó terület', kom.x + kom.szel / 2, kom.y + kom.mely * 0.35, 1.2, 0,
    { szin: '#2b7a3d' }));
}
const kom2 = C.komissiozoEloter;
if (kom2) {
  scene.add(padloTeglalap(kom2.x, kom2.y, kom2.x + kom2.szel, kom2.y + kom2.mely,
    new THREE.MeshBasicMaterial({ color: '#dcefe0', transparent: true, opacity: 0.8, depthWrite: false }), 0.005));
  scene.add(padloFelirat('komissiózó előtér', kom2.x + kom2.szel / 2, kom2.y + kom2.mely * 0.6, 0.8, 0, { szin: '#4d8a5b' }));
}
const kom3 = C.komissiozoBejarat;
if (kom3) {
  scene.add(padloTeglalap(kom3.x, kom3.y, kom3.x + kom3.szel, kom3.y + kom3.mely,
    new THREE.MeshBasicMaterial({ color: '#bfe3c8', transparent: true, opacity: 0.9, depthWrite: false }), 0.007));
  scene.add(padloFelirat('bejárat', kom3.x + kom3.szel / 2, kom3.y + kom3.mely / 2, 0.6, 0, { szin: '#2b7a3d', emeles: 0.02 }));
}
for (const aru of udvarok) {
  scene.add(padloTeglalap(aru.x, aru.y, aru.x + aru.szel, aru.y + aru.mely,
    new THREE.MeshLambertMaterial({ color: '#8d939b' }), 0.004));
  scene.add(padloFelirat(aru.nev || 'UDVAR', aru.x + aru.szel / 2, aru.y + aru.mely / 2, 1.0,
    aru.mely > aru.szel ? Math.PI / 2 : 0, { szin: '#f4f6f8' }));
  // a fedett udvar teteje: csak a széle (felülnézetben ne takarjon)
  const teto = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(aru.szel, 0.01, aru.mely)),
    new THREE.LineBasicMaterial({ color: '#5d6878' }));
  teto.position.set(aru.x + aru.szel / 2, 4.5, aru.y + aru.mely / 2);
  scene.add(teto);
}
// Ajtók / kapuk kerete (config.js: ajtok)
for (const a of C.ajtok || []) {
  const fel = Number(a.szel ?? 2) / 2, mag = a.vag === false ? 2.2 : 3.2;
  const anyag = new THREE.MeshLambertMaterial({ color: a.szin || '#1f6feb' });
  const fugg = M.falak.some(([x1, , x2]) => Math.abs(x1 - a.x) < 0.15 && Math.abs(x2 - a.x) < 0.15);
  for (const s of [-1, 1]) {
    const o = new THREE.Mesh(KOCKA, anyag);
    o.scale.set(0.25, mag, 0.25);
    o.position.set(a.x + (fugg ? 0 : s * fel), mag / 2, a.y + (fugg ? s * fel : 0));
    scene.add(o);
  }
  const fent = new THREE.Mesh(KOCKA, anyag);
  fent.scale.set(fugg ? 0.25 : 2 * fel + 0.25, 0.25, fugg ? 2 * fel + 0.25 : 0.25);
  fent.position.set(a.x, mag, a.y);
  // áttetsző kék szalagfüggöny
  // vágott nyílásnál áttetsző függöny, csak jelölt ajtónál (vag: false) tömör ajtólap
  const fuggony = new THREE.Mesh(new THREE.PlaneGeometry(2 * fel, a.vag === false ? 2.1 : mag),
    new THREE.MeshBasicMaterial({ color: a.szin || '#1f6feb', transparent: true, opacity: a.vag === false ? 0.9 : 0.25, side: THREE.DoubleSide, depthWrite: false }));
  fuggony.position.set(a.x, a.vag === false ? 1.05 : mag / 2, a.y + (a.vag === false && !fugg ? 0.12 : 0));
  if (fugg) fuggony.rotation.y = Math.PI / 2;
  const t = szovegSprite(a.nev, 0.7, { hatter: a.szin || '#1f6feb', szin: '#fff', meret: 48 });
  t.material.userData.vilagit = true; // éjszaka is látszik, mint egy kijárat-tábla
  t.position.set(a.x, mag + 0.8, a.y);
  scene.add(fent, fuggony, t);
}
// Egyéb padlóterületek (config.js: teruletek)
for (const t of C.teruletek || []) {
  scene.add(padloTeglalap(t.x, t.y, t.x + t.szel, t.y + t.mely,
    new THREE.MeshBasicMaterial({ color: t.szin || '#e8e2d0', transparent: true, opacity: 0.8, depthWrite: false }), 0.006));
  scene.add(padloFelirat(t.nev, t.x + t.szel / 2, t.y + t.mely / 2, Math.min(1.2, t.mely * 0.18), 0, { szin: '#6b5a2e' }));
}
// Kód nélküli állványok (config.js: egyebAllvanyok) – tömör blokk szintekkel
for (const a of C.egyebAllvanyok || []) {
  const x0 = Math.min(a.x0, a.x1), x1 = Math.max(a.x0, a.x1), y0 = Math.min(a.y0, a.y1), y1 = Math.max(a.y0, a.y1);
  const mag = Number(a.magassag ?? 4), szint = Math.max(1, Number(a.szintek ?? 3));
  const szin = new THREE.Color(a.szin || '#777');
  if (a.tomor) {
    // zárt rekesz / helyiség: tömör doboz
    const doboz = new THREE.Mesh(KOCKA, new THREE.MeshLambertMaterial({ color: szin }));
    doboz.scale.set(x1 - x0, mag, y1 - y0);
    doboz.position.set((x0 + x1) / 2, mag / 2, (y0 + y1) / 2);
    const t = szovegSprite(a.nev, 0.6, { hatter: '#6b4f2a', szin: '#fff', meret: 48 });
    t.position.set((x0 + x1) / 2, mag + 0.7, (y0 + y1) / 2);
    scene.add(doboz, t);
    continue;
  }
  const kAlso = Number(a.alsoMagassag ?? 0);
  const keret = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(x1 - x0, mag - kAlso, y1 - y0)),
    new THREE.LineBasicMaterial({ color: szin }));
  keret.position.set((x0 + x1) / 2, (mag + kAlso) / 2, (y0 + y1) / 2);
  scene.add(keret);
  const polcAnyag = new THREE.MeshLambertMaterial({ color: szin.clone().lerp(FEHER_SZIN, 0.55) });
  const also = Number(a.alsoMagassag ?? 0);
  for (let k = 0; k <= szint; k++) {
    const y = k === 0 ? 0.05 : (k * mag) / szint;
    if (y < also - 0.01) continue;
    const p = new THREE.Mesh(KOCKA, polcAnyag);
    p.scale.set(x1 - x0, 0.06, y1 - y0);
    p.position.set((x0 + x1) / 2, y, (y0 + y1) / 2);
    scene.add(p);
  }
  if (also > 0) {
    // a nyílás fölötti gerenda
    const g = new THREE.Mesh(KOCKA, new THREE.MeshLambertMaterial({ color: '#e0662a' }));
    g.scale.set(x1 - x0, 0.12, y1 - y0);
    g.position.set((x0 + x1) / 2, also, (y0 + y1) / 2);
    scene.add(g);
  }
  if (a.felirat !== false) {
    const t = szovegSprite(a.nev, 0.8, { hatter: a.szin || '#777', szin: '#fff', meret: 48 });
    t.position.set((x0 + x1) / 2, mag + 0.8, (y0 + y1) / 2);
    scene.add(t);
  }
}
// Kerítések (config.js: keritesek): oszlopok, korlát és áttetsző háló
{
  const oszlopAnyag = new THREE.MeshLambertMaterial({ color: '#6b7684' });
  const haloAnyag = new THREE.MeshBasicMaterial({ color: '#8d99a8', transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  for (const [x1, y1, x2, y2] of C.keritesek || []) {
    const hossz = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(hossz / 2.5));
    for (let i = 0; i <= n; i++) {
      const o = new THREE.Mesh(KOCKA, oszlopAnyag);
      o.scale.set(0.08, 2.2, 0.08);
      o.position.set(x1 + (x2 - x1) * i / n, 1.1, y1 + (y2 - y1) * i / n);
      scene.add(o);
    }
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(hossz, 2.1), haloAnyag);
    halo.position.set((x1 + x2) / 2, 1.1, (y1 + y2) / 2);
    halo.rotation.y = -Math.atan2(y2 - y1, x2 - x1);
    scene.add(halo);
  }
}
// Tereptárgyak (config.js: tereptargyak)
for (const t of C.tereptargyak || []) {
  const d = new THREE.Mesh(KOCKA, new THREE.MeshLambertMaterial({ color: t.szin || '#888' }));
  d.scale.set(t.szel, t.mag, t.mely);
  d.position.set(t.x, t.mag / 2, t.y);
  scene.add(d);
  if (t.felirat && t.nev) {
    const f = szovegSprite(t.nev, 0.45, { hatter: '#444', szin: '#fff', meret: 44 });
    f.position.set(t.x, t.mag + 0.6, t.y);
    scene.add(f);
  }
}
// Galériák (config.js: galeriak) – áttetsző padló kék oszlopokkal, korláttal, lépcsővel
for (const g of C.galeriak || []) {
  const mag = Number(g.magassag ?? 3);
  const kek = new THREE.MeshLambertMaterial({ color: '#2b4fa8' });
  const padloAnyag = new THREE.MeshLambertMaterial({ color: '#b9c3d6', transparent: true, opacity: 0.45, depthWrite: false });
  const korlatAnyag = new THREE.LineBasicMaterial({ color: '#2b4fa8' });
  for (const [x0, y0, x1, y1] of g.reszek || []) {
    const lap = new THREE.Mesh(KOCKA, padloAnyag);
    lap.scale.set(x1 - x0, 0.15, y1 - y0);
    lap.position.set((x0 + x1) / 2, mag, (y0 + y1) / 2);
    lap.renderOrder = 3;
    scene.add(lap);
    // oszlopok a széleken kb. 4 m-enként
    const nx = Math.max(1, Math.round((x1 - x0) / 4)), ny = Math.max(1, Math.round((y1 - y0) / 4));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      if (i > 0 && i < nx && j > 0 && j < ny) continue;
      const o = new THREE.Mesh(KOCKA, kek);
      o.scale.set(0.18, mag, 0.18);
      o.position.set(x0 + (x1 - x0) * i / nx, mag / 2, y0 + (y1 - y0) * j / ny);
      scene.add(o);
    }
    const korlat = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(x1 - x0, 1.1, y1 - y0)), korlatAnyag);
    korlat.position.set((x0 + x1) / 2, mag + 0.55, (y0 + y1) / 2);
    scene.add(korlat);
  }
  const l = g.lepcso;
  if (l) {
    const menten = l.irany === '+X' || l.irany === '-X';
    const hossz = menten ? Math.abs(l.x1 - l.x0) : Math.abs(l.y1 - l.y0);
    const n = Math.max(4, Math.round(mag / 0.19));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, fok = new THREE.Mesh(KOCKA, kek);
      const elore = l.irany.startsWith('+') ? t : 1 - t;
      const cx = menten ? Math.min(l.x0, l.x1) + elore * hossz : (l.x0 + l.x1) / 2;
      const cy = menten ? (l.y0 + l.y1) / 2 : Math.min(l.y0, l.y1) + elore * hossz;
      fok.scale.set(menten ? hossz / n : Math.abs(l.x1 - l.x0), 0.05, menten ? Math.abs(l.y1 - l.y0) : hossz / n);
      fok.position.set(cx, mag * (k + 1) / n, cy);
      scene.add(fok);
    }
    const t = szovegSprite('Lépcső a galériára', 0.5, { hatter: '#2b4fa8', szin: '#fff', meret: 44 });
    t.position.set((l.x0 + l.x1) / 2, mag + 1.4, (l.y0 + l.y1) / 2);
    scene.add(t);
  }
  if (g.leado) {
    const d = g.leado, fel = Number(d.szel ?? 2) / 2;
    const kapu = new THREE.Mesh(new THREE.PlaneGeometry(2 * fel, 1.1),
      new THREE.MeshBasicMaterial({ color: '#1f6feb', transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    kapu.position.set(d.x, mag + 0.6, d.y);
    kapu.rotation.y = Math.PI / 2;
    const t = szovegSprite(d.nev || 'Feladó / lerakó', 0.5, { hatter: '#1f6feb', szin: '#fff', meret: 44 });
    t.position.set(d.x, mag + 1.8, d.y);
    scene.add(kapu, t);
  }
  const cim = szovegSprite(g.nev || 'GALÉRIA', 0.9, { hatter: '#2b4fa8', szin: '#fff', meret: 56 });
  const [ax0, ay0, ax1, ay1] = g.reszek[0];
  cim.position.set((ax0 + ax1) / 2, mag + 2.6, (ay0 + ay1) / 2);
  scene.add(cim);
}
// Gépek (config.js: gepek)
for (const g of C.gepek || []) {
  const r = Number(g.r ?? 0.5);
  const asztal = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 32), new THREE.MeshLambertMaterial({ color: '#c0562b' }));
  asztal.position.set(g.x, 0.06, g.y);
  const oszlop = new THREE.Mesh(KOCKA, new THREE.MeshLambertMaterial({ color: '#222' }));
  oszlop.scale.set(0.25, 2.6, 0.25);
  oszlop.position.set(g.x + r + 0.15, 1.3, g.y);
  const t = szovegSprite(g.nev, 0.6, { hatter: '#444', szin: '#fff', meret: 48, depthTest: false });
  t.position.set(g.x, 3.2, g.y);
  scene.add(asztal, oszlop, t);
}
{
  const k = D.kulcsok.kiindulo;
  const g = new THREE.Group();
  const korong = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 32), new THREE.MeshLambertMaterial({ color: '#1e9e48' }));
  korong.position.y = 0.02;
  const rud = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), new THREE.MeshLambertMaterial({ color: '#1e9e48' }));
  rud.position.y = 1.3;
  const t = szovegSprite(['Kiindulópont', '(komissiózó lerakó közepe)'], 0.9, { hatter: '#1e9e48', szin: '#fff', meret: 48 });
  t.position.y = 3.1;
  g.add(korong, rud, t);
  g.position.set(k.x, 0, k.y);
  scene.add(g);
}

// ---------------------------------------------------------------------
// Folyosók a padlón
// ---------------------------------------------------------------------
const feltFolyosok = new Set();
const feltSorok = new Set();
for (const t of M.feltetelezesek) {
  for (const h of t.horgonyok) {
    if (h.tipus === 'folyoso') feltFolyosok.add(h.id);
    if (h.tipus === 'sorok') h.kulcsok.forEach(k => feltSorok.add(k));
  }
}
const folyosoCsoport = new THREE.Group();
scene.add(folyosoCsoport);
for (const f of M.folyosok.values()) {
  if (f.c == null) continue;
  const gerinc = f.tipus === 'gerinc';
  const a = f.min - (gerinc ? 0 : 0.4), b = f.max + (gerinc ? f.szel / 2 : 0);
  const [x0, y0, x1, y1] = f.tengely === 'X'
    ? [a, f.c - f.szel / 2, b, f.c + f.szel / 2]
    : [f.c - f.szel / 2, a, f.c + f.szel / 2, b];
  const anyag = new THREE.MeshBasicMaterial({
    color: gerinc ? '#a9cdf3' : '#f2e3a0', transparent: true, opacity: 0.35, depthWrite: false,
  });
  folyosoCsoport.add(padloTeglalap(x0, y0, x1, y1, anyag, gerinc ? 0.008 : 0.009));
  // sárga padlójelölés a folyosó két szélén (mint a fotókon)
  const sarga = new THREE.MeshBasicMaterial({ color: '#e8b800' });
  if (f.tengely === 'X') {
    folyosoCsoport.add(padloTeglalap(x0, y0, x1, y0 + 0.08, sarga, 0.011), padloTeglalap(x0, y1 - 0.08, x1, y1, sarga, 0.011));
  } else {
    folyosoCsoport.add(padloTeglalap(x0, y0, x0 + 0.08, y1, sarga, 0.011), padloTeglalap(x1 - 0.08, y0, x1, y1, sarga, 0.011));
  }
  const hossz = b - a;
  const felMagas = Math.min(0.9, f.szel * 0.55);
  const fx = f.tengely === 'X' ? (a + b) / 2 : f.c;
  const fy = f.tengely === 'X' ? f.c : (a + b) / 2;
  folyosoCsoport.add(padloFelirat(f.id, fx, fy, felMagas, f.tengely === 'X' ? 0 : Math.PI / 2,
    { szin: gerinc ? '#1d5fa8' : '#7a6200', emeles: 0.015 }));
  f.padlo = { x0, y0, x1, y1, hossz };
}

// ---------------------------------------------------------------------
// Falak
// ---------------------------------------------------------------------
// felülnézetben áttetsző szürke, belső nézetben tömör fehér falak (lásd modValt)
const FAL_ANYAG = new THREE.MeshLambertMaterial({ color: '#9aa4b2', transparent: true, opacity: 0.6 });
const VALASZFAL_ANYAG = new THREE.MeshLambertMaterial({ color: '#7d8796', transparent: true, opacity: 0.7 });
function falakMod(seta) {
  FAL_ANYAG.color.set(seta ? '#eceeef' : '#9aa4b2'); FAL_ANYAG.opacity = seta ? 1 : 0.6; FAL_ANYAG.transparent = !seta;
  VALASZFAL_ANYAG.color.set(seta ? '#e2e5e8' : '#7d8796'); VALASZFAL_ANYAG.opacity = seta ? 1 : 0.7; VALASZFAL_ANYAG.transparent = !seta;
  FAL_ANYAG.needsUpdate = VALASZFAL_ANYAG.needsUpdate = true;
  mennyezetCsoport.visible = seta;
  scene.fog = seta ? new THREE.Fog('#dfe3e8', 35, 140) : null;
}
const falCsoport = new THREE.Group();
scene.add(falCsoport);
{
  const vast = Number(C.falVastagsag ?? 0.2), mag = Number(C.falMagassag ?? 3);
  const anyag = FAL_ANYAG, valAnyag = VALASZFAL_ANYAG;
  const fal = ([x1, y1, x2, y2], a, m) => {
    const w = Math.abs(x2 - x1) + vast, d = Math.abs(y2 - y1) + vast;
    const mesh = new THREE.Mesh(KOCKA, a);
    mesh.scale.set(w, m, d);
    mesh.position.set((x1 + x2) / 2, m / 2, (y1 + y2) / 2);
    falCsoport.add(mesh);
  };
  M.falak.forEach(f => fal(f, anyag, mag));
  M.valaszfalak.forEach(f => fal(f, valAnyag, mag));
}

// ---------------------------------------------------------------------
// Állványok (példányosított hálók: oszlopok, polcok, gerendák)
// ---------------------------------------------------------------------
let nOszlop = 0, nPolc = 0, nGerenda = 0;
for (const h of M.helyek) { nPolc += h.L; nGerenda += 2 * h.L; }
nOszlop = 4 * M.rekeszek.length;
const allvanyCsoport = new THREE.Group();
scene.add(allvanyCsoport);
const oszlopok = new THREE.InstancedMesh(KOCKA, new THREE.MeshLambertMaterial(), nOszlop);
const polcok = new THREE.InstancedMesh(KOCKA, new THREE.MeshLambertMaterial(), nPolc);
const gerendak = new THREE.InstancedMesh(KOCKA, new THREE.MeshLambertMaterial(), nGerenda);
const valaszto = new THREE.InstancedMesh(KOCKA, new THREE.MeshBasicMaterial(), M.helyek.length);
valaszto.visible = false; // csak kattintás-felismeréshez
const peldanyHely = { oszlop: [], polc: [], gerenda: [] };
{
  let io = 0, ip = 0, ig = 0;
  // oszlopok rekeszenként (config.js: oszlopKiosztas), a rekesz négy sarkán
  for (const r of M.rekeszek) {
    const p = Math.min(0.08, r.w * 0.14);
    const xs = [r.x0 + p / 2, r.x1 - p / 2], zs = [r.y0 + p / 2, r.y1 - p / 2];
    for (const x of xs) for (const z of zs) {
      dobozMatrix(oszlopok, io, x, r.H / 2, z, p, r.H, p);
      peldanyHely.oszlop[io++] = r.tagok[0];
    }
  }
  for (const h of M.helyek) {
    const sx = h.x1 - h.x0, sz = h.y1 - h.y0;
    for (let k = 0; k < h.L; k++) {
      const y = k === 0 ? 0.05 : (k * h.H) / h.L;
      dobozMatrix(polcok, ip, h.x, y, h.y, sx - 0.02, 0.03, sz - 0.02);
      peldanyHely.polc[ip++] = h.i;
    }
    for (let k = 1; k <= h.L; k++) {
      const y = (k * h.H) / h.L;
      if (h.irany === 'X') {
        dobozMatrix(gerendak, ig, h.x, y, h.y0 + 0.03, sx, 0.09, 0.06); peldanyHely.gerenda[ig++] = h.i;
        dobozMatrix(gerendak, ig, h.x, y, h.y1 - 0.03, sx, 0.09, 0.06); peldanyHely.gerenda[ig++] = h.i;
      } else {
        dobozMatrix(gerendak, ig, h.x0 + 0.03, y, h.y, 0.06, 0.09, sz); peldanyHely.gerenda[ig++] = h.i;
        dobozMatrix(gerendak, ig, h.x1 - 0.03, y, h.y, 0.06, 0.09, sz); peldanyHely.gerenda[ig++] = h.i;
      }
    }
    dobozMatrix(valaszto, h.i, h.x, h.H / 2, h.y, sx, h.H, sz);
  }
  for (const m of [oszlopok, polcok, gerendak, valaszto]) {
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }
  allvanyCsoport.add(oszlopok, polcok, gerendak, valaszto);
}

const RAJZ_PALETTA = ['#1f77b4', '#b8bec8', '#2ca02c', '#98df8a', '#ff7f0e', '#d62728', '#9467bd', '#8c564b'];
const rajzErtekek = [...new Set(M.helyek.map(h => h.rajzon || '–'))];
const rajzSzin = Object.fromEntries(rajzErtekek.map((r, i) => [r, RAJZ_PALETTA[i % RAJZ_PALETTA.length]]));
const MJ = C.megjelenes || {};
let szinezesMod = MJ.szinezes || 'zona';
function helySzin(h) {
  return new THREE.Color(szinezesMod === 'rajzon' ? rajzSzin[h.rajzon || '–'] : h.szin);
}
const FEHER = new THREE.Color('#ffffff');
function szinez() {
  if (szinezesMod === 'valos') {
    // a fotók szerinti színek zónánként (oszlop, gerenda, polc)
    const vs = MJ.valosSzinek || {};
    const vsz = h => vs[h.zona] || vs[h.zonaFo] || { oszlop: '#b4bac2', gerenda: '#e0662a', polc: '#c9ced4' };
    const cache = new Map();
    const c = (s) => { if (!cache.has(s)) cache.set(s, new THREE.Color(s)); return cache.get(s); };
    peldanyHely.oszlop.forEach((hi, i) => oszlopok.setColorAt(i, c(vsz(M.helyek[hi]).oszlop)));
    peldanyHely.gerenda.forEach((hi, i) => gerendak.setColorAt(i, c(vsz(M.helyek[hi]).gerenda)));
    peldanyHely.polc.forEach((hi, i) => polcok.setColorAt(i, c(vsz(M.helyek[hi]).polc)));
    for (const m of [oszlopok, polcok, gerendak]) m.instanceColor.needsUpdate = true;
    jelmagyarazat();
    return;
  }
  const szinek = M.helyek.map(helySzin);
  peldanyHely.oszlop.forEach((hi, i) => oszlopok.setColorAt(i, szinek[hi].clone().multiplyScalar(0.8)));
  peldanyHely.gerenda.forEach((hi, i) => gerendak.setColorAt(i, szinek[hi]));
  peldanyHely.polc.forEach((hi, i) => polcok.setColorAt(i, szinek[hi].clone().lerp(FEHER, 0.62)));
  for (const m of [oszlopok, polcok, gerendak]) m.instanceColor.needsUpdate = true;
  jelmagyarazat();
}

// ---------------------------------------------------------------------
// Áru a polcokon (modell.aruk): raklap + kartondoboz / fóliázott áru, a T2-ben kisebb dobozok
// ---------------------------------------------------------------------
{
  const raklaposak = M.aruk.filter(a => a.raklap);
  const raklapok = new THREE.InstancedMesh(KOCKA, new THREE.MeshLambertMaterial({ color: '#b98a52' }), Math.max(1, raklaposak.length));
  const aruHalo = new THREE.InstancedMesh(KOCKA, new THREE.MeshLambertMaterial(), Math.max(1, M.aruk.length));
  const paletta = ['#c49a6c', '#b88a5a', '#d2ad7c', '#e9e7df', '#dcdad2', '#4f5560', '#8c6a45'].map(s => new THREE.Color(s));
  let ir = 0;
  M.aruk.forEach((a, i) => {
    const sx = 2 * a.hx, sz = 2 * a.hy;
    if (a.raklap) {
      dobozMatrix(raklapok, ir++, a.x, a.z0 + 0.07, a.y, sx, 0.14, sz);
      const fel = a.z0 + 0.14;
      dobozMatrix(aruHalo, i, a.x, (fel + a.z1) / 2, a.y, sx * 0.96, a.z1 - fel, sz * 0.96);
    } else {
      dobozMatrix(aruHalo, i, a.x, (a.z0 + a.z1) / 2, a.y, sx, a.z1 - a.z0, sz);
    }
    aruHalo.setColorAt(i, paletta[Math.floor(a.r * 997) % paletta.length]);
  });
  raklapok.count = ir;
  aruHalo.count = M.aruk.length;
  for (const m of [raklapok, aruHalo]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  if (aruHalo.instanceColor) aruHalo.instanceColor.needsUpdate = true;
  if (M.aruk.length) allvanyCsoport.add(raklapok, aruHalo);
}
// Sárga oszlopvédők a raklapos sorok végein, a folyosó felőli sarkokon
if (MJ.oszlopvedok !== false) {
  const vedok = [];
  for (const hs of M.csoportok.values()) {
    if (!['T1', 'T4'].includes(hs[0].zonaFo) || new Set(hs.map(h => h.irany)).size > 1) continue;
    const h0 = hs[0], ax = h0.irany === 'X';
    const a = Math.min(...hs.map(h => (ax ? h.x0 : h.y0))), b = Math.max(...hs.map(h => (ax ? h.x1 : h.y1)));
    const elol = ax ? (h0.ny > 0 ? Math.max(...hs.map(h => h.y1)) : Math.min(...hs.map(h => h.y0)))
      : (h0.nx > 0 ? Math.max(...hs.map(h => h.x1)) : Math.min(...hs.map(h => h.x0)));
    const n = ax ? h0.ny : h0.nx;
    for (const v of [a + 0.06, b - 0.06]) vedok.push(ax ? [v, elol - n * 0.06] : [elol - n * 0.06, v]);
  }
  const vedo = new THREE.InstancedMesh(KOCKA, new THREE.MeshLambertMaterial({ color: '#f2c200' }), Math.max(1, vedok.length));
  vedok.forEach(([x, y], i) => dobozMatrix(vedo, i, x, 0.2, y, 0.2, 0.4, 0.2));
  vedo.count = vedok.length;
  vedo.instanceMatrix.needsUpdate = true; vedo.computeBoundingSphere();
  allvanyCsoport.add(vedo);
}
// Mennyezet LED-sorokkal (csak belső nézetben látszik); éjszaka az ejszaka.js tompítja
const LED_ANYAG = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const CIMKE_ANYAGOK = []; // a helykód-címkék anyagai (éjszaka a saját fényük tompul)
LED_ANYAG.userData.vilagit = true;
const mennyezetCsoport = new THREE.Group();
mennyezetCsoport.visible = false;
scene.add(mennyezetCsoport);
{
  const mm = Number(MJ.mennyezetMagassag ?? 8.5);
  const lapAnyag = new THREE.MeshLambertMaterial({ color: '#f1f3f5', side: THREE.DoubleSide });
  for (const [x0, y0, x1, y1] of MJ.mennyezet || []) {
    const lap = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), lapAnyag);
    lap.rotation.x = Math.PI / 2;
    lap.position.set((x0 + x1) / 2, mm, (y0 + y1) / 2);
    mennyezetCsoport.add(lap);
  }
  // fénycsíkok a folyosók fölött
  const fenyAnyag = LED_ANYAG;
  for (const f of M.folyosok.values()) {
    if (!f.padlo || f.tipus === 'gerinc') continue;
    const { x0, y0, x1, y1 } = f.padlo, ax = f.tengely === 'X';
    const l = new THREE.Mesh(KOCKA, fenyAnyag);
    l.scale.set(ax ? x1 - x0 - 1 : 0.12, 0.05, ax ? 0.12 : y1 - y0 - 1);
    l.position.set((x0 + x1) / 2, mm - 0.05, (y0 + y1) / 2);
    mennyezetCsoport.add(l);
  }
}

// ---------------------------------------------------------------------
// Helykód-címkék: egy közös textúra-atlasz, két összevont háló (elöl, felül)
// ---------------------------------------------------------------------
const cimkeCsoport = new THREE.Group();
scene.add(cimkeCsoport);
{
  const CW = 128, CH = 32, ATLAS = 2048;
  const perSor = ATLAS / CW, perAtlasz = perSor * (ATLAS / CH);
  const atlaszSzam = Math.ceil(M.helyek.length / perAtlasz);
  for (let a = 0; a < atlaszSzam; a++) {
    const helyek = M.helyek.slice(a * perAtlasz, (a + 1) * perAtlasz);
    const cv = document.createElement('canvas');
    cv.width = cv.height = ATLAS;
    const ctx = cv.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pos = [], uv = [], idx = [];
    helyek.forEach((h, j) => {
      const px = (j % perSor) * CW, py = Math.floor(j / perSor) * CH;
      ctx.fillStyle = h.jeloletlen ? '#fff1a8' : '#ffffff';
      ctx.fillRect(px + 1, py + 1, CW - 2, CH - 2);
      ctx.fillStyle = h.szin;
      ctx.fillRect(px + 1, py + 1, 7, CH - 2);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, CW - 4, CH - 4);
      let meret = 24;
      ctx.font = `bold ${meret}px system-ui, Arial, sans-serif`;
      while (ctx.measureText(h.kod).width > CW - 18 && meret > 10) {
        meret--; ctx.font = `bold ${meret}px system-ui, Arial, sans-serif`;
      }
      ctx.fillStyle = '#111';
      ctx.fillText(h.kod, px + 4 + CW / 2, py + CH / 2 + 1);
      const u0 = px / ATLAS, u1 = (px + CW) / ATLAS, vT = 1 - py / ATLAS, vB = 1 - (py + CH) / ATLAS;
      const negyszog = (cx, cy, cz, R, U, w, hh) => {
        const b = pos.length / 3;
        for (const [sr, su] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          pos.push(cx + R[0] * sr * w / 2 + U[0] * su * hh / 2,
            cy + R[1] * sr * w / 2 + U[1] * su * hh / 2,
            cz + R[2] * sr * w / 2 + U[2] * su * hh / 2);
        }
        uv.push(u0, vB, u1, vB, u1, vT, u0, vT);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      };
      // elöl, a folyosó felé
      const R = [h.ny, 0, -h.nx]; // a szöveg iránya: (-homlok) × fel
      const lw = Math.min(h.w * 0.92, 0.9), lh = lw / 4;
      negyszog(h.x + h.nx * (h.h + 0.035), h.cimkeY, h.y + h.ny * (h.h + 0.035), R, [0, 1, 0], lw, lh);
      // felül, fekve
      const dx = h.x1 - h.x0, dz = h.y1 - h.y0;
      const vizszintes = dx >= dz * 0.75;
      const hossz = vizszintes ? dx : dz, masik = vizszintes ? dz : dx;
      let tw = Math.min(hossz * 0.92, 1.0), th = tw / 4;
      if (th > masik * 0.9) { th = masik * 0.9; tw = th * 4; }
      negyszog(h.x, h.H + 0.07, h.y, vizszintes ? [1, 0, 0] : [0, 0, -1], vizszintes ? [0, 0, -1] : [-1, 0, 0], tw, th);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals(); // a fényre reagáló anyaghoz kellenek
    geo.computeBoundingSphere();
    // fényre reagáló anyag (enyhe saját fénnyel), hogy éjszaka a zseblámpa világítsa meg
    const cimkeAnyag = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 });
    CIMKE_ANYAGOK.push(cimkeAnyag);
    cimkeCsoport.add(new THREE.Mesh(geo, cimkeAnyag));
  }
}

// ---------------------------------------------------------------------
// Zónanevek felülnézethez
// ---------------------------------------------------------------------
const zonaFeliratok = new THREE.Group();
scene.add(zonaFeliratok);
{
  const zonak = new Map();
  for (const h of M.helyek) {
    if (!zonak.has(h.zonaFo)) zonak.set(h.zonaFo, []);
    zonak.get(h.zonaFo).push(h);
  }
  for (const [z, hs] of zonak) {
    const x = hs.reduce((s, h) => s + h.x, 0) / hs.length, y = hs.reduce((s, h) => s + h.y, 0) / hs.length;
    const nev = C.zonak?.[z]?.nev || z;
    const s = szovegSprite(`${nev} zóna`, 2.2, { hatter: C.zonak?.[z]?.szin || '#555', szin: '#fff', meret: 64 });
    s.position.set(x, maxMagassag + 4, y);
    zonaFeliratok.add(s);
  }
}

// ---------------------------------------------------------------------
// FELTÉTELEZÉSEK – feltűnő jelölés
// ---------------------------------------------------------------------
const feltCsoport = new THREE.Group();
scene.add(feltCsoport);
const jelzoSpriteok = [];
const pulzalok = [];
{
  const rajzoltFolyosok = new Set();
  const rajzoltSorok = new Set();
  const pontok = []; // {x, y, szamok[], ok}
  const rajzoltAjtok = new Set();
  for (const t of M.feltetelezesek) {
    const ok = !!t.ellenorizve; // helyszínen ellenőrizve: zöld jelölés, csíkok nélkül
    for (const hg of t.horgonyok) {
      if (ok && hg.tipus !== 'pont' && hg.tipus !== 'ajto') continue;
      if (hg.tipus === 'pont') {
        let p = pontok.find(p => p.ok === ok && Math.hypot(p.x - hg.x, p.y - hg.y) < 1);
        if (!p) pontok.push(p = { x: hg.x, y: hg.y, szamok: [], ok });
        if (!p.szamok.includes(t.szam)) p.szamok.push(t.szam);
      } else if (hg.tipus === 'folyoso' && !rajzoltFolyosok.has(hg.id)) {
        rajzoltFolyosok.add(hg.id);
        const f = M.folyosok.get(hg.id);
        if (f?.padlo) {
          const { x0, y0, x1, y1 } = f.padlo;
          const m = padloTeglalap(x0, y0, x1, y1, csikosAnyag(Math.abs(x1 - x0), Math.abs(y1 - y0), 0.55), 0.012);
          feltCsoport.add(m);
          pulzalok.push(m.material);
        }
      } else if (hg.tipus === 'vonal') {
        const sz = 0.6;
        const fugg = Math.abs(hg.x1 - hg.x2) < Math.abs(hg.y1 - hg.y2);
        const [x0, y0, x1, y1] = fugg
          ? [hg.x1 - sz / 2, Math.min(hg.y1, hg.y2), hg.x1 + sz / 2, Math.max(hg.y1, hg.y2)]
          : [Math.min(hg.x1, hg.x2), hg.y1 - sz / 2, Math.max(hg.x1, hg.x2), hg.y1 + sz / 2];
        const m = padloTeglalap(x0, y0, x1, y1, csikosAnyag(Math.max(x1 - x0, y1 - y0), sz, 0.9), 0.014);
        feltCsoport.add(m);
        pulzalok.push(m.material);
        // áttetsző piros „kerítés”
        const hossz = Math.hypot(hg.x2 - hg.x1, hg.y2 - hg.y1);
        const ker = new THREE.Mesh(new THREE.PlaneGeometry(hossz, 1.6),
          new THREE.MeshBasicMaterial({ color: '#d0261b', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
        ker.position.set((hg.x1 + hg.x2) / 2, 0.8, (hg.y1 + hg.y2) / 2);
        if (fugg) ker.rotation.y = Math.PI / 2;
        feltCsoport.add(ker);
      } else if (hg.tipus === 'sorok') {
        for (const k of hg.kulcsok) {
          if (rajzoltSorok.has(k)) continue;
          rajzoltSorok.add(k);
          const hs = M.csoportok.get(k) || [];
          if (!hs.length) continue;
          const x0 = Math.min(...hs.map(h => h.x0)) - 0.05, x1 = Math.max(...hs.map(h => h.x1)) + 0.05;
          const y0 = Math.min(...hs.map(h => h.y0)) - 0.05, y1 = Math.max(...hs.map(h => h.y1)) + 0.05;
          const mag = Math.max(...hs.map(h => h.H)) + 0.15;
          // a T3-00 U alakú: soronként helyenként rajzolunk keretet
          const egyben = new Set(hs.map(h => h.irany)).size === 1;
          const dobozok = egyben ? [{ x0, x1, y0, y1 }] : hs.map(h => ({ x0: h.x0, x1: h.x1, y0: h.y0, y1: h.y1 }));
          for (const d of dobozok) {
            const g = new THREE.BoxGeometry(d.x1 - d.x0, mag, d.y1 - d.y0);
            const el = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: '#d0261b' }));
            el.position.set((d.x0 + d.x1) / 2, mag / 2, (d.y0 + d.y1) / 2);
            feltCsoport.add(el);
          }
          const teto = padloTeglalap(x0, y0, x1, y1, csikosAnyag(x1 - x0, y1 - y0, 0.5), mag + 0.02);
          feltCsoport.add(teto);
          pulzalok.push({ anyag: teto.material, min: 0.12, max: 0.42 }); // a címkék átlátszanak
        }
      } else if (hg.tipus === 'ajto' && !rajzoltAjtok.has(`${hg.x},${hg.y}`)) {
        rajzoltAjtok.add(`${hg.x},${hg.y}`);
        const ny = Number(C.atjaroSzelesseg ?? 2) / 2;
        const anyag = new THREE.MeshLambertMaterial({ color: ok ? '#1e9e48' : '#d0261b' });
        for (const s of [-1, 1]) {
          const o = new THREE.Mesh(KOCKA, anyag);
          o.scale.set(0.25, 2.5, 0.25);
          o.position.set(hg.x, 1.25, hg.y + s * ny);
          feltCsoport.add(o);
        }
        const fel = new THREE.Mesh(KOCKA, anyag);
        fel.scale.set(0.25, 0.25, 2 * ny + 0.25);
        fel.position.set(hg.x, 2.6, hg.y);
        feltCsoport.add(fel);
        if (ok) continue;
        const m = padloTeglalap(hg.x - 1.2, hg.y - ny, hg.x + 1.2, hg.y + ny, csikosAnyag(2.4, 2 * ny, 0.9), 0.014);
        feltCsoport.add(m);
        pulzalok.push(m.material);
      }
    }
  }
  for (const p of pontok) {
    const g = new THREE.Group();
    const mag = maxMagassag + (p.ok ? 0.8 : 1.8);
    const szin = p.ok ? '#1e9e48' : '#d0261b';
    const rud = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, mag, 8),
      new THREE.MeshBasicMaterial({ color: szin, transparent: true, opacity: 0.8, depthTest: false }));
    rud.position.y = mag / 2;
    rud.renderOrder = 9;
    const gyuru = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 32),
      new THREE.MeshBasicMaterial({ color: szin, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    gyuru.rotation.x = -Math.PI / 2;
    gyuru.position.y = 0.03;
    if (!p.ok) pulzalok.push(gyuru.material);
    const szamok = p.szamok.map(n => '#' + n).join(', ');
    const felirat = p.ok
      ? szovegSprite(['✔ ELLENŐRIZVE', szamok], 1.1, { hatter: '#1e9e48', szin: '#fff', meret: 56, depthTest: false })
      : szovegSprite(['⚠ FELTÉTELEZÉS', szamok], 1.6, { hatter: '#d0261b', szin: '#ffe14d', keret: '#ffe14d', meret: 56, depthTest: false });
    felirat.position.y = mag + 0.9;
    felirat.userData.feltSzamok = p.szamok;
    jelzoSpriteok.push(felirat);
    g.add(rud, gyuru, felirat);
    g.position.set(p.x, 0, p.y);
    feltCsoport.add(g);
  }
}

// ---------------------------------------------------------------------
// Kijelölés
// ---------------------------------------------------------------------
const kijelolCsoport = new THREE.Group();
scene.add(kijelolCsoport);
const kijelolAnyag = new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.45, depthWrite: false });
const kijelolDoboz = new THREE.Mesh(KOCKA, kijelolAnyag);
const kijelolEl = new THREE.LineSegments(new THREE.EdgesGeometry(KOCKA), new THREE.LineBasicMaterial({ color: '#ff8800' }));
const jelzo = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 12),
  new THREE.MeshBasicMaterial({ color: '#ffb000', transparent: true, opacity: 0.7, depthWrite: false }));
let kijeloltFelirat = null;
kijelolCsoport.add(kijelolDoboz, kijelolEl, jelzo);
kijelolCsoport.visible = false;
const tobbKijeloles = new THREE.InstancedMesh(KOCKA,
  new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.5, depthWrite: false }), M.helyek.length);
tobbKijeloles.count = 0;
scene.add(tobbKijeloles);

let kijelolt = null;
function kijelol(h) {
  kijelolt = h;
  if (!h) {
    kijelolCsoport.visible = false;
    $('infoPanel').hidden = true;
    history.replaceState(null, '', location.pathname + location.search);
    return;
  }
  const sx = h.x1 - h.x0 + 0.08, sz = h.y1 - h.y0 + 0.08;
  for (const o of [kijelolDoboz, kijelolEl]) {
    o.scale.set(sx, h.H + 0.1, sz);
    o.position.set(h.x, (h.H + 0.1) / 2, h.y);
  }
  const jm = 14;
  jelzo.scale.set(1, jm, 1);
  jelzo.position.set(h.x, h.H + jm / 2, h.y);
  if (kijeloltFelirat) { kijelolCsoport.remove(kijeloltFelirat); kijeloltFelirat.material.map.dispose(); }
  kijeloltFelirat = szovegSprite(h.kod, 1.1, { hatter: '#ffd400', szin: '#111', keret: '#111', meret: 64, depthTest: false });
  kijeloltFelirat.position.set(h.x, h.H + 1.6, h.y);
  kijelolCsoport.add(kijeloltFelirat);
  kijelolCsoport.visible = true;
  infoHely(h);
  history.replaceState(null, '', '#' + encodeURIComponent(h.kod));
}

function tobbetKijelol(lista) {
  tobbKijeloles.count = lista.length;
  lista.forEach((h, i) => dobozMatrix(tobbKijeloles, i, h.x, (h.H + 0.1) / 2, h.y, h.x1 - h.x0 + 0.06, h.H + 0.1, h.y1 - h.y0 + 0.06));
  tobbKijeloles.instanceMatrix.needsUpdate = true;
  tobbKijeloles.computeBoundingSphere();
}

// ---------------------------------------------------------------------
// Info panel
// ---------------------------------------------------------------------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sz = (v, j = 2) => (v == null || v === '' ? '–' : Number(v).toFixed(j).replace('.', ','));

function helyFeltetelezesei(h) {
  return M.feltetelezesek.filter(t => !t.ellenorizve && t.horgonyok.some(hg =>
    (hg.tipus === 'folyoso' && hg.id === h.folyoso) || (hg.tipus === 'sorok' && hg.kulcsok.includes(h.sorKulcs))));
}

function infoHely(h) {
  const f = M.folyosok.get(h.folyoso);
  const felt = helyFeltetelezesei(h);
  $('infoTartalom').innerHTML = `
    <h3><span class="zonaPotty" style="background:${h.szin}"></span>${esc(h.kod)}</h3>
    ${h.jeloletlen ? `<div class="figyelmeztet">A táblázatban <b>nincs kódja</b> („${esc(h.eredetiKod)}”), ez ideiglenes azonosító.</div>` : ''}
    ${felt.map(t => `<div class="figyelmeztet"><b>⚠ FELTÉTELEZÉS #${t.szam}</b> – ${esc(t.szoveg)}
       <br><a href="#" data-felt="${t.szam}">Mutasd a modellben</a></div>`).join('')}
    ${h.belelog ? `<div class="figyelmeztet">Az állvány eleje <b>${sz(h.belelog)} m-rel belelóg</b> a beállított folyosószélességbe.</div>` : ''}
    <table>
      <tr><td>Zóna / sor / hely</td><td>${esc(h.zona)} / ${esc(h.sor)} / ${esc(h.hely)}</td></tr>
      <tr><td>Folyosó</td><td>${esc(h.folyoso)}${f ? ` (${f.tipus}, ${sz(f.szel, 1)} m széles)` : ''}</td></tr>
      <tr><td>Szárny</td><td>${esc(h.szarny)}</td></tr>
      <tr><td>Rajzon</td><td>${esc(h.rajzon)}</td></tr>
      <tr><td>X / Y</td><td>${sz(h.x)} m / ${sz(h.y)} m</td></tr>
      <tr><td>Pozíció a folyosón</td><td>${sz(h.pozicio)} m</td></tr>
      <tr><td>Táv a kiindulóponttól</td><td><b>${sz(h.tav, 1)} m</b>${h.tavExcel != null && Math.abs(h.tavExcel - h.tav) > 0.05
        ? `<br><span class="halvany kicsi">újraszámolva az eltolt felső szárnyhoz; az Excelben ${sz(h.tavExcel, 1)} m</span>` : ''}</td></tr>
      <tr><td>Állvány (modell)</td><td>${sz(h.H, 1)} m magas, ${h.L} szint, ${sz(2 * h.h)} m mély, ${sz(h.w)} m széles</td></tr>
      <tr><td>Forrás</td><td>Tárhelyek lap, ${h.excelSor}. sor</td></tr>
    </table>
    <div class="gombok">
      <button class="masodlagos reszletGomb" data-akcio="reszletek">Részletek</button>
      <button data-akcio="seta">Odamegyek (belső nézet)</button>
      <button class="masodlagos" data-akcio="felul">Felülnézetben</button>
    </div>`;
  $('infoPanel').hidden = false;
}

function infoFeltetelezes(t) {
  $('infoTartalom').innerHTML = `
    ${t.ellenorizve
      ? `<h3 class="zold">✔ ELLENŐRIZVE #${t.szam}</h3><div class="ellenorizveDoboz">${esc(t.ellenorizve)}</div>
         <p class="halvany kicsi">Eredeti feltételezés: <b>${esc(t.cim)}</b> – ${esc(t.szoveg)}</p>`
      : `<h3 style="color:var(--piros)">⚠ FELTÉTELEZÉS #${t.szam}</h3>
         <div class="figyelmeztet"><b>${esc(t.cim)}</b><br>${esc(t.szoveg)}</div>`}
    <p class="halvany kicsi">Forrás: ${esc(t.forras)}</p>
    ${t.fokusz ? '<div class="gombok"><button data-felt-oda="' + t.szam + '">Odavisz</button></div>' : '<p class="halvany">Ehhez nem tartozik konkrét hely a modellben.</p>'}`;
  $('infoPanel').hidden = false;
}

$('infoPanel').addEventListener('click', e => {
  const a = e.target.closest('[data-akcio],[data-felt],[data-felt-oda]');
  if (!a) return;
  e.preventDefault();
  if (a.dataset.felt || a.dataset.feltOda) {
    const t = M.feltetelezesek.find(t => t.szam === Number(a.dataset.felt || a.dataset.feltOda));
    if (t) feltetelezeshezMegy(t);
  } else if (a.dataset.akcio === 'reszletek') {
    $('infoPanel').classList.toggle('nyitott');
  } else if (a.dataset.akcio === 'seta' && kijelolt) {
    helyhezMegy(kijelolt, 'seta');
  } else if (a.dataset.akcio === 'felul' && kijelolt) {
    helyhezMegy(kijelolt, 'felul');
  }
});
$('infoBezar').addEventListener('click', () => kijelol(null));

// ---------------------------------------------------------------------
// Kamera: felülnézet (MapControls) és belső nézet (séta)
// ---------------------------------------------------------------------
const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 2;
controls.maxDistance = 400;
controls.zoomToCursor = true;

let mod = 'felul';
// z: talpmagasság (lépcső, galéria, ugrás), vz: függőleges sebesség, kz: a kamera simított magassága
// guggol: guggolva van-e; szemAkt: a simított szemmagasság (guggolásnál lejjebb)
const seta = { x: D.kulcsok.kiindulo.x, y: D.kulcsok.kiindulo.y, z: 0, vz: 0, kz: 0, yaw: Math.PI, pitch: -0.05, volt: false,
  guggol: false, szemAkt: null, maszik: false, halott: false, kvx: 0, kvy: 0 }; // kvx/kvy: lökés sebessége
let guggolKapcs = false, maszGombLe = false; // a telefonos gombok állapota
const SZEM = Number(C.szemmagassag ?? 1.65);
const SUGAR = Number(C.testSugar ?? 0.28);

function attekintes(azonnal = false, hatar = H) {
  const w = hatar.x1 - hatar.x0 + 6, d = hatar.y1 - hatar.y0 + 6;
  const fov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const tav = Math.max(d / 2 / Math.tan(fov), w / 2 / (Math.tan(fov) * camera.aspect)) * 1.05 + maxMagassag;
  const cel = new THREE.Vector3((hatar.x0 + hatar.x1) / 2, 0, (hatar.y0 + hatar.y1) / 2);
  const poz = cel.clone().add(new THREE.Vector3(0, Math.max(tav, 8), 0.001));
  if (azonnal) {
    controls.target.copy(cel);
    camera.position.copy(poz);
    controls.update();
  } else {
    felulRepul(cel, poz);
  }
}

// --- egyszerű animáció ---
let animacio = null;
function animal(ms, lepes, kesz) {
  animacio = { t0: performance.now(), ms, lepes, kesz };
}
function animacioFrissit(most) {
  if (!animacio) return;
  const k = Math.min(1, (most - animacio.t0) / animacio.ms);
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  animacio.lepes(e);
  if (k >= 1) { const kesz = animacio.kesz; animacio = null; kesz && kesz(); }
}

function felulRepul(cel, poz, ms = 800) {
  const t0 = controls.target.clone(), p0 = camera.position.clone();
  animal(ms, e => {
    controls.target.lerpVectors(t0, cel, e);
    camera.position.lerpVectors(p0, poz, e);
  });
}

function setaNezet() {
  camera.rotation.order = 'YXZ';
  camera.rotation.set(seta.pitch, seta.yaw, 0);
  camera.position.set(seta.x, seta.kz + (seta.szemAkt ?? SZEM), seta.y);
}

function ugras() {
  if (mod !== 'seta' || animacio || seta.kocsin || !(Number(C.ugrasSebesseg) > 0)) return;
  if (seta.z - M.racs.talaj(seta.x, seta.y, seta.z) < 0.02) seta.vz = Number(C.ugrasSebesseg);
}

function kameraPozbaRepul(celPoz, celQuat, ms, kesz) {
  const p0 = camera.position.clone(), q0 = camera.quaternion.clone();
  animal(ms, e => {
    camera.position.lerpVectors(p0, celPoz, e);
    camera.quaternion.slerpQuaternions(q0, celQuat, e);
  }, kesz);
}

function modValt(uj, opciok = {}) {
  if (uj === mod && !opciok.kenyszer) return;
  mod = uj;
  $('gombFelul').classList.toggle('aktiv', mod === 'felul');
  $('gombBelso').classList.toggle('aktiv', mod === 'seta');
  document.body.classList.toggle('seta', mod === 'seta');
  $('joystick').hidden = !(mod === 'seta' && ERINTES);
  $('ugrasGomb').hidden = !(mod === 'seta' && ERINTES && Number(C.ugrasSebesseg) > 0);
  $('guggolGomb').hidden = $('maszGomb').hidden = !(mod === 'seta' && ERINTES);
  $('celkereszt').hidden = mod !== 'seta';
  $('pozicio').hidden = mod !== 'seta';
  $('setaSugo').hidden = !(mod === 'seta' && !ERINTES);
  zonaFeliratok.visible = mod === 'felul';
  falakMod(mod === 'seta');
  if (mod === 'seta') {
    controls.enabled = false;
    if (opciok.hova) {
      Object.assign(seta, opciok.hova);
    } else if (!seta.volt) {
      // első belépés: a felülnézet közepéhez legközelebbi szabad pont, vagy a kiindulópont
      const t = controls.target;
      const [x, y] = M.racs.szabadPont(t.x, t.z, SUGAR);
      const bent = x > H.x0 && x < H.x1 && y > H.y0 && y < H.y1;
      if (!bent || camera.position.y > 60) Object.assign(seta, { x: D.kulcsok.kiindulo.x, y: D.kulcsok.kiindulo.y, yaw: Math.PI });
      else Object.assign(seta, { x, y });
    }
    seta.volt = true;
    seta.z = seta.kz = M.racs.talaj(seta.x, seta.y, opciok.hova?.z ?? 0);
    seta.vz = 0;
    const celPoz = new THREE.Vector3(seta.x, seta.kz + SZEM, seta.y);
    const celQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(seta.pitch, seta.yaw, 0, 'YXZ'));
    kameraPozbaRepul(celPoz, celQuat, 900, () => setaNezet());
  } else {
    if (document.pointerLockElement) document.exitPointerLock();
    const cel = new THREE.Vector3(seta.x, 0, seta.y);
    const iranyX = -Math.sin(seta.yaw), iranyZ = -Math.cos(seta.yaw);
    const poz = cel.clone().add(new THREE.Vector3(-iranyX * 10, 26, -iranyZ * 10));
    const tmp = new THREE.Object3D();
    tmp.position.copy(poz);
    tmp.up.set(0, 1, 0);
    tmp.lookAt(cel);
    kameraPozbaRepul(poz, tmp.quaternion, 900, () => {
      controls.target.copy(cel);
      controls.enabled = true;
      controls.update();
    });
  }
}

$('gombFelul').addEventListener('click', () => (mod === 'felul' ? attekintes() : modValt('felul')));
$('gombBelso').addEventListener('click', () => modValt('seta'));

function helyhezMegy(h, cel = mod) {
  kijelol(h);
  tobbetKijelol([]);
  if (cel === 'seta') {
    const p = helyElotti(M, h, C);
    const lx = h.x - p.x, ly = h.y - p.y;
    const yaw = Math.atan2(-lx, -ly);
    const tav = Math.hypot(lx, ly);
    const pitch = Math.atan2(h.cimkeY - SZEM, Math.max(0.5, tav - h.h));
    if (mod !== 'seta') {
      modValt('seta', { hova: { x: p.x, y: p.y, z: 0, yaw, pitch } });
    } else {
      const s0 = { ...seta };
      let dy = yaw - s0.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      animal(900, e => {
        seta.x = s0.x + (p.x - s0.x) * e; seta.y = s0.y + (p.y - s0.y) * e;
        seta.yaw = s0.yaw + dy * e; seta.pitch = s0.pitch + (pitch - s0.pitch) * e;
        seta.z = seta.kz = s0.z * (1 - e); seta.vz = 0; // a tárhelyek a padlószinten vannak
        setaNezet();
      });
    }
  } else {
    if (mod !== 'felul') modValt('felul');
    const kesleltet = animacio ? 950 : 0;
    setTimeout(() => {
      const celT = new THREE.Vector3(h.x, 0, h.y);
      const off = camera.position.clone().sub(controls.target);
      if (off.length() < 1) off.set(0, 1, 0.001);
      off.setLength(16);
      if (off.y < 6) off.y = 6;
      felulRepul(celT, celT.clone().add(off));
    }, kesleltet);
  }
}

function feltetelezeshezMegy(t) {
  infoFeltetelezes(t);
  if (!t.fokusz) return;
  feltCsoport.visible = true;
  $('kapcsFelt').checked = true;
  if (mod !== 'felul') modValt('felul');
  setTimeout(() => {
    const celT = new THREE.Vector3(t.fokusz.x, 0, t.fokusz.y);
    felulRepul(celT, celT.clone().add(new THREE.Vector3(0, 22, 12)));
  }, animacio ? 950 : 0);
  if (innerWidth < 640) $('menuPanel').hidden = true;
}

// --- billentyűzet ---
const lenyomva = new Set();
addEventListener('keydown', e => {
  if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
  if (e.code === 'KeyV') { modValt(mod === 'felul' ? 'seta' : 'felul'); return; }
  if (e.code === 'Escape') { $('menuPanel').hidden = true; }
  lenyomva.add(e.code);
  if (mod === 'seta' && e.code.startsWith('Arrow')) e.preventDefault();
  if (mod === 'seta' && e.code === 'Space') { e.preventDefault(); if (!e.repeat) ugras(); }
  if (mod === 'seta' && !e.repeat && e.code === 'KeyF') jatek?.lokes();
  if (mod === 'seta' && !e.repeat && e.code === 'KeyG') jatek?.dobas();
  if (mod === 'seta' && !e.repeat && e.code === 'KeyR') jatek?.ujratolt();
  if (mod === 'seta' && !e.repeat && e.code === 'KeyQ') jatek?.valt();
  if (mod === 'seta' && !e.repeat && e.code === 'KeyL') ejszaka?.kapcsol();
  if (mod === 'seta' && !e.repeat && e.code === 'KeyK') kocsi?.valt();
});
addEventListener('keyup', e => lenyomva.delete(e.code));
addEventListener('blur', () => lenyomva.clear());

// --- egér / érintés a vásznon ---
const vaszon = renderer.domElement;
const raycaster = new THREE.Raycaster();
const mutatok = new Map(); // pointerId -> {x, y, x0, y0, t0, mozgott}

vaszon.addEventListener('pointerdown', e => {
  mutatok.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), mozgott: false });
});
vaszon.addEventListener('pointermove', e => {
  const p = mutatok.get(e.pointerId);
  if (mod === 'seta' && !animacio) {
    if (document.pointerLockElement === vaszon) {
      seta.yaw -= e.movementX * C.egerErzekenyseg;
      seta.pitch -= e.movementY * C.egerErzekenyseg;
    } else if (p) {
      const k = e.pointerType === 'touch' ? C.erintesErzekenyseg : C.egerErzekenyseg * 1.5;
      seta.yaw += (e.clientX - p.x) * k;
      seta.pitch += (e.clientY - p.y) * k;
    }
    seta.pitch = Math.max(-1.45, Math.min(1.45, seta.pitch));
  }
  if (p) {
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) p.mozgott = true;
  }
});
const pointerVege = e => {
  const p = mutatok.get(e.pointerId);
  mutatok.delete(e.pointerId);
  if (!p || p.mozgott || performance.now() - p.t0 > 500 || e.type === 'pointercancel') return;
  // koppintás / kattintás
  if (mod === 'seta' && e.pointerType === 'mouse' && document.pointerLockElement !== vaszon) {
    vaszon.requestPointerLock?.();
    if (vaszon.requestPointerLock) return;
  }
  if (mod === 'seta' && jatek?.fegyverKezben?.()) return; // AK-val a kattintás lövés, nem kiválasztás
  if (mod === 'seta' && document.pointerLockElement === vaszon) valaszt(0, 0);
  else valaszt((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
};
vaszon.addEventListener('pointerup', pointerVege);
vaszon.addEventListener('pointercancel', pointerVege);
document.addEventListener('pointerlockchange', () => {
  $('setaSugo').textContent = document.pointerLockElement === vaszon
    ? 'WASD / nyilak = séta · egér = nézelődés · Shift = gyorsabban · Szóköz = ugrás · C = guggolás · E = mászás · F = lökés · G = palack · AK: bal gomb = lövés, R = töltés, Q = váltás · L = lámpa · K = felmosókocsi · 🚩 zászló: rámenéssel · Esc = egér elengedése'
    : 'Kattints a képre a sétához · WASD / nyilak · egér · Shift · Szóköz = ugrás · C = guggolás · E = mászás · F = lökés · G = palack · Esc';
});

function valaszt(nx, ny) {
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
  if (feltCsoport.visible) {
    const t = raycaster.intersectObjects(jelzoSpriteok, false)[0];
    if (t) {
      const f = M.feltetelezesek.find(f => f.szam === t.object.userData.feltSzamok[0]);
      if (f) { infoFeltetelezes(f); return; }
    }
  }
  const talalat = raycaster.intersectObject(valaszto, false)[0];
  if (talalat && talalat.instanceId != null) kijelol(M.helyek[talalat.instanceId]);
}

// --- ugrás gomb (telefon) ---
$('ugrasGomb').addEventListener('pointerdown', e => { e.preventDefault(); ugras(); });
// guggolás: be-/kikapcsoló gomb; mászás: nyomva tartva
$('guggolGomb').addEventListener('pointerdown', e => {
  e.preventDefault();
  guggolKapcs = !guggolKapcs;
  $('guggolGomb').classList.toggle('aktiv', guggolKapcs);
});
$('maszGomb').addEventListener('pointerdown', e => { e.preventDefault(); maszGombLe = true; $('maszGomb').setPointerCapture(e.pointerId); });
for (const ev of ['pointerup', 'pointercancel']) $('maszGomb').addEventListener(ev, () => { maszGombLe = false; });

// --- joystick (telefon) ---
const joy = { x: 0, y: 0, id: null };
{
  const el = $('joystick'), gomb = $('joyGomb');
  const frissit = e => {
    const r = el.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    joy.x = dx; joy.y = -dy;
    gomb.style.transform = `translate(${dx * r.width * 0.32}px, ${dy * r.height * 0.32}px)`;
  };
  el.addEventListener('pointerdown', e => { joy.id = e.pointerId; el.setPointerCapture(e.pointerId); frissit(e); });
  el.addEventListener('pointermove', e => { if (e.pointerId === joy.id) frissit(e); });
  const vege = e => {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.x = joy.y = 0; gomb.style.transform = '';
  };
  el.addEventListener('pointerup', vege);
  el.addEventListener('pointercancel', vege);
}

// --- séta léptetése ---
let utolsoPozFrissites = 0;
function setaLeptet(dt, most) {
  if (animacio) return;
  if (seta.halott) { setaNezet(); return; } // a játékban: amíg újra nem éled
  let elore = 0, oldal = 0, fordul = 0;
  if (lenyomva.has('KeyW') || lenyomva.has('ArrowUp')) elore += 1;
  if (lenyomva.has('KeyS') || lenyomva.has('ArrowDown')) elore -= 1;
  if (lenyomva.has('KeyD')) oldal += 1;
  if (lenyomva.has('KeyA')) oldal -= 1;
  if (lenyomva.has('ArrowLeft')) fordul += 1;
  if (lenyomva.has('ArrowRight')) fordul -= 1;
  elore += joy.y; oldal += joy.x;
  const l = Math.hypot(elore, oldal);
  if (l > 1) { elore /= l; oldal /= l; }
  if (seta.kocsin) { kocsiLeptet(dt, elore, oldal - fordul); return; }
  seta.yaw += fordul * 1.8 * dt;
  // guggolás: amíg a C nyomva van (vagy a gomb be van kapcsolva); felállni csak akkor lehet,
  // ha a fej fölött van hely
  const TEST = Number(C.testMagassag ?? 1.8);
  const GUGG = C.guggolas || {};
  const guggTest = Number(GUGG.testMagassag ?? 1.0), guggSzem = Number(GUGG.szemmagassag ?? 0.9);
  if (lenyomva.has('KeyC') || guggolKapcs) seta.guggol = true;
  else if (seta.guggol && !M.racs.utkozik(seta.x, seta.y, SUGAR, seta.z, TEST)
    && M.racs.plafon(seta.x, seta.y, seta.z) >= seta.z + TEST) seta.guggol = false;
  const test = seta.guggol ? guggTest : TEST;
  const seb = (lenyomva.has('ShiftLeft') || lenyomva.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.97
    ? C.futasSebesseg : C.setaSebesseg) * (seta.guggol ? 0.5 : 1);
  const sy = Math.sin(seta.yaw), cy = Math.cos(seta.yaw);
  // lökés: a kapott sebesség hozzáadódik, és gyorsan lecseng
  const dx = (-sy * elore + cy * oldal) * seb * dt + seta.kvx * dt;
  const dz = (-cy * elore - sy * oldal) * seb * dt + seta.kvy * dt;
  const lecseng = Math.exp(-5 * dt);
  seta.kvx = Math.abs(seta.kvx * lecseng) < 0.05 ? 0 : seta.kvx * lecseng;
  seta.kvy = Math.abs(seta.kvy * lecseng) < 0.05 ? 0 : seta.kvy * lecseng;
  if (dx || dz) {
    let zLep;
    [seta.x, seta.y, zLep] = M.racs.mozgat(seta.x, seta.y, dx, dz, SUGAR, seta.z, test);
    if (seta.vz === 0) seta.z = zLep; // a lépcsőfokokra fellépett magasság
  }
  // függőleges mozgás: mászás, fellépés, esés, ugrás (a fej nem mehet át a fölötte lévőn)
  const talaj = M.racs.talaj(seta.x, seta.y, seta.z);
  const plafon = M.racs.plafon(seta.x, seta.y, seta.z);
  seta.maszik = (lenyomva.has('KeyE') || maszGombLe) && M.racs.kapaszkodo(seta.x, seta.y, SUGAR, seta.z, test);
  if (seta.maszik) {
    seta.vz = 0;
    seta.z = Math.max(seta.z, Math.min(seta.z + Number(C.maszasSebesseg ?? 1.5) * dt, plafon - test));
  } else if (seta.vz > 0 || seta.z > talaj + 0.001) {
    seta.vz -= Number(C.gravitacio ?? 9.81) * dt;
    seta.z += seta.vz * dt;
    if (seta.vz > 0 && seta.z + test > plafon) { seta.z = plafon - test; seta.vz = 0; }
    if (seta.z <= talaj) { if (seta.vz < -9) jatek?.eses(seta.vz); seta.z = talaj; seta.vz = 0; }
  } else {
    seta.z = talaj;
    seta.vz = 0;
  }
  // a kamera simán kövesse a lépcsőfokokat és a guggolást, ugrásnál közvetlenül
  seta.kz = seta.vz !== 0 ? seta.z : seta.kz + (seta.z - seta.kz) * Math.min(1, dt * 12);
  const celSzem = seta.guggol ? guggSzem : SZEM;
  seta.szemAkt = (seta.szemAkt ?? SZEM) + (celSzem - (seta.szemAkt ?? SZEM)) * Math.min(1, dt * 10);
  setaNezet();
  if (most - utolsoPozFrissites > 250) {
    utolsoPozFrissites = most;
    let legk = null, ld = 3;
    for (const t of M.racs.kozel(seta.x, seta.y, 3)) {
      if (t.hely == null) continue;
      const h = M.helyek[t.hely];
      const d = Math.hypot(h.x - seta.x, h.y - seta.y);
      if (d < ld) { ld = d; legk = h; }
    }
    const szint = (seta.z > 0.5 ? ` · ${sz(seta.z, 1)} m magasan` : '')
      + (seta.maszik ? ' · mászik' : seta.guggol ? ' · guggolva' : '');
    $('pozicio').textContent = `X ${sz(seta.x, 1)} m · Y ${sz(seta.y, 1)} m${szint}${legk && seta.z < 0.5 ? ' · ' + legk.kod : ''}`;
  }
}

// Felmosókocsi vezetése (config.js: felmosoKocsi): gáz/fék előre-hátra, kormányzás; csak a padlón
// gurul (nem ugrik, nem mászik), az állványokba és a falakba ütközik
function kocsiLeptet(dt, gaz, kormany) {
  const K = C.felmosoKocsi || {};
  const max = Number(K.sebesseg ?? 7), hatra = Number(K.hatraSebesseg ?? 2.5), R = kocsi?.sugar ?? 0.55;
  const v = seta.kv || 0;
  const cel = gaz > 0 ? max * gaz : gaz < 0 ? -hatra * -gaz : 0;
  const gyorsulas = cel === 0 ? 4 : (v && Math.sign(cel) !== Math.sign(v)) ? 10 : Number(K.gyorsulas ?? 4);
  seta.kv = v + Math.sign(cel - v) * Math.min(Math.abs(cel - v), gyorsulas * dt);
  // kormányzás: álló helyzetben is fordul egy kicsit, menet közben jobban; tolatva fordítva
  seta.yaw -= kormany * 1.9 * dt * Math.min(1, 0.35 + Math.abs(seta.kv) / 3) * (seta.kv < -0.05 ? -1 : 1);
  seta.kvx = seta.kvy = 0;
  seta.guggol = seta.maszik = false;
  const dx = -Math.sin(seta.yaw) * seta.kv * dt, dz = -Math.cos(seta.yaw) * seta.kv * dt;
  if (dx || dz) {
    const x0 = seta.x, y0 = seta.y;
    let zLep;
    [seta.x, seta.y, zLep] = M.racs.mozgat(seta.x, seta.y, dx, dz, R, seta.z, 1.6);
    if (seta.vz === 0) seta.z = zLep;
    // ütközés: lefékez
    if (Math.hypot(seta.x - x0, seta.y - y0) < 0.5 * Math.hypot(dx, dz)) seta.kv *= 0.3;
  }
  const talaj = M.racs.talaj(seta.x, seta.y, seta.z);
  if (seta.vz > 0 || seta.z > talaj + 0.001) {
    seta.vz -= Number(C.gravitacio ?? 9.81) * dt;
    seta.z += seta.vz * dt;
    if (seta.z <= talaj) { if (seta.vz < -9) jatek?.eses(seta.vz); seta.z = talaj; seta.vz = 0; }
  } else { seta.z = talaj; seta.vz = 0; }
  seta.kz = seta.vz !== 0 ? seta.z : seta.kz + (seta.z - seta.kz) * Math.min(1, dt * 12);
  const celSzem = Number(K.szemmagassag ?? 1.75);
  seta.szemAkt = (seta.szemAkt ?? SZEM) + (celSzem - (seta.szemAkt ?? SZEM)) * Math.min(1, dt * 10);
  setaNezet();
  $('pozicio').textContent = `🧽 Felmosókocsi · ${Math.round(Math.abs(seta.kv) * 3.6)} km/h · K = leszállás`;
}

// ---------------------------------------------------------------------
// Kereső
// ---------------------------------------------------------------------
const kodIndex = new Map(M.helyek.map(h => [normalKod(h.kod), h]));
function okosNormal(s) {
  const reszek = String(s).toUpperCase().split(/[^0-9A-ZÁÉÍÓÖŐÚÜŰ]+/).filter(Boolean);
  return reszek.map((r, i) => (i > 0 && /^\d$/.test(r) ? '0' + r : r)).join('');
}
function keres(s) {
  const q1 = normalKod(s), q2 = okosNormal(s);
  if (!q1) return { pontos: null, lista: [] };
  const pontos = kodIndex.get(q1) || kodIndex.get(q2) || null;
  const lista = [];
  for (const [k, h] of kodIndex) if (k.startsWith(q1) || k.startsWith(q2)) lista.push(h);
  if (!lista.length) for (const [k, h] of kodIndex) if (k.includes(q1)) lista.push(h);
  return { pontos, lista };
}
const mezo = $('keresoMezo'), javaslatok = $('javaslatok');
let javaslatAktiv = -1;
function javaslatMutat() {
  const { lista } = keres(mezo.value);
  javaslatAktiv = -1;
  if (!mezo.value.trim() || !lista.length) { javaslatok.hidden = true; return; }
  const max = 40;
  javaslatok.innerHTML = lista.slice(0, max).map((h, i) =>
    `<li data-i="${h.i}"><span><span class="zonaPotty" style="background:${h.szin}"></span>${esc(h.kod)}</span><span class="mellek">${esc(h.folyoso)} · ${sz(h.tav, 0)} m</span></li>`).join('')
    + (lista.length > max ? `<li class="mellek" data-osszes="1">… még ${lista.length - max} találat – Kijelöl: mind</li>` : '');
  javaslatok.hidden = false;
}
mezo.addEventListener('input', javaslatMutat);
mezo.addEventListener('focus', javaslatMutat);
mezo.addEventListener('blur', () => setTimeout(() => (javaslatok.hidden = true), 150));
mezo.addEventListener('keydown', e => {
  const elemek = [...javaslatok.querySelectorAll('li[data-i]')];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!elemek.length) return;
    javaslatAktiv = (javaslatAktiv + (e.key === 'ArrowDown' ? 1 : -1) + elemek.length) % elemek.length;
    elemek.forEach((li, i) => li.classList.toggle('aktiv', i === javaslatAktiv));
    elemek[javaslatAktiv].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (javaslatAktiv >= 0 && elemek[javaslatAktiv]) {
      const h = M.helyek[Number(elemek[javaslatAktiv].dataset.i)];
      mezo.value = h.kod;
      keresesVegrehajt(true);
    } else keresesVegrehajt(true);
  } else if (e.key === 'Escape') {
    javaslatok.hidden = true;
  }
});
javaslatok.addEventListener('pointerdown', e => {
  const li = e.target.closest('li');
  if (!li) return;
  e.preventDefault();
  if (li.dataset.osszes) { keresesVegrehajt(false); return; }
  const h = M.helyek[Number(li.dataset.i)];
  mezo.value = h.kod;
  keresesVegrehajt(true);
});
$('gombOdavisz').addEventListener('click', () => keresesVegrehajt(true));
$('gombKijelol').addEventListener('click', () => keresesVegrehajt(false));

function keresesVegrehajt(odavisz) {
  javaslatok.hidden = true;
  const { pontos, lista } = keres(mezo.value);
  if (!mezo.value.trim()) { tobbetKijelol([]); return; }
  const egy = pontos || (lista.length === 1 ? lista[0] : null);
  if (egy) {
    mezo.value = egy.kod;
    mezo.blur();
    if (odavisz) helyhezMegy(egy);
    else { kijelol(egy); tobbetKijelol([]); }
    uzenet(odavisz ? `${egy.kod} – ${mod === 'seta' ? 'odavittelek' : 'megmutatom'}` : `${egy.kod} kijelölve`);
    return;
  }
  if (!lista.length) { uzenet(`Nincs ilyen helykód: „${mezo.value}”`); tobbetKijelol([]); return; }
  tobbetKijelol(lista);
  kijelol(null);
  uzenet(`${lista.length} hely illeszkedik a „${mezo.value}” keresésre – sárgával kijelölve`);
  if (odavisz || mod === 'felul') {
    const hb = { x0: Math.min(...lista.map(h => h.x0)), x1: Math.max(...lista.map(h => h.x1)),
      y0: Math.min(...lista.map(h => h.y0)), y1: Math.max(...lista.map(h => h.y1)) };
    if (mod !== 'felul') modValt('felul');
    setTimeout(() => attekintes(false, hb), animacio ? 950 : 0);
  }
}

let uzenetIdo = null;
function uzenet(sz) {
  const u = $('uzenet');
  u.textContent = sz;
  u.hidden = false;
  clearTimeout(uzenetIdo);
  uzenetIdo = setTimeout(() => (u.hidden = true), 3500);
}

// ---------------------------------------------------------------------
// Menü: feltételezések listája, jelmagyarázat, kapcsolók
// ---------------------------------------------------------------------
$('feltSzam').textContent = M.feltetelezesek.filter(t => !t.ellenorizve).length;
$('feltLista').innerHTML = M.feltetelezesek.map(t => `
  <li value="${t.szam}" data-szam="${t.szam}" class="${t.fokusz ? '' : 'nincsHely'} ${t.ellenorizve ? 'ellenorizve' : ''}">
    ${t.ellenorizve ? `<b class="zold">✔ ELLENŐRIZVE</b> – ${esc(t.ellenorizve)}<br>` : ''}
    <b>${esc(t.cim)}</b><br>${esc(t.szoveg)}
    <span class="forras">Forrás: ${esc(t.forras)}${t.fokusz ? ' · kattints, hogy odavigyen' : ' · nincs konkrét helye'}</span>
  </li>`).join('');
$('feltLista').addEventListener('click', e => {
  const li = e.target.closest('li[data-szam]');
  if (!li) return;
  const t = M.feltetelezesek.find(t => t.szam === Number(li.dataset.szam));
  if (t) feltetelezeshezMegy(t);
});
$('modellFeltLista').innerHTML = M.modellFeltetelezesek.map(s => `<li>${esc(s)}</li>`).join('')
  + M.figyelmeztetesek.map(s => `<li><b>Figyelem:</b> ${esc(s)}</li>`).join('');
$('forrasInfo').textContent = `Forrás: ${D.forras} · ${M.helyek.length} tárhely · ${M.folyosok.size} folyosó/gerinc`;

function jelmagyarazat() {
  const db = {};
  for (const h of M.helyek) {
    const k = szinezesMod === 'rajzon' ? (h.rajzon || '–') : h.zona;
    db[k] = db[k] || { n: 0, szin: szinezesMod === 'rajzon' ? rajzSzin[h.rajzon || '–'] : h.szin };
    db[k].n++;
  }
  $('jelmagyarazat').innerHTML = Object.entries(db).map(([k, v]) =>
    `<li><span class="zonaPotty" style="background:${v.szin}"></span>${esc(C.zonak?.[k]?.nev || k)} – ${v.n} hely</li>`).join('')
    + `<li><span class="zonaPotty" style="background:#f2e3a0"></span>folyosó · <span class="zonaPotty" style="background:#a9cdf3"></span>gerinc</li>`
    + `<li><span class="zonaPotty" style="background:#1e9e48"></span>kiindulópont (komissiózó kijárat)</li>`
    + `<li><span class="csikos"></span><b style="color:var(--piros)">FELTÉTELEZÉS – ellenőrizendő</b></li>`
    + `<li><span class="zonaPotty" style="background:#fff1a8;border:1px solid #999"></span>sárga címke: a táblázatban nincs kódja</li>`;
}

$('gombMenu').addEventListener('click', () => { $('menuPanel').hidden = !$('menuPanel').hidden; });
$('menuBezar').addEventListener('click', () => { $('menuPanel').hidden = true; });
$('kapcsCimkek').addEventListener('change', e => { cimkeCsoport.visible = e.target.checked; });
$('kapcsFelt').addEventListener('change', e => { feltCsoport.visible = e.target.checked; });
$('kapcsFolyoso').addEventListener('change', e => { folyosoCsoport.visible = e.target.checked; });
$('kapcsFalak').addEventListener('change', e => { falCsoport.visible = e.target.checked; });
$('szinezes').addEventListener('change', e => { szinezesMod = e.target.value; szinez(); });

// ---------------------------------------------------------------------
// Indítás
// ---------------------------------------------------------------------
$('szinezes').value = szinezesMod;
szinez();
attekintes(true);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function hashbolNyit() {
  const kod = decodeURIComponent(location.hash.slice(1));
  if (!kod) return;
  const { pontos } = keres(kod);
  if (pontos) { mezo.value = pontos.kod; helyhezMegy(pontos, 'felul'); }
}
addEventListener('hashchange', () => {
  if (!kijelolt || decodeURIComponent(location.hash.slice(1)) !== kijelolt.kod) hashbolNyit();
});

let elozo = performance.now();
renderer.setAnimationLoop(() => {
  const most = performance.now();
  const dt = Math.min(0.1, (most - elozo) / 1000);
  elozo = most;
  animacioFrissit(most);
  if (mod === 'seta') setaLeptet(dt, most);
  else if (!animacio || controls.enabled) controls.update();
  kozos?.frissit(dt);
  jatek?.frissit(dt);
  targoncak?.frissit(dt);
  ejszaka?.frissit(dt);
  ctf?.frissit(dt);
  kocsi?.frissit(dt);
  const puls = 0.5 + 0.5 * Math.sin(most / 260);
  for (const p of pulzalok) {
    if (p.anyag) p.anyag.opacity = p.min + (p.max - p.min) * puls;
    else p.opacity = 0.45 + 0.5 * puls;
  }
  if (kijelolCsoport.visible) {
    kijelolAnyag.opacity = mod === 'seta' ? 0.06 + 0.14 * puls : 0.25 + 0.35 * puls;
  }
  renderer.render(scene, camera);
});
$('betoltes').hidden = true;

// Közös nézet: a többi látogató pálcikaemberként (config.js: kozos); rá épül a játék (jatek)
let kozos = null, jatek = null, targoncak = null, ejszaka = null, ctf = null, kocsi = null;
try {
  const k2 = v => Math.round(v * 100) / 100;
  kozos = inditKozos({
    C, scene, szovegSprite, uzenet,
    allapot: () => (mod === 'seta'
      ? { x: k2(seta.x), y: k2(seta.y), z: k2(seta.z), yaw: k2(seta.yaw), g: seta.guggol ? 1 : 0, m: 'seta' }
      : { x: k2(controls.target.x), y: k2(controls.target.z), z: 0, yaw: 0, g: 0, m: 'felul' }),
    extra: () => ({ ...(jatek?.extra() ?? {}), ...(ejszaka?.extra() ?? {}), ...(ctf?.extra() ?? {}) }),
    esemeny: e => jatek?.esemeny(e),
    allando: (a, tema) => (tema === 'kocsi' ? kocsi?.fogad(a) : ctf?.fogad(a)),
  });
} catch (e) {
  console.warn('[közös nézet]', e);
}
try {
  jatek = inditJatek({ C, M, scene, camera, seta, kozos, uzenet, getMod: () => mod, kiindulo: D.kulcsok.kiindulo, ctf: () => ctf });
  $('lokesGomb').addEventListener('pointerdown', e => { e.preventDefault(); jatek.lokes(); });
  $('dobasGomb').addEventListener('pointerdown', e => { e.preventDefault(); jatek.dobas(); });
} catch (e) {
  console.warn('[játék]', e);
}
// Targoncák (config.js: targoncak) – a játék nélkül is járnak, csak akkor sebeznek, ha be van kapcsolva
try {
  targoncak = inditTargoncak({ C, M, D, scene, szovegSprite, seta, getMod: () => mod,
    utes: u => jatek ? jatek.utes(u) : Object.assign(seta, { kvx: u.dx * 14, kvy: u.dy * 14, vz: 3.5 }) });
} catch (e) {
  console.warn('[targoncák]', e);
}
// Éjszakai mód a játékban (config.js: ejszaka)
try {
  ejszaka = inditEjszaka({ C, scene, camera, fenyek: { hemi, nap }, getMod: () => mod,
    jatekBe: () => !!jatek?.jatekBe?.(), ledAnyag: LED_ANYAG, cimkeAnyagok: CIMKE_ANYAGOK, targoncak });
} catch (e) {
  console.warn('[éjszaka]', e);
}
// Zászlófoglalás a játékban (config.js: ctf)
try {
  ctf = inditCtf({ C, scene, seta, kozos, uzenet, getMod: () => mod, jatekBe: () => !!jatek?.jatekBe?.(), szovegSprite });
} catch (e) {
  console.warn('[zászlófoglalás]', e);
}
// Vezethető felmosókocsi az EAR raktár előtt (config.js: felmosoKocsi)
try {
  kocsi = inditKocsi({ C, M, scene, seta, kozos, uzenet, getMod: () => mod, szovegSprite });
} catch (e) {
  console.warn('[felmosókocsi]', e);
}
hashbolNyit();
window.raktar = { M, scene, camera, controls, seta, kijelol, helyhezMegy, modValt, lep: setaLeptet, ugras, lenyomva, jatek, kozos, targoncak, ejszaka, ctf, kocsi }; // hibakereséshez
