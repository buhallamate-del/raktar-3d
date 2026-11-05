// Vezethető targonca (config.js: vezethetoTarganca): K = fel/le (ugyanaz, mint a felmosókocsinál,
// amelyik közelebb van); W/S = gáz/fék, A/D = kormány, E = villa fel, C = villa le (telefonon a
// „Mászás” / „Guggolás” gomb). A villán raklap van: rá lehet állni, és a targonca felemel – pl. a
// polc tetejére. A vezetést a main.js kocsiLeptet() függvénye végzi (seta.kocsin = 'targonca').
// Közös állapot: megőrzött MQTT üzenet a <csatorna>/kocsi/targonca témán: {ts, x, y, yaw, villa, ki, nev};
// vezetés közben a vezető a pozíciója mellett küldi a villa magasságát ({jv}).
import * as THREE from 'three';
import { targoncaModell } from './targonca.js';

export function inditJarmu({ C, M, scene, seta, kozos, uzenet, getMod, szovegSprite }) {
  const K = C.vezethetoTarganca;
  if (!K) return null;
  const TEMA = 'kocsi/targonca';
  const SUGAR = Number(K.sugar ?? 0.75), MAXV = Number(K.villaMax ?? 3.2), VSEB = Number(K.villaSebesseg ?? 0.7);
  const RAKLAP = 0.15; // a raklap vastagsága a villán
  let allapot = { ts: 0, x: K.x, y: K.y, yaw: Number(K.irany ?? 0), villa: 0.1, ki: null };
  let villa = 0.1; // a mi vezetésünk közben
  const g = targoncaModell(0, szovegSprite, 'Vezethető targonca (K)');
  g.userData.potty.visible = false;
  const raklap = new THREE.Mesh(new THREE.BoxGeometry(1.0, RAKLAP, 1.1), new THREE.MeshLambertMaterial({ color: '#c8a165' }));
  raklap.position.set(0, 0.05 + RAKLAP / 2, -0.55);
  g.userData.villa.add(raklap);
  scene.add(g);
  const enId = () => kozos?.id || 'helyi';
  const rajtam = () => seta.kocsin === 'targonca';

  // ütközők: a test (ne lehessen átsétálni rajta) és a raklap a villán (rá lehet állni)
  const testUtk = { x0: 0, y0: 0, x1: 0, y1: 0, z0: 0, z1: 2.2 };
  const raklapUtk = { x0: 0, y0: 0, x1: 0, y1: 0, z0: 0, z1: 0 };
  M.racs.dinamikus.push(testUtk, raklapUtk);

  function alkalmaz(uj, tema) {
    if (tema && tema !== TEMA) return;
    if (!uj || !(Number(uj.ts) > allapot.ts) || ![uj.x, uj.y].every(Number.isFinite)) return;
    allapot = { ts: Number(uj.ts), x: +uj.x, y: +uj.y, yaw: Number(uj.yaw) || 0, villa: Math.max(0.1, Math.min(MAXV, Number(uj.villa) || 0.1)), ki: uj.ki || null, nev: uj.nev };
    if (rajtam() && allapot.ki !== enId()) { seta.kocsin = false; uzenet(`${allapot.nev || 'Valaki'} ült fel előbb a targoncára`); }
  }
  function valtoztat(uj) {
    uj.ts = Math.max(Date.now(), allapot.ts + 1);
    alkalmaz(uj);
    kozos?.kuldR?.(uj, TEMA);
  }
  const szabad = () => !allapot.ki || allapot.ki === enId() || !kozos?.tobbiek.has(allapot.ki);
  const kozel = () => Math.hypot(seta.x - allapot.x, seta.y - allapot.y) < 2.0;

  function felszall() {
    if (getMod() !== 'seta' || seta.halott || seta.kocsin) return;
    if (!szabad()) { uzenet(`${allapot.nev || 'Valaki'} már vezeti a targoncát`); return; }
    villa = allapot.villa;
    Object.assign(seta, { x: allapot.x, y: allapot.y, yaw: allapot.yaw, kocsin: 'targonca', kv: 0, kvx: 0, kvy: 0, guggol: false, maszik: false });
    valtoztat({ x: allapot.x, y: allapot.y, yaw: allapot.yaw, villa, ki: enId(), nev: kozos?.nev() || 'Én' });
    uzenet('🚜 Targoncán ülsz! W/S = gáz/fék, A/D = kormány, E = villa fel, C = villa le, K = leszállás');
  }
  function leszall(csendes) {
    if (!rajtam()) return;
    seta.kocsin = false;
    const x = seta.x, y = seta.y, yaw = seta.yaw;
    for (const [ox, oz] of [[-1.1, 0], [1.1, 0], [0, 1.6]]) {
      const px = x + Math.cos(yaw) * ox + Math.sin(yaw) * oz, py = y - Math.sin(yaw) * ox + Math.cos(yaw) * oz;
      if (!M.racs.utkozik(px, py, 0.3, 0, 1.8)) { seta.x = px; seta.y = py; seta.z = 0; break; }
    }
    valtoztat({ x: +x.toFixed(2), y: +y.toFixed(2), yaw: +yaw.toFixed(3), villa: +villa.toFixed(2), ki: null });
    if (!csendes) uzenet('Leszálltál a targoncáról');
  }
  const valt = () => (rajtam() ? leszall() : felszall());

  // vezetés közben (a main.js hívja): a villa emelése/süllyesztése
  function villaLeptet(dt, fel, le) {
    villa = Math.max(0.1, Math.min(MAXV, villa + ((fel ? 1 : 0) - (le ? 1 : 0)) * VSEB * dt));
  }

  let utolsoKuld = 0, hiany = 0, elozo = null;
  function frissit(dt) {
    const t = performance.now();
    if (rajtam() && (seta.halott || getMod() !== 'seta')) leszall(true);
    let x = allapot.x, y = allapot.y, yaw = allapot.yaw, v = allapot.villa, z = 0;
    if (rajtam()) {
      x = seta.x; y = seta.y; yaw = seta.yaw; v = villa; z = seta.z;
      if (t - utolsoKuld > 3000) { utolsoKuld = t; valtoztat({ x: +x.toFixed(2), y: +y.toFixed(2), yaw: +yaw.toFixed(3), villa: +v.toFixed(2), ki: enId(), nev: kozos?.nev() || 'Én' }); }
    } else if (allapot.ki && allapot.ki !== enId()) {
      const ov = kozos?.tobbiek.get(allapot.ki);
      if (ov) {
        hiany = 0;
        x = ov.g.position.x; y = ov.g.position.z; z = ov.g.position.y; yaw = ov.g.rotation.y;
        if (Number.isFinite(Number(ov.cel.jv))) v = Number(ov.cel.jv);
      } else {
        if (!hiany) hiany = t;
        if (t - hiany > 12000) { hiany = 0; valtoztat({ x: allapot.x, y: allapot.y, yaw: allapot.yaw, villa: allapot.villa, ki: null }); }
      }
    } else if (allapot.ki === enId()) valtoztat({ x: allapot.x, y: allapot.y, yaw: allapot.yaw, villa: allapot.villa, ki: null });
    g.position.set(x, z, y);
    g.rotation.y = yaw;
    g.userData.villa.position.y += (v - g.userData.villa.position.y) * Math.min(1, dt * 8);
    const vy = g.userData.villa.position.y;
    // ütközők (tengelyhez igazítva): a test és a raklap a villán; a vezetőt a sajátja nem akadályozza
    const fx = -Math.sin(yaw), fy = -Math.cos(yaw), hosszanX = Math.abs(fx) > Math.abs(fy);
    const tx = x + fx * -0.15, ty = y + fy * -0.15, thx = hosszanX ? 1.0 : 0.6, thy = hosszanX ? 0.6 : 1.0;
    Object.assign(testUtk, { x0: tx - thx, x1: tx + thx, y0: ty - thy, y1: ty + thy, z0: z, z1: z + 2.2, aktiv: !rajtam() });
    const rx = x + fx * 1.33, ry = y + fy * 1.33, rhx = hosszanX ? 0.55 : 0.5, rhy = hosszanX ? 0.5 : 0.55;
    const regi = { ...raklapUtk };
    Object.assign(raklapUtk, { x0: rx - rhx, x1: rx + rhx, y0: ry - rhy, y1: ry + rhy, z0: z + vy, z1: z + vy + 0.05 + RAKLAP, aktiv: !rajtam() });
    // aki a raklapon áll, azt a targonca viszi (vízszintesen; a magasságot a talaj követi)
    if (!rajtam() && elozo && getMod() === 'seta' && !seta.halott && Math.abs(seta.z - regi.z1) < 0.08
      && seta.x > regi.x0 - 0.1 && seta.x < regi.x1 + 0.1 && seta.y > regi.y0 - 0.1 && seta.y < regi.y1 + 0.1) {
      seta.x += rx - elozo.rx; seta.y += ry - elozo.ry;
      if (raklapUtk.z1 > seta.z) seta.z = raklapUtk.z1; // emelés: felvisz
    }
    elozo = { rx, ry };
  }

  return { frissit, valt, fogad: alkalmaz, villaLeptet, sugar: SUGAR, kozel: () => kozel() && szabad(), rajtam,
    villa: () => villa, extra: () => (rajtam() ? { jv: +villa.toFixed(2) } : {}) };
}
