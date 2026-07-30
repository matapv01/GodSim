import type { TimePeriod, WeatherType } from '../types'

export type DialogueLine = [string, string]

export const GENERAL_SCRIPTS: DialogueLine[] = [
  ['Hôm nay ổn không?', 'Ổn, đang đi dạo chút.'],
  ['Lâu rồi mới gặp.', 'Ừ, dạo này bận quá.'],
  ['Cậu đang đi đâu vậy?', 'Ra quảng trường một lát.'],
  ['Trời hôm nay dễ chịu.', 'Ừ, đi bộ rất hợp.'],
  ['Ăn gì chưa?', 'Chưa, lát ghé quán cà phê.'],
  ['Tôi hơi mệt rồi.', 'Ngồi nghỉ một chút đi.'],
  ['Thị trấn yên bình thật.', 'Ừ, nhìn thôi cũng thấy nhẹ.'],
  ['Cậu có nghe tiếng chim không?', 'Có, nghe rất thư thái.'],
  ['Hôm nay nhiều việc không?', 'Vừa đủ để không chán.'],
  ['Gặp cậu vui ghê.', 'Tôi cũng vậy.'],
  ['Đi cùng một đoạn không?', 'Được, cũng đang rảnh.'],
  ['Quảng trường đông hơn rồi.', 'Có lẽ ai cũng muốn ra ngoài.'],
  ['Tôi thích góc này.', 'Nó có cảm giác rất bình yên.'],
  ['Có chuyện gì mới không?', 'Chỉ là một ngày bình thường.'],
  ['Ngày bình thường cũng tốt.', 'Ừ, miễn là dễ chịu.'],
  ['Cậu trông vui hơn đấy.', 'Chắc do ngủ đủ.'],
  ['Tối qua ngủ ngon không?', 'Khá ngon, cảm ơn.'],
  ['Tôi đang thèm cà phê.', 'Đi thôi, tôi cũng vậy.'],
  ['Ở đây giống nhà thật.', 'Ừ, càng ở càng thấy vậy.'],
  ['Cứ chậm rãi cũng hay.', 'Không cần vội làm gì.'],
  ['Cậu thích buổi nào nhất?', 'Hoàng hôn, ánh sáng đẹp.'],
  ['Tôi vừa nghĩ ra một chuyện.', 'Kể nghe xem.'],
  ['Có lúc chỉ muốn ngồi yên.', 'Yên lặng cũng là nghỉ ngơi.'],
  ['Cậu thấy hôm nay thế nào?', 'Nhẹ nhàng, vừa đủ tốt.'],
]

export const WEATHER_SCRIPTS: Partial<Record<WeatherType, DialogueLine[]>> = {
  clear: [
    ['Nắng đẹp quá.', 'Ừ, rất hợp để đi dạo.'],
    ['Ánh sáng hôm nay đẹp thật.', 'Nhìn thị trấn sáng hẳn lên.'],
  ],
  cloudy: [
    ['Trời nhiều mây nhỉ.', 'Mát hơn mọi hôm.'],
    ['Không nắng cũng dễ chịu.', 'Ừ, đi bộ đỡ mệt.'],
  ],
  drizzle: [
    ['Mưa nhỏ thôi.', 'Nghe tiếng mưa cũng thích.'],
    ['Cẩn thận trơn nhé.', 'Ừ, tôi đi chậm thôi.'],
  ],
  rain: [
    ['Mưa rồi.', 'Tìm chỗ trú một chút đi.'],
    ['Mùi mưa dễ chịu thật.', 'Ừ, không khí sạch hơn.'],
  ],
  heavyRain: [
    ['Mưa lớn quá.', 'Nên vào trong thôi.'],
  ],
  storm: [
    ['Sấm nghe gần quá.', 'Đứng trong nhà an toàn hơn.'],
  ],
  lightSnow: [
    ['Tuyết nhẹ kìa.', 'Nhìn rất yên bình.'],
  ],
  snow: [
    ['Tuyết phủ đẹp thật.', 'Thị trấn như chậm lại.'],
  ],
  blizzard: [
    ['Gió tuyết mạnh quá.', 'Đừng đi xa lúc này.'],
  ],
  fog: [
    ['Sương mù dày ghê.', 'Nhìn gần thôi cũng đủ.'],
  ],
  sandstorm: [
    ['Bụi nhiều quá.', 'Che mặt lại đi.'],
  ],
  aurora: [
    ['Nhìn trời kìa.', 'Đẹp như phép màu vậy.'],
  ],
}

export const PERIOD_SCRIPTS: Partial<Record<TimePeriod, DialogueLine[]>> = {
  dawn: [
    ['Dậy sớm vậy?', 'Muốn ngắm bình minh.'],
    ['Sáng sớm yên thật.', 'Ngày mới bắt đầu rồi.'],
  ],
  morning: [
    ['Chào buổi sáng.', 'Chúc một ngày tốt lành.'],
    ['Sáng nay có năng lượng ghê.', 'Ngủ đủ khác hẳn.'],
  ],
  noon: [
    ['Đến giờ ăn rồi.', 'Ừ, bụng tôi cũng réo.'],
    ['Trưa hơi buồn ngủ.', 'Nghỉ một lát đi.'],
  ],
  afternoon: [
    ['Chiều nay nhẹ nhàng nhỉ.', 'Ừ, cứ chậm rãi thôi.'],
    ['Cà phê chiều không?', 'Nghe hợp lý đấy.'],
  ],
  dusk: [
    ['Hoàng hôn đẹp thật.', 'Mỗi ngày một kiểu đẹp.'],
    ['Sắp tối rồi.', 'Đèn đường chắc sắp sáng.'],
  ],
  night: [
    ['Đêm yên tĩnh quá.', 'Ừ, rất dễ chịu.'],
    ['Ngủ ngon nhé.', 'Mai gặp lại.'],
  ],
}

export const WAVE_LINES = [
  'Chào nhé!', 'Ê, chào!', 'Gặp lại rồi.', 'Đi dạo à?',
  'Hôm nay ổn chứ?', 'Từ từ thôi nhé.', 'Ngày đẹp đấy!',
  'Lát gặp lại.', 'Khỏe không?', 'Trùng hợp ghê.',
]

export const WAVE_LINES_PERIOD: Partial<Record<TimePeriod, string[]>> = {
  dawn: ['Dậy sớm thế!', 'Chào bình minh!', 'Sáng yên thật.'],
  morning: ['Chào buổi sáng!', 'Ngày mới vui nhé!', 'Sáng tốt lành.'],
  noon: ['Ăn trưa chưa?', 'Nghỉ chút đi.', 'Trưa rồi đấy.'],
  afternoon: ['Chiều tốt lành!', 'Cà phê không?', 'Đỡ mệt chưa?'],
  dusk: ['Về nhà à?', 'Hoàng hôn đẹp nhỉ.', 'Sắp tối rồi.'],
  night: ['Ngủ ngon nhé.', 'Đêm yên bình.', 'Đi cẩn thận.'],
}
