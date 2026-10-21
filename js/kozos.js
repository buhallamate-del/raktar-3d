// Közös nézet: aki egyszerre nézi az oldalt, az pálcikaemberként látja a többieket.
// A pozíciók egy MQTT üzenetközvetítőn (alapból a HiveMQ nyilvános szerverén) mennek át:
//   <csatorna>/poz/<azonosító>  ->  {nev, szin, x, y, z, yaw, g, m}
// Üres üzenet = az illető kilépett (ezt a szerver is elküldi helyettünk, ha megszakad a kapcsolat).
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
function palcikaember(szin, nev, szovegSprite) {
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
  balLab.position.x = -0.1; jobbLab.position.x = 0.1; balKar.position.x = -0.25; jobbKar.position.x = 0.25;
  // „orr”: merre néz
  const orr = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), anyag);
  orr.rotation.x = -Math.PI / 2; orr.position.set(0, 1.62, -0.17);
  test.add(fej, torzs, vall, balLab, jobbLab, balKar, jobbKar, orr);
  g.add(test);
  const felirat = szovegSprite(nev, 0.32, { hatter: szin, szin: '#fff', meret: 44, depthTest: false });
  felirat.position.y = 2.05;
  g.add(felirat);
  g.userData = { test, balLab, jobbLab, balKar, jobbKar, felirat, fazis: 0, anyag };
  return g;
}

export function inditKozos({ C, scene, szovegSprite, allapot, uzenet }) {
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
      utolsoAllapot = null;
      allapotKiir();
    });
    kliens.on('close', () => { kapcsolodva = false; allapotKiir(); });
    kliens.on('error', e => console.warn('[közös nézet]', e?.message || e));
    kliens.on('message', (tema, adat) => {
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
    if (t && (t.nev !== nev || t.szin !== szin)) { eltavolit(id); t = null; }
    if (!t) {
      const g = palcikaember(szin, nev, szovegSprite);
      g.position.set(u.x, u.z || 0, u.y);
      scene.add(g);
      t = { g, nev, szin, cel: u, utolso: 0 };
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
    if (kliens && kapcsolodva && b.lathato && most - utolsoKuld > KULD_MS) {
      const a = allapot();
      const p = utolsoAllapot;
      const mozdult = !p || Math.hypot(a.x - p.x, a.y - p.y) > 0.02 || Math.abs(a.z - p.z) > 0.02
        || Math.abs(a.yaw - p.yaw) > 0.03 || a.g !== p.g || a.m !== p.m;
      if (mozdult || most - utolsoKuld > EL_MS) {
        kuld({ nev: b.nev, szin: b.szin, ...a });
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
  return { frissit, tobbiek };
}
