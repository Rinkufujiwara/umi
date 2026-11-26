// 季節と「湖の天気」を1か所で持つ。
// 天気は本物の天気ではなく、タスクの忙しさ（やることの詰まり具合）で決める。位置情報は使わない
window.LakeEnv = (() => {
  'use strict';
  // 忙しさの段階 → 空と水面（wind が大きいほど波が立つ）
  const KINDS = {
    calm:   { label: '凪',     sky: '晴れ',   cloud: 0.06, rain: 0,   snow: 0, fog: 0,    wind: 0.1,  thunder: 0 },
    ripple: { label: 'さざ波', sky: '薄曇り', cloud: 0.35, rain: 0,   snow: 0, fog: 0.03, wind: 0.3,  thunder: 0 },
    waves:  { label: '波',     sky: 'くもり', cloud: 0.72, rain: 0,   snow: 0, fog: 0.06, wind: 0.5,  thunder: 0 },
    rough:  { label: '時化',   sky: '雨',     cloud: 0.9,  rain: 0.7, snow: 0, fog: 0.1,  wind: 0.75, thunder: 0 },
    storm:  { label: '大時化', sky: '嵐',     cloud: 1,    rain: 1,   snow: 0, fog: 0.15, wind: 1,    thunder: 1 }
  };
  const SEASON_LABEL = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  function seasonFor(date) {
    const m = date.getMonth() + 1;
    return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  }

  const auto = { season: seasonFor(new Date()), weather: 'calm', score: 0, reason: '', lat: null, lon: null };
  let weatherMode = 'auto';
  const listeners = [];
  const emit = () => listeners.forEach(fn => fn(api));

  const api = {
    KINDS, SEASON_LABEL, auto,
    on(fn) { listeners.push(fn); },
    setWeatherMode(m) { weatherMode = KINDS[m] || m === 'auto' ? m : 'auto'; emit(); },
    // 忙しさの計算結果を受け取る（home.js から）
    setBusy(kind, score, reason) {
      if (auto.weather === kind && Math.abs(auto.score - score) < 0.005 && auto.reason === reason) return;
      auto.weather = kind; auto.score = score; auto.reason = reason; emit();
    },
    get weatherMode() { return weatherMode; },
    get weather() { return weatherMode === 'auto' ? auto.weather : weatherMode; },
    target() { return { ...KINDS[api.weather] }; },
    statusText() {
      const k = KINDS[api.weather];
      if (weatherMode !== 'auto') return `湖：${k.label}（${k.sky}）・手動`;
      return `忙しさ ${Math.round(auto.score * 100)}%：${k.label}（${k.sky}）`;
    }
  };
  return api;
})();
