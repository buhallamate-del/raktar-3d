// Játék a közös nézetben: lökés, palackdobás, életerő (HP), halálok és ölések számlálása.
// Mindenki a saját életerejéért felel: ő dönti el, hogy eltalálták-e, és ő jelenti a halálát.
// Események (kozos.kuldE, a <csatorna>/e témán):
//   {t:'lokes', cel, dx, dy}          – meglökték a célt (dx, dy: a lökés iránya)
//   {t:'dobas', id, x, y, z, vx, vy, vz} – palack indult (világkoordinátában, y = fel)
//   {t:'talalat', id, cel}            – a palack eltalálta a célt (mindenki eltünteti a palackot)
//   {t:'halal', cel, celNev, tol2, tol2Nev, ok} – a cél meghalt; tol2 a tettes (ha van)
//   {t:'csomag', idx, ig}              – valaki felvette az idx. életerőcsomagot; ig-ig (Date.now) nincs a helyén
//   {t:'lada', idx, ig}                – valaki felvette az idx. fegyverládából az AK-t
//   {t:'loves', x, y, z, dx, dy, dz, h, s, fp} – lövés (kezdőpont, irány, h: meddig repült a falig/állványig;
//                                      s: sebzés, fp: 'ak' | 'puska')
//   {t:'vagas', cel, s}               – katanával megvágták a célt (s: sebzés)
//   {t:'granat', id, x, y, z, vx, vy, vz} – gránát indult
//   {t:'robban', id, x, y, z, fj, gazda} – robbanás (fj: 'granat' | 'raketa' | 'akna'); a gránátot és a rakétát a
//                                      dobó/lövő gépe robbantja, az aknát az, aki rálépett (gazda: az akna lerakója);
//                                      a sebzését mindenki maga számolja
//   {t:'raketa', id, x, y, z, dx, dy, dz} – bazookarakéta indult
//   {t:'akna', id, x, y, z}             – taposóaknát raktak le
import * as THREE from 'three';
import { hang } from './hang.js';
import { beallitas } from './beallitas.js';

const TAROL = 'raktar3d.jatek';
const OK_SZOVEG = { lokes: 'meglökték', palack: 'palack találta el', eses: 'leesett', targonca: 'elütötte egy targonca', loves: 'lelőtték', granat: 'felrobbantották', raketa: 'bazookával felrobbantották', akna: 'aknára lépett', katana: 'katanával levágták', liderc: 'elkapta a lidérc', tuz: 'füstmérgezést kapott', kutya: 'széttépték a vad kutyák' };

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

// Távcsöves puska: hosszú cső, távcső, fa tus, kétlábú támasz nélkül. Előre (−Z) néz.
function puskaModell() {
  const g = new THREE.Group();
  const fa = new THREE.MeshLambertMaterial({ color: '#5e3b1e' }), fekete = new THREE.MeshLambertMaterial({ color: '#1b1d21' });
  const d = (sx, sy, sz, a, x, y, z, rx = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), a); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
  d(0.055, 0.07, 0.4, fekete, 0, 0, 0);            // tok
  d(0.06, 0.08, 0.36, fa, 0, -0.02, -0.3);         // előagy
  d(0.055, 0.1, 0.3, fa, 0, -0.04, 0.32, 0.1);     // tus
  d(0.03, 0.09, 0.04, fa, 0, -0.08, 0.12, -0.3);   // markolat
  const cso = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.62, 8), fekete);
  cso.rotation.x = Math.PI / 2; cso.position.set(0, 0.02, -0.72); g.add(cso);
  const tavcso = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 12), fekete);
  tavcso.rotation.x = Math.PI / 2; tavcso.position.set(0, 0.09, -0.02); g.add(tavcso);
  for (const z of [-0.17, 0.13]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.04, 12), fekete); l.rotation.x = Math.PI / 2; l.position.set(0, 0.09, z); g.add(l); }
  return g;
}

// Katana: hosszú, enyhén ívelt penge, kerek markolatvédő, fonott markolat. A penge −Z felé áll.
function katanaModell() {
  const g = new THREE.Group();
  const acel = new THREE.MeshLambertMaterial({ color: '#d8dde3', emissive: '#2a2e33' });
  const penge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.035, 0.78), acel);
  penge.position.z = -0.47; penge.rotation.x = 0.04; g.add(penge);
  const hegy = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 4), acel);
  hegy.rotation.x = -Math.PI / 2; hegy.position.set(0, 0.016, -0.89); g.add(hegy);
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 16), new THREE.MeshLambertMaterial({ color: '#8a6d2b' }));
  tsuba.rotation.x = Math.PI / 2; tsuba.position.z = -0.07; g.add(tsuba);
  const markolat = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), new THREE.MeshLambertMaterial({ color: '#1d1a2a' }));
  markolat.rotation.x = Math.PI / 2; markolat.position.z = 0.06; g.add(markolat);
  return g;
}

// Bazooka: olajzöld cső irányzékkal és markolattal, a vállon. Előre (−Z) néz.
function bazookaModell() {
  const g = new THREE.Group();
  const zold = new THREE.MeshLambertMaterial({ color: '#4d5a2c' }), fekete = new THREE.MeshLambertMaterial({ color: '#1b1d21' });
  const cso = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.0, 14), zold);
  cso.rotation.x = Math.PI / 2; cso.position.z = -0.2; g.add(cso);
  for (const z of [-0.7, 0.3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.08, 14), fekete); p.rotation.x = Math.PI / 2; p.position.z = z; g.add(p); }
  const irany = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06), fekete); irany.position.set(-0.07, 0.07, -0.3); g.add(irany);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.05), fekete); mark.position.set(0, -0.1, -0.1); mark.rotation.x = -0.3; g.add(mark);
  return g;
}
function raketaModell() {
  const g = new THREE.Group();
  const test = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 10), new THREE.MeshLambertMaterial({ color: '#5b6236' }));
  test.rotation.x = Math.PI / 2; g.add(test);
  const orr = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 10), new THREE.MeshLambertMaterial({ color: '#2b2b2b' }));
  orr.rotation.x = -Math.PI / 2; orr.position.z = -0.23; g.add(orr);
  const lang = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 10), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  lang.material.userData.vilagit = true; lang.rotation.x = Math.PI / 2; lang.position.z = 0.33; g.add(lang);
  return g;
}
// Taposóakna: lapos, sötét korong, élesítve pirosan villog
function aknaModell() {
  const g = new THREE.Group();
  const korong = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.06, 16), new THREE.MeshLambertMaterial({ color: '#3a3f33' }));
  korong.position.y = 0.03; g.add(korong);
  const gomb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), new THREE.MeshLambertMaterial({ color: '#6b6f66' }));
  gomb.position.y = 0.07; g.add(gomb);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a1a' }));
  led.material.userData.vilagit = true; led.position.set(0.09, 0.07, 0); g.add(led);
  g.userData = { led };
  return g;
}

// Gránát: zöld tojás, fém gyújtófej
function granatModell() {
  const g = new THREE.Group();
  const test = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshLambertMaterial({ color: '#3f5a2a' }));
  test.scale.y = 1.25; g.add(test);
  const fej = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.04, 8), new THREE.MeshLambertMaterial({ color: '#9aa0a6' }));
  fej.position.y = 0.075; g.add(fej);
  return g;
}

function betolt() {
  try { return JSON.parse(localStorage.getItem(TAROL)) || {}; } catch { return {}; }
}
function ment(a) {
  try { localStorage.setItem(TAROL, JSON.stringify(a)); } catch { /* nincs tárhely */ }
}

// ctf(): a zászlófoglalás (ctf.js), ha van – csapattársat nem lehet bántani, újraéledés a saját bázison
// kozelharc(x, y, fx, fy, r): a katana csapása a vad kutyákon (hányat talált el)
// halalKamera(tettes, ok): a killcam indítása (killcam.js)
export function inditJatek({ C, M, scene, camera, seta, kozos, uzenet, getMod, kiindulo, ctf = () => null, kozelharc, halalKamera }) {
  const J = C.jatek || {};
  const cfg = {
    lokes: Number(J.lokesSebzes ?? 10), palack: Number(J.palackSebzes ?? 25), targonca: Number(C.targoncak?.sebzes ?? 40),
    eses: J.esesSebzes !== false, ujraMp: Number(J.ujraeledesMp ?? 3), palackSeb: Number(J.palackSebesseg ?? 14),
  };
  const el = id => document.getElementById(id);
  const tar = betolt();
  const pont = { d: Number(tar.d) || 0, k: Number(tar.k) || 0 };
  let be = tar.be ?? (J.bekapcsolva !== false);
  let harapasUz = 0;
  let hp = 100, halott = false, tamado = null, lokesIdo = 0, dobasIdo = 0, szamlalo = 0;
  // katana: a küldetés jutalma; halálkor sem veszik el (ezen a gépen megmarad)
  let katana = !!tar.katana;
  const mentes = () => ment({ ...pont, be, katana });

  // --- felület ---
  el('jatekBe').checked = be;
  el('jatekBe').addEventListener('change', () => { be = el('jatekBe').checked; mentes(); kozos?.frissitAllapot(); });
  el('jatekNullaz').addEventListener('click', () => { pont.d = pont.k = 0; mentes(); kozos?.frissitAllapot(); listaFrissit(); });
  el('kozosJelzo').addEventListener('click', () => { el('pontPanel').hidden = !el('pontPanel').hidden; listaFrissit(); });
  el('pontBezar').addEventListener('click', () => { el('pontPanel').hidden = true; });

  const serulhet = () => be && getMod() === 'seta' && !halott && !seta.nezo; // nézőmódban nem játszunk
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
    hang(hp > 0 ? 'talalat' : 'halal');
    kozos?.frissitAllapot();
    if (hp <= 0) meghal(ok);
  }

  function meghal(ok) {
    halott = true;
    nalam.ak = nalam.puska = nalam.bazooka = null; granat = 0; akna = 0; lovesLe = false; celzas = false; // a fegyverek elvesznek
    seta.halott = true;
    pont.d++;
    mentes();
    const tettes = tamado && most() - tamado.ido < 6000 ? tamado : null;
    const ok2 = tettes && ok === 'eses' ? (tettes.id === 'targonca' ? 'targonca' : 'lokes') : ok;
    kozos?.kuldE({ t: 'halal', cel: kozos.id, celNev: kozos.nev(), tol2: tettes?.id, tol2Nev: tettes?.nev, ok: ok2 });
    el('halalSzoveg').textContent = tettes
      ? `${tettes.nev} ${ok2 === 'raketa' ? 'eltalált a bazookájával' : ok2 === 'akna' ? 'aknájára léptél' : ok2 === 'katana' ? 'levágott a katanájával' : ok2 === 'palack' ? 'eltalált egy palackkal' : ok2 === 'targonca' ? 'elütött' : ok2 === 'loves' ? 'lelőtt' : ok2 === 'granat' ? 'felrobbantott' : 'meglökött'}.`
      : ok2 === 'tuz' ? '🔥 Füstmérgezés – bent maradtál a tűzriadó alatt.' : ok2 === 'granat' || ok2 === 'raketa' ? '💥 Felrobbantál.' : ok2 === 'akna' ? '💥 Aknára léptél.' : ok2 === 'liderc' ? '👻 Elkapott a lidérc.' : ok2 === 'kutya' ? '🐕 Széttéptek a vad kutyák.' : OK_SZOVEG[ok2] === 'leesett' ? 'Leestél.' : 'Elfogyott az életerőd.';
    el('halalKep').hidden = false;
    kozos?.frissitAllapot();
    // killcam: ha egy másik játékos ölt meg, visszajátsszuk az ő szemszögéből
    if (tettes && tettes.id !== 'targonca' && tettes.id !== kozos?.id) halalKamera?.(tettes, ok2);
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
    hang('lokes');
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
    hang('uveg', hol || b.p);
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

  // --- lőfegyverek: AK és távcsöves puska (config.js: fegyver, puska, fegyverLadak, puskaLadak) ---
  const FG = C.fegyver || {}, PK = C.puska || {}, BZ = C.bazooka || {};
  const fCfg = {
    ak: { nev: 'AK', sebzes: Number(FG.sebzes ?? 12), perMp: Number(FG.lovesPerMp ?? 9), tar: Number(FG.tar ?? 30),
      loszer: Number(FG.loszer ?? 90), toltes: Number(FG.ujratoltesMp ?? 2) * 1000, tav: Number(FG.hatotav ?? 60), sorozat: true },
    puska: { nev: 'távcsöves puska', sebzes: Number(PK.sebzes ?? 80), perMp: Number(PK.lovesPerMp ?? 0.8), tar: Number(PK.tar ?? 5),
      loszer: Number(PK.loszer ?? 20), toltes: Number(PK.ujratoltesMp ?? 3) * 1000, tav: Number(PK.hatotav ?? 150), sorozat: false,
      nagyitas: Number(PK.nagyitas ?? 4) },
    bazooka: { nev: 'bazooka', sebzes: 0, perMp: Number(BZ.lovesPerMp ?? 0.5), tar: 1, loszer: Number(BZ.loszer ?? 4),
      toltes: Number(BZ.ujratoltesMp ?? 2.5) * 1000, tav: Number(BZ.hatotav ?? 80), sorozat: false, raketa: true,
      seb: Number(BZ.raketaSebesseg ?? 28) },
  };
  const LOFEGYVEREK = ['ak', 'puska', 'bazooka'];
  const akCfg = fCfg.ak;
  const nalam = { ak: null, puska: null, bazooka: null }; // {tarban, tartalek, toltesIg}
  let fegyverValaszt = 'ak';  // 'ak' | 'puska' | 'bazooka' | 'katana' | 'palack' (Q vált)
  let lovesLe = false, utolsoLoves = 0, rugas = 0, celzas = false;
  // gránát (config.js: granat): a fegyverládákon jár, T = dobás
  const GR = C.granat || {};
  const grCfg = { max: Number(GR.max ?? 4), ladankent: Number(GR.ladankent ?? 2), sebzes: Number(GR.sebzes ?? 100),
    sugar: Number(GR.sugar ?? 5), gyujto: Number(GR.gyujtoMp ?? 2.5) * 1000, seb: Number(GR.dobasSebesseg ?? 13) };
  let granat = 0, granatIdo = 0;
  // taposóakna (config.js: akna): a fegyverládákon jár, X = lerakás
  const AK2 = C.akna || {};
  const akCfg2 = { max: Number(AK2.max ?? 2), ladankent: Number(AK2.ladankent ?? 1), elesites: Number(AK2.elesitesMp ?? 2) * 1000,
    elet: Number(AK2.elettartamMp ?? 180) * 1000, erzekel: Number(AK2.erzekelesSugar ?? 0.7) };
  let akna = 0, aknaIdo = 0;
  // robbanások fajtánként: sugár (m) és a középponti sebzés (HP)
  const robbCfg = {
    granat: { sugar: grCfg.sugar, sebzes: grCfg.sebzes },
    raketa: { sugar: Number(BZ.sugar ?? 4), sebzes: Number(BZ.sebzes ?? 100) },
    akna: { sugar: Number(AK2.sugar ?? 3), sebzes: Number(AK2.sebzes ?? 100) },
  };
  if (!camera.parent) scene.add(camera);
  const kezben = {
    ak: Object.assign(akModell(), { visible: false }),
    puska: Object.assign(puskaModell(), { visible: false }),
    bazooka: Object.assign(bazookaModell(), { visible: false }),
  };
  kezben.bazooka.position.set(0.22, -0.14, -0.35); kezben.bazooka.scale.setScalar(0.85);
  kezben.ak.position.set(0.2, -0.19, -0.55); kezben.ak.scale.setScalar(0.8); kezben.ak.rotation.y = 0.04;
  kezben.puska.position.set(0.2, -0.2, -0.5); kezben.puska.scale.setScalar(0.8); kezben.puska.rotation.y = 0.04;
  const torkolatok = {};
  for (const [f, z] of [['ak', -0.7], ['puska', -1.05], ['bazooka', -0.78]]) {
    const tk = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd84d' }));
    tk.material.userData.vilagit = true;
    tk.position.set(0, 0.02, z); tk.visible = false; kezben[f].add(tk); torkolatok[f] = tk;
    camera.add(kezben[f]);
  }
  const ladak = [...(C.fegyverLadak || []).map(c => ({ ...c, tipus: 'ak' })), ...(C.puskaLadak || []).map(c => ({ ...c, tipus: 'puska' })),
    ...(C.bazookaLadak || []).map(c => ({ ...c, tipus: 'bazooka' }))].map((c, idx) => {
    const g = new THREE.Group();
    const lada = new THREE.Mesh(new THREE.BoxGeometry(c.tipus === 'ak' ? 1.0 : 1.3, 0.35, 0.45), new THREE.MeshLambertMaterial({ color: { ak: '#4b5320', puska: '#3b4a3a', bazooka: '#5a4a2a' }[c.tipus] }));
    lada.position.y = 0.175; g.add(lada);
    const fegyver = c.tipus === 'puska' ? puskaModell() : c.tipus === 'bazooka' ? bazookaModell() : akModell(); fegyver.scale.setScalar(1.4); fegyver.position.y = 0.75; g.add(fegyver);
    g.position.set(c.x, Number(c.z ?? 0), c.y);
    scene.add(g);
    return { ...c, idx, g, fegyver, ig: 0, ujraMp: Number(c.ujraMp ?? 45) };
  });
  const aktFegyver = () => (fegyverValaszt === 'katana' ? (katana ? 'katana' : null) : fegyverValaszt !== 'palack' && nalam[fegyverValaszt] ? fegyverValaszt : null);
  const fegyverKezben = () => !!aktFegyver() && getMod() === 'seta' && !halott && be && !seta.kocsin;
  function ujratolt(f = aktFegyver()) {
    const a = f && nalam[f], c = f && fCfg[f];
    if (!a || a.toltesIg || a.tarban >= c.tar || a.tartalek <= 0) return;
    a.toltesIg = most() + c.toltes;
    hang('tolt');
    if (f === 'puska') celzas = false;
  }
  function valt() {
    const lista = LOFEGYVEREK.filter(f => nalam[f]).concat(katana ? ['katana'] : [], 'palack');
    if (lista.length === 1) { uzenet('Nincs nálad fegyver – a fegyverládákon találsz (a galérián és az áruátvételen), a katana a küldetés jutalma'); return; }
    fegyverValaszt = lista[(lista.indexOf(fegyverValaszt) + 1) % lista.length];
    celzas = false;
    uzenet(fegyverValaszt === 'palack' ? '🍾 Palack a kézben' : fegyverValaszt === 'katana' ? '🗡 Katana a kézben – bal egérgomb = vágás' : `🔫 ${fCfg[fegyverValaszt].nev} a kézben`);
    kozos?.frissitAllapot();
  }
  // közvetlen választás számgombbal (1 = AK, 2 = puska, 3 = bazooka, 4 = katana, 5 = palack)
  function valaszt(f) {
    const van = f === 'palack' || (f === 'katana' ? katana : !!nalam[f]);
    if (!van) { uzenet(f === 'katana' ? 'Még nincs katanád – a küldetés jutalma' : `Nincs nálad ${fCfg[f]?.nev || f} – a fegyverládákon találsz`); return; }
    if (fegyverValaszt === f) return;
    fegyverValaszt = f; celzas = false;
    uzenet(f === 'palack' ? '🍾 Palack a kézben' : f === 'katana' ? '🗡 Katana a kézben' : `🔫 ${fCfg[f].nev} a kézben`);
    kozos?.frissitAllapot();
  }
  // távcső (csak a puskával): jobb egérgomb vagy Z
  function celoz() {
    if (aktFegyver() !== 'puska' || !fegyverKezben()) { celzas = false; return; }
    if (nalam.puska.toltesIg) return;
    celzas = !celzas;
  }
  // --- katana (config.js: katana) ---
  const KT = C.katana || {};
  const ktCfg = { sebzes: Number(KT.sebzes ?? 50), tav: Number(KT.hatotav ?? 1.9), szunet: Number(KT.szunetMp ?? 0.6) * 1000 };
  const kezbenKatana = katanaModell();
  kezbenKatana.position.set(0.24, -0.26, -0.42);
  kezbenKatana.visible = false;
  camera.add(kezbenKatana);
  let vagasIdo = -1e9;
  function vag() {
    if (!szabad() || most() - vagasIdo < ktCfg.szunet) return;
    vagasIdo = most();
    hang('katana');
    const fx = -Math.sin(seta.yaw), fy = -Math.cos(seta.yaw);
    // aki előttünk van karnyújtásnyira (egy csapással egyet)
    let leg = null, legD = ktCfg.tav;
    for (const t of kozos?.tobbiek.values() || []) {
      const u = t.cel;
      if (!u.j || u.m === 'felul' || u.hal) continue;
      const dx = u.x - seta.x, dy = u.y - seta.y, d = Math.hypot(dx, dy);
      if (d > legD || d < 0.01 || Math.abs((u.z || 0) - seta.z) > 1.3) continue;
      if ((dx * fx + dy * fy) / d < 0.45) continue;
      leg = t; legD = d;
    }
    const kutya = kozelharc?.(seta.x, seta.y, fx, fy, ktCfg.tav) || 0; // a vad kutyákat is lehet
    if (leg) {
      kozos.kuldE({ t: 'vagas', cel: leg.id, s: ktCfg.sebzes, nev: kozos.nev() });
      kozos.villant(leg.id);
      uzenet(`🗡 Megvágtad: ${leg.nev}`);
    } else if (kutya) uzenet(kutya > 1 ? `🗡 ${kutya} kutyát levágtál!` : '🗡 Levágtál egy kutyát!');
  }
  // jutalom a küldetésért: katana; ha már van, teljes életerő
  function jutalom() {
    if (!katana) {
      katana = true; mentes();
      fegyverValaszt = 'katana'; celzas = false;
      kozos?.frissitAllapot();
      uzenet('🗡 Jutalom: KATANA! Q = váltás, bal egérgomb = vágás (közelharcban −50 HP; halálkor sem veszik el)');
    } else {
      hp = 100; kozos?.frissitAllapot();
      uzenet('❤ Jutalom: teljes életerő (a katana már a tiéd)');
    }
  }

  // meddig repül a lövedék, mielőtt falba, állványba, padlóba ütközik
  function lovedekHossz(o, d, tav) {
    const p = new THREE.Vector3();
    for (let t = 0.3; t < tav; t += 0.2) { p.copy(o).addScaledVector(d, t); if (akadalyban(p)) return t; }
    return tav;
  }
  const nyomok = [];
  function nyomjelzo(o, d, h, puska) {
    const geo = new THREE.BufferGeometry().setFromPoints([o.clone().addScaledVector(d, 0.6), o.clone().addScaledVector(d, h)]);
    const vonal = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: puska ? '#ffffff' : '#ffe27a', transparent: true, opacity: 0.9 }));
    scene.add(vonal);
    nyomok.push({ vonal, ido: most() });
  }
  function lo() {
    const f = aktFegyver(), a = f && nalam[f], c = f && fCfg[f];
    if (!a || a.toltesIg) return;
    if (a.tarban <= 0) { ujratolt(); return; }
    a.tarban--;
    const o = camera.getWorldPosition(new THREE.Vector3());
    const d = camera.getWorldDirection(new THREE.Vector3());
    if (c.raketa) { raketaInditas(o.addScaledVector(d, 0.8), d); if (a.tarban === 0) ujratolt(); return; }
    // szórás: az AK sorozata szór, a puska távcsővel szinte pontos, anélkül pontatlan
    const sz = f === 'puska' ? (celzas ? 0.0006 : 0.05) : 0.02;
    d.x += (Math.random() - 0.5) * sz; d.y += (Math.random() - 0.5) * sz; d.z += (Math.random() - 0.5) * sz; d.normalize();
    const h = lovedekHossz(o, d, c.tav);
    nyomjelzo(o, d, h, f === 'puska');
    hang(f === 'puska' ? 'puska' : 'ak');
    rugas = 1;
    seta.pitch = Math.min(1.45, seta.pitch + (f === 'puska' ? 0.03 : 0.003)); // felrúgás
    const k = v => +v.toFixed(3);
    kozos?.kuldE({ t: 'loves', x: k(o.x), y: k(o.y), z: k(o.z), dx: k(d.x), dy: k(d.y), dz: k(d.z), h: +h.toFixed(2), s: c.sebzes, fp: f, nev: kozos.nev() });
    if (a.tarban === 0) ujratolt();
  }

  // --- gránát ---
  const granatok = new Map(); // id -> {g, p, v, ido, sajat, tol, nev}
  const robbanasok = [];
  const robbanFeny = new THREE.PointLight('#ffa040', 0, 14, 1.5);
  scene.add(robbanFeny);
  function inditGranat(id, p, v, tol, nev, sajat) {
    if (granatok.has(id)) return;
    const g = granatModell();
    g.position.copy(p);
    scene.add(g);
    granatok.set(id, { g, p: p.clone(), v: v.clone(), ido: most(), sajat, tol, nev });
  }
  function granatDob() {
    if (!szabad()) return;
    if (granat <= 0) { uzenet('Nincs gránátod – a fegyverládákon kapsz'); return; }
    if (most() - granatIdo < 800) return;
    granatIdo = most();
    granat--;
    camera.getWorldDirection(v3);
    const p = camera.position.clone().addScaledVector(v3, 0.5);
    const v = v3.clone().multiplyScalar(grCfg.seb).add(new THREE.Vector3(0, 2.5, 0));
    const id = `${kozos?.id || 'helyi'}-g${++szamlalo}`;
    inditGranat(id, p, v, kozos?.id, kozos?.nev(), true);
    const k = x => +x.toFixed(2);
    kozos?.kuldE({ t: 'granat', id, x: k(p.x), y: k(p.y), z: k(p.z), vx: k(v.x), vy: k(v.y), vz: k(v.z), nev: kozos.nev() });
    uzenet(`💣 Gránát elhajítva! (${granat} maradt)`);
  }
  // pattog: tengelyenként mozgatjuk, és ahol akadályba ütközne, ott visszapattan
  function granatLeptet(b, dt) {
    b.v.y -= 9.81 * dt;
    for (const ax of ['x', 'y', 'z']) {
      const elotte = b.p[ax];
      b.p[ax] += b.v[ax] * dt;
      if (akadalyban(b.p)) {
        b.p[ax] = elotte;
        if (Math.abs(b.v[ax]) > 1.5) hang('koppan', b.p, 0.6);
        b.v[ax] *= -0.35;
        if (ax === 'y') { b.v.x *= 0.7; b.v.z *= 0.7; }
      }
    }
  }
  // --- bazookarakéták ---
  const raketak = new Map(); // id -> {g, p, d, ut, ido, sajat}
  function inditRaketa(id, p, d, sajat) {
    if (raketak.has(id)) return;
    const g = raketaModell();
    g.position.copy(p); g.lookAt(p.clone().sub(d));
    scene.add(g);
    raketak.set(id, { g, p: p.clone(), d: d.clone().normalize(), ut: 0, ido: most(), sajat });
  }
  function raketaInditas(p, d) {
    const id = `${kozos?.id || 'helyi'}-r${++szamlalo}`;
    inditRaketa(id, p, d, true);
    hang('bazooka');
    rugas = 1;
    seta.pitch = Math.min(1.45, seta.pitch + 0.05);
    const k = v => +v.toFixed(3);
    kozos?.kuldE({ t: 'raketa', id, x: k(p.x), y: k(p.y), z: k(p.z), dx: k(d.x), dy: k(d.y), dz: k(d.z), nev: kozos.nev() });
  }
  // a saját rakétánk: falba, padlóba vagy egy másik játékosba csapódva robban
  function raketaTalal(p) {
    if (akadalyban(p)) return true;
    for (const t of kozos?.tobbiek.values() || []) {
      const gp = t.g.position;
      if (Math.hypot(p.x - gp.x, p.z - gp.z) < 0.45 && p.y > gp.y && p.y < gp.y + 1.9) return true;
    }
    return false;
  }

  // --- taposóaknák ---
  const aknak = new Map(); // id -> {g, x, y, z, gazda, gazdaNev, ido}
  function inditAkna(id, x, y, z, gazda, gazdaNev) {
    if (aknak.has(id)) return;
    const g = aknaModell();
    g.position.set(x, z, y);
    scene.add(g);
    aknak.set(id, { g, x, y, z, gazda, gazdaNev, ido: most() });
  }
  function aknaLe() {
    if (!szabad()) return;
    if (akna <= 0) { uzenet('Nincs aknád – a fegyverládákon kapsz'); return; }
    if (most() - aknaIdo < 1000) return;
    if (seta.z - M.racs.talaj(seta.x, seta.y, seta.z) > 0.05) { uzenet('Aknát csak a földre lehet rakni'); return; }
    aknaIdo = most();
    hang('kattan');
    akna--;
    const id = `${kozos?.id || 'helyi'}-a${++szamlalo}`;
    const k = v => +v.toFixed(2);
    inditAkna(id, seta.x, seta.y, seta.z, kozos?.id, kozos?.nev());
    kozos?.kuldE({ t: 'akna', id, x: k(seta.x), y: k(seta.y), z: k(seta.z), nev: kozos.nev() });
    uzenet(`💣 Taposóakna lerakva (${akcfgMp()} mp múlva éles; ${akna} maradt) – vigyázz, a sajátod is felrobban!`);
  }
  const akcfgMp = () => Math.round(akCfg2.elesites / 1000);

  function robbanas(id, pos, tol, nev, fajta = 'granat') {
    const b = granatok.get(id);
    if (b) { scene.remove(b.g); granatok.delete(id); }
    const r = raketak.get(id);
    if (r) { scene.remove(r.g); raketak.delete(id); }
    const a = aknak.get(id);
    if (a) { scene.remove(a.g); aknak.delete(id); }
    const rc = robbCfg[fajta] || robbCfg.granat;
    const gomb = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    gomb.material.userData.vilagit = true;
    gomb.position.copy(pos); gomb.scale.setScalar(0.2);
    scene.add(gomb);
    robbanasok.push({ gomb, ido: most(), sugar: rc.sugar });
    hang('robbanas', pos);
    robbanFeny.position.copy(pos).setY(pos.y + 0.5); robbanFeny.intensity = 40;
    for (let i = 0; i < 10; i++) {
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshLambertMaterial({ color: '#33302b' }));
      s2.position.copy(pos);
      scene.add(s2);
      szilankok.push({ s: s2, v: new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 6, (Math.random() - 0.5) * 9), ido: most() });
    }
    // sebzés rajtunk: a távolsággal csökken (a saját robbanás is sebez)
    if (!serulhet() || (tol !== kozos?.id && tars(tol))) return;
    const dx = seta.x - pos.x, dy = seta.y - pos.z, dz = seta.z + 0.9 - pos.y, d = Math.hypot(dx, dy, dz);
    if (d >= rc.sugar) return;
    // 1 m-en belül (közvetlen találat) teljes erővel, onnan a sugár széléig csökken
    const ero = d < 1 ? 1 : 1 - (d - 1) / Math.max(0.1, rc.sugar - 1), hd = Math.hypot(dx, dy) || 1;
    seta.kvx = (seta.kvx || 0) + dx / hd * 9 * ero; seta.kvy = (seta.kvy || 0) + dy / hd * 9 * ero;
    seta.vz = Math.max(seta.vz || 0, 4 * ero);
    tamado = tol && tol !== kozos?.id ? { id: tol, nev: nev || 'Valaki', ido: most() } : null;
    const [mi, sajatja] = { granat: ['gránátja', 'gránátod'], raketa: ['rakétája', 'rakétád'], akna: ['aknája', 'aknád'] }[fajta] || ['gránátja', 'gránátod'];
    uzenet(tamado ? `💥 ${tamado.nev} ${mi} eltalált!` : `💥 A saját ${sajatja} sebzett meg!`);
    sebzes(Math.round(rc.sebzes * ero), fajta);
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
    if (e.pointerType === 'mouse' && e.button === 2 && document.pointerLockElement === vaszon) celoz();
  });
  vaszon?.addEventListener('contextmenu', e => { if (fegyverKezben()) e.preventDefault(); });
  el('tavcsoGomb')?.addEventListener('pointerdown', e => { e.preventDefault(); celoz(); });
  el('granatGomb')?.addEventListener('pointerdown', e => { e.preventDefault(); granatDob(); });
  el('aknaGomb')?.addEventListener('pointerdown', e => { e.preventDefault(); aknaLe(); });
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
      hang('felvesz');
      return;
    }
  }

  // --- események a többiektől ---
  function esemeny(e) {
    if (e.t === 'lokes') {
      if (e.cel === kozos.id) {
        if (!serulhet()) return;
        tamado = { id: e.tol, nev: e.nev || 'Valaki', ido: most() };
        hang('lokes');
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
      if ([o.x, o.y, o.z, d.x, d.y, d.z, +e.h].every(Number.isFinite)) { nyomjelzo(o, d.normalize(), Math.min(+e.h, fCfg.puska.tav), e.fp === 'puska'); hang(e.fp === 'puska' ? 'puska' : 'ak', o); }
      if (serulhet() && !tars(e.tol) && lovesTalal(e)) {
        tamado = { id: e.tol, nev: e.nev || 'Valaki', ido: most() };
        if (most() - (lovesTalal.uz || 0) > 1500) { uzenet(`${tamado.nev} rád lőtt!`); lovesTalal.uz = most(); }
        sebzes(Math.max(0, Math.min(100, Number(e.s) || akCfg.sebzes)), 'loves');
      }
    } else if (e.t === 'vagas') {
      if (e.cel === kozos.id) {
        if (!serulhet() || tars(e.tol)) return;
        tamado = { id: e.tol, nev: e.nev || 'Valaki', ido: most() };
        uzenet(`🗡 ${tamado.nev} megvágott a katanájával!`);
        sebzes(Math.max(0, Math.min(60, Number(e.s) || ktCfg.sebzes)), 'katana');
      } else kozos.villant(e.cel);
    } else if (e.t === 'granat') {
      const p = new THREE.Vector3(+e.x, +e.y, +e.z), v = new THREE.Vector3(+e.vx, +e.vy, +e.vz);
      if ([p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite)) inditGranat(e.id, p, v, e.tol, e.nev || 'Valaki', false);
    } else if (e.t === 'robban') {
      const p = new THREE.Vector3(+e.x, +e.y, +e.z);
      const fajta = ['granat', 'raketa', 'akna'].includes(e.fj) ? e.fj : 'granat';
      // az aknáért a lerakója felel (nem az, aki rálépett)
      const ki = fajta === 'akna' ? (e.gazda || null) : e.tol, kiNev = fajta === 'akna' ? e.gazdaNev : e.nev;
      if ([p.x, p.y, p.z].every(Number.isFinite)) robbanas(e.id, p, ki, kiNev || 'Valaki', fajta);
    } else if (e.t === 'raketa') {
      const p = new THREE.Vector3(+e.x, +e.y, +e.z), d = new THREE.Vector3(+e.dx, +e.dy, +e.dz);
      if ([p.x, p.y, p.z, d.x, d.y, d.z].every(Number.isFinite) && d.lengthSq() > 1e-6) { inditRaketa(e.id, p, d, false); hang('bazooka', p); }
    } else if (e.t === 'akna') {
      if ([+e.x, +e.y, +e.z].every(Number.isFinite)) inditAkna(e.id, +e.x, +e.y, +e.z, e.tol, e.nev || 'Valaki');
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
      const f = aktFegyver(), a = f && nalam[f];
      const loszer = (a ? ` · ${{ puska: '🎯', bazooka: '🚀' }[f] || '🔫'} ${a.toltesIg ? 'töltés…' : `${a.tarban}/${a.tartalek}`}` : f === 'katana' ? ' · 🗡' : (LOFEGYVEREK.some(x => nalam[x]) || katana ? ' · 🍾 (Q)' : ''))
        + (granat ? ` · 💣 ${granat}` : '') + (akna ? ` · ⚠ akna ${akna}` : '');
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
    // fegyverládák: AK vagy puska, ha már van nálunk, teli lőszer; mellé gránát
    for (const c of ladak) {
      c.g.visible = be;
      c.fegyver.visible = ido >= c.ig;
      c.fegyver.rotation.y += dt * 1.2;
      c.fegyver.position.y = 0.75 + 0.06 * Math.sin(t / 450);
      const f = c.tipus, a = nalam[f], cf = fCfg[f];
      const teli = a && a.tarban + a.tartalek >= cf.loszer && granat >= grCfg.max && akna >= akCfg2.max;
      if (szabad() && !teli && ido >= c.ig && Math.hypot(seta.x - c.x, seta.y - c.y) < 0.9 && Math.abs(seta.z - Number(c.z ?? 0)) < 1) {
        const uj = !a;
        if (uj) nalam[f] = { tarban: cf.tar, tartalek: cf.loszer - cf.tar, toltesIg: 0 };
        else a.tartalek = cf.loszer - a.tarban;
        const gr = Math.max(0, Math.min(grCfg.max - granat, grCfg.ladankent));
        granat += gr;
        const ak3 = Math.max(0, Math.min(akCfg2.max - akna, akCfg2.ladankent));
        akna += ak3;
        fegyverValaszt = f; celzas = false;
        c.ig = ido + c.ujraMp * 1000;
        kozos?.kuldE({ t: 'lada', idx: c.idx, ig: c.ig });
        hang('felvesz');
        kozos?.frissitAllapot();
        const gSz = (gr ? ` · +${gr} gránát (T = dobás)` : '') + (ak3 ? ` · +${ak3} akna (X = lerakás)` : '');
        uzenet(uj
          ? `🔫 Felvetted: ${cf.nev}! Bal egérgomb = lövés, R = újratöltés, Q = váltás${f === 'puska' ? ', jobb egérgomb / Z = távcső' : ''}${gSz}`
          : `🔫 Lőszer feltöltve (${nalam[f].tarban}/${nalam[f].tartalek})${gSz}`);
        if (!uj && nalam[f].tarban < cf.tar) ujratolt(f);
      }
    }
    for (const f of LOFEGYVEREK) {
      const a = nalam[f];
      if (a?.toltesIg && t >= a.toltesIg) {
        const kell = Math.min(fCfg[f].tar - a.tarban, a.tartalek);
        a.tarban += kell; a.tartalek -= kell; a.toltesIg = 0;
      }
    }
    const fk = fegyverKezben() ? aktFegyver() : null;
    if (lovesLe && fk === 'katana') { lovesLe = false; vag(); }
    else if (lovesLe && fk && t - utolsoLoves > 1000 / fCfg[fk].perMp) {
      utolsoLoves = t; lo();
      if (!fCfg[fk].sorozat) lovesLe = false; // a puska egyesével lő
    }
    if (fk !== 'puska') celzas = false;
    for (const f of LOFEGYVEREK) kezben[f].visible = fk === f && !(f === 'puska' && celzas);
    // katana: csapáskor jobbról balra, felülről lefelé suhint
    kezbenKatana.visible = fk === 'katana';
    const sk = Math.min(1, (t - vagasIdo) / 260), suhint = sk < 1 ? Math.sin(sk * Math.PI) : 0;
    kezbenKatana.rotation.set(0.5 - 1.3 * suhint, 0.15 + 1.1 * suhint, -0.5 + 0.9 * suhint);
    kezbenKatana.position.x = 0.24 - 0.3 * suhint;
    rugas = Math.max(0, rugas - dt * 12);
    kezben.ak.position.z = -0.55 + 0.04 * rugas;
    kezben.puska.position.z = -0.5 + 0.08 * rugas;
    kezben.bazooka.position.z = -0.35 + 0.1 * rugas;
    for (const f of LOFEGYVEREK) torkolatok[f].visible = rugas > 0.6;
    // rakéták: egyenesen repülnek; a sajátunk becsapódáskor robban (és szólunk a többieknek)
    for (const [id, r] of raketak) {
      const c = fCfg.bazooka, lep = c.seb * dt, n = Math.max(1, Math.ceil(lep / 0.15));
      let robban = false;
      for (let i = 0; i < n && !robban; i++) {
        r.p.addScaledVector(r.d, lep / n); r.ut += lep / n;
        if (r.sajat && (raketaTalal(r.p) || r.ut > c.tav)) robban = true;
        else if (!r.sajat && (akadalyban(r.p) || r.ut > c.tav + 5)) { scene.remove(r.g); raketak.delete(id); break; }
      }
      r.g.position.copy(r.p);
      if (robban) {
        const k = x => +x.toFixed(2);
        kozos?.kuldE({ t: 'robban', id, x: k(r.p.x), y: k(r.p.y), z: k(r.p.z), fj: 'raketa', nev: kozos.nev() });
        robbanas(id, r.p.clone(), kozos?.id, kozos?.nev(), 'raketa');
      }
    }
    // aknák: élesítés után aki rálép (mi döntjük el a saját lábunkról), az felrobbantja
    for (const [id, a] of aknak) {
      const kor = t - a.ido;
      a.g.userData.led.visible = kor > akCfg2.elesites && Math.sin(t / 180) > 0;
      if (kor > akCfg2.elet) { scene.remove(a.g); aknak.delete(id); continue; }
      if (kor > akCfg2.elesites && serulhet() && Math.hypot(seta.x - a.x, seta.y - a.y) < akCfg2.erzekel && Math.abs(seta.z - a.z) < 0.5) {
        const k = x => +x.toFixed(2);
        kozos?.kuldE({ t: 'robban', id, x: k(a.x), y: k(a.z + 0.1), z: k(a.y), fj: 'akna', gazda: a.gazda, gazdaNev: a.gazdaNev, nev: kozos.nev() });
        robbanas(id, new THREE.Vector3(a.x, a.z + 0.1, a.y), a.gazda, a.gazdaNev, 'akna');
      }
    }
    // távcső: nagyítás és célkereszt
    const alapFov = beallitas.fov; // menü → Beállítások → látószög
    const celFov = celzas ? alapFov / fCfg.puska.nagyitas : alapFov;
    if (Math.abs(camera.fov - celFov) > 0.01) { camera.fov += (celFov - camera.fov) * Math.min(1, dt * 14); if (Math.abs(camera.fov - celFov) < 0.05) camera.fov = celFov; camera.updateProjectionMatrix(); }
    if (el('tavcso')) el('tavcso').hidden = !celzas;
    const erintes = document.body.classList.contains('erintes');
    el('lovesGomb').hidden = !(fk && erintes);
    if (el('tavcsoGomb')) el('tavcsoGomb').hidden = !(fk === 'puska' && erintes);
    if (el('granatGomb')) el('granatGomb').hidden = !(granat > 0 && szabad() && erintes);
    if (el('aknaGomb')) el('aknaGomb').hidden = !(akna > 0 && szabad() && erintes);
    // gránátok: repülnek, pattognak; a sajátunk a gyújtóidő végén felrobban (és szólunk a többieknek)
    for (const [id, b] of granatok) {
      const lepes = Math.max(1, Math.ceil(b.v.length() * dt / 0.08));
      for (let i = 0; i < lepes; i++) granatLeptet(b, dt / lepes);
      b.g.position.copy(b.p);
      b.g.rotation.x += dt * 8 * Math.min(1, b.v.length() / 3);
      if (b.sajat && t - b.ido > grCfg.gyujto) {
        const k = x => +x.toFixed(2);
        kozos?.kuldE({ t: 'robban', id, x: k(b.p.x), y: k(b.p.y), z: k(b.p.z), nev: kozos.nev() });
        robbanas(id, b.p.clone(), kozos?.id, kozos?.nev());
      } else if (!b.sajat && t - b.ido > grCfg.gyujto + 4000) { scene.remove(b.g); granatok.delete(id); }
    }
    for (let i = robbanasok.length - 1; i >= 0; i--) {
      const r = robbanasok[i], kor = (t - r.ido) / 450;
      r.gomb.scale.setScalar(0.2 + kor * r.sugar * 0.8);
      r.gomb.material.opacity = Math.max(0, 0.9 * (1 - kor));
      if (kor >= 1) { scene.remove(r.gomb); r.gomb.geometry.dispose(); r.gomb.material.dispose(); robbanasok.splice(i, 1); }
    }
    robbanFeny.intensity = Math.max(0, robbanFeny.intensity - dt * 120);
    for (let i = nyomok.length - 1; i >= 0; i--) {
      const n = nyomok[i], kor = t - n.ido;
      n.vonal.material.opacity = Math.max(0, 0.9 - kor / 120);
      if (kor > 120) { scene.remove(n.vonal); n.vonal.geometry.dispose(); n.vonal.material.dispose(); nyomok.splice(i, 1); }
    }
  }

  return {
    // a lidérc hozzáért: azonnali halál
    // környezeti sebzés (pl. tűzriadó): nincs tettes
    kornyezet: (n, ok, szoveg) => { if (!serulhet()) return; tamado = null; if (szoveg) uzenet(szoveg); sebzes(n, ok); },
    liderc: () => { if (!serulhet()) return; tamado = null; hang('sikoly'); sebzes(100000, 'liderc'); },
    // egy kutya megharapott (dx, dy: merről jött – egy kicsit meglök)
    harapas: (n, dx, dy) => {
      if (!serulhet()) return;
      hang('harapas');
      tamado = null;
      seta.kvx = (seta.kvx || 0) + dx * 2; seta.kvy = (seta.kvy || 0) + dy * 2;
      if (most() - (harapasUz || 0) > 1500) { uzenet(`🐕 Megharapott egy kutya! −${n} HP`); harapasUz = most(); }
      sebzes(n, 'kutya');
    },
    frissit, lokes, dobas, eses, esemeny, utes, csomagok, ujratolt, valt, celoz, granatDob, aknaLe, valaszt, fegyverKezben, jutalom, vag, jatekBe: () => be,
    katanaVan: () => katana,
    lovesTeszt: (le) => { lovesLe = le; }, akAllapot: () => nalam.ak, fegyverAllapot: () => ({ ...nalam, valaszt: fegyverValaszt, granat, akna, celzas }),
    extra: () => (be ? { j: 1, h: Math.round(hp), d: pont.d, k: pont.k, hal: halott ? 1 : 0, f: { ak: 1, puska: 2, katana: 3, bazooka: 4 }[aktFegyver()] || 0 } : { j: 0 }),
  };
}
