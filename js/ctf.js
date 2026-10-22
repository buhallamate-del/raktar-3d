// Zászlófoglalás (capture the flag) a játékban: két csapat, mindkettőnek zászlója a bázisán.
// Az ellenfél zászlaját rámenéssel lehet felvenni; aki a saját bázisára viszi (miközben a saját
// zászlójuk otthon van), pontot szerez a csapatának. Aki zászlóval hal meg, ott elejti; a saját
// elejtett zászlót rámenéssel vissza lehet vinni, különben visszaMp után magától visszakerül.
// Az állapot egy megőrzött (retained) MQTT üzenet a <csatorna>/ctf témán, így aki később jön,
// az is látja: {ts, pont: {p, k}, z: {p: zászló, k: zászló}, uz}
//   zászló: {a: 'bazis'} | {a: 'visz', ki, nev} | {a: 'le', x, y, z, ig}
// Mindig a frissebb (nagyobb ts) állapot érvényes.
import * as THREE from 'three';

const TAROL = 'raktar3d.ctf';

function betolt() {
  try { return JSON.parse(localStorage.getItem(TAROL)) || {}; } catch { return {}; }
}

// zászló: rúd és lobogó; a lobogó saját fénnyel világít (éjszaka is látszik)
function zaszloModell(szin) {
  const g = new THREE.Group();
  const rud = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), new THREE.MeshLambertMaterial({ color: '#c9ced6' }));
  rud.position.y = 1.1;
  const geo = new THREE.PlaneGeometry(0.9, 0.6, 9, 4);
  geo.translate(0.45, 0, 0);
  const lobogo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: szin, side: THREE.DoubleSide }));
  lobogo.material.userData.vilagit = true;
  lobogo.position.set(0.025, 1.85, 0);
  g.add(rud, lobogo);
  g.userData = { lobogo, alap: Float32Array.from(geo.attributes.position.array) };
  return g;
}

export function inditCtf({ C, scene, seta, kozos, uzenet, getMod, jatekBe, szovegSprite }) {
  const K = C.ctf || {};
  const csapatok = (K.csapatok || []).slice(0, 2);
  if (csapatok.length < 2) return null;
  const [A, B] = csapatok.map(c => c.id);
  const cs = Object.fromEntries(csapatok.map(c => [c.id, c]));
  const masik = id => (id === A ? B : A);
  const visszaMs = Number(K.visszaMp ?? 30) * 1000, gyozelem = Number(K.gyozelem ?? 3);
  const el = id => document.getElementById(id);

  let allapot = { ts: 0, pont: { [A]: 0, [B]: 0 }, z: { [A]: { a: 'bazis' }, [B]: { a: 'bazis' } } };
  let valasztas = betolt().cs || 'auto', autoCs = null;
  const indult = performance.now();
  let kapcsIdo = 0, egyenlotlenSince = 0;
  // a többi játékos csapatonként (a saját magunkat nem számolva)
  function letszam() {
    const db = { [A]: 0, [B]: 0 };
    for (const t of kozos?.tobbiek.values() || []) if (t.cel.j && db[t.cel.cs] !== undefined) db[t.cel.cs]++;
    return db;
  }
  // Kiegyenlítés: ha az egyik csapat legalább 2 fővel nagyobb, az „automatikus” játékosai közül a
  // legkisebb azonosítójú (aki épp nem visz zászlót) átmegy – mindenki ugyanígy számol, így csak egy vált.
  function kiegyenlit(t) {
    if (valasztas !== 'auto' || !autoCs || !jatekBe()) { egyenlotlenSince = 0; return; }
    const db = letszam(); db[autoCs]++;
    if (db[autoCs] - db[masik(autoCs)] < 2) { egyenlotlenSince = 0; return; }
    if (!egyenlotlenSince) egyenlotlenSince = t;
    if (t - egyenlotlenSince < 3000) return;
    const visz = new Set([A, B].map(f => allapot.z[f].a === 'visz' && allapot.z[f].ki).filter(Boolean));
    const jeloltek = [...(kozos?.tobbiek.values() || [])].filter(v => v.cel.j && v.cel.cs === autoCs && v.cel.ca && !visz.has(v.id)).map(v => v.id);
    if (!visz.has(enId())) jeloltek.push(enId());
    jeloltek.sort();
    if (jeloltek[0] !== enId()) return;
    egyenlotlenSince = 0;
    autoCs = masik(autoCs);
    uzenet(`🚩 Kiegyenlítés: átkerültél a ${cs[autoCs].nev} csapatba`);
    kozos?.frissitAllapot();
  }

  // --- bázisok és zászlók ---
  const jelek = {};
  for (const c of csapatok) {
    const bazis = new THREE.Group();
    const gyuru = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 40),
      new THREE.MeshBasicMaterial({ color: c.szin, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    const korong = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40),
      new THREE.MeshBasicMaterial({ color: c.szin, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    for (const m of [gyuru, korong]) { m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.material.userData.vilagit = true; bazis.add(m); }
    const talp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.15, 16), new THREE.MeshLambertMaterial({ color: '#555b63' }));
    talp.position.y = 0.075; bazis.add(talp);
    const felirat = szovegSprite(`${c.nev.toUpperCase()} BÁZIS`, 0.4, { hatter: c.szin, szin: '#fff', meret: 44 });
    felirat.material.userData.vilagit = true;
    felirat.position.y = 3.0; bazis.add(felirat);
    bazis.position.set(c.bazis.x, Number(c.bazis.z ?? 0), c.bazis.y);
    const zaszlo = zaszloModell(c.szin);
    scene.add(bazis, zaszlo);
    jelek[c.id] = { bazis, zaszlo, hiany: 0 };
  }

  // --- felület ---
  const valaszto = el('ctfCsapat');
  if (valaszto) {
    valaszto.innerHTML = `<option value="auto">automatikus (a kisebb csapatba)</option>`
      + csapatok.map(c => `<option value="${c.id}">${c.nev}</option>`).join('') + `<option value="ki">nem játszom</option>`;
    valaszto.value = valasztas;
    valaszto.addEventListener('change', () => {
      valasztas = valaszto.value; autoCs = null;
      try { localStorage.setItem(TAROL, JSON.stringify({ cs: valasztas })); } catch { /* nincs tárhely */ }
      kozos?.frissitAllapot();
    });
  }
  el('ctfNullaz')?.addEventListener('click', () => {
    valtoztat(s => { s.pont = { [A]: 0, [B]: 0 }; }, `${kozos?.nev() || 'Valaki'} nullázta a csapatpontokat`);
  });

  // a saját csapat: választott, vagy automatikusan a kisebb (a többiek „cs” adata alapján)
  function csapat() {
    if (valasztas === A || valasztas === B) return valasztas;
    if (valasztas === 'ki') return null;
    // csak akkor döntünk, ha már látjuk a többieket (kapcsolódás után kb. 4 mp; szerver nélkül 15 mp)
    if (!autoCs) {
      if (kozos?.kapcsolodva?.()) { if (!kapcsIdo) kapcsIdo = performance.now(); }
      if (!(kapcsIdo && performance.now() - kapcsIdo > 4000) && performance.now() - indult < 15000) return null;
      const db = letszam();
      autoCs = db[A] < db[B] ? A : db[B] < db[A] ? B : (Math.random() < 0.5 ? A : B);
      uzenet(`🚩 Zászlófoglalás: a ${cs[autoCs].nev} csapatba kerültél`);
      kozos?.frissitAllapot();
    }
    return autoCs;
  }
  const jatszik = () => jatekBe() && !!csapat();
  const aktiv = () => jatszik() && getMod() === 'seta' && !seta.halott && !seta.kocsin && kozos?.lathato?.() !== false;

  // --- állapot ---
  function alkalmaz(uj, tavoli) {
    if (!uj || !(Number(uj.ts) > allapot.ts) || !uj.z?.[A] || !uj.z?.[B]) return;
    allapot = { ts: Number(uj.ts), pont: { [A]: Number(uj.pont?.[A]) || 0, [B]: Number(uj.pont?.[B]) || 0 }, z: { [A]: uj.z[A], [B]: uj.z[B] } };
    if (tavoli && uj.uz && Date.now() - allapot.ts < 15000) uzenet(String(uj.uz).slice(0, 120));
  }
  function valtoztat(fn, uz) {
    const uj = JSON.parse(JSON.stringify(allapot));
    fn(uj);
    uj.ts = Math.max(Date.now(), allapot.ts + 1);
    if (uz) uj.uz = uz;
    alkalmaz(uj, false);
    if (uz) uzenet(uz);
    kozos?.kuldR?.(uj);
  }
  const nev = () => kozos?.nev() || 'Én';
  const enId = () => kozos?.id || 'helyi';
  const nalam = () => [A, B].find(f => allapot.z[f].a === 'visz' && allapot.z[f].ki === enId()) || null;

  function elejt(f) {
    valtoztat(s => { s.z[f] = { a: 'le', x: +seta.x.toFixed(2), y: +seta.y.toFixed(2), z: +seta.z.toFixed(2), ig: Date.now() + visszaMs }; },
      `${nev()} elejtette a ${cs[f].nev} zászlót`);
  }

  const kozel = (x, y, z, r) => Math.hypot(seta.x - x, seta.y - y) < r && Math.abs(seta.z - (z || 0)) < 1.5;
  let figyIdo = 0;

  // --- képkockánként ---
  function frissit() {
    const t = performance.now(), ido = Date.now();
    kiegyenlit(t);
    const sajat = csapat(), ell = sajat && masik(sajat);
    const vf = nalam();
    // ha nem játszik tovább (meghalt, felülnézet, kikapcsolta, csapatot váltott), elejti a zászlót
    if (vf && (!aktiv() || vf === sajat)) elejt(vf);
    else if (aktiv()) {
      const ez = allapot.z[ell], sz = allapot.z[sajat], bz = cs[sajat].bazis;
      if (!vf) {
        const hol = ez.a === 'bazis' ? cs[ell].bazis : ez.a === 'le' ? ez : null;
        if (hol && kozel(hol.x, hol.y, hol.z, 1.0)) {
          valtoztat(s => { s.z[ell] = { a: 'visz', ki: enId(), nev: nev() }; }, `🚩 ${nev()} (${cs[sajat].nev}) megszerezte a ${cs[ell].nev} zászlót!`);
        }
      }
      if (sz.a === 'le' && kozel(sz.x, sz.y, sz.z, 1.0)) {
        valtoztat(s => { s.z[sajat] = { a: 'bazis' }; }, `${nev()} visszavitte a ${cs[sajat].nev} zászlót`);
      }
      if (nalam() === ell && kozel(bz.x, bz.y, bz.z, 1.8)) {
        if (sz.a === 'bazis') {
          const uj = allapot.pont[sajat] + 1;
          if (uj >= gyozelem) {
            const ered = `${uj}:${allapot.pont[ell]}`;
            valtoztat(s => { s.z[ell] = { a: 'bazis' }; s.pont = { [A]: 0, [B]: 0 }; },
              `🏆 ${nev()} hazavitte a zászlót – a ${cs[sajat].nev} csapat nyerte a kört (${ered})! Új kör.`);
          } else {
            valtoztat(s => { s.z[ell] = { a: 'bazis' }; s.pont[sajat] = uj; }, `🏁 ${nev()} pontot szerzett a ${cs[sajat].nev} csapatnak!`);
          }
        } else if (t - figyIdo > 3000) {
          figyIdo = t;
          uzenet('A pontszerzéshez a saját zászlótoknak is a bázison kell lennie!');
        }
      }
    }
    // magától visszakerül: az elejtett zászló visszaMp után, és az is, akinek a vivője eltűnt
    for (const f of [A, B]) {
      const z = allapot.z[f], j = jelek[f];
      if (z.a === 'le' && ido > Number(z.ig || 0)) valtoztat(s => { s.z[f] = { a: 'bazis' }; }, `A ${cs[f].nev} zászló visszakerült a bázisra`);
      if (z.a === 'visz' && z.ki !== enId() && !kozos?.tobbiek.has(z.ki)) {
        if (!j.hiany) j.hiany = t;
        if (t - j.hiany > 12000) { j.hiany = 0; valtoztat(s => { s.z[f] = { a: 'bazis' }; }, `A ${cs[f].nev} zászló visszakerült a bázisra`); }
      } else j.hiany = 0;
    }
    // megjelenítés
    const lathato = jatekBe();
    for (const f of [A, B]) {
      const z = allapot.z[f], j = jelek[f], g = j.zaszlo;
      j.bazis.visible = lathato;
      let lat = lathato;
      if (z.a === 'bazis') { g.position.copy(j.bazis.position).setY(j.bazis.position.y + 0.15); g.rotation.set(0, 0, 0); }
      else if (z.a === 'le') { g.position.set(+z.x, (+z.z || 0), +z.y); g.rotation.set(0, 0, 0.35); }
      else if (z.ki === enId()) lat = false; // a saját kezünkben: a kijelző mutatja
      else {
        const v = kozos?.tobbiek.get(z.ki);
        if (!v) lat = false;
        else {
          const yaw = v.g.rotation.y;
          g.position.set(v.g.position.x + Math.sin(yaw) * 0.22, v.g.position.y + 0.55, v.g.position.z + Math.cos(yaw) * 0.22);
          g.rotation.set(0, yaw + Math.PI / 2, 0.12);
        }
      }
      g.visible = lat;
      if (lat) { // lobogás
        const pos = g.userData.lobogo.geometry.attributes.position, al = g.userData.alap;
        for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 2] = Math.sin(al[i * 3] * 6 - t / 160) * 0.07 * al[i * 3];
        pos.needsUpdate = true;
      }
    }
    // kijelző
    const kij = el('ctfHud');
    if (kij) {
      kij.hidden = !(jatszik() && getMod() === 'seta');
      if (!kij.hidden) {
        const sp = c => `<span style="color:${c.szin}">■ ${c.nev} ${allapot.pont[c.id]}</span>`;
        const allas = f => (allapot.z[f].a === 'bazis' ? '' : allapot.z[f].a === 'le' ? ' (elejtve)' : ' (elvitték)');
        let s = `🚩 ${sp(cs[A])}${allas(A)} : ${sp(cs[B])}${allas(B)} · te: <b style="color:${cs[sajat].szin}">${cs[sajat].nev}</b>`;
        const nf = nalam();
        if (nf) s += `<div class="ctfNalad">Nálad a ${cs[nf].nev} zászló – vidd a ${cs[sajat].nev} bázisra!</div>`;
        if (kij.innerHTML !== s) kij.innerHTML = s;
      }
    }
  }

  return {
    frissit, csapat,
    fogad: uj => alkalmaz(uj, true),
    allapot: () => allapot,
    szin: id => cs[id]?.szin,
    csapatNev: id => cs[id]?.nev,
    // csapattárs-e (őt nem lehet bántani)
    csapattars: id => { const s = jatszik() && csapat(); return !!s && kozos?.tobbiek.get(id)?.cel.cs === s; },
    // újraéledés: a saját bázison
    ujraHely: () => { const s = jatszik() && csapat(); return s ? { x: cs[s].bazis.x, y: cs[s].bazis.y } : null; },
    extra: () => { const s = jatszik() && csapat(); return s ? { cs: s, ca: valasztas === 'auto' ? 1 : 0 } : { cs: 0 }; },
  };
}
