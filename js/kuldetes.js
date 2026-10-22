// Küldetés (config.js: kuldetes): komissiózás időre. N (vagy a menü gombja) = új küldetés: a gép
// kioszt néhány tárhelykódot, ezeket sorban fel kell keresni („kiszedni”), majd a komissiózó
// lerakóba vinni. A kijelző mutatja a következő helyet, a távolságot és az irányt; a célt fénycsík
// jelöli. A legjobb idő ezen a gépen megmarad; a teljesítést a többiek is látják.
import * as THREE from 'three';
import { helyElotti } from './modell.js';

const TAROL = 'raktar3d.kuldetes';
const betolt = () => { try { return JSON.parse(localStorage.getItem(TAROL)) || {}; } catch { return {}; } };
const ment = a => { try { localStorage.setItem(TAROL, JSON.stringify(a)); } catch { /* nincs tárhely */ } };
const ido = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// jutalom(): a teljesítés jutalma (a játék adja: katana, ha már van, teljes életerő)
export function inditKuldetes({ C, M, scene, camera, seta, getMod, uzenet, kozos, szovegSprite, lerako, jutalom }) {
  const K = C.kuldetes || {};
  const db = Math.max(1, Math.round(Number(K.db ?? 3))), sugar = Number(K.celSugar ?? 1.5), lerakoSugar = Number(K.lerakoSugar ?? 2.5);
  const el = id => document.getElementById(id);
  const tar = betolt();
  let k = null; // {celok: [{h, p}], idx, indult}

  // jelölő: fénycsík a cél fölött és a kód (a falon át is látszik – ez az iránytű része)
  const csik = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: '#3ddc5a', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  csik.material.userData.vilagit = true;
  csik.visible = false;
  scene.add(csik);
  let felirat = null;
  function jelol(x, y, szoveg, szin) {
    csik.position.set(x, 3.5, y);
    csik.material.color.set(szin);
    csik.visible = true;
    if (felirat) { scene.remove(felirat); felirat.material.map?.dispose(); }
    felirat = szovegSprite(szoveg, 0.45, { hatter: szin, szin: '#fff', meret: 48, depthTest: false });
    felirat.material.userData.vilagit = true;
    felirat.position.set(x, 4.2, y);
    scene.add(felirat);
  }
  function jelolKi() { csik.visible = false; if (felirat) { scene.remove(felirat); felirat = null; } }

  // a kézben vitt dobozok (ahány helyet már kiszedtünk)
  if (!camera.parent) scene.add(camera);
  const dobozok = new THREE.Group();
  for (let i = 0; i < db; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.2), new THREE.MeshLambertMaterial({ color: i % 2 ? '#b98a5a' : '#a77a4c' }));
    d.position.set(0, i * 0.165, 0); d.visible = false; dobozok.add(d);
  }
  dobozok.position.set(-0.3, -0.4, -0.62);
  dobozok.scale.setScalar(0.7);
  camera.add(dobozok);

  function uj() {
    if (k) { k = null; jelolKi(); uzenet('Küldetés feladva'); return; }
    if (getMod() !== 'seta') { uzenet('A küldetéshez válts belső nézetre (V)'); return; }
    // véletlen helyek, különböző sorokból, egymástól és a lerakótól is távolabb
    const jok = M.helyek.filter(h => h.kod && !h.jeloletlen && Number.isFinite(h.x));
    const celok = [];
    for (let proba = 0; proba < 500 && celok.length < db; proba++) {
      const h = jok[Math.floor(Math.random() * jok.length)];
      if (celok.some(c => c.h.zona === h.zona && c.h.sor === h.sor)) continue;
      if (Math.hypot(h.x - lerako.x, h.y - lerako.y) < 6) continue;
      celok.push({ h, p: helyElotti(M, h, C) });
    }
    if (!celok.length) return;
    k = { celok, idx: 0, indult: performance.now() };
    kovetkezo();
    uzenet(`📋 Új küldetés: szedd ki ${celok.map(c => c.h.kod).join(', ')} – aztán vidd a komissiózó lerakóba!`);
  }
  function kovetkezo() {
    if (k.idx < k.celok.length) { const c = k.celok[k.idx]; jelol(c.h.x, c.h.y, c.h.kod, '#2e9d4a'); }
    else jelol(lerako.x, lerako.y, 'LERAKÓ', '#1f6feb');
  }
  function kesz() {
    const t = performance.now() - k.indult;
    const rekord = !tar.legjobb || t < tar.legjobb;
    if (rekord) tar.legjobb = Math.round(t);
    tar.db = (tar.db || 0) + 1;
    ment(tar);
    uzenet(`🏁 Küldetés teljesítve ${ido(t)} alatt!${rekord ? ' 🏆 Új egyéni rekord!' : ` (legjobb: ${ido(tar.legjobb)})`}`);
    kozos?.kuldE({ t: 'kuldetes', nev: kozos.nev(), ido: Math.round(t), db: k.celok.length });
    k = null;
    jelolKi();
    allapotKiir();
    setTimeout(() => jutalom?.(), 1800); // a gratuláció után
  }
  function allapotKiir() {
    if (el('kuldetesInfo')) el('kuldetesInfo').textContent = tar.db ? `Teljesítve: ${tar.db} · legjobb idő: ${ido(tar.legjobb)}` : 'Még nem teljesítettél küldetést.';
    if (el('kuldetesGomb')) el('kuldetesGomb').textContent = k ? 'Küldetés feladása' : 'Új küldetés (N)';
  }
  el('kuldetesGomb')?.addEventListener('click', () => { uj(); allapotKiir(); });
  allapotKiir();

  function frissit() {
    const kij = el('kuldetesHud');
    for (let i = 0; i < dobozok.children.length; i++) dobozok.children[i].visible = !!k && i < k.idx && getMod() === 'seta' && !seta.halott && !seta.kocsin;
    if (!k) { if (kij) kij.hidden = true; return; }
    const lerakni = k.idx >= k.celok.length;
    const cel = lerakni ? lerako : k.celok[k.idx].p;
    const dx = cel.x - seta.x, dy = cel.y - seta.y, d = Math.hypot(dx, dy);
    if (getMod() === 'seta' && !seta.halott) {
      if (!lerakni && d < sugar && seta.z < 1.5) {
        k.idx++;
        uzenet(`✔ ${k.celok[k.idx - 1].h.kod} kiszedve (${k.idx}/${k.celok.length})${k.idx >= k.celok.length ? ' – irány a komissiózó lerakó!' : ''}`);
        kovetkezo();
        return; // a kijelző a következő képkockán már az új célt mutatja
      } else if (lerakni && d < lerakoSugar && seta.z < 1.5) { kesz(); return; }
    }
    if (kij) {
      kij.hidden = getMod() !== 'seta';
      // irány: a nyíl a nézési irányhoz képest mutatja a célt (felfelé = előre)
      const rel = Math.atan2(-dx, -dy) - seta.yaw;
      const nev = lerakni ? 'komissiózó lerakó' : k.celok[k.idx].h.kod;
      const s = `📋 ${Math.min(k.idx, k.celok.length)}/${k.celok.length} · ${lerakni ? 'Leadás' : 'Következő'}: <b>${nev}</b> · ${Math.round(d)} m `
        + `<span class="nyil" style="transform: rotate(${(-rel).toFixed(2)}rad)">⬆</span> · ⏱ ${ido(performance.now() - k.indult)}`;
      if (kij.innerHTML !== s) kij.innerHTML = s;
    }
  }

  function esemeny(e) {
    if (e.t !== 'kuldetes' || !Number.isFinite(+e.ido)) return;
    uzenet(`🏁 ${String(e.nev || 'Valaki').slice(0, 24)} teljesített egy küldetést ${ido(+e.ido)} alatt`);
  }

  return { frissit, uj: () => { uj(); allapotKiir(); }, esemeny, aktiv: () => !!k, allapot: () => k };
}
