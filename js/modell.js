// A táblázat adataiból (window.RAKTAR_ADATOK) és a konfigurációból
// (window.RAKTAR_CONFIG) kiszámolja az állványok méretét, irányát, a folyosókat,
// az ütközőket és a feltételezések helyét. Nem függ a Three.js-től.

const EPS = 0.08; // ennyin belül két koordináta „egy vonalban” van (m)

export function zonaFo(zona) {
  return String(zona).split(' ')[0];
}

export function normalKod(s) {
  return String(s).toUpperCase().replace(/[^0-9A-ZÁÉÍÓÖŐÚÜŰ]/g, '');
}

function ertekLanc(...ertekek) {
  for (const v of ertekek) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
}

export function folyosoSzelesseg(C, id) {
  return Number(ertekLanc(C.folyosoSzelessegek?.[id], C.folyosoSzelesseg, 2.6));
}

// A felső szárny (FELSŐ) eltolása Y irányban a config.js felsoSzarnyEltolasY értékével.
// A szárnyon belüli távolságok nem változnak, csak a kapu → kiindulópont szakasz,
// ezért a „Táv a kiindulóponttól” értéket ennyivel korrigáljuk.
function felsoSzarnyEltolas(D, C, figyelmeztetesek) {
  let dy = Number(C.felsoSzarnyEltolasY || 0);
  const k = D.kulcsok;
  if (dy && Math.abs(k.alsoSavY - k.t1FejY) < 0.05) {
    figyelmeztetesek.push('A felső szárny alsó sávja az adatokban már a T1 fejfolyosó vonalában van – a felsoSzarnyEltolasY-t nem alkalmaztuk (állítsd 0-ra a config.js-ben).');
    dy = 0;
  }
  if (!dy) return { ...D, eltolasY: 0 };
  const folyosok = D.folyosok.map(f => {
    if (f.szarny !== 'FELSŐ') return f;
    return f.tengely === 'Y'
      ? { ...f, e: f.e == null ? f.e : +(f.e + dy).toFixed(4) }
      : { ...f, c: f.c == null ? f.c : +(f.c + dy).toFixed(4) };
  });
  const tengely = new Map(D.folyosok.map(f => [f.id, f.tengely]));
  const atjaro = { x: k.atjaro.x, y: +(k.atjaro.y + dy).toFixed(4) };
  const kapuRegi = D.szarnyak.find(s => s.szarny === 'FELSŐ')?.kapuTav;
  const kapuUj = Math.abs(k.kiindulo.x - atjaro.x) + Math.abs(k.kiindulo.y - atjaro.y);
  const helyek = D.helyek.map(h => {
    if (h.szarny !== 'FELSŐ') return h;
    const fy = tengely.get(h.folyoso) === 'Y';
    return {
      ...h,
      y: +(h.y + dy).toFixed(4),
      pozicio: fy && h.pozicio != null ? +(h.pozicio + dy).toFixed(4) : h.pozicio,
      folyosoveg: fy && h.folyosoveg != null ? +(h.folyosoveg + dy).toFixed(4) : h.folyosoveg,
      tavExcel: h.tav,
      tav: kapuRegi != null && h.tav != null ? +(h.tav - kapuRegi + kapuUj).toFixed(2) : h.tav,
    };
  });
  return {
    ...D, helyek, folyosok, eltolasY: dy,
    kulcsok: { ...k, atjaro, alsoSavY: +(k.alsoSavY + dy).toFixed(4) },
  };
}

export function epitModell(D0, C) {
  const figyelmeztetesek = [];
  const D = felsoSzarnyEltolas(D0, C, figyelmeztetesek);
  const folyosok = new Map();
  for (const f of D.folyosok) {
    folyosok.set(f.id, { ...f, szel: folyosoSzelesseg(C, f.id), helyek: [] });
  }

  const helyek = D.helyek.map((h, i) => ({ ...h, i, zonaFo: zonaFo(h.zona) }));
  for (const h of helyek) {
    const f = folyosok.get(h.folyoso);
    if (!f) figyelmeztetesek.push(`${h.kod}: ismeretlen folyosó „${h.folyoso}”`);
    else f.helyek.push(h);
  }

  // --- Folyosók kiterjedése a saját tengelyük mentén --------------------
  // tengely 'X': a folyosó X irányban fut, a helye Y = c; 'Y': fordítva.
  const kapu = {
    T1: { x: D.kulcsok.t1KeresztX, y: D.kulcsok.t1FejY },
    'FELSŐ': { x: D.kulcsok.atjaro.x, y: D.kulcsok.atjaro.y },
  };
  for (const f of folyosok.values()) {
    const ertekek = f.helyek.map(h => (f.tengely === 'X' ? h.x : h.y));
    if (f.tipus === 'gerinc') {
      // a gerincen a szárny többi folyosója és a kapu is rajta van
      for (const g of folyosok.values()) {
        if (g !== f && g.szarny === f.szarny && g.tipus !== 'gerinc' && g.c != null) ertekek.push(g.c);
      }
      const k = kapu[f.szarny];
      if (k) ertekek.push(f.tengely === 'X' ? k.x : k.y);
    } else if (f.e != null) {
      ertekek.push(f.e);
    }
    f.min = Math.min(...ertekek);
    f.max = Math.max(...ertekek);
    f.mid = (f.min + f.max) / 2;
  }

  // --- Sorok: futásirány és tárhely-szélesség --------------------------
  const csoportok = new Map();
  for (const h of helyek) {
    const k = `${h.zona}|${h.sor}`;
    if (!csoportok.has(k)) csoportok.set(k, []);
    csoportok.get(k).push(h);
  }
  const maxSzel = Number(C.maxHelySzelesseg ?? 1.4);
  for (const [kulcs, cs] of csoportok) {
    for (const h of cs) {
      let dX = Infinity, dY = Infinity; // legközelebbi szomszéd X ill. Y irányú futásban
      const tavX = [], tavY = [];
      for (const m of cs) {
        if (m === h) continue;
        if (Math.abs(m.y - h.y) < EPS) { const d = Math.abs(m.x - h.x); tavX.push(d); dX = Math.min(dX, d); }
        if (Math.abs(m.x - h.x) < EPS) { const d = Math.abs(m.y - h.y); tavY.push(d); dY = Math.min(dY, d); }
      }
      h.irany = dX <= dY ? 'X' : 'Y';
      let w = Math.min(dX, dY);
      if (!isFinite(w)) { w = 1.0; figyelmeztetesek.push(`${h.kod}: nincs szomszédja a sorban, 1 m szélesnek vettük`); }
      h.w = Math.min(w, maxSzel);
      h.sorKulcs = kulcs;
    }
  }

  // --- Homlokirány (merre néz a folyosó felé) --------------------------
  for (const h of helyek) {
    const f = folyosok.get(h.folyoso);
    let nx = 0, ny = 0;
    if (f) {
      h.parhuzamos = h.irany === f.tengely;
      if (h.parhuzamos) {
        // a sor a folyosóval párhuzamos: a folyosó vonala felé néz
        if (f.tengely === 'X') ny = Math.sign(f.c - h.y) || 1;
        else nx = Math.sign(f.c - h.x) || 1;
      } else {
        // a sor keresztben áll a folyosó végén: a folyosó közepe felé néz
        if (f.tengely === 'Y') ny = Math.sign(f.mid - h.y) || 1;
        else nx = Math.sign(f.mid - h.x) || 1;
      }
    } else {
      ny = 1;
    }
    h.nx = nx; h.ny = ny;
  }

  // --- Magasság, szintek, mélység ---------------------------------------
  const fixMely = typeof C.allvanyMelyseg === 'number' ? C.allvanyMelyseg : null;
  for (const h of helyek) {
    const sor = C.sorok?.[`${h.zona}|${h.sor}`] || {};
    const z = C.zonak?.[h.zona] || {};
    const zf = C.zonak?.[h.zonaFo] || {};
    h.H = Number(ertekLanc(sor.allvanyMagassag, z.allvanyMagassag, zf.allvanyMagassag, C.allvanyMagassag, 5));
    h.L = Math.max(1, Math.round(Number(ertekLanc(sor.szintekSzama, z.szintekSzama, zf.szintekSzama, C.szintekSzama, 4))));
    h.szin = ertekLanc(sor.szin, z.szin, zf.szin, '#888888');
    const melyZ = ertekLanc(sor.allvanyMelyseg, z.allvanyMelyseg, zf.allvanyMelyseg);
    h.fixMely = typeof melyZ === 'number' ? melyZ : fixMely;
  }

  const maxFel = Number(C.maxMelyseg ?? 1.2) / 2;
  const minFel = Number(C.minMelyseg ?? 0.3) / 2;
  for (const h of helyek) {
    if (h.fixMely != null) { h.h = h.fixMely / 2; continue; }
    let fel = maxFel;
    const f = folyosok.get(h.folyoso);
    if (f && h.parhuzamos) {
      const elol = Math.abs(f.c - (f.tengely === 'X' ? h.y : h.x)) - f.szel / 2;
      fel = Math.min(fel, elol);
    }
    // hátul ne lógjon bele a mögötte álló (vele párhuzamos) sorba
    for (const m of helyek) {
      if (m === h || m.irany !== h.irany) continue;
      const rx = m.x - h.x, ry = m.y - h.y;
      const a = rx * h.nx + ry * h.ny;            // a homlokirány mentén
      if (a > -0.05) continue;                     // csak ami mögötte van
      const oldal = Math.abs(rx * h.ny - ry * h.nx); // oldalirányú eltérés
      if (oldal > (h.w + m.w) / 2 * 0.9) continue;
      fel = Math.min(fel, -a / 2 - 0.01);
    }
    if (fel < minFel) {
      figyelmeztetesek.push(`${h.kod}: a számolt mélység (${(2 * fel).toFixed(2)} m) kisebb a minimumnál – a folyosószélesség lehet túl nagy`);
      fel = minFel;
    }
    h.h = fel;
  }

  // Ha a mélység fix, jelezzük, ha az állvány belelóg a folyosóba
  for (const h of helyek) {
    const f = folyosok.get(h.folyoso);
    if (!f || !h.parhuzamos) continue;
    const elol = Math.abs(f.c - (f.tengely === 'X' ? h.y : h.x)) - f.szel / 2;
    if (h.h > elol + 0.02) h.belelog = +(h.h - elol).toFixed(2);
  }
  const belelogok = helyek.filter(h => h.belelog);
  if (belelogok.length) {
    figyelmeztetesek.push(`${belelogok.length} tárhely eleje belelóg a beállított folyosószélességbe (pl. ${belelogok[0].kod}: ${belelogok[0].belelog} m)`);
  }

  // Alaprajzi téglalap (x0,y0)-(x1,y1)
  const teglalap = h => {
    const hx = h.irany === 'X' ? h.w / 2 : h.h;
    const hy = h.irany === 'X' ? h.h : h.w / 2;
    h.x0 = h.x - hx; h.x1 = h.x + hx; h.y0 = h.y - hy; h.y1 = h.y + hy;
  };
  helyek.forEach(teglalap);
  // Sarkoknál (pl. T3-00) a keresztben álló szomszédba se lógjon bele hátul
  if (fixMely == null) {
    for (const h of helyek) {
      if (h.fixMely != null) continue;
      for (const m of helyek) {
        if (m === h || m.sorKulcs === h.sorKulcs) continue;
        const ox = Math.min(h.x1, m.x1) - Math.max(h.x0, m.x0);
        const oy = Math.min(h.y1, m.y1) - Math.max(h.y0, m.y0);
        if (ox <= 0.05 || oy <= 0.05) continue;
        const tav = h.nx > 0 ? h.x - m.x1 : h.nx < 0 ? m.x0 - h.x : h.ny > 0 ? h.y - m.y1 : m.y0 - h.y;
        if (tav > minFel && tav < h.h) { h.h = tav; teglalap(h); }
      }
    }
  }
  for (const h of helyek) h.cimkeY = Math.min(Number(C.cimkeMagassag ?? 1.5), h.H - 0.1);

  // --- Falak (az átjáró helyén nyílással) -------------------------------
  const falak = [];
  // Nyílások: az átjáró (Paraméterek lap) és a config.js ajtok listája
  const atj = D.kulcsok.atjaro;
  const nyilasok = [
    { nev: 'átjáró', x: atj.x, y: atj.y, fel: Number(C.atjaroSzelesseg ?? 2) / 2 },
    ...(C.ajtok || []).filter(a => a.vag !== false).map(a => ({ nev: a.nev, x: a.x, y: a.y, fel: Number(a.szel ?? 2) / 2 })),
  ];
  const osszesFal = [
    ...(C.falak || []),
    ...(C.felsoSzarnyFalak || []).map(([x1, y1, x2, y2]) => [x1, y1 + D.eltolasY, x2, y2 + D.eltolasY]),
  ];
  const vagott = new Set();
  for (const [x1, y1, x2, y2] of osszesFal) {
    const fugg = Math.abs(x1 - x2) < 1e-6;
    if (!fugg && Math.abs(y1 - y2) > 1e-6) { falak.push([x1, y1, x2, y2]); continue; }
    // a fal mentén mért szakaszok [a, b], ebből vágjuk ki a nyílásokat
    let szakaszok = [[Math.min(fugg ? y1 : x1, fugg ? y2 : x2), Math.max(fugg ? y1 : x1, fugg ? y2 : x2)]];
    for (const n of nyilasok) {
      const kereszt = fugg ? n.x : n.y, menten = fugg ? n.y : n.x;
      if (Math.abs((fugg ? x1 : y1) - kereszt) > 0.15) continue;
      const uj = [];
      for (const [a, b] of szakaszok) {
        if (menten <= a || menten >= b) { uj.push([a, b]); continue; }
        vagott.add(n);
        if (menten - n.fel > a) uj.push([a, menten - n.fel]);
        if (menten + n.fel < b) uj.push([menten + n.fel, b]);
      }
      szakaszok = uj;
    }
    for (const [a, b] of szakaszok) falak.push(fugg ? [x1, a, x1, b] : [a, y1, b, y1]);
  }
  if (osszesFal.length) {
    for (const n of nyilasok) {
      if (!vagott.has(n)) figyelmeztetesek.push(`A(z) „${n.nev}” pontja nem esik egyik falra sem – nem vágtunk nyílást.`);
    }
  }
  const valaszfalak = (C.valaszfalak || []).map(v => [...v]);

  // --- Ütközők ----------------------------------------------------------
  const vast = Number(C.falVastagsag ?? 0.2) / 2;
  const falTeglalap = ([x1, y1, x2, y2]) => ({
    x0: Math.min(x1, x2) - vast, x1: Math.max(x1, x2) + vast,
    y0: Math.min(y1, y2) - vast, y1: Math.max(y1, y2) + vast, fal: true,
  });
  const utkozok = helyek.map(h => ({ x0: h.x0, y0: h.y0, x1: h.x1, y1: h.y1, hely: h.i }));
  if (C.falakUtkoznek !== false) {
    for (const f of falak) utkozok.push(falTeglalap(f));
    for (const f of valaszfalak) utkozok.push(falTeglalap(f));
  }
  for (const a of C.egyebAllvanyok || []) {
    utkozok.push({ x0: Math.min(a.x0, a.x1), y0: Math.min(a.y0, a.y1), x1: Math.max(a.x0, a.x1), y1: Math.max(a.y0, a.y1) });
  }
  for (const g of C.gepek || []) {
    const r = Number(g.r ?? 0.5);
    utkozok.push({ x0: g.x - r, y0: g.y - r, x1: g.x + r, y1: g.y + r });
  }
  const racs = new UtkozoRacs(utkozok, 2);

  // --- Határok ----------------------------------------------------------
  const xs = [], ys = [];
  for (const h of helyek) { xs.push(h.x0, h.x1); ys.push(h.y0, h.y1); }
  for (const [x1, y1, x2, y2] of falak) { xs.push(x1, x2); ys.push(y1, y2); }
  const hatar = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };

  const modell = { helyek, folyosok, csoportok, falak, valaszfalak, utkozok, racs, hatar, figyelmeztetesek, adat: D, nyilasok };
  modell.feltetelezesek = feltetelezesek(D, C, modell);
  modell.modellFeltetelezesek = modellFeltetelezesek(C, helyek);
  return modell;
}

// ---------------------------------------------------------------------
// Ütközés: kör (a gyalogos) és tengelyhez igazított téglalapok
// ---------------------------------------------------------------------
export class UtkozoRacs {
  constructor(teglalapok, cella) {
    this.t = teglalapok;
    this.cella = cella;
    this.m = new Map();
    teglalapok.forEach((r, i) => {
      for (let cx = Math.floor(r.x0 / cella); cx <= Math.floor(r.x1 / cella); cx++) {
        for (let cy = Math.floor(r.y0 / cella); cy <= Math.floor(r.y1 / cella); cy++) {
          const k = cx + ',' + cy;
          if (!this.m.has(k)) this.m.set(k, []);
          this.m.get(k).push(i);
        }
      }
    });
  }
  kozel(x, y, r) {
    const ki = new Set();
    const c = this.cella;
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++) {
      for (let cy = Math.floor((y - r) / c); cy <= Math.floor((y + r) / c); cy++) {
        const l = this.m.get(cx + ',' + cy);
        if (l) for (const i of l) ki.add(i);
      }
    }
    return [...ki].map(i => this.t[i]);
  }
  utkozik(x, y, r) {
    for (const t of this.kozel(x, y, r)) {
      const px = Math.max(t.x0, Math.min(x, t.x1)), py = Math.max(t.y0, Math.min(y, t.y1));
      if ((x - px) ** 2 + (y - py) ** 2 < r * r - 1e-9) return true;
    }
    return false;
  }
  // Kitolja a kört a téglalapokból (csúszás a fal mentén).
  felold(x, y, r) {
    for (let iter = 0; iter < 4; iter++) {
      let mozdult = false;
      for (const t of this.kozel(x, y, r)) {
        const px = Math.max(t.x0, Math.min(x, t.x1)), py = Math.max(t.y0, Math.min(y, t.y1));
        const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2), k = (r - d) / d;
          x += dx * k; y += dy * k;
        } else {
          // a középpont a téglalapon belül van: a legrövidebb úton ki
          const ki = [[t.x0 - r - x, 0], [t.x1 + r - x, 0], [0, t.y0 - r - y], [0, t.y1 + r - y]];
          ki.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
          x += ki[0][0]; y += ki[0][1];
        }
        mozdult = true;
      }
      if (!mozdult) break;
    }
    return [x, y];
  }
  // Mozgás lépésekben, hogy vékony akadályon se lehessen átugrani.
  mozgat(x, y, dx, dy, r) {
    const hossz = Math.hypot(dx, dy);
    const lepes = Math.max(1, Math.ceil(hossz / (r * 0.5)));
    for (let i = 0; i < lepes; i++) {
      [x, y] = this.felold(x + dx / lepes, y + dy / lepes, r);
    }
    return [x, y];
  }
  // A legközelebbi szabad pont (spirálban keresve).
  szabadPont(x, y, r) {
    if (!this.utkozik(x, y, r)) return [x, y];
    for (let rad = 0.2; rad < 8; rad += 0.2) {
      for (let a = 0; a < 24; a++) {
        const px = x + Math.cos(a / 24 * Math.PI * 2) * rad, py = y + Math.sin(a / 24 * Math.PI * 2) * rad;
        if (!this.utkozik(px, py, r)) return [px, py];
      }
    }
    return [x, y];
  }
}

// A hely előtti álláspont (ahonnan a címke látszik) és a nézési irány.
export function helyElotti(modell, h, C) {
  const f = modell.folyosok.get(h.folyoso);
  const tav = f && h.parhuzamos ? Math.max(0.35, Math.min(1.2, f.szel / 2)) : 1.2;
  let x = h.x + h.nx * (h.h + tav), y = h.y + h.ny * (h.h + tav);
  [x, y] = modell.racs.szabadPont(x, y, Number(C.testSugar ?? 0.28));
  return { x, y };
}

// ---------------------------------------------------------------------
// Feltételezések: a táblázat cellái + a Folyosók lap listája
// ---------------------------------------------------------------------
function sorokASzovegben(szoveg, helyek) {
  const talalt = new Set();
  for (const m of szoveg.matchAll(/T(\d)\s*-\s*(\d{2})/g)) {
    const k = `T${m[1]}|${m[2]}`;
    if (helyek.some(h => `${h.zona}|${h.sor}` === k)) talalt.add(k);
  }
  for (const m of szoveg.matchAll(/T(\d)-b[ae]\b/g)) {
    for (const h of helyek) if (h.zonaFo === `T${m[1]}`) talalt.add(`${h.zona}|${h.sor}`);
  }
  return [...talalt];
}

function feltetelezesek(D, C, M) {
  const lista = [];
  const { folyosok, helyek, valaszfalak } = M;
  const atj = D.kulcsok.atjaro;
  // a folyosó közepe, vagy „alul” a folyosó vége (a gerinc felőli vég)
  const folyosoHorgony = (f, alul) => {
    const t = alul ? (f.e ?? f.max) : f.mid;
    return f.tengely === 'Y' ? { x: f.c, y: t } : { x: t, y: f.c };
  };
  const sorFolyosok = sorKulcsok => {
    const ids = new Set();
    for (const k of sorKulcsok) {
      const h = helyek.find(h => `${h.zona}|${h.sor}` === k);
      if (h) ids.add(h.folyoso);
    }
    return [...ids];
  };
  const felsoHelyek = helyek.filter(h => h.szarny === 'FELSŐ');
  const t1Helyek = helyek.filter(h => h.zona === 'T1');

  // 1) Cellák, amelyek szövegében szerepel a „feltételez” szó
  const atjaroTetel = { cim: 'Átjáró a felső szárnyba', szovegek: [], forrasok: [], horgonyok: [] };
  for (const c of D.feltetelezesCellak) {
    if (/^Feltételezések|^Ha egy feltételezés/i.test(c.szoveg)) continue; // fejléc és útmutató
    if (c.lap === 'Folyosók' && c.szoveg.startsWith('•')) continue;     // a listát lent dolgozzuk fel
    const sorSzam = Number(c.cella.replace(/\D/g, ''));
    const forras = `${c.lap}!${c.cella}`;
    if (c.lap === 'Folyosók') {
      const f = [...folyosok.values()].find(f => f.excelSor === sorSzam);
      const resz = c.szoveg.split(/FELTÉTELEZÉS:?/i)[1] || c.szoveg;
      const sorok = sorokASzovegben(resz, helyek);
      const horgonyok = [];
      if (f) {
        const alul = /alul/i.test(resz);
        horgonyok.push({ tipus: 'folyoso', id: f.id }, { tipus: 'pont', ...folyosoHorgony(f, alul) });
      }
      if (sorok.length) horgonyok.push({ tipus: 'sorok', kulcsok: sorok });
      lista.push({ cim: f ? `${f.id} folyosó` : 'Folyosók lap', szoveg: c.szoveg, forras, horgonyok });
    } else if (c.lap === 'Paraméterek') {
      const p = D.parameterek.find(p => p.excelSor === sorSzam);
      const nev = p ? p.nev : '';
      if (/^Átjáró/.test(nev)) {
        atjaroTetel.szovegek.push(`${nev} = ${p.ertek} ${p.egyseg}: ${c.szoveg}`);
        atjaroTetel.forrasok.push(forras);
        if (!atjaroTetel.horgonyok.length) {
          atjaroTetel.horgonyok.push({ tipus: 'pont', x: atj.x, y: atj.y }, { tipus: 'ajto', x: atj.x, y: atj.y });
        }
        if (!lista.includes(atjaroTetel)) lista.push(atjaroTetel);
      } else if (/^Kiindulópont/.test(nev)) {
        lista.push({
          cim: 'Kiindulópont: a komissiózó lerakó terület közepe', szoveg: `${nev} = ${p.ertek} ${p.egyseg}: ${c.szoveg}`, forras,
          horgonyok: [{ tipus: 'pont', x: D.kulcsok.kiindulo.x, y: D.kulcsok.kiindulo.y }],
        });
      } else if (/^T4 eltolás Y/.test(nev)) {
        const x0 = Math.min(...felsoHelyek.map(h => h.x0));
        const y = Number(p.ertek) + D.eltolasY;
        lista.push({
          cim: 'A felső szárny alsó fala', szoveg: `${nev} = ${p.ertek} ${p.egyseg}: ${c.szoveg}`, forras,
          horgonyok: [{ tipus: 'vonal', x1: x0, y1: y, x2: 0, y2: y }, { tipus: 'pont', x: (x0) / 2, y }],
        });
      } else {
        lista.push({ cim: nev || 'Paraméter', szoveg: c.szoveg, forras, horgonyok: [] });
      }
    } else {
      lista.push({ cim: c.lap, szoveg: c.szoveg, forras, horgonyok: [] });
    }
  }
  for (const t of lista) if (t.szovegek) { t.szoveg = t.szovegek.join(' | '); t.forras = t.forrasok.join(', '); }

  // 2) A Folyosók lap „Feltételezések – ezeket érdemes a helyszínen ellenőrizni” listája
  for (const b of D.feltetelezesLista) {
    const sz = b.szoveg;
    const forras = `Folyosók!A${b.excelSor}`;
    const horgonyok = [];
    let cim = 'Útvonal-feltételezés';
    if (/bal vége/i.test(sz) && t1Helyek.length) {
      const x = Math.min(...t1Helyek.map(h => h.x0)) - 0.05;
      const y0 = Math.min(...t1Helyek.map(h => h.y0)), y1 = Math.max(...t1Helyek.map(h => h.y1));
      cim = 'T1 sorok bal vége zárt';
      horgonyok.push({ tipus: 'vonal', x1: x + 0.25, y1: y0, x2: x + 0.25, y2: y1 }, { tipus: 'pont', x: x + 0.6, y: (y0 + y1) / 2 });
    } else if (/válaszfal/i.test(sz) && valaszfalak.length) {
      const [x1, y1, x2, y2] = valaszfalak[0];
      const vegX = Math.max(x1, x2);
      cim = 'Válaszfal a 10. és 11. sor között';
      horgonyok.push({ tipus: 'vonal', x1: vegX, y1, x2: D.kulcsok.t1KeresztX + folyosoSzelesseg(C, 'T1-K') / 2, y2: y1 },
        { tipus: 'pont', x: (vegX + D.kulcsok.t1KeresztX) / 2, y: y1 });
    } else if (/átjáró/i.test(sz)) {
      cim = 'Átjáró a felső szárny és a komissiózó között';
      horgonyok.push({ tipus: 'pont', x: atj.x, y: atj.y }, { tipus: 'ajto', x: atj.x, y: atj.y });
    } else if (/T1-03 sor a T1-04-gyel szemben/i.test(sz)) {
      cim = 'A T1-03 sor helye és helyszáma';
      const hs = M.csoportok.get('T1|03') || [];
      horgonyok.push({ tipus: 'sorok', kulcsok: ['T1|03'] });
      if (hs.length) horgonyok.push({ tipus: 'pont', x: hs.reduce((s, h) => s + h.x, 0) / hs.length, y: hs[0].y });
    } else if (/lerakó terület/i.test(sz)) {
      cim = 'A komissiózó bejárata';
      const b = C.komissiozoBejarat;
      if (b) horgonyok.push({ tipus: 'pont', x: b.x + b.szel / 2, y: b.y + b.mely / 2 },
        { tipus: 'vonal', x1: b.x, y1: b.y + b.mely, x2: b.x + b.szel, y2: b.y + b.mely });
    } else if (/teteje/i.test(sz)) {
      cim = 'A felső szárny folyosóinak teteje zárt';
      const fs = [...folyosok.values()].filter(f => f.szarny === 'FELSŐ' && f.tipus !== 'gerinc' && f.tengely === 'Y');
      let sx = 0, sy = 0;
      for (const f of fs) {
        const y = f.min - 0.5;
        horgonyok.push({ tipus: 'vonal', x1: f.c - f.szel / 2, y1: y, x2: f.c + f.szel / 2, y2: y });
        sx += f.c; sy += y;
      }
      if (fs.length) horgonyok.push({ tipus: 'pont', x: sx / fs.length, y: sy / fs.length - 1 });
    } else {
      const sorok = sorokASzovegben(sz, helyek);
      if (sorok.length) {
        cim = 'Melyik sor melyik folyosóról érhető el';
        horgonyok.push({ tipus: 'sorok', kulcsok: sorok });
        for (const id of sorFolyosok(sorok)) {
          const f = folyosok.get(id);
          const alul = f.helyek.some(h => h.zonaFo === 'T3') && /alul/i.test(sz);
          horgonyok.push({ tipus: 'folyoso', id }, { tipus: 'pont', ...folyosoHorgony(f, alul) });
        }
      } else {
        cim = 'Számítási feltételezés';
      }
    }
    lista.push({ cim, szoveg: sz, forras, horgonyok });
  }

  for (const f of C.helyszinFeltetelezesek || []) {
    lista.push({
      cim: f.cim, szoveg: f.szoveg, forras: 'config.js (helyszíni info)',
      horgonyok: f.x != null ? [{ tipus: 'pont', x: f.x, y: f.y }] : [],
    });
  }

  lista.forEach((t, i) => {
    t.szam = i + 1;
    const megj = t.forras.split(/,\s*/).map(f => C.ellenorizve?.[f]).filter(Boolean);
    t.ellenorizve = megj.length ? [...new Set(megj)].join(' ') : null;
    const pontok = t.horgonyok.filter(h => h.tipus === 'pont');
    t.fokusz = pontok[0] || null;
  });
  return lista;
}

function modellFeltetelezesek(C, helyek) {
  const jel = helyek.filter(h => h.jeloletlen);
  const l = [];
  if (C.felsoSzarnyEltolasY) {
    l.push(`A felső szárny (T2–T4) ${String(C.felsoSzarnyEltolasY).replace('.', ',')} m-rel lejjebb van az Excel koordinátáihoz képest (helyszíni pontosítás, config.js: felsoSzarnyEltolasY). A felső szárny „Táv a kiindulóponttól” értékeit ehhez igazítva újraszámoltuk.`);
  }
  l.push(
    'A tárhely X/Y koordinátája az állvány-rekesz közepe; a rekesz szélessége a sorbeli szomszéd távolsága.',
    C.allvanyMelyseg === 'auto'
      ? `Állványmélység automatikus: az eleje a folyosó széléig ér, legfeljebb ${C.maxMelyseg} m (config.js: allvanyMelyseg).`
      : `Állványmélység fix: ${C.allvanyMelyseg} m (config.js).`,
    `Állványmagasság és szintszám becsült (alap: ${C.allvanyMagassag} m, ${C.szintekSzama} szint; zónánként a config.js-ben).`,
    `Folyosószélesség alapértéke ${C.folyosoSzelesseg} m ott, ahol a táblázat nem ad meg szélességet.`,
    'A falak helye becsült (a táblázatban csak a komissiózó bal fala és a T4 alsó fala szerepel) – config.js: falak.',
    'A komissiózó (lerakó terület) a T1-03 sor fölött van, X 0–20,6 m; a bejárata a T1-03 keleti vége és a T1 jobb fala között, a kék kapu mellett (helyszíni info alapján, a pontos méret becsült).',
    'Az árukiadó fedett udvar kb. 14 × 50 m (helyszíni becslés), a kék kapura középre igazítva (config.js: arukiado); a kék kapu a T1-F0 keleti végén, a T1 jobb falán van.',
  );
  if (jel.length) {
    l.push(`${jel.length} jelöletlen helynek („(nincs kód)”) ideiglenes kódot adtunk: ${[...new Set(jel.map(h => h.kod.replace(/-\d+$/, '-…')))].join(', ')}.`);
  }
  l.push('A „Rajzon” oszlop (kék X / üres keret / …) jelentését nem tudjuk; csak megjelenítjük (Színezés: rajzi jel szerint).');
  return l;
}
