// Layout line check. Run it from the browser console or from an automated test.
// Measures pairs of parts that should share a line and lists any that are off by more than 1px.
window.alignCheck = () => {
  const R = s => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; return e.getBoundingClientRect(); };
  const mid = r => (r.top + r.bottom) / 2;
  const wide = innerWidth > 820;
  const Z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--z')) || 1; // the UI is drawn at this scale
  const checks = [];
  const eq = (name, a, b) => { if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return; checks.push({ name, a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10, ok: Math.abs(a - b) <= 1 }); };
  const side = R('.side'), brand = R('.side .brand'), nav1 = R('.side .nav'), hdr = R('.hdr'), hello = R('#hello')?.parentElement && R('.greet'),
    tide = R('#tide'), calm = R('#calmBtn'), add = R('#addBtn'), p1 = R('.row .panel'), p2 = R('.row .panel.focus');
  if (wide && side && brand && nav1 && hdr && p1) {
    eq('left column top = top band top', side.top, hdr.top);
    eq('logo center = top band center', mid(brand), mid(hdr));
    eq('first menu item top = panel top', nav1.top, Math.min(p1.top, p2 ? p2.top : Infinity));
    eq('content left = left column right + 16', side.right + 16 * Z, hdr.left);
  }
  if (hello) eq('greeting center = top band center', mid(hello), mid(hdr));
  for (const [n, r] of [['tide', tide], ['Nagi mode', calm], ['add task', add]]) if (r && wide) { eq(`${n} center = top band center`, mid(r), mid(hdr)); eq(`${n} height = 40`, r.height, 40 * Z); }
  if (p1 && p2 && (p2.left > p1.right || p1.left > p2.right)) { eq('two panels: top', p1.top, p2.top); eq('two panels: bottom', p1.bottom, p2.bottom); }
  if (p1 && p2 && !(p2.left > p1.right || p1.left > p2.right)) { eq('stacked panels: left', p1.left, p2.left); eq('stacked panels: right', p1.right, p2.right); }
  const rightmost = p2 && p2.right >= (p1?.right || 0) ? p2 : p1;
  if (add && rightmost) eq('right edge: button = panel', add.right, rightmost.right);
  if (rightmost) eq('right edge = screen edge - 16', innerWidth - 16 * Z, rightmost.right);
  // narrow screens: buttons must stay inside the top band
  if (!wide && hdr && add) eq('buttons inside the top band', Math.min(add.bottom, hdr.bottom), add.bottom);
  // text baseline: logo and greeting
  const base = el => { if (!el) return null; const m = document.createElement('span'); m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; el.appendChild(m); const y = m.getBoundingClientRect().top; m.remove(); return y; };
  if (wide) eq('logo and greeting baseline', base(document.querySelector('.side .brand')), base(document.querySelector('#hello')));
  // text must not overflow its box
  for (const el of document.querySelectorAll('.tide, .calm, .addbtn, .card .t, .panel h2, .btn')) {
    if (!el.offsetParent) continue;
    if (el.scrollWidth > el.clientWidth + 1) checks.push({ name: 'overflow: ' + (el.id || el.className) + ' "' + el.textContent.trim().slice(0, 12) + '"', a: el.scrollWidth, b: el.clientWidth, ok: false });
  }
  const bad = checks.filter(c => !c.ok);
  return { width: innerWidth, ok: bad.length === 0, bad, total: checks.length };
};
