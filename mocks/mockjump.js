// モック共通：?p=0.5 で途中の深さへ。?season= / ?weather= で見た目を固定
(() => {
  const qs = new URLSearchParams(location.search);
  const Env = window.LakeEnv;
  if (Env && Env.KINDS[qs.get('weather')]) Env.setWeatherMode(qs.get('weather'));
  const wait = setInterval(() => {
    if (window.LakeScene?.setSeason) { clearInterval(wait); window.LakeScene.setSeason(qs.get('season') || Env.auto.season); }
  }, 100);
  const qp = qs.get('p');
  if (qp !== null) addEventListener('load', () => setTimeout(() => {
    const s = document.getElementById('dive');
    scrollTo(0, (s.offsetHeight - innerHeight) * Math.max(0, Math.min(1, +qp)));
  }, 300));
})();
