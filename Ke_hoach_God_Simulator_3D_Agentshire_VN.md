# Kế hoạch kỹ thuật - God Simulator 3D trên nền Agentshire

## 1. Mục tiêu

Xây dựng một game mô phỏng xã hội 3D kiểu "God Observation Simulator", trong đó người chơi đóng vai người quan sát toàn năng.

Mục tiêu quan trọng nhất:

- Quan sát được NPC trong thế giới 3D.
- Click NPC để xem thông tin, tính cách, trạng thái và lịch sử gần đây.
- Xem NPC giao tiếp bằng bong bóng lời thoại.
- Xem log sự kiện và hội thoại.
- Có thể tua nhanh/chậm thời gian.
- Game, UI, lời thoại và log sự kiện dùng tiếng Việt.
- Sửa ít code nhất có thể trên nền Agentshire.

Người chơi không điều khiển trực tiếp NPC. Trọng tâm ban đầu là tạo cảm giác thế giới đang tự vận hành, không phải xây lại toàn bộ simulator từ đầu.

---

## 2. Dự án nền

### Chọn: Agentshire

Lý do:

Agentshire đã có sẵn nhiều phần khó và tốn công:

- Renderer Three.js
- Scene 3D
- Nhân vật
- Camera
- Navigation
- Animation
- Chu kỳ ngày/đêm
- Thời tiết
- Bong bóng hội thoại
- UI cơ bản
- Chạy trên Web bằng TypeScript

Vì mục tiêu là sửa ít code nhất, cần tận dụng tối đa các hệ thống có sẵn này.

---

## 3. Nguyên tắc phạm vi

Khung cảnh nào cũng được, miễn là quan sát được mọi thứ.

Không ưu tiên thay đổi:

- Thành phố
- Nhà cửa
- Đường phố
- Trang phục
- Phong cách đồ họa
- Asset nhân vật
- Animation
- Weather/day-night nếu đang hoạt động ổn

Không viết lại engine 3D, không đổi bối cảnh lớn, không làm asset mới trong giai đoạn đầu.

---

## 4. Giữ nguyên nhiều nhất có thể

Các module nên giữ nguyên hoặc chỉ bọc thêm logic mỏng:

- Renderer
- Three.js setup
- Scene loading
- Character rendering
- Animation
- Navigation
- Camera hiện có
- Weather
- Day/Night
- Dialogue Bubble
- UI cơ bản

Chỉ sửa khi thật sự cần để phục vụ Observer Mode, NPC info panel, dialogue và event log.

---

## 5. Loại bỏ hoặc ẩn bớt

Loại bỏ/ẩn các gameplay hiện tại liên quan đến công ty phần mềm nếu chúng cản trở mục tiêu mô phỏng xã hội.

Ví dụ:

- Coding task
- Review code
- Office workflow quá đặc thù
- Nhiệm vụ kiểu lập trình viên
- UI nhiệm vụ không cần thiết

Ưu tiên ẩn bằng cấu hình hoặc bỏ entry point trước. Chỉ xóa sâu khi đã hiểu rõ dependency.

---

## 6. MVP cần có

### 6.0 Ngôn ngữ tiếng Việt

Game phải ưu tiên tiếng Việt ngay từ MVP.

Các phần cần dùng tiếng Việt:

- Menu
- Nút bấm
- Loading
- Settings
- HUD thời gian/thời tiết
- NPC info panel
- Tên trạng thái/hành động NPC
- Bong bóng lời thoại
- Event log
- Dialogue template

Agentshire hiện có hệ thống i18n, nhưng mặc định đang dùng tiếng Trung và có thêm tiếng Anh. Hướng sửa ít code nhất là thêm locale `vi`, đặt `vi` làm mặc định, rồi Việt hóa dần các nhóm text quan trọng trước.

Không nên sửa text rải rác nếu text đó đã đi qua i18n. Chỉ sửa hard-code khi bắt buộc.

---

### 6.1 Observer / God Mode

Người chơi có thể:

- Quan sát thế giới 3D.
- Click chọn NPC.
- Theo dõi NPC được chọn.
- Mở bảng thông tin NPC.
- Tua thời gian: pause, 1x, 5x, 20x.

Nếu camera hiện tại đã đủ dùng thì chỉ bổ sung điều khiển quan sát tối thiểu, chưa cần viết camera mới hoàn toàn.

---

### 6.2 NPC Profile System

Mỗi NPC cần có hồ sơ cơ bản:

- ID
- Tên
- Tuổi
- Giới tính
- Nghề nghiệp/vai trò
- Tính cách
- Trạng thái hiện tại
- Hành động hiện tại

Ví dụ dữ liệu:

```ts
{
  id: "npc_001",
  name: "Minh",
  age: 28,
  gender: "male",
  job: "Nhân viên văn phòng",
  personality: {
    friendliness: 70,
    confidence: 45,
    humor: 60,
    patience: 50,
    ambition: 75
  },
  needs: {
    hunger: 30,
    energy: 80,
    social: 55,
    happiness: 60
  },
  currentAction: "Đang đi làm"
}
```

Ban đầu có thể lưu profile trong file JSON/TypeScript đơn giản. Chưa cần database.

---

### 6.3 Personality System

Tính cách không cần phức tạp ở MVP. Chỉ cần vài chỉ số ảnh hưởng tới xác suất hành vi và kiểu lời thoại.

Các chỉ số đề xuất:

- Friendliness: dễ bắt chuyện hay không
- Confidence: chủ động hay rụt rè
- Humor: hay nói vui hay nghiêm túc
- Patience: dễ cáu hay bình tĩnh
- Ambition: hay nói về công việc/mục tiêu

Tính cách dùng để:

- Quyết định NPC có bắt chuyện không.
- Chọn nhóm câu thoại phù hợp.
- Hiển thị trong bảng thông tin NPC.
- Tạo cảm giác mỗi NPC khác nhau dù logic còn đơn giản.

---

### 6.4 Needs System đơn giản

Mỗi NPC có một số nhu cầu cơ bản:

- Hunger
- Energy
- Social
- Happiness

Need thay đổi theo thời gian và có thể ảnh hưởng đến lời thoại/hành động.

Ví dụ:

- Hunger cao/thấp khiến NPC nói về việc ăn uống.
- Energy thấp khiến NPC than mệt.
- Social thấp khiến NPC dễ bắt chuyện hơn.

Ở MVP, needs chưa cần điều khiển toàn bộ đời sống NPC. Chỉ cần đủ để tạo trạng thái quan sát và ngữ cảnh hội thoại.

---

### 6.5 Dialogue System bằng template

NPC cần có lời thoại giao tiếp ngay từ MVP.

Cách làm ít code nhất:

- Khi hai NPC ở gần nhau, có xác suất bắt chuyện.
- Xác suất dựa trên friendliness, confidence, social need và cooldown.
- Chọn câu thoại từ template dựa trên tính cách, need và tình huống.
- Hiển thị bằng hệ thống bong bóng hội thoại có sẵn của Agentshire nếu có thể.
- Lưu hội thoại vào event log.

Ví dụ:

```text
Minh: Chào Lan, hôm nay bạn thế nào?
Lan: Cũng ổn. Tôi đang định đi ăn chút gì đó.
```

Ví dụ theo tính cách:

```text
NPC thân thiện: Chào nhé, hôm nay trông bạn vui đấy.
NPC ít kiên nhẫn: Tôi đang bận, nói nhanh nhé.
NPC hài hước: Nếu còn họp nữa chắc tôi cần thêm ba ly cà phê.
```

Không dùng LLM trong MVP để tránh tăng chi phí, độ trễ và độ phức tạp.

---

### 6.6 Event Log / History

Cần có log để người chơi quan sát được mọi thứ đã xảy ra.

Log nên ghi:

- NPC bắt đầu hành động
- NPC đổi trạng thái quan trọng
- NPC gặp NPC khác
- Hội thoại giữa NPC
- Need quá thấp/cao nếu đáng chú ý

Ví dụ:

```text
08:10 - Minh đi làm.
08:25 - Minh gặp Lan.
08:26 - Minh nói: "Chào Lan, hôm nay bạn thế nào?"
08:26 - Lan nói: "Cũng ổn. Tôi đang định đi ăn chút gì đó."
```

Event log là tính năng quan trọng vì mục tiêu của game là quan sát.

---

### 6.7 NPC Info Panel

Khi click NPC, hiển thị:

- Tên
- Tuổi
- Nghề nghiệp
- Tính cách
- Needs
- Hành động hiện tại
- Hội thoại gần đây
- Sự kiện gần đây

Panel này quan trọng hơn các hệ thống mô phỏng phức tạp, vì nó giúp người chơi hiểu thế giới đang vận hành ra sao.

---

## 7. Các hệ thống để sau MVP

Các hệ thống sau chưa nên làm ngay nếu mục tiêu là sửa ít code nhất:

- LLM conversation
- Memory phức tạp
- Relationship sâu
- Dating
- Marriage
- Children
- Death
- Economy đầy đủ
- Family tree
- Nghề nghiệp phức tạp
- Thay asset/bối cảnh

Có thể thêm sau khi MVP quan sát + lời thoại đã vui và ổn định.

---

## 8. LLM sau MVP

LLM chỉ nên thêm sau khi hệ thống template chạy ổn.

Khi thêm LLM, chỉ dùng cho các tình huống đặc biệt:

- Tỏ tình
- Cãi nhau
- Cầu hôn
- Xin lỗi
- Quyết định quan trọng
- Hội thoại dài hoặc hiếm

Không dùng LLM cho mọi cuộc trò chuyện thường ngày.

Cần có:

- Cooldown gọi API
- Giới hạn số hội thoại LLM cùng lúc
- Fallback sang template nếu API lỗi
- Giới hạn token
- Tóm tắt context ngắn từ profile, personality, needs và event gần đây

---

## 9. Thứ tự phát triển đề xuất

### Giai đoạn 1: Bootstrap

- Clone/chạy Agentshire thành công.
- Kiểm tra license.
- Đọc cấu trúc source.
- Xác định module render, NPC, camera, dialogue bubble, UI.

### Giai đoạn 2: Dọn gameplay không cần thiết

- Ẩn hoặc tắt gameplay công ty phần mềm nếu cản trở.
- Giữ nguyên renderer, scene, NPC, navigation, animation.
- Tránh xóa sâu khi chưa cần.

### Giai đoạn 2.5: Việt hóa nền tảng

- Thêm locale `vi` vào i18n.
- Đặt tiếng Việt làm mặc định.
- Việt hóa UI chính.
- Việt hóa lời thoại template.
- Việt hóa event log và trạng thái NPC.
- Đảm bảo script mở game dùng tiếng Việt.

### Giai đoạn 3: Observer Mode

- Click chọn NPC.
- Theo dõi NPC được chọn.
- Thêm hoặc chỉnh camera quan sát nếu cần.
- Thêm điều khiển pause/1x/5x/20x.

### Giai đoạn 4: NPC Profile + Info Panel

- Tạo profile cho NPC.
- Thêm personality.
- Thêm needs đơn giản.
- Hiển thị thông tin khi click NPC.

### Giai đoạn 5: Template Dialogue

- Phát hiện NPC ở gần nhau.
- Thêm xác suất bắt chuyện.
- Chọn câu thoại theo personality/needs.
- Hiển thị bằng bubble có sẵn.
- Thêm cooldown để tránh nói liên tục.

### Giai đoạn 6: Event Log

- Ghi sự kiện và hội thoại.
- Hiển thị log toàn cục.
- Hiển thị log riêng của NPC được chọn.

### Giai đoạn 7: Polish MVP

- Chỉnh UI cho dễ xem.
- Cân bằng tần suất hội thoại.
- Tối ưu nếu nhiều NPC.
- Save/load đơn giản nếu cần giữ trạng thái.

### Giai đoạn 8: Mở rộng sau MVP

- Relationship
- Memory có cấu trúc
- LLM cho sự kiện đặc biệt
- Dating/marriage/children/death
- Economy/family tree/nghề nghiệp

---

## 10. Kiến trúc tối thiểu

Nên thêm ít module mới, tránh đụng sâu vào engine.

Các module đề xuất:

```text
simulation/TimeManager.ts
simulation/NpcProfile.ts
simulation/NpcNeeds.ts
simulation/Personality.ts
simulation/DialogueTemplates.ts
simulation/DialogueManager.ts
simulation/EventLog.ts
ui/NpcInfoPanel.tsx
ui/EventLogPanel.tsx
```

Tên file thực tế sẽ điều chỉnh theo cấu trúc Agentshire sau khi đọc source.

Nguyên tắc:

- Không để simulation phụ thuộc trực tiếp vào FPS.
- Dùng game time từ TimeManager.
- Dialogue có cooldown.
- Event log là dữ liệu có cấu trúc, không chỉ là text.
- Tận dụng bubble/UI có sẵn trước khi viết mới.

---

## 11. Tiêu chí MVP hoàn thành

MVP được xem là ổn khi:

- Mở game thấy scene 3D và NPC.
- Người chơi quan sát được bằng camera.
- Click NPC thấy profile, personality, needs, action hiện tại.
- NPC thỉnh thoảng nói chuyện với nhau.
- Lời thoại hiện bằng bubble trên đầu NPC.
- Hội thoại và sự kiện xuất hiện trong event log.
- Có pause và tua thời gian cơ bản.
- Không cần thay asset hoặc viết lại renderer.

---

## 12. Đánh giá khối lượng

Với mục tiêu mới, khối lượng nên thấp hơn plan ban đầu nhiều.

Giữ lại khoảng 80-90% phần nền Agentshire:

- Renderer
- Scene
- Camera
- Navigation
- Animation
- Weather
- Day/Night
- Character rendering
- Dialogue bubble nếu dùng được

Viết mới hoặc chỉnh nhẹ khoảng 10-20%:

- NPC profile
- Personality
- Needs đơn giản
- Dialogue template
- Event log
- NPC info panel
- Time controls

Đây là hướng phù hợp nhất nếu ưu tiên là có bản chơi được nhanh, quan sát được mọi thứ, có NPC nói chuyện và sửa ít code nhất.
