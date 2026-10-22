// Közös nézet: aki egyszerre nézi az oldalt, az pálcikaemberként látja a többieket.
// A pozíciók egy MQTT üzenetközvetítőn (alapból a HiveMQ nyilvános szerverén) mennek át:
//   <csatorna>/poz/<azonosító>  ->  {nev, szin, x, y, z, yaw, g, m}
// Üres üzenet = az illető kilépett (ezt a szerver is elküldi helyettünk, ha megszakad a kapcsolat).
//   <csatorna>/e  ->  játékesemények (lökés, dobás, találat, halál), lásd jatek.js
//   <csatorna>/ctf ->  a zászlófoglalás megőrzött (retained) állapota, lásd ctf.js
//   <csatorna>/kocsi -> a felmosókocsi megőrzött állapota, lásd kocsi.js
import * as THREE from 'three';

const TAROL = 'raktar3d.kozos';
const ELAVUL_MS = 10000;   // ennyi idő után eltűnik, akitől nem jön üzenet
const KULD_MS = 150;       // legfeljebb ilyen sűrűn küldünk
const EL_MS = 3000;        // akkor is küldünk ennyi időnként, ha nem mozdultunk

function beallitasok() {
  try { return JSON.parse(localStorage.getItem(TAROL)) || {}; } catch { return {}; }
}
function ment(b) {
  try { localStorage.setItem(TAROL, JSON.stringify(b)); } catch { /* privát ablakban nincs tárhely */ }
}
function veletlenSzin() {
  return '#' + new THREE.Color().setHSL(Math.random(), 0.75, 0.5).getHexString();
}

// Egyszerű pálcikaember: fej, törzs, karok, lábak; a lábak lépés közben lengenek.
function palcikaember(szin, nev, szovegSprite, mezSzin) {
  const anyag = new THREE.MeshLambertMaterial({ color: szin });
  const g = new THREE.Group();
  const test = new THREE.Group();
  const henger = (h, r = 0.045) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), anyag);
  const fej = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), anyag);
  fej.position.y = 1.62;
  const torzs = henger(0.62); torzs.position.y = 1.18;
  const vall = henger(0.5, 0.04); vall.rotation.z = Math.PI / 2; vall.position.y = 1.42;
  const lab = () => { const p = new THREE.Group(); const l = henger(0.86); l.position.y = -0.43; p.add(l); p.position.y = 0.87; return p; };
  const kar = () => { const p = new THREE.Group(); const k = henger(0.6, 0.035); k.position.y = -0.3; p.add(k); p.position.y = 1.42; return p; };
  const balLab = lab(), jobbLab = lab(), balKar = kar(), jobbKar = kar();
  // AK a kezében (csak ha van nála): fekete tok, fa tus, előre (−Z) néz
  const puska = new THREE.Group();
  const pFekete = new THREE.MeshLambertMaterial({ color: '#23262b' }), pFa = new THREE.MeshLambertMaterial({ color: '#8a5a2b' });
  const pd = (sx, sy, sz, a, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), a); m.position.z = z; puska.add(m); };
  pd(0.06, 0.08, 0.55, pFekete, -0.15); pd(0.05, 0.09, 0.25, pFa, 0.2); pd(0.04, 0.16, 0.06, pFekete, -0.2);
  puska.position.set(0.18, 1.25, -0.25);
  puska.visible = false;
  // katana a kezében (f = 3)
  const kard = new THREE.Group();
  const kPenge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.8), new THREE.MeshLambertMaterial({ color: '#d8dde3' }));
  kPenge.position.z = -0.48; kard.add(kPenge);
  const kMark = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.22), new THREE.MeshLambertMaterial({ color: '#1d1a2a' }));
  kMark.position.z = 0.03; kard.add(kMark);
  kard.position.set(0.28, 1.1, -0.1); kard.rotation.x = 0.6;
  kard.visible = false;
  // zseblámpa fénykúpja (éjszaka, ha be van kapcsolva)
  const lampa = new THREE.Mesh(new THREE.ConeGeometry(1.3, 6, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: '#fff4dc', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  lampa.material.userData.vilagit = true;
  lampa.rotation.x = -Math.PI / 2; lampa.position.set(0, 1.45, -3.1);
  lampa.visible = false;
  // csapatmez (zászlófoglalásnál a csapat színe)
  const mez = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.2), new THREE.MeshLambertMaterial({ color: mezSzin || '#888888' }));
  mez.position.y = 1.2;
  mez.visible = !!mezSzin;
  balLab.position.x = -0.1; jobbLab.position.x = 0.1; balKar.position.x = -0.25; jobbKar.position.x = 0.25;
  // „orr”: merre néz
  const orr = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), anyag);
  orr.rotation.x = -Math.PI / 2; orr.position.set(0, 1.62, -0.17);
  test.add(fej, torzs, vall, balLab, jobbLab, balKar, jobbKar, orr, puska, kard, lampa, mez);
  g.add(test);
  const felirat = szovegSprite(nev, 0.32, { hatter: szin, szin: '#fff', meret: 44, depthTest: false });
  felirat.position.y = 2.05;
  g.add(felirat);
  // életerő-csík (csak ha az illetőnél be van kapcsolva a játék)
  const csik = (szin2) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: szin2, depthTest: false }));
    s.center.set(0, 0.5); s.scale.set(0.8, 0.07, 1); s.renderOrder = 11; return s;
  };
  const hpHatter = csik('#3a0d0d'), hpEloter = csik('#3ddc5a');
  hpHatter.position.set(-0.4, 2.3, 0); hpEloter.position.set(-0.4, 2.3, 0); hpEloter.renderOrder = 12;
  g.add(hpHatter, hpEloter);
  g.userData = { test, balLab, jobbLab, balKar, jobbKar, felirat, fazis: 0, anyag, hpHatter, hpEloter, villan: 0, puska, kard, lampa, mez };
  return g;
}

// extra(): a pozíció mellé küldött további adatok (pl. életerő); esemeny(e): a <csatorna>/e üzenetei;
// allando(a, tema): a <csatorna>/ctf és a <csatorna>/kocsi megőrzött állapota
export function inditKozos({ C, scene, szovegSprite, allapot, uzenet, extra, esemeny, allando }) {
  const K = C.kozos || {};
  const param = new URLSearchParams(location.search);
  const broker = param.get('broker') || K.broker;
  const csatorna = (param.get('csatorna') || K.csatorna || 'raktar3d').replace(/[#+]/g, '');
  const el = id => document.getElementById(id);
  const b = beallitasok();
  if (!b.id) b.id = Math.random().toString(36).slice(2, 10);
  if (!b.szin) b.szin = veletlenSzin();
  if (!b.nev) b.nev = 'Látogató ' + b.id.slice(0, 3).toUpperCase();
  if (b.lathato === undefined) b.lathato = true;
  ment(b);

  const tobbiek = new Map(); // id -> {g, cel, utolso, nev, szin}
  let kliens = null, kapcsolodva = false, utolsoKuld = 0, utolsoAllapot = null;

  // --- felület ---
  el('kozosNev').value = b.nev;
  el('kozosSzin').value = b.szin;
  el('kozosLathato').checked = b.lathato;
  el('kozosBe').checked = K.bekapcsolva !== false && b.be !== false;
  const allapotKiir = () => {
    const n = tobbiek.size;
    el('kozosAllapot').textContent = !el('kozosBe').checked ? 'Kikapcsolva.'
      : kapcsolodva ? `Kapcsolódva · ${n ? n + ' másik látogató' : 'most egyedül vagy'}` : 'Kapcsolódás…';
    el('kozosJelzo').hidden = !el('kozosBe').checked;
    el('kozosJelzo').textContent = `👥 ${kapcsolodva ? n + 1 : '…'}`;
    el('kozosJelzo').title = kapcsolodva ? `${n + 1} látogató van most a modellben` : 'Közös nézet: kapcsolódás…';
  };
  const beallitasValt = () => {
    b.nev = el('kozosNev').value.trim().slice(0, 24) || b.nev;
    b.szin = el('kozosSzin').value;
    b.lathato = el('kozosLathato').checked;
    b.be = el('kozosBe').checked;
    ment(b);
    utolsoAllapot = null; // azonnal küldjük az újat
    if (!b.lathato) kuld(null);
    if (b.be && !kliens) kapcsol();
    if (!b.be && kliens) lekapcsol();
    allapotKiir();
  };
  for (const id of ['kozosNev', 'kozosSzin', 'kozosLathato', 'kozosBe']) el(id).addEventListener('change', beallitasValt);

  // --- kapcsolat ---
  const temaSajat = `${csatorna}/poz/${b.id}`;
  async function kapcsol() {
    if (!broker) { el('kozosAllapot').textContent = 'Nincs megadva szerver (config.js: kozos.broker).'; return; }
    let mqtt;
    try {
      const mod = await import('../vendor/mqtt/mqtt.esm.js');
      mqtt = mod.default?.connect ? mod.default : mod.default?.default ?? mod;
    } catch (e) {
      el('kozosAllapot').textContent = 'Nem sikerült betölteni az MQTT könyvtárat.';
      console.warn('[közös nézet]', e);
      return;
    }
    kliens = mqtt.connect(broker, {
      clientId: `raktar3d_${b.id}_${Math.random().toString(36).slice(2, 6)}`,
      clean: true, keepalive: 30, reconnectPeriod: 4000, connectTimeout: 10000,
      will: { topic: temaSajat, payload: '', qos: 0, retain: false },
    });
    kliens.on('connect', () => {
      kapcsolodva = true;
      kliens.subscribe(`${csatorna}/poz/+`);
      kliens.subscribe(`${csatorna}/e`);
      kliens.subscribe(`${csatorna}/ctf`);
      kliens.subscribe(`${csatorna}/kocsi`);
      utolsoAllapot = null;
      allapotKiir();
    });
    kliens.on('close', () => { kapcsolodva = false; allapotKiir(); });
    kliens.on('error', e => console.warn('[közös nézet]', e?.message || e));
    kliens.on('message', (tema, adat) => {
      if (tema === `${csatorna}/e`) {
        try { const e = JSON.parse(adat.toString()); if (e && e.tol !== b.id) esemeny?.(e); } catch { /* hibás üzenet */ }
        return;
      }
      if (tema === `${csatorna}/ctf` || tema === `${csatorna}/kocsi`) {
        try { allando?.(JSON.parse(adat.toString()), tema.split('/').pop()); } catch { /* hibás üzenet */ }
        return;
      }
      const id = tema.split('/').pop();
      if (id === b.id) return;
      const s = adat.toString();
      if (!s) { eltavolit(id); return; }
      let u;
      try { u = JSON.parse(s); } catch { return; }
      if (![u.x, u.y].every(Number.isFinite)) return;
      fogad(id, u);
    });
  }
  function lekapcsol() {
    kuld(null);
    kliens?.end(true);
    kliens = null;
    kapcsolodva = false;
    for (const id of [...tobbiek.keys()]) eltavolit(id);
  }
  function kuld(a) {
    if (!kliens || !kapcsolodva) return;
    kliens.publish(temaSajat, a ? JSON.stringify(a) : '', { qos: 0, retain: false });
  }
  addEventListener('pagehide', () => kuld(null));

  // --- a többiek ---
  function fogad(id, u) {
    const nev = String(u.nev || 'Látogató').slice(0, 24);
    const szin = /^#[0-9a-f]{6}$/i.test(u.szin) ? u.szin : '#888888';
    let t = tobbiek.get(id);
    const mez = (C.ctf?.csapatok || []).find(c => c.id === u.cs)?.szin || null;
    if (t && (t.nev !== nev || t.szin !== szin || t.mez !== mez)) { eltavolit(id); t = null; }
    if (!t) {
      const g = palcikaember(szin, nev, szovegSprite, mez);
      g.position.set(u.x, u.z || 0, u.y);
      scene.add(g);
      t = { id, g, nev, szin, mez, cel: u, utolso: 0 };
      tobbiek.set(id, t);
      if (tobbiek.size <= 5) uzenet?.(`${nev} is nézi a modellt`);
      allapotKiir();
    }
    t.cel = u;
    t.utolso = performance.now();
  }
  function eltavolit(id) {
    const t = tobbiek.get(id);
    if (!t) return;
    scene.remove(t.g);
    t.g.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); });
    tobbiek.delete(id);
    allapotKiir();
  }

  // Minden képkockánál: saját állapot küldése, a többiek simított mozgatása.
  function frissit(dt) {
    const most = performance.now();
    // a nevek és az életerő-csíkok belső nézetben nem látszanak át a falon (felülnézetből igen)
    const atlat = allapot().m === 'felul';
    if (kliens && kapcsolodva && b.lathato && most - utolsoKuld > KULD_MS) {
      const a = allapot();
      const p = utolsoAllapot;
      const mozdult = !p || Math.hypot(a.x - p.x, a.y - p.y) > 0.02 || Math.abs(a.z - p.z) > 0.02
        || Math.abs(a.yaw - p.yaw) > 0.03 || a.g !== p.g || a.m !== p.m;
      const ex2 = extra?.() || {}, pe = p?.ex || {};
      const valtozott = Object.keys(ex2).some(k => ex2[k] !== pe[k]);
      a.ex = ex2;
      if (mozdult || valtozott || most - utolsoKuld > EL_MS) {
        const { ex, ...pozAdat } = a;
        kuld({ nev: b.nev, szin: b.szin, ...pozAdat, ...ex });
        utolsoAllapot = a;
        utolsoKuld = most;
      }
    }
    for (const [id, t] of tobbiek) {
      if (most - t.utolso > ELAVUL_MS) { eltavolit(id); continue; }
      const g = t.g, u = t.cel, d = g.userData;
      const k = Math.min(1, dt * 10);
      const ex = g.position.x, ez = g.position.z;
      g.position.x += (u.x - g.position.x) * k;
      g.position.z += (u.y - g.position.z) * k;
      g.position.y += ((u.z || 0) - g.position.y) * k;
      let dyaw = (u.yaw || 0) - g.rotation.y;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      g.rotation.y += dyaw * k;
      // guggolás: összehúzódik; felülnézetből nézők halványabbak
      const cs = u.g ? 0.58 : 1;
      d.test.scale.y += (cs - d.test.scale.y) * k;
      d.felirat.position.y = 2.05 * d.test.scale.y + 0.05;
      d.anyag.transparent = u.m === 'felul';
      d.anyag.opacity = u.m === 'felul' ? 0.45 : 1;
      // életerő-csík, találatnál piros villanás, halálkor eldől
      const jatszik = !!u.j && u.m !== 'felul';
      d.puska.visible = jatszik && (u.f === 1 || u.f === 2) && !u.hal;
      d.kard.visible = jatszik && u.f === 3 && !u.hal;
      d.lampa.visible = jatszik && !!u.l && !u.hal;
      d.mez.visible = jatszik && !!t.mez;
      d.hpHatter.visible = d.hpEloter.visible = jatszik;
      if (jatszik) {
        const hp = Math.max(0, Math.min(100, Number(u.h ?? 100))) / 100;
        d.hpEloter.scale.x = 0.8 * Math.max(0.001, hp);
        d.hpEloter.material.color.set(hp > 0.5 ? '#3ddc5a' : hp > 0.25 ? '#f0b400' : '#e5322d');
        const fy = 2.3 * d.test.scale.y + 0.1;
        d.hpHatter.position.y = d.hpEloter.position.y = fy;
      }
      for (const s of [d.felirat, d.hpHatter, d.hpEloter]) if (s.material.depthTest === atlat) { s.material.depthTest = !atlat; s.material.needsUpdate = true; }
      d.villan = Math.max(0, d.villan - dt);
      d.anyag.emissive?.set(d.villan > 0 ? '#ff2020' : '#000000');
      const dol = u.hal ? Math.PI / 2 : 0;
      d.test.rotation.z += (dol - d.test.rotation.z) * Math.min(1, dt * 6);
      // lépés: a lábak és a karok lengenek, ha mozog
      const seb = Math.hypot(g.position.x - ex, g.position.z - ez) / Math.max(dt, 1e-3);
      d.fazis += dt * Math.min(seb, 5) * 3.2;
      const leng = Math.min(1, seb / 1.2) * 0.55 * Math.sin(d.fazis);
      d.balLab.rotation.x = leng; d.jobbLab.rotation.x = -leng;
      d.balKar.rotation.x = -leng * 0.8; d.jobbKar.rotation.x = leng * 0.8;
    }
  }

  allapotKiir();
  if (el('kozosBe').checked) kapcsol();
  return {
    frissit, tobbiek, id: b.id,
    nev: () => b.nev,
    kapcsolodva: () => kapcsolodva && !!kliens,
    lathato: () => b.lathato,
    kuldR: (a, tema = 'ctf') => { if (kliens && kapcsolodva) kliens.publish(`${csatorna}/${tema}`, JSON.stringify(a), { qos: 0, retain: true }); },
    kuldE: e => { if (kliens && kapcsolodva) kliens.publish(`${csatorna}/e`, JSON.stringify({ ...e, tol: b.id }), { qos: 0 }); },
    villant: id => { const t = tobbiek.get(id); if (t) t.g.userData.villan = 0.25; },
    frissitAllapot: () => { utolsoAllapot = null; },
  };
}
