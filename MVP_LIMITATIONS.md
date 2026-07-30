# Giới hạn MVP hiện tại

MVP này ưu tiên quan sát được thị trấn, NPC, lời thoại và thông tin nhân vật với ít sửa code nhất.

## Đã có

- Quan sát 3D bằng camera tự do.
- Click NPC để chọn, follow camera, mở card thông tin.
- Card NPC có bio, hành động hiện tại, personality, needs và log gần đây nếu đã có dữ liệu.
- NPC có hội thoại casual không dùng LLM.
- Personality/needs ảnh hưởng nhẹ tới xác suất NPC bắt chuyện.
- Event log toàn cục hiển thị sự kiện thị trấn, thời gian và hội thoại.
- Log riêng NPC dựa trên `ActivityJournal` hiện trong card NPC.
- Pause và tốc độ thời gian `1x`, `5x`, `20x`.
- Soul Mode mặc định tắt để tránh gọi AI ngoài ý muốn.

## Còn giới hạn

- Personality/needs mới ảnh hưởng nhẹ tới hội thoại, chưa điều khiển toàn bộ lịch sinh hoạt.
- Event log toàn cục chưa ghi mọi micro-state của daily behavior; log riêng NPC vẫn là nguồn chi tiết hơn.
- Relationship sâu, memory dài hạn, gia đình, kinh tế và vòng đời chưa làm trong MVP.
- Một số nhánh sâu của Soul Mode/LLM vẫn có prompt hoặc fallback gốc; MVP hiện tránh dùng các nhánh đó.
- UI đã đủ dùng để quan sát, chưa phải bản polish cuối cho màn hình rất nhỏ.

## Hướng mở rộng sau MVP

- Cho needs thay đổi theo thời gian và ảnh hưởng tới chọn địa điểm.
- Cho personality ảnh hưởng rõ hơn tới loại câu thoại.
- Thêm relationship score và memory có cấu trúc.
- Mở rộng event log thành timeline có filter theo NPC.
- Thêm save/load đầy đủ cho toàn bộ simulation state nếu cần chơi dài.
