// Beállítások (menü → Beállítások): egérérzékenység, látószög (FOV) és a billentyűk átállítása.
// Ezen a gépen megmaradnak. Az átállítás egy fordítóréteg: a lenyomott billentyűt arra a gyári
// billentyűre fordítjuk, amelyhez a kiválasztott művelet tartozik (így a kód többi része a gyári
// kiosztással dolgozik).
const TAROL = 'raktar3d.beallitas';

// a gyári kiosztás (művelet → billentyűkód)
export const MUVELETEK = [
  ['elore', 'Előre', 'KeyW'], ['hatra', 'Hátra', 'KeyS'], ['balra', 'Balra', 'KeyA'], ['jobbra', 'Jobbra', 'KeyD'],
  ['ugras', 'Ugrás', 'Space'], ['guggol', 'Guggolás', 'KeyC'], ['masz', 'Mászás', 'KeyE'],
  ['lokes', 'Lökés', 'KeyF'], ['dobas', 'Palack', 'KeyG'], ['tolt', 'Újratöltés', 'KeyR'], ['valt', 'Fegyverváltás', 'KeyQ'],
  ['tavcso', 'Távcső', 'KeyZ'], ['granat', 'Gránát', 'KeyT'], ['akna', 'Akna', 'KeyX'],
  ['lampa', 'Zseblámpa', 'KeyL'], ['kocsi', 'Jármű fel/le', 'KeyK'], ['kuldetes', 'Küldetés', 'KeyN'],
  ['minimap', 'Minitérkép', 'KeyM'], ['nezo', 'Nézőmód', 'KeyB'], ['integet', 'Integetés', 'KeyH'], ['nezet', 'Nézetváltás', 'KeyV'],
];
const GYARI = Object.fromEntries(MUVELETEK.map(([id, , k]) => [id, k]));

const betolt = () => { try { return JSON.parse(localStorage.getItem(TAROL)) || {}; } catch { return {}; } };
const b = betolt();
export const beallitas = {
  erzek: Number(b.erzek) || 1,      // az egérérzékenység szorzója
  fov: Number(b.fov) || 55,         // látószög fokban
  bill: { ...GYARI, ...(b.bill || {}) },
};
const ment = () => { try { localStorage.setItem(TAROL, JSON.stringify({ erzek: beallitas.erzek, fov: beallitas.fov, bill: beallitas.bill })); } catch { /* nincs tárhely */ } };

// fordítótábla: lenyomott kód → gyári kód (null: a gyári billentyű foglalt lett, nem csinál semmit)
let fordito = {};
function forditoEpit() {
  fordito = {};
  const hasznalt = new Set(Object.values(beallitas.bill));
  for (const [id, k] of Object.entries(GYARI)) if (!hasznalt.has(k)) fordito[k] = null;
  for (const [id, k] of Object.entries(beallitas.bill)) if (GYARI[id]) fordito[k] = GYARI[id];
}
forditoEpit();
export const fordit = kod => (kod in fordito ? fordito[kod] : kod);
export const billNev = kod => String(kod || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'Szóköz').replace(/^Arrow/, '↑ ').replace('ShiftLeft', 'Shift');

// a menü „Beállítások” része; valtozott(): a látószög / érzékenység változott
export function beallitasMenu({ valtozott }) {
  const el = id => document.getElementById(id);
  const erz = el('beErzek'), fov = el('beFov');
  if (!erz) return;
  const kiir = () => {
    el('beErzekErtek').textContent = `${beallitas.erzek.toFixed(1)}×`;
    el('beFovErtek').textContent = `${Math.round(beallitas.fov)}°`;
  };
  erz.value = beallitas.erzek; fov.value = beallitas.fov; kiir();
  erz.addEventListener('input', () => { beallitas.erzek = Number(erz.value); kiir(); ment(); valtozott?.(); });
  fov.addEventListener('input', () => { beallitas.fov = Number(fov.value); kiir(); ment(); valtozott?.(); });
  let var_ = null; // melyik művelethez várunk billentyűt
  const lista = el('beBillentyuk');
  const rajzol = () => {
    lista.innerHTML = MUVELETEK.map(([id, nev]) => `<li><span>${nev}</span><button class="masodlagos billGomb" data-id="${id}">${var_ === id ? 'nyomj egy billentyűt…' : billNev(beallitas.bill[id])}</button></li>`).join('');
  };
  lista.addEventListener('click', e => {
    const g = e.target.closest?.('button[data-id]');
    if (!g) return;
    var_ = g.dataset.id; rajzol();
  });
  addEventListener('keydown', e => {
    if (!var_) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code !== 'Escape') {
      // ha a billentyű már egy másik műveleté, a kettő helyet cserél
      const masik = Object.keys(beallitas.bill).find(id => beallitas.bill[id] === e.code && id !== var_);
      if (masik) beallitas.bill[masik] = beallitas.bill[var_];
      beallitas.bill[var_] = e.code;
      forditoEpit(); ment();
    }
    var_ = null; rajzol();
  }, true);
  el('beAlap').addEventListener('click', () => {
    beallitas.erzek = 1; beallitas.fov = 55; beallitas.bill = { ...GYARI };
    erz.value = 1; fov.value = 55; kiir(); forditoEpit(); ment(); rajzol(); valtozott?.();
  });
  rajzol();
}
