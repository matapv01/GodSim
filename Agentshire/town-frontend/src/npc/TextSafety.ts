const CJK_TEXT_RE = /[\u3400-\u9fff]/

const SEXUAL_OR_COERCIVE_RE =
  /(sex|sexual|làm tình|quan hệ|ngủ với|qua đêm|lên giường|giường|thân thể|cơ thể em|cơ thể cậu|ham muốn|dục vọng|khoái cảm|cởi đồ|hôn môi|ôm hôn|đụng chạm|mơn trớn|gợi tình|gợi dục|nóng bỏng|căn phòng ấy|vào phòng|về nhà em|về nhà anh|đóng cửa|khóa cửa|tắt.*đèn|hơi thở|nhịp tim)/i

export function containsCjkText(text: string): boolean {
  return CJK_TEXT_RE.test(text)
}

export function isUnsafeNpcText(text: string): boolean {
  return containsCjkText(text) || SEXUAL_OR_COERCIVE_RE.test(text)
}
