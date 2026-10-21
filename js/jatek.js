// Játék a közös nézetben: lökés, palackdobás, életerő (HP), halálok és ölések számlálása.
// Mindenki a saját életerejéért felel: ő dönti el, hogy eltalálták-e, és ő jelenti a halálát.
// Események (kozos.kuldE, a <csatorna>/e témán):
//   {t:'lokes', cel, dx, dy}          – meglökték a célt (dx, dy: a lökés iránya)
//   {t:'dobas', id, x, y, z, vx, vy, vz} – palack indult (világkoordinátában, y = fel)
//   {t:'talalat', id, cel}            – a palack eltalálta a célt (mindenki eltünteti a palackot)
//   {t:'halal', cel, celNev, tol2, tol2Nev, ok} – a cél meghalt; tol2 a tettes (ha van)
import * as THREE from 'three';

const TAROL = 'raktar3d.jatek';
const OK_SZOVEG = { lokes: 'meglökték', palack: 'palack találta el', eses: 'leesett' };

function betolt() {
  try { return JSON.parse(localStorage.getItem(TAROL)) || {}; } catch { return {}; }
}
function ment(a) {
  try { localStorage.setItem(TAROL, JSON.stringify(a)); } catch { /* nincs tárhely */ }
}

export function inditJatek({ C, M, scene, camera, seta, kozos, uzenet, getMod, kiindulo }) {
  const J = C.jatek || {};
  const cfg = {
    lokes: Number(J.lokesSebzes ?? 10), palack: Number(J.palackSebzes ?? 25),
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
    seta.halott = true;
    pont.d++;
    mentes();
    const tettes = tamado && most() - tamado.ido < 6000 ? tamado : null;
    const ok2 = tettes && ok === 'eses' ? 'lokes' : ok;
    kozos?.kuldE({ t: 'halal', cel: kozos.id, celNev: kozos.nev(), tol2: tettes?.id, tol2Nev: tettes?.nev, ok: ok2 });
    el('halalSzoveg').textContent = tettes
      ? `${tettes.nev} ${ok2 === 'palack' ? 'eltalált egy palackkal' : 'meglökött'}.`
      : OK_SZOVEG[ok2] === 'leesett' ? 'Leestél.' : 'Elfogyott az életerőd.';
    el('halalKep').hidden = false;
    kozos?.frissitAllapot();
    setTimeout(ujraeled, cfg.ujraMp * 1000);
  }

  function ujraeled() {
    hp = 100;
    halott = false;
    tamado = null;
    Object.assign(seta, { halott: false, x: kiindulo.x, y: kiindulo.y, z: 0, kz: 0, vz: 0, kvx: 0, kvy: 0, guggol: false });
    el('halalKep').hidden = true;
    kozos?.frissitAllapot();
  }

  // --- lökés ---
  function lokes() {
    if (!serulhet() || most() - lokesIdo < 800) return;
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
    if (!serulhet() || most() - dobasIdo < 600) return;
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
        sebzes(cfg.lokes, 'lokes');
      } else kozos.villant(e.cel);
    } else if (e.t === 'dobas') {
      const p = new THREE.Vector3(+e.x, +e.y, +e.z), v = new THREE.Vector3(+e.vx, +e.vy, +e.vz);
      if ([p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite)) inditPalack(e.id, p, v, e.tol, e.nev || 'Valaki', false);
    } else if (e.t === 'talalat') {
      torik(e.id);
      if (e.cel !== kozos.id) kozos.villant(e.cel);
    } else if (e.t === 'halal') {
      if (e.tol2 && e.tol2 === kozos.id) { pont.k++; mentes(); kozos.frissitAllapot(); }
      const kie = e.tol2Nev ? ` – ${e.tol2 === kozos.id ? 'te' : e.tol2Nev}` : '';
      uzenet(`☠ ${e.celNev || 'Valaki'} meghalt (${OK_SZOVEG[e.ok] || 'elfogyott az életereje'})${kie}`);
      listaFrissit();
    }
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
    const sorok = [{ nev: kozos?.nev() || 'Én', h: hp, d: pont.d, k: pont.k, en: true, j: be }];
    for (const t of kozos?.tobbiek.values() || []) {
      if (t.cel.j) sorok.push({ nev: t.nev, h: t.cel.h, d: t.cel.d || 0, k: t.cel.k || 0, hal: t.cel.hal });
    }
    sorok.sort((a, b) => b.k - a.k || a.d - b.d);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    el('pontLista').innerHTML = '<tr><th>Név</th><th>HP</th><th>☠ halál</th><th>🎯 ölés</th></tr>' + sorok.map(s =>
      `<tr class="${s.en ? 'en' : ''}"><td>${esc(s.nev)}${s.en ? ' (te)' : ''}</td><td>${s.j === false ? '–' : s.hal ? '☠' : Math.round(s.h ?? 100)}</td><td>${s.d}</td><td>${s.k}</td></tr>`).join('');
  }

  // --- képkockánként ---
  let listaIdo = 0;
  function frissit(dt) {
    const seta2 = getMod() === 'seta';
    el('hpSav').hidden = !(be && seta2);
    if (be && seta2) {
      el('hpErtek').style.width = `${hp}%`;
      el('hpErtek').style.background = hp > 50 ? '#3ddc5a' : hp > 25 ? '#f0b400' : '#e5322d';
      el('hpSzoveg').textContent = halott ? '☠' : `${Math.round(hp)} HP · ☠ ${pont.d} · 🎯 ${pont.k}`;
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
        if (!b.sajat && b.tol !== kozos?.id && serulhet()) {
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
  }

  return {
    frissit, lokes, dobas, eses, esemeny,
    extra: () => (be ? { j: 1, h: Math.round(hp), d: pont.d, k: pont.k, hal: halott ? 1 : 0 } : { j: 0 }),
  };
}
