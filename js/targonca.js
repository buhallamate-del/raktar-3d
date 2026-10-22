// Targoncák: véletlenszerű, zárt körutakon járnak a széles folyosókon.
// A mozgás a gép órájából számolódik (determinisztikus), így hálózat nélkül is mindenkinél
// ugyanott van ugyanaz a targonca. Aki útban van, azt elütik (lásd jatek.js: utes).
import * as THREE from 'three';
import { hashSzam } from './modell.js';

// --- folyosóhálózat -------------------------------------------------------
// Szakaszok a folyosók középvonalán; a csomópontok a végpontok és a kereszteződések.
export function folyosoHalozat(M, D, C) {
  const T = C.targoncak || {};
  const minSzel = Number(T.minFolyosoSzelesseg ?? 1.9);
  const kizart = new Set(T.kizartFolyosok || []);
  const szakaszok = []; // [[x1, y1], [x2, y2]]
  const fs = [...M.folyosok.values()].filter(f => f.c != null && f.szel >= minSzel && !kizart.has(f.id));
  const felsoX = [];
  // a zsákutca vége: a folyosó elejétől addig lépünk a vége felé, amíg a targonca elfér
  const elfer = (x, y) => !M.racs.utkozik(x, y, 0.65, 0, 1.8);
  const kezdet = (x, y, dx, dy, max) => {
    for (let t = 0; t < max; t += 0.1) if (elfer(x + dx * t, y + dy * t)) return [x + dx * t, y + dy * t];
    return [x + dx * max, y + dy * max];
  };
  for (const f of fs) {
    if (f.tipus === 'gerinc') continue;
    const veg = f.e ?? f.max;
    if (f.tengely === 'X') szakaszok.push([kezdet(f.min + 0.6, f.c, 1, 0, veg - f.min - 1), [veg, f.c]]);
    else { szakaszok.push([kezdet(f.c, f.min + 0.8, 0, 1, veg - f.min - 1), [f.c, veg]]); felsoX.push(f.c); }
  }
  for (const f of fs) {
    if (f.tipus !== 'gerinc') continue;
    if (f.tengely === 'Y') {
      // T1 keresztfolyosó: a fejfolyosótól az utolsó folyosóig
      const ys = fs.filter(g => g.tipus !== 'gerinc' && g.tengely === 'X' && g.szarny === f.szarny).map(g => g.c);
      if (ys.length) szakaszok.push([[f.c, Math.min(...ys)], [f.c, Math.max(...ys)]]);
    } else if (felsoX.length) {
      // a felső szárny alsó sávja: a legszélső folyosótól az átjáróig
      szakaszok.push([[Math.min(...felsoX), f.c], [D.kulcsok.atjaro.x, f.c]]);
    }
  }
  for (const ut of T.extraUtak || []) for (let i = 1; i < ut.length; i++) szakaszok.push([ut[i - 1], ut[i]]);

  // csomópontok: minden végpont; ami egy másik szakaszra esik, az ott is csomópont
  const pontok = [];
  const pontId = (x, y) => {
    for (let i = 0; i < pontok.length; i++) if (Math.hypot(pontok[i][0] - x, pontok[i][1] - y) < 0.3) return i;
    pontok.push([x, y]); return pontok.length - 1;
  };
  for (const [a, b] of szakaszok) { pontId(...a); pontId(...b); }
  const szom = pontok.map(() => new Set());
  for (const [a, b] of szakaszok) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 0.1) continue;
    const rajta = [];
    pontok.forEach(([x, y], i) => {
      const t = ((x - a[0]) * dx + (y - a[1]) * dy) / (L * L);
      const tav = Math.abs((x - a[0]) * dy - (y - a[1]) * dx) / L;
      if (t > -0.01 && t < 1.01 && tav < 0.3) rajta.push([t, i]);
    });
    rajta.sort((p, q) => p[0] - q[0]);
    for (let k = 1; k < rajta.length; k++) {
      const i = rajta[k - 1][1], j = rajta[k][1];
      if (i !== j) { szom[i].add(j); szom[j].add(i); }
    }
  }
  return { pontok, szom: szom.map(s => [...s]) };
}

// Zárt körút: véletlen séta (visszafordulás csak zsákutcában), majd a legrövidebb úton vissza.
export function korut(halo, mag, lepesek = 90) {
  const { pontok, szom } = halo;
  const r = k => hashSzam(`${mag}:${k}`);
  const jok = pontok.map((_, i) => i).filter(i => szom[i].length > 0);
  if (!jok.length) return [];
  const start = jok[Math.floor(r('start') * jok.length)];
  const ut = [start];
  let elozo = -1, akt = start;
  for (let k = 0; k < lepesek; k++) {
    let lehet = szom[akt].filter(j => j !== elozo);
    if (!lehet.length) lehet = szom[akt];
    const kov = lehet[Math.floor(r(k) * lehet.length)];
    elozo = akt; akt = kov; ut.push(akt);
  }
  // vissza a kezdőpontba (szélességi keresés a csomópontok közt, hossz szerint elég jó)
  const honnan = new Map([[akt, -1]]), sor = [akt];
  while (sor.length && !honnan.has(start)) {
    const i = sor.shift();
    for (const j of szom[i]) if (!honnan.has(j)) { honnan.set(j, i); sor.push(j); }
  }
  const vissza = [];
  for (let i = honnan.get(start); i !== undefined && i !== -1 && i !== akt; i = honnan.get(i)) vissza.push(i);
  ut.push(...vissza.reverse(), start);
  return ut;
}

// --- megjelenítés és mozgás ---------------------------------------------
function targoncaModell(szam, szovegSprite) {
  const g = new THREE.Group();
  const narancs = new THREE.MeshLambertMaterial({ color: '#e8561c' });
  const sotet = new THREE.MeshLambertMaterial({ color: '#2b2f36' });
  const szurke = new THREE.MeshLambertMaterial({ color: '#7d858f' });
  const doboz = (sx, sy, sz, a, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), a); m.position.set(x, y, z); g.add(m); return m; };
  // a targonca előre (−Z) néz; a villa elöl
  doboz(1.1, 0.75, 1.7, narancs, 0, 0.55, 0.15);           // alváz
  doboz(1.1, 0.7, 0.45, sotet, 0, 0.75, 0.95);             // ellensúly hátul
  doboz(0.5, 0.5, 0.5, sotet, 0, 1.15, 0.25);              // ülés
  for (const x of [-0.5, 0.5]) for (const z of [-0.45, 0.85]) doboz(0.06, 1.25, 0.06, sotet, x, 1.55, z); // védőtető oszlopai
  doboz(1.1, 0.06, 1.4, sotet, 0, 2.18, 0.2);              // védőtető
  for (const x of [-0.35, 0.35]) doboz(0.09, 2.3, 0.09, szurke, x, 1.15, -0.72); // oszlop (mast)
  const villa = new THREE.Group();
  for (const x of [-0.25, 0.25]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.0), szurke); v.position.set(x, 0, -0.5); villa.add(v); }
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), szurke); hat.position.set(0, 0.25, 0); villa.add(hat);
  villa.position.set(0, 0.1, -0.78);
  g.add(villa);
  const kerek = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 14);
  for (const x of [-0.5, 0.5]) for (const z of [-0.45, 0.75]) {
    const k = new THREE.Mesh(kerek, sotet); k.rotation.z = Math.PI / 2; k.position.set(x, 0.25, z); g.add(k);
  }
  // kék biztonsági fénypötty a padlón, menetirányban
  const potty = new THREE.Mesh(new THREE.CircleGeometry(0.35, 24),
    new THREE.MeshBasicMaterial({ color: '#2f7dff', transparent: true, opacity: 0.8, depthWrite: false }));
  potty.rotation.x = -Math.PI / 2; potty.position.set(0, 0.02, -3.2);
  g.add(potty);
  const t = szovegSprite(`Targonca ${szam}`, 0.35, { hatter: '#e8561c', szin: '#fff', meret: 44 });
  t.position.set(0, 2.7, 0.2);
  g.add(t);
  potty.material.userData.vilagit = true;
  // fényszóró (éjszaka látszik): áttetsző fénykúp előre
  const reflektor = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: '#fff2c8', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  reflektor.material.userData.vilagit = true;
  reflektor.rotation.x = -Math.PI / 2; reflektor.position.set(0, 1.4, -4.4);
  reflektor.visible = false;
  g.add(reflektor);
  g.userData = { villa, potty, reflektor };
  return g;
}

export function inditTargoncak({ C, M, D, scene, szovegSprite, seta, getMod, utes }) {
  const T = C.targoncak || {};
  const db = Math.max(0, Math.round(Number(T.db ?? 3)));
  if (!db) return { frissit() {}, targoncak: [] };
  const seb = Number(T.sebesseg ?? 2.2), allas = Number(T.rakodasMp ?? 3);
  const halo = folyosoHalozat(M, D, C);
  const targoncak = [];
  for (let n = 0; n < db; n++) {
    const ut = korut(halo, `${T.mag ?? 'raktar'}#${n}`);
    if (ut.length < 2) continue;
    // időrend: menet a szakaszokon, zsákutcában (1 szomszéd) rakodási szünet
    const lepesek = [];
    let ido = 0;
    for (let i = 1; i < ut.length; i++) {
      const a = halo.pontok[ut[i - 1]], b = halo.pontok[ut[i]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.05) continue;
      lepesek.push({ t0: ido, t1: ido + L / seb, a, b, all: false });
      ido += L / seb;
      if (halo.szom[ut[i]].length === 1) { lepesek.push({ t0: ido, t1: ido + allas, a: b, b, all: true }); ido += allas; }
    }
    const g = targoncaModell(n + 1, szovegSprite);
    scene.add(g);
    targoncak.push({ n, g, lepesek, hossz: ido, eltolas: hashSzam(`elt${n}`) * ido, irany: 0, utolsoUtes: 0, x: 0, y: 0, fx: 0, fy: -1 });
  }

  const allapotIdoben = (tg, t) => {
    const s = ((t + tg.eltolas) % tg.hossz + tg.hossz) % tg.hossz;
    let lo = 0, hi = tg.lepesek.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (tg.lepesek[m].t1 < s) lo = m + 1; else hi = m; }
    return { l: tg.lepesek[lo], s };
  };

  function frissit(dt) {
    const t = Date.now() / 1000;
    for (const tg of targoncak) {
      const { l, s } = allapotIdoben(tg, t);
      const u = l.all ? 1 : (s - l.t0) / Math.max(1e-6, l.t1 - l.t0);
      const x = l.a[0] + (l.b[0] - l.a[0]) * u, y = l.a[1] + (l.b[1] - l.a[1]) * u;
      if (!l.all) {
        const dx = l.b[0] - l.a[0], dy = l.b[1] - l.a[1], L = Math.hypot(dx, dy);
        tg.fx = dx / L; tg.fy = dy / L;
      }
      // fordulás simán (a modell −Z felé néz: yaw = atan2(−fx, −fy))
      const cel = Math.atan2(-tg.fx, -tg.fy);
      let d = cel - tg.irany; d = Math.atan2(Math.sin(d), Math.cos(d));
      tg.irany += d * Math.min(1, dt * 6);
      tg.x = x; tg.y = y;
      tg.g.position.set(x, 0, y);
      tg.g.rotation.y = tg.irany;
      // rakodáskor a villa fel-le jár
      const villaCel = l.all ? 0.1 + 1.4 * Math.sin(Math.PI * (s - l.t0) / Math.max(1e-6, l.t1 - l.t0)) : 0.1;
      tg.g.userData.villa.position.y += (villaCel - tg.g.userData.villa.position.y) * Math.min(1, dt * 4);
      tg.g.userData.potty.visible = !l.all;
      // elütés: a gyalogos a targonca alaprajzán belül (a villát is beleértve), alacsonyan
      if (getMod() !== 'seta' || seta.halott || seta.z > 1.4) continue;
      const fx = -Math.sin(tg.irany), fy = -Math.cos(tg.irany);
      const px = seta.x - x, py = seta.y - y;
      const elore = px * fx + py * fy, oldal = px * fy - py * fx;
      const r = Number(C.testSugar ?? 0.28);
      if (elore > -1.2 - r && elore < 1.3 + r && Math.abs(oldal) < 0.55 + r && performance.now() - tg.utolsoUtes > 1500 && !l.all) {
        tg.utolsoUtes = performance.now();
        const ki = Math.sign(oldal) || 1;
        utes?.({ nev: `Targonca ${tg.n + 1}`, dx: fx * 0.8 + fy * ki * 0.6, dy: fy * 0.8 - fx * ki * 0.6 });
      }
    }
  }
  return { frissit, targoncak, halo };
}
