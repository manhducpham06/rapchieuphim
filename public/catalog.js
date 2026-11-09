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

  // Các ô trang bị trên nhân vật: nhân vật đặc biệt + phụ kiện 3D gắn lên xương
  const SLOTS = [
    { id: 'skin', name: 'Nhân vật', icon: 'users' },
    { id: 'face', name: 'Kính', icon: 'glasses' },
    { id: 'head', name: 'Đầu', icon: 'crown' },
    { id: 'neck', name: 'Cổ', icon: 'scarf' },
    { id: 'back', name: 'Lưng', icon: 'wings' },
  ];
  const SLOT_IDS = SLOTS.map((s) => s.id);

  const ITEMS = [];
  const add = (slot, id, name, price, extra) => ITEMS.push({ id, slot, name, price, ...extra });

  // ---- Nhân vật đặc biệt (thay cho nhân vật mặc định đang chọn) ----
  add('skin', 'sk_worker', 'Thợ xây', 1500, { char: 'worker', img: 'worker' });
  add('skin', 'sk_soldier', 'Chiến binh', 3000, { char: 'soldier', img: 'soldier' });
  add('skin', 'sk_raider', 'Cướp biển', 3000, { char: 'raider', img: 'raider' });
  add('skin', 'sk_knight', 'Hiệp sĩ', 5000, { char: 'knight', img: 'knight' });
  add('skin', 'sk_robot', 'Rô-bốt', 6000, { char: 'robot', img: 'robot' });
  add('skin', 'sk_alien', 'Người ngoài hành tinh', 7000, { char: 'alien', img: 'alien' });
  add('skin', 'sk_zombie', 'Zombie', 8000, { char: 'zombie', img: 'zombie' });

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
  add('neck', 'n_scarf', 'Khăn len đỏ', 1000, { acc: 'scarf', color: '#d92d2d' });
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
