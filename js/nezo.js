// Nézőmód (B): a többi játékost követheted, a válla mögül. ←/→ (telefonon a felső sávra koppintva) =
// a következő játékos; alapból a meccs legjobbja (a legtöbb meccsbeli ölés). Nézőként nem lehet
// bántani és te sem játszol (a többiek halványan látnak, mint a felülnézetből nézőket); B = vissza.
import * as THREE from 'three';

export function inditNezo({ camera, seta, kozos, uzenet, getMod }) {
  const el = id => document.getElementById(id);
  let aktiv = false, celId = null;
  const kamPoz = new THREE.Vector3(), nez = new THREE.Vector3();

  const jeloltek = () => [...(kozos?.tobbiek.values() || [])].filter(t => t.cel.m !== 'felul');
  function legjobb() {
    const l = jeloltek();
    l.sort((a, b) => (Number(b.cel.mk) || 0) - (Number(a.cel.mk) || 0) || (Number(b.cel.k) || 0) - (Number(a.cel.k) || 0));
    return l[0]?.id ?? null;
  }
  function kovetkezo(irany = 1) {
    const l = jeloltek();
    if (!l.length) { celId = null; return; }
    const i = l.findIndex(t => t.id === celId);
    celId = l[((i < 0 ? 0 : i + irany) % l.length + l.length) % l.length].id;
  }
  function valt() {
    if (aktiv) { aktiv = false; el('nezoSav').hidden = true; uzenet('👁 Nézőmód vége'); return; }
    if (getMod() !== 'seta') return;
    celId = legjobb();
    if (!celId) { uzenet('👁 Nincs kit nézni – most egyedül vagy'); return; }
    aktiv = true;
    kamPoz.copy(camera.position);
    uzenet('👁 Nézőmód: ←/→ = másik játékos, B = vissza a játékba');
  }
  addEventListener('keydown', e => {
    if (!aktiv || e.repeat) return;
    if (e.code === 'ArrowRight') { kovetkezo(1); e.preventDefault(); }
    if (e.code === 'ArrowLeft') { kovetkezo(-1); e.preventDefault(); }
  });
  el('nezoSav')?.addEventListener('pointerdown', e => { e.preventDefault(); kovetkezo(1); });

  // képkockánként: a kamera a követett játékos mögé (true, ha mi irányítjuk a kamerát)
  function frissit(dt) {
    if (!aktiv) return false;
    if (getMod() !== 'seta' || seta.halott) { aktiv = false; el('nezoSav').hidden = true; return false; }
    let t = kozos?.tobbiek.get(celId);
    if (!t || t.cel.m === 'felul') { kovetkezo(1); t = kozos?.tobbiek.get(celId); }
    if (!t) { aktiv = false; el('nezoSav').hidden = true; uzenet('👁 Nincs kit nézni'); return false; }
    const p = t.g.position, yaw = t.g.rotation.y, fx = -Math.sin(yaw), fy = -Math.cos(yaw);
    const cel = new THREE.Vector3(p.x - fx * 3.2 + fy * 0.6, p.y + 2.3, p.z - fy * 3.2 - fx * 0.6);
    kamPoz.lerp(cel, Math.min(1, dt * 6));
    camera.position.copy(kamPoz);
    nez.set(p.x + fx * 2, p.y + 1.4, p.z + fy * 2);
    camera.lookAt(nez);
    const sav = el('nezoSav');
    sav.hidden = false;
    const u = t.cel, sz = `👁 ${t.nev}${u.j ? ` · ${u.hal ? '☠' : `${Math.round(u.h ?? 100)} HP`} · 🎯 ${u.mk ?? u.k ?? 0}` : ''} · ←/→ váltás · B kilépés`;
    if (sav.textContent !== sz) sav.textContent = sz;
    return true;
  }

  return { frissit, valt, aktiv: () => aktiv };
}
