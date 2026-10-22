// Civilek (config.js: civilek): raktárosok, akik békát (kézi raklapemelőt) húznak maguk után; a
// targoncákhoz hasonlóan véletlen körutakon járnak a folyosókon (a gép órájából számolva, mindenkinél
// ugyanott). A béka rakománya a folyosó teljes szélességét elállja: kikerülni nem lehet, de fel lehet
// állni rá (és vele utazni). Ütközőként a modell.js mozgó akadályai (racs.dinamikus) közé kerülnek.
import * as THREE from 'three';
import { korut } from './targonca.js';
import { hashSzam } from './modell.js';

function raktarosModell(n, szovegSprite) {
  const g = new THREE.Group();
  const a = szin => new THREE.MeshLambertMaterial({ color: szin });
  const bor = a('#e0b08a'), nadrag = a('#2f3a4c'), melleny = a(n % 2 ? '#ff8a1f' : '#d9f03a'), sotet = a('#2b2b2b');
  const henger = (h, r, m) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), m);
  const lab = () => { const p = new THREE.Group(); const l = henger(0.84, 0.06, nadrag); l.position.y = -0.42; p.add(l); p.position.y = 0.86; return p; };
  const balLab = lab(), jobbLab = lab(); balLab.position.x = -0.1; jobbLab.position.x = 0.1;
  const torzs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.58, 0.24), melleny); torzs.position.y = 1.16;
  const csik = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.05, 0.25), a('#e8eef2')); csik.position.y = 1.05;
  const fej = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), bor); fej.position.y = 1.6;
  const sapka = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.14, 0.08, 14), a('#1f5fbf')); sapka.position.y = 1.7;
  const ellenzo = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.1), a('#1f5fbf')); ellenzo.position.set(0, 1.67, -0.15);
  const kar = () => { const p = new THREE.Group(); const k = henger(0.6, 0.045, melleny); k.position.y = -0.3; p.add(k); p.position.y = 1.42; return p; };
  const balKar = kar(), jobbKar = kar(); balKar.position.x = -0.26; jobbKar.position.x = 0.26;
  jobbKar.rotation.x = -0.6; // hátranyúlik, ebben a kézben a béka rúdja
  g.add(balLab, jobbLab, torzs, csik, fej, sapka, ellenzo, balKar, jobbKar);
  const cimke = szovegSprite('Raktáros', 0.22, { hatter: '#3d4752', szin: '#fff', meret: 40 });
  cimke.position.y = 2.0; g.add(cimke);
  g.userData = { balLab, jobbLab, balKar, fazis: 0, sotet };
  return g;
}

// béka (kézi raklapemelő) raklappal és rakománnyal; a rakomány szélessége a folyosóhoz igazodik
function bekaModell(n) {
  const g = new THREE.Group();
  const fem = new THREE.MeshLambertMaterial({ color: '#c62828' }), fekete = new THREE.MeshLambertMaterial({ color: '#222' });
  for (const x of [-0.18, 0.18]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 1.15), fem); v.position.set(x, 0.05, 0.05); g.add(v); }
  const tomb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.18), fem); tomb.position.set(0, 0.2, -0.6); g.add(tomb);
  const rud = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), fekete);
  rud.position.set(0, 0.55, -0.95); rud.rotation.x = -0.75; g.add(rud);
  // raklap és rakomány (egységnyi dobozok, a szélességük frissítéskor skálázódik)
  const raklap = new THREE.Mesh(new THREE.BoxGeometry(1, 0.15, 1.2), new THREE.MeshLambertMaterial({ color: '#c8a165' }));
  raklap.position.set(0, 0.165, 0.05); g.add(raklap);
  const rakomany = new THREE.Mesh(new THREE.BoxGeometry(1, 0.45, 1.15), new THREE.MeshLambertMaterial({ color: n % 2 ? '#b98a5a' : '#a77a4c' }));
  rakomany.position.set(0, 0.465, 0.05); g.add(rakomany);
  const folia = new THREE.Mesh(new THREE.BoxGeometry(1, 0.46, 1.16), new THREE.MeshLambertMaterial({ color: '#dfe8ee', transparent: true, opacity: 0.25 }));
  folia.position.copy(rakomany.position); g.add(folia);
  g.userData = { raklap, rakomany, folia };
  return g;
}

export function inditCivilek({ C, M, scene, szovegSprite, seta, getMod, targoncak }) {
  const K = C.civilek;
  if (!K || !targoncak?.halo) return null;
  const db = Math.max(0, Math.round(Number(K.db ?? 2)));
  const seb = Number(K.sebesseg ?? 1.3), allas = Number(K.allasMp ?? 4);
  const MAG = Number(K.rakomanyMagassag ?? 0.75), HOSSZ = 1.25, TAV = 1.05; // a béka közepe ennyivel van a raktáros mögött
  const halo = targoncak.halo;
  const statikusUtkozik = (x, y) => M.racs.utkozik(x, y, 0.05, 0, 1.0);

  // a folyosó szélessége egy pontban, merőlegesen (n irányba +, ellenkező irányba −), a statikus akadályokig
  function szelesseg(x, y, nx, ny) {
    const max = Number(K.maxSzelesseg ?? 4) / 2;
    let p = 0, m = 0;
    while (p < max && !statikusUtkozik(x + nx * (p + 0.05), y + ny * (p + 0.05))) p += 0.05;
    while (m < max && !statikusUtkozik(x - nx * (m + 0.05), y - ny * (m + 0.05))) m += 0.05;
    return { w: Math.max(0.9, p + m - 0.04), eltol: (p - m) / 2 };
  }

  const civilek = [];
  for (let n = 0; n < db; n++) {
    const ut = korut(halo, `${K.mag ?? 'civil'}#${n}`, 70);
    if (ut.length < 2) continue;
    const lepesek = [];
    let ido = 0;
    for (let i = 1; i < ut.length; i++) {
      const a = halo.pontok[ut[i - 1]], b = halo.pontok[ut[i]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.05) continue;
      const fx = (b[0] - a[0]) / L, fy = (b[1] - a[1]) / L;
      const sz = szelesseg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, -fy, fx);
      lepesek.push({ t0: ido, t1: ido + L / seb, a, b, fx, fy, ...sz, all: false });
      ido += L / seb;
      if (halo.szom[ut[i]].length === 1) { lepesek.push({ t0: ido, t1: ido + allas, a: b, b, fx, fy, ...sz, all: true }); ido += allas; }
    }
    const ember = raktarosModell(n, szovegSprite), beka = bekaModell(n);
    scene.add(ember, beka);
    const utk = { x0: 0, y0: 0, x1: 0, y1: 0, z0: 0, z1: MAG, beka: true };
    const testUtk = { x0: 0, y0: 0, x1: 0, y1: 0, z0: 0, z1: 1.85 };
    M.racs.dinamikus.push(utk, testUtk);
    civilek.push({ n, ember, beka, lepesek, hossz: ido, eltolas: hashSzam(`civ${n}`) * ido, utk, testUtk, irany: 0, w: 1, px: null, py: null });
  }

  const allapotIdoben = (cv, t) => {
    const s = ((t + cv.eltolas) % cv.hossz + cv.hossz) % cv.hossz;
    let lo = 0, hi = cv.lepesek.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cv.lepesek[m].t1 < s) lo = m + 1; else hi = m; }
    return { l: cv.lepesek[lo], s };
  };

  function frissit(dt) {
    const t = Date.now() / 1000;
    for (const cv of civilek) {
      const { l, s } = allapotIdoben(cv, t);
      const u = l.all ? 1 : (s - l.t0) / Math.max(1e-6, l.t1 - l.t0);
      // a raktáros a szakaszon jár; a béka mögötte, a folyosó közepén
      const x = l.a[0] + (l.b[0] - l.a[0]) * u + -l.fy * l.eltol, y = l.a[1] + (l.b[1] - l.a[1]) * u + l.fx * l.eltol;
      const cel = Math.atan2(-l.fx, -l.fy);
      let d = cel - cv.irany; d = Math.atan2(Math.sin(d), Math.cos(d));
      cv.irany += d * Math.min(1, dt * 6);
      cv.w += (l.w - cv.w) * Math.min(1, dt * 4);
      const fx = -Math.sin(cv.irany), fy = -Math.cos(cv.irany);
      const bx = x - fx * TAV, by = y - fy * TAV;
      cv.ember.position.set(x, 0, y); cv.ember.rotation.y = cv.irany;
      cv.beka.position.set(bx, 0, by); cv.beka.rotation.y = cv.irany;
      const ud = cv.beka.userData;
      for (const m of [ud.raklap, ud.rakomany, ud.folia]) m.scale.x = cv.w;
      // séta: lábak lengenek (rakodáskor áll)
      const e = cv.ember.userData;
      if (!l.all) e.fazis += dt * seb * 4.2;
      const leng = l.all ? 0 : 0.45 * Math.sin(e.fazis);
      e.balLab.rotation.x = leng; e.jobbLab.rotation.x = -leng; e.balKar.rotation.x = -leng * 0.7;
      // ütközők (tengelyhez igazított téglalapok): a béka a folyosó teljes szélességében
      const hosszanX = Math.abs(fx) > Math.abs(fy);
      const hx = hosszanX ? HOSSZ / 2 : cv.w / 2, hy = hosszanX ? cv.w / 2 : HOSSZ / 2;
      const regi = { x0: cv.utk.x0, y0: cv.utk.y0, x1: cv.utk.x1, y1: cv.utk.y1 };
      Object.assign(cv.utk, { x0: bx - hx, x1: bx + hx, y0: by - hy, y1: by + hy });
      Object.assign(cv.testUtk, { x0: x - 0.25, x1: x + 0.25, y0: y - 0.25, y1: y + 0.25 });
      // a játékos: ha a békán áll, vele utazik; ha útban van, a béka (vagy a raktáros) maga előtt tolja
      if (cv.px != null && getMod() === 'seta' && !seta.halott) {
        const mx = bx - cv.px, my = by - cv.py;
        const r = Number(C.testSugar ?? 0.28), rajta = (q) => seta.x > q.x0 - r * 0.5 && seta.x < q.x1 + r * 0.5 && seta.y > q.y0 - r * 0.5 && seta.y < q.y1 + r * 0.5;
        if (Math.abs(seta.z - MAG) < 0.06 && rajta(regi)) { seta.x += mx; seta.y += my; }
        else if (M.racs.utkozik(seta.x, seta.y, r, seta.z, seta.guggol ? 1.0 : 1.8)) {
          [seta.x, seta.y] = M.racs.felold(seta.x + mx, seta.y + my, r, seta.z, seta.guggol ? 1.0 : 1.8);
        }
      }
      cv.px = bx; cv.py = by;
    }
  }

  return { frissit, civilek };
}
