# NTDAds — AI Marketing Agent (Version 2.0)

> **Hệ điều hành Tiếp thị AI đa nền tảng Meta Ads & TikTok Ads.**  
> *"Bạn nói mục tiêu kinh doanh. NTDAds lo phần quảng cáo."*

---

## 🌟 Điểm nổi bật phiên bản 2.0

Ứng dụng được tái cấu trúc toàn diện từ **Dashboard quản lý quảng cáo thụ động** sang **AI Marketing Agent** chủ động, an toàn và thông minh:

- 🏠 **Hero AI Command Center:** Ra lệnh bằng ngôn ngữ tự nhiên (tiếng Việt) hoặc giọng nói (Voice Mic).
- ❓ **Intelligent Clarification:** AI hỏi lần lượt từng câu (Sản phẩm → Ngân sách → Thời gian) khi người dùng ra lệnh thiếu thông tin, tuyệt đối không tự bịa (Zero Hallucination).
- 🎯 **7-Phase Task Planner:** Tự động lập kế hoạch truyền thông 7 bước: *Phân tích, Chiến lược (Meta 60% / TikTok 40%), Ý tưởng Creative, Khởi tạo, Quét Policy, Launch, Giám sát CPA*.
- 🔐 **Approval Center Gate:** Bất kỳ hành động nào liên quan đến chi tiêu đều bắt buộc phải có sự xác nhận của người dùng.
- ⚡ **Activity Center & Stepper:** Theo dõi tiến trình khởi tạo chiến dịch đa nền tảng theo thời gian thực.
- ↩️ **Rollback & Undo 1-Click:** Mọi hành động can thiệp (tạo mới, điều chỉnh ngân sách, tắt quảng cáo) đều được lưu log và có thể hoàn tác ngay lập tức.
- 🛡️ **Autopilot 3 Tiers & Kill Switch:** 3 cấp độ tự hành (Copilot, Assisted Autopilot, Full Autopilot) kèm nút dừng khẩn cấp `🛑 STOP AUTOPILOT`.
- 🔗 **Frictionless OAuth Connect:** Kết nối Meta Ads và TikTok Ads chỉ với 1 click, không cần sao chép token thủ công.

---

## 🏗️ Cấu trúc Thư mục

```text
APP ADS/
├── index.html              # Giao diện chính (Simple Mode + Pro Mode Switcher)
├── PRD_ARCHITECTURE.md     # Tài liệu kiến trúc sản phẩm & đặc tả chi tiết 2.0
├── README.md               # Giới thiệu & Hướng dẫn sử dụng
└── js/
    ├── data-engine.js      # Unified Data Model, Mock Data 30 ngày & Engine hoàn tác
    ├── ai-engine.js        # NLP Parser, State Machine, Plan Generator & Autopilot
    ├── app.js              # Controller điều phối UI, Event Bridge & Modal
    └── export-engine.js    # Xuất báo cáo CSV & Báo cáo quản trị
```

---

## 🚀 Hướng dẫn Chạy ứng dụng

1. Mở trực tiếp file `index.html` bằng bất kỳ trình duyệt hiện đại nào (Chrome, Edge, Safari, Firefox).
2. Không cần cài đặt web server phức tạp.
3. Chuyển đổi linh hoạt giữa:
   - **🐣 Chế độ Tinh gọn (Simple Mode):** Dành cho chủ shop / người mới tiếp cận ads.
   - **⚡ Chế độ Chuyên sâu (Pro Mode):** Dành cho Media Buyer & Agency cần phân tích Pivot và Breakdown sâu.
