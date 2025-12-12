import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_ANALYSIS, GEMINI_MODEL_IMAGE, GEMINI_MODEL_TTS, VOICE_OPTIONS } from "../constants";
import { ProductData, AspectRatio, ImageResolution, SceneDraft } from "../types";

// Helper to ensure API Key exists or guide user to select it
const getClient = async (): Promise<GoogleGenAI> => {
  // @ts-ignore
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
       // @ts-ignore
       await window.aistudio.openSelectKey();
    }
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Retry Helper
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check for overloaded (503) or internal server error (500)
    const isOverloaded = error.message?.includes('overloaded') || error.status === 503 || error.code === 503;
    const isInternalError = error.status === 500 || error.code === 500;
    // Also retry on 429 (Too Many Requests) if accessible
    const isRateLimit = error.status === 429 || error.code === 429;
    
    if (retries > 0 && (isOverloaded || isInternalError || isRateLimit)) {
      console.warn(`Gemini API Error (${error.status || error.code || error.message}), retrying in ${delay}ms...`);
      await sleep(delay);
      return withRetry(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Helper: Convert Raw PCM to WAV
const pcmToWav = (base64PCM: string, sampleRate: number = 24000): string => {
  const binaryString = atob(base64PCM);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create WAV headers
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + len, true); // ChunkSize
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(view, 36, 'data');
  view.setUint32(40, len, true); // Subchunk2Size

  // Combine header and data
  const headerBytes = new Uint8Array(wavHeader);
  const wavBytes = new Uint8Array(headerBytes.length + bytes.length);
  wavBytes.set(headerBytes);
  wavBytes.set(bytes, headerBytes.length);

  // Convert to Base64
  let binary = '';
  // Process in chunks to avoid stack overflow
  const chunkSize = 8192;
  for (let i = 0; i < wavBytes.length; i += chunkSize) {
    const chunk = wavBytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// 1. Multi-Agent Product Analysis & Script Generation
export const analyzeProduct = async (
  product: ProductData, 
  sceneCount: number
): Promise<any> => {
  const client = await getClient();
  
  // Randomly select a voice for this session to ensure consistency
  const assignedVoice = VOICE_OPTIONS[Math.floor(Math.random() * VOICE_OPTIONS.length)];

  const systemInstruction = `
  你是一个由以下专家组成的顶级TikTok电商创意团队（面向美国市场）：
  1. **产品分析师**：负责识别产品规格、材质、用途。
  2. **营销大师**：负责挖掘痛点、设计强钩子（Hook）。
  3. **品牌专家**：确保内容符合品牌调性。
  4. **认知心理学家**：分析如何引起用户共情。
  5. **导演大师**：设计分镜、运镜、画面内容。
  6. **价值感知度专家**：运用**六维营销模型**（对象定位、场景匹配、兴趣偏好、年龄考量、情感表达、价值感知度）进行深度分析。
  
  你的目标是：根据用户提供的产品图片和信息（以及可选的参考视频），生成一份高转化率、强钩子的TikTok带货视频脚本。
  
  **核心语言要求（非常重要）**：
  1. **分析报告（Strategy, Hook, Target Audience, Selling Points, Pain Points）**：必须严格使用**中文**输出，不要使用英文。
  2. **画面/动作/运镜描述**：必须是**中文**，以便我们的中国拍摄团队理解。
  3. **对白 (Dialogue)**：必须提供两份：
     - **English**: 地道的英语，面向美国市场。
     - **Chinese**: 中文意译，供团队理解。
  
  **视觉一致性要求 (Visual Consistency Protocol - CRITICAL)**：
  你将收到三组图片：Product Images（产品）, Model Images（指定模特）, Background Images（指定背景）。
  1. **指定模特 (Reference Model)**：
     - 如果提供了Model Images，你必须分析该模特的种族、年龄、发色、发型、体型、衣着等特征。
     - 在生成的分镜 imagePrompt 中，**必须强制**使用这些特征来描述人物。
     - 例如："A young Asian woman, 25, with long straight black hair, wearing a white silk blouse (matching the reference model)..."
     - 确保所有分镜中的人物描述**完全一致**。
  2. **指定背景 (Reference Background)**：
     - 如果提供了Background Images，你必须分析其环境特征（卧室、客厅、户外等）。
     - 在生成的分镜 imagePrompt 中，**必须强制**使用该背景描述。
     - 例如："In a modern minimalist living room with beige sofa and sunlight (matching the reference background)..."
  3. **产品植入**：
     - 确保产品自然融入场景。

  **多模态视频分析能力 (Video Analysis)**：
  - 如果提供了 **Reference Video**，你必须逐帧分析该视频的：
    - **剪辑节奏 (Pacing)**：是快节奏踩点，还是慢节奏叙事？
    - **叙事结构 (Narrative Structure)**：开头 Hook 是什么？中间如何展示痛点？结尾 Call to Action 是什么？
    - **文案风格 (Copy Style)**：是幽默夸张，还是严肃种草？
  - **分镜数量自适应**：如果提供了参考视频，请**忽略**用户设定的默认分镜数量。你需要根据参考视频的时长和节奏，自动规划最合适的场景数量（例如视频长则分镜多，节奏快则分镜短）。
  - **模仿与创新**：生成的脚本应在结构和风格上模仿参考视频，但内容必须完全替换为当前产品。

  **导演大师运镜指南**：
  - **手机自拍 POV (Handheld Selfie POV)**：仿佛对着镜子录制，画面带有轻微晃动感。
  - **桌面俯拍 (Desktop Top-down)**：捕捉产品细节。
  - **手持跟拍 (Handheld Follow Shot)**：模拟朋友视角。
  
  **输出要求**：
  必须返回严格的JSON格式，不要包含Markdown代码块标记。
  Scenes数组中的每个分镜必须包含：
  - visual: 画面内容描述（中文）
  - action: 具体的动作/表演（中文）
  - camera: 智能设计的运镜方式（中文）
  - dialogue: 对白或画外音（英文 English）
  - dialogue_cn: 对白或画外音（中文意译 Chinese）
  - prompt: 包含一个字段的JSON对象
    - imagePrompt: 用于生成图片/视频的英文提示词。
      **Structure Rule**: 
      "[Camera Spec] + [CONSISTENT Character Description from Reference] + [Action] + [CONSISTENT Environment from Reference] + [Lighting] + [Speaking Context] + [Visual Quality Keywords]"
      
      *IMPORTANT*: Add "highly detailed, 8k, photorealistic, cinematic lighting" to prompts to ensure high quality.
      
      Must explicitly include: **"character saying: '\${dialogue}'"** to ensure lip-sync context.
      
      Example: "A handheld selfie POV shot of a [young woman, 25, blonde messy bun, wearing cream silk pajamas (matching ref model)] speaking excitedly to camera saying 'Stop paying!', holding the product, in a [luxury modern kitchen with marble island (matching ref background)], 8k, best quality."

  请确保脚本首尾呼应，开头3秒必须有强烈的视觉或语言钩子。
  `;

  // Prepare content parts (images + text + video)
  const parts: any[] = [];
  
  // 1. Product Images
  product.images.forEach(base64 => {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg', 
        data: base64
      }
    });
  });

  // 2. Model Images
  product.modelImages.forEach(base64 => {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg', 
        data: base64
      }
    });
  });

  // 3. Background Images
  product.backgroundImages.forEach(base64 => {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg', 
          data: base64
        }
      });
  });

  // 4. Reference Video
  if (product.referenceVideo) {
      parts.push({
          inlineData: {
              mimeType: product.referenceVideo.mimeType,
              data: product.referenceVideo.data
          }
      });
  }

  let promptText = `
  Input Data:
  - First ${product.images.length} images: PRODUCT IMAGES.
  - Next ${product.modelImages.length} images: REFERENCE MODEL (Use this person for ALL scenes).
  - Next ${product.backgroundImages.length} images: REFERENCE BACKGROUND (Use this location for ALL scenes).
  `;

  if (product.referenceVideo) {
      promptText += `
      - Last item is a REFERENCE VIDEO.
      
      [INSTRUCTION]: 
      1. Analyze the REFERENCE VIDEO frame-by-frame for pacing, editing style, and viral hook structure.
      2. IGNORE the user's default scene count setting. Instead, DETERMINE the optimal number of scenes based on the reference video's duration and complexity.
      3. Generate a script that matches the reference video's style/vibe but sells the current PRODUCT.
      `;
  } else {
      promptText += `\n请生成一个包含 ${sceneCount} 个分镜的TikTok爆款视频脚本。`;
  }
  
  promptText += `
  Product Info:
  标题: ${product.title || "未提供"}
  描述: ${product.description || "未提供"}
  创意: ${product.creativeIdeas || "自由发挥"}
  
  如果提供了 Reference Model 或 Background，请在 imagePrompt 中包含 "matching reference model" 或 "matching reference background" 的描述，并详细描写其视觉特征以确保一致性。
  `;

  parts.push({ text: promptText });

  const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
    model: GEMINI_MODEL_ANALYSIS,
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productType: { type: Type.STRING, description: "识别出的产品类型(中文)" },
          sellingPoints: { type: Type.STRING, description: "主要卖点分析(中文)" },
          targetAudience: { type: Type.STRING, description: "目标受众(中文)" },
          hook: { type: Type.STRING, description: "视频开头的强钩子(中文)" },
          painPoints: { type: Type.STRING, description: "解决的用户痛点(中文)" },
          strategy: { type: Type.STRING, description: "六维营销策略分析(中文)" },
          assignedVoice: { type: Type.STRING, description: "指定的配音角色名 (e.g. Kore, Fenrir)" },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                visual: { type: Type.STRING },
                action: { type: Type.STRING },
                camera: { type: Type.STRING },
                dialogue: { type: Type.STRING, description: "English Dialogue" },
                dialogue_cn: { type: Type.STRING, description: "Chinese Dialogue Translation" },
                prompt: {
                  type: Type.OBJECT,
                  properties: {
                    imagePrompt: { type: Type.STRING },
                  },
                }
              },
              propertyOrdering: ["id", "visual", "action", "camera", "dialogue", "dialogue_cn", "prompt"]
            }
          }
        },
        propertyOrdering: ["productType", "sellingPoints", "targetAudience", "hook", "painPoints", "strategy", "assignedVoice", "scenes"]
      }
    }
  }));

  // Sanitize JSON string
  let jsonText = response.text || '{}';
  jsonText = jsonText.replace(/```json\s*/g, '').replace(/```/g, '').trim();

  try {
    const result = JSON.parse(jsonText);
    // Enforce the pre-selected voice if the model hallucinations something else
    result.assignedVoice = assignedVoice; 
    return result;
  } catch (e) {
    console.error("JSON Parse Error:", e);
    throw new Error("无法解析 AI 返回的分析结果，请重试。");
  }
};

// 2. Image Generation (Banana Pro / Gemini 3 Image)
export const generateImage = async (
  prompt: string, 
  aspectRatio: AspectRatio,
  resolution: ImageResolution,
  referenceImages: string[] = [] 
): Promise<string> => {
  const client = await getClient();
  
  const parts: any[] = [{ text: prompt }];
  
  // Logic: Add images. If too many, maybe limit? Gemini usually handles ~10 images fine.
  referenceImages.slice(0, 5).forEach(ref => {
    parts.unshift({
        inlineData: {
            mimeType: 'image/jpeg',
            data: ref
        }
    });
  });

  const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
    model: GEMINI_MODEL_IMAGE,
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: resolution as any
      }
    }
  }));

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  throw new Error("未能生成图片，请检查输入或稍后重试。");
};

// 3. Audio Generation (TTS)
export const generateSpeech = async (
    text: string,
    voiceName: string = 'Kore'
): Promise<string> => {
    const client = await getClient();
    
    // Ensure voiceName is valid, fallback if needed
    const validVoice = VOICE_OPTIONS.includes(voiceName) ? voiceName : 'Kore';

    const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
        model: GEMINI_MODEL_TTS,
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: validVoice },
                },
            },
        },
    }));

    const base64PCM = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64PCM) throw new Error("TTS 服务未返回音频数据。");
    
    // Convert Raw PCM to WAV for browser compatibility
    const wavBase64 = pcmToWav(base64PCM);

    return wavBase64;
};

// 4. Advanced Video Prompt Generation (V2 - Veo Production Manifest)
export const generateVeoPrompt = async (
  scene: SceneDraft,
  promptVersion: 'v1' | 'v2' = 'v2'
): Promise<string> => {
  const client = await getClient();

  // --- VERSION 1: STANDARD TEXT PROMPT (简易提示词) ---
  if (promptVersion === 'v1') {
      const systemInstructionV1 = `
      You are an expert video prompt engineer.
      Rewrite the provided scene details into a single, high-quality, English text prompt for video generation.
      
      **MANDATORY FORMAT RULES**:
      1. **Start Frame**: The prompt MUST START with: "The video starts with the provided start frame. Maintain strict consistency in quality, resolution, and lighting with the start frame! Do not lower resolution."
      2. **Scene Description**: Clear, cinematic description of the subject, action and camera movement based on the provided inputs.
      3. **Dialogue**: If dialogue is present ("${scene.dialogue}") and not empty, you MUST add: "The character is speaking with accurate lip-sync."
      
      Input Data:
      Visual: ${scene.visual}
      Action: ${scene.action}
      Camera: ${scene.camera}
      Dialogue: ${scene.dialogue}
      `;

      const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
        model: GEMINI_MODEL_ANALYSIS,
        contents: { parts: [{ text: "Generate the V1 text prompt." }] },
        config: { systemInstruction: systemInstructionV1 }
      }));
      
      return response.text || scene.prompt.imagePrompt;
  }

  // --- VERSION 2: VEO PRODUCTION MANIFEST (优化提示词) ---
  const systemInstructionV2 = `
  You are an elite Video Prompt Engineer for the advanced 'Veo Production Manifest V4.0'.
  
  Your Task:
  Convert the user's Scene Details (Visual, Action, Camera, Dialogue) from Chinese/English into a STRICT JSON format called "veo_production_manifest".
  
  RULES:
  1. **Output Format**: Pure JSON only. No Markdown. No Explanations.
  2. **Language**: ALL content inside the JSON must be **ENGLISH**. Translate any Chinese inputs accurately.
  3. **Mandatory Consistency Check**: You MUST strictly enforce consistency with the "Start Frame".
     - In 'director_mandates', add a mandate: "The video MUST start with the provided start frame. Maintenance of texture, lighting, and resolution from the start frame is critical."
     - In 'timeline_script' -> 'elements' -> 'visuals', you MUST add a "consistency_check" field.
     - **CRITICAL**: The 'consistency_check' field MUST explicitly state: "At 0s, 2s, 4s, 6s: Ensure absolute consistency in lighting, resolution, and character appearance with the start frame. Do not lower resolution."
  4. **Structure**: Follow the exact schema below.
  
  SCHEMA TEMPLATE:
  {
    "veo_production_manifest": {
      "version": "4.0",
      "shot_summary": "[English summary of action and setting]",
      "description": "The ultimate industrial-grade production manifest. V4.0.",
      "global_settings": {
        "input_assets": {
          "reference_image": "Start Frame"
        },
        "output_specifications": {
          "resolution": "1080p",
          "aspect_ratio_lock": {
            "enabled": true,
            "comment": "Forces all elements and actions to respect the intended aspect ratio."
          },
          "color_space": "Rec. 2020",
          "dynamic_range": "HDR"
        },
        "rendering_pipeline": {
          "engine": "Physically-Based Rendering (PBR)",
          "light_transport": "Path Tracing",
          "shadow_quality": "High-resolution shadow maps"
        }
      },
      "director_mandates": {
        "positive_mandates": [
          "The video MUST start with the provided start frame.",
          "Maintenance of texture, lighting, and resolution from the start frame is critical at 0s, 2s, 4s, and 6s.",
          "[Add specific visual mandates based on input]"
        ],
        "negative_mandates": [
          "NO smooth or stable camera motion if action is chaotic.",
          "NO morphing of character features.",
          "NO lowering of resolution or quality."
        ]
      },
      "aesthetic_filter": {
        "name": "[e.g., Cinematic Hyper-Realism, Found Footage]",
        "visual_mandates": {
          "lighting_style": "[e.g., Natural, Low-key, Studio]",
          "atmosphere": "[e.g., Clean, Hazy, Vibrant]",
          "style_description": "[e.g., High-end commercial style, User Generated Content style]",
          "color_palette": "[e.g., Matches start frame, Warm tones]"
        },
        "performance_mandates": {
            "mood": "[e.g., Exciting, Calm]",
            "physics_engine": "Hyper-realistic"
        }
      },
      "timeline_script": [
        {
          "time_start": "0.0s",
          "time_end": "8.0s",
          "description": "[Full scene description]",
          "elements": {
            "visuals": {
              "subject_action": "[Translated Action]",
              "background_action": "[Background details]",
              "consistency_check": "At 0s, 2s, 4s, 6s: Ensure absolute consistency in lighting, resolution, and character appearance with the start frame. Do not lower resolution."
            },
            "camera": {
              "shot_composition": { "shot_type": "[e.g. Wide, Close-up]", "angle": "..." },
              "camera_movement": {
                "primary_movement": "[Translated Camera Move]",
                "movement_description": "[Elaborate on camera intent]",
                "speed": "[e.g. Slow, Fast]"
              }
            },
            "audio_scape": {
              "dialogue": { "transcript": "[English Dialogue]" },
              "sfx": ["[Sound effects]"],
              "ambient": "[Ambient sounds]"
            },
            "overlays_and_graphics": []
          }
        }
      ]
    }
  }
  `;

  const promptText = `
  Convert this scene to Veo JSON V2:
  Visual (画面): ${scene.visual}
  Action (动作): ${scene.action}
  Camera (运镜): ${scene.camera}
  Dialogue (对白): ${scene.dialogue}
  `;

  const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
    model: GEMINI_MODEL_ANALYSIS, // Using Pro model for logic/json construction
    contents: { parts: [{ text: promptText }] },
    config: {
      systemInstruction: systemInstructionV2,
      responseMimeType: "application/json"
    }
  }));

  let jsonText = response.text || '{}';
  // Cleanup potential markdown formatting
  jsonText = jsonText.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  
  return jsonText;
};
