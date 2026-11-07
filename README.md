# Phố Vui — thế giới ảo cộng đồng

Game 3D nhiều người chơi: Quảng Trường chung, Rạp Chiếu Phim (xem YouTube cùng nhau), Khu Giải Trí (đá bóng, gắp thú, đập chuột chũi), Shop Thời Trang (mua đồ bằng xu), chat chữ và chat giọng nói theo khoảng cách.

## Chạy trên máy
```
node server.js        # mở http://localhost:3000
npm test              # kiểm thử server (smoke + rooms + auth)
```
Không cần `npm install`. Trình duyệt cần Internet để tải Three.js và YouTube.

## Các khu
| Khu | Có gì |
|---|---|
| Quảng Trường (vào mặc định) | Đài phun nước, cổng đi 3 khu |
| Rạp Chiếu Phim | Một rạp duy nhất (101 ghế, màn hình lớn, miễn phí) |
| Khu Giải Trí | Sân bóng nhiều người, máy gắp thú, đập chuột chũi |
| Shop Thời Trang | Cửa hàng của ông chủ, quầy mua đồ, gương thử đồ |

## Xu, nạp xu, mua đồ
- 1.000đ = 1.000 xu. Gói nạp: 2.000đ / 5.000đ / 10.000đ (tối đa 10.000đ mỗi lần).
- Chỉ tài khoản đăng nhập mới có ví và mua được đồ. Khách chơi được nhưng không mua.
- Nạp xu: chọn gói → quét QR → xu tự vào ví khi tiền về. Xác nhận bằng webhook (SePay/Casso) hoặc chủ game bấm "Xác nhận" ở `/admin.html`.
- Xu và đồ do SERVER giữ (client không tự sửa được). Danh mục đồ: `public/catalog.js` (48 món: áo, quần, giày, màu mũ, kính, đồ đội đầu, đồ ở cổ, đồ ở lưng).
- Áo/quần/giày/mũ đổi màu và hoạ tiết trên chính mô hình Aj; phụ kiện là vật thể 3D gắn vào xương nhân vật.

## Ông chủ shop
Đăng nhập tài khoản của bạn, lấy UID ở Firebase → Authentication → Users. Điền UID vào biến `ADMIN_UIDS` (nhiều UID cách nhau dấu phẩy). Tài khoản đó có tên ★, mọi món miễn phí, và NPC ông chủ đứng ở quầy shop.

## Lưu trữ bền (quan trọng với Render miễn phí)
Ổ đĩa của Render gói miễn phí bị xoá mỗi lần server khởi động lại. Để ví, đồ và đơn nạp không mất:
1. Firebase Console → Project settings → Service accounts → Generate new private key (tải file JSON).
2. Render → Environment → thêm `FIREBASE_SERVICE_ACCOUNT` = toàn bộ nội dung file JSON (hoặc dạng base64).
3. Firestore Database phải được tạo. Server dùng collection `wallets` và `orders`; hãy giữ rules khoá các collection này với client.

Không có biến này, server tự lưu file tạm (chỉ phù hợp chạy thử).

## Biến môi trường (Render → Environment)
| Biến | Ý nghĩa |
|---|---|
| `SECRET`, `ADMIN_KEY` | Chuỗi bí mật dài ngẫu nhiên. `ADMIN_KEY` là mật khẩu vào /admin.html |
| `PAYMENT_WEBHOOK_KEY` | Khoá cho webhook ngân hàng (bỏ trống = chỉ xác nhận tay) |
| `ADMIN_UIDS` | UID tài khoản ông chủ |
| `FIREBASE_SERVICE_ACCOUNT` | Khoá dịch vụ Firebase để lưu bền |
| `BANK_BIN`, `BANK_NAME`, `BANK_ACCOUNT`, `BANK_HOLDER` | Tài khoản nhận tiền (mặc định Vietcombank của chủ game) |

## Tài khoản (Firebase)
Điền `public/firebase-config.json`:
```
{ "apiKey": "...", "authDomain": "...", "projectId": "...", "appId": "..." }
```
Quy tắc Firestore (client chỉ đụng hồ sơ của mình; `wallets`, `orders` không cho client vào, chỉ server dùng khoá dịch vụ):
```
rules_version = '2';
service cloud.firestore { match /databases/{db}/documents {
  match /users/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; }
} }
```
Server tự xác minh ID token Firebase.

## Voice chat
Nút Mic / Loa (phím M). Kết nối trực tiếp giữa các máy (WebRTC), nghe tối đa 6 người gần nhất trong 15 m. Không có máy chủ TURN nên một số mạng có thể không nghe được nhau.

## Nhân vật
`public/models/character.glb` (Aj + 8 cử chỉ). `public/models/outfit_mask.png` là mặt nạ vùng áo/quần/giày/mũ trên ảnh da, dùng để đổi màu đồ.

## Điều khiển
PC: WASD/mũi tên, Shift chạy, chuột kéo xoay, E ngồi/chơi/qua cửa/mua sắm, Space đứng dậy, 1–9 biểu cảm, Enter chat, M mic.
Điện thoại: cần gạt bên trái, nút hành động bên phải, kéo màn hình để xoay.
