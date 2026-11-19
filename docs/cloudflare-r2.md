# Chuyển ảnh và video sang Cloudflare R2

Website vẫn chạy trên `savethedates.vercel.app`. Trình duyệt upload trực tiếp lên R2 bằng URL có thời hạn do API quản trị cấp. Khi xem, `/api/media` chuyển hướng trình duyệt sang URL tải từ R2. Bucket có thể để riêng tư và dùng domain Vercel hiện tại. Người xem album có thể tải các tệp được liên kết từ album như trước.

## Kết nối R2

1. Trong [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2/overview), tạo bucket **Standard**, ví dụ `save-the-dates`, với jurisdiction mặc định.
2. Tạo [R2 API token](https://developers.cloudflare.com/r2/api/tokens/) có quyền **Object Read & Write** giới hạn trong bucket đó. Ghi lại Account ID, Access Key ID và Secret Access Key.
3. Trong **Settings → CORS Policy** của bucket, thêm cấu hình bên dưới. Nếu website có domain khác hoặc cần thử trên Vercel Preview, thêm origin tương ứng, gồm cả `https://` và không có dấu `/` cuối.

```json
[
  {
    "AllowedOrigins": ["https://savethedates.vercel.app", "https://savethe-dates.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

4. Thêm `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` vào **Vercel → Project Settings → Environment Variables → Production**. Điền giá trị vào `.env.local` nếu sẽ chạy script chuyển ảnh từ máy này. Giữ `ADMIN_PASSWORD`, cấu hình Redis và `BLOB_READ_WRITE_TOKEN` hiện có cho chức năng quản trị và các phần còn dùng Blob.
5. Deploy bản code mới lên project Vercel hiện có. Trong **Quản trị**, upload thử ảnh hoặc video, tải lại trang và xác nhận tệp xuất hiện trong R2. Cả bốn biến R2 để trống sẽ dùng Vercel Blob cho lượt upload mới. Các đường dẫn R2 đã lưu cần cấu hình R2 để tiếp tục hoạt động.

Tài liệu Cloudflare về [CORS](https://developers.cloudflare.com/r2/buckets/cors/) và [URL ký sẵn](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## Chuyển các tệp cũ

Sau khi xác nhận upload và xem tệp R2 trên website, điền `BLOB_READ_WRITE_TOKEN` của project vào `.env.local` cùng bốn biến R2. Nếu project đã lưu dữ liệu album trong Upstash Redis, dùng cấu hình Redis của môi trường Production, gồm cả `REDIS_KEY_PREFIX` nếu đã đặt.

Chạy từ thư mục dự án bằng Node.js 24.

```powershell
npm ci
node scripts/migrate-media-to-r2.mjs --dry-run
node scripts/migrate-media-to-r2.mjs --apply
```

Script sao lưu JSON vào `.preview/`, sao chép hai ảnh đại diện và ảnh/video mốc kỷ niệm từ Vercel Blob, kiểm tra từng bản sao, rồi cập nhật toàn bộ đường dẫn bằng kho dữ liệu album hiện tại. Tạm dừng chỉnh sửa hoặc mở khóa lại album trong khi chạy lệnh. Nếu tải lỗi hoặc script phát hiện dữ liệu đã thay đổi, có thể chạy lại. Ảnh và video gốc vẫn ở Vercel Blob.
