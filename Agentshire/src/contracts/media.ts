// @desc Multimodal content types: text, image, audio, video, file
//
// source 使用判别联合 (type: 'base64' | 'url' | 'stream'), 与传输层解耦
// 同一个 AudioContent 可以在 WS JSON (base64) 或 HTTP 上传 (url) 中使用
//
// 迁移注意:
//   - VideoContent / VideoStreamSource 已定义但尚无实现
//   - MediaPipeline TTS 输出已使用 AudioContent + InlineSource (base64)
//   - 旧的 ContentBlock (src/core/types.ts) 是 LLM 内部格式, 与本文件的
//     MediaContent 是不同抽象层: ContentBlock = LLM API, MediaContent = 传输契约

export type ContentKind = 'text' | 'image' | 'audio' | 'video' | 'file';

// ── Source discriminated union (transport-agnostic) ──

export type InlineSource = { type: 'base64'; data: string };
export type UrlSource = { type: 'url'; url: string };
export type StreamSource = { type: 'stream'; streamId: string };

// ── Content blocks ──

export interface TextContent {
  kind: 'text';
  text: string;
}

export interface ImageContent {
  kind: 'image';
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  source: InlineSource | UrlSource;
  width?: number;
  height?: number;
  alt?: string;
}

export interface AudioContent {
  kind: 'audio';
  format: 'mp3' | 'pcm' | 'wav' | 'webm' | 'opus';
  source: InlineSource | UrlSource | StreamSource;
  sampleRate?: number;
  channels?: number;
  durationMs?: number;
}

export type VideoStreamSource = {
  type: 'stream';
  streamId: string;
  protocol: 'webrtc' | 'hls' | 'ws-binary';
};

export interface VideoContent {
  kind: 'video';
  format: 'mp4' | 'webm';
  source: InlineSource | UrlSource | VideoStreamSource;
  mimeType?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbnail?: ImageContent;
}

export interface FileContent {
  kind: 'file';
  filename: string;
  mimeType: string;
  source: InlineSource | UrlSource;
  sizeBytes?: number;
}

export type MediaContent =
  | TextContent
  | ImageContent
  | AudioContent
  | VideoContent
  | FileContent;

export type MultimodalBody = MediaContent[];
