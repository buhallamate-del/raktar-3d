// Játék a közös nézetben: lökés, palackdobás, életerő (HP), halálok és ölések számlálása.
// Mindenki a saját életerejéért felel: ő dönti el, hogy eltalálták-e, és ő jelenti a halálát.
// Események (kozos.kuldE, a <csatorna>/e témán):
//   {t:'lokes', cel, dx, dy}          – meglökték a célt (dx, dy: a lökés iránya)
//   {t:'dobas', id, x, y, z, vx, vy, vz} – palack indult (világkoordinátában, y = fel)
//   {t:'talalat', id, cel}            – a palack eltalálta a célt (mindenki eltünteti a palackot)
//   {t:'halal', cel, celNev, tol2, tol2Nev, ok} – a cél meghalt; tol2 a tettes (ha van)
//   {t:'csomag', idx, ig}              – valaki felvette az idx. életerőcsomagot; ig-ig (Date.now) nincs a helyén
//   {t:'lada', idx, ig}                – valaki felvette az idx. fegyverládából az AK-t
//   {t:'loves', x, y, z, dx, dy, dz, h} – lövés (kezdőpont, irány, h: meddig repült a falig/állványig)
import * as THREE from 'three';

const TAROL = 'raktar3d.jatek';
const OK_SZOVEG = { lokes: 'meglökték', palack: 'palack találta el', eses: 'leesett', targonca: 'elütötte egy targonca', loves: 'lelőtték' };

// Egyszerű, rajzfilmes AK: fa tus és markolat, fekete tok és cső, ívelt tár. Előre (−Z) néz.
function akModell() {
  const g = new THREE.Group();
  const fa = new THREE.MeshLambertMaterial({ color: '#8a5a2b' }), fekete = new THREE.MeshLambertMaterial({ color: '#23262b' });
  const d = (sx, sy, sz, a, x, y, z, rx = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), a); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
  d(0.06, 0.08, 0.34, fekete, 0, 0, 0);            // tok
  d(0.05, 0.06, 0.24, fa, 0, -0.01, -0.28);        // előagy
  const cso = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), fekete);
  cso.rotation.x = Math.PI / 2; cso.position.set(0, 0.02, -0.52); g.add(cso);
  d(0.05, 0.09, 0.26, fa, 0, -0.03, 0.29, 0.12);   // tus
  d(0.035, 0.1, 0.04, fa, 0, -0.08, 0.1, -0.3);    // markolat
  d(0.04, 0.16, 0.06, fekete, 0, -0.12, -0.07, 0.35); // ívelt tár
  return g;
}

function betolt() {
  try { return JSON.parse(localStorage.getItem(TAROL)) || {}; } catch { return {}; }
}
function ment(a) {
  try { localStorage.setItem(TAROL, JSON.stringify(a)); } catch { /* nincs tárhely */ }
}

// ctf(): a zászlófoglalás (ctf.js), ha van – csapattársat nem lehet bántani, újraéledés a saját bázison
export function inditJatek({ C, M, scene, camera, seta, kozos, uzenet, getMod, kiindulo, ctf = () => null }) {
  const J = C.jatek || {};
  const cfg = {
    lokes: Number(J.lokesSebzes ?? 10), palack: Number(J.palackSebzes ?? 25), targonca: Number(C.targoncak?.sebzes ?? 40),
    eses: J.esesSebzes !== false, ujraMp: Number(J.ujraeledesMp ?? 3), palackSeb: Number(J.palackSebesseg ?? 14),
  };
  const el = id => document.getElementById(id);
  const tar = betolt();
  const pont = { d: Number(tar.d) || 0, k: Number(tar.k) || 0 };
  let be = tar.be ?? (J.bekapcsolva !== false);
  let hp = 100, halott = false, tamado = null, lokesIdo = 0, dobasIdo = 0, szamlalo = 0;
  const mentes = () => ment({ ...pont, be });

  // --- felület ---
  el('jatekBe').checked = be;
  el('jatekBe').addEventListener('change', () => { be = el('jatekBe').checked; mentes(); kozos?.frissitAllapot(); });
  el('jatekNullaz').addEventListener('click', () => { pont.d = pont.k = 0; mentes(); kozos?.frissitAllapot(); listaFrissit(); });
  el('kozosJelzo').addEventListener('click', () => { el('pontPanel').hidden = !el('pontPanel').hidden; listaFrissit(); });
  el('pontBezar').addEventListener('click', () => { el('pontPanel').hidden = true; });

  const serulhet = () => be && getMod() === 'seta' && !halott;
  const tars = id => !!ctf()?.csapattars(id);
  // a felmosókocsin ülve semmi mást nem lehet csinálni, csak vezetni
  const szabad = () => serulhet() && !seta.kocsin;
  const most = () => performance.now();

  function villanas() {
    const v = el('sebzesVillanas');
    v.hidden = false;
    v.style.opacity = '1';
    clearTimeout(villanas.t);
    villanas.t = setTimeout(() => { v.style.opacity = '0'; setTimeout(() => (v.hidden = true), 250); }, 120);
  }

  function sebzes(n, ok) {
    if (!serulhet()) return;
    hp = Math.max(0, hp - n);
    villanas();
    kozos?.frissitAllapot();
    if (hp <= 0) meghal(ok);
  }

  function meghal(ok) {
    halott = true;
    ak = null; lovesLe = false; // a fegyver elveszik
    seta.halott = true;
    pont.d++;
    mentes();
    const tettes = tamado && most() - tamado.ido < 6000 ? tamado : null;
    const ok2 = tettes && ok === 'eses' ? (tettes.id === 'targonca' ? 'targonca' : 'lokes') : ok;
    kozos?.kuldE({ t: 'halal', cel: kozos.id, celNev: kozos.nev(), tol2: tettes?.id, tol2Nev: tettes?.nev, ok: ok2 });
    el('halalSzoveg').textContent = tettes
      ? `${tettes.nev} ${ok2 === 'palack' ? 'eltalált egy palackkal' : ok2 === 'targonca' ? 'elütött' : ok2 === 'loves' ? 'lelőtt' : 'meglökött'}.`
      : OK_SZOVEG[ok2] === 'leesett' ? 'Leestél.' : 'Elfogyott az életerőd.';
    el('halalKep').hidden = false;
    kozos?.frissitAllapot();
    setTimeout(ujraeled, cfg.ujraMp * 1000);
  }

  function ujraeled() {
    hp = 100;
    halott = false;
    tamado = null;
    const hely = ctf()?.ujraHely() || kiindulo;
    Object.assign(seta, { halott: false, x: hely.x, y: hely.y, z: 0, kz: 0, vz: 0, kvx: 0, kvy: 0, guggol: false });
    el('halalKep').hidden = true;
    kozos?.frissitAllapot();
  }

  // --- lökés ---
  function lokes() {
    if (!szabad() || most() - lokesIdo < 800) return;
    lokesIdo = most();
    const fx = -Math.sin(seta.yaw), fy = -Math.cos(seta.yaw);
    let leg = null, legD = 1.4;
    for (const t of kozos?.tobbiek.values() || []) {
      const u = t.cel;
      if (!u.j || u.m === 'felul' || u.hal) continue;
      const dx = u.x - seta.x, dy = u.y - seta.y, d = Math.hypot(dx, dy);
      if (d > legD || d < 0.01 || Math.abs((u.z || 0) - seta.z) > 1.2) continue;
      if ((dx * fx + dy * fy) / d < 0.5) continue; // csak aki előttünk van
      leg = { t, dx: dx / d, dy: dy / d }; legD = d;
    }
    if (!leg) { uzenet('Nincs senki előtted, akit meglökhetnél'); return; }
    kozos.kuldE({ t: 'lokes', cel: leg.t.id, dx: leg.dx, dy: leg.dy, nev: kozos.nev() });
    kozos.villant(leg.t.id);
    uzenet(`Meglökted: ${leg.t.nev}`);
  }

  // --- palackok ---
  const palackGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10);
  const palackAnyag = new THREE.MeshLambertMaterial({ color: '#1f7a3a', transparent: true, opacity: 0.85 });
  const palackok = new Map(); // id -> {mesh, p: Vector3, v: Vector3, tol, nev, ido, sajat}
  const szilankok = [];
  const v3 = new THREE.Vector3();

  function inditPalack(id, p, v, tol, nev, sajat) {
    if (palackok.has(id)) return;
    const mesh = new THREE.Mesh(palackGeo, palackAnyag);
    mesh.position.copy(p);
    scene.add(mesh);
    palackok.set(id, { mesh, p: p.clone(), v: v.clone(), tol, nev, ido: most(), sajat });
  }
  function torik(id, hol) {
    const b = palackok.get(id);
    if (!b) return;
    scene.remove(b.mesh);
    palackok.delete(id);
    const pos = hol || b.p;
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), palackAnyag);
      s.position.copy(pos);
      scene.add(s);
      szilankok.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3), ido: most() });
    }
  }
  function dobas() {
    if (fegyverKezben()) return; // AK-val a kézben a G nem dob (Q-val lehet palackra váltani)
    if (!szabad() || most() - dobasIdo < 600) return;
    dobasIdo = most();
    camera.getWorldDirection(v3);
    const p = camera.position.clone().addScaledVector(v3, 0.5);
    const v = v3.clone().multiplyScalar(cfg.palackSeb).add(new THREE.Vector3(0, 1.5, 0));
    const id = `${kozos?.id || 'helyi'}-${++szamlalo}`;
    inditPalack(id, p, v, kozos?.id, kozos?.nev(), true);
    kozos?.kuldE({ t: 'dobas', id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
      vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2), nev: kozos.nev() });
  }
  // van-e akadály (fal, állvány, padló) a világ egy pontjában (x, fel, z)
  function akadalyban(p) {
    if (p.y <= 0.02) return true;
    for (const t of M.racs.kozel(p.x, p.z, 0.05)) {
      if (p.x > t.x0 && p.x < t.x1 && p.z > t.y0 && p.z < t.y1 && p.y >= (t.z0 ?? 0) && p.y <= (t.z1 ?? Infinity)) return true;
    }
    return false;
  }

  // --- AK (config.js: fegyver, fegyverLadak) ---
  const FG = C.fegyver || {};
  const akCfg = { sebzes: Number(FG.sebzes ?? 12), perMp: Number(FG.lovesPerMp ?? 9), tar: Number(FG.tar ?? 30),
    loszer: Number(FG.loszer ?? 90), toltes: Number(FG.ujratoltesMp ?? 2) * 1000, tav: Number(FG.hatotav ?? 60) };
  let ak = null;              // {tarban, tartalek, toltesIg}
  let fegyverValaszt = 'ak';  // 'ak' | 'palack' (Q vált)
  let lovesLe = false, utolsoLoves = 0, rugas = 0;
  if (!camera.parent) scene.add(camera);
  const kezbenAk = akModell();
  kezbenAk.position.set(0.2, -0.19, -0.55);
  kezbenAk.scale.setScalar(0.8);
  kezbenAk.rotation.y = 0.04;
  kezbenAk.visible = false;
  camera.add(kezbenAk);
  const torkolat = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd84d' }));
  torkolat.material.userData.vilagit = true;
  torkolat.position.set(0, 0.02, -0.7); torkolat.visible = false; kezbenAk.add(torkolat);
  const ladak = (C.fegyverLadak || []).map((c, idx) => {
    const g = new THREE.Group();
    const lada = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.45), new THREE.MeshLambertMaterial({ color: '#4b5320' }));
    lada.position.y = 0.175; g.add(lada);
    const fegyver = akModell(); fegyver.scale.setScalar(1.4); fegyver.position.y = 0.75; g.add(fegyver);
    g.position.set(c.x, Number(c.z ?? 0), c.y);
    scene.add(g);
    return { ...c, idx, g, fegyver, ig: 0, ujraMp: Number(c.ujraMp ?? 45) };
  });
  const fegyverKezben = () => !!ak && fegyverValaszt === 'ak' && getMod() === 'seta' && !halott && be && !seta.kocsin;
  function ujratolt() {
    if (!ak || ak.toltesIg || ak.tarban >= akCfg.tar || ak.tartalek <= 0) return;
    ak.toltesIg = most() + akCfg.toltes;
  }
  function valt() {
    if (!ak) { uzenet('Nincs nálad AK – a fegyverládán találsz (a galérián és az áruátvételen)'); return; }
    fegyverValaszt = fegyverValaszt === 'ak' ? 'palack' : 'ak';
    uzenet(fegyverValaszt === 'ak' ? '🔫 AK a kézben' : '🍾 Palack a kézben');
    kozos?.frissitAllapot();
  }
  // meddig repül a lövedék, mielőtt falba, állványba, padlóba ütközik
  function lovedekHossz(o, d) {
    const p = new THREE.Vector3();
    for (let t = 0.3; t < akCfg.tav; t += 0.2) { p.copy(o).addScaledVector(d, t); if (akadalyban(p)) return t; }
    return akCfg.tav;
  }
  const nyomok = [];
  function nyomjelzo(o, d, h) {
    const geo = new THREE.BufferGeometry().setFromPoints([o.clone().addScaledVector(d, 0.6), o.clone().addScaledVector(d, h)]);
    const vonal = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.9 }));
    scene.add(vonal);
    nyomok.push({ vonal, ido: most() });
  }
  function lo() {
    if (!ak || ak.toltesIg) return;
    if (ak.tarban <= 0) { ujratolt(); return; }
    ak.tarban--;
    const o = camera.getWorldPosition(new THREE.Vector3());
    const d = camera.getWorldDirection(new THREE.Vector3());
    d.x += (Math.random() - 0.5) * 0.02; d.y += (Math.random() - 0.5) * 0.02; d.z += (Math.random() - 0.5) * 0.02; d.normalize();
    const h = lovedekHossz(o, d);
    nyomjelzo(o, d, h);
    rugas = 1;
    seta.pitch = Math.min(1.45, seta.pitch + 0.003); // enyhe felrúgás
    const k = v => +v.toFixed(3);
    kozos?.kuldE({ t: 'loves', x: k(o.x), y: k(o.y), z: k(o.z), dx: k(d.x), dy: k(d.y), dz: k(d.z), h: +h.toFixed(2), nev: kozos.nev() });
    if (ak.tarban === 0) ujratolt();
  }
  // a lövés eltalált-e minket: a sugár és a testünk (függőleges szakasz) távolsága
  function lovesTalal(e) {
    const ox = +e.x, oy = +e.y, oz = +e.z, dx = +e.dx, dy = +e.dy, dz = +e.dz, h = +e.h;
    if (![ox, oy, oz, dx, dy, dz, h].every(Number.isFinite)) return false;
    const hv2 = dx * dx + dz * dz;
    if (hv2 < 1e-6) return false;
    const t = Math.max(0, Math.min(h, ((seta.x - ox) * dx + (seta.y - oz) * dz) / hv2));
    const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
    const test = seta.guggol ? 1.0 : 1.8;
    return Math.hypot(px - seta.x, pz - seta.y) < 0.35 && py > seta.z && py < seta.z + test + 0.2;
  }
  const vaszon = document.querySelector('#vaszon canvas');
  vaszon?.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button === 0 && document.pointerLockElement === vaszon && fegyverKezben()) lovesLe = true;
  });
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse') lovesLe = false; });
  el('lovesGomb')?.addEventListener('pointerdown', e => { e.preventDefault(); lovesLe = true; el('lovesGomb').setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel']) el('lovesGomb')?.addEventListener(ev, () => { lovesLe = false; });

  // --- életerőcsomagok (config.js: eletcsomagok) ---
  const csomagTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#d0261b'; x.fillRect(24, 10, 16, 44); x.fillRect(10, 24, 44, 16);
    x.strokeStyle = '#d0261b'; x.lineWidth = 4; x.strokeRect(2, 2, 60, 60);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const csomagok = (C.eletcsomagok || []).map((c, idx) => {
    const g = new THREE.Group();
    const doboz = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.45), new THREE.MeshLambertMaterial({ map: csomagTex, emissive: '#331111' }));
    const gyuru = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 28),
      new THREE.MeshBasicMaterial({ color: '#3ddc5a', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    gyuru.rotation.x = -Math.PI / 2; gyuru.position.y = 0.02;
    g.add(doboz, gyuru);
    g.position.set(c.x, 0, c.y);
    scene.add(g);
    return { ...c, idx, g, doboz, ig: 0, hp: Number(c.hp ?? 50), ujraMp: Number(c.ujraMp ?? 30) };
  });
  function csomagFelvetel(t) {
    if (!szabad() || hp >= 100) return;
    for (const c of csomagok) {
      if (Date.now() < c.ig) continue;
      if (Math.hypot(seta.x - c.x, seta.y - c.y) > 0.7 || Math.abs(seta.z - (c.z ?? 0)) > 1) continue;
      const elotte = hp;
      hp = Math.min(100, hp + c.hp);
      c.ig = Date.now() + c.ujraMp * 1000;
      kozos?.kuldE({ t: 'csomag', idx: c.idx, ig: c.ig });
      kozos?.frissitAllapot();
      uzenet(`➕ Életerőcsomag: +${Math.round(hp - elotte)} HP`);
      return;
    }
  }

  // --- események a többiektől ---
  function esemeny(e) {
    if (e.t === 'lokes') {
      if (e.cel === kozos.id) {
        if (!serulhet()) return;
        tamado = { id: e.tol, nev: e.nev || 'Valaki', ido: most() };
        seta.kvx = (Number(e.dx) || 0) * 6;
        seta.kvy = (Number(e.dy) || 0) * 6;
        seta.vz = Math.max(seta.vz || 0, 2.5);
        uzenet(`${tamado.nev} meglökött!`);
        if (!tars(e.tol)) sebzes(cfg.lokes, 'lokes');
      } else kozos.villant(e.cel);
    } else if (e.t === 'dobas') {
      const p = new THREE.Vector3(+e.x, +e.y, +e.z), v = new THREE.Vector3(+e.vx, +e.vy, +e.vz);
      if ([p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite)) inditPalack(e.id, p, v, e.tol, e.nev || 'Valaki', false);
    } else if (e.t === 'talalat') {
      torik(e.id);
      if (e.cel !== kozos.id) kozos.villant(e.cel);
    } else if (e.t === 'loves') {
      const o = new THREE.Vector3(+e.x, +e.y, +e.z), d = new THREE.Vector3(+e.dx, +e.dy, +e.dz);
      if ([o.x, o.y, o.z, d.x, d.y, d.z, +e.h].every(Number.isFinite)) nyomjelzo(o, d.normalize(), Math.min(+e.h, akCfg.tav));
      if (serulhet() && !tars(e.tol) && lovesTalal(e)) {
        tamado = { id: e.tol, nev: e.nev || 'Valaki', ido: most() };
        if (most() - (lovesTalal.uz || 0) > 1500) { uzenet(`${tamado.nev} rád lőtt!`); lovesTalal.uz = most(); }
        sebzes(akCfg.sebzes, 'loves');
      }
    } else if (e.t === 'lada') {
      const c = ladak[Number(e.idx)];
      if (c && Number.isFinite(+e.ig)) c.ig = Math.max(c.ig, +e.ig);
    } else if (e.t === 'csomag') {
      const c = csomagok[Number(e.idx)];
      if (c && Number.isFinite(+e.ig)) c.ig = Math.max(c.ig, +e.ig);
    } else if (e.t === 'halal') {
      if (e.tol2 && e.tol2 === kozos.id) { pont.k++; mentes(); kozos.frissitAllapot(); }
      const kie = e.tol2Nev ? ` – ${e.tol2 === kozos.id ? 'te' : e.tol2Nev}` : '';
      uzenet(`☠ ${e.celNev || 'Valaki'} meghalt (${OK_SZOVEG[e.ok] || 'elfogyott az életereje'})${kie}`);
      listaFrissit();
    }
  }

  // targonca ütötte el: nagyot lök; sebez, ha a játék be van kapcsolva
  function utes({ nev, dx, dy }) {
    if (getMod() !== 'seta' || halott) return;
    seta.kvx = dx * 14; seta.kvy = dy * 14;
    seta.vz = Math.max(seta.vz || 0, 3.5);
    if (!be) { uzenet(`Vigyázz, ${nev} majdnem elütött!`); return; }
    tamado = { id: 'targonca', nev, ido: most() };
    uzenet(`💥 ${nev} elütött!`);
    sebzes(cfg.targonca, 'targonca');
  }

  // esés: ~4 m fölött sebez (vz: a földet érés pillanatnyi sebessége, negatív)
  function eses(vz) {
    if (!cfg.eses || !serulhet()) return;
    const v = -vz;
    if (v > 9) sebzes(Math.round((v - 9) * 12), 'eses');
  }

  // --- pontlista ---
  function listaFrissit() {
    if (el('pontPanel').hidden) return;
    const sorok = [{ nev: kozos?.nev() || 'Én', h: hp, d: pont.d, k: pont.k, en: true, j: be, cs: ctf()?.extra().cs }];
    for (const t of kozos?.tobbiek.values() || []) {
      if (t.cel.j) sorok.push({ nev: t.nev, h: t.cel.h, d: t.cel.d || 0, k: t.cel.k || 0, hal: t.cel.hal, cs: t.cel.cs });
    }
    sorok.sort((a, b) => b.k - a.k || a.d - b.d);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    el('pontLista').innerHTML = '<tr><th>Név</th><th>HP</th><th>☠ halál</th><th>🎯 ölés</th></tr>' + sorok.map(s =>
      `<tr class="${s.en ? 'en' : ''}"><td>${ctf()?.szin(s.cs) ? `<span style="color:${ctf().szin(s.cs)}" title="${esc(ctf().csapatNev(s.cs))} csapat">■</span> ` : ''}${esc(s.nev)}${s.en ? ' (te)' : ''}</td><td>${s.j === false ? '–' : s.hal ? '☠' : Math.round(s.h ?? 100)}</td><td>${s.d}</td><td>${s.k}</td></tr>`).join('');
  }

  // --- képkockánként ---
  let listaIdo = 0;
  function frissit(dt) {
    const seta2 = getMod() === 'seta';
    el('hpSav').hidden = !(be && seta2);
    if (be && seta2) {
      el('hpErtek').style.width = `${hp}%`;
      el('hpErtek').style.background = hp > 50 ? '#3ddc5a' : hp > 25 ? '#f0b400' : '#e5322d';
      const loszer = ak ? ` · 🔫 ${ak.toltesIg ? 'töltés…' : `${ak.tarban}/${ak.tartalek}`}${fegyverValaszt === 'palack' ? ' (Q)' : ''}` : '';
      el('hpSzoveg').textContent = halott ? '☠' : `${Math.round(hp)} HP · ☠ ${pont.d} · 🎯 ${pont.k}${loszer}`;
    }
    for (const id of ['lokesGomb', 'dobasGomb']) el(id).hidden = !(be && seta2 && document.body.classList.contains('erintes'));
    const t = most();
    for (const [id, b] of palackok) {
      if (t - b.ido > 5000) { torik(id); continue; }
      const lepes = Math.max(1, Math.ceil(b.v.length() * dt / 0.1));
      let utkozott = false;
      for (let i = 0; i < lepes && !utkozott; i++) {
        const h = dt / lepes;
        b.v.y -= 9.81 * h;
        b.p.addScaledVector(b.v, h);
        // találat rajtunk? (mi döntjük el, és mi jelentjük)
        if (!b.sajat && b.tol !== kozos?.id && serulhet() && !tars(b.tol)) {
          const test = seta.guggol ? 1.0 : 1.8;
          if (Math.hypot(b.p.x - seta.x, b.p.z - seta.y) < 0.4 && b.p.y > seta.z && b.p.y < seta.z + test + 0.2) {
            tamado = { id: b.tol, nev: b.nev || 'Valaki', ido: t };
            kozos?.kuldE({ t: 'talalat', id, cel: kozos.id });
            torik(id);
            uzenet(`${tamado.nev} eltalált egy palackkal!`);
            sebzes(cfg.palack, 'palack');
            utkozott = true;
            break;
          }
        }
        if (akadalyban(b.p)) { torik(id); utkozott = true; }
      }
      if (!utkozott && palackok.has(id)) {
        b.mesh.position.copy(b.p);
        b.mesh.rotation.x += dt * 12;
        b.mesh.rotation.z += dt * 7;
      }
    }
    for (let i = szilankok.length - 1; i >= 0; i--) {
      const s = szilankok[i];
      s.v.y -= 9.81 * dt;
      s.s.position.addScaledVector(s.v, dt);
      if (s.s.position.y < 0.02) { s.s.position.y = 0.02; s.v.set(0, 0, 0); }
      if (t - s.ido > 900) { scene.remove(s.s); s.s.geometry.dispose(); szilankok.splice(i, 1); }
    }
    if (t - listaIdo > 1000) { listaIdo = t; listaFrissit(); }
    // életerőcsomagok: lebegnek és forognak; felvétel után ujraMp-ig nincsenek a helyükön
    const ido = Date.now();
    for (const c of csomagok) {
      c.g.visible = be && ido >= c.ig;
      c.doboz.position.y = 0.45 + 0.08 * Math.sin(t / 400 + c.idx);
      c.doboz.rotation.y += dt * 1.5;
    }
    csomagFelvetel(t);
    // AK: fegyverláda, lövés, újratöltés, a kézben lévő fegyver mozgása
    for (const c of ladak) {
      c.g.visible = be;
      c.fegyver.visible = ido >= c.ig;
      c.fegyver.rotation.y += dt * 1.2;
      c.fegyver.position.y = 0.75 + 0.06 * Math.sin(t / 450);
      // a ládánál: AK, vagy ha már van nálunk, teli lőszer (ha nem teli)
      const teli = ak && ak.tarban + ak.tartalek >= akCfg.loszer;
      if (szabad() && !teli && ido >= c.ig && Math.hypot(seta.x - c.x, seta.y - c.y) < 0.9 && Math.abs(seta.z - Number(c.z ?? 0)) < 1) {
        const ujAk = !ak;
        if (ujAk) ak = { tarban: akCfg.tar, tartalek: akCfg.loszer - akCfg.tar, toltesIg: 0 };
        else { ak.tartalek = akCfg.loszer - ak.tarban; }
        fegyverValaszt = 'ak';
        c.ig = ido + c.ujraMp * 1000;
        kozos?.kuldE({ t: 'lada', idx: c.idx, ig: c.ig });
        kozos?.frissitAllapot();
        uzenet(ujAk ? '🔫 Felvetted az AK-t! Bal egérgomb = lövés, R = újratöltés, Q = váltás' : `🔫 Lőszer feltöltve (${ak.tarban}/${ak.tartalek})`);
        if (!ujAk && ak.tarban < akCfg.tar) ujratolt();
      }
    }
    if (ak?.toltesIg && t >= ak.toltesIg) {
      const kell = Math.min(akCfg.tar - ak.tarban, ak.tartalek);
      ak.tarban += kell; ak.tartalek -= kell; ak.toltesIg = 0;
    }
    if (lovesLe && fegyverKezben() && t - utolsoLoves > 1000 / akCfg.perMp) { utolsoLoves = t; lo(); }
    kezbenAk.visible = fegyverKezben();
    rugas = Math.max(0, rugas - dt * 12);
    kezbenAk.position.z = -0.55 + 0.04 * rugas;
    torkolat.visible = rugas > 0.6;
    el('lovesGomb').hidden = !(fegyverKezben() && document.body.classList.contains('erintes'));
    for (let i = nyomok.length - 1; i >= 0; i--) {
      const n = nyomok[i], kor = t - n.ido;
      n.vonal.material.opacity = Math.max(0, 0.9 - kor / 120);
      if (kor > 120) { scene.remove(n.vonal); n.vonal.geometry.dispose(); n.vonal.material.dispose(); nyomok.splice(i, 1); }
    }
  }

  return {
    frissit, lokes, dobas, eses, esemeny, utes, csomagok, ujratolt, valt, fegyverKezben, jatekBe: () => be,
    lovesTeszt: (le) => { lovesLe = le; }, akAllapot: () => ak,
    extra: () => (be ? { j: 1, h: Math.round(hp), d: pont.d, k: pont.k, hal: halott ? 1 : 0, f: ak && fegyverValaszt === 'ak' ? 1 : 0 } : { j: 0 }),
  };
}
