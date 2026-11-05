// Véletlen események a játékban (config.js: esemenyek): a gép órája szerint időszakonként (alapból
// 4 percenként) egy esemény jöhet, mindenkinél ugyanaz és ugyanakkor (az időszak sorszámából
// számolt álvéletlen):
//   ⚡ áramszünet – hosszMp-ig nappal is sötét (zseblámpa!)
//   🔥 tűzriadó   – szól a sziréna; aki a végéig nem ér ki a raktárból (udvar, fedett részek), füstmérgezést kap
//   🟨 aranyraklap – valahol a raktárban; aki elsőként odaér, bónuszpontot kap a meccsben
// Az aranyraklap felvételét {t:'arany', sz} esemény jelzi a többieknek.
import * as THREE from 'three';
import { hashSzam, helyElotti } from './modell.js';
import { hang } from './hang.js';

const ido = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function inditEsemenyek({ C, M, scene, seta, kozos, uzenet, getMod, jatek, ejszaka, kutyak, meccs }) {
  const K = C.esemenyek || {};
  if (K.bekapcsolva === false) return null;
  const idoszak = Number(K.gyakorisagPerc ?? 4) * 60000, kezdet = Number(K.kesleltetesMp ?? 60) * 1000, hossz = Number(K.hosszMp ?? 60) * 1000;
  const FAJTAK = ['aramszunet', 'tuzriado', 'aranyraklap', null]; // a null: abban az időszakban nincs esemény
  const el = id => document.getElementById(id);
  const jok = M.helyek.filter(h => h.kod && Number.isFinite(h.x));
  let aktSz = -1, felvett = new Set(), tuzEredmeny = -1, szirenaIdo = 0, elozoFajta = null;

  // aranyraklap: csillogó, lebegő raklap aranyrudakkal
  const arany = new THREE.Group();
  const aranyAnyag = new THREE.MeshLambertMaterial({ color: '#f5c518', emissive: '#7a5a00' });
  const raklap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.8), new THREE.MeshLambertMaterial({ color: '#c8a165', emissive: '#3a2a10' }));
  raklap.position.y = 0.07; arany.add(raklap);
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.14), aranyAnyag); r.position.set(-0.3 + (i % 3) * 0.3, 0.19 + Math.floor(i / 3) * 0.1, -0.15 + (i % 2) * 0.3); arany.add(r); }
  const fenycsik = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 5, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  fenycsik.material.userData.vilagit = true; fenycsik.position.y = 2.5; arany.add(fenycsik);
  arany.visible = false;
  scene.add(arany);

  // a mostani időszak eseménye: fajta, a kezdetétől eltelt idő, és (aranyraklapnál) a helye
  function allapot() {
    const t = Date.now(), sz = Math.floor(t / idoszak), benne = t % idoszak;
    const fajta = FAJTAK[Math.floor(hashSzam(`esemeny:${sz}`) * FAJTAK.length)];
    const fut = !!fajta && benne >= kezdet && benne < kezdet + hossz;
    let hely = null;
    if (fajta === 'aranyraklap') { const h = jok[Math.floor(hashSzam(`arany:${sz}`) * jok.length)]; hely = { h, p: helyElotti(M, h, C) }; }
    return { sz, fajta, fut, eltelt: benne - kezdet, hatra: kezdet + hossz - benne, hely };
  }

  function frissit() {
    const a = allapot(), jatszik = jatek?.jatekBe?.() && getMod() === 'seta';
    const kij = el('esemenyHud');
    // indulás: bejelentés
    if (a.fut && aktSz !== a.sz) {
      aktSz = a.sz; tuzEredmeny = -1;
      if (jatszik) {
        uzenet(a.fajta === 'aranyraklap' ? `🟨 ARANYRAKLAP a ${a.hely.h.kod} környékén! Aki elsőként odaér, bónuszpontot kap.`
          : a.fajta === 'tuzriado' ? '🔥 TŰZRIADÓ! Mindenki ki a raktárból – az udvarra vagy a fedett részre!' : '⚡ ÁRAMSZÜNET! Kapcsold fel a zseblámpát (L)!');
        hang(a.fajta === 'tuzriado' ? 'szirena' : 'kurt');
      }
    }
    // áramszünet: sötét (az elején és a végén áttűnéssel)
    const aram = a.fut && a.fajta === 'aramszunet' ? Math.min(1, a.eltelt / 2000, a.hatra / 2000) : 0;
    ejszaka?.aramszunet?.(aram);
    // tűzriadó: sziréna, a végén aki bent maradt, füstmérgezést kap
    if (a.fut && a.fajta === 'tuzriado' && jatszik && performance.now() - szirenaIdo > 1300) { szirenaIdo = performance.now(); hang('szirena', null, kutyak?.kint?.() ? 0.35 : 1); }
    if (a.fajta === 'tuzriado' && !a.fut && a.eltelt >= hossz && aktSz === a.sz && tuzEredmeny !== a.sz) {
      tuzEredmeny = a.sz;
      if (jatszik && !seta.halott) {
        if (kutyak?.kint?.()) uzenet('✅ Kiértél a tűzriadó alatt – ügyes!');
        else jatek?.kornyezet?.(Number(K.tuzSebzes ?? 50), 'tuz', '🔥 Bent maradtál a tűzriadó alatt: füstmérgezés!');
      }
    }
    el('tuzVillog').hidden = !(a.fut && a.fajta === 'tuzriado' && jatszik);
    // aranyraklap
    const aranyVan = a.fut && a.fajta === 'aranyraklap' && !felvett.has(a.sz) && jatek?.jatekBe?.();
    arany.visible = !!aranyVan;
    if (aranyVan) {
      const p = a.hely.p, t = performance.now();
      arany.position.set(p.x, 0.05 + 0.06 * Math.sin(t / 300), p.y);
      arany.rotation.y += 0.01;
      if (jatszik && !seta.halott && !seta.nezo && Math.hypot(seta.x - p.x, seta.y - p.y) < 1.0 && seta.z < 1.2) {
        felvett.add(a.sz);
        const n = Number(K.aranyBonusz ?? 3);
        meccs?.bonusz?.(n);
        kozos?.kuldE({ t: 'arany', sz: a.sz, nev: kozos.nev() });
        uzenet(`🟨 Megszerezted az aranyraklapot! +${n} bónuszpont a meccsben`);
        hang('dicsoseg');
      }
    }
    // kijelző
    kij.hidden = !(a.fut && jatszik && (a.fajta !== 'aranyraklap' || aranyVan));
    if (!kij.hidden) {
      let s = { aramszunet: '⚡ Áramszünet', tuzriado: '🔥 Tűzriadó – irány ki!', aranyraklap: '🟨 Aranyraklap' }[a.fajta] + ` · ${ido(a.hatra)}`;
      if (a.fajta === 'aranyraklap') {
        const p = a.hely.p, dx = p.x - seta.x, dy = p.y - seta.y, rel = Math.atan2(-dx, -dy) - seta.yaw;
        s += ` · ${a.hely.h.kod} · ${Math.round(Math.hypot(dx, dy))} m <span class="nyil" style="display:inline-block;transform:rotate(${(-rel).toFixed(2)}rad)">⬆</span>`;
      } else if (a.fajta === 'tuzriado') s += kutyak?.kint?.() ? ' · ✅ kint vagy' : ' · ❗ még bent vagy';
      if (kij.innerHTML !== s) kij.innerHTML = s;
      kij.className = a.fajta;
    }
    elozoFajta = a.fut ? a.fajta : null;
  }

  function esemeny(e) {
    if (e.t !== 'arany' || !Number.isFinite(+e.sz) || felvett.has(+e.sz)) return;
    felvett.add(+e.sz);
    uzenet(`🟨 ${String(e.nev || 'Valaki').slice(0, 24)} megszerezte az aranyraklapot`);
  }

  return { frissit, esemeny, allapot, aktiv: () => elozoFajta };
}
