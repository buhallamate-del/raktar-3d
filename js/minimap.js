// Minitérkép (M = ki/be): az alaprajz felülről, rajta a saját helyed és irányod, a csapattársaid
// (zászlófoglalásnál), a zászlók és a bázisok, valamint a küldetés célja. Ellenfelet nem mutat
// (az olyan lenne, mintha átlátnánk a falon); ha nem játszol, mindenkit mutat.
const TAROL = 'raktar3d.minimap';

export function inditMinimap({ M, C, seta, kozos, getMod, getCtf, getKuldetes, jatekBe, lerako }) {
  const vaszon = document.getElementById('minimap');
  if (!vaszon) return null;
  let be = (() => { try { return localStorage.getItem(TAROL) !== 'ki'; } catch { return true; } })();
  // határok: az ütközők és a kinti területek együtt
  const rects = M.racs.t;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) { x0 = Math.min(x0, r.x0); y0 = Math.min(y0, r.y0); x1 = Math.max(x1, r.x1); y1 = Math.max(y1, r.y1); }
  for (const u of C.udvarok || []) { x0 = Math.min(x0, u.x); y0 = Math.min(y0, u.y); x1 = Math.max(x1, u.x + u.szel); y1 = Math.max(y1, u.y + u.mely); }
  x0 -= 2; y0 -= 2; x1 += 2; y1 += 2;
  const W = x1 - x0, Hh = y1 - y0;

  // háttér: egyszer rajzoljuk ki egy külön vászonra
  let hatter = null, skala = 1;
  function meretez() {
    const mag = innerWidth <= 640 ? 120 : 210;
    skala = mag / Hh;
    vaszon.width = Math.round(W * skala * devicePixelRatio); vaszon.height = Math.round(mag * devicePixelRatio);
    vaszon.style.width = `${Math.round(W * skala)}px`; vaszon.style.height = `${mag}px`;
    hatter = document.createElement('canvas');
    hatter.width = vaszon.width; hatter.height = vaszon.height;
    const g = hatter.getContext('2d'), s = skala * devicePixelRatio;
    g.fillStyle = 'rgba(16, 22, 32, 0.78)'; g.fillRect(0, 0, hatter.width, hatter.height);
    g.fillStyle = 'rgba(120, 130, 145, 0.35)';
    for (const u of C.udvarok || []) g.fillRect((u.x - x0) * s, (u.y - y0) * s, u.szel * s, u.mely * s);
    for (const r of rects) {
      if (r.z0 != null && r.z0 > 2) continue; // a galéria, a mennyezet ne takarjon
      g.fillStyle = r.allvany ? '#b5652a' : r.z1 == null ? '#c9d1db' : '#7d8794';
      g.fillRect((r.x0 - x0) * s, (r.y0 - y0) * s, Math.max(1, (r.x1 - r.x0) * s), Math.max(1, (r.y1 - r.y0) * s));
    }
  }
  meretez();
  addEventListener('resize', meretez);
  const ctx = vaszon.getContext('2d');
  const px = x => (x - x0) * skala * devicePixelRatio, py = y => (y - y0) * skala * devicePixelRatio;
  function pont(x, y, r, szin, keret = '#000') {
    ctx.beginPath(); ctx.arc(px(x), py(y), r * devicePixelRatio, 0, Math.PI * 2);
    ctx.fillStyle = szin; ctx.fill(); ctx.lineWidth = devicePixelRatio; ctx.strokeStyle = keret; ctx.stroke();
  }

  let utolso = 0;
  function frissit() {
    vaszon.hidden = !(be && getMod() === 'seta');
    if (vaszon.hidden) return;
    const t = performance.now();
    if (t - utolso < 100) return; // 10-szer másodpercenként elég
    utolso = t;
    ctx.drawImage(hatter, 0, 0);
    const ctf = getCtf?.(), sajat = jatekBe() && ctf?.csapat?.();
    // bázisok és zászlók
    if (ctf && jatekBe()) {
      for (const c of C.ctf?.csapatok || []) {
        ctx.beginPath(); ctx.arc(px(c.bazis.x), py(c.bazis.y), 4 * devicePixelRatio, 0, Math.PI * 2);
        ctx.strokeStyle = c.szin; ctx.lineWidth = 2 * devicePixelRatio; ctx.stroke();
        const z = ctf.allapot().z[c.id];
        let hol = z.a === 'bazis' ? c.bazis : z.a === 'le' ? z : null;
        if (z.a === 'visz') { const v = kozos?.tobbiek.get(z.ki); hol = z.ki === kozos?.id ? seta : v ? { x: v.g.position.x, y: v.g.position.z } : null; }
        if (hol) { ctx.font = `${11 * devicePixelRatio}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = c.szin; ctx.fillText('⚑', px(hol.x), py(hol.y)); }
      }
    }
    // küldetés célja
    const k = getKuldetes?.()?.allapot?.();
    if (k) {
      const c = k.idx < k.celok.length ? k.celok[k.idx].p : lerako;
      const villog = Math.sin(t / 200) > 0;
      pont(c.x, c.y, villog ? 4 : 3, k.idx < k.celok.length ? '#3ddc5a' : '#3d8bff', '#fff');
    }
    // többiek: csapatjátékban csak a csapattársak; ha nem játszol, mindenki
    for (const v of kozos?.tobbiek.values() || []) {
      if (v.cel.m === 'felul') continue;
      if (jatekBe() && (!sajat || v.cel.cs !== sajat)) continue;
      pont(v.g.position.x, v.g.position.z, 2.6, sajat ? ctf.szin(sajat) : v.szin, '#fff');
    }
    // mi: nyíl a nézési irányba
    const fx = -Math.sin(seta.yaw), fy = -Math.cos(seta.yaw), r = 6 * devicePixelRatio;
    const cx = px(seta.x), cy = py(seta.y);
    ctx.beginPath();
    ctx.moveTo(cx + fx * r, cy + fy * r);
    ctx.lineTo(cx - fx * r * 0.6 + fy * r * 0.55, cy - fy * r * 0.6 - fx * r * 0.55);
    ctx.lineTo(cx - fx * r * 0.6 - fy * r * 0.55, cy - fy * r * 0.6 + fx * r * 0.55);
    ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = devicePixelRatio; ctx.stroke();
  }

  return {
    frissit,
    valt: () => { be = !be; try { localStorage.setItem(TAROL, be ? 'be' : 'ki'); } catch { /* nincs tárhely */ } },
  };
}
