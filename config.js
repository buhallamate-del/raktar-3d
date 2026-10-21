// =====================================================================
//  RAKTÁR 3D – KONFIGURÁCIÓ
//  Ezt a fájlt nyugodtan átírhatod (pl. a GitHub webes szerkesztőjében).
//  Mentés után az oldalt frissíteni kell (GitHub Pages-en ~1 perc).
//  Minden méret MÉTERBEN értendő. Tizedesjel: pont (2.6, nem 2,6).
// =====================================================================
window.RAKTAR_CONFIG = {

  // ------------------------------------------------------------------
  // 1) FŐ PARAMÉTEREK – ezeket érdemes pontosítani
  // ------------------------------------------------------------------

  // Alapértelmezett állványmagasság (padlótól a legfelső gerendáig), m.
  allvanyMagassag: 5.0,

  // Alapértelmezett szintszám (hány tárolószint van egymás fölött).
  szintekSzama: 4,

  // Alapértelmezett folyosószélesség (szabad szélesség két állványsor között), m.
  folyosoSzelesseg: 2.6,

  // Folyosónkénti szélesség (felülírja az alapértelmezettet).
  // A kulcs a Folyosók lap „Folyosó” oszlopa. A megadott értékek a táblázat
  // megjegyzéseiből / paramétereiből származnak; a többi az alapértelmezett.
  folyosoSzelessegek: {
    'T1-F0': 3.4,     // fejfolyosó: komissiózó alja (15,6) – 04. sor (19,0)
    'T1-29/fal': 2.6, // „A 29. sor alatti folyosó (2,6 m)”
    'T1-K': 3.2,      // keresztfolyosó: sorvégek (~16,2) – fali állványok (~19,4)
    'F-SÁV': 2.6,     // alsó sáv: állványok alja (~3,8) – falmenti sor (~6,4)
    'F-4': 0.8,       // „~0,8 m”
    'F-5': 0.9,       // „~0,9 m”
    'F-6': 1.4,       // „~1,4 m”
    'F-7': 2.2,       // „~2,2 m”
  },

  // Zónánkénti felülírás (magasság, szintek, szín). A zóna neve a Tárhelyek
  // lap „Zóna” oszlopa; a „T1 fali” külön is megadható, különben a T1 érvényes.
  zonak: {
    // T1: helyszíni fotó (2026-10-21, T1-04 sor) alapján becsülve: padló + 4 gerendaszint,
    // a legfelső raklapok kb. 6–7 m magasan. Pontos méréssel érdemes javítani.
    'T1': { szin: '#2f6fdb', nev: 'T1', allvanyMagassag: 6.5, szintekSzama: 5 },
    'T1 fali': { szin: '#1f4fa8', nev: 'T1 fali' },
    'T2': { szin: '#2ea44f', nev: 'T2', allvanyMagassag: 2.2, szintekSzama: 5 },
    'T3': { szin: '#e8891c', nev: 'T3 (temperált)', allvanyMagassag: 2.5, szintekSzama: 4 },
    'T4': { szin: '#8e44ad', nev: 'T4', allvanyMagassag: 4.0, szintekSzama: 3 },
  },

  // Soronkénti felülírás, ha egy sor eltér a zónájától. Kulcs: 'Zóna|Sor'.
  // Példa: 'T2|01': { allvanyMagassag: 3.0, szintekSzama: 3 },
  sorok: {
  },

  // ------------------------------------------------------------------
  // 2) ÁLLVÁNYMÉLYSÉG
  // ------------------------------------------------------------------
  // 'auto': a mélységet a helykoordinátából és a folyosó szélességéből
  //         számolja (az állvány eleje a folyosó széléig ér, hátul nem lóg
  //         bele a mögötte lévő sorba), legfeljebb maxMelyseg.
  // szám (pl. 1.2): minden állvány ilyen mély.
  allvanyMelyseg: 'auto',
  maxMelyseg: 1.2,
  minMelyseg: 0.3,
  maxHelySzelesseg: 1.4,   // egy tárhely legfeljebb ilyen széles (a szomszéd távolságból számolva)

  // ------------------------------------------------------------------
  // 3) HELYSZÍNI PONTOSÍTÁSOK
  // ------------------------------------------------------------------
  // A felső szárny (T2, T3, T4) függőleges eltolása az Excel koordinátáihoz képest, m.
  // 0 = az Excel koordinátái érvényesek. (2026-10-21: a helyszíni pontosítás – átjáró a
  // T1-04 mellett, a szárny 12,2 m-rel lejjebb – már az Excelben is javítva van.)
  // Ha az adatokban az alsó sáv már a T1 fejfolyosó vonalában van, a modell nem tol.
  felsoSzarnyEltolasY: 0,

  // Ellenőrzött feltételezések: a kulcs a táblázat cellája (a ☰ menüben a „Forrás”).
  // Ezek nem pirossal, hanem zölddel, „ellenőrizve” jelöléssel látszanak.
  ellenorizve: {
    'Folyosók!A60': 'Helyszínen pontosítva: egy átjáró van, a T1-04 mellett.',
    'Folyosók!A64': 'Helyszínen pontosítva: a T1-03 ugyanúgy számozott, mint a T1-04.',
  },

  // ------------------------------------------------------------------
  // 4) ÉPÜLET (MODELL-FELTÉTELEZÉS – a táblázat nem adja meg a falakat)
  // ------------------------------------------------------------------
  // Falszakaszok [x1, y1, x2, y2] a táblázat koordináta-rendszerében
  // (origó: a komissiózó bal felső sarka, X jobbra, Y lefelé nő).
  falak: [
    [  0.0,   0.0,   0.0,  89.8],   // komissiózó + T1 bal fala (X = 0)
    // Komissiózó (lerakó terület) – a T1-03 sor fölött, a jobb fala a T1 jobb falával egy vonalban
    [  0.0,   0.0,  20.6,   0.0],   // felső fal (becsült)
    // T1 csarnok + komissiózó jobb fala; a kék kapu nyílását az ajtok lista vágja bele
    [ 20.6,   0.0,  20.6,  89.8],   // jobb fal a fali állványok mögött (becsült)
    [  0.0,  89.8,  20.6,  89.8],   // alsó fal: 29. sor alatti folyosó széle
  ],
  // A felső szárny (T2, T3, T4) falai az Excel koordinátáiban; a felsoSzarnyEltolasY-nal
  // együtt tolódnak.
  felsoSzarnyFalak: [
    [-39.8,  -0.4,   0.0,  -0.4],   // felső fal (becsült)
    [-39.8,  -0.4, -39.8,  20.0],   // bal fal (becsült)
    [-39.8,  20.0,   0.0,  20.0],   // alsó fal (Paraméterek: T4 eltolás Y = 20,0)
    [  0.0,  -0.4,   0.0,  20.0],   // jobb fal (X = 0, a komissiózó / T1 felé)
  ],
  // Válaszfalak (ugyanígy). A 10–11. sor közötti fal a táblázat feltételezése
  // szerint NEM zárja el a keresztfolyosót, ezért az S oszlop előtt véget ér.
  valaszfalak: [
    [0.0, 36.88, 16.2, 36.88],
  ],
  // Az átjáró (Paraméterek lap: „Átjáró a felső szárnyba X/Y”) helyén a falba
  // automatikusan ekkora nyílás kerül:
  atjaroSzelesseg: 2.0,
  // További ajtók/kapuk: a falba nyílást vágnak, és kerettel jelennek meg.
  ajtok: [
    // Helyszín (2026-10-21): a T1-F0 keleti vége a kék szalagfüggönyös kapu az árukiadó felé.
    // A szélesség a fotó alapján becsült.
    { nev: 'Kék kapu – árukiadó', x: 20.6, y: 17.3, szel: 3.0, szin: '#1f6feb' },
  ],
  // Az árukiadó fedett udvar a kék kapu előtt: helyszíni becslés kb. 14 × 50 m, a kapura
  // középre igazítva (a pontos helye becsült; null = ne rajzolja)
  arukiado: { x: 20.6, y: -7.7, szel: 14.0, mely: 50.0, nev: 'ÁRUKIADÓ (fedett udvar)' },
  falMagassag: 3.0,
  falVastagsag: 0.2,
  falakUtkoznek: true,       // false: a falakon át lehet sétálni (csak az állványok ütköznek)

  // Komissiózó terület a padlón (téglalap: x, y, szélesség, mélység)
  // (a T1-03 sor hátoldala 14,4 m-en van; a bejárat a 16,2–20,6 m sávban a T1-F0 felé)
  komissiozo: { x: 0, y: 0, szel: 20.6, mely: 7.8 },
  komissiozoEloter: { x: 0, y: 7.8, szel: 20.6, mely: 6.6 },
  komissiozoBejarat: { x: 16.2, y: 14.4, szel: 4.4, mely: 1.3 },

  // ------------------------------------------------------------------
  // 5) SÉTA ÉS MEGJELENÍTÉS
  // ------------------------------------------------------------------
  szemmagassag: 1.65,
  setaSebesseg: 1.8,      // m/s
  futasSebesseg: 4.5,     // m/s (Shift)
  testSugar: 0.28,        // a „gyalogos” sugara az ütközéshez
  cimkeMagassag: 1.5,     // a helykód-címke magassága az állvány elején
  egerErzekenyseg: 0.0022,
  erintesErzekenyseg: 0.005,
};
