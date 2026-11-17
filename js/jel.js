// A jel (a multiverzum története): éjjel, játék közben az egyik tárhely címkéje Morse-jelet villog – ·− −·· −·· = ADD.
// Ez a raktár töredéke a Jeltörő üzenetéből („Ne add fel, megéri”). Aki közel megy és megnézi, annak a közös naplóba
// bekerül (r3:jel), és a Jeltörőben a raktár adása tisztán szól. A menüben a Multiverzum rész a többi játékot mutatja.
// Munkához használva (kikapcsolt játéknál, nappal, felülnézetből) semmi sem látszik.
import * as THREE from 'three';
import { univ } from './feketelyuk.js';

const MORSE = { A: '.-', D: '-..' };
// a villogás menetrendje: [hossz egységben, világít-e]
function menet(szo) {
  const m = [];
  for (const c of szo) { for (const j of MORSE[c]) { m.push([j === '.' ? 1 : 3, true], [1, false]); } m.push([2, false]); }
  m.push([7, false]);
  return m;
}

export function inditJel({ C, M, scene, seta, getMod, jatekBe, ejszaka, uzenet }) {
  if (C.jel?.be === false) return null;
  // a 976. hely – ahány tárhely a raktárban van; ha nincs annyi, egy földszinti címke a lista közepéről
  const jok = M.helyek.filter(h => h.kod && h.cimkeY <= 1.7 && Number.isFinite(h.nx));
  if (!jok.length) return null;
  const h = jok[976 % jok.length];
  const g = new THREE.Group();
  const lap = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.14), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.95, depthWrite: false }));
  lap.material.userData.vilagit = true;
  const feny = new THREE.PointLight('#ffcf6a', 0, 4.5, 1.6);
  feny.position.z = 0.25;
  g.add(lap, feny);
  const elo = Number(h.h || 0) + 0.03;
  g.position.set(h.x + h.nx * elo, h.cimkeY, h.y + h.ny * elo);
  g.lookAt(h.x + h.nx * (elo + 1), h.cimkeY, h.y + h.ny * (elo + 1));
  g.visible = false;
  scene.add(g);
  const M0 = menet('ADD'), egyseg = 0.28, hossz = M0.reduce((a, x) => a + x[0], 0) * egyseg;
  let latta = univ.has('r3:jel'), uzent = false;

  function frissit() {
    const aktiv = getMod() === 'seta' && jatekBe() && !!ejszaka?.sotet?.() && !seta.halott;
    g.visible = aktiv;
    if (!aktiv) { feny.intensity = 0; return; }
    let t = (performance.now() / 1000) % hossz, be = false;
    for (const [n, v] of M0) { const d = n * egyseg; if (t < d) { be = v; break; } t -= d; }
    lap.material.opacity = be ? 0.95 : 0.12;
    feny.intensity = be ? 2.2 : 0;
    const tav = Math.hypot(seta.x - g.position.x, seta.y - g.position.z);
    if (tav < 3.2 && !uzent) {
      uzent = true;
      const uj = univ.set('r3:jel');
      latta = true;
      uzenet(`📡 A(z) ${h.kod} címkéje villog: rövid–hosszú · hosszú–rövid–rövid · hosszú–rövid–rövid. Morse: ADD.${uj ? ' Valaki egy lehallgatóállomáson ezt hallgatja (menü → Multiverzum).' : ''}`);
    }
    if (tav > 8) uzent = false;
  }
  return { frissit, hely: h, latta: () => latta };
}

// A menü Multiverzum része: a többi játék, ahol már jártál (és egy halk utalás a jelre)
const VILAGOK = [
  ['eh:jart', 'Eseményhorizont', '../Esemenyhorizont/?from=raktar', 'Egy hajó egy fekete lyuk körül – a pohármosó lefolyója oda vezet.'],
  ['lo:jart', 'Kísérleti Lőtér', '../Kiserleti_robbantas/', 'Rakétaprogram 1957-ből.'],
  ['eg:jart', 'Égtorony', '../Egtorony/', 'Egy torony a felhők fölé – a polcsorok is tornyok, csak a targoncák másznak rajtuk.'],
  ['mo:jart', 'Mézország', '../Mezorszag/', 'Kaptárak egy akácos szélén; a mézes üvegek itt kapnak tárhelyet.'],
  ['me:jart', 'Mélység', '../Melyseg/', 'Fúrás a Föld közepe felé.'],
  ['jt:jart', 'Jeltörő', '../Jel-toro/', 'Egy lehallgatóállomás. Az egyik adása ebből a raktárból jön.'],
  ['tt:jart', 'Toldaléktorony', '../Toldalektorony/', 'Minden tárhelykód egy kis torony: sor, állvány, szint, hely.'],
];
export function multiverzumMenu(el) {
  if (!el) return;
  const n = univ.get(), jart = VILAGOK.filter(v => n[v[0]]);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let h = '<p class="halvany kicsi">A szerző többi játékával közös naplót vezet a raktár: ami az egyikben történik, a többi is tudja.</p>';
  h += jart.length ? jart.map(v => `<p class="kicsi"><a href="${v[2]}">${esc(v[1])} ↗</a> – <span class="halvany">${esc(v[3])}</span></p>`).join('')
    : '<p class="halvany kicsi">Még egyikben sem jártál. A pohármosó ajtajában – játék közben – van egy kapu.</p>';
  if (n['jt:jart'] && !n['r3:jel']) h += '<p class="kicsi">📡 A Jeltörő szerint éjjel, játék közben az egyik tárhelycímke furcsán villog.</p>';
  if (n['r3:jel']) h += '<p class="kicsi">📡 A villogó címkét megtaláltad: a raktár adása a Jeltörőben tisztán szól.</p>';
  el.innerHTML = h;
  // ha az Eseményhorizont buborékjában futunk, az oda vezető link nem tölt be újra mindent, csak visszaszól
  el.onclick = e => {
    const a = e.target.closest?.('a[href*="Esemenyhorizont"]');
    let beagy = false; try { beagy = window.parent !== window && window.parent.location.origin === location.origin; } catch (_) { /* idegen szülő */ }
    if (a && beagy) { e.preventDefault(); window.parent.postMessage({ type: 'univ-vissza', from: 'raktar' }, location.origin); }
  };
}
