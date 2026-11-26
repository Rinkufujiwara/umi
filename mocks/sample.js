// モック用の見本タスク（動かない）
window.SAMPLE = {
  areas: [
    { name: '大学', color: '#2f6f8f', n: 6 }, { name: 'Cypher', color: '#6a5acd', n: 4 },
    { name: '制作', color: '#c0812c', n: 5 }, { name: '生活', color: '#3c8d5a', n: 3 }
  ],
  focus: { title: 'TIEカードの予約を取る', note: '今日まで・必須・約15分。取り逃すと次の空きは3週間後です。' },
  surface: [
    ['TIEカードの予約を取る', '今日まで', '15分', '生活', 'must', true],
    ['統計学の課題を提出する', '今日 23:59', '1時間', '大学', 'must'],
    ['Cypher 定例の議事録をまとめる', '今日', '30分', 'Cypher', 'must'],
    ['Umi のダッシュボードを確認する', '今日', '45分', '制作', 'self'],
    ['スペイン語の単語を20個', '毎日', '20分', '大学', 'self']
  ],
  shallows: [
    ['英語教材 1-05 の台本を書く', '金曜', '2時間', '制作', 'self'],
    ['ゼミの発表資料を送る', '土曜', '1時間', '大学', 'must'],
    ['WD 今週のお題を提出する', '日曜', '3時間', '制作', 'self'],
    ['家賃を振り込む', '日曜', '10分', '生活', 'must'],
    ['会員アプリの改善案を3つ出す', '今週', '1時間', 'Cypher', 'self'],
    ['ポートフォリオに Transtudy の動画を入れる', '今週', '1時間', '制作', 'self']
  ],
  depths: [
    ['AIで作った人シリーズの題材を10本ためる', '期限なし', '', '制作', 'self'],
    ['留学Q&Aの記事を書く', '期限なし', '', '生活', 'self'],
    ['夏のインターンを調べる', '2月まで', '', '大学', 'self'],
    ['潮見と凪を A2A でつなぐ', '期限なし', '', '制作', 'self'],
    ['運営マニュアルの開発の章を書く', '期限なし', '', 'Cypher', 'self']
  ],
  bed: [
    ['今日', '3Dの湖をコミットする', '制作'], ['今日', '洗濯', '生活'],
    ['昨日', 'DevFest の Devpost を更新する', '制作'], ['昨日', '経済学の小テスト', '大学'],
    ['11月23日（月）', 'ハッカソンの振り返りを書く', '制作']
  ]
};
window.renderRows = (el, key, opt = {}) => {
  const S = window.SAMPLE;
  if (key === 'bed') {
    let last = '';
    el.innerHTML = S.bed.map(([d, t, a]) => (d !== last ? `<div class="day">${(last = d)}</div>` : '') +
      `<div class="row done"><i class="ck"></i><div><div class="t">${t}</div><div class="m"><span>${a}</span></div></div><span></span></div>`).join('');
    return;
  }
  el.innerHTML = S[key].map(([t, due, est, area, kind, late]) => {
    const color = (S.areas.find(a => a.name === area) || {}).color;
    return `<div class="row"><i class="ck"></i><div><div class="t">${t}</div>
      <div class="m"><span class="${late ? 'late' : ''}">${due}</span>${est ? `<span>${est}</span>` : ''}${opt.noArea ? '' : `<span><i class="adot" style="background:${color}"></i>${area}</span>`}</div></div>
      <span class="tag ${kind}">${kind === 'must' ? '必須' : '自主'}</span></div>`;
  }).join('');
};
