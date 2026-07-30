# Integration Map - God Simulator MVP trên nền Agentshire

Mục tiêu của tài liệu này là chỉ ra các điểm móc vào source Agentshire để làm MVP với ít sửa code nhất.

## Kết luận nhanh

Agentshire đã có sẵn phần lớn nền MVP:

- Scene 3D, renderer, camera, weather, day/night.
- NPC manager, NPC state, movement, animation.
- Click NPC để mở card thông tin.
- Bubble lời thoại.
- Dialogue template NPC-NPC không dùng LLM.
- Daily behavior cho NPC.
- Activity journal, town journal, relationship nhẹ.
- i18n tiếng Trung/Anh, đã bổ sung tuyến tiếng Việt cho MVP.
- GameClock có pause/resume/setSpeed/setTime.

Vì vậy không nên viết lại engine hoặc simulation core ngay. Nên chỉnh theo hướng:

1. Tắt/ẩn gameplay công ty phần mềm nếu cản trở.
2. Chuyển tương tác từ "Mayor điều khiển trực tiếp" sang "Observer".
3. Mở rộng NPC card để có profile/personality/needs.
4. Tận dụng `CasualEncounter` và `ChatBubbleSystem` cho lời thoại MVP.
5. Dùng `TownJournal`/`ActivityJournal` hoặc thêm event log mỏng.

## Entry Point và vòng chạy

### `Agentshire/town-frontend/src/main.ts`

Vai trò:

- Gọi `initLocale()`.
- Tạo `Engine`.
- Tạo `MainScene`.
- Kết nối WebSocket với Gateway.
- Gọi `engine.loadScene(scene)`.
- Gọi `engine.start()`.

Điểm cần nhớ:

- URL có thể truyền `lang=vi` hoặc `lang=en`.
- URL có thể truyền `mock=true` để dùng `MockDataSource`.
- Hiện script `Open_Agentshire_Browser.ps1` đang mở `lang=vi`.

### `Agentshire/town-frontend/src/engine/Engine.ts`

Vai trò:

- Tạo Three.js renderer/camera.
- Quản lý render loop bằng `requestAnimationFrame`.
- Gọi `currentScene.update(deltaTime)` mỗi frame.
- Có `start()`, `stop()`, `pause()`, `play()`.

Không nên sửa nhiều ở đây.

### `Agentshire/town-frontend/src/game/MainScene.ts`

Vai trò:

- Scene chính của game.
- Khởi tạo town/office/museum.
- Khởi tạo camera, weather, time HUD, NPC, bubble, daily behavior.
- Nhận input tap/drag/pinch.
- Gọi update cho camera, clock, weather, NPC, behavior, encounter, bubble.

Điểm hook chính:

- `init()` để thêm module MVP nếu cần.
- `handleTap()` để đổi logic click/observer.
- `handleNPCTap()` để mở rộng NPC info panel.
- `handleGroundTap()` hiện đang điều khiển Mayor đi lại, cần tắt hoặc đổi thành camera focus trong God Mode.
- `update(deltaTime)` là nơi có thể gọi simulation nhẹ nếu cần.

## NPC

### `Agentshire/town-frontend/src/npc/NPC.ts`

Đã có:

- `id`, `name`, `label`, `role`, `state`, `npcState`.
- `mesh`, `characterKey`, animation.
- `moveTo()`, `stopMoving()`, `playAnim()`.
- `getPosition()`, `lookAtTarget()`, `smoothLookAt()`.
- Label trên đầu NPC.

Không nên nhét profile/personality trực tiếp vào class này ở MVP. Nên để dữ liệu riêng và map theo `npc.id`.

### `Agentshire/town-frontend/src/npc/NPCManager.ts`

Đã có:

- `createNPCs()`
- `get(id)`
- `getAll()`
- `getWorkers()`
- `findNearestNPC(worldPos, maxDist)`
- `update()`

Đây là API tốt để query NPC từ module mới.

## Click NPC và Info Panel

### Hiện trạng

Trong `MainScene.handleTap()`:

- Raycast từ màn hình xuống mặt phẳng ground.
- Dùng `npcManager.findNearestNPC(worldPos, tapRadius)`.
- Nếu có NPC thì gọi `handleNPCTap(npc)`.

Trong `MainScene.handleNPCTap()`:

- Lấy config/avatar.
- Lấy profile từ `getNpcProfiles()`.
- Lấy work log từ `DialogManager`.
- Gọi `ui.showNPCCard(...)`.

### Panel hiện có

`Agentshire/town-frontend/src/ui/NpcCardPanel.ts`

Đã hiển thị:

- Avatar.
- Name.
- Specialty.
- State.
- Persona/bio.
- Work logs.
- Chat button.

Hướng MVP:

- Mở rộng `NpcCardPanel.show()` để nhận thêm `personality`, `needs`, `recentEvents`.
- Hoặc thêm một panel mới nhưng vẫn đi qua `UIManager`.
- Ít code nhất là mở rộng card hiện có.

## Camera / Observer Mode

### `Agentshire/town-frontend/src/game/visual/CameraController.ts`

Đã có:

- Drag để pan camera.
- Wheel/pinch để zoom.
- `follow(target)`.
- `moveTo(target)`.
- `animateTo(target)`.
- Clamp bounds.

Hiện tại:

- Click đất gọi `handleGroundTap()` làm Mayor đi tới điểm click.
- Double tap follow steward.

Hướng MVP:

- Không cần camera mới.
- Tắt điều khiển Mayor trực tiếp trong God Mode.
- Click đất có thể chỉ `cameraCtrl.moveTo({ x, z })`.
- Click NPC vẫn mở card, có thể thêm nút follow hoặc tự focus camera.

## Lời thoại

### Bubble

`Agentshire/town-frontend/src/ui/ChatBubble.ts`

Đã có:

- Bubble theo mesh NPC.
- Typewriter.
- Pagination.
- Auto fade.
- `show(target, text, duration)`.
- `streamUpdate()`, `endStream()`.

Nên dùng lại nguyên.

### Dialogue template không dùng LLM

`Agentshire/town-frontend/src/npc/CasualEncounter.ts`

Đã có:

- NPC đi ngang vẫy chào.
- NPC đứng gần nhau nói chuyện.
- Cooldown global/pair.
- Pause/resume daily behavior khi nói chuyện.
- Gọi bubble callback.
- Không dùng API.

`Agentshire/town-frontend/src/npc/DialogueScripts.ts`

Đã có:

- Script tiếng Trung mặc định.
- Khi `getLocale() === 'vi'`, dùng `i18n/dialogue-vi.ts`; khi `en`, dùng `i18n/dialogue-en.ts`.

Hướng MVP:

- Trước mắt dùng `lang=vi`.
- `dialogue-vi.ts` đã được thêm cho lời thoại casual MVP.
- Có thể thêm personality vào chọn template sau, nhưng chưa cần ở bước đầu.

### Dialogue sâu / LLM

`Agentshire/town-frontend/src/npc/EncounterManager.ts`

Đã có:

- Dialogue nhiều lượt.
- Fallback câu ngắn.
- Journal/relationship update.
- Có thể dùng `dialogueProvider` qua `DailyScheduler`.

Rủi ro:

- `DailyScheduler` mặc định `soulMode` đang true.
- Khi có implicit chat function, AgentBrain/EncounterManager có thể gọi LLM.

Khuyến nghị:

- MVP nên tắt Soul Mode mặc định hoặc đảm bảo chỉ dùng `CasualEncounter`.
- LLM để sau.

## Daily Behavior / Simulation

### `Agentshire/town-frontend/src/game/DailyScheduler.ts`

Đã có:

- Tạo `DailyBehavior` cho NPC.
- Tạo `ActivityJournal`.
- Tạo `AgentBrain` nếu đủ điều kiện.
- Start/stop daily behavior.
- Nearby NPC query.
- Trigger encounter sâu khi AgentBrain quyết định talk.

### `Agentshire/town-frontend/src/npc/DailyBehavior.ts`

Cần đọc kỹ hơn ở giai đoạn triển khai, nhưng hiện đã là nơi điều khiển roaming/routine.

Hướng MVP:

- Tận dụng daily behavior hiện có.
- Chưa viết Needs System lớn.
- Nếu cần needs/personality, thêm data sidecar và hiển thị trước, chưa bắt nó điều khiển behavior ngay.

## Time

### `Agentshire/town-frontend/src/game/GameClock.ts`

Đã có:

- `pause()`
- `resume()`
- `setSpeed(dayDurationMs)`
- `setTime(hour)`
- `advanceTime(hours)`
- period change callbacks
- localStorage persistence

### `Agentshire/town-frontend/src/ui/TimeHUD.ts`

Đã có:

- Hiện thời gian.
- Hiện period.
- Hiện weather.

Hướng MVP:

- Không tạo `TimeManager` mới.
- Thêm UI điều khiển pause/1x/5x/20x gọi thẳng `GameClock`.
- Có debug binding trong `MainScene.installDebugBindings`, nhưng người chơi cần UI thật.

## Data NPC

### `Agentshire/town-frontend/src/data/TownConfig.ts`

Đã có:

- `TownConfig`, `CitizenConfig`, `NPCProfile`.
- `createDefaultTownConfig()`.
- `getNpcProfiles()`.
- Locale-aware default data.

### `Agentshire/town-frontend/src/data/town-defaults.en.json`

Đã có data tiếng Anh cho:

- town name
- steward
- user/mayor
- citizens
- specialty
- bio

Hướng MVP:

- Thêm personality/needs bằng file mới, ví dụ `data/god-sim-npc-profiles.ts`.
- Không sửa mạnh `TownConfig` ngay nếu chưa cần.
- Map theo `npcId`.

## Event Log / Journal

Đã có các phần liên quan:

- `Agentshire/town-frontend/src/npc/TownJournal.ts`
- `Agentshire/town-frontend/src/npc/ActivityJournal.ts`
- `GameProtocol` có `town_journal_entry`, `npc_activity`, `npc_activity_restore`.
- `NpcCardPanel` hiển thị work/activity logs.

Hướng MVP:

- Trước mắt tận dụng `ActivityJournal` cho log riêng NPC.
- Nếu cần log toàn cục dễ xem, thêm panel mới nhưng feed từ `TownJournal` hoặc event mỏng.

## i18n

### `Agentshire/town-frontend/src/i18n/index.ts`

Hiện có:

- `zh-CN`
- `en`
- `vi`
- default là `vi`
- URL `?lang=vi` sẽ chọn tiếng Việt.

### `Agentshire/town-frontend/src/ui/SettingsPanel.ts`

Hiện có lựa chọn:

- `vi`
- `zh-CN`
- `en`

Hướng tạm thời:

- Dùng `lang=vi` trong script mở game.

Đã làm ở giai đoạn 2.5:

- Thêm `vi.ts`.
- Thêm `vi` vào `locales`.
- Thêm option tiếng Việt trong `SettingsPanel`.
- Thêm `town-defaults.vi.json`.
- Thêm `dialogue-vi.ts`.
- Nâng version config lên 5 để dữ liệu mặc định cũ được tạo lại theo tiếng Việt.

## Các điểm cần đổi cho đúng mục tiêu God Mode

Ưu tiên ít code:

1. `MainScene.handleGroundTap()`
   - Hiện điều khiển Mayor đi.
   - Đổi thành camera move hoặc no-op trong God Mode.

2. `MainScene.handleNPCTap()`
   - Mở rộng data gửi vào `ui.showNPCCard`.
   - Thêm personality/needs/recent events.

3. `NpcCardPanel.show()`
   - Thêm layout cho personality/needs.

4. `SettingsPanel` hoặc init setting
   - Tắt Soul Mode mặc định để tránh LLM trong MVP.

5. `DialogueScripts`
   - Đã thêm tiếng Việt cho casual dialogue MVP.

6. `TimeHUD` hoặc UI mới
   - Thêm pause/speed controls.

## Rủi ro / lưu ý

- Không sửa `Engine.ts` nếu không bắt buộc.
- Không viết lại `NPC` class cho profile/personality; dùng sidecar data trước.
- Không bật LLM mặc định ở MVP.
- Không xóa sâu workflow công ty phần mềm ngay; ưu tiên ẩn hoặc bỏ trigger.
- Có nhiều text hard-code tiếng Trung trong code, nhưng phần chính đã đi qua i18n. Giai đoạn 2.5 đã Việt hóa UI chính/default data/casual dialogue; event log/journal sâu để xử lý theo lớp sau.
- Browser tab là nơi chạy 3D/simulation frontend. Gateway chỉ là server/plugin.

## Thứ tự triển khai đề xuất sau trinh sát

1. Tắt Mayor direct control: click đất không còn điều khiển NPC.
2. Mở rộng NPC card với personality/needs mock data.
3. Thêm event log đơn giản nếu journal hiện có chưa đủ nhìn.
4. Thêm UI pause/speed.
5. Tắt Soul Mode mặc định.
6. Việt hóa sau khi MVP observer chạy ổn, hoặc làm `vi` locale nếu muốn ưu tiên ngôn ngữ trước.
