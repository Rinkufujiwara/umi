// Google ログイン（Firebase）と、1人1つのデータ（Firestore の umi/{uid}）。潮見（AI）の呼び出しもここ。
// ログインしていないときは、これまでどおりこのブラウザの中だけに保存する。
const V = '11.10.0';
const cfg = window.FIREBASE_CONFIG;

export const Cloud = {
  ready: false, user: null, ref: null, api: null, auth: null, lastJson: '', unsub: null, timer: 0,
  async token() { return this.user ? this.user.getIdToken() : null; },
  queueSave(json) {
    if (!this.ref) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      this.timer = 0;
      if (json === this.lastJson) return;
      this.lastJson = json;
      try { await this.api.setDoc(this.ref, { json, updatedAt: this.api.serverTimestamp() }); this.onSaved?.(true); }
      catch (_) { this.onSaved?.(false); }
    }, 700);
  }
};

// hooks: { getJson(), setJson(json), localJson(), onUser(user), toast(text) }
export async function startCloud(hooks) {
  if (!cfg || !cfg.apiKey) return;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]);
  // 本番ではログイン画面を自分のドメインから出す（vercel.json で /__/auth を中継）。それ以外は Firebase のドメイン
  const onSite = location.hostname === cfg.siteHost;
  const app = initializeApp({ ...cfg, authDomain: onSite ? location.host : cfg.authDomain });
  const auth = A.getAuth(app), db = F.getFirestore(app);
  Object.assign(Cloud, { api: F, auth, ready: true });
  Cloud.signIn = async () => {
    const provider = new A.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await A.signInWithPopup(auth, provider); }
    catch (e) {
      const code = e && e.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await A.signInWithRedirect(auth, provider);
      else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') hooks.toast('ログインできませんでした。もう一度試してください。');
    }
  };
  Cloud.signOut = () => A.signOut(auth);
  A.getRedirectResult(auth).catch(() => {});
  hooks.onUser(null, 'ready');

  A.onAuthStateChanged(auth, async user => {
    if (Cloud.unsub) { Cloud.unsub(); Cloud.unsub = null; }
    Cloud.user = user; Cloud.ref = null;
    if (!user) { hooks.setJson(hooks.localJson()); hooks.onUser(null); return; }
    Cloud.ref = F.doc(db, 'umi', user.uid);
    let snap;
    try { snap = await F.getDoc(Cloud.ref); }
    catch (_) { hooks.toast('アカウントのデータを読み込めませんでした'); hooks.onUser(user); return; }
    if (snap.exists()) {
      Cloud.lastJson = snap.data().json || '';
      hooks.setJson(Cloud.lastJson);
    } else {
      // はじめてのログイン：この端末のデータを、そのままアカウントのデータにする
      const json = hooks.getJson();
      try { await F.setDoc(Cloud.ref, { json, updatedAt: F.serverTimestamp() }); Cloud.lastJson = json; hooks.toast('この端末のデータをアカウントに保存しました'); }
      catch (_) { hooks.toast('アカウントに保存できませんでした'); }
    }
    hooks.onUser(user);
    // ほかの端末での変更を、そのまま映す
    Cloud.unsub = F.onSnapshot(Cloud.ref, s => {
      if (!s.exists() || s.metadata.hasPendingWrites) return;
      const json = s.data().json || '';
      if (json === Cloud.lastJson || Cloud.timer) return;
      Cloud.lastJson = json; hooks.setJson(json);
    });
  });
}

// ---------------------------------------------------------------- 潮見（AI）：I/P/E/D を付けてもらう
export const Shiomi = {
  state: 'off',   // off（ログインなし）/ idle / busy / unset（Vercel に未設定）/ denied（許可されていないアカウント）/ error
  timer: 0, backoff: 30e3,
  kick(hooks, delay = 2500) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(hooks), delay);
  },
  async run(hooks) {
    if (!Cloud.user) { this.state = 'off'; hooks.status(); return; }
    if (this.state === 'unset' || this.state === 'denied') return;
    const todo = hooks.pending().slice(0, 12);
    if (!todo.length) { this.state = 'idle'; hooks.status(); return; }
    this.state = 'busy'; hooks.status();
    try {
      const r = await fetch('/api/weigh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await Cloud.token()}` },
        body: JSON.stringify({ tasks: todo, examples: hooks.examples() })
      });
      if (r.status === 503) { this.state = 'unset'; hooks.status(); return; }
      if (r.status === 401 || r.status === 403) { this.state = 'denied'; hooks.status(); return; }
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      hooks.apply(d.results || []);
      this.state = 'idle'; this.backoff = 30e3; hooks.status();
      if (hooks.pending().length) this.kick(hooks, 1500);
    } catch (_) {
      this.state = 'error'; hooks.status();
      this.kick(hooks, this.backoff); this.backoff = Math.min(10 * 60e3, this.backoff * 2);
    }
  }
};
