// Lidérc (config.js: liderc): éjszaka a pohármosóban születik, és végiglebeg a raktár összes
// folyosóján; ha a végére ér, visszaindul. Akihez hozzáér, az meghal. A helye a gép órájából és
// az éjszaka kezdetéből számolódik, így mindenkinél ugyanott jár (mint a targoncák).
import * as THREE from 'three';

// lebegő alak: szakadt lepel, sápadt fej, hosszú ősz haj, előrenyújtott karok, világító szemek
function lidercModell() {
  const g = new THREE.Group();
  const lepelAnyag = new THREE.MeshLambertMaterial({ color: '#d9dde3', emissive: '#2a3038', transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  const lepel = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.7, 18, 4, true), lepelAnyag);
  // a lepel alja cikcakkos, szakadt
  const pos = lepel.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < -0.8) pos.setY(i, pos.getY(i) + (i % 2 ? 0.18 : -0.05));
  }
  lepel.geometry.computeVertexNormals();
  lepel.position.y = 1.05;
  const fej = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshLambertMaterial({ color: '#e8e4da', emissive: '#262420' }));
  fej.position.y = 2.0; fej.scale.set(0.9, 1.15, 0.95);
  // szemek: világítanak (éjszaka sem sötétülnek el)
  const szemAnyag = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
  szemAnyag.userData.vilagit = true;
  const szemek = [-0.06, 0.06].map(x => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), szemAnyag); s.position.set(x, 2.03, -0.15); return s; });
  const fenyCsik = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshBasicMaterial({ color: '#ff3a20', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  fenyCsik.material.userData.vilagit = true;
  fenyCsik.scale.set(1.8, 0.7, 0.5); fenyCsik.position.set(0, 2.03, -0.14);
  // hosszú ősz haj: a fej tetejéről és hátuljáról lelógó tincsek, a hát közepéig
  const hajAnyag = new THREE.MeshLambertMaterial({ color: '#c8c8c4', emissive: '#1e1e1c' });
  const tincsek = [];
  for (let i = 0; i < 22; i++) {
    const szog = -Math.PI * 0.72 + (i / 21) * Math.PI * 1.44; // hátul és oldalt (+Z), elöl nem: ott az arc
    const hossz = 0.9 + ((i * 37) % 7) * 0.08;
    const t = new THREE.Group();
    const szal = new THREE.Mesh(new THREE.BoxGeometry(0.035, hossz, 0.02), hajAnyag);
    szal.position.y = -hossz / 2;
    t.add(szal);
    t.position.set(Math.sin(szog) * 0.15, 2.12, Math.cos(szog) * 0.15);
    t.rotation.y = -szog;
    t.userData = { alap: 0.12 + 0.1 * Math.abs(Math.cos(szog)), fazis: i };
    g.add(t);
    tincsek.push(t);
  }
  // karok: vékonyak, előrenyújtva
  const karAnyag = new THREE.MeshLambertMaterial({ color: '#d6d2c8', emissive: '#1f1d1a' });
  const karok = [-0.28, 0.28].map(x => {
    const k = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.7, 8), karAnyag);
    m.position.y = -0.35; k.add(m);
    k.position.set(x, 1.65, -0.05); k.rotation.x = -1.25;
    g.add(k); return k;
  });
  g.add(lepel, fej, ...szemek, fenyCsik);
  // vörös derengés a szemek körül (mindig a jelenetben; nappal 0 erővel)
  const feny = new THREE.PointLight('#ff3020', 0, 4, 1.8);
  feny.position.set(0, 2.0, -0.9);
  g.add(feny);
  g.userData = { lepelAnyag, tincsek, karok, feny };
  return g;
}

// Végigjárás: mélységi bejárás a folyosóhálózaton (minden folyosóba bemegy, zsákutcából visszajön),
// a kezdőpont előtt a pohármosóból kivezető szakasszal.
function bejaras(halo, eleje) {
  const { pontok, szom } = halo;
  const tav = (i, p) => Math.hypot(pontok[i][0] - p[0], pontok[i][1] - p[1]);
  const vege = eleje[eleje.length - 1];
  let start = -1;
  pontok.forEach((_, i) => { if (szom[i].length && (start < 0 || tav(i, vege) < tav(start, vege))) start = i; });
  if (start < 0) return eleje;
  const ut = [start], latott = new Set([start]);
  let utolsoUj = 0;
  const lep = u => {
    // a közelebbi szomszéd előbb (determinisztikus)
    const kov = [...szom[u]].sort((a, b) => tav(a, pontok[u]) - tav(b, pontok[u]) || a - b);
    for (const v of kov) {
      if (latott.has(v)) continue;
      latott.add(v); ut.push(v); utolsoUj = ut.length - 1;
      lep(v);
      ut.push(u);
    }
  };
  lep(start);
  return [...eleje, ...ut.slice(0, utolsoUj + 1).map(i => pontok[i])];
}

export function inditLiderc({ C, scene, seta, getMod, ejszaka, targoncak, jatek, uzenet }) {
  const L = C.liderc;
  if (!L || !ejszaka || !targoncak?.halo) return null;
  const seb = Number(L.sebesseg ?? 8);
  const pontok = bejaras(targoncak.halo, L.szuletes || [[7, 99.7], [7, 97.8], [7, 94]]);
  // szakaszok kumulált hosszal
  const szak = [];
  let hossz = 0;
  for (let i = 1; i < pontok.length; i++) {
    const a = pontok[i - 1], b = pontok[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 0.05) continue;
    szak.push({ a, b, s0: hossz, l });
    hossz += l;
  }
  const g = lidercModell();
  g.visible = false;
  scene.add(g);
  let irany = 0, volt = false, erintesIdo = 0;

  // hol jár s méterrel a születése után: oda-vissza a bejárás mentén
  function hely(s) {
    const k = s % (2 * hossz), vissza = k > hossz, d = vissza ? 2 * hossz - k : k;
    let lo = 0, hi = szak.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (szak[m].s0 + szak[m].l < d) lo = m + 1; else hi = m; }
    const sz = szak[lo], u = Math.min(1, Math.max(0, (d - sz.s0) / sz.l));
    const fx = (sz.b[0] - sz.a[0]) / sz.l * (vissza ? -1 : 1), fy = (sz.b[1] - sz.a[1]) / sz.l * (vissza ? -1 : 1);
    return { x: sz.a[0] + (sz.b[0] - sz.a[0]) * u, y: sz.a[1] + (sz.b[1] - sz.a[1]) * u, fx, fy };
  }

  function frissit(dt) {
    const eltelt = ejszaka.ejjelEltelt(), k = ejszaka.k();
    const lathato = eltelt != null && k > 0.05 && szak.length > 0;
    g.visible = lathato;
    if (!lathato) { volt = false; g.userData.feny.intensity = 0; return; }
    if (!volt) { volt = true; if (eltelt < 20000) uzenet('👻 Leszállt az éj – a lidérc kiszabadult a pohármosóból! Ne érjen hozzád!'); }
    const t = performance.now();
    const h = hely(Math.max(0, eltelt) / 1000 * seb);
    const cel = Math.atan2(-h.fx, -h.fy);
    let d = cel - irany; d = Math.atan2(Math.sin(d), Math.cos(d));
    irany += d * Math.min(1, dt * 5);
    const lebeg = 0.35 + 0.12 * Math.sin(t / 420);
    g.position.set(h.x, lebeg, h.y);
    g.rotation.y = irany;
    g.rotation.z = 0.05 * Math.sin(t / 700);
    // a haj és a karok lengenek; a lepel kicsit átlátszóbb, ha még csak most sötétedik
    for (const tc of g.userData.tincsek) tc.rotation.x = tc.userData.alap + 0.08 * Math.sin(t / 300 + tc.userData.fazis);
    g.userData.karok.forEach((kar, i) => { kar.rotation.x = -1.25 + 0.12 * Math.sin(t / 380 + i * 2); });
    g.userData.lepelAnyag.opacity = 0.82 * Math.min(1, k * 1.2);
    g.userData.feny.intensity = 1.2 * k;
    // érintés: aki hozzáér (a lepel alaprajzán belül, a lebegő test magasságában), meghal
    if (getMod() !== 'seta' || seta.halott || !jatek?.jatekBe?.() || t - erintesIdo < 2000) return;
    const test = seta.guggol ? 1.0 : 1.8;
    if (Math.hypot(seta.x - h.x, seta.y - h.y) < Number(L.erintesSugar ?? 0.75) && seta.z < lebeg + 2.2 && seta.z + test > lebeg) {
      erintesIdo = t;
      jatek.liderc?.();
    }
  }

  return { frissit, hossz, g };
}
