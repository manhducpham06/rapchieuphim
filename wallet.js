'use strict';
/* Ví xu + đồ sở hữu + bộ đồ đang mặc. Mọi thay đổi đi qua đây, tuần tự theo từng tài khoản. */
const C = require('./public/catalog.js');

function createWallet(store, opts = {}) {
  const isAdmin = opts.isAdmin || (() => false);
  const chains = new Map();

  function serial(uid, fn) {
    const prev = chains.get(uid) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    chains.set(uid, next);
    next.catch(() => {}).then(() => { if (chains.get(uid) === next) chains.delete(uid); });
    return next;
  }

  async function load(uid) {
    const d = (await store.get('wallets', uid)) || {};
    return {
      coins: Math.max(0, Math.floor(Number(d.coins) || 0)),
      owned: Array.isArray(d.owned) ? d.owned.filter((id) => C.BY_ID[id]) : [],
      equip: C.cleanEquip(d.equip),
    };
  }
  const view = (uid, d) => {
    const admin = isAdmin(uid);
    return { coins: d.coins, owned: admin ? C.ITEMS.map((i) => i.id) : d.owned, equip: d.equip, admin };
  };

  return {
    get: (uid) => serial(uid, async () => view(uid, await load(uid))),
    credit: (uid, amount) => serial(uid, async () => {
      const d = await load(uid);
      d.coins += Math.floor(amount);
      await store.set('wallets', uid, d);
      return view(uid, d);
    }),
    buy: (uid, itemId) => serial(uid, async () => {
      const it = C.BY_ID[itemId];
      if (!it) return { ok: false, error: 'Món đồ không tồn tại.' };
      const d = await load(uid);
      if (isAdmin(uid) || d.owned.includes(it.id)) return { ok: false, error: 'Bạn đã có món này rồi.', w: view(uid, d) };
      if (d.coins < it.price) return { ok: false, error: `Không đủ xu (cần ${it.price}, bạn có ${d.coins}).`, w: view(uid, d), short: true };
      d.coins -= it.price;
      d.owned.push(it.id);
      await store.set('wallets', uid, d);
      return { ok: true, item: it.id, w: view(uid, d) };
    }),
    /** itemId = null để cởi món ở ô đó. */
    equip: (uid, slot, itemId) => serial(uid, async () => {
      if (!C.SLOT_IDS.includes(slot)) return { ok: false, error: 'Ô không hợp lệ.' };
      const d = await load(uid);
      if (itemId === null) delete d.equip[slot];
      else {
        const it = C.BY_ID[itemId];
        if (!it || it.slot !== slot) return { ok: false, error: 'Món này không đeo được ở đây.' };
        if (!isAdmin(uid) && !d.owned.includes(it.id)) return { ok: false, error: 'Bạn chưa mua món này.' };
        d.equip[slot] = it.id;
      }
      await store.set('wallets', uid, d);
      return { ok: true, w: view(uid, d) };
    }),
  };
}

module.exports = { createWallet };
