// Vad kutyák (config.js: kutyak): aki a raktáron kívülre megy (udvar, fedett részek), azt egy falka
// kergetni kezdi a futás sebességével; ha utolérik, harapásonként sebeznek. Ha visszamegy a raktárba,
// a kutyák a küszöbig jönnek, aztán elkullognak. A bázisok környéke biztonságos.
// Mindenki a saját falkáját számolja; a helyüket a pozíció mellett küldi ({kd: 'x,y,yaw;…'}),
// így a többiek is látják, ki elől menekül.
import * as THREE from 'three';

function kutyaModell(szin) {
  const g = new THREE.Group();
  const a = new THREE.MeshLambertMaterial({ color: szin }), sotet = new THREE.MeshLambertMaterial({ color: '#2b2520' });
  const doboz = (sx, sy, sz, m, x, y, z) => { const d = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); d.position.set(x, y, z); g.add(d); return d; };
  doboz(0.28, 0.26, 0.72, a, 0, 0.5, 0);           // törzs
  const fej = new THREE.Group(); fej.position.set(0, 0.68, -0.42); g.add(fej);
  const f = (sx, sy, sz, m, x, y, z) => { const d = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); d.position.set(x, y, z); fej.add(d); return d; };
  f(0.24, 0.22, 0.24, a, 0, 0, 0);                 // fej
  f(0.14, 0.12, 0.18, a, 0, -0.04, -0.18);         // pofa
  f(0.06, 0.05, 0.04, sotet, 0, -0.01, -0.28);     // orr
  f(0.06, 0.12, 0.04, sotet, -0.08, 0.15, 0.03);   // fülek
  f(0.06, 0.12, 0.04, sotet, 0.08, 0.15, 0.03);
  const szem = new THREE.MeshBasicMaterial({ color: '#ffd23a' }); szem.userData.vilagit = true;
  for (const x of [-0.07, 0.07]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), szem); s.position.set(x, 0.04, -0.12); fej.add(s); }
  const labGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.4, 6);
  const labak = [[-0.1, -0.27], [0.1, -0.27], [-0.1, 0.27], [0.1, 0.27]].map(([x, z]) => {
    const p = new THREE.Group(); p.position.set(x, 0.42, z);
    const l = new THREE.Mesh(labGeo, a); l.position.y = -0.2; p.add(l); g.add(p); return p;
  });
  const farok = new THREE.Group(); farok.position.set(0, 0.58, 0.36); g.add(farok);
  const fk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.3, 6), a); fk.position.y = 0.13; farok.add(fk);
  farok.rotation.x = 0.9;
  g.userData = { labak, farok, fej, fazis: Math.random() * 6 };
  return g;
}

const SZINEK = ['#6b5a45', '#4a4038', '#8a7556', '#3d3a36'];

export function inditKutyak({ C, M, scene, seta, kozos, uzenet, getMod, jatek }) {
  const K = C.kutyak;
  if (!K) return null;
  const db = Math.max(1, Math.round(Number(K.db ?? 3)));
  const seb = Number(K.sebesseg ?? C.futasSebesseg ?? 4.5), sebzes = Number(K.sebzes ?? 10);
  const teruletek = (K.teruletek || []).map(t => ({ x0: t.x, y0: t.y, x1: t.x + t.szel, y1: t.y + t.mely, nev: t.nev }));
  const bazisok = (C.ctf?.csapatok || []).map(c => c.bazis);
  const vedett = Number(K.bazisVedelem ?? 2.5);
  const hol = (x, y) => teruletek.find(t => x > t.x0 && x < t.x1 && y > t.y0 && y < t.y1) || null;
  const bazisnal = (x, y) => bazisok.some(b => Math.hypot(x - b.x, y - b.y) < vedett);

  const sajat = [];   // a mi falkánk: {g, x, y, yaw, harap}
  let bentIdo = 0, kintIdo = 0, uzent = false;
  const tobbiekKutyai = new Map(); // játékos id -> [modellek]

  function falka(t) {
    // a terület tőlünk legtávolabbi sarkáról (kicsit beljebb) rontanak ránk
    const sarkok = [[t.x0 + 1, t.y0 + 1], [t.x1 - 1, t.y0 + 1], [t.x0 + 1, t.y1 - 1], [t.x1 - 1, t.y1 - 1]];
    sarkok.sort((a, b) => Math.hypot(b[0] - seta.x, b[1] - seta.y) - Math.hypot(a[0] - seta.x, a[1] - seta.y));
    const [sx, sy] = sarkok[0];
    // szabad hely a sarok közelében (ne tárgyba, kerítésbe essen), egymástól is kicsit távolabb
    const szabad = [];
    for (let r = 0; r < 12 && szabad.length < db; r += 0.5) {
      for (let a = 0; a < 16 && szabad.length < db; a++) {
        const x = sx + Math.cos(a / 16 * Math.PI * 2) * r * (r > 0), y = sy + Math.sin(a / 16 * Math.PI * 2) * r * (r > 0);
        if (hol(x, y) && !bazisnal(x, y) && !M.racs.utkozik(x, y, 0.35, 0, 0.8) && szabad.every(([px, py]) => Math.hypot(px - x, py - y) > 0.8)) szabad.push([x, y]);
        if (r === 0) break;
      }
    }
    for (let i = 0; i < szabad.length; i++) {
      const g = kutyaModell(SZINEK[i % SZINEK.length]);
      const [x, y] = szabad[i];
      g.position.set(x, 0, y);
      scene.add(g);
      sajat.push({ g, x, y, yaw: 0, harap: 0, seb: seb * (0.96 + 0.04 * i) });
    }
  }
  function eltuntet(lista) {
    for (const k of lista) { scene.remove(k.g ?? k); (k.g ?? k).traverse(o => o.geometry?.dispose()); }
    lista.length = 0;
  }
  function animal(g, v, dt, t) {
    const d = g.userData;
    d.fazis += dt * Math.min(v, 6) * 3.2;
    const leng = Math.min(1, v / 1.5) * 0.7 * Math.sin(d.fazis);
    d.labak[0].rotation.x = leng; d.labak[3].rotation.x = leng;
    d.labak[1].rotation.x = -leng; d.labak[2].rotation.x = -leng;
    d.farok.rotation.z = 0.4 * Math.sin(t / 90);
    d.fej.position.y = 0.68 + 0.02 * Math.sin(d.fazis * 2);
  }

  function frissit(dt) {
    const t = performance.now();
    const jatszik = jatek?.jatekBe?.() && getMod() === 'seta' && !seta.halott;
    const ter = jatszik ? hol(seta.x, seta.y) : null;
    if (ter && !bazisnal(seta.x, seta.y)) { kintIdo += dt; bentIdo = 0; } else { bentIdo += dt; kintIdo = 0; }
    // kiérünk: rövid szünet után jön a falka
    if (ter && !sajat.length && kintIdo > Number(K.kesesMp ?? 1.5)) {
      falka(ter);
      if (!uzent) { uzenet('🐕 Vad kutyák! Fuss vissza a raktárba!'); uzent = true; setTimeout(() => (uzent = false), 15000); }
    }
    // bent vagyunk (vagy meghaltunk / kiléptünk a játékból) egy ideje: a kutyák elmennek
    if (sajat.length && (!jatszik || bentIdo > Number(K.elmenesMp ?? 5))) eltuntet(sajat);
    for (const k of sajat) {
      const dx = seta.x - k.x, dy = seta.y - k.y, d = Math.hypot(dx, dy);
      let v = 0;
      // csak a kinti területeken futnak, és a bázisok közelébe sem mennek
      if (d > 0.55 && jatszik) {
        const lep = Math.min(d - 0.5, k.seb * dt);
        // egyenesen felénk; ha akadály van útban, oldalra kerül (a legutóbb bevált oldalt előnyben)
        const o = k.oldal || 1;
        for (const sz of [0, 0.6 * o, -0.6 * o, 1.2 * o, -1.2 * o, 1.8 * o, -1.8 * o]) {
          const c = Math.cos(sz), si = Math.sin(sz);
          const ix = (dx * c - dy * si) / d, iy = (dx * si + dy * c) / d;
          const [nx, ny] = M.racs.mozgat(k.x, k.y, ix * lep, iy * lep, 0.25, 0, 0.8);
          const megtett = Math.hypot(nx - k.x, ny - k.y);
          if (megtett < lep * 0.6 || !hol(nx, ny) || bazisnal(nx, ny)) continue;
          if (sz) k.oldal = Math.sign(sz);
          v = megtett / Math.max(dt, 1e-3); k.x = nx; k.y = ny;
          break;
        }
      }
      // ne bújjanak egymásba
      for (const m of sajat) {
        if (m === k) continue;
        const ex = k.x - m.x, ey = k.y - m.y, e = Math.hypot(ex, ey);
        if (e < 0.55 && e > 1e-4) {
          const [nx, ny] = M.racs.mozgat(k.x, k.y, ex / e * (0.55 - e) * 0.5, ey / e * (0.55 - e) * 0.5, 0.25, 0, 0.8);
          if (hol(nx, ny)) { k.x = nx; k.y = ny; }
        }
      }
      const cel = Math.atan2(-dx, -dy);
      let fd = cel - k.yaw; fd = Math.atan2(Math.sin(fd), Math.cos(fd));
      k.yaw += fd * Math.min(1, dt * 8);
      k.g.position.set(k.x, 0, k.y);
      k.g.rotation.y = k.yaw;
      animal(k.g, v, dt, t);
      // harapás: ha utolért (és nem vagyunk magasan, pl. egy konténer tetején)
      if (jatszik && d < 0.8 && seta.z < 0.9 && !bazisnal(seta.x, seta.y) && t - k.harap > Number(K.harapasMp ?? 1) * 1000) {
        k.harap = t;
        k.g.userData.fej.position.z = -0.5;
        jatek?.harapas?.(sebzes, dx / (d || 1), dy / (d || 1));
      } else k.g.userData.fej.position.z += (-0.42 - k.g.userData.fej.position.z) * Math.min(1, dt * 10);
    }
    // a többiek falkái (amit a pozíciójuk mellett küldenek)
    for (const [id, lista] of tobbiekKutyai) if (!kozos?.tobbiek.has(id)) { eltuntet(lista); tobbiekKutyai.delete(id); }
    for (const v of kozos?.tobbiek.values() || []) {
      const adat = typeof v.cel.kd === 'string' && v.cel.kd ? v.cel.kd.split(';').map(s => s.split(',').map(Number)).filter(p => p.length === 3 && p.every(Number.isFinite)).slice(0, 6) : [];
      let lista = tobbiekKutyai.get(v.id);
      if (!lista) { lista = []; tobbiekKutyai.set(v.id, lista); }
      while (lista.length > adat.length) { const g = lista.pop(); scene.remove(g); }
      while (lista.length < adat.length) { const g = kutyaModell(SZINEK[lista.length % SZINEK.length]); g.position.set(adat[lista.length][0], 0, adat[lista.length][1]); scene.add(g); lista.push(g); }
      adat.forEach(([x, y, yaw], i) => {
        const g = lista[i], ex = g.position.x, ez = g.position.z, kk = Math.min(1, dt * 10);
        g.position.x += (x - ex) * kk; g.position.z += (y - ez) * kk;
        let fd = yaw - g.rotation.y; fd = Math.atan2(Math.sin(fd), Math.cos(fd)); g.rotation.y += fd * kk;
        animal(g, Math.hypot(g.position.x - ex, g.position.z - ez) / Math.max(dt, 1e-3), dt, t);
      });
    }
  }

  return {
    frissit, kint: () => !!hol(seta.x, seta.y),
    extra: () => ({ kd: sajat.map(k => `${k.x.toFixed(1)},${k.y.toFixed(1)},${k.yaw.toFixed(1)}`).join(';') }),
  };
}
