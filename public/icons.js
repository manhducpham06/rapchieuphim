// Bộ icon vector dùng chung cho giao diện (HTML) và biểu cảm nổi trong thế giới 3D.
// Tất cả vẽ trên lưới 24x24, tô bằng currentColor nên đổi màu bằng CSS.

export const ICONS = {
  play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8A.8.8 0 0 0 8 5.2z"/>',
  pause: '<rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/>',
  next: '<path d="M5 5.6v12.8a.7.7 0 0 0 1.1.6l8.6-6.4a.7.7 0 0 0 0-1.2L6.1 5A.7.7 0 0 0 5 5.6z"/><rect x="16" y="5" width="3" height="14" rx="1.1"/>',
  volume: '<path d="M3 9.5v5h3.6l4.6 3.9a.6.6 0 0 0 1-.5V6.1a.6.6 0 0 0-1-.5L6.6 9.5H3z"/><path d="M15.2 8.6a4.8 4.8 0 0 1 0 6.8M17.9 5.9a8.6 8.6 0 0 1 0 12.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  mute: '<path d="M3 9.5v5h3.6l4.6 3.9a.6.6 0 0 0 1-.5V6.1a.6.6 0 0 0-1-.5L6.6 9.5H3z"/><path d="m16 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  full: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  minus: '<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  send: '<path d="M3.4 4.6a.8.8 0 0 1 1.1-.9l16 7.4a.9.9 0 0 1 0 1.6l-16 7.4a.8.8 0 0 1-1.1-.9L5 13l8-1-8-1z"/>',
  shuffle: '<path d="M4 7h3.2c1.4 0 2.6.7 3.4 1.8l3 4.4c.8 1.1 2 1.8 3.4 1.8H20M4 17h3.2c1.4 0 2.6-.7 3.4-1.8M13.6 8.8c.8-1.1 2-1.8 3.4-1.8H20M17.5 4 20.5 7l-3 3M17.5 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 19.5c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6a.9.9 0 0 1-.9.9H3.4a.9.9 0 0 1-.9-.9z"/><path d="M15.6 4.9a3.4 3.4 0 0 1 0 6.2M17.6 14.2c2.4.5 4.1 2.2 4.1 4.6a.9.9 0 0 1-.9.9h-2.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  help: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="16.9" r="1.2"/>',
  screen: '<rect x="2.5" y="4" width="19" height="13" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8 20.5h8M12 17v3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M10.4 8.3v4.4a.4.4 0 0 0 .6.3l3.6-2.2a.4.4 0 0 0 0-.7L11 8a.4.4 0 0 0-.6.3z"/>',
  seat: '<path d="M7.5 3h9A2.5 2.5 0 0 1 19 5.5V12H5V5.5A2.5 2.5 0 0 1 7.5 3z"/><path d="M4.5 13.5h15a1.5 1.5 0 0 1 1.5 1.5v3H3v-3a1.5 1.5 0 0 1 1.5-1.5z"/><rect x="5.5" y="18.5" width="2.2" height="2.7" rx=".6"/><rect x="16.3" y="18.5" width="2.2" height="2.7" rx=".6"/>',
  queue: '<path d="M4 6h12M4 11h12M4 16h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.5 14.5v5a.5.5 0 0 0 .8.4l3.6-2.5a.5.5 0 0 0 0-.8l-3.6-2.5a.5.5 0 0 0-.8.4z"/>',
  film: '<path d="M3 10.2h18V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3.3 6.3 18.7 3l.9 4.1L4.2 10.4z"/><path d="m8 7.2 2.2 3M13 6.1l2.2 3" stroke="#0d0710" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".55"/>',
  enter: '<path d="M10 4.5H6.5A2 2 0 0 0 4.5 6.5v11a2 2 0 0 0 2 2H10M9.5 12h10m0 0-3.6-3.6M19.5 12l-3.6 3.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.8"/>',

  // ----- biểu cảm -----
  wave:
    '<rect x="6.4" y="10" width="11.6" height="10.5" rx="4.6"/>' +
    '<rect x="6.4" y="3.6" width="2.6" height="10.5" rx="1.3"/><rect x="9.6" y="2" width="2.6" height="11.5" rx="1.3"/>' +
    '<rect x="12.8" y="2.6" width="2.6" height="11" rx="1.3"/><rect x="16" y="4.8" width="2.6" height="9.4" rx="1.3"/>' +
    '<rect x="2.6" y="11.6" width="2.7" height="7" rx="1.35" transform="rotate(-34 3.9 15)"/>',
  clap:
    '<g transform="rotate(-27 12 15)"><rect x="7.2" y="7" width="5.2" height="12.5" rx="2.6"/></g>' +
    '<g transform="rotate(27 12 15)"><rect x="11.6" y="7" width="5.2" height="12.5" rx="2.6" opacity=".82"/></g>' +
    '<rect x="11.2" y="1.2" width="1.7" height="3.6" rx=".85"/>' +
    '<rect x="4.4" y="3" width="1.7" height="3.6" rx=".85" transform="rotate(-38 5.2 4.8)"/>' +
    '<rect x="18" y="3" width="1.7" height="3.6" rx=".85" transform="rotate(38 18.8 4.8)"/>',
  heart: '<path d="M12 21 10.6 19.8C5.6 15.3 2.5 12.5 2.5 8.9 2.5 6 4.7 3.8 7.6 3.8c1.7 0 3.2.8 4.4 2.1 1.2-1.3 2.7-2.1 4.4-2.1 2.9 0 5.1 2.2 5.1 5.1 0 3.6-3.1 6.4-8.1 10.9z"/>',
  laugh:
    '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8.7 8.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm6.6 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM6.9 13.6h10.2a5.1 5.1 0 0 1-10.2 0z"/>',
  wow:
    '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8.6 8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm6.8 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM12 13.4a3 3.3 0 1 0 0 6.6 3 3.3 0 0 0 0-6.6z"/>',
  popcorn:
    '<circle cx="8" cy="6.6" r="2.8"/><circle cx="12" cy="5" r="3.1"/><circle cx="16" cy="6.6" r="2.8"/><circle cx="10" cy="8.7" r="2.5"/><circle cx="14" cy="8.7" r="2.5"/>' +
    '<path d="M5.4 10.2h13.2l-1.7 11a1 1 0 0 1-1 .8H8.1a1 1 0 0 1-1-.8z"/>' +
    '<path d="M9.3 11.8 9.9 21M12 11.8V21M14.7 11.8 14.1 21" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1.1"/>',
  thumb:
    '<rect x="2.5" y="10.2" width="4.2" height="10.8" rx="1.2"/><path d="M8.5 10.6 12 3.4a1.3 1.3 0 0 1 1.2-.8c1.5 0 2.5 1.3 2.2 2.8L14.9 8H19a2.3 2.3 0 0 1 2.2 2.9l-1.7 7.3a2.4 2.4 0 0 1-2.3 1.8H9.8a1.3 1.3 0 0 1-1.3-1.3z"/>',
};

export const EMOTE_META = [
  { key: 'wave', label: 'Vẫy tay', icon: 'wave', color: '#ffb347' },
  { key: 'clap', label: 'Vỗ tay', icon: 'clap', color: '#ffd24a' },
  { key: 'heart', label: 'Yêu thích', icon: 'heart', color: '#ff5f7e' },
  { key: 'laugh', label: 'Cười', icon: 'laugh', color: '#ffc83d' },
  { key: 'wow', label: 'Wow', icon: 'wow', color: '#5fb4ff' },
  { key: 'popcorn', label: 'Bắp rang', icon: 'popcorn', color: '#ff8a4c' },
  { key: 'thumb', label: 'Tuyệt', icon: 'thumb', color: '#3fd6c0' },
];

/** Thẻ <svg> dùng symbol đã nạp bằng injectSprite() */
export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** Nạp toàn bộ icon vào trang một lần để dùng qua <use href="#i-tên"> */
export function injectSprite() {
  if (document.getElementById('icon-sprite')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'icon-sprite';
  s.setAttribute('width', '0');
  s.setAttribute('height', '0');
  s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  s.innerHTML = Object.entries(ICONS)
    .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`)
    .join('');
  document.body.prepend(s);
}

const imgCache = new Map();
/** Ảnh của icon (dùng để vẽ lên canvas cho sprite 3D). Có thể chưa tải xong: dùng img.decode() hoặc onload. */
export function iconImage(name, color = '#ffffff') {
  const k = name + color;
  if (imgCache.has(k)) return imgCache.get(k);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="192" height="192" fill="${color}" color="${color}">${ICONS[name] || ''}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  imgCache.set(k, img);
  return img;
}
