// Language switching. English is the default; Japanese can be picked in Settings.
// Proper nouns stay as they are in both languages: Umi, Nagi (the calm mode), Shiomi (the AI that weighs tasks).
// Static text in HTML uses data-i18n="key" (text) and data-i18n-attr="title:key,placeholder:key" (attributes).
const KEY = 'umi.lang';

const en = {
  // navigation
  'nav.menu': 'Menu', 'nav.home': 'Home', 'nav.map': 'Overview', 'nav.map.title': 'View from the sky',
  'nav.bed': 'Lakebed', 'nav.bed.title': 'Finished tasks', 'nav.dive': 'Dive', 'nav.dive.title': 'Dive into one task (focus timer)',
  'nav.env': 'Lake & settings', 'nav.settings': 'Settings',
  'scene.label': 'The lake. Each floating buoy is a task.',
  // header
  'hello.night': 'Good evening', 'hello.morning': 'Good morning', 'hello.day': 'Good afternoon',
  'urgent.n': '{n} urgent', 'urgent.title': 'See from the sky which ones are urgent',
  'tide.title': "Today's estimates ÷ the hours you can use in a day",
  'tide.today': "Today's ", 'tide': 'tide', 'tide.over': '{t} over', 'tide.left': '{t} left',
  'calm': 'Nagi mode', 'calm.title': 'When on, only the three tasks to do now stay afloat',
  'add': 'Add', 'add.long': 'task ', 'add.title': 'Add a task',
  'panel.top': "Today's priorities", 'panel.focus': 'The one for now', 'fold.title': 'Fold or open the panels', 'sum.n': '{n} more',
  'empty.others': 'Nothing else.', 'empty.focus': 'Nothing urgent.',
  'btn.sink': 'Sink', 'btn.dive': 'Dive', 'btn.later': 'Tomorrow',
  'kind.must': 'Must', 'kind.self': 'Own', 'tag.urgent': 'urgent',
  'nagi.label': 'Nagi', 'nagi.formula': 'Nagi (formula)', 'nagi.s.tomorrow': 'Move to tomorrow', 'nagi.s.lighter': 'Make it lighter', 'nagi.s.later': 'In 3 days', 'nagi.s.dive': 'Dive {m} min',
  'env.agent': "Nagi planning (uses Shiomi's judgments and your time)", 'env.agentBtn': 'Plan with the Nagi agent: {v}',
  'nodue': 'No due date', 'about': '~{t}',
  // lakebed
  'bed': 'Lakebed', 'bed.count': 'Lakebed  {n}', 'bed.hint.title': 'To the lakebed (or scroll down)',
  'bed.title': 'Lakebed  {n} sunk so far', 'bed.sub': 'Today {a} · last 7 days {b}  /  scroll up for the surface',
  'bed.list': 'Show list', 'bed.close': 'Close list', 'bed.back': 'Back to the surface',
  'bed.sunkOn': 'sunk {d}', 'bed.raise': 'Raise', 'bed.empty': 'Nothing has sunk yet.', 'bed.default': 'Lakebed',
  // overview (sky)
  'map.title': 'Overview  from the sky', 'map.legendX': '← Urgent    Slack →', 'map.legendY': '↑ Light (shore)    Heavy (offshore) ↓',
  'map.table': 'Table view', 'map.calmnote': 'Nagi: showing only the three for now',
  'map.sub': 'Afloat <b>{n}</b> (today {today}{urg} · this week {week} · someday {some}){late}  Sunk in the last 7 days: <b>{sunk}</b>',
  'map.urg': ' · <span class="late">{n} urgent</span>', 'map.late': ' · <span class="late">{n} late</span>',
  'busy.reason': "Today's tide {a}% + next 7 days {b}%×0.5 + late {c}×0.25 + urgent {d}×0.12",
  // sections
  'sec.surface': 'Surface', 'sec.shallows': 'Shallows', 'sec.depths': 'Depths',
  // toasts
  'toast.sunk': 'Sank "{t}"', 'toast.deleted': 'Deleted "{t}"', 'toast.later': 'Moved "{t}" farther ({d})',
  'toast.lighter': 'Moved "{t}" to the shallows (weight: {w})', 'toast.moved': 'Moved "{t}" to {s}',
  'toast.raised': 'Raised "{t}"', 'toast.dragged': 'Moved "{t}": {c}', 'toast.added': 'Floated on the {s}: {t}', 'toast.undo': 'Undo',
  'toast.saveFail': 'Could not save to your account', 'toast.noDiveTarget': 'There is no task to dive into',
  // card (pop)
  'pop.weight': 'Weight', 'pop.weightIs': 'Weight: {w}', 'pop.later': 'Farther', 'pop.dove': 'Dove {t} in total',
  'pop.shiomi': 'Shiomi', 'pop.guess': 'Estimate', 'pop.why': '{src}: value {i} · cost of missing {p} · others waiting {d}',
  'pop.whyTitle': 'Value {i} · cost of missing {p} · effort {e} · others waiting {d}',
  'pop.lighter': 'Lighter', 'pop.lighter.title': 'Make it lighter (move left, to the shallows)',
  'pop.edit': 'Edit in table', 'pop.delete': 'Delete', 'pop.delete.title': 'Delete this task (you can undo)',
  'pop.sink.title': 'You can also long-press a buoy to sink it', 'pop.plus1d': '+1 day', 'pop.plus3d': '+3 days', 'pop.plus1w': '+1 week',
  // add
  'addbox.title': 'Add a task', 'addbox.enter': 'float', 'addbox.esc': 'close', 'addbox.float': 'Float',
  'addbox.placeholder': 'e.g. tomorrow 3pm stats homework #school 1h must', 'addbox.aria': 'Task',
  'quick': ['today', 'tomorrow', 'next mon', '30m', '1h', 'must', 'heavy', 'light', 'daily', 'someday'],
  'pv.someday': 'someday',
  // settings
  'env.season': 'Season', 'env.weather': 'Sky and water (normally set by how busy you are)', 'env.hours': 'Hours you can use in a day (used for the tide and for days of work)',
  'env.calm': 'Nagi mode (only the three tasks to do now stay afloat)', 'env.sound': 'Sound', 'env.soundBtn': 'Sound when sinking: {v}',
  'env.on': 'on', 'env.off': 'off', 'env.lang': 'Language', 'env.hoursN': '{h}h',
  'season.auto': 'Auto', 'season.spring': 'Spring', 'season.summer': 'Summer', 'season.autumn': 'Autumn', 'season.winter': 'Winter',
  'weather.auto': 'Auto (by busyness)', 'weather.calm': 'Nagi', 'weather.ripple': 'Ripples', 'weather.waves': 'Waves', 'weather.rough': 'Rough', 'weather.storm': 'Storm',
  'sky.calm': 'clear', 'sky.ripple': 'thin clouds', 'sky.waves': 'cloudy', 'sky.rough': 'rain', 'sky.storm': 'storm',
  'env.statusManual': 'Lake: {k} ({s}) · manual', 'env.statusAuto': 'Busyness {p}%: {k} ({s})', 'env.small': '{season} · {k} ({s})',
  // account / Shiomi
  'acct.signin': 'Sign in with Google', 'acct.signout': 'Sign out', 'acct.signedIn': 'Signed in',
  'shiomi.off': 'Sign in and Shiomi will weigh your tasks', 'shiomi.idle': 'Shiomi: up to date', 'shiomi.busy': 'Shiomi: thinking…',
  'shiomi.unset': 'Shiomi: API key not set on Vercel', 'shiomi.denied': 'Shiomi: this account is not allowed', 'shiomi.error': 'Shiomi: cannot connect (will retry)',
  'cloud.signinFail': 'Could not sign in. Please try again.', 'cloud.loadFail': 'Could not load your account data',
  'cloud.uploaded': "Saved this device's data to your account", 'cloud.saveFail': 'Could not save to your account',
  // dive
  'dive': 'Dive', 'dive.sub': 'Dive into one task', 'dive.target': 'Dive into', 'dive.time': 'Time', 'dive.open': 'No limit',
  'dive.min': '{m} min', 'dive.cancel': 'Cancel', 'dive.start': 'Dive',
  'dive.noteTimed': 'You surface automatically after {m} min. Then {r} min of decompression (a break).',
  'dive.noteOpen': 'Stay down until you press "Surface". The break is one fifth of the dive.',
  'dive.subTimed': 'A {m}-minute dive', 'dive.subOpen': 'No time limit', 'dive.bubble': 'A stray thought? Type it and press Enter (it rises as a bubble)',
  'dive.bubbleAria': 'Bubble note', 'dive.up': 'Surface', 'dive.depth': 'Depth {m}m',
  'dive.surfaced': 'Surfaced', 'dive.summary': 'Dove {m} min', 'dive.rest': 'Decompression {t}', 'dive.restDone': 'Decompression done',
  'dive.breath': 'Breathe in and out slowly, with the waves', 'dive.again': 'You can dive again',
  'dive.bubbles': 'Bubble notes ({n})', 'dive.float': 'Float', 'dive.drop': 'Drop',
  'dive.sink': 'Sink (done)', 'dive.againBtn': 'Dive again', 'dive.home': 'Back to the surface',
  'dive.notifyUp': 'Surfaced', 'dive.notifyUpBody': 'Dove {m} min. Take {r} min of decompression (a break).',
  'dive.notifyRest': 'Decompression done', 'dive.notifyRestBody': 'You can dive again',
  'dive.group.surface': 'Today', 'dive.group.shallows': 'This week', 'dive.group.depths': 'Someday',
  // dates and labels (store.js)
  'wd': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  'repeat.daily': 'Daily', 'repeat.weekdays': 'Weekdays', 'repeat.weekly': 'Weekly', 'repeat.monthly': 'Monthly',
  'w.1': 'Light', 'w.2': 'Normal', 'w.3': 'Heavy',
  'due.late': '{n} days late', 'due.late1': '1 day late', 'due.today': 'Due today{tm}', 'due.tomorrow': 'Due tomorrow{tm}',
  'due.wd': 'Due {wd}{tm}', 'due.date': 'Due {md}',
  'est.m': '{m} min', 'est.h': '{h} h', 'est.hm': '{h} h {m} min',
  'effort': ['15 min', '30 min', '1 h', '2 h', 'Half a day', '1 day', '2 days', '4 days', '1 week', '2 weeks+'],
  'today': 'today',
  // list page
  'list.title': 'Umi — table', 'list.back': '← Back to the lake'
};

const ja = {
  'nav.menu': 'メニュー', 'nav.home': 'ホーム', 'nav.map': '一覧', 'nav.map.title': '空から見る',
  'nav.bed': '湖底', 'nav.bed.title': '終えたタスク', 'nav.dive': 'ダイブ', 'nav.dive.title': 'ひとつのタスクに潜る（集中タイマー）',
  'nav.env': '湖のようす', 'nav.settings': '設定',
  'scene.label': '湖。浮かんでいるブイがタスクです',
  'hello.night': 'こんばんは', 'hello.morning': 'おはようございます', 'hello.day': 'こんにちは',
  'urgent.n': '急ぎ {n}件', 'urgent.title': '空から見て、どれが急ぎか確かめる',
  'tide.title': '今日の見積もりの合計 ／ 1日に使える時間',
  'tide.today': '今日の', 'tide': '潮位', 'tide.over': '{t}多い', 'tide.left': 'あと{t}',
  'calm': '凪モード', 'calm.title': 'オンにすると、いまやる3件だけを浮かべます',
  'add': '追加', 'add.long': 'タスクを', 'add.title': 'タスクを追加',
  'panel.top': '今日の優先タスク', 'panel.focus': 'いまの一つ', 'fold.title': 'パネルをたたむ・ひらく', 'sum.n': 'ほか {n}件',
  'empty.others': 'ほかにはありません', 'empty.focus': '急ぐものはありません。',
  'btn.sink': '沈める', 'btn.dive': '潜る', 'btn.later': '明日へ',
  'kind.must': '必須', 'kind.self': '自主', 'tag.urgent': '急ぎ',
  'nagi.label': '凪', 'nagi.formula': '凪（式）', 'nagi.s.tomorrow': '明日へ回す', 'nagi.s.lighter': '軽くする', 'nagi.s.later': '3日後へ', 'nagi.s.dive': '{m}分潜る',
  'env.agent': '凪の計画（潮見の判定と、使える時間を見て決める）', 'env.agentBtn': '凪エージェントで計画：{v}',
  'nodue': '期限なし', 'about': '約{t}',
  'bed': '湖底', 'bed.count': '湖底　{n}', 'bed.hint.title': '湖底へ（下へスクロールでも）',
  'bed.title': '湖底　これまでに沈めた {n}件', 'bed.sub': '今日 {a}件・この7日 {b}件　／　上へスクロールで水面へ',
  'bed.list': '一覧表示', 'bed.close': '一覧を閉じる', 'bed.back': '水面へ戻る',
  'bed.sunkOn': '{d}に沈めた', 'bed.raise': '引き上げる', 'bed.empty': 'まだ何も沈んでいません。', 'bed.default': '湖底・水面',
  'map.title': '一覧　空から見る', 'map.legendX': '← 急ぐ　　余裕 →', 'map.legendY': '↑ 軽い（陸側）　　重い（沖）↓',
  'map.table': '表で見る', 'map.calmnote': '凪：いまの3件だけ表示中',
  'map.sub': '浮かんでいる <b>{n}件</b>（今日 {today}{urg}・今週 {week}・いつか {some}）{late}　この7日で <b>{sunk}件</b> 沈めた',
  'map.urg': '・<span class="late">急ぎ {n}</span>', 'map.late': '・<span class="late">遅れ {n}</span>',
  'busy.reason': '今日の潮位 {a}% ＋ 7日先の詰まり {b}%×0.5 ＋ 遅れ {c}件×0.25 ＋ 急ぎ {d}件×0.12',
  'sec.surface': '水面', 'sec.shallows': '浅瀬', 'sec.depths': '深み',
  'toast.sunk': '「{t}」を沈めました', 'toast.deleted': '「{t}」を削除しました', 'toast.later': '「{t}」を遠くへ（{d}）',
  'toast.lighter': '「{t}」を浅瀬へ（重さ：{w}）', 'toast.moved': '「{t}」を{s}へ',
  'toast.raised': '「{t}」を引き上げました', 'toast.dragged': '「{t}」を動かしました：{c}', 'toast.added': '{s}に浮かべました：{t}', 'toast.undo': '元に戻す',
  'toast.saveFail': 'アカウントに保存できませんでした', 'toast.noDiveTarget': '潜る先のタスクがありません',
  'pop.weight': '重さ', 'pop.weightIs': '重さ：{w}', 'pop.later': '遠くへ', 'pop.dove': '潜った 計{t}',
  'pop.shiomi': '潮見', 'pop.guess': '目安', 'pop.why': '{src}：価値 {i}・痛手 {p}・待ち {d}',
  'pop.whyTitle': '価値 {i}・痛手 {p}・手間 {e}・待ち {d}',
  'pop.lighter': '浅瀬へ', 'pop.lighter.title': '軽くする（左の浅瀬へ）',
  'pop.edit': '一覧で編集', 'pop.delete': '削除', 'pop.delete.title': 'このタスクを消す（元に戻せます）',
  'pop.sink.title': 'ブイを長押ししても沈められます', 'pop.plus1d': '＋1日', 'pop.plus3d': '＋3日', 'pop.plus1w': '＋1週',
  'addbox.title': 'タスクを追加', 'addbox.enter': '浮かべる', 'addbox.esc': '閉じる', 'addbox.float': '浮かべる',
  'addbox.placeholder': '例：明日15時 統計の課題 #大学 1時間 必須', 'addbox.aria': 'タスク',
  'quick': ['今日', '明日', '来週月曜', '30分', '1時間', '必須', '重い', '軽い', '毎日', 'いつか'],
  'pv.someday': 'いつか',
  'env.season': '季節', 'env.weather': '空と水面（ふだんは、やることの詰まり具合で自動）', 'env.hours': '1日に使える時間（潮位と、作業にかかる日数の計算に使う）',
  'env.calm': '凪モード（いまやる3件だけを浮かべる）', 'env.sound': '音', 'env.soundBtn': '沈めるときの音 {v}',
  'env.on': 'オン', 'env.off': 'オフ', 'env.lang': '言語', 'env.hoursN': '{h}時間',
  'season.auto': '自動', 'season.spring': '春', 'season.summer': '夏', 'season.autumn': '秋', 'season.winter': '冬',
  'weather.auto': '忙しさで自動', 'weather.calm': '凪', 'weather.ripple': 'さざ波', 'weather.waves': '波', 'weather.rough': '時化', 'weather.storm': '大時化',
  'sky.calm': '晴れ', 'sky.ripple': '薄曇り', 'sky.waves': 'くもり', 'sky.rough': '雨', 'sky.storm': '嵐',
  'env.statusManual': '湖：{k}（{s}）・手動', 'env.statusAuto': '忙しさ {p}%：{k}（{s}）', 'env.small': '{season}・{k}（{s}）',
  'acct.signin': 'Google でログイン', 'acct.signout': 'ログアウト', 'acct.signedIn': 'ログイン中',
  'shiomi.off': 'ログインすると潮見が重さを付けます', 'shiomi.idle': '潮見：最新', 'shiomi.busy': '潮見：考えています…',
  'shiomi.unset': '潮見：Vercel に API キーが未設定', 'shiomi.denied': '潮見：このアカウントは許可されていません', 'shiomi.error': '潮見：つながりません（あとで再試行）',
  'cloud.signinFail': 'ログインできませんでした。もう一度試してください。', 'cloud.loadFail': 'アカウントのデータを読み込めませんでした',
  'cloud.uploaded': 'この端末のデータをアカウントに保存しました', 'cloud.saveFail': 'アカウントに保存できませんでした',
  'dive': 'ダイブ', 'dive.sub': 'ひとつのタスクに潜る', 'dive.target': '潜る先', 'dive.time': '時間', 'dive.open': '決めない',
  'dive.min': '{m}分', 'dive.cancel': 'やめる', 'dive.start': '潜る',
  'dive.noteTimed': '{m}分たつと、自動で浮上します。そのあと{r}分の減圧（休憩）。',
  'dive.noteOpen': '自分で「浮上する」まで潜ります。休憩は、潜った時間の5分の1。',
  'dive.subTimed': '{m}分のダイブ', 'dive.subOpen': '時間は決めない', 'dive.bubble': '浮かんだ考えを書いて Enter（泡になって上へ）',
  'dive.bubbleAria': '泡メモ', 'dive.up': '浮上する', 'dive.depth': '深さ {m}m',
  'dive.surfaced': '浮上しました', 'dive.summary': '{m}分 潜りました', 'dive.rest': '減圧 {t}', 'dive.restDone': '減圧おわり',
  'dive.breath': '波に合わせて、ゆっくり吸って、吐いて', 'dive.again': 'また潜れます',
  'dive.bubbles': '泡メモ（{n}）', 'dive.float': '浮かべる', 'dive.drop': '消す',
  'dive.sink': '沈める（終わった）', 'dive.againBtn': 'もう一度潜る', 'dive.home': '水面へ戻る',
  'dive.notifyUp': '浮上しました', 'dive.notifyUpBody': '{m}分 潜りました。{r}分の減圧（休憩）をどうぞ',
  'dive.notifyRest': '減圧おわり', 'dive.notifyRestBody': 'また潜れます',
  'dive.group.surface': '今日', 'dive.group.shallows': '今週', 'dive.group.depths': 'いつか',
  'wd': ['日', '月', '火', '水', '木', '金', '土'],
  'repeat.daily': '毎日', 'repeat.weekdays': '平日', 'repeat.weekly': '毎週', 'repeat.monthly': '毎月',
  'w.1': '軽い', 'w.2': 'ふつう', 'w.3': '重い',
  'due.late': '{n}日遅れ', 'due.late1': '1日遅れ', 'due.today': '今日まで{tm}', 'due.tomorrow': '明日まで{tm}',
  'due.wd': '{wd}曜まで{tm}', 'due.date': '{md}まで',
  'est.m': '{m}分', 'est.h': '{h}時間', 'est.hm': '{h}時間{m}分',
  'effort': ['15分', '30分', '1時間', '2時間', '半日', '1日', '2日', '4日', '1週間', '2週間以上'],
  'today': '今日',
  'list.title': 'Umi — 表', 'list.back': '← 湖へ戻る'
};

// table page (list.html / app.js)
Object.assign(en, {
  'L.title': 'Umi — table', 'L.areasNav': 'Areas and depths', 'L.allAreas': 'All areas', 'L.areas': 'Areas', 'L.newArea': '+ New area', 'L.newAreaAria': 'Name of the new area',
  'L.depth': 'Depth', 'L.surface': 'Surface  today', 'L.shallows': 'Shallows  this week', 'L.depths': 'Depths  someday', 'L.bed': 'Lakebed  finished',
  'L.clearSample': 'Remove sample tasks', 'L.export': 'Export data', 'L.import': 'Import data', 'L.today': 'Today',
  'L.addPh': 'Add a task   e.g. tomorrow 3pm stats homework #school 1h', 'L.addAria': 'Add a task',
  'L.env': 'Lake & settings', 'L.season': 'Season', 'L.weather': 'Sky and water', 'L.back': '← Back to the lake',
  'L.notes': 'has notes', 'L.restore': 'Raise from the lakebed', 'L.finish': 'Finish and sink',
  'L.f.task': 'Task', 'L.f.due': 'Due', 'L.f.time': 'Time', 'L.f.est': 'Estimate', 'L.f.area': 'Area', 'L.f.kind': 'Type', 'L.f.repeat': 'Repeat', 'L.f.pin': 'Depth', 'L.f.notes': 'Notes',
  'L.none': 'None', 'L.mustLong': 'Must (real harm if skipped)', 'L.selfLong': 'Own (for your future)', 'L.byDue': 'By due date',
  'L.pin.surface': 'Surface (today)', 'L.pin.shallows': 'Shallows (this week)', 'L.pin.depths': 'Depths (someday)',
  'L.delete': 'Delete', 'L.close': 'Close', 'L.yesterday': 'Yesterday',
  'L.empty.surface': 'The surface is calm today.', 'L.empty.shallows': 'A quiet week.', 'L.empty.depths': 'Nothing in the depths.',
  'L.n': '{n}', 'L.more': 'Show more ({n} left)', 'L.bedEmpty': 'Finished tasks sink and pile up here.', 'L.bedWeek': '{n} this week', 'L.all': 'All',
  'L.focusK': 'The one for now', 'L.focusNone': 'Nothing urgent on the surface today.', 'L.focusWhy': 'The first thing to do on today\'s surface',
  'L.focusDone': 'Finish and sink', 'L.focusLater': 'Later (to the shallows)',
  'L.tide': "Today's tide  {t} / ", 'L.budgetTitle': 'Change the hours you can use in a day', 'L.over': 'High tide: {t} over', 'L.left': '{t} left',
  'L.sunk': 'Sank "{t}" to the lakebed', 'L.raised': 'Raised "{t}"', 'L.moved': 'Moved "{t}" to {s}', 'L.added': 'Floated on the {s}: {t}', 'L.deleted': 'Deleted "{t}"',
  'L.pv.due': 'Due {d}', 'L.pv.someday': 'Depths (someday)', 'L.pv.est': 'Estimate {t}', 'L.pv.area': 'Area {a}', 'L.pv.newArea': ' (new)', 'L.pv.repeat': 'Repeat {r}',
  'L.sampleCleared': 'Removed the sample tasks', 'L.imported': 'Imported {n} tasks', 'L.importFail': 'Could not import (this does not look like Umi data)',
  'L.d.surface': 'Surface', 'L.d.shallows': 'Shallows', 'L.d.depths': 'Depths', 'L.d.bed': 'Lakebed'
});
Object.assign(ja, {
  'L.title': 'Umi 一覧', 'L.areasNav': '海域と深さ', 'L.allAreas': 'すべての海域', 'L.areas': '海域', 'L.newArea': '＋ 新しい海域', 'L.newAreaAria': '新しい海域の名前',
  'L.depth': '深さ', 'L.surface': '水面　今日', 'L.shallows': '浅瀬　今週', 'L.depths': '深み　いつか', 'L.bed': '湖底　終えたもの',
  'L.clearSample': '見本のタスクを消す', 'L.export': 'データを書き出す', 'L.import': 'データを読み込む', 'L.today': '今日',
  'L.addPh': 'タスクを追加　例：明日15時 統計の課題 #大学 1時間', 'L.addAria': 'タスクを追加',
  'L.env': '湖のようす', 'L.season': '季節', 'L.weather': '空と水面', 'L.back': '← 湖へ戻る',
  'L.notes': 'メモあり', 'L.restore': '湖底から戻す', 'L.finish': '終えて沈める',
  'L.f.task': 'タスク', 'L.f.due': '期限', 'L.f.time': '時刻', 'L.f.est': '見積もり', 'L.f.area': '海域', 'L.f.kind': '区別', 'L.f.repeat': 'くり返し', 'L.f.pin': '深さ', 'L.f.notes': 'メモ',
  'L.none': 'なし', 'L.mustLong': '必須（やらないと実害）', 'L.selfLong': '自主（将来のため）', 'L.byDue': '期限で決める',
  'L.pin.surface': '水面（今日）', 'L.pin.shallows': '浅瀬（今週）', 'L.pin.depths': '深み（いつか）',
  'L.delete': '削除', 'L.close': '閉じる', 'L.yesterday': '昨日',
  'L.empty.surface': '今日の水面は凪いでいます。', 'L.empty.shallows': '今週は静かです。', 'L.empty.depths': '深みには何もありません。',
  'L.n': '{n}件', 'L.more': 'さらに表示（残り{n}件）', 'L.bedEmpty': '終えたタスクは、ここに沈んで積もります。', 'L.bedWeek': '今週 {n}件', 'L.all': 'すべて',
  'L.focusK': 'いまの一つ', 'L.focusNone': '今日の水面に、急ぐものはありません。', 'L.focusWhy': '今日の水面でいちばん先にやること',
  'L.focusDone': '終えて沈める', 'L.focusLater': 'あとで（浅瀬へ）',
  'L.tide': '今日の潮位　{t} ／ ', 'L.budgetTitle': '1日に使える時間を変える', 'L.over': '満ち潮：{t}多い', 'L.left': 'あと{t}',
  'L.sunk': '「{t}」を湖底に沈めました', 'L.raised': '「{t}」を引き上げました', 'L.moved': '「{t}」を{s}へ', 'L.added': '{s}に浮かべました：{t}', 'L.deleted': '「{t}」を削除しました',
  'L.pv.due': '期限 {d}', 'L.pv.someday': '深み（いつか）', 'L.pv.est': '見積もり {t}', 'L.pv.area': '海域 {a}', 'L.pv.newArea': '（新しく作る）', 'L.pv.repeat': 'くり返し {r}',
  'L.sampleCleared': '見本のタスクを消しました', 'L.imported': '{n}件のタスクを読み込みました', 'L.importFail': '読み込めませんでした（Umi のデータではないようです）',
  'L.d.surface': '水面', 'L.d.shallows': '浅瀬', 'L.d.depths': '深み', 'L.d.bed': '湖底'
});

const DICT = { en, ja };
let lang = (() => {
  const q = new URLSearchParams(location.search).get('lang'); // ?lang=ja / ?lang=en picks and remembers a language
  if (q) { try { localStorage.setItem(KEY, q); } catch (_) {} return q; }
  try { return localStorage.getItem(KEY); } catch (_) { return null; }
})();
if (!DICT[lang]) lang = 'en';

export const getLang = () => lang;
export const LANGS = [['en', 'English'], ['ja', '日本語']];

export function t(key, p = {}) {
  const v = DICT[lang][key] ?? en[key];
  if (v == null) return key;
  if (Array.isArray(v)) return v;
  return String(v).replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? ''));
}

// Month and day, written the way each language writes it ("Dec 3" / "12月3日")
export function md(d) {
  return lang === 'ja' ? `${d.getMonth() + 1}月${d.getDate()}日` : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// Full date with weekday ("Fri, Nov 27" / "11月27日（金）")
export function mdw(d) {
  return lang === 'ja' ? `${md(d)}（${t('wd')[d.getDay()]}）` : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(',')) { const [a, k] = pair.split(':'); el.setAttribute(a.trim(), t(k.trim())); }
  });
}

export function setLang(l) {
  if (!DICT[l] || l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch (_) {}
  applyStatic();
  listeners.forEach(fn => fn(l));
}
const listeners = [];
export const onLang = fn => listeners.push(fn);

// env.js is a classic script and cannot import this module, so it reads the translator from here
window.UmiI18n = { t, getLang };
