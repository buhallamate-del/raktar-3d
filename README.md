# Raktár 3D

Böngészőben futó, bejárható 3D raktármodell a `raktar_alaprajz_anonim.xlsx` alaprajzból.
Egyetlen statikus oldal (Three.js), nincs build-lépés, GitHub Pages-re közvetlenül publikálható.

**Mit tud:**

- Mind a 976 tárhely állványként jelenik meg, zónánként más színnel (T1 kék, T2 zöld, T3 narancs, T4 lila).
  Minden rekeszen a helykód: az elején a folyosó felé, és a tetején, felülnézetből olvashatóan.
- **Felülnézet:** húzással mozgatod, görgővel vagy csípéssel nagyítasz, jobb gombbal vagy két ujjal forgatsz.
  Ha egy állványra kattintasz, megjelennek az adatai (zóna, sor, folyosó, X/Y, táv a kiindulóponttól stb.).
- **Belső nézet (séta):** gépen kattints a képre, aztán W A S D vagy a nyilak, egérrel nézelődsz, Shift = gyorsabban,
  Szóköz = ugrás (telefonon az „Ugrás” gomb). A lépcsőn fel lehet menni a galériára.
  **C = guggolás** (nyomva tartva; telefonon „Guggolás” gomb be/ki): guggolva át lehet bújni a sorok alatt, a legalsó
  gerenda alatt (a T1-ben és T4-ben kb. 1,25 m; a T2/T3 polcai ehhez túl sűrűek). **E = mászás** (nyomva tartva;
  telefonon „Mászás”): az állvány mellett felfelé lehet mászni, a polcszintekre guggolva be lehet bújni, a sor tetején
  végig lehet sétálni. Ha elengeded, és nem polcon vagy, leesel. Állva továbbra sem lehet átmenni az állványokon;
  a `config.js` `sorokAlattAtbujas: false` beállításával az állványok újra tömörek (se átbújás, se rájuk állás).
  Telefonon a bal alsó joystickkal sétálsz, a jobb oldalon húzással nézelődsz. Az állványokon és a falakon nem lehet átmenni.
- **Kereső:** beírsz egy helykódot (pl. `T1-05-03`, `t1 5 3`), és az *Odavisz* gomb vagy az Enter odavisz:
  belső nézetben a hely elé állít, a címke felé fordulva; felülnézetben fölé repül. A *Kijelöl* gomb csak kijelöli.
  Ha részleges kódot írsz (pl. `T2-05`), az összes illeszkedő helyet sárgával jelöli.
  A cím végére írt `#T1-05-03` egyből a helyre visz, így egy helyre mutató linket is meg lehet osztani.
- **Feltételezések:** ahol a táblázat „FELTÉTELEZÉS”-t ír, ott a modellben piros-sárga csíkos jelölés, piros keret
  és lebegő „⚠ FELTÉTELEZÉS #n” tábla látszik (falon és állványon át is). A ☰ menüben megvan az összes, a táblázatbeli
  forrással (lap és cella). Ha egy tételre kattintasz, odavisz. Ha kiválasztott hely érintett, az infópanel is figyelmeztet.

## Megjelenés

Alapból **valósághű** a fotók alapján: a T1-ben horganyzott oszlopok narancs gerendákkal, a T4-ben és a T1 fali sorain kék
oszlopok narancs gerendákkal, a T2 horganyzott polc. A polcokon raklapok és áru (kartondoboz, fóliázott raklap; a T2-ben
kisebb dobozok) – a kitöltés a helykódból képzett, mindenkinél azonos „véletlen”, **nem a valódi készlet**. Sárga
oszlopvédők a sorvégeken, betonpadló sárga folyosóvonalakkal; belső nézetben tömör fehér falak és mennyezet LED-sorokkal.
A ☰ menü „Színezés” mezőjében vissza lehet váltani zóna szerinti színekre. Beállítások: `config.js` → `megjelenes`
(színek zónánként, `toltottseg`, `aruUtkozik`, `oszlopvedok`, mennyezet).

## Közös nézet (több látogató)

Aki egyszerre nézi az oldalt, az **pálcikaemberként** látja a többieket, felettük a nevükkel. A felülnézetből nézőket
halványan, a nézett pont fölött mutatja. A fejlécben a 👥 szám mutatja, hányan vagytok bent. A ☰ menü „Közös nézet”
részében beállíthatod a neved és a színed, kikapcsolhatod, hogy mások lássanak, vagy az egészet kikapcsolhatod.

A pozíciók egy **nyilvános, ingyenes MQTT üzenetközvetítőn** (HiveMQ) mennek át. Csak a név, a szín és a hely kerül át,
más adat nem. A csatorna neve a `config.js`-ben (`kozos.csatorna`) véletlenszerű; aki ismeri, látja a pozíciókat.
Ha új nevet adsz, a régi linkkel nézők nem látják az újakat. Megbízhatóbb, zárt működéshez később saját szerverre
(pl. Firebase vagy saját MQTT) cserélhető. Teszteléshez: `?broker=ws://...&csatorna=...` a cím végén.

### Játék (lökés, palack, életerő)

A közös nézetben játszani is lehet (a ☰ menü „Játék” kapcsolójával látogatónként ki-be kapcsolható):
- **F = lökés** (telefonon „Lökés”): a közvetlenül előtted (≈1,4 m-en belül) álló kollégát ellöki, −10 HP.
  Ha a polc tetejéről vagy a galériáról esik le, az esés is sebez, és a lökőé az ölés.
- **G = palack** (telefonon „Dobás”): amerre nézel, eldobsz egy palackot; ívben repül, az állványon és a falon összetörik.
  Találat: −25 HP.
- **Esés:** kb. 4 m fölött sebez.
- **AK:** két fegyverládán vehető fel – a galérián és az áruátvételen, a piros bázis mellett – (utána 45 mp-ig üres a láda); ha már van nálad, a ládánál lőszert töltesz. Bal egérgomb nyomva = sorozatlövés
  (telefonon „Lövés”), R = újratöltés (30-as tár, összesen 90 lőszer), Q = váltás AK és palack között.
  Találat −12 HP; halálkor a fegyver elveszik. A többiek pálcikaemberén látszik, ha AK van náluk.
  Beállítás: `config.js` → `fegyver`, `fegyverLadak`.
- **Éjszaka:** a játékban 3 percenként 3 percig sötét van (a gép órája szerint, mindenkinél egyszerre; csak belső
  nézetben). A zseblámpa magától bekapcsol, **L** = ki/be (telefonon „Lámpa”). A többiek lámpája fénykúpként látszik,
  a targoncák fényszóróval járnak, a kapufeliratok halványan világítanak. Fent kijelző mutatja, mennyi van hátra.
  Beállítás: `config.js` → `ejszaka` (`nappalMp`, `ejjelMp`).
- **Zászlófoglalás (capture the flag):** két csapat – a piros bázis az áruátvételen, a kék kint, a fedett részen
  (a sárga kijáraton át). A menüben választható csapat (alapból automatikusan a kisebbe kerülsz; ha az egyik csapat 2 fővel nagyobb, valaki automatikusan átkerül). Az ellenfél
  zászlaját rámenéssel veszed fel; ha a saját bázisotokra viszed, miközben a ti zászlótok otthon van, pont jár,
  3 pont nyeri a kört. Aki zászlóval hal meg, elejti; a saját elejtett zászlót rámenéssel visszaviheted, különben
  30 mp múlva magától visszakerül. Csapattársat nem lehet bántani, halál után a bázison éledsz újra. Az állás
  megőrzött MQTT-üzenetben van, így aki később jön, az is látja. Beállítás: `config.js` → `ctf`.
- **Felmosókocsi:** az EAR raktár előtt vezethető felmosókocsi áll (K = fel/le, telefonon „Kocsi”; W/S = gáz/fék,
  A/D vagy egér = kormány). 7 m/s-mal megy – gyorsabb a futásnál és a targoncáknál –, de aki rajta ül, csak vezetni
  tud (nem ugrik, nem lő, nem dob, zászlót és csomagot sem vesz fel). Egyszerre egy ember ülhet rajta; a helye
  mindenkinél ugyanaz (megőrzött MQTT-üzenet). Beállítás: `config.js` → `felmosoKocsi`.
- A többiek neve és életerő-csíkja belső nézetben nem látszik át a falon és az állványon.
- **Küldetés (komissiózás időre):** N (vagy a menü „Új küldetés” gombja) belső nézetben 3 véletlen tárhelyet oszt ki.
  Sorban fel kell keresni őket (a cél fölött zöld fénycsík a kóddal, fent kijelző az iránnyal, a távolsággal és az idővel),
  majd a kiszedett árut a komissiózó lerakóba vinni. A legjobb idő ezen a gépen megmarad, a teljesítést a többiek is
  látják. Újra N = feladás. Beállítás: `config.js` → `kuldetes`.
- **Távcsöves puska:** a galérián és az áruátvételen, az AK-ládák mellett. Egyesével lő, −80 HP; jobb egérgomb vagy Z =
  távcső (4× nagyítás, távcsővel szinte pontos). Q = váltás AK / puska / palack. Beállítás: `config.js` → `puska`, `puskaLadak`.
- **Gránát:** a fegyverládák 2-2 gránátot adnak (legfeljebb 4). T = dobás (telefonon „Gránát”); pattog, 2,5 mp múlva
  robban, 5 m-en belül a távolsággal csökkenő sebzés (középen 100 HP), a dobót is sebzi. Beállítás: `config.js` → `granat`.
- **Civilek:** két raktáros békát húz a folyosókon (mint a targoncák, mindenkinél ugyanott); a rakományon „ELFÉJSZ?” felirat. A béka rakománya a sor teljes
  szélességét elállja – kikerülni nem lehet, de fel lehet ugrani rá, és vele lehet utazni. Útban állót maga előtt tol.
  Beállítás: `config.js` → `civilek`.
- **Vad kutyák:** aki a raktáron kívülre megy (árukiadó udvar, fedett rakodó, fedett rész), azt 1,5 mp múlva egy
  3 kutyából álló falka kergetni kezdi 6 m/s-mal – gyorsabb a futásnál (4,5 m/s), csak a felmosókocsival lehet elmenekülni előlük; ha utolérik, kutyánként másodpercenként egy
  harapás, −10 HP. Akadályokat megkerülik, de a raktárba nem jönnek be; ha visszamész, 5 mp múlva elmennek.
  A bázisok 2,5 m-es körzete biztonságos, és aki egy tárgy tetejére mászik, azt sem érik el. A többiek is látják,
  ki elől menekülsz. Beállítás: `config.js` → `kutyak`.
- **Lidérc:** éjszakánként a pohármosóban születik egy lebegő, hosszú ősz hajú, világító szemű lidérc, és 8 m/s-mal
  (kicsit gyorsabban a felmosókocsinál) végiglebeg a raktár összes folyosóján; ha a végére ér, visszaindul. Akihez
  hozzáér, az azonnal meghal (a felmosókocsin ülő is). Mindenkinél ugyanott jár (a gép órájából számolódik).
  Beállítás: `config.js` → `liderc`.
- **Életerőcsomag** a logisztikai irodában (fehér doboz piros kereszttel): rámész, és +50 HP (legfeljebb 100).
  Utána 30 mp-ig nincs a helyén, mindenkinél. Hely és érték: `config.js` → `eletcsomagok` (több is lehet).
- **0 HP = halál:** 3 mp múlva újraéledsz a kiindulóponton. A **pontlista** (a fejléc 👥 gombja) mutatja, ki hányszor halt
  meg (☠) és hányszor ölt (🎯); a saját pontjaid a böngésződben megmaradnak, a menüben nullázhatók.
- Mindenki a saját életerejéért felel (ő dönti el, hogy eltalálták-e), az események az MQTT-n mennek. Akinél a játék ki van
  kapcsolva, azt nem lehet bántani. A sebzések a `config.js` `jatek` részében állíthatók.

### Targoncák

Három targonca jár folyamatosan véletlenszerű, zárt körutakon a széles folyosókon (a T1 folyosói és keresztfolyosója,
a fejfolyosó, a felső szárny alsó sávja és széles folyosói, a komissiózó és az áruátvétel; a szűk T2 folyosókba és a
T3-ba nem mennek be). A zsákutcák végén megállnak „rakodni” (a villa fel-le jár), előttük kék biztonsági fénypötty.
A mozgásuk a gép órájából számolódik, így **mindenkinél ugyanott vannak**, hálózat nélkül is (ha a gépek órája pár
másodpercen belül egyezik). **Aki útban van, azt elütik:** nagyot lök, és ha a játék be van kapcsolva, −40 HP
(„elütötte egy targonca”). Beállítások: `config.js` → `targoncak` (darabszám, sebesség, rakodási idő, sebzés,
kizárt folyosók, további utak; a `mag` átírásával más útvonalakat járnak).

## Fájlok

| Fájl | Mire való |
|---|---|
| `index.html` | maga az oldal |
| **`config.js`** | **a pontosítandó értékek: állványmagasság, szintek száma, folyosószélesség, falak** |
| `data/adatok.js` | az Excelből generált adatok (ne szerkeszd kézzel) |
| `tools/xlsx_to_adatok.py` | ez generálja a `data/adatok.js`-t az Excelből |
| `js/modell.js` | geometria: irány, mélység, ütközés, a feltételezések helye |
| `js/main.js` | 3D megjelenítés, séta, kereső, felület |
| `js/kozos.js` | közös nézet: a többi látogató pálcikaemberként (MQTT) |
| `js/jatek.js` | játék: lökés, palackdobás, életerő, pontlista |
| `js/targonca.js` | targoncák: folyosóhálózat, véletlen körutak, elütés |
| `js/ctf.js` | zászlófoglalás: csapatok, bázisok, zászlók, közös állás |
| `js/kocsi.js` | vezethető felmosókocsi |
| `js/kuldetes.js` | küldetés: komissiózás időre |
| `js/civilek.js` | békát húzó raktárosok (mozgó akadály) |
| `js/kutyak.js` | vad kutyák a raktáron kívül |
| `js/liderc.js` | éjszakai lidérc: végigjárja a folyosókat, érintésre öl |
| `js/ejszaka.js` | éjszakai mód a játékban: nappal–éjszaka ciklus, zseblámpa |
| `vendor/three/` | Three.js r170 helyi másolata (MIT licenc), így CDN nélkül is működik |
| `vendor/mqtt/` | MQTT.js 5.10.1 helyi másolata (MIT licenc) a közös nézethez |

## A konfiguráció átírása (`config.js`)

A fájl elején vannak a fő paraméterek:

```js
allvanyMagassag: 5.0,     // alapértelmezett állványmagasság (m)
szintekSzama: 4,          // alapértelmezett szintszám
folyosoSzelesseg: 2.6,    // alapértelmezett folyosószélesség (m)
folyosoSzelessegek: { 'F-4': 0.8, ... },   // folyosónként
zonak: { 'T2': { allvanyMagassag: 2.2, szintekSzama: 5, ... }, ... },  // zónánként
sorok: { 'T2|01': { allvanyMagassag: 3.0 } },                         // soronként
```

Az értékek sorrendje: a soronkénti felülírja a zónánkéntit, az pedig az alapértelmezettet.
A GitHubon a fájl megnyitása után a ceruza ikonnal közvetlenül szerkesztheted. A *Commit changes* után kb. egy perc,
amíg a Pages oldal frissül. Utána a böngészőben frissítsd az oldalt (Ctrl+F5).
A tizedesjel pont, nem vessző. Ha elírás miatt az oldal nem tölt be, a böngésző konzolja (F12) megmutatja, hol a hiba.

**A folyosószélesség hatása:** a tárhelyek koordinátái a táblázatból jönnek, ezeket nem mozdítja el.
A folyosószélesség a padlón jelölt folyosósávot és (ha `allvanyMelyseg: 'auto'`) az állványok mélységét határozza meg:
az állvány eleje a folyosó széléig ér. Ha a mélységet fix számra állítod (pl. `allvanyMelyseg: 1.2`), és egy
állvány így belelóg a folyosóba, a hely infópanelje figyelmeztet, és a menü „Modell saját feltételezései” része is jelzi.

## Helyszíni pontosítások rögzítése

A `config.js` „Helyszíni pontosítások” részében:

- `felsoSzarnyEltolasY`: a felső szárny függőleges eltolása az Excelhez képest (most 0, mert az Excel már javítva van).
- `ellenorizve`: az ellenőrzött feltételezések. A kulcs a táblázat cellája (a menüben a „Forrás”), az érték egy rövid
  megjegyzés. Ezek zölddel látszanak, és nem számítanak bele a ☰ gombon látható számba.

## Ha az Excel változik

```bash
pip install openpyxl
python3 tools/xlsx_to_adatok.py          # raktar_alaprajz_anonim.xlsx -> data/adatok.js
```

A script a cellák mentett értékeit olvassa, ezért az Excelt előbb mentsd el. A feltételezéseket automatikusan gyűjti:
minden cellát, amelynek szövegében szerepel a „feltételez” szó, és a Folyosók lap „Feltételezések” listáját.
Ha a K oszlopban egy sort másik folyosóhoz rendelsz, vagy az E oszlopban átírod egy folyosó helyét,
a modell a generálás után ezt követi: arra fordítja az állványt, és ahhoz igazítja a mélységét.

## Helyi kipróbálás

A modulok miatt az `index.html`-t nem lehet közvetlenül fájlként megnyitni, kell hozzá egy webszerver:

```bash
python3 -m http.server 8000
# majd a böngészőben: http://localhost:8000
```

## Amit feltételeztem (ellenőrizd)

Ezek a modell saját feltevései, nem a táblázatéi. A táblázat FELTÉTELEZÉS-ei külön, pirossal látszanak az oldalon.
A modell feltevéseit a ☰ menü sárga „Modell saját feltételezései” része is felsorolja.

1. **Koordináta-rendszer:** a Paraméterek lap szerint az origó a komissiózó bal felső sarka. X jobbra, Y lefelé nő,
   felülnézetben is így látszik (a T1 lent, a felső szárny bal fent).
2. **A tárhely X/Y pontja a rekesz közepe.** A rekesz szélessége a sorbeli szomszédok távolsága
   (T1: 1 m, T2: kb. 0,35 m, T3: kb. 0,5–0,67 m), legfeljebb 1,4 m.
3. **Merre néz az állvány:** a sor arra néz, amerre a hozzárendelt folyosó (Tárhelyek lap H oszlop). Ha a sor
   keresztben áll a folyosó végén (T3-03, T4-06, a T3-00 alja), akkor a folyosó közepe felé néz.
   A T3-00 U alakú, a szárai befelé néznek.
4. **Állványmélység (automatikus):** az eleje a folyosó széléig ér, hátul nem lóg bele a mögötte álló sorba, legfeljebb 1,2 m.
   Az eredmény jól egyezik a táblázat megjegyzéseivel (pl. „alsó falmenti sor ~6,4 m”, „fali állványok ~19,4 m”).
5. **Folyosószélesség:** ahol a táblázat ad értéket (F-4 0,8; F-5 0,9; F-6 1,4; F-7 2,2; 29. sor alatti folyosó 2,6 m),
   azt használom. A T1-F0 (3,4 m), a T1-K (3,2 m) és az F-SÁV (2,6 m) szélességét a Paraméterek lap megjegyzéseiből számoltam.
   A többi folyosó az alapértelmezett **2,6 m**.
6. **Állványmagasság és szintszám:** a táblázatban nincs, ezek becslések. T1: 6,5 m és 5 szint (helyszíni fotó alapján: padló + 4 gerendaszint), T2 (polc): 2,2 m és 5 szint,
   T3: 2,5 m és 4 szint, T4: 4,0 m és 3 szint.
7. **Falak:** a táblázat csak a komissiózó bal falát (X = 0) és a T4 alsó falát (Y = 7,8) adja meg. A többi fal helyét az
   állványok szélei alapján becsültem: felső szárny X −39,8…0 és Y −12,6…7,8 (az eltolás előtt, lásd lent),
   T1 csarnok X 0…20,6 és Y 15,6…89,8.
   A komissiózó jobb fala X = 16,19, mert a kijárat X-e (8,09) a fal közepe. A falak a `config.js`-ben átírhatók.
   `falakUtkoznek: false` esetén csak az állványok ütköznek.
8. **Komissiózó:** a „B5:R6” blokk a 0–7,8 m sáv, ennek alsó élén van a kijárat. Alatta 15,6 m-ig nyitott előteret
   rajzoltam, mert a Paraméterek lap szerint „a komissiózó alja 15,6 m”, és a fejfolyosó felé teljes szélességben nyitott.
9. **Átjáró a felső szárnyba – helyszínen pontosítva (2026-10-21), az Excelben is javítva:** az átjáró a T1-04 mellett
   van. Ezért az egész felső szárny (T2, T3, T4) 12,2 m-rel lejjebb került: az alsó sávja (F-SÁV) a T1 fejfolyosó
   vonalában fut (Y = 17,3), az átjáró a T1 bal falán, a (0; 17,3) pontban van (2 m-es nyílás, `atjaroSzelesseg`).
   Az Excelben átírt értékek:
   - Paraméterek: „T4 eltolás Y” 7,8 → 20,0; „Felső szárny alsó sáv Y” 5,1 → 17,3; „Átjáró a felső szárnyba Y” 5,1 → 17,3.
     A megjegyzésük „ELLENŐRIZVE” lett.
   - Folyosók: a FELSŐ szárny „Kapu → kiindulópont” távolsága 10,79 → 17,59 m; a felső szárny folyosóinak vége (F oszlop)
     5,1 → 17,3; a feltételezés-listában az átjáróról szóló sor „ELLENŐRIZVE”.
   - Tárhelyek: a felső szárny 496 helyén az Y és (a függőleges folyosóknál) a „Pozíció a folyosón” +12,2 m, a „Folyosóvég”
     17,3, a „Táv a kiindulóponttól” +6,8 m (a szárnyon belüli út nem változott, csak a kapu került messzebb).

   A `config.js`-ben a `felsoSzarnyEltolasY` ezért 0. Ha egyszer újra el kellene tolni a szárnyat, ott beállítható,
   és a távolságokat a modell is újraszámolja.
9b. **T1-03 sor, kék kapu, komissiózó bejárata – helyszíni info (2026-10-21):**
   - A T1-F0 fejfolyosó másik oldalán is áll egy állványsor, a **T1-03**. Az Excelbe 16 helyként vettem fel, a T1-04-gyel
     szemben, ugyanolyan számozással (X ugyanaz, Y = 15,0, a 04. sor tükörképe). A helyszám és a számozás FELTÉTELEZÉS.
     A „Rajzon” oszlopban „nincs a rajzon (helyszíni info)” áll. A „Táv” a 04. sor logikájával számolt érték.
   - A T1-F0 keleti vége a **kék szalagfüggönyös kapu** az árukiadó fedett udvarra (config.js: `ajtok`, `arukiado`;
     a kapu szélessége és az udvar mérete becsült).
   - A **komissiózó lerakó terület** a T1-03 fölött van, a bejárata a T1-03 keleti vége és a T1 jobb fala között,
     a kék kapu mellett. Emiatt a komissiózó nem teljes szélességben nyílik a T1-F0-ra. Ez FELTÉTELEZÉS a pontos
     helyre (a távolságokat lásd lent).
9c. **Kiindulópont és távolságok – helyszíni info (2026-10-21):** a kiindulópont a **komissiózó lerakó terület közepe**.
   A terület méretét X 0–20,6 m, Y 0–14,4 m-nek vettem (FELTÉTELEZÉS), így a kiindulópont (10,3; 7,2). A T1-03 sor miatt
   a komissiózóból a keleti bejáraton át, a keresztfolyosó vonalában (X = 17,8) lehet kilépni a T1-F0-ra; a felső szárnyba
   ezután a T1-F0-n nyugatra, az átjárón át vezet az út. Ezért az Excelben újraszámoltam a „Táv a kiindulóponttól” oszlopot
   (a lap eddigi képletével, amely mind a 976 helyen pontosan visszaadta a régi értékeket):
   - Folyosók lap, „Kapu → kiindulópont”: T1 19,21 → **17,6 m**, FELSŐ 17,59 → **35,4 m**;
   - a T1-F0 „Komissiózóból közvetlenül” értéke „nem” lett, a 03. és 04. sor is a T1 kapun át számol;
   - a változás helyenként −1,6 … +17,8 m, átlagosan +8,8 m (a felső szárny lett messzebb).
   Az árukiadó fedett udvar kb. 14 × 50 m, a kék kapura középre igazítva; a pontos helye becsült.
9d. **További helyszíni elemek (2026-10-21), a `config.js`-ben:**
   - **Áruátvétel:** a T1-29 alatt van az áruátvételi terület. A T1 déli fala ezért 89,8 helyett 97,8 m-en van
     (a terület 8 m mély – becsült). A T1-29-cel szemben a **karantén tárhely** áll (kód nélküli állvány, `egyebAllvanyok`),
     a keleti falon a **sárga áruátvételi kapu** (`ajtok`).
   - **Fóliázógép** a 17–18. sor előtt, a 16–17. sor keleti végén, ahol a 01–02. hely hiányzik (`gepek`).
   - **Logisztikai iroda és mosdó** a komissiózó lerakó hátsó (északi) fala mögött, mindkettőbe ajtó vezet (`ajtok`).
     Az iroda L alakú: belépve balra a nagy terem (kb. 7,9 × 7 m, ablakos külső fallal), jobbra – a mosdó mögött –
     a kisebb rész (kb. 3,5 × 4,4 m). A méretek a fotók álmennyezet-lapjaiból becsültek (`falak`, `teruletek`).
   - A méretek és pontos helyek becsültek: a menüben a „config.js (helyszíni info)” forrású FELTÉTELEZÉS-ek
     (`helyszinFeltetelezesek`) jelzik őket; ha pontosítod, írd át ott az értéket, és töröld a tételt a listából.
9e. **Galéria, kijárat, EAR raktár – helyszíni info (2026-10-21, IMG_3283–3288), a `config.js`-ben:**
   - **Galéria a T2 polcos zóna fölött** (`galeriak`): kb. 3 m magasan, X −16,9…−0,2, Y 0…16 m. A lépcső a T4-06-09 mellett
     indul, az északi fal mentén kelet felé emelkedik. A tetején kétszer jobbra fordulva a galéria nyugati szélén, az F-3 fölött
     van az **áru feladó / lerakó**. A lépcsőn fel lehet sétálni a galériára; a szélén korlát van, a T2 alatta
     a padlószintről továbbra is bejárható.
   - **Sárga kijárati gyorskapu** az északi falon, a T4-06 vége és a lépcső között. Kilépve balra **fedett rész** (`udvarok`).
   - **EAR raktár (elzárt):** zárt rekesz a T4-01 sor északi vége mögött, az északi falnál (`egyebAllvanyok`, `tomor: true`).
   - A gerendacímkék szerint a helykód után a szint betűje áll (pl. T4-06-09-A, -B, -C; az A a padlószint).
     A T4-ben ez 3 szint, ami egyezik a modellel.
   - **Pohármosó** (IMG_3289, 3291–3293): az áruátvételről nyílik, a karantén állvány alatti ajtón át (ott az állványnak csak a
     gerenda fölötti része van: `alsoMagassag`). A helyiség a déli fal mögé nyúlik ki, kb. 4 × 3,8 m.
   - **Fedett rakodó** (IMG_3290): az áruátvételi kapun kilépve balra, a keleti fal mentén, az árukiadó udvaráig (`udvarok`).
   - Minden méret és pontos hely becsült; a menüben a „config.js (helyszíni info)” FELTÉTELEZÉS-ek jelzik őket.
9f. **Oszlopkiosztás – helyszíni info (2026-10-21):** a T1 és T4 sorokban az 1–2. és a 3–4. hely egy-egy rekesz
   (nincs köztük oszlop), utána 3 tárhelyenként van oszlop (5–7., 8–10., 11–13., …). A `config.js` `oszlopKiosztas`
   részében állítható (mely zónák, az első rekeszek mérete, utána hány hely). Ha egy hely hiányzik (pl. a 16–17. sorban
   az 1–2.), a rekesz ott kettéválik. A T1 fali sorai (31–33) és a T2/T3 most is helyenként vannak osztva.
9g. **Az árukiadó udvar – helyszíni info (IMG_3294–3298):** körbe van kerítve (`keritesek`). A déli végén, a bálázónál
   fal van, onnan nem lehet átmenni az áruátvétel felé (`falak`). A T1 keleti falán, a válaszfal közelében egy nem működő
   szekcionált kapu van (zárva, `ajtok`, `vag: false`). Tereptárgyak (`tereptargyak`): bálázó, raklapok, konténerek,
   dohányzórész székekkel. A helyek becsültek.
10. **A 10. és 11. sor közötti válaszfal:** a két sor hátoldala között fut, Y = 36,88-on, X = 0-tól 16,2-ig, vagyis az
    S oszlop (keresztfolyosó) előtt véget ér. A táblázat feltételezését így modelleztem.
11. **Jelöletlen helyek:** a 27 „(nincs kód)” hely ideiglenes kódot kapott: `T4-ALSO-01…24` (jelöletlen alsó sor),
    `T4-ROVID-01…03` (jelöletlen rövid sor). A szám a táblázat „Hely” oszlopa. A címkéjük sárga alapú.
12. **„Rajzon” oszlop** (kék X / üres keret / T2 polc …): nem tudom, mit jelent (foglalt vagy üres? más típusú hely?),
    ezért csak megjelenítem. A menüben a *Színezés: rajzi jel szerint* opcióval vizuálisan ellenőrizheted.
13. **A 10. számú táblázatbeli feltételezés** („a folyosón belül a tárhely előtti pontig számol…”) a távolságszámítás
    módjára vonatkozik, ezért nincs helye a modellben, csak a listában szerepel.

## GitHub Pages bekapcsolása

1. Ha a munka még a `claude/...` ágon van, előbb vond össze a `main` ágba. A GitHubon a repó oldalán:
   **Pull requests → New pull request**, a *compare* mezőben válaszd ki az ágat, majd **Create pull request → Merge**.
   (Ha nem akarsz összevonni, a 3. lépésben közvetlenül ezt az ágat is kiválaszthatod.)
2. A repóban nyisd meg a **Settings** (Beállítások) fület, és a bal oldali menüben kattints a **Pages**-re.
3. A **Build and deployment** résznél:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` (vagy a választott ág), a mappa: `/ (root)`, majd **Save**.
4. 1–2 perc múlva a Pages oldal tetején megjelenik a cím: `https://<felhasználónév>.github.io/raktar-3d/`.
   A folyamatot az **Actions** fülön a „pages build and deployment” futás mutatja.
5. **Privát repónál** a Pages csak fizetős csomagban (Pro/Team/Enterprise) érhető el. Ingyenes fióknál a repót
   nyilvánossá kell tenni (Settings → General → *Danger Zone* → *Change visibility*). Ilyenkor a táblázat is
   nyilvános lesz, az anonimizált adatok ellenére érdemes ezt mérlegelni.

Ezután minden `main`-re küldött módosítás (pl. a `config.js` átírása) kb. egy percen belül megjelenik az oldalon.
