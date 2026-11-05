// Heti ranglista (közös): a hét legjobb küldetésidői és a legtöbb ölés, mindenkinél ugyanaz.
// Megőrzött (retained) MQTT üzenet a <csatorna>/rang/<év-Whét> témán: {ts, kuldetes: [{id, nev, ido}],
// olesek: [{id, nev, k}]}. Új héten új téma, így hétfőnként magától „nullázódik”. Mindenki a saját
// eredményét fésüli bele, és ha javult, újraküldi.
const TAROL = 'raktar3d.rang';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ido = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ISO hét: 2026-W45
export function hetKulcs(d = new Date(Date.now())) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const nap = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - nap);
  const ev = t.getUTCFullYear(), het = Math.ceil(((t - Date.UTC(ev, 0, 1)) / 86400000 + 1) / 7);
  return `${ev}-W${String(het).padStart(2, '0')}`;
}

export function inditRang({ kozos, jatek }) {
  const el = id => document.getElementById(id);
  const MAX = 10;
  let het = hetKulcs();
  let lista = { ts: 0, kuldetes: [], olesek: [] };
  let sajat = (() => { try { const t = JSON.parse(localStorage.getItem(TAROL)) || {}; return t.het === het ? t : { het }; } catch { return { het }; } })();
  const ment = () => { try { localStorage.setItem(TAROL, JSON.stringify(sajat)); } catch { /* nincs tárhely */ } };
  let elozoK = null, kuldIdo = 0, kell = false;

  function fesul() {
    const id = kozos?.id || 'helyi', nev = kozos?.nev() || 'Én';
    const k = lista.kuldetes.filter(e => e.id !== id), o = lista.olesek.filter(e => e.id !== id);
    const regiK = lista.kuldetes.find(e => e.id === id), regiO = lista.olesek.find(e => e.id === id);
    const legjobb = Math.min(...[sajat.ido, regiK?.ido].filter(Number.isFinite));
    if (Number.isFinite(legjobb)) k.push({ id, nev, ido: legjobb });
    const olesek = Math.max(sajat.k || 0, regiO?.k || 0);
    if (olesek > 0) o.push({ id, nev, k: olesek });
    k.sort((a, b) => a.ido - b.ido); o.sort((a, b) => b.k - a.k);
    return { ts: Math.max(Date.now(), lista.ts + 1), kuldetes: k.slice(0, MAX), olesek: o.slice(0, MAX) };
  }
  function kuld() { kell = true; }
  function fogad(a, tema) {
    if (tema !== `rang/${het}` || !a || !(Number(a.ts) > lista.ts)) return;
    const jo = x => Array.isArray(x) ? x.filter(e => e && typeof e.id === 'string').slice(0, MAX).map(e => ({ id: e.id, nev: String(e.nev || '?').slice(0, 24), ido: Number(e.ido), k: Number(e.k) })) : [];
    lista = { ts: Number(a.ts), kuldetes: jo(a.kuldetes).filter(e => Number.isFinite(e.ido)), olesek: jo(a.olesek).filter(e => Number.isFinite(e.k)) };
    // ha a mi eredményünk jobb annál, ami a listán szerepel (vagy hiányzik), újraküldjük
    const id = kozos?.id, k = lista.kuldetes.find(e => e.id === id), o = lista.olesek.find(e => e.id === id);
    if ((sajat.ido && (!k || sajat.ido < k.ido)) || (sajat.k && (!o || sajat.k > o.k))) kuld();
    rajzol();
  }
  function kuldetes(ms) {
    if (!(ms > 0)) return;
    if (!sajat.ido || ms < sajat.ido) { sajat.ido = Math.round(ms); ment(); kuld(); }
  }
  function rajzol() {
    const d = el('rangLista');
    if (!d) return;
    const en = kozos?.id;
    const tabla = (cim, sorok, ertek) => `<h4>${cim}</h4>` + (sorok.length
      ? `<ol>${sorok.map(s => `<li class="${s.id === en ? 'en' : ''}">${esc(s.nev)}${s.id === en ? ' (te)' : ''} – <b>${ertek(s)}</b></li>`).join('')}</ol>`
      : '<p class="halvany kicsi">Még senki.</p>');
    d.innerHTML = `<p class="halvany kicsi">${het} hét · hétfőn új lista indul</p>`
      + tabla('📋 Leggyorsabb küldetés', lista.kuldetes, s => ido(s.ido)) + tabla('🎯 Legtöbb ölés', lista.olesek, s => s.k);
  }

  function frissit() {
    // új hét: új lista
    const h = hetKulcs();
    if (h !== het) { het = h; lista = { ts: 0, kuldetes: [], olesek: [] }; sajat = { het }; ment(); rajzol(); }
    // ölések: az összesített számláló növekménye ezen a héten
    const k = Number(jatek?.extra?.().k);
    if (Number.isFinite(k)) {
      if (elozoK != null && k > elozoK) { sajat.k = (sajat.k || 0) + (k - elozoK); ment(); kuld(); }
      elozoK = k;
    }
    const t = performance.now();
    if (kell && kozos?.kapcsolodva?.() && t - kuldIdo > 5000) {
      kell = false; kuldIdo = t;
      lista = fesul();
      kozos.kuldR(lista, `rang/${het}`);
      rajzol();
    }
  }
  rajzol();
  // az első kapcsolódás után a megőrzött lista megérkezik; ha nincs, a sajátunkkal indítjuk
  setTimeout(() => { if (sajat.ido || sajat.k) kuld(); }, 6000);
  return { frissit, fogad, kuldetes, het: () => het };
}
