// Vezethető felmosókocsi (config.js: felmosoKocsi). K = fel- és leszállás (telefonon „Kocsi”).
// Aki rajta ül, csak vezetni tud (nem ugrik, nem guggol, nem mászik, nem lő, nem dob, nem vesz fel
// semmit); a vezetést a main.js kocsiLeptet() függvénye végzi. Egyszerre egy ember ülhet rajta.
// Az állapot megőrzött (retained) MQTT üzenet a <csatorna>/kocsi témán: {ts, x, y, yaw, ki, nev}
// (ki: aki épp vezeti; amíg vezeti, a kocsi az ő pálcikaembere alatt van).
import * as THREE from 'three';

// gépies felmosókocsi: sárga test, kék kefetálca, ülés, kormány, négy kerék; előre (−Z) néz
function kocsiModell() {
  const g = new THREE.Group();
  const anyag = szin => new THREE.MeshLambertMaterial({ color: szin });
  const doboz = (sx, sy, sz, a, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), a); m.position.set(x, y, z); g.add(m); return m; };
  const sarga = anyag('#f2c230'), kek = anyag('#1f5fbf'), fekete = anyag('#22252a'), szurke = anyag('#8a929c');
  doboz(0.8, 0.5, 1.3, sarga, 0, 0.45, 0.05);       // test (tartály)
  doboz(0.9, 0.12, 0.35, kek, 0, 0.14, -0.62);      // kefetálca elöl
  doboz(0.92, 0.06, 0.2, anyag('#cfd6de'), 0, 0.08, 0.72); // gumilehúzó hátul
  doboz(0.5, 0.12, 0.42, fekete, 0, 0.76, 0.28);    // ülés
  doboz(0.5, 0.4, 0.08, fekete, 0, 0.98, 0.5);      // háttámla
  doboz(0.7, 0.35, 0.3, sarga, 0, 0.85, -0.4);      // műszerfal
  const oszlop = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), szurke);
  oszlop.position.set(0, 1.15, -0.32); oszlop.rotation.x = -0.4; g.add(oszlop);
  const kormany = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 20), fekete);
  kormany.position.set(0, 1.33, -0.24); kormany.rotation.x = -Math.PI / 2 + 0.6; g.add(kormany);
  const villogo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff9a1a' }));
  villogo.material.userData.vilagit = true;
  villogo.position.set(0.28, 1.06, -0.45); g.add(villogo);
  const kerekGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14);
  const kerekek = [[-0.38, -0.35], [0.38, -0.35], [-0.38, 0.45], [0.38, 0.45]].map(([x, z]) => {
    const k = new THREE.Mesh(kerekGeo, fekete); k.rotation.z = Math.PI / 2; k.position.set(x, 0.13, z); g.add(k); return k;
  });
  g.userData = { kerekek, villogo, kormany };
  return g;
}

export function inditKocsi({ C, M, scene, seta, kozos, uzenet, getMod, szovegSprite }) {
  const K = C.felmosoKocsi;
  if (!K) return null;
  const el = id => document.getElementById(id);
  const SUGAR = Number(K.sugar ?? 0.55);
  let allapot = { ts: 0, x: K.x, y: K.y, yaw: Number(K.irany ?? 0), ki: null };
  const g = kocsiModell();
  const felirat = szovegSprite('FELMOSÓKOCSI · K', 0.22, { hatter: '#1f5fbf', szin: '#fff', meret: 40 });
  felirat.position.y = 1.75;
  g.add(felirat);
  scene.add(g);
  const enId = () => kozos?.id || 'helyi';
  let hiany = 0, sugoIdo = 0, utolsoKuld = 0;

  function alkalmaz(uj) {
    if (!uj || !(Number(uj.ts) > allapot.ts) || ![uj.x, uj.y].every(Number.isFinite)) return;
    allapot = { ts: Number(uj.ts), x: +uj.x, y: +uj.y, yaw: Number(uj.yaw) || 0, ki: uj.ki || null, nev: uj.nev };
    // valaki más ült fel, mint aki mi vagyunk – ha épp mi is (egyszerre szálltunk fel), a korábbi nyer
    if (seta.kocsin && allapot.ki !== enId()) { seta.kocsin = false; uzenet(`${allapot.nev || 'Valaki'} ült fel előbb a felmosókocsira`); }
  }
  function valtoztat(uj) {
    uj.ts = Math.max(Date.now(), allapot.ts + 1);
    alkalmaz(uj);
    kozos?.kuldR?.(uj, 'kocsi');
  }
  const szabad = () => !allapot.ki || allapot.ki === enId() || !kozos?.tobbiek.has(allapot.ki);
  const kozel = () => Math.hypot(seta.x - allapot.x, seta.y - allapot.y) < 1.6 && Math.abs(seta.z - (allapot.z ?? seta.z)) < 1;

  function felszall() {
    if (getMod() !== 'seta' || seta.halott || seta.kocsin) return;
    if (!kozel()) { uzenet('Menj közelebb a felmosókocsihoz (az EAR raktár előtt áll)'); return; }
    if (!szabad()) { uzenet(`${allapot.nev || 'Valaki'} már vezeti a felmosókocsit`); return; }
    Object.assign(seta, { x: allapot.x, y: allapot.y, yaw: allapot.yaw, kocsin: true, kv: 0, kvx: 0, kvy: 0, guggol: false, maszik: false });
    valtoztat({ x: allapot.x, y: allapot.y, yaw: allapot.yaw, ki: enId(), nev: kozos?.nev() || 'Én' });
    uzenet('🧽 Felszálltál a felmosókocsira! W/S = gáz/fék, A/D (vagy egér) = kormány, K = leszállás');
  }
  function leszall(csendes) {
    if (!seta.kocsin) return;
    seta.kocsin = false;
    const x = seta.x, y = seta.y, yaw = seta.yaw;
    // a kocsi mellé lépünk (balra, jobbra vagy hátra – ahol van hely)
    for (const [ox, oz] of [[-1, 0], [1, 0], [0, 1.2], [0, -1.2]]) {
      const px = x + Math.cos(yaw) * ox + Math.sin(yaw) * oz, py = y - Math.sin(yaw) * ox + Math.cos(yaw) * oz;
      if (!M.racs.utkozik(px, py, 0.3, seta.z, 1.8)) { seta.x = px; seta.y = py; break; }
    }
    valtoztat({ x: +x.toFixed(2), y: +y.toFixed(2), yaw: +yaw.toFixed(3), ki: null });
    if (!csendes) uzenet('Leszálltál a felmosókocsiról');
  }
  const valt = () => (seta.kocsin ? leszall() : felszall());
  el('kocsiGomb')?.addEventListener('pointerdown', e => { e.preventDefault(); valt(); });

  function frissit(dt) {
    const t = performance.now();
    if (seta.kocsin && (seta.halott || getMod() !== 'seta')) leszall(true);
    let x = allapot.x, y = allapot.y, z = 0, yaw = allapot.yaw, seb = 0;
    if (seta.kocsin) {
      x = seta.x; y = seta.y; z = seta.z; yaw = seta.yaw; seb = seta.kv || 0;
      // vezetés közben időnként frissítjük a megőrzött helyet is (ha a vezető eltűnik, ott marad)
      if (t - utolsoKuld > 3000) { utolsoKuld = t; valtoztat({ x: +x.toFixed(2), y: +y.toFixed(2), yaw: +yaw.toFixed(3), ki: enId(), nev: kozos?.nev() || 'Én' }); }
    } else if (allapot.ki && allapot.ki !== enId()) {
      const v = kozos?.tobbiek.get(allapot.ki);
      if (v) {
        hiany = 0;
        const ex = g.position.x, ez = g.position.z;
        x = v.g.position.x; y = v.g.position.z; z = v.g.position.y; yaw = v.g.rotation.y;
        seb = Math.hypot(x - ex, y - ez) / Math.max(dt, 1e-3);
      } else {
        if (!hiany) hiany = t;
        if (t - hiany > 12000) { hiany = 0; valtoztat({ x: allapot.x, y: allapot.y, yaw: allapot.yaw, ki: null }); }
      }
    } else if (allapot.ki === enId()) {
      // újratöltés után: a megőrzött állapot szerint mi vezettük – most már nem
      valtoztat({ x: allapot.x, y: allapot.y, yaw: allapot.yaw, ki: null });
    }
    g.position.set(x, z, y);
    g.rotation.y = yaw;
    for (const k of g.userData.kerekek) k.rotation.x -= seb * dt / 0.13;
    g.userData.villogo.visible = (seta.kocsin || (allapot.ki && allapot.ki !== enId())) ? Math.sin(t / 150) > 0 : true;
    felirat.visible = !seta.kocsin;
    // súgó és telefonos gomb, ha a közelében vagyunk
    const kozelben = getMod() === 'seta' && !seta.halott && !seta.kocsin && szabad() && kozel();
    if (kozelben && t - sugoIdo > 8000) { sugoIdo = t; uzenet('🧽 K = felszállás a felmosókocsira'); }
    const gomb = el('kocsiGomb');
    if (gomb) {
      gomb.hidden = !((kozelben || seta.kocsin) && document.body.classList.contains('erintes'));
      gomb.textContent = seta.kocsin ? 'Leszállás' : 'Kocsi';
    }
  }

  return { frissit, valt, fogad: alkalmaz, allapot: () => allapot, sugar: SUGAR };
}
