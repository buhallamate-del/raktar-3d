import { hang } from './hang.js';
// Meccsek (config.js: meccs): a gép órája szerint mindenkinél egyszerre induló, percek hosszú
// meccsek, köztük szunetMp szünet. A meccs alatt számoljuk a meccsbeli öléseket és halálokat
// (a pontlista összesítése marad); a végén összesítő tábla: ki ölt a legtöbbet, melyik csapat nyert
// zászlófoglalásban. Új meccsnél a zászlófoglalás pontjai nullázódnak.
const ido = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// getCtf(): a zászlófoglalás (ctf.js), ha van – később jön létre, ezért függvény
export function inditMeccs({ C, jatek, kozos, getCtf, uzenet, getMod }) {
  const K = C.meccs || {};
  if (K.bekapcsolva === false) return null;
  const hossz = Number(K.percek ?? 10) * 60000, szunet = Number(K.szunetMp ?? 15) * 1000, ciklus = hossz + szunet;
  const el = id => document.getElementById(id);
  let index = -1, alap = null, osszesitve = -1, figyelmeztetve = -1;

  function allas() {
    const t = Date.now();
    return { idx: Math.floor(t / ciklus), benne: t % ciklus, szunet: t % ciklus >= hossz };
  }
  const sajat = () => { const e = jatek?.extra() || {}; return { k: Number(e.k) || 0, d: Number(e.d) || 0 }; };
  // meccsbeli ölések/halálok: az összesített számlálók növekménye a meccs kezdete óta
  const meccsbeli = () => { const s = sajat(); return alap ? { mk: Math.max(0, s.k - alap.k), md: Math.max(0, s.d - alap.d) } : { mk: 0, md: 0 }; };

  function osszesit(idx) {
    const ctf = getCtf?.();
    const sorok = [{ nev: kozos?.nev() || 'Én', ...meccsbeli(), cs: ctf?.extra().cs, en: true }];
    for (const t of kozos?.tobbiek.values() || []) {
      const u = t.cel;
      if (u.j && Number(u.mi) === idx) sorok.push({ nev: t.nev, mk: Number(u.mk) || 0, md: Number(u.md) || 0, cs: u.cs });
    }
    sorok.sort((a, b) => b.mk - a.mk || a.md - b.md);
    const p = ctf?.allapot()?.pont || {}, [A, B] = ctf?.csapatok?.() || [];
    let csapatSor = '';
    if (A && (p[A] || p[B])) {
      const nyero = p[A] === p[B] ? null : p[A] > p[B] ? A : B;
      csapatSor = `<p class="meccsCsapat">🚩 Zászlófoglalás: <span style="color:${ctf.szin(A)}">${esc(ctf.csapatNev(A))} ${p[A]}</span> : <span style="color:${ctf.szin(B)}">${p[B]} ${esc(ctf.csapatNev(B))}</span>`
        + (nyero ? ` – a <b style="color:${ctf.szin(nyero)}">${esc(ctf.csapatNev(nyero))}</b> csapat nyert!` : ' – döntetlen') + '</p>';
    }
    const gyoztes = sorok[0]?.mk ? sorok[0] : null;
    el('meccsTablazat').innerHTML = '<tr><th>#</th><th>Név</th><th>🎯 ölés</th><th>☠ halál</th></tr>' + sorok.map((s, i) =>
      `<tr class="${s.en ? 'en' : ''}"><td>${i === 0 && gyoztes ? '🏆' : i + 1}</td><td>${s.cs && ctf?.szin(s.cs) ? `<span style="color:${ctf.szin(s.cs)}">■</span> ` : ''}${esc(s.nev)}${s.en ? ' (te)' : ''}</td><td>${s.mk}</td><td>${s.md}</td></tr>`).join('');
    el('meccsCsapat').innerHTML = csapatSor;
    el('meccsCim').textContent = gyoztes ? `🏆 Meccs vége – a győztes: ${gyoztes.nev}${gyoztes.en ? ' (te)' : ''}` : '🏁 Meccs vége';
    if (gyoztes) uzenet(`🏆 A meccs győztese: ${gyoztes.nev} (${gyoztes.mk} ölés)`);
  }

  function frissit() {
    const ctf = getCtf?.();
    const a = allas(), jatszik = jatek?.jatekBe?.();
    // új meccs (vagy most csatlakoztunk): az alap a mostani állás
    if (a.idx !== index) {
      const elso = index < 0;
      index = a.idx; alap = sajat(); osszesitve = -1;
      if (!elso && jatszik) {
        uzenet(`⏱ Új meccs indult (${Math.round(hossz / 60000)} perc)!`);
        hang('kurt');
        ctf?.nullaz?.('🚩 Új meccs: a zászlófoglalás pontjai nullázva');
      }
    }
    if (a.szunet && osszesitve !== a.idx && jatszik) { osszesitve = a.idx; osszesit(a.idx); hang('kurt'); }
    const vege = a.szunet && jatszik && osszesitve === a.idx;
    el('meccsVege').hidden = !vege;
    if (vege) el('meccsKovetkezo').textContent = `A következő meccs ${ido(ciklus - a.benne)} múlva indul…`;
    const hatra = hossz - a.benne;
    if (!a.szunet && hatra < 60000 && figyelmeztetve !== a.idx && jatszik) { figyelmeztetve = a.idx; uzenet('⏱ Még 1 perc a meccsből!'); }
    const kij = el('meccsHud');
    kij.hidden = !(jatszik && getMod() === 'seta');
    if (!kij.hidden) {
      const m = meccsbeli();
      kij.textContent = a.szunet ? `⏸ Szünet · ${ido(ciklus - a.benne)}` : `⏱ Meccs ${ido(hatra)} · 🎯 ${m.mk} · ☠ ${m.md}`;
      kij.classList.toggle('vege', !a.szunet && hatra < 60000);
    }
  }

  return { frissit, extra: () => (jatek?.jatekBe?.() ? { mi: index, ...meccsbeli() } : {}) };
}
