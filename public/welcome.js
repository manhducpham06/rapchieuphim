// ChillGameZ: phần trình bày của màn hình đăng nhập (nút hiện/ẩn mật khẩu, nút xoá ô nhập, thanh trượt tab,
// chuyển nhanh giữa Đăng ký / Đăng nhập). Logic xác thực nằm trong main.js + auth.js.
const $ = (id) => document.getElementById(id);

const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>';

document.querySelectorAll('.cg-eye').forEach((b) => {
  const input = $(b.dataset.eye);
  b.innerHTML = EYE;
  b.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.innerHTML = show ? EYE_OFF : EYE;
    b.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    input.focus();
  });
});

document.querySelectorAll('.cg-x').forEach((b) => {
  const input = $(b.dataset.clear), wrap = input.closest('.cg-in');
  b.innerHTML = X;
  const sync = () => wrap.classList.toggle('has', input.value.length > 0);
  input.addEventListener('input', sync);
  b.addEventListener('click', () => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); });
  sync();
});

// thanh trượt tab theo tab đang chọn + câu mô tả theo chế độ
const tabs = $('authTabs');
const DESC = { register: 'Đăng ký tài khoản để bắt đầu hành trình của bạn!', login: 'Đăng nhập để tiếp tục hành trình của bạn!' };
if (tabs) {
  const sync = () => {
    const on = tabs.querySelector('button.on');
    tabs.dataset.on = on ? on.dataset.tab : 'register';
    if (on && $('cgDesc')) $('cgDesc').textContent = DESC[on.dataset.tab] || DESC.register;
  };
  new MutationObserver(sync).observe(tabs, { attributes: true, subtree: true, attributeFilter: ['class'] });
  sync();
}
// liên kết "Đăng nhập ngay" / "Đăng ký ngay" cuối form bấm vào tab tương ứng
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
  const t = tabs && tabs.querySelector(`button[data-tab="${b.dataset.go}"]`);
  if (t) t.click();
}));
