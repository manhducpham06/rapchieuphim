# Rạp Chiếu Phim Cộng Đồng

Game 3D nhiều người chơi: cùng xem YouTube trong rạp, chat, đá bóng, chơi gắp thú / đập chuột chũi.

## Chạy trên máy
```
node server.js        # mở http://localhost:3000
npm test              # kiểm thử server (smoke + rooms)
```
Không cần `npm install` (server không dùng thư viện ngoài). Trình duyệt cần Internet để tải Three.js, YouTube.

## Phòng & giá vé
| Phòng | Giá | Ghi chú |
|---|---|---|
| Rạp Tiêu Chuẩn | miễn phí | |
| Rạp Bạc | 5.000đ | vé 30 ngày |
| Rạp Vàng | 8.000đ | vé 30 ngày |
| Rạp Kim Cương | 10.000đ | vé 30 ngày |
| Khu Giải Trí | miễn phí | sân bóng, gắp thú, chuột chũi |

Giá nằm ở `public/layout.js` (mảng `ROOMS`). Tài khoản nhận tiền: biến môi trường `BANK_BIN`, `BANK_NAME`, `BANK_ACCOUNT`, `BANK_HOLDER` (mặc định Vietcombank 1054794616 – PHAM DUC MANH; số này hiển thị công khai cho người mua).

## Thanh toán
Người chơi bấm mua → hệ thống tạo mã nội dung chuyển khoản `RAP[S|G|V]xxxxx` + QR VietQR. Vé là chuỗi ký tự ký HMAC, lưu trong trình duyệt, không cần cơ sở dữ liệu.
Xác nhận tiền về có 2 cách:
1. **Thủ công**: mở `/admin.html`, nhập `ADMIN_KEY`, đối chiếu app ngân hàng rồi bấm “Xác nhận”.
2. **Tự động**: dùng SePay/Casso, đặt webhook tới `https://<tên-miền>/api/webhook` kèm header `Authorization: Apikey <PAYMENT_WEBHOOK_KEY>`.

## Biến môi trường (Render → Environment)
- `SECRET` (**bắt buộc đặt cố định**, chuỗi dài ngẫu nhiên; đổi thì mọi vé cũ mất hiệu lực)
- `ADMIN_KEY` (mật khẩu trang quản trị)
- `PAYMENT_WEBHOOK_KEY` (tuỳ chọn, bật tự xác nhận)
- `PASS_DAYS` (mặc định 30; 0 = vé vĩnh viễn)
- `BANK_*` như trên (tuỳ chọn)

Lưu ý Render gói free: ổ đĩa tạm, đơn chờ có thể mất khi server khởi động lại; vé của người đã trả tiền vẫn hợp lệ nhờ `SECRET` cố định.

## Điều khiển
PC: WASD/mũi tên, Shift chạy, chuột kéo xoay, E ngồi/chơi/qua cửa, Space đứng dậy, 1–7 biểu cảm, Enter chat.
Điện thoại: cần gạt bên trái, nút Ngồi/Chơi/Vào bên phải, kéo màn hình để xoay, thanh công cụ dọc bên phải.
