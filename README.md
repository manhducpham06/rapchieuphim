# 🎬 Rạp Chiếu Phim Cộng Đồng

Game online 3D chạy trên trình duyệt: mọi người cùng vào **một phòng chiếu chung**, tự chọn ghế, trò chuyện và **cùng xem video YouTube đồng bộ** bằng cách dán link.

## Chạy

Cần [Node.js](https://nodejs.org) 18 trở lên. **Không cần `npm install`** (server không dùng thư viện ngoài).

```bash
node server.js
```

Mở `http://localhost:3000`. Server in sẵn địa chỉ để bạn bè **cùng Wi-Fi** vào chơi.
Máy chơi cần có Internet vì đồ hoạ 3D (Three.js) và YouTube được tải từ CDN.

Đổi cổng: `PORT=8080 node server.js` (Windows PowerShell: `$env:PORT=8080; node server.js`).

### Mời bạn bè ngoài mạng
- Tạm thời: `cloudflared tunnel --url http://localhost:3000` hoặc `ngrok http 3000`, rồi gửi link nhận được.
- Lâu dài: đưa thư mục này lên bất kỳ dịch vụ chạy Node.js có hỗ trợ WebSocket (Render, Railway, Fly.io, VPS…). Lệnh khởi động là `node server.js`, server tự đọc biến `PORT`. Chạy phía sau HTTPS thì client tự dùng `wss://`.

## Cách chơi

| Thao tác | Phím / chuột |
|---|---|
| Đi bộ | `W` `A` `S` `D` hoặc mũi tên · `Shift` để chạy |
| Xoay camera / zoom | Giữ chuột kéo · lăn chuột (cảm ứng: kéo / chụm 2 ngón) |
| Tự đi tới điểm | Bấm lên sàn |
| Ngồi | Bấm vào ghế (viền xanh = trống, đỏ = có người) hoặc `E` ngồi ghế gần nhất |
| Đứng dậy | `Space` hoặc bấm phím di chuyển |
| Khi đang ngồi | Góc nhìn thứ nhất từ ghế, kéo chuột để nhìn quanh |
| Cảm xúc | `1`–`7` hoặc thanh biểu cảm: 👋 👏 ❤️ 😂 😮 🍿 👍 |
| Chat | `Enter` mở khung chat · `Esc` thoát |

**Chiếu phim:** dán link YouTube vào khung “Màn hình” (hỗ trợ `youtube.com/watch`, `youtu.be`, `shorts`, `embed`, `live`, có cả mốc thời gian `?t=1m30s`) → **Chiếu ngay**, hoặc **＋ Hàng chờ** để xếp video. Ai trong phòng cũng có thể phát / tạm dừng / tua / chuyển video, và ai vào sau sẽ thấy đúng thời điểm đang chiếu. Hết video, rạp tự chiếu video tiếp theo trong hàng chờ.

## Có gì trong rạp
- Rạp 3D có sân khấu, rèm nhung, màn hình lớn, **101 chỗ ngồi** (7 hàng bậc thang × 14 ghế + 3 ghế lười), đèn LED lối đi, đèn tường, trần đầy sao, máy chiếu, poster, biển neon.
- Khu sảnh phía sau: quầy bắp rang, máy bắp rang, bàn ghế đẩu, 2 máy arcade, cây cảnh.
- **Đèn tự giảm sáng khi phim bắt đầu**, ánh sáng từ màn hình hắt ra khán phòng.
- Tuỳ chỉnh nhân vật (áo, da, tóc, phụ kiện), nhãn tên, bong bóng chat trên đầu, hoạt ảnh đi / ngồi / cảm xúc.
- Danh sách người trong rạp, nhật ký chat, tự kết nối lại khi mất mạng.

## Cấu trúc
```
server.js          Server HTTP + WebSocket (tự cài, không phụ thuộc thư viện)
public/layout.js   Bố cục rạp dùng chung server/client (ghế, va chạm, bậc thang)
public/world.js    Dựng không gian 3D
public/avatar.js   Nhân vật, nhãn tên, bong bóng chat
public/main.js     Mạng, điều khiển, camera, YouTube, giao diện
test/smoke.js      Test server tự động:  npm test
```

## Tuỳ biến nhanh
- Số ghế / hàng ghế: `ROWS`, `BLOCKS` trong `public/layout.js` (server và client tự khớp).
- Giới hạn người chơi: biến môi trường `MAX_CLIENTS` (mặc định 200).
- Tên rạp, màu, poster: `public/world.js` (hàm `posters`, `neonTexture`).

## Lưu ý
- Mọi người trong phòng đều điều khiển được màn hình (phù hợp nhóm bạn bè). Muốn có "chủ phòng" thì chỉ cần giới hạn các lệnh `v_*` / `q_*` trong `server.js`.
- Video YouTube nào chủ sở hữu tắt chế độ nhúng sẽ không phát được; game sẽ báo lỗi.
- Trình duyệt có thể chặn tự phát tiếng; khi đó game tự tắt tiếng và nhắc bạn bấm 🔇 để bật.
