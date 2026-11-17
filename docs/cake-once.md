# Bánh kem mở một lần chung cho tất cả máy

- Khi vào trang, client gọi `/api/cake` đúng một lần để nhận lượt tự mở.
- Dấu `celebration/cake-once-v2.json` trên Blob được tạo với `allowOverwrite:false`.
  Chỉ máy tạo được dấu mới tự mở bánh kem; tất cả các máy khác không tự mở nữa.
- Nút **Xem lại bánh kem & kỷ niệm** trên trang và nút trong panel luôn mở lại.
- **Reset bánh kem** yêu cầu mật khẩu, được kiểm tra trên server bằng biến môi
  trường `CAKE_RESET_PASSWORD`. Reset xóa dấu bằng ETag. Lần vào tiếp theo, chỉ
  một máy nhận lượt tự mở mới. Mật khẩu không nằm trong mã JavaScript trình duyệt.
- Phim có nút xem lại từ đầu, không còn yêu cầu online hay khóa theo Redis.
- Client không gửi heartbeat, beacon hoặc reset lên `/api/presence`. Endpoint cũ
  trả 410 mà không truy cập Blob/Redis, để các tab còn cache code cũ không tiêu
  quota lưu trữ trạng thái.
- Không cần cấu hình Redis cho bánh kem/phim. Kiểm tra dấu chỉ dùng `head()`
  (Simple Operation); tạo dấu dùng một `put()` cho mỗi lượt, không ghi liên tục.
  Nút xem lại không ghi lượt mới. Upload ảnh/video và lưu thông tin vẫn có quota.

Nếu Blob còn khóa, API không giả vờ nhận lượt cục bộ. Nút xem lại vẫn dùng được;
reset và lượt tự mở sẽ dùng được khi Blob cho phép ghi/xóa trở lại.

## Dữ liệu và ảnh cũ

`/api/data` đọc trực tiếp URL JSON gốc đã xác định, tránh `list()` mỗi lần vào
trang. Chỉ tìm lại đường dẫn nếu file đã đổi do thao tác lưu thật sự. Khi kho bị
chặn (403), chỉ trả bản sao lưu thiếu có cảnh báo, không ghi đè lên dữ liệu gốc.
Khi kho mở lại, tải lại trang sẽ đọc JSON gốc và URL ảnh/video gốc. Không thay
bằng ảnh đoán từ iPhone. Xem ảnh/video vẫn dùng các quota đọc/truyền khác.

`.vercelignore` loại `sao_luu/`, `.preview/` và các file môi trường khỏi deploy.
