// Killcam (config.js: killcam): ha egy másik játékos megöl, a halál előtti utolsó másodperceket
// visszajátsszuk az ő szemszögéből – a kamera az ő (rögzített) helyéről a mi alakunkat követi.
// Ehhez folyamatosan rögzítjük a saját helyünket és a többiek pálcikaemberének helyét.
import * as THREE from 'three';
import { palcikaember } from './kozos.js';

export function inditKillcam({ C, scene, camera, seta, kozos, szovegSprite, getMod }) {
  const K = C.killcam || {};
  if (K.bekapcsolva === false) return null;
  const hossz = Number(K.mp ?? 3) * 1000, MINTA = 50;
  const el = id => document.getElementById(id);
  const minta = []; // {t, en: [x, y, z, yaw, guggol], mas: Map(id -> [x, fel, z, yaw])}
  let utolso = 0, fut = null; // {kezdet, halal, tettes, nev, ok, en: palcikaember}

  function rogzit(t) {
    if (t - utolso < MINTA) return;
    utolso = t;
    const mas = new Map();
    for (const [id, v] of kozos?.tobbiek || []) mas.set(id, [v.g.position.x, v.g.position.y, v.g.position.z, v.g.rotation.y]);
    minta.push({ t, en: [seta.x, seta.y, seta.z, seta.yaw, seta.guggol ? 1 : 0], mas });
    while (minta.length && t - minta[0].t > hossz + 3000) minta.shift();
  }
  // a rögzítés egy időpontban (két minta között lineárisan)
  function hol(t) {
    if (!minta.length) return null;
    let i = minta.findIndex(m => m.t >= t);
    if (i < 0) return minta[minta.length - 1];
    if (i === 0) return minta[0];
    const a = minta[i - 1], b = minta[i], u = (t - a.t) / Math.max(1, b.t - a.t);
    const lerp = (p, q) => p.map((v, k) => v + (q[k] - v) * u);
    const mas = new Map();
    for (const [id, pa] of a.mas) { const pb = b.mas.get(id); mas.set(id, pb ? lerp(pa, pb) : pa); }
    return { en: lerp(a.en, b.en), mas };
  }

  function indit(tettes, ok) {
    const most = performance.now();
    if (!minta.some(m => m.mas.has(tettes.id))) return; // nincs róla felvétel
    const en = palcikaember(kozos?.szin?.() || '#888888', kozos?.nev?.() || 'Én', szovegSprite);
    scene.add(en);
    fut = { kezdet: most, halal: most, tettes: tettes.id, nev: tettes.nev, ok, en };
    const mi = { loves: 'lelőtt', palack: 'eltalált egy palackkal', granat: 'felrobbantott', raketa: 'eltalált a bazookájával',
      akna: 'aknájára léptél', katana: 'levágott a katanájával', lokes: 'meglökött' }[ok] || 'megölt';
    el('killcamSav').textContent = `🎥 KILLCAM · ${tettes.nev} ${mi}`;
    el('killcamSav').hidden = false;
    el('halalKep').hidden = true;
  }
  function vege() {
    if (!fut) return;
    scene.remove(fut.en);
    fut.en.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); });
    const v = kozos?.tobbiek.get(fut.tettes);
    if (v) v.g.visible = true;
    fut = null;
    el('killcamSav').hidden = true;
    if (seta.halott) el('halalKep').hidden = false;
  }

  const cel = new THREE.Vector3();
  // képkockánként: rögzítés; killcam közben a kamera a tettes rögzített helyéről néz minket
  function frissit() {
    const t = performance.now();
    if (!fut) { if (getMod() === 'seta' && !seta.halott) rogzit(t); return false; }
    const eltelt = t - fut.kezdet;
    if (eltelt > hossz || !seta.halott || getMod() !== 'seta') { vege(); return false; }
    // a halál előtti „hossz” idősáv lejátszása, valós sebességgel; a végén megáll a halálnál
    const h = hol(fut.halal - hossz + eltelt * 1.0);
    const tp = h?.mas.get(fut.tettes);
    if (!h || !tp) { vege(); return false; }
    const v = kozos?.tobbiek.get(fut.tettes);
    if (v) v.g.visible = false; // az élő alakja ne takarja a kamerát
    const [ex, ey, ez, eyaw, egg] = h.en;
    fut.en.position.set(ex, ez, ey);
    fut.en.rotation.y = eyaw;
    fut.en.userData.test.scale.y = egg ? 0.58 : 1;
    // az utolsó pillanatban eldőlünk
    const dol = Math.max(0, Math.min(1, (eltelt - (hossz - 500)) / 400));
    fut.en.userData.test.rotation.z = dol * Math.PI / 2;
    camera.position.set(tp[0], tp[1] + 1.6, tp[2]);
    cel.set(ex, ez + 1.0, ey);
    camera.lookAt(cel);
    return true;
  }

  return { frissit, aktiv: () => !!fut, indit, vege };
}
