// Éjszakai mód a játékban: a gép órája szerint váltakozik a nappal és az éjszaka (alapból
// 3 perc – 3 perc), így mindenkinél egyszerre sötétedik. Éjszaka csak belső nézetben, és csak
// annál, akinél a játék be van kapcsolva. Zseblámpa: L (telefonon „Lámpa”); éjszaka magától bekapcsol.
import * as THREE from 'three';

export function inditEjszaka({ C, scene, camera, fenyek, getMod, jatekBe, ledAnyag, cimkeAnyagok = [], targoncak }) {
  const E = C.ejszaka || {};
  const nappal = Number(E.nappalMp ?? 180) * 1000, ejjel = Number(E.ejjelMp ?? 180) * 1000;
  const atmenet = Number(E.atmenetMp ?? 4) * 1000;
  const el = id => document.getElementById(id);

  // zseblámpa: mindig a jelenetben van (nappal 0 erővel), hogy ne kelljen újrafordítani az árnyalókat
  if (!camera.parent) scene.add(camera);
  const lampa = new THREE.SpotLight('#fff4dc', 0, 32, 0.42, 0.45, 1.2);
  lampa.position.set(0.15, -0.1, 0);
  const cel = new THREE.Object3D();
  cel.position.set(0, -0.15, -5);
  camera.add(lampa, cel);
  lampa.target = cel;
  let lampaBe = true, lampaKezi = false; // a kézi kapcsolás felülírja az automatikát egy éjszakára

  const eredeti = { hatter: scene.background?.clone(), hemi: fenyek.hemi.intensity, nap: fenyek.nap.intensity };
  let k = 0; // 0 = nappal, 1 = teljes sötét

  // Nem fényre reagáló anyagok (feliratok, címkék, jelölők): éjszaka elsötétülnek; ami világít
  // (userData.vilagit: pl. kapufeliratok, a targoncák kék pöttye), az nem.
  const halvanyitott = new Set();
  function halvanyit(mertek) {
    scene.traverse(o => {
      if (o.userData?.vilagit || !o.material) return;
      for (const m of [].concat(o.material)) {
        if (!(m.isMeshBasicMaterial || m.isSpriteMaterial || m.isLineBasicMaterial) || m.userData?.vilagit) continue;
        if (!m.userData.eredetiSzin) m.userData.eredetiSzin = m.color.clone();
        m.color.copy(m.userData.eredetiSzin).multiplyScalar(1 - mertek * 0.9);
        halvanyitott.add(m);
      }
    });
  }
  let utolsoHalvany = -1;

  function ciklus() {
    const t = Date.now() % (nappal + ejjel);
    const ejszakaVan = t >= nappal;
    const hatra = ejszakaVan ? nappal + ejjel - t : nappal - t;
    // áttűnés a váltások körül
    let cel = ejszakaVan ? 1 : 0;
    if (ejszakaVan && t - nappal < atmenet) cel = (t - nappal) / atmenet;
    if (!ejszakaVan && t < atmenet) cel = 1 - t / atmenet;
    return { ejszakaVan, hatra, cel };
  }

  function frissit(dt) {
    const c = ciklus();
    const aktiv = jatekBe() && getMod() === 'seta';
    const celK = aktiv ? c.cel : 0;
    k += (celK - k) * Math.min(1, dt * 3);
    if (Math.abs(k - celK) < 0.002) k = celK;
    fenyek.hemi.intensity = eredeti.hemi * (1 - k) + 0.05 * k;
    fenyek.nap.intensity = eredeti.nap * (1 - k);
    if (eredeti.hatter) scene.background.copy(eredeti.hatter).lerp(new THREE.Color('#04060a'), k);
    if (scene.fog) {
      scene.fog.color.set('#dfe3e8').lerp(new THREE.Color('#04060a'), k);
      scene.fog.near = 35 * (1 - k) + 4 * k; scene.fog.far = 140 * (1 - k) + 38 * k;
    }
    ledAnyag?.color.setScalar(1 - 0.85 * k);
    for (const m of cimkeAnyagok) m.emissiveIntensity = 0.35 * (1 - k) + 0.02 * k;
    // halványítás csak ha érezhetően változott (traverse drága)
    const lepcsos = Math.round(k * 20) / 20;
    if (lepcsos !== utolsoHalvany) { halvanyit(lepcsos); utolsoHalvany = lepcsos; }
    // zseblámpa: éjszaka magától be, nappal ki (ha nem kapcsolták kézzel)
    if (!lampaKezi) lampaBe = c.ejszakaVan;
    if (!c.ejszakaVan && c.hatra < 1000) lampaKezi = false;
    lampa.intensity = aktiv && lampaBe ? 30 * Math.max(0.15, k) : 0;
    // targoncák fényszórója
    for (const tg of targoncak?.targoncak || []) if (tg.g.userData.reflektor) tg.g.userData.reflektor.visible = k > 0.3;
    // kijelző
    const kij = el('napszak');
    kij.hidden = !aktiv;
    if (aktiv) {
      const mp = Math.ceil(c.hatra / 1000), szoveg = `${Math.floor(mp / 60)}:${String(mp % 60).padStart(2, '0')}`;
      kij.textContent = c.ejszakaVan ? `🌙 Éjszaka · világosodásig ${szoveg}${lampaBe ? '' : ' · L = lámpa'}` : `☀ Nappal · sötétedésig ${szoveg}`;
      kij.classList.toggle('ejjel', c.ejszakaVan);
    }
    el('lampaGomb').hidden = !(aktiv && c.ejszakaVan && document.body.classList.contains('erintes'));
  }

  function kapcsol() {
    if (!(jatekBe() && getMod() === 'seta')) return;
    lampaBe = !lampaBe;
    lampaKezi = true;
  }
  el('lampaGomb')?.addEventListener('pointerdown', e => { e.preventDefault(); kapcsol(); });

  return {
    frissit, kapcsol,
    sotet: () => k > 0.5,
    extra: () => (k > 0.3 && lampaBe ? { l: 1 } : { l: 0 }),
  };
}
