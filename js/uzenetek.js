// Gyors üzenetek és integetés: 6–9 = „Ide!”, „Segítség!”, „Vigyázz, lidérc!”, „Köszi!”; H = integetés.
// A többiek a pálcikaemberünk feje fölött szövegbuborékban látják (és a felugró üzenetek között is);
// az integetésnél a jobb kezét emeli. Telefonon a 💬 gomb nyitja.
import { hang } from './hang.js';

export const GYORS = ['📍 Ide!', '🆘 Segítség!', '👻 Vigyázz, lidérc!', '👍 Köszi!'];

// nezoValt(): a nézőmód ki/be (telefonon a panel utolsó gombja)
export function inditUzenetek({ kozos, uzenet, getMod, nezoValt }) {
  const el = id => document.getElementById(id);
  let utolso = 0;
  const szabad = () => { const t = performance.now(); if (t - utolso < 1200) return false; utolso = t; return true; };
  function kuld(i) {
    if (!GYORS[i] || getMod() !== 'seta' || !szabad()) return;
    kozos?.kuldE({ t: 'uzi', s: i, nev: kozos.nev() });
    uzenet(`💬 Te: ${GYORS[i]}`);
    hang('jel');
  }
  function integet() {
    if (getMod() !== 'seta' || !szabad()) return;
    kozos?.kuldE({ t: 'integ', nev: kozos.nev() });
    uzenet('👋 Integetsz a többieknek');
  }
  function esemeny(e) {
    const v = kozos?.tobbiek.get(e.tol);
    const hol = v ? { x: v.g.position.x, y: v.g.position.y + 1.6, z: v.g.position.z } : null;
    if (e.t === 'uzi' && GYORS[Number(e.s)]) {
      kozos.buborek(e.tol, GYORS[Number(e.s)]);
      uzenet(`💬 ${String(e.nev || v?.nev || 'Valaki').slice(0, 24)}: ${GYORS[Number(e.s)]}`);
      hang('jel', hol);
    } else if (e.t === 'integ') kozos.integet(e.tol);
  }
  // telefon: 💬 gomb → kis panel a gyors üzenetekkel
  const panel = el('uziPanel');
  if (panel) {
    panel.innerHTML = [...GYORS.map((s, i) => `<button data-i="${i}">${s}</button>`), '<button data-i="h">👋 Integetés</button>', '<button data-i="n">👁 Nézőmód be/ki</button>'].join('');
    panel.addEventListener('pointerdown', e => {
      const g = e.target.closest?.('button[data-i]');
      if (!g) return;
      e.preventDefault();
      if (g.dataset.i === 'h') integet(); else if (g.dataset.i === 'n') nezoValt?.(); else kuld(Number(g.dataset.i));
      panel.hidden = true;
    });
    el('uziGomb')?.addEventListener('pointerdown', e => { e.preventDefault(); panel.hidden = !panel.hidden; });
  }
  function frissit() {
    if (el('uziGomb')) el('uziGomb').hidden = !(getMod() === 'seta' && document.body.classList.contains('erintes'));
    if (panel && getMod() !== 'seta') panel.hidden = true;
  }
  return { kuld, integet, esemeny, frissit };
}
