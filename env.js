// Season and the lake's "weather" in one place.
// The weather is not the real weather: it comes from how busy your tasks are. No location is used.
window.LakeEnv = (() => {
  'use strict';
  // busyness level → sky and water (more wind = bigger waves)
  const KINDS = {
    calm:   { cloud: 0.06, rain: 0,   snow: 0, fog: 0,    wind: 0.1,  thunder: 0 },
    ripple: { cloud: 0.35, rain: 0,   snow: 0, fog: 0.03, wind: 0.3,  thunder: 0 },
    waves:  { cloud: 0.72, rain: 0,   snow: 0, fog: 0.06, wind: 0.5,  thunder: 0 },
    rough:  { cloud: 0.9,  rain: 0.7, snow: 0, fog: 0.1,  wind: 0.75, thunder: 0 },
    storm:  { cloud: 1,    rain: 1,   snow: 0, fog: 0.15, wind: 1,    thunder: 1 }
  };
  const tr = (k, p) => (window.UmiI18n ? window.UmiI18n.t(k, p) : k);
  const SEASON_LABEL = new Proxy({}, { get: (_, k) => tr('season.' + String(k)) });
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
    // receives the busyness result (from home.js)
    setBusy(kind, score, reason) {
      if (auto.weather === kind && Math.abs(auto.score - score) < 0.005 && auto.reason === reason) return;
      auto.weather = kind; auto.score = score; auto.reason = reason; emit();
    },
    get weatherMode() { return weatherMode; },
    get weather() { return weatherMode === 'auto' ? auto.weather : weatherMode; },
    target() { return { ...KINDS[api.weather] }; },
    statusText() {
      const w = api.weather, k = tr('weather.' + w), s = tr('sky.' + w);
      if (weatherMode !== 'auto') return tr('env.statusManual', { k, s });
      return tr('env.statusAuto', { p: Math.round(auto.score * 100), k, s });
    }
  };
  return api;
})();
