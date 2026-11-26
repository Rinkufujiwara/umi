// レイアウトの線のチェック。ブラウザのコンソールか、自動テストから実行する。
// 同じ線にそろうべき部品の組を測って、1px より大きくずれていたら一覧で返す。
window.alignCheck = () => {
  const R = s => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; return e.getBoundingClientRect(); };
  const mid = r => (r.top + r.bottom) / 2;
  const wide = innerWidth > 820;
  const checks = [];
  const eq = (name, a, b) => { if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return; checks.push({ name, a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10, ok: Math.abs(a - b) <= 1 }); };
  const side = R('.side'), brand = R('.side .brand'), nav1 = R('.side .nav'), hdr = R('.hdr'), hello = R('#hello')?.parentElement && R('.greet'),
    tide = R('#tide'), calm = R('#calmBtn'), add = R('#addBtn'), p1 = R('.row .panel'), p2 = R('.row .panel.focus');
  if (wide && side && brand && nav1 && hdr && p1) {
    eq('左の列の上端 = 上の帯の上端', side.top, hdr.top);
    eq('ロゴの中央 = 上の帯の中央', mid(brand), mid(hdr));
    eq('最初のメニューの上端 = パネルの上端', nav1.top, Math.min(p1.top, p2 ? p2.top : Infinity));
    eq('中身の左端 = 左の列の右端 + 16', side.right + 16, hdr.left);
  }
  if (hello) eq('あいさつの中央 = 上の帯の中央', mid(hello), mid(hdr));
  for (const [n, r] of [['潮位', tide], ['凪モード', calm], ['タスクを追加', add]]) if (r && wide) { eq(`${n}の中央 = 上の帯の中央`, mid(r), mid(hdr)); eq(`${n}の高さ = 40`, r.height, 40); }
  if (p1 && p2 && (p2.left > p1.right || p1.left > p2.right)) { eq('パネル2つの上端', p1.top, p2.top); eq('パネル2つの下端', p1.bottom, p2.bottom); }
  if (p1 && p2 && !(p2.left > p1.right || p1.left > p2.right)) { eq('縦に並んだパネルの左端', p1.left, p2.left); eq('縦に並んだパネルの右端', p1.right, p2.right); }
  const rightmost = p2 && p2.right >= (p1?.right || 0) ? p2 : p1;
  if (add && rightmost) eq('右端：ボタン = パネル', add.right, rightmost.right);
  if (rightmost) eq('右端 = 画面の端 - 16', innerWidth - 16, rightmost.right);
  // 狭い画面：ボタンが上の帯からはみ出していないか
  if (!wide && hdr && add) eq('ボタンが上の帯の中に入っている', Math.min(add.bottom, hdr.bottom), add.bottom);
  // 文字の下の線（ベースライン）：ロゴとあいさつ
  const base = el => { if (!el) return null; const m = document.createElement('span'); m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; el.appendChild(m); const y = m.getBoundingClientRect().top; m.remove(); return y; };
  if (wide) eq('ロゴとあいさつのベースライン', base(document.querySelector('.side .brand')), base(document.querySelector('#hello')));
  // 文字が箱からはみ出していないか
  for (const el of document.querySelectorAll('.tide, .calm, .addbtn, .card .t, .panel h2, .btn')) {
    if (!el.offsetParent) continue;
    if (el.scrollWidth > el.clientWidth + 1) checks.push({ name: 'はみ出し: ' + (el.id || el.className) + ' 「' + el.textContent.trim().slice(0, 12) + '」', a: el.scrollWidth, b: el.clientWidth, ok: false });
  }
  const bad = checks.filter(c => !c.ok);
  return { width: innerWidth, ok: bad.length === 0, bad, total: checks.length };
};
