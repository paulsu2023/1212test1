
import { AspectRatio, VideoMode, ImageResolution } from './types';

// Using Gemini 3.0 Pro for high-level reasoning/analysis
export const GEMINI_MODEL_ANALYSIS = 'gemini-3-pro-preview';

// Using Gemini 3.0 Pro Image (Banana Pro equivalent) for high quality assets
export const GEMINI_MODEL_IMAGE = 'gemini-3-pro-image-preview'; 

// TTS Model
export const GEMINI_MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export const ASPECT_RATIOS = [
  { value: AspectRatio.Ratio_9_16, label: '9:16 (竖屏通用)' },
  { value: AspectRatio.Ratio_16_9, label: '16:9 (横屏通用)' },
  { value: AspectRatio.Ratio_1_1, label: '1:1 (正方形)' },
  { value: AspectRatio.Ratio_3_4, label: '3:4 (肖像)' },
  { value: AspectRatio.Ratio_4_3, label: '4:3 (传统)' },
];

export const IMAGE_RESOLUTIONS = [
  { value: ImageResolution.Res_1K, label: '1K (标准)' },
  { value: ImageResolution.Res_2K, label: '2K (高清 - 推荐)' },
  { value: ImageResolution.Res_4K, label: '4K (超清)' },
];

export const VIDEO_MODES = [
  { value: VideoMode.Standard, label: '首帧图 (仅生成首图)' },
  { value: VideoMode.StartEnd, label: '连贯模式 (首图+尾图)' },
  { value: VideoMode.Intermediate, label: '运镜控制模式 (首图+草稿+尾图)' },
];

export const VOICE_OPTIONS = ['Kore', 'Fenrir', 'Puck', 'Charon', 'Zephyr'];
