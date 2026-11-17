// Fekete lyuk a pohármosó ajtajában (easter egg): kapu az Eseményhorizontba, a szerző másik játékába.
// Csak séta közben és bekapcsolt játéknál látszik (menü → Játék), a munkához használt nézeteket nem érinti. Aki belesétál, átlép.
import * as THREE from 'three';

// Közös napló a három játék között (Eseményhorizont, Kísérleti Lőtér, Raktár 3D). Mindhárom ugyanazon a webcímen fut
// (buhallamate-del.github.io), ezért a böngésző tárhelye közös: amit az egyikben elérsz, a másik is látja.
const UNIV_KEY = 'univerzum-naplo';
export const univ = {
  get(){ try{ return JSON.parse(localStorage.getItem(UNIV_KEY)) || {}; }catch(_){ return {}; } },
  has(k){ return !!this.get()[k]; },
  set(k){ const n = this.get(); if (n[k]) return false; n[k] = Date.now(); try{ localStorage.setItem(UNIV_KEY, JSON.stringify(n)); }catch(_){} return true; },
};
// ha egy másik játékon belül futunk (az Eseményhorizont buborékjában), a kapu nem tölt be újra mindent, hanem visszaszól
function univBeagyazva(){ try{ return window.parent !== window && window.parent.location.origin === location.origin; }catch(_){ return false; } }

export function inditFeketeLyuk({ C, scene, seta, getMod, uzenet, jatekBe = () => true }) {
  const F = C.feketeLyuk || {};
  if (F.be === false) return null;
  const hely = F.hely || { x: 7.0, y: 98.9 }, z0 = F.magassag ?? 1.15;
  univ.set('r3:jart');
  const g = new THREE.Group();
  // az árnyék: fekete gömb, körülötte izzó korong és halvány fénygyűrű (mint egy apró Gargantua)
  const arnyek = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: '#000000' }));
  const korongAnyag = new THREE.MeshBasicMaterial({ color: '#ffb46a', transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  korongAnyag.userData.vilagit = true;
  const korong = new THREE.Mesh(new THREE.RingGeometry(0.21, 0.5, 48, 1), korongAnyag);
  korong.rotation.x = -Math.PI / 2 + 0.18;
  const gyuruAnyag = new THREE.MeshBasicMaterial({ color: '#ffe0b0', transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  gyuruAnyag.userData.vilagit = true;
  const gyuru = new THREE.Mesh(new THREE.RingGeometry(0.165, 0.19, 48, 1), gyuruAnyag);
  const feny = new THREE.PointLight('#ff9a50', 0.8, 3.5, 2);
  g.add(arnyek, korong, gyuru, feny);
  g.position.set(hely.x, z0, hely.y);
  g.visible = false;
  scene.add(g);
  let szolt = false, tippVolt = false, atlep = false;

  function atlepes() {
    if (atlep) return; atlep = true; univ.set('r3:feketelyuk');
    if (univBeagyazva()) { window.parent.postMessage({ type: 'univ-vissza', from: 'raktar' }, location.origin); setTimeout(() => (atlep = false), 3000); return; }
    const f = document.createElement('div');
    f.style.cssText = 'position:fixed;inset:0;z-index:99999;background:radial-gradient(circle,#000 0%,#000 30%,#1a0f2e 70%,#000 100%);opacity:0;transition:opacity 1.2s;pointer-events:none';
    document.body.appendChild(f); requestAnimationFrame(() => (f.style.opacity = '1'));
    uzenet('🕳️ Átlépsz…');
    setTimeout(() => { location.href = '../Esemenyhorizont/?from=raktar'; }, 1300);
  }

  function frissit(dt) {
    // csak séta közben és bekapcsolt játéknál: a munkához használt bejárást nem zavarja
    const seta_ = getMod() === 'seta' && jatekBe();
    g.visible = seta_;
    if (!seta_) return;
    // ha egy másik univerzumban már megtaláltad a raktár buborékját, a raktár „emlékszik” rád
    if (!tippVolt && univ.has('eh:egg:raktar')) { tippVolt = true; uzenet('🌀 Egy másik univerzumban már jártál itt… A pohármosó ajtajában valami befelé húz.'); }
    const t = performance.now();
    korong.rotation.z = t / 900;
    gyuru.lookAt(seta.x, seta.z + 1.6, seta.y); // a fénygyűrű mindig felénk néz, a korong vízszintes marad
    feny.intensity = 0.7 + 0.25 * Math.sin(t / 300);
    const d = Math.hypot(seta.x - hely.x, seta.y - hely.y);
    if (d < 3 && !szolt) { szolt = true; uzenet('🕳️ A pohármosó ajtajában egy apró fekete lyuk lebeg. Ha belesétálsz, átlépsz egy másik univerzumba.'); }
    if (d > 5) szolt = false;
    if (d < 0.55) atlepes();
  }
  return { frissit, g, atlepes };
}
