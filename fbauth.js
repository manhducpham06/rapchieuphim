// Xác minh ID token của Firebase Authentication (RS256) mà không cần thư viện ngoài.
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

function fetchCerts() {
  return new Promise((resolve, reject) => {
    const req = https.get(CERT_URL, { timeout: 6000 }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        try {
          const m = /max-age=(\d+)/.exec(res.headers['cache-control'] || '');
          resolve({ certs: JSON.parse(b), ttl: (m ? Number(m[1]) : 3600) * 1000 });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

function readProjectId(publicDir, env) {
  if (env.FIREBASE_PROJECT_ID) return env.FIREBASE_PROJECT_ID;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(publicDir, 'firebase-config.json'), 'utf8'));
    return j.projectId || '';
  } catch { return ''; }
}

function createFirebaseAuth(opts = {}) {
  const env = opts.env || process.env;
  const projectId = opts.projectId !== undefined ? opts.projectId : readProjectId(opts.publicDir || path.join(__dirname, 'public'), env);
  const getCerts = opts.fetchCerts || fetchCerts;
  let cache = { at: 0, ttl: 0, certs: null };

  async function certs(force) {
    if (!force && cache.certs && Date.now() - cache.at < cache.ttl) return cache.certs;
    const r = await getCerts();
    cache = { at: Date.now(), ttl: r.ttl || 3600000, certs: r.certs };
    return cache.certs;
  }

  /** Trả về { uid, name, email } hoặc null nếu token sai / hết hạn. */
  async function verify(token) {
    if (!projectId || typeof token !== 'string' || token.length > 4000) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let header, payload;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    } catch { return null; }
    if (header.alg !== 'RS256' || !header.kid) return null;
    let cs;
    try { cs = await certs(false); } catch { return null; }
    let pem = cs[header.kid];
    if (!pem) { try { pem = (await certs(true))[header.kid]; } catch { return null; } }
    if (!pem) return null;
    const ok = crypto.createVerify('RSA-SHA256').update(parts[0] + '.' + parts[1]).verify(pem, Buffer.from(parts[2], 'base64url'));
    if (!ok) return null;
    const t = Math.floor(Date.now() / 1000);
    if (payload.aud !== projectId || payload.iss !== 'https://securetoken.google.com/' + projectId) return null;
    if (!(payload.exp > t - 30) || !(payload.iat <= t + 300)) return null;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return { uid: payload.sub, name: typeof payload.name === 'string' ? payload.name : '', email: payload.email || '' };
  }

  return { verify, projectId, enabled: !!projectId };
}

module.exports = { createFirebaseAuth };
