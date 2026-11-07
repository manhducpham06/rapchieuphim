/*
 * Danh mục cửa hàng thời trang + gói nạp xu. Dùng chung cho server (Node) và trình duyệt.
 * Server là nơi quyết định giá và kiểm tra quyền sở hữu; client chỉ dùng để hiển thị.
 * 1 xu = 1 đồng. Mọi món đều rẻ (<= 10.000 xu) và mọi gói nạp <= 10.000đ.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CATALOG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Các ô trang bị trên nhân vật
  const SLOTS = [
    { id: 'top', name: 'Áo', icon: 'shirt' },
    { id: 'bottom', name: 'Quần', icon: 'pants' },
    { id: 'shoes', name: 'Giày', icon: 'shoe' },
    { id: 'cap', name: 'Màu mũ', icon: 'cap' },
    { id: 'face', name: 'Kính', icon: 'glasses' },
    { id: 'head', name: 'Đầu', icon: 'crown' },
    { id: 'neck', name: 'Cổ', icon: 'scarf' },
    { id: 'back', name: 'Lưng', icon: 'wings' },
  ];
  const SLOT_IDS = SLOTS.map((s) => s.id);

  const ITEMS = [];
  const add = (slot, id, name, price, extra) => ITEMS.push({ id, slot, name, price, ...extra });

  // ---- Áo: màu + hoạ tiết (vẽ lên vùng áo của nhân vật) ----
  add('top', 't_red', 'Áo đỏ cờ', 1000, { color: '#d92d2d', style: 'solid' });
  add('top', 't_sky', 'Áo xanh trời', 1000, { color: '#3aa0ff', style: 'solid' });
  add('top', 't_mint', 'Áo bạc hà', 1500, { color: '#3ddbb0', style: 'solid' });
  add('top', 't_pink', 'Áo hồng kẹo', 1500, { color: '#ff7eb6', style: 'solid' });
  add('top', 't_black', 'Áo đen basic', 1500, { color: '#1c1c22', style: 'solid' });
  add('top', 't_stripe', 'Áo sọc thuỷ thủ', 2500, { color: '#f4f4f4', color2: '#2a4fb0', style: 'stripe' });
  add('top', 't_dots', 'Áo chấm bi', 2500, { color: '#ffd23f', color2: '#e63946', style: 'dots' });
  add('top', 't_check', 'Áo caro', 3000, { color: '#c0392b', color2: '#22222a', style: 'check' });
  add('top', 't_gold', 'Áo vàng kim', 5000, { color: '#d4a42c', color2: '#fff1b8', style: 'shine' });
  add('top', 't_galaxy', 'Áo thiên hà', 6000, { color: '#2a1760', color2: '#7a5cff', style: 'stars' });
  add('top', 't_rainbow', 'Áo cầu vồng', 8000, { color: '#ff4d4d', color2: '#4d9dff', style: 'rainbow' });

  // ---- Quần ----
  add('bottom', 'b_jean', 'Quần jean', 1000, { color: '#2f4d86', style: 'solid' });
  add('bottom', 'b_black', 'Quần đen', 1000, { color: '#202028', style: 'solid' });
  add('bottom', 'b_khaki', 'Quần kaki', 1500, { color: '#b59a63', style: 'solid' });
  add('bottom', 'b_red', 'Quần đỏ', 1500, { color: '#c62f3a', style: 'solid' });
  add('bottom', 'b_check', 'Quần caro xám', 2500, { color: '#8a8f99', color2: '#3b3f48', style: 'check' });
  add('bottom', 'b_stripe', 'Quần sọc', 2500, { color: '#222a44', color2: '#7f93d6', style: 'stripe' });
  add('bottom', 'b_camo', 'Quần rằn ri', 3500, { color: '#5b6b3a', color2: '#2e3a1c', style: 'dots' });
  add('bottom', 'b_gold', 'Quần ánh vàng', 5000, { color: '#c99a1d', color2: '#fff1b8', style: 'shine' });
  add('bottom', 'b_galaxy', 'Quần thiên hà', 6000, { color: '#1d1048', color2: '#5ec8ff', style: 'stars' });

  // ---- Giày ----
  add('shoes', 's_white', 'Giày trắng', 1000, { color: '#f2f2f2', style: 'solid' });
  add('shoes', 's_black', 'Giày đen', 1000, { color: '#17171c', style: 'solid' });
  add('shoes', 's_red', 'Giày đỏ', 1500, { color: '#d02a2a', style: 'solid' });
  add('shoes', 's_blue', 'Giày xanh', 1500, { color: '#2a6fd0', style: 'solid' });
  add('shoes', 's_neon', 'Giày neon', 3000, { color: '#a6ff00', style: 'solid' });
  add('shoes', 's_gold', 'Giày vàng kim', 5000, { color: '#e0b030', style: 'shine' });

  // ---- Màu mũ (nhân vật có sẵn mũ) ----
  add('cap', 'c_red', 'Mũ đỏ', 800, { color: '#d92d2d', style: 'solid' });
  add('cap', 'c_blue', 'Mũ xanh', 800, { color: '#2f6fe0', style: 'solid' });
  add('cap', 'c_black', 'Mũ đen', 800, { color: '#1c1c22', style: 'solid' });
  add('cap', 'c_pink', 'Mũ hồng', 1200, { color: '#ff7eb6', style: 'solid' });
  add('cap', 'c_gold', 'Mũ vàng kim', 4000, { color: '#d4a42c', style: 'shine' });

  // ---- Phụ kiện 3D (gắn lên xương nhân vật) ----
  add('face', 'f_glasses', 'Kính cận tròn', 1500, { acc: 'glasses', color: '#222' });
  add('face', 'f_shades', 'Kính râm', 2000, { acc: 'shades', color: '#111' });
  add('face', 'f_heart', 'Kính trái tim', 3000, { acc: 'heartglasses', color: '#ff4d8d' });
  add('face', 'f_visor', 'Kính tương lai', 5000, { acc: 'visor', color: '#2ee6ff' });
  add('head', 'h_phones', 'Tai nghe', 2000, { acc: 'headphones', color: '#ff4d4d' });
  add('head', 'h_ears', 'Tai mèo', 2500, { acc: 'catears', color: '#ffb3d1' });
  add('head', 'h_halo', 'Vầng sáng', 4000, { acc: 'halo', color: '#ffe066' });
  add('head', 'h_crown', 'Vương miện', 7000, { acc: 'crown', color: '#ffc83a' });
  add('head', 'h_horn', 'Sừng quỷ nhỏ', 3000, { acc: 'horns', color: '#d11a3a' });
  add('neck', 'n_scarf', 'Khăn len đỏ', 1500, { acc: 'scarf', color: '#d92d2d' });
  add('neck', 'n_scarf2', 'Khăn len xanh', 1500, { acc: 'scarf', color: '#2f8fe0' });
  add('neck', 'n_bow', 'Nơ bướm', 2000, { acc: 'bow', color: '#222' });
  add('neck', 'n_chain', 'Dây chuyền vàng', 4000, { acc: 'chain', color: '#ffc83a' });
  add('back', 'k_wings', 'Cánh thiên thần', 8000, { acc: 'wings', color: '#ffffff' });
  add('back', 'k_bat', 'Cánh dơi', 8000, { acc: 'batwings', color: '#3a1a55' });
  add('back', 'k_cape', 'Áo choàng', 5000, { acc: 'cape', color: '#c0182f' });
  add('back', 'k_jet', 'Jetpack', 6000, { acc: 'jetpack', color: '#8d96a8' });

  const BY_ID = {};
  ITEMS.forEach((it) => (BY_ID[it.id] = it));

  // Gói nạp xu (đồng = xu). Tối đa 10.000đ mỗi lần.
  const PACKS = [
    { id: 'p2', amount: 2000, bonus: 0, label: 'Gói Nhỏ' },
    { id: 'p5', amount: 5000, bonus: 0, label: 'Gói Vừa' },
    { id: 'p10', amount: 10000, bonus: 0, label: 'Gói Lớn' },
  ];
  const PACK_BY_ID = {};
  PACKS.forEach((p) => (PACK_BY_ID[p.id] = p));

  /** Làm sạch bộ đồ đang mặc: chỉ giữ ô hợp lệ + món đúng ô. */
  function cleanEquip(eq) {
    const out = {};
    if (!eq || typeof eq !== 'object') return out;
    for (const s of SLOT_IDS) {
      const it = BY_ID[eq[s]];
      if (it && it.slot === s) out[s] = it.id;
    }
    return out;
  }

  return { SLOTS, SLOT_IDS, ITEMS, BY_ID, PACKS, PACK_BY_ID, cleanEquip };
});
