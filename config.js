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

  // Oszlopkiosztás: hány tárhely van egy rekeszben (két oszlop között), a „Hely” sorszám szerint.
  // Helyszín (2026-10-21): a T1 és T4 sorokban az 1–2. és a 3–4. hely egy-egy rekesz, utána
  // 3 tárhelyenként van oszlop (5–7., 8–10., …). A felsorolt zónákon kívül minden tárhely külön rekesz.
  // A zóna neve a Tárhelyek lap „Zóna” oszlopa (a „T1 fali” külön szerepel, ha kell, add hozzá).
  oszlopKiosztas: {
    zonak: ['T1', 'T4'],
    elejen: [2, 2],   // az első rekeszek mérete sorban
    utana: 3,         // utána ennyi tárhelyenként van oszlop
  },

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
    [  0.0,   0.0,   0.0,  97.8],   // komissiózó + T1 + áruátvétel bal fala (X = 0)
    // Komissiózó (lerakó terület) – a T1-03 sor fölött, a jobb fala a T1 jobb falával egy vonalban
    [  0.0,   0.0,  20.6,   0.0],   // felső fal (becsült)
    // T1 csarnok + komissiózó jobb fala; a kék kapu nyílását az ajtok lista vágja bele
    [ 20.6,   0.0,  20.6,  97.8],   // jobb fal a fali állványok mögött (becsült)
    // Helyszín (2026-10-21): a T1-29 alatt az áruátvételi terület van, a déli fal ezért
    // lejjebb van; a terület mélysége (8 m) becsült.
    [  0.0,  97.8,  20.6,  97.8],   // déli fal az áruátvétel alatt
    // Logisztikai iroda és mosdó a komissiózó északi fala mögött (helyszíni fotók alapján,
    // L alakú iroda: belépve balra a nagy terem, jobbra – a mosdó mögött – a kisebb rész).
    // Minden méret becsült.
    [  0.0,  -7.0,  11.4,  -7.0],   // az iroda északi (külső, ablakos) fala
    [  0.0,  -7.0,   0.0,   0.0],   // az iroda nyugati fala
    [ 11.4,  -7.0,  11.4,   0.0],   // az iroda / mosdó keleti fala
    [  7.9,  -2.6,   7.9,   0.0],   // a nagy terem és a mosdó közötti fal
    [  7.9,  -2.6,  11.4,  -2.6],   // a mosdó és az iroda kisebb része közötti fal
    // Pohármosó az áruátvétel déli fala mögött (két külső, ablakos fal; méret becsült)
    [  5.0, 101.6,   9.0, 101.6],   // déli fal (ablak)
    [  5.0,  97.8,   5.0, 101.6],   // nyugati fal (ablak)
    [  9.0,  97.8,   9.0, 101.6],   // keleti fal
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
    // Helyszín (2026-10-21): az áruátvételi kapu (sárga gyorskapu) az áruátvételi terület
    // keleti falán; a helye a falon és a szélessége becsült.
    { nev: 'Áruátvételi kapu', x: 20.6, y: 93.8, szel: 3.5, szin: '#e0a800' },
    // Helyszín (IMG_3289, 3291–3293): a pohármosó ajtaja az áruátvétel déli falán, a karantén
    // állvány alatt (helye becsült).
    { nev: 'Pohármosó', x: 7.0, y: 97.8, szel: 1.0, szin: '#8a6d3b' },
    // Helyszín (2026-10-21, IMG_3284–3285): sárga kijárati gyorskapu a felső szárny északi
    // falán, a T4-06 keleti vége és a galéria lépcsője között (helye és szélessége becsült).
    { nev: 'Kijárat (fedett rész)', x: -20.0, y: -0.4, szel: 2.4, szin: '#e0a800' },
    // A komissiózó lerakó hátsó (északi) falán: bal oldalt a logisztikai iroda, jobbra a
    // mosdó ajtaja (be lehet menni). Az X helyük becsült.
    // (vag: false = csak jelölő ajtó, amelyen nem lehet átmenni.)
    { nev: 'Logisztikai iroda', x: 7.2, y: 0.0, szel: 1.0, szin: '#8a6d3b' },
    { nev: 'Mosdó', x: 9.8, y: 0.0, szel: 1.0, szin: '#8a6d3b' },
  ],
  // Egyéb padlóterületek felirattal (x, y = bal felső sarok; szel, mely)
  teruletek: [
    { nev: 'ÁRUÁTVÉTEL', x: 0.0, y: 89.8, szel: 20.6, mely: 8.0, szin: '#f3e1bd' },
    { nev: 'LOGISZTIKAI IRODA', x: 0.0, y: -7.0, szel: 7.9, mely: 7.0, szin: '#e4e0f0' },
    { nev: 'iroda', x: 7.9, y: -7.0, szel: 3.5, mely: 4.4, szin: '#e4e0f0' },
    { nev: 'MOSDÓ', x: 7.9, y: -2.6, szel: 3.5, mely: 2.6, szin: '#d6eef5' },
    { nev: 'POHÁRMOSÓ', x: 5.0, y: 97.8, szel: 4.0, mely: 3.8, szin: '#d6eef5' },
  ],
  // Kód nélküli állványok (nem tárhelyek): alaprajzi téglalap, magasság, szintek
  egyebAllvanyok: [
    // Helyszín (2026-10-21): a karantén tárhely az áruátvételen, a T1-29-cel szemben.
    // A hossza és a mélysége becsült.
    // A karantén állvány alatt nyílik a pohármosó ajtaja (IMG_3289): ott csak a gerenda
    // fölötti rész van (alsoMagassag), alatta át lehet menni.
    { nev: 'KARANTÉN', x0: 5.0, y0: 96.4, x1: 6.4, y1: 97.6, magassag: 6.5, szintek: 5, szin: '#8e5a2b', felirat: false },
    { nev: 'KARANTÉN', x0: 6.4, y0: 96.4, x1: 7.6, y1: 97.6, magassag: 6.5, szintek: 5, szin: '#8e5a2b', alsoMagassag: 2.6, felirat: false },
    { nev: 'KARANTÉN', x0: 7.6, y0: 96.4, x1: 18.0, y1: 97.6, magassag: 6.5, szintek: 5, szin: '#8e5a2b' },
    // Helyszín (IMG_3288): EAR raktár – zárt, OSB-falú rekesz a T4-01 sor északi vége mögött,
    // az északi falnál (tomor: zárt doboz, nem polc). Mérete becsült.
    { nev: 'EAR RAKTÁR (elzárt)', x0: -34.4, y0: -0.3, x1: -30.8, y1: 1.9, magassag: 2.5, tomor: true, szin: '#c8a165' },
  ],
  // Gépek (kör alaprajz, ütköznek)
  gepek: [
    // Helyszín (2026-10-21): a fóliázógép a 17–18. sor előtt, a 16–17. sor keleti végén,
    // ahol a 01–02. hely hiányzik (becsült hely).
    { nev: 'Fóliázógép', x: 15.2, y: 53.35, r: 0.8 },
  ],
  // Helyszíni feltételezések, amelyek nem az Excelből jönnek (pirossal jelennek meg)
  helyszinFeltetelezesek: [
    { cim: 'A pohármosó helye és mérete', x: 7.0, y: 99.7,
      szoveg: 'A pohármosó az áruátvételről nyílik, a karantén állvány alatti ajtón át; a déli fal mögé nyúlik ki, két ablakos külső fallal. Kb. 4 × 3,8 m, az ajtó X ≈ 7 m – becsült.' },
    { cim: 'A fedett rakodó az áruátvételi kapu előtt', x: 24.6, y: 80.0,
      szoveg: 'Az áruátvételi kapun kilépve balra a fal mentén fedett rakodó; 8 m szélesnek vettem, az árukiadó udvaráig. Becsült.' },
    { cim: 'A galéria mérete és magassága', x: -8.5, y: 8.7,
      szoveg: 'A galéria a T2 polcos zóna fölött van (X −16,9…−0,2, Y 0…16 m), a padlója kb. 3 m magasan – mindez a fotókból becsült.' },
    { cim: 'A galéria lépcsője és a sárga kijárat', x: -19.0, y: 0.6,
      szoveg: 'A lépcső a T4-06-09 mellett indul, az északi fal mentén kelet felé emelkedik; mellette, a T4-06 vége és a lépcső között a sárga kijárati gyorskapu. Kilépve balra fedett rész (kb. 20 × 6 m). A helyek és méretek becsültek.' },
    { cim: 'Az áru feladó / lerakó helye a galérián', x: -16.9, y: 4.0,
      szoveg: 'A lépcső tetején jobbra, majd megint jobbra fordulva: a galéria nyugati szélén, az F-3 széles folyosó fölött (innen emelhetők fel a raklapok). A pontos hely becsült.' },
    { cim: 'Az EAR raktár mérete', x: -32.6, y: 0.8,
      szoveg: 'Az EAR raktár (elzárt) a T4-01 sor északi vége mögött, az északi falnál, kb. 3,6 × 2,2 m – becsült.' },
    { cim: 'Az áruátvételi terület mérete', x: 10.3, y: 93.8,
      szoveg: 'Az áruátvétel a T1-29 alatt van, a karantén tárhellyel szemben. Mélységét 8 m-nek (Y 89,8–97,8), a karantén állványt X 5–18 m-nek vettem.' },
    { cim: 'Az áruátvételi kapu helye', x: 20.6, y: 93.8,
      szoveg: 'A sárga gyorskapu az áruátvétel keleti falán, középen (Y ≈ 93,8), 3,5 m széles – a T1-29 a kapuból nézve jobbra esik.' },
    { cim: 'A fóliázógép helye', x: 15.2, y: 53.35,
      szoveg: 'A fóliázógép a 17–18. sor előtt van; a 16–17. sor keleti végére tettem, ahol a 01–02. hely hiányzik.' },
    { cim: 'A logisztikai iroda és a mosdó', x: 5.0, y: -3.5,
      szoveg: 'A komissiózó lerakó hátsó (északi) fala mögött: balra a logisztikai iroda ajtaja, jobbra a mosdóé. Az iroda L alakú: belépve balra a nagy terem (kb. 7,9 × 7 m, ablakos külső fallal), jobbra – a mosdó mögött – a kisebb rész (kb. 3,5 × 4,4 m). Az ajtók helye és minden méret a fotókból becsült.' },
  ],
  // Az árukiadó fedett udvar a kék kapu előtt: helyszíni becslés kb. 14 × 50 m, a kapura
  // középre igazítva (a pontos helye becsült; null = ne rajzolja)
  arukiado: { x: 20.6, y: -7.7, szel: 14.0, mely: 50.0, nev: 'ÁRUKIADÓ (fedett udvar)' },
  // További fedett külső részek (ugyanígy: x, y = bal felső sarok)
  udvarok: [
    // Helyszín: a sárga kijáraton kilépve balra, a T4 mellett fedett rész (méret becsült)
    { x: -39.8, y: -6.4, szel: 20.0, mely: 6.0, nev: 'FEDETT RÉSZ' },
    // Helyszín (IMG_3290): az áruátvételi kapun kilépve balra (észak felé) a fal mentén fedett
    // rakodó, térkövezett udvarral; a szélessége és a hossza becsült (az árukiadó udvaráig).
    { x: 20.6, y: 42.3, szel: 8.0, mely: 56.0, nev: 'FEDETT RAKODÓ' },
  ],
  // Galéria (emelet): a padló magassága, a lefedett téglalapok [x0, y0, x1, y1], a lépcső
  // (alaprajzi téglalap + merre emelkedik: '+X', '-X', '+Y', '-Y') és az áru feladó/lerakó.
  // A séta egyszintes, ezért a galériára nem lehet felmenni, csak látszik.
  galeriak: [
    {
      // Helyszín (2026-10-21, IMG_3283–3287): galéria a T2 polcos zóna fölött. Minden méret becsült.
      nev: 'GALÉRIA (a T2 fölött)', magassag: 3.0,
      reszek: [
        [-16.9, 1.4, -0.2, 16.0],    // a T2 sorok fölött (az F-3 folyosó széléig)
        [-14.0, 0.0, -0.2,  1.4],    // északi sáv a lépcső teteje mellett
      ],
      lepcso: { x0: -18.5, y0: 0.0, x1: -14.0, y1: 1.3, irany: '+X' },  // az északi fal mentén, kelet felé
      leado: { x: -16.9, y: 4.0, szel: 2.4, nev: 'Áru feladó / lerakó' }, // a nyugati szélen, az F-3 fölött
    },
  ],
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
