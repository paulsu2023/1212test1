
export enum AspectRatio {
  Ratio_9_16 = '9:16',
  Ratio_16_9 = '16:9',
  Ratio_1_1 = '1:1',
  Ratio_4_3 = '4:3',
  Ratio_3_4 = '3:4',
}

export enum ImageResolution {
  Res_1K = '1K',
  Res_2K = '2K',
  Res_4K = '4K',
}

export enum VideoMode {
  Standard = 'standard',      // Prompt -> Image
  StartEnd = 'start_end',     // Start + End Images
  Intermediate = 'intermediate' // Start + Mid + End Images
}

export interface ProductData {
  images: string[]; // Base64 strings
  title: string;
  description: string;
  creativeIdeas: string;
  modelImages: string[]; // New: Custom model reference
  backgroundImages: string[]; // New: Custom background reference
  referenceVideo?: {
    data: string;
    mimeType: string;
  } | null; // New: Reference Video
}

export interface AnalysisResult {
  productType: string;
  sellingPoints: string;
  targetAudience: string;
  hook: string;
  painPoints: string;
  strategy: string;
  assignedVoice: string; // Ensure consistency
  scenes: SceneDraft[];
}

export interface SceneDraft {
  id: string;
  visual: string; // 画面内容
  action: string; // 动作
  camera: string; // 运镜
  dialogue: string; // 对白 (English)
  dialogue_cn: string; // 对白 (中文)
  prompt: {
    imagePrompt: string;
  };
  promptVersion?: 'v1' | 'v2'; // New: Track prompt format version
}

export interface GeneratedAsset {
  type: 'image' | 'audio';
  url: string; // Blob URL or Data URL
  mimeType: string;
  data?: string; // Base64 for re-use
}

export interface StoryboardScene extends SceneDraft {
  startImage?: GeneratedAsset;
  endImage?: GeneratedAsset;
  middleImage?: GeneratedAsset; // For Intermediate mode
  audio?: GeneratedAsset;
  
  // General states
  isGeneratingImage: boolean; // Deprecated but kept for type compat if needed
  isGeneratingAudio: boolean;
  error?: string;

  // Granular generation states
  isGeneratingStart?: boolean;
  isGeneratingMiddle?: boolean;
  isGeneratingEnd?: boolean;
  
  isUpdatingPrompt?: boolean; // New: Loader for prompt regeneration
}

export interface AppState {
  product: ProductData;
  settings: {
    aspectRatio: AspectRatio;
    imageResolution: ImageResolution;
    videoMode: VideoMode;
    sceneCount: number;
  };
  analysis: AnalysisResult | null;
  storyboard: StoryboardScene[];
  isAnalyzing: boolean;
  isGeneratingScene: boolean; // Global loader state for scene gen
  activeStep: number; // 0: Input, 1: Analysis/Storyboard
}
