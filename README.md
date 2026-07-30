# God Simulator 3D - Hướng dẫn chạy local

Repo này đang dùng Agentshire làm nền cho MVP God Observation Simulator.

Mục tiêu hiện tại:

- Giữ nguyên Agentshire nhiều nhất có thể.
- Chạy được thị trấn 3D gốc.
- Mở bằng Chromium riêng trong thư mục dự án để tránh IDM hoặc extension trình duyệt bắt nhầm asset.
- Sau đó mới bắt đầu chỉnh dần theo `TODO_God_Simulator.md`.

## Cấu trúc hiện tại

```text
E:\God_Simulator
|-- Agentshire\                         Source Agentshire
|-- .tools\                             Node.js/OpenClaw tự tạo ở lần chạy đầu
|-- .browsers\                          Chromium local tùy chọn, không nằm trong Git
|-- .browser-profile\                   Profile browser riêng, tự tạo khi chạy
|-- Ke_hoach_God_Simulator_3D_Agentshire_VN.md
|-- TODO_God_Simulator.md
|-- Open_Agentshire_Browser.ps1
`-- README.md
```

## Cách chạy nhanh

Từ giờ có thể dùng 2 file này:

```text
Start_Game.bat - bật Gateway và mở game bằng Chromium local
Stop_Game.bat  - tắt Chromium local và Gateway
```

Cách dùng đơn giản:

1. Double-click `Start_Game.bat`.
2. Chơi game trong Chromium local vừa mở.
3. Khi chơi xong, double-click `Stop_Game.bat`.

`Start_Game.bat` sẽ tự đóng cửa sổ sau khi mở game thành công. Ở máy mới, lần chạy đầu cần Internet và có thể mất vài phút vì script sẽ tự:

- dùng Node.js đã cài nếu phiên bản phù hợp, nếu không thì tải Node.js portable;
- cài thư viện Agentshire và OpenClaw đúng phiên bản vào thư mục dự án;
- đăng ký plugin Agentshire vào OpenClaw;
- bật Gateway rồi mở game.

Các lần sau sẽ dùng cache trong `.tools` nên mở nhanh hơn. Không cần cài sẵn Node.js hay OpenClaw.

Nếu repo có Chromium local tại `.browsers`, game sẽ dùng bản đó. Nếu không có, script tự dùng Chrome hoặc Edge trên máy với profile riêng tại `.browser-profile` và tắt extension, nên không dùng profile/browser chính của bạn.

## Cách quan sát trong game

- Click NPC để chọn, mở thẻ thông tin và cho camera theo dõi NPC đó.
- Click xuống đất để nhân vật của bạn đi tới vị trí đó; camera sẽ theo nhân vật.
- Dùng `WASD` hoặc phím mũi tên để điều khiển nhân vật trực tiếp. Khi đang gõ trong ô chat, các phím này vẫn nhập chữ bình thường.
- Xe sedan của bạn đỗ cạnh `Nhà người chơi`. Đi sát xe và bấm `E` để lên; dùng `WASD` để lái và bấm `E` lần nữa để xuống.
- Muốn rủ cư dân lên xe, hãy lái xe tới gần họ rồi chat trực tiếp, ví dụ `Lên xe đi cùng tôi`. Họ sẽ đồng ý hoặc từ chối dựa trên quan hệ, tin tưởng và tính cách.
- Muốn lên xe của cư dân, đi sát xe và bấm `E`. Chủ xe phải ở gần và đủ tin tưởng bạn; nếu đồng ý, chính chủ xe sẽ lái tới điểm đến của họ.
- Góc trên bên phải có nút tạm dừng và tốc độ `1x`, `5x`, `20x`.
- Khung `Nhật ký thị trấn` ở góc phải ghi sự kiện và hội thoại gần đây; click tiêu đề để thu gọn/mở lại.
- Nút `Xã hội` ở góc phải mở social feed:
  - `Feed`: các sự kiện xã hội, tin nhắn và drama gần đây.
  - `Quan hệ`: mức thân, tin tưởng, tình cảm, ghen và căng thẳng giữa các nhân vật.
  - `Hội thoại`: transcript NPC-NPC đã được ghi trong thị trấn.
- Click NPC để xem thêm quan hệ đáng chú ý ngay trong thẻ nhân vật.

## Cấu hình LLM cho hội thoại NPC

Gateway tự nạp `LLM_Env.ps1` khi chạy `Start_Game.bat`. File chứa key thật không được đưa lên Git. Trên máy mới, sao chép `LLM_Env.example.ps1` thành `LLM_Env.ps1`, sau đó điền endpoint, model và key của máy đó.

## Deploy Public Đầy Đủ

Frontend chạy trên Vercel. Backend/gateway đầy đủ chạy tốt nhất bằng Docker trên Hugging Face Spaces hoặc server riêng.

Biến cần đặt cho backend HF Space, đặt trong Secrets/Variables của Space, không commit vào Git:

```text
AGENTSHIRE_LLM_BASE_URL
AGENTSHIRE_LLM_API_KEY
AGENTSHIRE_LLM_MODEL
AGENTSHIRE_LLM_API_FORMAT=openai
AGENTSHIRE_LLM_BODY_MODE=minimal
AGENTSHIRE_LLM_THINKING=false
```

Sau khi backend HF có URL, đặt biến build cho Vercel:

```text
VITE_AGENTSHIRE_WS_URL=wss://<ten-space>.hf.space/ws
```

Nếu Vercel chưa có `VITE_AGENTSHIRE_WS_URL`, bản public sẽ tự chạy demo/mock để người xem vẫn mở được game.

```text
http://your-llm-host:8080/v1/chat/completions
Qwen/Qwen3-32B-AWQ
```

Server hiện yêu cầu API key. Mở `LLM_Env.ps1` và điền:

```powershell
$env:AGENTSHIRE_LLM_API_KEY = "key-that-cua-ban"
```

Khi có key hợp lệ, hội thoại casual giữa NPC sẽ ưu tiên gọi AI để tạo câu riêng theo tên, tính cách, nhu cầu, ký ức gần đây, quan hệ, thời tiết và thời điểm trong ngày. AI chỉ được nhắc chuyện cũ, cuộc hẹn hoặc tình cảm đã có trong ký ức; nếu AI lỗi, bịa dữ kiện hoặc hết thời gian chờ, game dùng hội thoại fallback bám hoạt động thực tế.

Chat với quản gia/cư dân fallback được lưu dài hạn ở:

```text
C:\Users\<ten-user>\.openclaw\agentshire-longterm
```

## Reset toàn bộ log cũ

Trước khi reset, nên chạy `Stop_Game.bat` để tắt gateway và Chromium local.

Xóa log dài hạn của hội thoại/LLM và log runtime của gateway:

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.openclaw\agentshire-longterm" -ErrorAction SilentlyContinue
Remove-Item -Force "E:\God_Simulator\.runtime\*.log" -ErrorAction SilentlyContinue
Remove-Item -Force "$env:LOCALAPPDATA\Temp\openclaw\openclaw-*.log" -ErrorAction SilentlyContinue
```

Nếu muốn reset sạch cả nhật ký hiển thị trong game/social feed đang lưu trong Chromium local:

```powershell
Remove-Item -Recurse -Force "E:\God_Simulator\.browser-profile\Default\Local Storage\leveldb" -ErrorAction SilentlyContinue
```

Sau đó chạy lại `Start_Game.bat`. Game sẽ tự tạo lại các thư mục log cần thiết.

Nếu muốn chạy bằng PowerShell:

```powershell
PowerShell -ExecutionPolicy Bypass -File E:\God_Simulator\Start_Game.ps1
PowerShell -ExecutionPolicy Bypass -File E:\God_Simulator\Stop_Game.ps1
```

## Cách chạy thủ công

### 1. Chạy OpenClaw Gateway và Agentshire

Mở PowerShell tại thư mục Agentshire:

```powershell
cd E:\God_Simulator\Agentshire
```

Thêm Node portable vào `PATH` của cửa sổ PowerShell hiện tại:

```powershell
$env:PATH='E:\God_Simulator\.tools\node-v24.18.0-win-x64;' + $env:PATH
```

Chạy Gateway:

```powershell
npx openclaw@2026.3.13 gateway --allow-unconfigured
```

Khi chạy đúng, log sẽ có các dòng gần giống:

```text
[agentshire] WebSocket server listening on ws://localhost:55211
[agentshire] HTTP server listening on port 55210
Agentshire is live
```

Giữ cửa sổ PowerShell này mở trong lúc dùng game.

### 2. Mở Chromium local riêng

Mở một cửa sổ PowerShell khác, chạy:

```powershell
PowerShell -ExecutionPolicy Bypass -File E:\God_Simulator\Open_Agentshire_Browser.ps1
```

Script này sẽ mở Chromium local tại URL tiếng Việt:

```text
http://localhost:55210?ws=ws://localhost:55211&lang=vi
```

Các trang editor cũng nên mở kèm `lang=vi`:

```text
http://localhost:55210/editor.html?lang=vi
http://localhost:55210/citizen-editor.html?lang=vi
```

Chromium local nằm ở:

```text
E:\God_Simulator\.browsers\chromium-1234\chrome-win64\chrome.exe
```

Profile riêng của Chromium local nằm ở:

```text
E:\God_Simulator\.browser-profile
```

Browser này không dùng extension của trình duyệt chính, nên IDM thường sẽ không bắt nhầm link asset.

Hiện tại dùng `lang=vi`. Một số phần rất sâu của Agentshire có thể vẫn còn tiếng Anh/Trung, nhưng UI chính, profile mặc định và lời thoại casual đã có tuyến tiếng Việt.

## Nếu IDM vẫn bắt link tải

Tắt IDM tạm thời hoặc thêm loại trừ cho:

```text
localhost
127.0.0.1
```

Nếu cần, bỏ bắt các đuôi asset web/3D:

```text
GLB GLTF BIN WEBP MP4 WAV OGG
```

## Nếu port bị chiếm

Agentshire cần hai port:

```text
55210 - HTTP town frontend
55211 - WebSocket
```

Kiểm tra process đang dùng port:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 55210,55211 } | Select-Object LocalAddress,LocalPort,OwningProcess
```

Nếu đó là process Node cũ của dự án này, có thể tắt bằng:

```powershell
Stop-Process -Id <PID> -Force
```

Chỉ tắt process khi chắc chắn đó là server cũ của dự án này.

## Nếu thiếu Node/npm

`Start_Game.bat` tự tải Node portable vào thư mục sau nếu máy chưa có Node.js phù hợp:

```text
E:\God_Simulator\.tools\node-v24.18.0-win-x64
```

Trước khi chạy lệnh `npm` hoặc `npx`, thêm Node vào `PATH`:

```powershell
$env:PATH='E:\God_Simulator\.tools\node-v24.18.0-win-x64;' + $env:PATH
```

## Build frontend để kiểm tra

Nếu cần kiểm tra build:

```powershell
cd E:\God_Simulator\Agentshire\town-frontend
$env:PATH='E:\God_Simulator\.tools\node-v24.18.0-win-x64;' + $env:PATH
npm run build
```

## Tài liệu dự án

- Plan kỹ thuật: `Ke_hoach_God_Simulator_3D_Agentshire_VN.md`
- Checklist tiến độ: `TODO_God_Simulator.md`
- Bản đồ tích hợp source: `INTEGRATION_MAP.md`
- Source nền: `Agentshire\`

## Bước tiếp theo

Các phần MVP chính đã hoàn tất. Những việc còn lại nằm ở nhóm sau MVP trong `TODO_God_Simulator.md`, chủ yếu là nâng social feed: lọc theo nhân vật/cặp quan hệ, tìm kiếm, xuất file và gom thread theo scandal/chuyện tình.
