// Tài khoản người chơi bằng Firebase Authentication (email + mật khẩu) và hồ sơ lưu ở Firestore.
// Nếu chưa cấu hình firebase-config.json thì chỉ cho chơi khách.
const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}/`;

export async function initAuth(onChange) {
  const api = { enabled: false, user: null, error: '' };
  let cfg = null;
  try {
    const r = await fetch('firebase-config.json', { cache: 'no-cache' });
    cfg = await r.json();
  } catch { /* không có cấu hình */ }
  if (!cfg || !cfg.apiKey || !cfg.projectId) return api;

  let A, F, auth, db;
  try {
    const app = await import(CDN + 'firebase-app.js');
    A = await import(CDN + 'firebase-auth.js');
    F = await import(CDN + 'firebase-firestore.js');
    const fb = app.initializeApp(cfg);
    auth = A.getAuth(fb);
    db = F.getFirestore(fb);
  } catch (e) {
    api.error = 'Không tải được dịch vụ đăng nhập (kiểm tra Internet).';
    return api;
  }
  api.enabled = true;

  const msg = (e) => {
    const c = (e && e.code) || '';
    const M = {
      'auth/email-already-in-use': 'Email này đã có tài khoản. Hãy chuyển sang Đăng nhập.',
      'auth/invalid-email': 'Email chưa đúng định dạng.',
      'auth/weak-password': 'Mật khẩu quá yếu, cần ít nhất 6 ký tự.',
      'auth/missing-password': 'Bạn chưa nhập mật khẩu.',
      'auth/invalid-credential': 'Sai email hoặc mật khẩu.',
      'auth/wrong-password': 'Sai email hoặc mật khẩu.',
      'auth/user-not-found': 'Sai email hoặc mật khẩu.',
      'auth/too-many-requests': 'Thử quá nhiều lần, hãy đợi vài phút rồi thử lại.',
      'auth/network-request-failed': 'Mất kết nối mạng.',
      'auth/operation-not-allowed': 'Chủ game chưa bật phương thức đăng nhập này trong Firebase.',
      'auth/popup-closed-by-user': '',
      'auth/cancelled-popup-request': '',
      'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy cho phép cửa sổ bật lên rồi thử lại.',
      'auth/unauthorized-domain': 'Tên miền này chưa được thêm vào danh sách cho phép của Firebase (Authentication → Settings → Authorized domains).',
      'auth/account-exists-with-different-credential': 'Email này đã đăng ký bằng mật khẩu. Hãy đăng nhập bằng email và mật khẩu.',
    };
    return c in M ? M[c] : 'Có lỗi xảy ra (' + (c || 'không rõ') + ').';
  };

  const userDoc = () => F.doc(db, 'users', auth.currentUser.uid);

  api.register = async (email, password, name) => {
    try {
      await persist(true);
      const cr = await A.createUserWithEmailAndPassword(auth, email, password);
      await A.updateProfile(cr.user, { displayName: name });
      await cr.user.getIdToken(true); // nạp lại để token có tên hiển thị
      try { await F.setDoc(F.doc(db, 'users', cr.user.uid), { name, createdAt: Date.now() }, { merge: true }); } catch {}
      api.user = cr.user;
      return { ok: true };
    } catch (e) { return { ok: false, error: msg(e) }; }
  };
  // remember = true: giữ đăng nhập lâu dài; false: chỉ trong tab này, đóng trình duyệt là thoát.
  const persist = (remember) => A.setPersistence(auth, remember ? A.browserLocalPersistence : A.browserSessionPersistence).catch(() => {});
  // Đăng nhập / đăng ký bằng Google (cần bật nhà cung cấp Google trong Firebase Authentication)
  api.google = async () => {
    try {
      await persist(true);
      const cr = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
      api.user = cr.user;
      return { ok: true };
    } catch (e) { return { ok: false, error: msg(e) }; }
  };
  api.login = async (email, password, remember = true) => {
    try {
      await persist(remember);
      const cr = await A.signInWithEmailAndPassword(auth, email, password);
      api.user = cr.user;
      return { ok: true };
    } catch (e) { return { ok: false, error: msg(e) }; }
  };
  api.reset = async (email) => {
    try { await A.sendPasswordResetEmail(auth, email); return { ok: true }; } catch (e) { return { ok: false, error: msg(e) }; }
  };
  api.logout = () => A.signOut(auth);
  api.idToken = async () => (auth.currentUser ? auth.currentUser.getIdToken() : null);
  api.loadProfile = async () => {
    if (!auth.currentUser) return null;
    try {
      const s = await F.getDoc(userDoc());
      return s.exists() ? s.data() : {};
    } catch { return null; }
  };
  api.saveTokens = async (tokens) => {
    if (!auth.currentUser) return;
    try { await F.setDoc(userDoc(), { tokens: tokens.slice(-8), updatedAt: Date.now() }, { merge: true }); } catch {}
  };
  api.rename = async (name) => {
    if (!auth.currentUser) return;
    try {
      await A.updateProfile(auth.currentUser, { displayName: name });
      await auth.currentUser.getIdToken(true);
      await F.setDoc(userDoc(), { name }, { merge: true });
    } catch {}
  };

  A.onAuthStateChanged(auth, (u) => { api.user = u; onChange && onChange(u); });
  return api;
}
