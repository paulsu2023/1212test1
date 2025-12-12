import React, { useState, useRef } from 'react';
import { Play, Image as ImageIcon, Wand2, Copy, ChevronDown, ChevronUp, RefreshCw, ArrowRight, Maximize2, Mic, Pause, Download, Edit3, X, Check, FileJson, Type } from 'lucide-react';
import { StoryboardScene, VideoMode, AspectRatio, GeneratedAsset, ImageResolution } from '../types';
import { generateImage, generateSpeech, generateVeoPrompt } from '../services/geminiService';
import { AnalysisLoader } from './AnalysisLoader';

interface Props {
  scenes: StoryboardScene[];
  videoMode: VideoMode;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  productImages: string[];
  modelImages: string[];
  backgroundImages: string[];
  assignedVoice: string;
  onUpdateScene: (id: string, updates: Partial<StoryboardScene>) => void;
  onPreview: (url: string, type: 'image' | 'audio') => void;
}

export const Storyboard: React.FC<Props> = ({ 
    scenes, videoMode, aspectRatio, resolution, productImages, modelImages, backgroundImages, assignedVoice,
    onUpdateScene, onPreview
}) => {
  const [expandedScene, setExpandedScene] = useState<string | null>(scenes[0]?.id || null);
  const [showPromptId, setShowPromptId] = useState<string | null>(null);
  const [editPromptData, setEditPromptData] = useState<{sceneId: string, type: 'start' | 'middle' | 'end', prompt: string} | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedScene(expandedScene === id ? null : id);
  };

  const handleBatchGenerate = async (scene: StoryboardScene) => {
      // Logic to trigger sequential generation for consistency
      
      // 1. Ensure Start Image exists first (Source of Truth for consistency)
      let startImageData = scene.startImage?.data;
      if (!startImageData) {
           // Wait for start image generation to complete before proceeding
           startImageData = await handleGenerateImage(scene, 'start');
      }

      // If we still don't have start image (generation failed), abort dependent generations
      if (!startImageData && (videoMode === VideoMode.StartEnd || videoMode === VideoMode.Intermediate)) {
          return; 
      }

      const promises = [];
      
      // 2. Generate Middle (Draft) - Pass startImageData as explicit override
      if (videoMode === VideoMode.Intermediate && !scene.middleImage) {
           promises.push(handleGenerateImage(scene, 'middle', undefined, startImageData));
      }

      // 3. Generate End Image - Pass startImageData as explicit override
      if ((videoMode === VideoMode.StartEnd || videoMode === VideoMode.Intermediate) && !scene.endImage) {
          promises.push(handleGenerateImage(scene, 'end', undefined, startImageData));
      }
      
      await Promise.all(promises);
  };

  const handleGenerateImage = async (
    scene: StoryboardScene, 
    type: 'start' | 'end' | 'middle', 
    customPrompt?: string,
    overrideStartImageData?: string
  ): Promise<string | undefined> => {
    // Set granular loading state
    const loadingUpdate = {
        isGeneratingStart: type === 'start' ? true : scene.isGeneratingStart,
        isGeneratingMiddle: type === 'middle' ? true : scene.isGeneratingMiddle,
        isGeneratingEnd: type === 'end' ? true : scene.isGeneratingEnd,
        error: undefined
    };
    onUpdateScene(scene.id, loadingUpdate);

    try {
      let prompt = customPrompt || scene.prompt.imagePrompt;
      let referenceImages: string[] = [];

      // If prompt version is v2 (JSON), we might want to extract the summary for image generation 
      // OR pass the JSON as text. Banana Pro/Imagen usually prefer text.
      // However, for this requirement, we assume the user wants to use this prompt.
      // If it is JSON, we trust the model to interpret or we rely on the prompt being mainly for Veo.
      // For Image Generation, we strictly use text descriptions usually. 
      // If the prompt is V2 JSON, we might fallback to scene.visual + scene.action for the image gen call 
      // unless the user explicitly wants to test the JSON prompt. 
      // *Decision*: Pass the prompt as is. Gemini 3 models are multimodal and handle JSON prompts surprisingly well or we treat it as text.

      // Priority 1: User Uploaded Custom References (Model & Background)
      if (modelImages && modelImages.length > 0) {
          referenceImages.push(...modelImages);
          // Enhance prompt to ensure model usage if not already there
          if (!prompt.includes("Reference Model") && scene.promptVersion !== 'v2') {
              prompt += " (Use the provided Reference Model image for the character).";
          }
      }
      if (backgroundImages && backgroundImages.length > 0) {
          referenceImages.push(...backgroundImages);
           if (!prompt.includes("Reference Background") && scene.promptVersion !== 'v2') {
              prompt += " (Use the provided Reference Background image for the environment).";
          }
      }

      // Priority 2: Product Images
      if (productImages && productImages.length > 0) {
          referenceImages.push(...productImages.slice(0, 2)); // Limit product images if we have model/bg
      }
      
      // LOGIC: Specific Prompt & Reference handling for each type
      if (type === 'middle') {
        // Enforce Sketch style for intermediate draft
        if (scene.promptVersion !== 'v2') {
            prompt += ` (Technical storyboard sketch sheet, rough line art style, English annotations only. Break down the action: ${scene.action} into keyframes. NO realistic photos, NO photorealism, monochrome sketch style.)`;
        }
        
        // Consistency: Use Start Image as reference for layout
        const startImg = overrideStartImageData || scene.startImage?.data;
        if (startImg) {
            referenceImages.unshift(startImg);
            if (scene.promptVersion !== 'v2') prompt += " (Reference the provided Start Frame for environment layout and character features.)";
        }
        
        if (scene.endImage?.data) referenceImages.push(scene.endImage.data);
      } 
      else {
          // START & END FRAMES: Enforce Realism and NO TEXT
           if (scene.promptVersion !== 'v2') {
              prompt += " (Photorealistic, 8k uhd, cinematic lighting. NO TEXT, NO SUBTITLES, NO WATERMARK, pure photography.)";

              if (type === 'end') {
                  // CONSISTENCY LOGIC: End Frame
                  // Stronger prompt for consistency
                  prompt += " (Final frame of the action. STRICT VISUAL CONSISTENCY REQUIRED: You must use the EXACT SAME BACKGROUND (room, furniture, lighting) and CHARACTER as the provided reference image (Start Frame). Do not change the environment. Same location, different angle/action only.)";
                  
                  // CRITICAL: Inject Start Image as the primary reference for the End Frame
                  const startImg = overrideStartImageData || scene.startImage?.data;
                  if (startImg) {
                      referenceImages.unshift(startImg);
                  }
              }
           } else {
               // V2 JSON Logic: We trust the prompt already has strict mandates, but we MUST attach the image reference.
                const startImg = overrideStartImageData || scene.startImage?.data;
                if (startImg && type === 'end') {
                      referenceImages.unshift(startImg);
                }
           }
      }

      // **RESOLUTION LOGIC**: 
      // ONLY force 1K if it's the "Draft" (Middle) frame in Intermediate mode.
      // Start and End frames always respect the user's resolution setting.
      let targetResolution = resolution;
      if (videoMode === VideoMode.Intermediate && type === 'middle') {
          targetResolution = ImageResolution.Res_1K;
      }

      // Generate
      const base64 = await generateImage(prompt, aspectRatio, targetResolution, referenceImages);
      
      const asset: GeneratedAsset = {
        type: 'image',
        url: `data:image/jpeg;base64,${base64}`,
        mimeType: 'image/jpeg',
        data: base64
      };

      if (type === 'start') onUpdateScene(scene.id, { startImage: asset });
      else if (type === 'end') onUpdateScene(scene.id, { endImage: asset });
      else if (type === 'middle') onUpdateScene(scene.id, { middleImage: asset });

      // N-1 Logic: If generating End frame, update next scene's Start frame
      if ((videoMode === VideoMode.StartEnd || videoMode === VideoMode.Intermediate) && type === 'end') {
        const index = scenes.findIndex(s => s.id === scene.id);
        if (index < scenes.length - 1) {
          onUpdateScene(scenes[index + 1].id, { startImage: asset });
        }
      }

      return base64;

    } catch (e) {
      onUpdateScene(scene.id, { error: `生成失败: ${(e as Error).message}` });
      return undefined;
    } finally {
      // Reset loading state
       const finalUpdate: any = {};
       if(type === 'start') finalUpdate.isGeneratingStart = false;
       if(type === 'middle') finalUpdate.isGeneratingMiddle = false;
       if(type === 'end') finalUpdate.isGeneratingEnd = false;
       
       onUpdateScene(scene.id, finalUpdate);
    }
  };

  const handleGenerateAudio = async (scene: StoryboardScene) => {
    if (!scene.dialogue) return;
    onUpdateScene(scene.id, { isGeneratingAudio: true, error: undefined });
    try {
        const base64 = await generateSpeech(scene.dialogue, assignedVoice);
        const asset: GeneratedAsset = {
            type: 'audio',
            url: `data:audio/wav;base64,${base64}`, // Changed to wav
            mimeType: 'audio/wav',
            data: base64
        };
        onUpdateScene(scene.id, { audio: asset });
    } catch (e) {
        onUpdateScene(scene.id, { error: `语音失败: ${(e as Error).message}` });
    } finally {
        onUpdateScene(scene.id, { isGeneratingAudio: false });
    }
  };

  const updatePrompt = (id: string, value: string) => {
      const scene = scenes.find(s => s.id === id);
      if (scene) {
          onUpdateScene(id, { prompt: { ...scene.prompt, imagePrompt: value } });
      }
  }

  const handleUpdatePromptContent = async (scene: StoryboardScene) => {
      const version = scene.promptVersion || 'v1';
      onUpdateScene(scene.id, { isUpdatingPrompt: true });
      try {
          // If V2, we generate strict JSON. If V1, we usually keep as is or could re-generate V1 text.
          // Here we specifically assume updating means "Sync prompt with Visual/Action text"
          const newPrompt = await generateVeoPrompt(scene, version);
          onUpdateScene(scene.id, { prompt: { ...scene.prompt, imagePrompt: newPrompt } });
      } catch (e) {
          onUpdateScene(scene.id, { error: `提示词更新失败: ${(e as Error).message}` });
      } finally {
          onUpdateScene(scene.id, { isUpdatingPrompt: false });
      }
  }

  const handleVersionChange = async (scene: StoryboardScene, version: 'v1' | 'v2') => {
      onUpdateScene(scene.id, { promptVersion: version });
      // Automatically regenerate prompt content when switching to V2 to show the JSON immediately
      // OR when switching back to V1 to restore text format
      onUpdateScene(scene.id, { isUpdatingPrompt: true });
      try {
             const newPrompt = await generateVeoPrompt(scene, version);
             onUpdateScene(scene.id, { 
                 promptVersion: version, 
                 prompt: { ...scene.prompt, imagePrompt: newPrompt },
                 isUpdatingPrompt: false
             });
      } catch(e) {
             onUpdateScene(scene.id, { isUpdatingPrompt: false, error: "无法切换格式" });
      }
  };

  const openEditDialog = (scene: StoryboardScene, type: 'start' | 'middle' | 'end') => {
      let prompt = scene.prompt.imagePrompt;
      if (scene.promptVersion !== 'v2') {
        if (type === 'end') prompt += " (Final frame. Maintain consistency with Start frame. NO TEXT.)";
        if (type === 'middle') prompt += " (Technical storyboard sketch sheet, English annotations)";
      }
      
      setEditPromptData({
          sceneId: scene.id,
          type,
          prompt
      });
  };

  const handleRegenerateConfirm = () => {
      if (!editPromptData) return;
      const scene = scenes.find(s => s.id === editPromptData.sceneId);
      if (scene) {
          handleGenerateImage(scene, editPromptData.type, editPromptData.prompt);
      }
      setEditPromptData(null);
  };

  return (
    <div className="space-y-6 relative">
       {/* Prompt Edit Modal */}
       {editPromptData && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">修改提示词并重新生成</h3>
                    <button onClick={() => setEditPromptData(null)} className="text-slate-500 hover:text-white"><X size={20} /></button>
                </div>
                <div>
                    <label className="text-xs text-brand-400 font-bold uppercase mb-2 block">AI 提示词 (Prompt)</label>
                    <textarea 
                        value={editPromptData.prompt} 
                        onChange={(e) => setEditPromptData(prev => prev ? ({...prev, prompt: e.target.value}) : null)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-sm text-slate-200 focus:border-brand-500 outline-none h-40 font-mono"
                    />
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setEditPromptData(null)} className="px-4 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">取消</button>
                    <button onClick={handleRegenerateConfirm} className="px-4 py-2 rounded bg-brand-600 text-white hover:bg-brand-500 flex items-center gap-2">
                        <Check size={16} /> 确认生成
                    </button>
                </div>
            </div>
        </div>
       )}

      {/* Toolbar */}
      <div className="flex items-center justify-end gap-4 mb-2">
           <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 flex items-center gap-3">
               <span className="text-xs font-bold text-slate-500 uppercase">当前分辨率</span>
               <span className="text-xs text-brand-400 font-mono bg-brand-900/20 px-2 py-0.5 rounded border border-brand-500/20">
                    {resolution}
               </span>
           </div>
      </div>

      {scenes.map((scene, index) => (
        <div key={scene.id} className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-lg transition-all hover:border-slate-600">
          {/* Header */}
          <div className="p-4 flex items-center justify-between bg-slate-800/80 border-b border-slate-700 cursor-pointer" onClick={() => toggleExpand(scene.id)}>
            <div className="flex items-center gap-4">
              <span className="bg-brand-600 text-white text-xs font-bold px-2 py-1 rounded shadow shadow-brand-500/20">
                分镜 {index + 1}
              </span>
              <div className="flex flex-col">
                  <h3 className="font-semibold text-slate-200 truncate max-w-md">{scene.visual || '未命名分镜'}</h3>
                  <span className="text-xs text-slate-500 truncate max-w-md">{scene.action}</span>
              </div>
            </div>
            <button className="text-slate-400 hover:text-white transition-transform duration-200" style={{ transform: expandedScene === scene.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <ChevronDown />
            </button>
          </div>

          {/* Expanded Content */}
          <div className={`border-t border-slate-700/50 bg-slate-900/50 ${expandedScene === scene.id ? 'block' : 'hidden'}`}>
            <div className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
              
              {/* Left: Script & Prompts (4 cols) */}
              <div className="xl:col-span-4 space-y-5">
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] uppercase text-brand-400 font-bold tracking-wider">画面内容</label>
                            <textarea 
                                value={scene.visual}
                                onChange={(e) => onUpdateScene(scene.id, { visual: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                                rows={2}
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                             <label className="text-[10px] uppercase text-brand-400 font-bold tracking-wider">动作</label>
                            <textarea 
                                value={scene.action}
                                onChange={(e) => onUpdateScene(scene.id, { action: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                                rows={2}
                            />
                        </div>
                    </div>
                  
                  <div className="space-y-1">
                        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">运镜</label>
                        <input 
                        value={scene.camera}
                        onChange={(e) => onUpdateScene(scene.id, { camera: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-300 focus:border-brand-500 focus:outline-none"
                        />
                   </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">对白 (中文)</label>
                        <input 
                        value={scene.dialogue_cn || ''}
                        readOnly
                        className="w-full bg-slate-950/50 border border-slate-800 rounded p-2 text-sm text-slate-400 focus:border-brand-500 focus:outline-none cursor-not-allowed"
                        placeholder="中文意译"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-brand-400 font-bold tracking-wider">配音 (英文)</label>
                        <input 
                        value={scene.dialogue}
                        onChange={(e) => onUpdateScene(scene.id, { dialogue: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-300 focus:border-brand-500 focus:outline-none"
                        placeholder="English text"
                        />
                    </div>
                  </div>
                </div>

                 {/* Collapsible Prompt Editor */}
                 <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                    <div 
                        className="flex items-center justify-between p-2 bg-slate-800/50 cursor-pointer hover:bg-slate-800"
                        onClick={() => setShowPromptId(showPromptId === scene.id ? null : scene.id)}
                    >
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                            <Wand2 size={12} /> 视觉提示词 (Image/Video Prompt)
                        </span>
                        {showPromptId === scene.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                    
                    {showPromptId === scene.id && (
                        <div className="p-3 space-y-3">
                            {/* Version Control & Update Button */}
                            <div className="flex items-center justify-between">
                                <div className="flex bg-slate-900 rounded p-0.5 border border-slate-700">
                                    <button 
                                        onClick={() => handleVersionChange(scene, 'v1')}
                                        className={`px-2 py-1 text-[10px] rounded flex items-center gap-1 transition-all ${(!scene.promptVersion || scene.promptVersion === 'v1') ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        <Type size={10} /> 简易提示词
                                    </button>
                                    <button 
                                        onClick={() => handleVersionChange(scene, 'v2')}
                                        className={`px-2 py-1 text-[10px] rounded flex items-center gap-1 transition-all ${scene.promptVersion === 'v2' ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        <FileJson size={10} /> 优化提示词
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                     <button 
                                        onClick={() => handleUpdatePromptContent(scene)}
                                        disabled={scene.isUpdatingPrompt}
                                        className="text-[10px] px-2 py-1 bg-brand-900/30 text-brand-400 hover:bg-brand-900/50 border border-brand-500/30 rounded flex items-center gap-1 disabled:opacity-50"
                                        title="根据画面/动作/运镜内容更新提示词"
                                     >
                                         <RefreshCw size={10} className={scene.isUpdatingPrompt ? 'animate-spin' : ''} />
                                         更新提示词
                                     </button>
                                    <button onClick={() => navigator.clipboard.writeText(scene.prompt.imagePrompt)} className="text-slate-500 hover:text-white"><Copy size={12} /></button>
                                </div>
                            </div>

                            <textarea 
                                value={scene.prompt.imagePrompt}
                                onChange={(e) => updatePrompt(scene.id, e.target.value)}
                                className={`w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-green-400 font-mono focus:outline-none ${scene.promptVersion === 'v2' ? 'leading-relaxed' : ''}`}
                                rows={8}
                            />
                            {scene.promptVersion === 'v2' && (
                                <div className="text-[10px] text-slate-500 italic">
                                    * Veo V2 Prompt 包含强制的 0s/2s/4s/6s 一致性检查点。
                                </div>
                            )}
                        </div>
                    )}
                 </div>
                 
                 <button 
                    onClick={() => handleBatchGenerate(scene)}
                    disabled={scene.isGeneratingStart || scene.isGeneratingMiddle || scene.isGeneratingEnd}
                    className="w-full py-3 mt-4 bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 border border-brand-500/30 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                 >
                    <Wand2 size={14} /> 生成全部分镜画面
                 </button>
              </div>

              {/* Right: Asset Generation (8 cols) */}
              <div className="xl:col-span-8">
                 <div className="flex flex-col gap-6">
                    
                    {/* Visual Asset Flow */}
                    <div className="flex gap-2 overflow-x-auto pb-4 items-start custom-scrollbar">
                        {/* Start Frame - Always visible */}
                        <AssetCard 
                            label="首帧图" 
                            asset={scene.startImage} 
                            loading={scene.isGeneratingStart} 
                            onGen={() => handleGenerateImage(scene, 'start')} 
                            onEditGen={() => openEditDialog(scene, 'start')}
                            onPreview={onPreview}
                            icon={<ImageIcon size={14} />}
                        />
                        
                        {/* Flow Arrow */}
                        {(videoMode === VideoMode.StartEnd || videoMode === VideoMode.Intermediate) && (
                            <div className="mt-16 text-slate-600 hidden md:block"><ArrowRight size={16} /></div>
                        )}

                        {/* Middle Frame (Draft) - Only for Intermediate Mode */}
                        {videoMode === VideoMode.Intermediate && (
                            <>
                                <AssetCard 
                                    label="分镜草稿" 
                                    asset={scene.middleImage} 
                                    loading={scene.isGeneratingMiddle} 
                                    onGen={() => handleGenerateImage(scene, 'middle')} 
                                    onEditGen={() => openEditDialog(scene, 'middle')}
                                    onPreview={onPreview}
                                    icon={<Wand2 size={14} />}
                                    highlight
                                />
                                <div className="mt-16 text-slate-600 hidden md:block"><ArrowRight size={16} /></div>
                            </>
                        )}

                        {/* End Frame - Visible for StartEnd and Intermediate */}
                        {(videoMode === VideoMode.StartEnd || videoMode === VideoMode.Intermediate) && (
                            <>
                                <AssetCard 
                                    label="尾帧图" 
                                    asset={scene.endImage} 
                                    loading={scene.isGeneratingEnd} 
                                    onGen={() => handleGenerateImage(scene, 'end')} 
                                    onEditGen={() => openEditDialog(scene, 'end')}
                                    onPreview={onPreview}
                                    icon={<ImageIcon size={14} />}
                                />
                                <div className="mt-16 text-slate-600 hidden md:block"><ArrowRight size={16} /></div>
                            </>
                        )}
                        
                    </div>

                    {/* Audio Section (Horizontal now for better fit) */}
                    <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                         <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                             <Mic size={16} />
                         </div>
                         <div className="flex-1">
                             <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">配音 ({assignedVoice})</span>
                             {scene.audio ? (
                                <div className="flex items-center gap-3 mt-1">
                                    <AudioPlayer url={scene.audio.url} />
                                    <button onClick={() => handleGenerateAudio(scene)} className="text-[10px] text-slate-400 underline hover:text-white">重生成</button>
                                     <a href={scene.audio.url} download={`scene-${index+1}-audio.wav`} className="text-slate-400 hover:text-white"><Download size={14}/></a>
                                </div>
                             ) : (
                                <div className="flex items-center gap-2 mt-1">
                                    <button 
                                        disabled={!scene.dialogue || scene.isGeneratingAudio}
                                        onClick={() => handleGenerateAudio(scene)}
                                        className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-300 transition-colors disabled:opacity-50"
                                    >
                                        {scene.isGeneratingAudio ? '生成中...' : '生成语音'}
                                    </button>
                                    {!scene.dialogue && <span className="text-[10px] text-slate-600">无对白</span>}
                                </div>
                             )}
                         </div>
                    </div>

                 </div>
                 {scene.error && (
                    <div className="mt-3 text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-900/50 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      {scene.error}
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Simple Audio Player Component
const AudioPlayer = ({ url }: { url: string }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);

    const toggle = () => {
        if (!audioRef.current) return;
        if (playing) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setPlaying(!playing);
    };

    return (
        <div className="flex items-center gap-2">
            <audio 
                ref={audioRef} 
                src={url} 
                onEnded={() => setPlaying(false)} 
                className="hidden"
            />
            <button 
                onClick={toggle}
                className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-500 transition-colors"
            >
                {playing ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
            </button>
            <span className="text-xs text-brand-400 font-mono">WAV</span>
        </div>
    )
}

// Helper Components
const AssetCard = ({ label, asset, loading, onGen, onEditGen, onPreview, icon, highlight, disabled }: any) => (
  <div className={`w-32 flex-shrink-0 space-y-2 ${disabled ? 'opacity-50 grayscale' : ''}`}>
    <div className={`aspect-[9/16] bg-slate-950 rounded-lg border ${highlight ? 'border-brand-500/50' : 'border-slate-800'} flex items-center justify-center relative overflow-hidden group`}>
      {loading && <AnalysisLoader mode="generation" variant="contained" />}
      
      {asset ? (
        <>
          <img src={asset.url} className="w-full h-full object-cover" />
          
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
             <button onClick={() => onPreview(asset.url, 'image')} className="p-1.5 bg-brand-600 rounded-full text-white hover:text-white transform hover:scale-110 transition-transform shadow-lg">
               <Maximize2 size={14} />
             </button>
              <a 
                href={asset.url} 
                download={`${label}.jpg`}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 bg-slate-600 rounded-full text-white hover:text-white transform hover:scale-110 transition-transform shadow-lg"
              >
               <Download size={14} />
             </a>
          </div>
        </>
      ) : (
        !loading && <span className="text-[10px] text-slate-600 text-center px-2 uppercase font-medium">{label}</span>
      )}
    </div>
    
    <div className="flex gap-1">
        <button 
        disabled={loading || disabled}
        onClick={onGen}
        className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded flex items-center justify-center gap-1.5 transition-colors ${asset ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-700 hover:bg-slate-600 text-white'} ${disabled ? 'cursor-not-allowed' : ''}`}
        >
        {asset ? <RefreshCw size={10} /> : icon}
        {asset ? '重生成' : '生成'}
        </button>
        
        {asset && onEditGen && (
            <button 
                disabled={loading}
                onClick={onEditGen}
                className="w-6 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center transition-colors"
                title="修改提示词并重新生成"
            >
                <Edit3 size={10} />
            </button>
        )}
    </div>
  </div>
);