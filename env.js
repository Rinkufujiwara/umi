// 季節と天気の「今の状態」を1か所で持つ。現在地がわかれば、その場所の季節と天気を使う
window.LakeEnv = (() => {
  'use strict';
  const KINDS = {
    clear:   { label: '晴れ',   cloud: 0.06, rain: 0,   snow: 0,    fog: 0,    wind: 0.2,  thunder: 0 },
    cloudy:  { label: 'くもり', cloud: 0.75, rain: 0,   snow: 0,    fog: 0.05, wind: 0.35, thunder: 0 },
    rain:    { label: '雨',     cloud: 0.9,  rain: 0.8, snow: 0,    fog: 0.1,  wind: 0.5,  thunder: 0 },
    snow:    { label: '雪',     cloud: 0.7,  rain: 0,   snow: 0.85, fog: 0.1,  wind: 0.25, thunder: 0 },
    fog:     { label: '霧',     cloud: 0.45, rain: 0,   snow: 0,    fog: 0.85, wind: 0.05, thunder: 0 },
    thunder: { label: '雷雨',   cloud: 1,    rain: 1,   snow: 0,    fog: 0.1,  wind: 0.8,  thunder: 1 }
  };
  const SEASON_LABEL = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

  // 北半球と南半球で季節を入れかえる
  function seasonFor(date, lat) {
    let m = date.getMonth() + 1;
    if (lat !== null && lat < 0) m = ((m + 5) % 12) + 1;
    return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  }
  // Open-Meteo の天気コード（WMO）を6種類にまとめる
  function kindFromCode(c) {
    if (c === 45 || c === 48) return 'fog';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
    if (c >= 95) return 'thunder';
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
    if (c === 2 || c === 3) return 'cloudy';
    return 'clear';
  }

  const auto = { season: seasonFor(new Date(), null), weather: 'clear', temp: null, wind: null, status: 'loading' };
  let weatherMode = 'auto';
  const listeners = [];
  const emit = () => listeners.forEach(fn => fn(api));

  const CACHE = 'lake_env_v1';
  function fromCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (c && Date.now() - c.t < 30 * 60 * 1000) return c;
    } catch (_) {}
    return null;
  }

  async function load() {
    const cached = fromCache();
    if (cached) { Object.assign(auto, cached.auto, { status: 'ok' }); emit(); return; }
    if (!('geolocation' in navigator)) { auto.status = 'nogeo'; emit(); return; }
    let pos;
    try {
      pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, maximumAge: 30 * 60 * 1000 }));
    } catch (_) { auto.status = 'denied'; emit(); return; }
    // 天気を調べるだけなので、位置は小数2桁（約1km）に丸めて送る
    const lat = Math.round(pos.coords.latitude * 100) / 100;
    const lon = Math.round(pos.coords.longitude * 100) / 100;
    auto.season = seasonFor(new Date(), lat);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                  `&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      auto.weather = kindFromCode(j.current.weather_code);
      auto.temp = Math.round(j.current.temperature_2m);
      auto.wind = j.current.wind_speed_10m;
      auto.status = 'ok';
      try { localStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), auto })); } catch (_) {}
    } catch (_) { auto.status = 'noweather'; }
    emit();
  }

  const api = {
    KINDS, SEASON_LABEL, auto,
    on(fn) { listeners.push(fn); },
    setWeatherMode(m) { weatherMode = m; emit(); },
    get weatherMode() { return weatherMode; },
    get weather() { return weatherMode === 'auto' ? auto.weather : weatherMode; },
    // 描画側が近づけていく目標値
    target() {
      const k = { ...KINDS[api.weather] };
      if (weatherMode === 'auto' && auto.wind !== null) k.wind = Math.max(k.wind * 0.5, Math.min(1, auto.wind / 40));
      return k;
    },
    statusText() {
      const w = KINDS[api.weather].label;
      if (auto.status === 'loading') return '現在地の天気を調べています…';
      if (weatherMode !== 'auto') return `天気：${w}（手動）`;
      if (auto.status === 'ok') return `現在地：${SEASON_LABEL[auto.season]}・${w}${auto.temp !== null ? `・${auto.temp}℃` : ''}`;
      if (auto.status === 'noweather') return `現在地：${SEASON_LABEL[auto.season]}（天気は取得できず）`;
      return '位置情報なし：日付から季節を決めています';
    }
  };
  load();
  return api;
})();
