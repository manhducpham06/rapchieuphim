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

  // ----- cửa hàng thời trang -----
  shirt: '<path d="M8.6 3.5 3 6.4a1 1 0 0 0-.5 1.2l1.4 3.6a1 1 0 0 0 1.2.6L7 11.3V19.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-8.2l1.9.5a1 1 0 0 0 1.2-.6l1.4-3.6a1 1 0 0 0-.5-1.2L15.4 3.5c-.4 1.5-1.8 2.4-3.4 2.4S9 5 8.6 3.5z"/>',
  pants: '<path d="M6.5 3.5h11l1 17a.8.8 0 0 1-.8.9h-3.4a.8.8 0 0 1-.8-.7L12 11.4l-1.5 9.3a.8.8 0 0 1-.8.7H6.3a.8.8 0 0 1-.8-.9z"/>',
  shoe: '<path d="M3 15.5V9.2a1 1 0 0 1 1.5-.8l3.3 1.8c1.2.7 2.5 1.1 3.9 1.1H13c1.6 0 3 .8 3.8 2.1l3.6 1.4a1.5 1.5 0 0 1 1 1.4v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  cap: '<path d="M4 15a8 8 0 0 1 16 0z"/><path d="M12 15h10a1 1 0 0 1 0 2H12z" opacity=".75"/><rect x="3" y="15.8" width="18" height="2.2" rx="1.1"/>',
  glasses: '<circle cx="7" cy="14" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="14" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 13.4c.6-.5 1.4-.5 2 0M3 12.5 4.5 8M21 12.5 19.5 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  crown: '<path d="M3 8.5 7.6 12 12 5l4.4 7L21 8.5l-1.6 9.5a1 1 0 0 1-1 .8H5.6a1 1 0 0 1-1-.8z"/><rect x="5" y="19.6" width="14" height="1.8" rx=".8"/>',
  scarf: '<path d="M4 8.5C4 6.6 7.5 5 12 5s8 1.6 8 3.5v3c0 1.9-3.5 3.5-8 3.5s-8-1.6-8-3.5z"/><path d="M13 14.5h4.2l.8 6.2a.7.7 0 0 1-.7.8h-3a.7.7 0 0 1-.7-.6z" opacity=".8"/>',
  wings: '<path d="M12 8c-1-3.2-4.5-5.2-9-4.8.3 4.8 2.2 8 5.4 9.4-1.7.3-3 .9-4 1.8 3 .6 5.4 1.4 7.6 3.1zM12 8c1-3.2 4.5-5.2 9-4.8-.3 4.8-2.2 8-5.4 9.4 1.7.3 3 .9 4 1.8-3 .6-5.4 1.4-7.6 3.1z"/>',
  coin: '<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#0d0710" stroke-opacity=".35" stroke-width="1.4"/><path d="M12.4 7.2v9.6M9.8 9.4c.4-1.3 4.6-1.6 4.6.3 0 2-4.8 1-4.8 3.1 0 1.8 4.2 1.8 4.9.2" fill="none" stroke="#0d0710" stroke-opacity=".55" stroke-width="1.5" stroke-linecap="round"/>',
  store: '<path d="M3.5 9.5 5 4.5h14l1.5 5z"/><path d="M4.5 11h15v8.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" opacity=".9"/><path d="M3.5 9.5a2.6 2.6 0 0 0 5 0 2.6 2.6 0 0 0 5 0 2.6 2.6 0 0 0 5 0 2.6 2.6 0 0 0 2 1" fill="none" stroke="#0d0710" stroke-opacity=".3" stroke-width="1.2"/><rect x="9.5" y="14" width="5" height="6.5" rx=".8" fill="#0d0710" fill-opacity=".35"/>',
  hanger: '<path d="M12 7.2V6a2 2 0 1 1 2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m12 8.5 9.2 7a1 1 0 0 1-.6 1.8H3.4a1 1 0 0 1-.6-1.8z"/>',
  sparkle: '<path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5zM19 15.5c.3 2 1.2 3 3 3.3-1.8.3-2.7 1.3-3 3.2-.3-1.9-1.2-2.9-3-3.2 1.8-.3 2.7-1.3 3-3.3z"/>',
  globe: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M2.8 12h18.4M12 2.8c3 2.8 3 15.6 0 18.4M12 2.8c-3 2.8-3 15.6 0 18.4" fill="none" stroke="currentColor" stroke-width="1.7"/>',

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

// ----- icon cho thanh công cụ / cửa hàng / trò chơi -----
Object.assign(ICONS, {
  rooms: '<path d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5V20"/><path d="M2.5 20h19"/><path d="M16 9h3.5A1.5 1.5 0 0 1 21 10.5V20"/><circle cx="12.4" cy="12.5" r="1" fill="currentColor"/>',
  chat: '<path d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.6 3.6a.6.6 0 0 1-1-.5V17h-.9A2.5 2.5 0 0 1 2 14.5v-8A2.5 2.5 0 0 1 4.5 4z"/>',
  smile: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.7" cy="9.8" r="1.35"/><circle cx="15.3" cy="9.8" r="1.35"/><path d="M7.6 14.2c1 2 2.6 3 4.4 3s3.4-1 4.4-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  gamepad: '<path d="M7.2 6.5h9.6c2.3 0 3.6 1.3 4.3 4.2l1 4.2c.4 2-.7 3.6-2.5 3.6-1.1 0-1.9-.5-2.7-1.6l-1-1.4H8.1l-1 1.4c-.8 1.1-1.6 1.6-2.7 1.6-1.8 0-2.9-1.6-2.5-3.6l1-4.2c.7-2.9 2-4.2 4.3-4.2z"/><path d="M7.5 9.4v3M6 10.9h3" stroke="#000" stroke-opacity=".55" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="15.4" cy="10.4" r=".95" fill="#000" fill-opacity=".55"/><circle cx="17.6" cy="12.3" r=".95" fill="#000" fill-opacity=".55"/>',
  ticket: '<path d="M3 8.2A2 2 0 0 0 5 6.2h14a2 2 0 0 0 2 2 2 2 0 0 0 0 7.6 2 2 0 0 0-2 2H5a2 2 0 0 0-2-2z" transform="translate(0 -.9)"/><path d="M14 6.4v11.2" stroke="#000" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="2 2" fill="none"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="12" rx="2.2"/><path d="M15.5 5.6V5A2.2 2.2 0 0 0 13.3 3H6.2A2.2 2.2 0 0 0 4 5.2v8.1A2.2 2.2 0 0 0 6.2 15.5h.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  check: '<path d="m4.5 12.8 4.6 4.6L19.6 6.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.4"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  crown: '<path d="m3 8 4.4 3.6L12 4.5l4.6 7.1L21 8l-1.7 10.5H4.7z"/><rect x="4.6" y="19.4" width="14.8" height="1.8" rx=".9"/>',
  ball: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m12 7.2 4 2.9-1.5 4.7h-5L8 10.1z"/><path d="M12 7.2V3M16 10.1l4-1.3M14.5 14.8l2.5 3.6M9.5 14.8l-2.5 3.6M8 10.1 4 8.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V13m0-4.3a1.5 1.5 0 0 1 3 0V15c0 4-2.5 6.5-6.3 6.5-2.6 0-4-1-5.4-3.2L4.200 13.300a1.500 1.500 0 0 1 2.500-1.600L8 13.500" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  dance: '<circle cx="13.5" cy="4.5" r="2.2"/><path d="M10.5 9.5 13 8.2l3.2 2.5 3.6-1.6.7 1.6-4.4 2.1-2-1.6-.9 3.1 2.7 3.2-.7 5.3-1.9-.2-.5-4.7-2.8-2.9-2 4.6-1.8-.8 2.8-6.3z"/>',
  phone: '<path d="M7.2 2.8h9.6A1.7 1.7 0 0 1 18.5 4.5v15A1.7 1.7 0 0 1 16.8 21.2H7.2A1.7 1.7 0 0 1 5.5 19.5v-15A1.7 1.7 0 0 1 7.2 2.8z"/><circle cx="12" cy="18" r="1" fill="#000" fill-opacity=".5"/><rect x="8" y="5.4" width="8" height="10" rx=".8" fill="#000" fill-opacity=".35"/>',
  mic: '<rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V22M8.5 22h7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  micoff: '<rect x="8.5" y="2.5" width="7" height="12" rx="3.5" opacity=".55"/><path d="M5 11.5a7 7 0 0 0 11.2 5.6M19 11.5M12 18.5V22M8.5 22h7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity=".55"/><path d="M3.5 3.5l17 17" stroke="#ff6b81" stroke-width="2.4" stroke-linecap="round"/>',
  more: '<circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/>',
});

export const EMOTE_META = [
  { key: 'wave', label: 'Vẫy tay', icon: 'wave', color: '#ffb347' },
  { key: 'clap', label: 'Vỗ tay', icon: 'clap', color: '#ffd24a' },
  { key: 'heart', label: 'Yêu thích', icon: 'heart', color: '#ff5f7e' },
  { key: 'laugh', label: 'Cười', icon: 'laugh', color: '#ffc83d' },
  { key: 'wow', label: 'Wow', icon: 'wow', color: '#5fb4ff' },
  { key: 'popcorn', label: 'Bắp rang', icon: 'popcorn', color: '#ff8a4c' },
  { key: 'thumb', label: 'Tuyệt', icon: 'thumb', color: '#3fd6c0' },
  { key: 'dance', label: 'Nhảy', icon: 'dance', color: '#c07bff' },
  { key: 'phone', label: 'Gọi điện', icon: 'phone', color: '#6bd6ff' },
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
