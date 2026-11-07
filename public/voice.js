// Voice chat theo khoảng cách bằng WebRTC (kết nối trực tiếp giữa các máy, máy chủ chỉ chuyển tín hiệu).
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const R_IN = 15;   // vào phạm vi nghe (mét)
const R_OUT = 19;  // ra khỏi phạm vi (có độ trễ để khỏi chập chờn)
const MAX_LINKS = 6;

export function createVoice({ send, getPeers, getMe, getMyId, onSpeaking, onState, toast }) {
  let micTrack = null, micStream = null;
  let micOn = false, spkOn = true;
  const links = new Map(); // id -> { pc, audio, polite, makingOffer, ignoreOffer, srcNode, analyser, speaking, since, outSince }
  const wantAt = new Map();
  let ctx = null, local = null, timer = null, level = null;
  const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection);

  function audioCtx() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function makeAnalyser(stream) {
    const c = audioCtx();
    if (!c) return null;
    try {
      const src = c.createMediaStreamSource(stream);
      const an = c.createAnalyser();
      an.fftSize = 512;
      src.connect(an); // không nối ra loa: chỉ để đo mức âm
      return { an, src, buf: new Uint8Array(an.fftSize) };
    } catch { return null; }
  }
  function rms(a) {
    a.an.getByteTimeDomainData(a.buf);
    let s = 0;
    for (let i = 0; i < a.buf.length; i++) { const v = (a.buf[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / a.buf.length);
  }

  function dist(id) {
    const me = getMe(), p = getPeers().get(id);
    if (!p) return Infinity;
    return Math.hypot(p.x - me.x, p.z - me.z);
  }
  const gainFor = (d) => (spkOn ? Math.max(0.06, Math.min(1, 1 - (d - 1.5) / (R_IN - 1.5))) ** 1.3 : 0);

  function makeLink(id, passive) {
    const myId = getMyId();
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const L = { pc, polite: myId > id, makingOffer: false, ignoreOffer: false, audio: null, an: null, speaking: false, outSince: 0 };
    links.set(id, L);
    pc.onicecandidate = (e) => { if (e.candidate) send({ t: 'rtc', to: id, d: { c: e.candidate } }); };
    pc.onnegotiationneeded = async () => {
      try {
        L.makingOffer = true;
        await pc.setLocalDescription();
        send({ t: 'rtc', to: id, d: { s: pc.localDescription } });
      } catch {} finally { L.makingOffer = false; }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      if (!L.audio) {
        L.audio = new Audio();
        L.audio.autoplay = true;
        L.audio.playsInline = true;
      }
      L.audio.srcObject = stream;
      L.audio.volume = gainFor(dist(id));
      L.audio.play().catch(() => armUnlock());
      if (L.an) { try { L.an.src.disconnect(); } catch {} }
      L.an = makeAnalyser(stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') { try { pc.restartIce(); } catch {} }
    };
    // luôn có đường nhận/gửi âm thanh; mic bật/tắt chỉ cần replaceTrack
    if (!passive) {
      const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
      if (micTrack) tr.sender.replaceTrack(micTrack).catch(() => {});
    }
    return L;
  }
  function closeLink(id) {
    const L = links.get(id);
    if (!L) return;
    links.delete(id);
    try { L.pc.close(); } catch {}
    if (L.audio) { L.audio.pause(); L.audio.srcObject = null; }
    if (L.an) { try { L.an.src.disconnect(); } catch {} }
    if (L.speaking) onSpeaking(id, false);
  }

  let unlockArmed = false;
  function armUnlock() {
    if (unlockArmed) return;
    unlockArmed = true;
    const go = () => {
      unlockArmed = false;
      audioCtx();
      for (const L of links.values()) if (L.audio) L.audio.play().catch(() => {});
    };
    window.addEventListener('pointerdown', go, { once: true });
  }

  async function onSignal(from, d) {
    if (!d) return;
    let L = links.get(from);
    if (!L) {
      if (!getPeers().has(from) || links.size >= MAX_LINKS + 2) return;
      L = makeLink(from, !d.w); // người có id nhỏ hơn là bên chủ động gọi
    }
    if (d.w) return;
    const pc = L.pc;
    try {
      if (d.s) {
        const offerCollision = d.s.type === 'offer' && (L.makingOffer || pc.signalingState !== 'stable');
        L.ignoreOffer = !L.polite && offerCollision;
        if (L.ignoreOffer) return;
        await pc.setRemoteDescription(d.s);
        if (d.s.type === 'offer') {
          for (const t of pc.getTransceivers()) if (t.receiver.track.kind === 'audio') { try { t.direction = 'sendrecv'; } catch {} if (micTrack) t.sender.replaceTrack(micTrack).catch(() => {}); }
          await pc.setLocalDescription();
          send({ t: 'rtc', to: from, d: { s: pc.localDescription } });
        }
      } else if (d.c) {
        try { await pc.addIceCandidate(d.c); } catch (e) { if (!L.ignoreOffer) throw e; }
      }
    } catch { /* tín hiệu lỗi: bỏ qua, vòng tick sẽ dựng lại nếu cần */ }
  }

  // chọn những người trong phạm vi và dựng/đóng kết nối
  function tick() {
    const me = getMe();
    if (!me || getMyId() == null) return;
    const near = [];
    for (const [id, p] of getPeers()) {
      if (id === getMyId()) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      const L = links.get(id);
      if (d <= R_IN || (L && d <= R_OUT)) near.push([d, id]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const want = new Set(near.slice(0, MAX_LINKS).map((x) => x[1]));
    for (const id of want) {
      if (links.has(id)) continue;
      if (getMyId() < id) makeLink(id, false);
      else if (performance.now() - (wantAt.get(id) || 0) > 3000) { wantAt.set(id, performance.now()); send({ t: 'rtc', to: id, d: { w: 1 } }); }
    }
    const t = performance.now();
    for (const [id, L] of [...links]) {
      if (want.has(id)) L.outSince = 0;
      else if (!L.outSince) L.outSince = t;
      else if (t - L.outSince > 3500) closeLink(id);
    }
    for (const [id, L] of links) if (L.audio) L.audio.volume = gainFor(dist(id));
  }

  function meter() {
    if (local) {
      const on = micOn && rms(local) > 0.035;
      if (on !== (level === 'on')) { level = on ? 'on' : 'off'; onSpeaking('me', on); }
    }
    for (const [id, L] of links) {
      if (!L.an) continue;
      const on = spkOn && rms(L.an) > 0.03 && (L.audio ? L.audio.volume > 0.04 : true);
      if (on !== L.speaking) { L.speaking = on; onSpeaking(id, on); }
    }
  }
  function ensureTimers() {
    if (!timer) timer = [setInterval(tick, 700), setInterval(meter, 120)];
  }

  async function setMic(on) {
    if (on === micOn) return micOn;
    if (!on) {
      micOn = false;
      if (micTrack) { micTrack.stop(); micTrack = null; }
      if (micStream) micStream = null;
      if (local) { try { local.src.disconnect(); } catch {} local = null; }
      for (const L of links.values()) for (const t of L.pc.getTransceivers()) if (t.sender) t.sender.replaceTrack(null).catch(() => {});
      onSpeaking('me', false); level = 'off';
      onState({ mic: false, spk: spkOn });
      return false;
    }
    if (!supported) { toast('Trình duyệt này không hỗ trợ micro.'); return false; }
    if (!window.isSecureContext) { toast('Micro chỉ dùng được khi mở bằng https.'); return false; }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch (e) {
      toast(e && e.name === 'NotFoundError' ? 'Không tìm thấy micro trên thiết bị.' : 'Bạn chưa cho phép dùng micro. Hãy bấm biểu tượng ổ khoá cạnh địa chỉ web để cho phép.');
      return false;
    }
    micTrack = micStream.getAudioTracks()[0];
    micTrack.onended = () => setMic(false);
    micOn = true;
    local = makeAnalyser(micStream);
    audioCtx();
    for (const L of links.values()) for (const t of L.pc.getTransceivers()) if (t.sender) t.sender.replaceTrack(micTrack).catch(() => {});
    ensureTimers();
    onState({ mic: true, spk: spkOn });
    return true;
  }
  function setSpeaker(on) {
    spkOn = on;
    for (const [id, L] of links) if (L.audio) L.audio.volume = gainFor(dist(id));
    onState({ mic: micOn, spk: spkOn });
    if (on) audioCtx();
  }
  function reset() { for (const id of [...links.keys()]) closeLink(id); }
  function peerLeft(id) { closeLink(id); }
  function start() { ensureTimers(); }
  function stop() { reset(); setMic(false); if (timer) { timer.forEach(clearInterval); timer = null; } }

  return { debug: () => ({ ctx: ctx && ctx.state, local: local ? rms(local) : null, links: [...links].map(([id, l]) => ({ id, vol: l.audio && l.audio.volume, paused: l.audio && l.audio.paused, rms: l.an ? rms(l.an) : null, d: dist(id) })) }), linkStates: () => [...links.values()].map((l) => l.pc.connectionState), supported, onSignal, reset, peerLeft, start, stop, setMic, setSpeaker, get mic() { return micOn; }, get spk() { return spkOn; } };
}
