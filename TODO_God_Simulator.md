# TODO - God Simulator 3D trên nền Agentshire

## Trạng thái hiện tại

- [x] Xác định lại mục tiêu: ưu tiên quan sát, có thông tin NPC, tính cách, lời thoại và sửa ít code nhất.
- [x] Cập nhật plan kỹ thuật theo hướng MVP gọn.
- [x] Sửa file plan sang UTF-8 để tiếng Việt hiển thị đúng.
- [x] Xác định yêu cầu ngôn ngữ: game/UI/lời thoại/log phải dùng tiếng Việt.
- [x] Đưa source Agentshire vào workspace.
- [x] Chạy Agentshire nguyên bản thành công ở mức build + HTTP dev server.
- [x] Kiểm tra visual runtime trong browser: scene 3D, NPC, camera và UI gốc.

## Giai đoạn 1 - Bootstrap Agentshire

- [x] Clone hoặc copy source Agentshire vào `E:\God_Simulator`.
- [x] Kiểm tra license của Agentshire.
- [x] Cài Node.js/npm local nếu máy chưa có.
- [x] Cài Chromium local trong workspace để tránh extension/IDM của browser chính.
- [x] Tạo script `Open_Agentshire_Browser.ps1` để mở Agentshire bằng browser độc lập.
- [x] Tạo `Start_Game.bat` / `Start_Game.ps1` để tự bật Gateway rồi mở game.
- [x] Tạo `Stop_Game.bat` / `Stop_Game.ps1` để tắt browser local và Gateway.
- [x] Cài dependencies.
- [x] Build frontend.
- [x] Chạy dev server.
- [x] Xác nhận trang chính phản hồi HTTP.
- [x] Xác nhận scene 3D, NPC, camera và UI gốc hoạt động bằng browser.

## Giai đoạn 2 - Trinh sát source

- [x] Tìm entry point chính của app.
- [x] Tìm module render/Three.js.
- [x] Tìm module NPC/agent.
- [x] Tìm module camera/control.
- [x] Tìm hệ thống dialogue bubble hiện có.
- [x] Tìm UI framework đang dùng.
- [x] Tìm game loop/update tick.
- [x] Tìm data NPC hoặc nơi khởi tạo NPC.
- [x] Tìm toàn bộ hệ thống i18n/ngôn ngữ hiện có.
- [x] Xác định nơi còn hard-code tiếng Trung/tiếng Anh trong UI.
- [x] Viết integration map: cần sửa file nào, hook vào đâu, dùng lại được gì.

## Giai đoạn 2.5 - Việt hóa nền tảng

- [x] Thêm locale `vi` vào hệ thống i18n.
- [x] Đặt tiếng Việt làm ngôn ngữ mặc định.
- [x] Việt hóa các text UI chính: menu, nút, loading, settings, NPC card, HUD.
- [x] Việt hóa dialogue template hoặc tạo bộ lời thoại tiếng Việt riêng.
- [x] Việt hóa tên trạng thái/hành động NPC cơ bản.
- [x] Thêm dữ liệu thị trấn/NPC mặc định tiếng Việt.
- [x] Đảm bảo script mở game dùng tiếng Việt mặc định.
- [x] Việt hóa lớp chính của `editor.html` và `citizen-editor.html`: tên nhân vật mặc định, panel chỉnh nhân vật, model picker, asset palette, binding, upload và preview.
- [ ] Việt hóa toàn bộ event log/journal sâu nếu bật các nhánh AI/Soul Mode sau này.

## Giai đoạn 3 - Observer Mode MVP

- [x] Click chọn NPC.
- [x] Lưu NPC đang được chọn vào state.
- [x] Hiển thị highlight hoặc trạng thái selected nếu dễ làm.
- [x] Theo dõi NPC được chọn nếu camera hiện có hỗ trợ.
- [x] Thêm pause/1x/5x/20x nếu có thể hook vào time/update loop.
- [x] Trả lại điều khiển nhân vật người chơi: click đất để đi tới, WASD/phím mũi tên để di chuyển trực tiếp.

## Giai đoạn 4 - NPC Profile + Info Panel

- [x] Tạo dữ liệu profile cơ bản cho NPC.
- [x] Thêm tính cách: friendliness, confidence, humor, patience, ambition.
- [x] Thêm needs đơn giản: hunger, energy, social, happiness.
- [x] Hiển thị info panel khi click NPC.
- [x] Hiển thị hành động hiện tại của NPC.
- [x] Hiển thị sự kiện/hội thoại gần đây của NPC.

## Giai đoạn 5 - Dialogue Template MVP

- [x] Phát hiện khi hai NPC ở gần nhau.
- [x] Thêm cooldown hội thoại để NPC không nói liên tục.
- [x] Tính xác suất bắt chuyện dựa trên personality và social need.
- [x] Tạo bộ câu thoại template.
- [x] Chọn câu thoại theo personality/needs/tình huống.
- [x] Đồng bộ cuộc gặp: NPC dừng lại, quay mặt vào nhau, câu đầu hiện ngay, hội thoại có 3 lượt và summary.
- [x] Ghi quan hệ/ký ức sau hội thoại để lần sau có thể nhắc lại chủ đề cũ.
- [x] Hiển thị lời thoại bằng dialogue bubble có sẵn nếu dùng được.
- [x] Ghi hội thoại vào event log.
- [x] Cho hội thoại casual ưu tiên gọi LLM qua Gateway khi có API key, fallback về template nếu AI lỗi.

## Giai đoạn 6 - Event Log

- [x] Tạo event log dạng dữ liệu có cấu trúc.
- [x] Ghi sự kiện NPC đổi hành động.
- [x] Ghi sự kiện NPC gặp nhau.
- [x] Ghi hội thoại.
- [x] Ghi hội thoại của người chơi vào Nhật ký thị trấn: nói với ai, nói gì, NPC trả lời gì.
- [x] Nhắn citizen vẫn có phản hồi local bằng LLM/fallback nếu citizen chưa bật agent riêng.
- [x] Hiển thị log toàn cục.
- [x] Hiển thị log riêng cho NPC được chọn.

## Giai đoạn 7 - Polish MVP

- [x] Cân bằng tần suất hội thoại.
- [x] Chỉnh UI cho dễ quan sát.
- [x] Kiểm tra hiệu năng với nhiều NPC.
- [x] Thêm save/load đơn giản nếu cần giữ trạng thái.
- [x] Ghi lại các giới hạn còn tồn tại trước khi mở rộng.

## Để sau MVP

- [ ] Relationship sâu.
- [ ] Memory có cấu trúc.
- [ ] LLM cho hội thoại đặc biệt.
- [ ] Dating/marriage/children/death.
- [ ] Economy/family tree/nghề nghiệp.
- [ ] Thay asset hoặc bối cảnh.

## Tích hợp LLM local/OpenAI-compatible

- [x] Thêm file `LLM_Env.ps1` để cấu hình endpoint/model LLM.
- [x] Cho gateway đọc `AGENTSHIRE_LLM_BASE_URL`, `AGENTSHIRE_LLM_MODEL`, `AGENTSHIRE_LLM_API_FORMAT`, `AGENTSHIRE_LLM_API_KEY`.
- [x] Tự nạp `LLM_Env.ps1` khi chạy `Start_Game.ps1`.
- [x] Test endpoint LLM chung qua `LLM_Env.ps1`.
- [x] Gắn hàm implicit chat vào game scene để NPC có thể dùng chung đường gọi LLM.
- [x] In lỗi LLM rõ ở gateway/browser thay vì âm thầm fallback rỗng.
- [x] Điền API key thật vào `LLM_Env.ps1` và test Qwen chung thành công.
- [x] Cấu hình OpenClaw/steward sang Qwen chung, tránh lỗi Anthropic `401`.
- [x] Sửa lỗi chat lâu rồi trả `terminated`: thêm timeout backend, ưu tiên chat người chơi và dùng body tối giản cho Qwen chung.

## Mở rộng xã hội đời thường

- [x] Chuẩn hóa xe tư nhân: mỗi xe có đúng một chủ kiêm người lái, kiểu dáng cố định và chỗ đỗ sát đúng nhà; mỗi xe chỉ chạy một chuyến hợp lý trong khung giờ riêng mỗi ngày, khi quay về chủ xuống ở cửa còn xe về đúng vị trí đỗ.
- [x] Thêm xe riêng cho người chơi: bấm E để lên/xuống, WASD để lái, camera và vị trí nhân vật đồng bộ theo xe.
- [x] Cho người chơi rủ cư dân lên xe hoặc xin lên xe cư dân; quyết định đồng ý/từ chối dựa trên khoảng cách, quan hệ, tin tưởng và tính cách, hành khách được gắn vào đúng xe.
- [x] Siết tính liên tục xã hội: bỏ câu gặp lại/hẹn hò/tin đồn cố định không có căn cứ, chỉ nhắc dữ kiện có trong ký ức và chỉ tạo lịch hẹn khi cả hai bên đồng ý rõ ràng.
- [x] Giữ NPC đứng lại và quay mặt khi đang phản ứng/hội thoại hoặc vừa gặp đúng lịch hẹn; chỉ tiếp tục lịch sinh hoạt sau khi cuộc nói chuyện kết thúc.

- [x] Cho chat steward dùng trực tiếp Qwen chung thay vì embedded agent không tương thích.
- [x] Cho mọi cư dân trong chat tab đều nhắn được, kể cả chưa bật sub-agent riêng.
- [x] Thêm fallback Qwen chung cho cư dân chưa có agent riêng, có ký ức ngắn theo phiên.
- [x] Reply fallback của cư dân được đẩy về chat tab và bubble trong cảnh 3D.
- [x] Thêm cú pháp nhắn nhanh trong cảnh 3D: `@citizen_1 nội dung` hoặc `@Tên: nội dung`.
- [x] Làm prompt hội thoại NPC-NPC đời thường hơn: làm quen, tán tỉnh nhẹ, ghen, tin đồn, tâm sự gia đình, rủ đi chơi.
- [x] Giảm spam NPC-NPC: tắt bubble chào mẫu qua đường, tăng cooldown hội thoại và chỉ ghi log tổng kết khi cuộc trò chuyện kết thúc.
- [x] Nới prompt xã hội người lớn: nhân vật có thể nói thẳng về ham muốn, rủ rê thân mật, ngoại tình, ghen tuông và hậu quả; vẫn bắt buộc trưởng thành, đồng thuận, không ép buộc, không vị thành niên, cảnh đồ họa/chi tiết hành vi dùng ẩn ý/cắt cảnh.
- [x] Lưu chat dài hạn dạng JSONL ở gateway cho steward/citizen fallback.
- [x] Lưu event log thị trấn dài hạn trong browser archive và khôi phục các dòng gần nhất khi mở lại game.
- [x] Làm sổ quan hệ sâu bản MVP: sentiment, familiarity, trust, romance, tension, jealousy, status/label bền vững trong snapshot.
- [x] Làm social feed/inbox bản MVP trong game: Feed, Quan hệ, Hội thoại; xem lại drama NPC-NPC/người chơi từ TownJournal và ActivityJournal.
- [ ] Nâng social feed sau MVP: lọc theo nhân vật/cặp quan hệ, tìm kiếm, xuất file, gom thread theo scandal/chuyện tình.
