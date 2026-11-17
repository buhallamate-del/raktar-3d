// Botok: gép vezérelte játékosok az egyjátékos módhoz (menü → Közös nézet → Játék → Botok).
// Csak akkor játszanak, ha a játék be van kapcsolva, és nincs valódi játékos a modellben (ha jön
// valaki, kilépnek). Nem mennek ki a hálózatra: a többiekhez hasonlóan pálcikaemberként jelennek meg
// (kozos.botFogad), így a pontlista, a meccs-összesítő, a minimap, a killcam és a zászlófoglalás
// ugyanúgy kezeli őket, mint egy távoli játékost.
// Sebzés: a mi lövéseinket, vágásainkat, robbanásainkat a jatek.js helyi címzettként nekünk is
// elküldi (jatek.helyiBe), és itt minden bot maga dönti el, hogy eltalálták-e – mint egy távoli gép.
// A botok lövései a jatek.esemeny-en át érnek el minket (ugyanúgy, mintha a hálózatról jönnének).
// Útkeresés: induláskor egy 0,5 m-es járhatósági rácsot építünk az ütközőrácsból (M.racs), és A*-gal
// keresünk rajta utat; az utat egyenes szakaszokra simítjuk.
const TAROL = 'raktar3d.botok';
const NEVEK = ['Targoncás Tibi', 'Komissiózó Kati', 'Leltáros Lili', 'Rakodó Rezső', 'Csomagoló Csilla', 'Műszakos Misi', 'Raktáros Robi', 'Szállítmányos Sanyi'];
const SZINEK = ['#8e44ad', '#16a085', '#d35400', '#34495e', '#b03a2e', '#1e8449', '#7f8c8d', '#b7950b'];
// nehézségi szintek: futás (m/s), reakcióidő (mp), szórás (rad), látótáv (m), látószög (a fél szög
// koszinusza), sebzésszorzó, sorozat (lövés), szünet a sorozatok közt (mp), lövés/mp, gránát
const SZINTEK = {
  1: { nev: 'könnyű', seb: 3.0, reakcio: 0.85, szoras: 0.08, latas: 28, lator: 0.45, sebzes: 0.45, sorozat: [2, 4], szunet: [1.0, 1.8], perMp: 5, granat: false },
  2: { nev: 'közepes', seb: 3.6, reakcio: 0.5, szoras: 0.05, latas: 40, lator: 0.2, sebzes: 0.7, sorozat: [3, 6], szunet: [0.6, 1.2], perMp: 7, granat: true },
  3: { nev: 'nehéz', seb: 4.2, reakcio: 0.28, szoras: 0.032, latas: 55, lator: -0.1, sebzes: 1, sorozat: [4, 8], szunet: [0.35, 0.75], perMp: 9, granat: true },
};
const DUMA = {
  oles: ['Ez az enyém!', 'Rend a raktárban!', 'Leltárhiány: 1', 'Bocs, főnök!', 'Következő!'],
  zaszlo: ['Megvan a zászló!', 'Fedezzetek!'],
  pont: ['Pont!', 'Hazaértem!'],
  halal: ['Jaj…', 'Ezt még visszakapod!', 'Na neee…'],
};
const vel = (a, b) => a + Math.random() * (b - a);
const valaszt = t => t[Math.floor(Math.random() * t.length)];

function betolt() {
  try { return JSON.parse(localStorage.getItem(TAROL)) || {}; } catch { return {}; }
}

// --- járhatósági rács és A* ------------------------------------------------
function epitNavi(M, magok) {
  const R = M.racs, L = 0.5, SUG = 0.3;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of R.t) {
    if (![t.x0, t.x1, t.y0, t.y1].every(Number.isFinite)) continue;
    x0 = Math.min(x0, t.x0); x1 = Math.max(x1, t.x1); y0 = Math.min(y0, t.y0); y1 = Math.max(y1, t.y1);
  }
  x0 = Math.max(x0, -400) - 2; y0 = Math.max(y0, -400) - 2; x1 = Math.min(x1, 400) + 2; y1 = Math.min(y1, 400) + 2;
  const W = Math.ceil((x1 - x0) / L), H = Math.ceil((y1 - y0) / L), N = W * H;
  const jar = new Uint8Array(N);
  const cx = i => x0 + ((i % W) + 0.5) * L, cy = i => y0 + (Math.floor(i / W) + 0.5) * L;
  for (let i = 0; i < N; i++) {
    const x = cx(i), y = cy(i), z = R.talaj(x, y, 0);
    if (z < 0.4 && !R.utkozik(x, y, SUG, z)) jar[i] = 1;
  }
  const cella = (x, y) => {
    const i = Math.floor((x - x0) / L), j = Math.floor((y - y0) / L);
    return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i;
  };
  // csak ami a magokból (a bázisok, a kiinduló pont) elérhető
  const jo = new Uint8Array(N), sor = new Int32Array(N);
  // a legközelebbi cella, amely a tömbben (jar vagy jo) jelölve van
  const kozeli = (x, y, max = 12, tomb = jo) => {
    const c = cella(x, y);
    if (c >= 0 && tomb[c]) return c;
    const ci = Math.floor((x - x0) / L), cj = Math.floor((y - y0) / L);
    for (let r = 1; r <= max; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= W || j >= H) continue;
        const k = j * W + i;
        if (tomb[k]) return k;
      }
    }
    return -1;
  };
  let eleje = 0, vege = 0;
  for (const [mx, my] of magok) {
    const m = kozeli(mx, my, 12, jar);
    if (m < 0 || jo[m]) continue;
    jo[m] = 1; sor[vege++] = m;
    while (eleje < vege) {
      const k = sor[eleje++], i = k % W, j = (k - i) / W;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= W || b >= H) continue;
        const n = b * W + a;
        if (jar[n] && !jo[n]) { jo[n] = 1; sor[vege++] = n; }
      }
    }
  }
  const elerheto = sor.slice(0, vege); // a bejárható cellák listája (véletlen célpontokhoz)
  const jarhato = (x, y) => { const c = cella(x, y); return c >= 0 && jo[c] === 1; };
  // egyenesen végig lehet-e menni (0,25 m-enként a rácson)
  function egyenes(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 0.25));
    for (let s = 0; s <= n; s++) if (!jarhato(ax + (bx - ax) * s / n, ay + (by - ay) * s / n)) return false;
    return true;
  }
  // A* (8 irány, sarkot nem vág), bináris kupaccal
  const g = new Float32Array(N), f = new Float32Array(N), honnan = new Int32Array(N), latott = new Uint32Array(N), zart = new Uint32Array(N);
  let gen = 0;
  const kupac = [];
  const fel = k => { kupac.push(k); let i = kupac.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[kupac[p]] <= f[kupac[i]]) break; [kupac[p], kupac[i]] = [kupac[i], kupac[p]]; i = p; } };
  const le = () => {
    const ki = kupac[0], u = kupac.pop();
    if (kupac.length) { kupac[0] = u; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < kupac.length && f[kupac[a]] < f[kupac[m]]) m = a; if (b < kupac.length && f[kupac[b]] < f[kupac[m]]) m = b; if (m === i) break; [kupac[m], kupac[i]] = [kupac[i], kupac[m]]; i = m; } }
    return ki;
  };
  const SZ = Math.SQRT2;
  function ut(ax, ay, bx, by) {
    const s = kozeli(ax, ay), c = kozeli(bx, by);
    if (s < 0 || c < 0 || !jo[s] || !jo[c]) return null;
    if (egyenes(ax, ay, bx, by)) return [[bx, by]];
    gen++; kupac.length = 0;
    const ci = c % W, cj = (c - ci) / W;
    const h = k => { const i = k % W, j = (k - i) / W, dx = Math.abs(i - ci), dy = Math.abs(j - cj); return Math.max(dx, dy) + (SZ - 1) * Math.min(dx, dy); };
    g[s] = 0; f[s] = h(s); latott[s] = gen; honnan[s] = -1; fel(s);
    let lep = 0, talalt = false;
    while (kupac.length && lep++ < 60000) {
      const k = le();
      if (zart[k] === gen) continue;
      zart[k] = gen;
      if (k === c) { talalt = true; break; }
      const i = k % W, j = (k - i) / W;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= W || b >= H) continue;
        const n = b * W + a;
        if (!jo[n] || zart[n] === gen) continue;
        if (di && dj && (!jo[j * W + a] || !jo[b * W + i])) continue;
        const ng = g[k] + (di && dj ? SZ : 1);
        if (latott[n] !== gen || ng < g[n]) { latott[n] = gen; g[n] = ng; f[n] = ng + h(n); honnan[n] = k; fel(n); }
      }
    }
    if (!talalt) return null;
    const pontok = [];
    for (let k = c; k >= 0; k = honnan[k]) pontok.push([cx(k), cy(k)]);
    pontok.reverse();
    pontok[pontok.length - 1] = jarhato(bx, by) ? [bx, by] : pontok[pontok.length - 1];
    // simítás: mindig a legtávolabbi, egyenesen elérhető pontig
    const ki = [];
    let px = ax, py = ay, i = 0;
    while (i < pontok.length) {
      let j = pontok.length - 1;
      while (j > i && !egyenes(px, py, pontok[j][0], pontok[j][1])) j--;
      ki.push(pontok[j]); [px, py] = pontok[j]; i = j + 1;
    }
    return ki;
  }
  const veletlen = () => { const k = elerheto[Math.floor(Math.random() * elerheto.length)]; return [cx(k) + vel(-0.15, 0.15), cy(k) + vel(-0.15, 0.15)]; };
  return { ut, egyenes, jarhato, veletlen, db: vege, W, H };
}

export function inditBotok({ C, M, seta, kozos, jatek, getCtf, getMeccs, getEjszaka, uzenet, getMod, kiindulo }) {
  if (!kozos?.botFogad || !jatek?.helyiBe) return null;
  const el = id => document.getElementById(id);
  const tar = betolt();
  let db = Number.isFinite(+tar.db) ? Math.max(0, Math.min(7, +tar.db)) : 3;
  let szint = SZINTEK[tar.szint] ? +tar.szint : 2;
  const ment = () => { try { localStorage.setItem(TAROL, JSON.stringify({ db, szint })); } catch { /* nincs tárhely */ } };

  // --- felület ---
  const dbSel = el('botDb'), szSel = el('botSzint');
  if (dbSel) {
    dbSel.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}">${n ? `${n} bot` : 'nincs'}</option>`).join('');
    dbSel.value = String(db);
    dbSel.addEventListener('change', () => { db = +dbSel.value; ment(); ujraindit = true; });
  }
  if (szSel) {
    szSel.value = String(szint);
    szSel.addEventListener('change', () => { szint = +szSel.value; ment(); ujraindit = true; });
  }

  let navi = null, naviHiba = false;
  const botok = [];
  let aktiv = false, ujraindit = false, ctfVolt = null;
  const most = () => performance.now();
  const S = () => SZINTEK[szint];
  const seb = () => jatek.sebzesek();
  const K = C.ctf || {};
  const visszaMs = Number(K.visszaMp ?? 30) * 1000;

  // --- csapatok ---
  const ctfMod = () => !!getCtf()?.jatszik?.();
  const enCs = () => getCtf()?.extra?.().cs || null;
  const enId = () => kozos.id;
  const botById = id => botok.find(b => b.id === id);
  // azonos csapatban vannak-e (zászlófoglalás nélkül mindenki mindenki ellen)
  function csapatOf(id) {
    if (!ctfMod()) return null;
    if (id === enId() || id === 'helyi') return enCs();
    return botById(id)?.cs || null;
  }
  const baratok = (a, b) => { const x = csapatOf(a); return !!x && x === csapatOf(b); };

  function csapatokKioszt() {
    const [A, B] = getCtf()?.csapatok?.() || [];
    const en = enCs();
    const ctf = ctfMod() && A && en;
    const ell = ctf ? (en === A ? B : A) : null;
    const tars = ctf ? Math.floor((botok.length - 1) / 2) : 0;
    botok.forEach((b, i) => {
      b.cs = ctf ? (i < tars ? en : ell) : null;
      // szerep: a csapatban felváltva támadó és védő; a támadók viszik a zászlót
      b.szerep = ctf ? ((i < tars ? i : i - tars) % 2 === 0 ? 'tamado' : 'vedo') : 'vadasz';
    });
    ctfVolt = ctf ? en : false;
  }

  // --- létrehozás, újraéledés ---
  function ujBot(i) {
    const fegyver = i % 3 === 2 ? 'puska' : 'ak';
    return {
      id: `bot-${i + 1}`, nev: `${NEVEK[i % NEVEK.length]} 🤖`, szin: SZINEK[i % SZINEK.length], kn: i % 2 ? 'sisak' : 'melleny',
      fegyver, tarban: fegyver === 'puska' ? 5 : 30, toltesIg: 0,
      x: 0, y: 0, z: 0, yaw: 0, hp: 100, hal: false, halIdo: 0, d: 0, k: 0, mk: 0, md: 0, mi: null,
      kvx: 0, kvy: 0, ut: null, utCel: null, utIdo: 0, gondol: Math.random() * 0.25,
      celpont: null, latja: false, elsoLatas: 0, utolso: null, sorozat: 0, kovLoves: 0, granatIdo: 0, serult: null,
      oldal: Math.random() < 0.5 ? -1 : 1, oldalIdo: 0, beragad: { x: 0, y: 0, ido: 0 }, vedoCel: null, vedoIdo: 0,
      cs: null, szerep: 'vadasz',
    };
  }
  function elhelyez(b) {
    let x, y;
    const ctf = getCtf();
    if (b.cs && ctf?.bazis(b.cs)) {
      const bz = ctf.bazis(b.cs);
      for (let i = 0; i < 20; i++) { x = bz.x + vel(-2.5, 2.5); y = bz.y + vel(-2.5, 2.5); if (navi.jarhato(x, y)) break; }
    } else {
      // messze tőlünk, és ne lássunk rá azonnal
      let leg = null, legD = -1;
      for (let i = 0; i < 25; i++) {
        const [px, py] = navi.veletlen();
        const d = Math.hypot(px - seta.x, py - seta.y);
        if (d > 22 && !lat({ x: px, y: py, z: 0 }, { x: seta.x, y: seta.y, z: seta.z })) { leg = [px, py]; break; }
        if (d > legD) { legD = d; leg = [px, py]; }
      }
      [x, y] = leg;
    }
    Object.assign(b, { x, y, z: M.racs.talaj(x, y, 0), hp: 100, hal: false, ut: null, utCel: null, celpont: null, latja: false, utolso: null,
      tarban: b.fegyver === 'puska' ? 5 : 30, toltesIg: 0, kvx: 0, kvy: 0, serult: null, yaw: Math.random() * Math.PI * 2 });
    const t = kozos.tobbiek.get(b.id);
    if (t) { t.g.position.set(b.x, b.z, b.y); t.g.rotation.y = b.yaw; }
  }

  function indit() {
    if (!navi && !naviHiba) {
      try {
        const t0 = most();
        const cs = (C.ctf?.csapatok || []).map(c => [c.bazis.x, c.bazis.y]);
        navi = epitNavi(M, [...cs, [kiindulo?.x ?? seta.x, kiindulo?.y ?? seta.y], [seta.x, seta.y]]);
        console.info(`[botok] járhatósági rács: ${navi.W}×${navi.H}, ${navi.db} bejárható cella, ${Math.round(most() - t0)} ms`);
      } catch (e) { naviHiba = true; console.warn('[botok]', e); return false; }
    }
    if (!navi) return false;
    getCtf()?.botMod?.(true);
    for (let i = 0; i < db; i++) botok.push(ujBot(i));
    csapatokKioszt();
    for (const b of botok) elhelyez(b);
    aktiv = true;
    jatek.helyiBe({ esemeny: helyiEsemeny, talal: palackTalal });
    const ctf = ctfMod();
    uzenet(`🤖 ${db} bot csatlakozott (${S().nev}) – ${ctf ? `zászlófoglalás: ${botok.filter(b => b.cs === enCs()).length + 1} a ${botok.filter(b => b.cs && b.cs !== enCs()).length} ellen` : 'mindenki mindenki ellen'}`);
    return true;
  }
  function leallit(uz) {
    for (const b of botok) {
      // nálunk lévő zászlót a bázisra
      kozos.botTorol(b.id);
    }
    botok.length = 0;
    aktiv = false;
    jatek.helyiBe(null);
    getCtf()?.botMod?.(false);
    if (uz) uzenet(uz);
  }

  // --- látás ---
  const v = { x: 0, y: 0, z: 0 };
  // a bot szeméből (1,5 m) a cél törzséig nincs-e akadály
  function lat(a, c, cMag = 1.2) {
    const ox = a.x, oy = (a.z || 0) + 1.5, oz = a.y;
    const tx = c.x, ty = (c.z || 0) + cMag, tz = c.y;
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, d = Math.hypot(dx, dy, dz);
    if (d < 0.5) return true;
    v.x = dx / d; v.y = dy / d; v.z = dz / d;
    return jatek.lovedekHossz({ x: ox, y: oy, z: oz }, v3(v.x, v.y, v.z), d) >= d - 0.3;
  }
  // a jatek.lovedekHossz THREE.Vector3-at vár: elég egy kicsi, kompatibilis objektum
  function v3(x, y, z) { return { x, y, z }; }

  // élő, játszó célpontok: mi és a botok
  function celpontok() {
    const l = [];
    if (jatek.jatekBe() && getMod() === 'seta' && !seta.halott && !seta.nezo) {
      l.push({ id: enId(), nev: kozos.nev(), x: seta.x, y: seta.y, z: seta.z, mag: seta.guggol ? 0.75 : 1.25, en: true });
    }
    for (const b of botok) if (!b.hal) l.push({ id: b.id, nev: b.nev, x: b.x, y: b.y, z: b.z, mag: 1.25, b });
    return l;
  }

  // --- sebzés a botokon ---
  function sebez(b, n, tolId, tolNev, ok) {
    if (b.hal || !(n > 0)) return;
    if (tolId && tolId !== b.id && baratok(tolId, b.id)) return;
    b.hp -= n;
    kozos.villant(b.id);
    if (tolId && tolId !== b.id) {
      b.serult = { id: tolId, ido: most() };
      const c = celpontok().find(x => x.id === tolId);
      if (c) { b.celpont = tolId; b.utolso = { x: c.x, y: c.y, z: c.z, ido: most() }; }
    }
    if (b.hp <= 0) meghal(b, tolId, tolNev, ok);
  }
  function meghal(b, tolId, tolNev, ok) {
    b.hal = true; b.hp = 0; b.halIdo = most(); b.d++; b.md++;
    zaszloElejt(b);
    if (Math.random() < 0.3) kozos.buborek(b.id, valaszt(DUMA.halal));
    const tettes = tolId && tolId !== b.id ? tolId : null;
    const e = { t: 'halal', cel: b.id, celNev: b.nev, tol2: tettes, tol2Nev: tettes ? tolNev : undefined, ok, bot: 1 };
    jatek.esemeny(e);
    olesJovairas(e);
  }
  // egy bot ölt (minket vagy egy másik botot)
  function olesJovairas(e) {
    const g = botById(e.tol2);
    if (!g) return;
    g.k++; g.mk++;
    if (e.cel === enId()) { g.celpont = null; g.utolso = null; }
    if (Math.random() < 0.35) kozos.buborek(g.id, valaszt(DUMA.oles));
  }

  // lövés sugara és egy bot teste (függőleges szakasz) – mint a jatek.js lovesTalal
  function sugarTalal(e, b) {
    const ox = +e.x, oy = +e.y, oz = +e.z, dx = +e.dx, dy = +e.dy, dz = +e.dz, h = +e.h;
    const hv2 = dx * dx + dz * dz;
    if (hv2 < 1e-6) return -1;
    const t = Math.max(0, Math.min(h, ((b.x - ox) * dx + (b.y - oz) * dz) / hv2));
    const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
    return Math.hypot(px - b.x, pz - b.y) < 0.4 && py > b.z && py < b.z + 2.0 ? t : -1;
  }
  function lovesBotokon(e) {
    let leg = null, legT = Infinity;
    for (const b of botok) {
      if (b.hal || b.id === e.tol || baratok(e.tol, b.id)) continue;
      const t = sugarTalal(e, b);
      if (t >= 0 && t < legT) { leg = b; legT = t; }
    }
    if (leg) sebez(leg, Math.max(0, Math.min(100, Number(e.s) || 10)), e.tol, e.nev, 'loves');
  }
  function robbanBotokon(e) {
    const rc = seb().robban?.[e.fj] || seb().robban?.granat || { sugar: 5, sebzes: 100 };
    const ki = e.fj === 'akna' ? e.gazda : e.tol, kiNev = e.fj === 'akna' ? e.gazdaNev : e.nev;
    for (const b of botok) {
      if (b.hal) continue;
      const dx = b.x - +e.x, dy = b.y - +e.z, dz = b.z + 0.9 - +e.y, d = Math.hypot(dx, dy, dz);
      if (d >= rc.sugar) continue;
      const ero = d < 1 ? 1 : 1 - (d - 1) / Math.max(0.1, rc.sugar - 1), hd = Math.hypot(dx, dy) || 1;
      b.kvx += dx / hd * 7 * ero; b.kvy += dy / hd * 7 * ero;
      sebez(b, Math.round(rc.sebzes * ero), ki, kiNev, e.fj || 'granat');
    }
  }

  // a mi eseményeink (jatek.js → helyi címzett): mintha egy távoli gép kapná meg őket
  function helyiEsemeny(e) {
    if (!aktiv) return;
    const b = e.cel && botById(e.cel);
    if (e.t === 'loves') lovesBotokon(e);
    else if (e.t === 'lokes' && b) {
      if (baratok(e.tol, b.id)) return;
      b.kvx += (Number(e.dx) || 0) * 6; b.kvy += (Number(e.dy) || 0) * 6;
      sebez(b, seb().lokes, e.tol, e.nev, 'lokes');
    } else if (e.t === 'vagas' && b) sebez(b, Math.max(0, Math.min(60, Number(e.s) || 50)), e.tol, e.nev, 'katana');
    else if (e.t === 'talalat' && b) sebez(b, Number(e.s) || seb().palack, e.tol, e.nev, 'palack');
    else if (e.t === 'robban') { if ([e.x, e.y, e.z].every(Number.isFinite)) robbanBotokon(e); }
    else if (e.t === 'halal' && e.cel === enId()) olesJovairas(e);
  }
  // a saját palackunk eltalált-e egy botot (jatek.js kérdezi)
  function palackTalal(p, tol) {
    for (const b of botok) {
      if (b.hal || baratok(tol, b.id)) continue;
      if (Math.hypot(p.x - b.x, p.z - b.y) < 0.4 && p.y > b.z && p.y < b.z + 2.0) return b.id;
    }
    return null;
  }

  // --- a botok támadásai ---
  function lo(b, c) {
    const s = S(), puska = b.fegyver === 'puska';
    const o = { x: b.x, y: b.z + 1.45, z: b.y };
    let dx = c.x - o.x, dy = (c.z + c.mag) - o.y, dz = c.y - o.z;
    const d = Math.hypot(dx, dy, dz);
    const sz = (puska ? 0.35 : 1) * s.szoras * (b.latja && most() - b.elsoLatas > 1500 ? 0.8 : 1);
    dx = dx / d + (Math.random() - 0.5) * sz * 2; dy = dy / d + (Math.random() - 0.5) * sz * 2; dz = dz / d + (Math.random() - 0.5) * sz * 2;
    const n = Math.hypot(dx, dy, dz); dx /= n; dy /= n; dz /= n;
    const tav = puska ? 150 : 60;
    const h = jatek.lovedekHossz(o, v3(dx, dy, dz), Math.min(tav, d + 8));
    const k = x => +x.toFixed(3);
    // a puskás bot nem visz el egy lövéssel szinte mindent (az egy embernek is kemény ellenfél lenne)
    const alap = puska ? seb().puska * 0.6 : seb().ak;
    const e = { t: 'loves', tol: b.id, nev: b.nev, x: k(o.x), y: k(o.y), z: k(o.z), dx: k(dx), dy: k(dy), dz: k(dz), h: +h.toFixed(2), s: Math.max(1, Math.round(alap * s.sebzes)), fp: b.fegyver };
    jatek.esemeny(e); // minket ez talál el (és ez rajzolja a nyomjelzőt, ez szól)
    lovesBotokon(e);
    b.tarban--;
    if (b.tarban <= 0) b.toltesIg = most() + (puska ? 3000 : 2000);
  }
  let granatSz = 0;
  function granat(b, cel) {
    const o = { x: b.x, y: b.z + 1.5, z: b.y };
    const dx = cel.x - o.x, dz = cel.y - o.z, d = Math.hypot(dx, dz), ido = Math.max(0.7, Math.min(1.4, d / 11));
    const vx = dx / ido, vz = dz / ido, vy = (((cel.z || 0) + 0.3 - o.y) + 0.5 * 9.81 * ido * ido) / ido;
    const id = `${b.id}-g${++granatSz}`;
    const k = x => +x.toFixed(2);
    jatek.esemeny({ t: 'granat', id, tol: b.id, nev: b.nev, x: k(o.x), y: k(o.y), z: k(o.z), vx: k(vx), vy: k(vy), vz: k(vz) });
    b.granatIdo = most();
    setTimeout(() => {
      const p = jatek.granatPoz(id);
      if (!p || !aktiv) return;
      const e = { t: 'robban', id, tol: b.id, nev: b.nev, x: k(p.x), y: k(p.y), z: k(p.z), fj: 'granat' };
      jatek.esemeny(e);
      robbanBotokon(e);
    }, seb().granatGyujto || 2500);
  }

  // --- zászlófoglalás ---
  function zaszloNala(b) {
    const a = getCtf()?.allapot?.();
    if (!a) return null;
    return Object.keys(a.z).find(f => a.z[f].a === 'visz' && a.z[f].ki === b.id) || null;
  }
  function zaszloElejt(b) {
    const f = zaszloNala(b), ctf = getCtf();
    if (!f || !ctf) return;
    ctf.valtoztat(s => { s.z[f] = { a: 'le', x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2), ig: Date.now() + visszaMs }; },
      `${b.nev} elejtette a ${ctf.csapatNev(f)} zászlót`);
  }
  function zaszloLogika(b) {
    const ctf = getCtf();
    if (!b.cs || !ctf?.jatszik?.()) return;
    const a = ctf.allapot(), sajat = b.cs, ell = ctf.masik(sajat);
    const ez = a.z[ell], sz = a.z[sajat], bz = ctf.bazis(sajat);
    const kozel = (p, r) => p && Math.hypot(b.x - p.x, b.y - p.y) < r && Math.abs(b.z - (+p.z || 0)) < 1.5;
    const nala = zaszloNala(b);
    if (!nala) {
      const hol = ez.a === 'bazis' ? ctf.bazis(ell) : ez.a === 'le' ? ez : null;
      if (kozel(hol, 1.0)) {
        ctf.valtoztat(s => { s.z[ell] = { a: 'visz', ki: b.id, nev: b.nev }; }, `🚩 ${b.nev} (${ctf.csapatNev(sajat)}) megszerezte a ${ctf.csapatNev(ell)} zászlót!`);
        if (Math.random() < 0.6) kozos.buborek(b.id, valaszt(DUMA.zaszlo));
        b.ut = null;
      }
    }
    if (sz.a === 'le' && kozel(sz, 1.0)) ctf.valtoztat(s => { s.z[sajat] = { a: 'bazis' }; }, `${b.nev} visszavitte a ${ctf.csapatNev(sajat)} zászlót`);
    if (zaszloNala(b) === ell && kozel(bz, 1.8) && sz.a === 'bazis') {
      const uj = a.pont[sajat] + 1;
      if (uj >= ctf.gyozelem) {
        const ered = `${uj}:${a.pont[ell]}`;
        ctf.valtoztat(s => { s.z[ell] = { a: 'bazis' }; s.pont = { [sajat]: 0, [ell]: 0 }; },
          `🏆 ${b.nev} hazavitte a zászlót – a ${ctf.csapatNev(sajat)} csapat nyerte a kört (${ered})! Új kör.`);
      } else {
        ctf.valtoztat(s => { s.z[ell] = { a: 'bazis' }; s.pont[sajat] = uj; }, `🏁 ${b.nev} pontot szerzett a ${ctf.csapatNev(sajat)} csapatnak!`);
      }
      kozos.buborek(b.id, valaszt(DUMA.pont));
    }
  }
  // hová menjen a zászló miatt (vagy null)
  function zaszloCel(b) {
    const ctf = getCtf();
    if (!b.cs || !ctf?.jatszik?.()) return null;
    const a = ctf.allapot(), sajat = b.cs, ell = ctf.masik(sajat), ez = a.z[ell], sz = a.z[sajat];
    if (zaszloNala(b)) return { ...ctf.bazis(sajat), ok: 'haza' };
    // a saját zászlónkat viszik: a vivő után (bárki megy, aki közel van, a védők mindig)
    if (sz.a === 'visz') {
      const c = celpontok().find(x => x.id === sz.ki);
      if (c && (b.szerep === 'vedo' || Math.hypot(c.x - b.x, c.y - b.y) < 30)) return { x: c.x, y: c.y, ok: 'vivo', id: c.id };
    }
    if (sz.a === 'le' && (b.szerep === 'vedo' || Math.hypot(sz.x - b.x, sz.y - b.y) < 25)) return { x: +sz.x, y: +sz.y, ok: 'vissza' };
    if (b.szerep === 'tamado') {
      if (ez.a === 'bazis') return { ...ctf.bazis(ell), ok: 'zaszlo' };
      if (ez.a === 'le') return { x: +ez.x, y: +ez.y, ok: 'zaszlo' };
      // a mi csapatunkból viszi valaki: kíséret (a vivő közelében)
      const c = celpontok().find(x => x.id === ez.ki);
      if (c) return { x: c.x + vel(-3, 3), y: c.y + vel(-3, 3), ok: 'kiser' };
    }
    // védő: a saját bázis körül járőrözik
    const bz = ctf.bazis(sajat);
    if (!b.vedoCel || most() > b.vedoIdo) {
      for (let i = 0; i < 10; i++) {
        const x = bz.x + vel(-9, 9), y = bz.y + vel(-9, 9);
        if (navi.jarhato(x, y)) { b.vedoCel = { x, y }; break; }
      }
      b.vedoIdo = most() + vel(4000, 8000);
    }
    return b.vedoCel ? { ...b.vedoCel, ok: 'ved' } : null;
  }

  // --- gondolkodás (kb. 4×/mp) ---
  function gondolkodik(b) {
    const s = S(), t = most();
    const ejjel = !!getEjszaka()?.sotet?.();
    const latas = (b.fegyver === 'puska' ? 1.4 : 1) * s.latas * (ejjel ? 0.65 : 1);
    const fx = -Math.sin(b.yaw), fy = -Math.cos(b.yaw);
    let leg = null, legP = Infinity;
    for (const c of celpontok()) {
      if (c.id === b.id || baratok(b.id, c.id)) continue;
      const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy);
      if (d > latas) continue;
      const friss = b.serult && b.serult.id === c.id && t - b.serult.ido < 3000;
      const elol = d < 6 || friss || (dx * fx + dy * fy) / Math.max(d, 1e-3) > s.lator || (b.latja && b.celpont === c.id);
      if (!elol || !lat(b, c, c.mag)) continue;
      const p = d * (c.en ? 0.8 : 1) * (b.celpont === c.id ? 0.7 : 1); // minket és a már követett célt előnyben
      if (p < legP) { legP = p; leg = c; }
    }
    if (leg) {
      // reakcióidő (a puskásnak a célzás is idő)
      if (!b.latja || b.celpont !== leg.id) { b.elsoLatas = t; b.kovLoves = Math.max(b.kovLoves, t + (s.reakcio + (b.fegyver === 'puska' ? 0.6 : 0)) * 1000 * vel(0.8, 1.3)); }
      b.celpont = leg.id; b.latja = true; b.utolso = { x: leg.x, y: leg.y, z: leg.z, ido: t };
    } else {
      b.latja = false;
      if (b.utolso && t - b.utolso.ido > 7000) { b.utolso = null; b.celpont = null; }
    }
    // gránát a fedezék mögé (közepes és nehéz szinten)
    if (s.granat && !b.latja && b.utolso && t - b.utolso.ido < 3500 && t - b.granatIdo > 14000 && Math.random() < 0.3) {
      const d = Math.hypot(b.utolso.x - b.x, b.utolso.y - b.y);
      if (d > 6 && d < 18) granat(b, b.utolso);
    }
    // merre menjen
    const zc = zaszloCel(b);
    let cel = null;
    const csomag = b.hp < 40 ? kozeliCsomag(b) : null;
    if (zc?.ok === 'haza') cel = zc;
    else if (csomag) cel = csomag;
    else if (b.latja) {
      // harc: a puskás távolabbról, az AK-s közelebbről; oldalazás
      const c = celpontok().find(x => x.id === b.celpont);
      const d = c ? Math.hypot(c.x - b.x, c.y - b.y) : 0;
      const jo = b.fegyver === 'puska' ? [12, 40] : [5, 16];
      if (t > b.oldalIdo) { b.oldal = Math.random() < 0.5 ? -1 : 1; b.oldalIdo = t + vel(700, 1600); }
      if (c) {
        const nx = (c.x - b.x) / Math.max(d, 1e-3), ny = (c.y - b.y) / Math.max(d, 1e-3);
        const elore = d > jo[1] ? 1 : d < jo[0] ? -0.7 : 0;
        cel = { x: b.x + (nx * elore - ny * b.oldal * 0.8) * 2.5, y: b.y + (ny * elore + nx * b.oldal * 0.8) * 2.5, ok: 'harc', kozvetlen: true };
        if (zc && (zc.ok === 'vivo' || zc.ok === 'zaszlo') && Math.random() < 0.5) cel = zc; // a zászló fontosabb
      }
    } else if (zc) cel = zc;
    else if (b.utolso) cel = { x: b.utolso.x, y: b.utolso.y, ok: 'nyom' };
    else {
      // kóborlás: néha arra, amerre minket „hallanak”
      if (!b.utCel || Math.hypot(b.utCel[0] - b.x, b.utCel[1] - b.y) < 1.2 || t - b.utIdo > 25000) {
        let p = null;
        if (jatek.jatekBe() && getMod() === 'seta' && Math.random() < 0.45) {
          for (let i = 0; i < 10; i++) { const x = seta.x + vel(-14, 14), y = seta.y + vel(-14, 14); if (navi.jarhato(x, y)) { p = [x, y]; break; } }
        }
        const [x, y] = p || navi.veletlen();
        cel = { x, y, ok: 'jar' };
      } else cel = { x: b.utCel[0], y: b.utCel[1], ok: 'jar' };
    }
    b.mod = cel?.ok || 'all';
    if (!cel) { b.ut = null; return; }
    if (cel.kozvetlen) { b.ut = [[cel.x, cel.y]]; b.utCel = null; return; }
    // új útvonal, ha a cél elmozdult, vagy rég terveztünk
    const regi = b.utCel;
    if (!b.ut || !regi || Math.hypot(regi[0] - cel.x, regi[1] - cel.y) > 2 || t - b.utIdo > 4000) {
      const ut = navi.ut(b.x, b.y, cel.x, cel.y);
      b.ut = ut; b.utCel = [cel.x, cel.y]; b.utIdo = t;
      if (!ut && cel.ok === 'jar') b.utCel = null; // elérhetetlen kóborlási cél: legközelebb másikat
    }
  }
  function kozeliCsomag(b) {
    let leg = null, legD = 45;
    const ido = Date.now();
    for (const c of jatek.csomagok || []) {
      if (ido < c.ig) continue;
      const d = Math.hypot(c.x - b.x, c.y - b.y);
      if (d < legD) { legD = d; leg = c; }
    }
    return leg ? { x: leg.x, y: leg.y, ok: 'csomag', csomag: leg } : null;
  }
  function csomagFelvesz(b) {
    if (b.hp >= 100) return;
    const ido = Date.now();
    for (const c of jatek.csomagok || []) {
      if (ido < c.ig || Math.hypot(c.x - b.x, c.y - b.y) > 0.7) continue;
      b.hp = Math.min(100, b.hp + c.hp);
      jatek.esemeny({ t: 'csomag', idx: c.idx, ig: ido + c.ujraMp * 1000 });
      return;
    }
  }

  // --- mozgás és lövés (képkockánként) ---
  function leptet(b, dt) {
    const s = S(), t = most();
    // lökés / robbanás lendülete
    if (Math.abs(b.kvx) + Math.abs(b.kvy) > 0.05) {
      const [nx, ny] = M.racs.mozgat(b.x, b.y, b.kvx * dt, b.kvy * dt, 0.28, b.z, 1.8);
      b.x = nx; b.y = ny;
      const csill = Math.exp(-dt * 6); b.kvx *= csill; b.kvy *= csill;
    }
    let mozgott = 0;
    const nala = zaszloNala(b);
    const sebesseg = s.seb * (b.latja && b.mod === 'harc' ? 0.55 : 1) * (nala ? 0.92 : 1);
    if (b.ut?.length) {
      const [cx, cy] = b.ut[0];
      const dx = cx - b.x, dy = cy - b.y, d = Math.hypot(dx, dy);
      if (d < 0.35) b.ut.shift();
      else {
        const lep = Math.min(d, sebesseg * dt);
        const [nx, ny] = M.racs.mozgat(b.x, b.y, dx / d * lep, dy / d * lep, 0.28, b.z, 1.8);
        mozgott = Math.hypot(nx - b.x, ny - b.y);
        b.x = nx; b.y = ny;
        if (!b.latja) b.cyaw = Math.atan2(-dx, -dy);
      }
    }
    b.z = M.racs.talaj(b.x, b.y, b.z + 0.36);
    // beragadt: másik útvonal
    if (t - b.beragad.ido > 1500) {
      if (b.ut?.length && Math.hypot(b.x - b.beragad.x, b.y - b.beragad.y) < 0.4) { b.ut = null; b.utCel = null; b.oldal *= -1; }
      b.beragad = { x: b.x, y: b.y, ido: t };
    }
    // ne bújjanak egymásba (és belénk se)
    const masok = botok.filter(m => m !== b && !m.hal).map(m => [m.x, m.y]);
    if (!seta.halott && getMod() === 'seta') masok.push([seta.x, seta.y]);
    for (const [mx, my] of masok) {
      const ex = b.x - mx, ey = b.y - my, e = Math.hypot(ex, ey);
      if (e < 0.6 && e > 1e-4) {
        const [nx, ny] = M.racs.mozgat(b.x, b.y, ex / e * (0.6 - e) * 0.5, ey / e * (0.6 - e) * 0.5, 0.28, b.z, 1.8);
        b.x = nx; b.y = ny;
      }
    }
    // célzás és lövés
    const c = b.latja && celpontok().find(x => x.id === b.celpont);
    if (c) b.cyaw = Math.atan2(-(c.x - b.x), -(c.y - b.y));
    if (b.cyaw != null) {
      let dy = b.cyaw - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      b.yaw += dy * Math.min(1, dt * (c ? 9 : 6));
    }
    if (c && b.toltesIg && t >= b.toltesIg) { b.toltesIg = 0; b.tarban = b.fegyver === 'puska' ? 5 : 30; }
    if (c && !b.toltesIg && t >= b.kovLoves) {
      let hiba = b.cyaw - b.yaw; hiba = Math.abs(Math.atan2(Math.sin(hiba), Math.cos(hiba)));
      const meccsSzunet = getMeccs()?.szunet?.();
      if (hiba < 0.3 && !meccsSzunet) {
        lo(b, c);
        if (b.fegyver === 'puska') b.kovLoves = t + 1250 * vel(1, 1.6);
        else {
          if (b.sorozat <= 0) b.sorozat = Math.round(vel(...s.sorozat));
          b.sorozat--;
          b.kovLoves = t + (b.sorozat > 0 ? 1000 / s.perMp : vel(...s.szunet) * 1000);
        }
      }
    } else if (!c && b.toltesIg && t >= b.toltesIg) { b.toltesIg = 0; b.tarban = b.fegyver === 'puska' ? 5 : 30; }
    else if (!c && b.tarban < (b.fegyver === 'puska' ? 3 : 12) && !b.toltesIg) b.toltesIg = t + 2000; // nyugalomban újratölt
    csomagFelvesz(b);
    zaszloLogika(b);
    return mozgott;
  }

  // a megjelenítéshez: ugyanaz az adat, mint ami egy távoli játékostól jönne
  function kozzetesz(b) {
    const m = getMeccs()?.extra?.() || {};
    if (m.mi != null && b.mi !== m.mi) { b.mi = m.mi; b.mk = 0; b.md = 0; }
    kozos.botFogad(b.id, {
      nev: b.nev, szin: b.szin, kn: b.kn, x: b.x, y: b.y, z: b.z, yaw: b.yaw, g: 0, m: 'seta',
      j: 1, h: Math.max(0, Math.round(b.hp)), d: b.d, k: b.k, hal: b.hal ? 1 : 0, f: b.fegyver === 'puska' ? 2 : 1,
      l: getEjszaka()?.sotet?.() ? 1 : 0, cs: b.cs || 0, ca: 0, mi: b.mi ?? undefined, mk: b.mk, md: b.md, mb: 0,
    });
  }

  function frissit(dt) {
    const jatszik = jatek.jatekBe() && db > 0;
    const valodi = kozos.valodiak();
    if (aktiv && (!jatszik || valodi || ujraindit)) {
      leallit(valodi ? '🤖 Valódi játékos érkezett – a botok kiléptek' : ujraindit ? null : '🤖 A botok kiléptek');
    }
    ujraindit = false;
    if (!aktiv && jatszik && !valodi) {
      if (!indit()) return;
    }
    if (!aktiv) return;
    // csapatváltás (vagy kilépés a zászlófoglalásból): újraosztás
    const ctfMost = ctfMod() ? enCs() : false;
    if (ctfMost !== ctfVolt) {
      for (const b of botok) zaszloElejt(b);
      csapatokKioszt();
      for (const b of botok) { if (!b.hal) elhelyez(b); }
      uzenet(ctfMost ? '🤖 A botok csapatot alkotnak (zászlófoglalás)' : '🤖 A botok mindenki mindenki ellen játszanak');
    }
    const t = most(), ujra = Number(C.jatek?.ujraeledesMp ?? 3) * 1000 + 2000;
    for (const b of botok) {
      if (b.hal) {
        if (t - b.halIdo > ujra) elhelyez(b);
      } else {
        b.gondol -= dt;
        if (b.gondol <= 0) { b.gondol = 0.25; gondolkodik(b); }
        leptet(b, dt);
      }
      kozzetesz(b);
    }
  }

  return {
    frissit,
    botok,
    aktiv: () => aktiv,
    beallit: (n, sz) => { if (Number.isFinite(n)) { db = Math.max(0, Math.min(7, n)); if (dbSel) dbSel.value = String(db); } if (SZINTEK[sz]) { szint = sz; if (szSel) szSel.value = String(sz); } ment(); ujraindit = true; },
    navi: () => navi,
    _teszt: { celpontok, lat, gondolkodik, granat, helyiEsemeny },
  };
}
