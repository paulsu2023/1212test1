
import React, { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { Bot, Layers, LayoutTemplate, Settings2, Sparkles, AlertCircle, X, ChevronRight, BrainCircuit, Minus, Plus, Download, Lock, KeyRound, ArrowRight, User, Image as ImageIcon, Video } from 'lucide-react';
import { ImageUploader, VideoUploader } from './components/ImageUploader';
import { Storyboard } from './components/Storyboard';
import { AnalysisLoader } from './components/AnalysisLoader';
import { analyzeProduct } from './services/geminiService';
import { AppState, AspectRatio, VideoMode, StoryboardScene, ImageResolution } from './types';
import { ASPECT_RATIOS, VIDEO_MODES, IMAGE_RESOLUTIONS } from './constants';

function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  const [state, setState] = useState<AppState>({
    product: {
      images: [],
      title: '',
      description: '',
      creativeIdeas: '',
      modelImages: [],
      backgroundImages: [],
      referenceVideo: null,
    },
    settings: {
      aspectRatio: AspectRatio.Ratio_9_16,
      imageResolution: ImageResolution.Res_2K,
      videoMode: VideoMode.Standard,
      sceneCount: 1, 
    },
    analysis: null,
    storyboard: [],
    isAnalyzing: false,
    isGeneratingScene: false,
    activeStep: 0,
  });

  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'audio' } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'allysc') {
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      // Optional: clear input or shake effect logic here
    }
  };

  const handleProductUpdate = (field: string, value: any) => {
    setState(prev => ({
      ...prev,
      product: { ...prev.product, [field]: value }
    }));
  };

  const startAnalysis = async () => {
    if (state.product.images.length === 0) {
      setErrorMsg("请至少上传一张产品图片");
      return;
    }
    
    // Check for API Key trigger
    try {
        // @ts-ignore
        if (window.aistudio && window.aistudio.openSelectKey) {
             // @ts-ignore
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                 // @ts-ignore
                 await window.aistudio.openSelectKey();
            }
        }
    } catch(e) {
        // Fallback or ignore
    }

    setState(prev => ({ ...prev, isAnalyzing: true, activeStep: 1 }));
    setErrorMsg(null);

    try {
      const result = await analyzeProduct(state.product, state.settings.sceneCount);
      
      const initialStoryboard: StoryboardScene[] = result.scenes.map((s: any) => ({
        ...s,
        isGeneratingImage: false,
        isGeneratingAudio: false,
        isGeneratingStart: false,
        isGeneratingMiddle: false,
        isGeneratingEnd: false,
      }));
      
      // Update scene count setting based on actual result if auto-detected from video
      const newSceneCount = result.scenes.length;

      setState(prev => ({
        ...prev,
        analysis: result,
        storyboard: initialStoryboard,
        isAnalyzing: false,
        settings: {
            ...prev.settings,
            sceneCount: newSceneCount
        }
      }));
    } catch (error) {
      console.error(error);
      setErrorMsg(`分析失败，请重试: ${(error as Error).message}`);
      setState(prev => ({ ...prev, isAnalyzing: false, activeStep: 0 }));
    }
  };

  const updateScene = (id: string, updates: Partial<StoryboardScene>) => {
    setState(prev => ({
      ...prev,
      storyboard: prev.storyboard.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const adjustSceneCount = (delta: number) => {
      setState(prev => ({
          ...prev,
          settings: {
              ...prev.settings,
              sceneCount: Math.max(1, Math.min(10, prev.settings.sceneCount + delta))
          }
      }));
  };

  // Lock Screen Render
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 font-sans text-slate-200">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
           {/* Background effects */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
           <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

           <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 shadow-inner group">
                <Lock className="text-brand-500 w-10 h-10 group-hover:scale-110 transition-transform duration-300" />
              </div>
              
              <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">TikTok AI Creator</h1>
              <p className="text-slate-400 text-sm mb-8">System Locked. Please authenticate to continue.</p>

              <form onSubmit={handleLogin} className="w-full space-y-5">
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-3.5 text-slate-500 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => { setPasswordInput(e.target.value); setAuthError(false); }}
                    className={`w-full bg-slate-950 border ${authError ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-brand-500'} rounded-xl py-3 pl-12 pr-4 text-slate-200 outline-none focus:ring-2 transition-all placeholder-slate-600`}
                    placeholder="Enter Password"
                    autoFocus
                  />
                </div>
                
                {authError && (
                  <div className="text-red-400 text-xs flex items-center justify-center gap-1 animate-in fade-in slide-in-from-top-1 bg-red-900/20 py-1 rounded">
                    <AlertCircle size={12} /> Access Denied: Incorrect Password
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold rounded-xl shadow-lg shadow-brand-900/40 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Unlock Studio <ArrowRight size={18} />
                </button>
              </form>
           </div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen pb-20 bg-dark-950 font-sans">
        {/* Loading Overlay - Analysis (Fullscreen) */}
        {state.isAnalyzing && <AnalysisLoader mode="analysis" variant="fullscreen" />}
        
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-50 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-2 rounded-lg shadow-lg shadow-brand-900/50">
               <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-brand-400 to-white bg-clip-text text-transparent">
              TikTok AI Creator Studio
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium bg-slate-900 p-1 rounded-full border border-slate-800">
             <button 
                onClick={() => setState(prev => ({...prev, activeStep: 0}))}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all cursor-pointer ${state.activeStep === 0 ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
             >
                <Settings2 size={14} /> 1. 产品设置
             </button>
             <ChevronRight size={14} className="text-slate-700" />
             <button 
                onClick={() => state.storyboard.length > 0 && setState(prev => ({...prev, activeStep: 1}))}
                disabled={state.storyboard.length === 0}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all ${state.activeStep === 1 ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'} ${state.storyboard.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
             >
                <Layers size={14} /> 2. 智能分镜
             </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="pt-24 px-6 max-w-[1600px] mx-auto">
          
          {errorMsg && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
              <AlertCircle />
              {errorMsg}
            </div>
          )}

          {/* STEP 1: INPUTS */}
          <div className={`${state.activeStep === 0 ? 'block' : 'hidden'} space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Product Info & Settings (Adjusted to 4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                  
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-3 text-white">
                    <LayoutTemplate className="text-brand-500" size={20} /> 
                    产品信息
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">产品标题 <span className="text-slate-600 text-[10px] ml-1">(可选)</span></label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none text-slate-200 placeholder-slate-700 transition-all"
                        placeholder="例如：亚马逊爆款无叶挂脖风扇..."
                        value={state.product.title}
                        onChange={(e) => handleProductUpdate('title', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">产品描述 / 卖点 <span className="text-slate-600 text-[10px] ml-1">(可选)</span></label>
                      <textarea 
                        rows={4}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none text-slate-200 placeholder-slate-700 transition-all"
                        placeholder="粘贴亚马逊五点描述或用户评论..."
                        value={state.product.description}
                        onChange={(e) => handleProductUpdate('description', e.target.value)}
                      />
                    </div>
                     <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">创意想法 <span className="text-slate-600 text-[10px] ml-1">(可选)</span></label>
                      <textarea 
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none text-slate-200 placeholder-slate-700 transition-all"
                        placeholder="例如：希望是高能反转剧情，或者沉浸式ASMR风格..."
                        value={state.product.creativeIdeas}
                        onChange={(e) => handleProductUpdate('creativeIdeas', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-3 text-white">
                    <Settings2 className="text-brand-500" size={20} /> 
                    视频参数
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">画面比例</label>
                        <select 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-brand-500 outline-none"
                            value={state.settings.aspectRatio}
                            onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, aspectRatio: e.target.value as AspectRatio}}))}
                        >
                            {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        </div>
                        <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">生成模式</label>
                        <select 
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-brand-500 outline-none"
                            value={state.settings.videoMode}
                            onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, videoMode: e.target.value as VideoMode}}))}
                        >
                            {VIDEO_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        </div>
                    
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">分辨率</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-brand-500 outline-none"
                                value={state.settings.imageResolution}
                                onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, imageResolution: e.target.value as ImageResolution}}))}
                            >
                                {IMAGE_RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>

                        <div className={`${state.product.referenceVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                                分镜数量 {state.product.referenceVideo && <span className="text-brand-500 normal-case ml-1">(自动)</span>}
                            </label>
                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-1 h-[38px]">
                                    <button 
                                        onClick={() => adjustSceneCount(-1)}
                                        className="w-8 h-full rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="flex-1 text-center text-brand-400 font-bold text-sm">
                                        {state.settings.sceneCount}
                                    </span>
                                    <button 
                                        onClick={() => adjustSceneCount(1)}
                                        className="w-8 h-full rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                    >
                                        <Plus size={14} />
                                    </button>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Images (Adjusted to 8 cols for more space) */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl h-full flex flex-col relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                  
                  {/* Product Images - Compact Grid */}
                  <div className="mb-8">
                     <h2 className="text-xl font-bold mb-4 text-white flex justify-between items-center">
                        <span className="flex items-center gap-2"><ImageIcon size={20} className="text-brand-500"/> 产品素材</span>
                        <span className="text-xs text-slate-500 font-normal">建议上传 4-8 张</span>
                     </h2>
                     <div className="h-32">
                        <ImageUploader 
                            images={state.product.images} 
                            onImagesChange={(imgs) => handleProductUpdate('images', imgs)} 
                            onPreview={(url) => setPreviewMedia({url, type: 'image'})}
                            maxImages={8}
                            gridCols={8}
                            compact={true}
                        />
                     </div>
                  </div>
                  
                  {/* Custom Model, Background, Video - 3 Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 border-t border-slate-800 pt-8">
                      {/* Model */}
                      <div>
                          <div className="flex items-center gap-2 mb-3">
                              <User size={18} className="text-blue-400" />
                              <h3 className="text-sm font-bold text-slate-200">指定模特 <span className="text-xs font-normal text-slate-500 ml-1">(可选)</span></h3>
                          </div>
                          <p className="text-xs text-slate-500 mb-3 h-8">上传1-4张模特图，提取特征用于所有镜头。</p>
                          <div className="h-24">
                            <ImageUploader 
                                images={state.product.modelImages} 
                                onImagesChange={(imgs) => handleProductUpdate('modelImages', imgs)} 
                                onPreview={(url) => setPreviewMedia({url, type: 'image'})}
                                maxImages={4}
                                gridCols={4}
                                compact={true}
                            />
                          </div>
                      </div>

                      {/* Background */}
                      <div>
                          <div className="flex items-center gap-2 mb-3">
                              <ImageIcon size={18} className="text-purple-400" />
                              <h3 className="text-sm font-bold text-slate-200">指定背景 <span className="text-xs font-normal text-slate-500 ml-1">(可选)</span></h3>
                          </div>
                           <p className="text-xs text-slate-500 mb-3 h-8">上传1-2张背景图，统一视频场景风格。</p>
                          <div className="h-24">
                            <ImageUploader 
                                images={state.product.backgroundImages} 
                                onImagesChange={(imgs) => handleProductUpdate('backgroundImages', imgs)} 
                                onPreview={(url) => setPreviewMedia({url, type: 'image'})}
                                maxImages={2}
                                gridCols={2}
                                compact={true}
                            />
                          </div>
                      </div>

                      {/* Video */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Video size={18} className="text-green-400" />
                            <h3 className="text-sm font-bold text-slate-200">参考视频 <span className="text-xs font-normal text-slate-500 ml-1">(可选)</span></h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 h-8">分析视频节奏、风格，自动匹配分镜。</p>
                        <div className="h-24">
                            <VideoUploader 
                                video={state.product.referenceVideo}
                                onVideoChange={(v) => handleProductUpdate('referenceVideo', v)}
                            />
                        </div>
                      </div>
                  </div>

                  <div className="mt-auto pt-6">
                     <button 
                       onClick={startAnalysis}
                       disabled={state.isAnalyzing}
                       className="w-full py-5 bg-gradient-to-r from-brand-600 via-brand-500 to-blue-600 hover:from-brand-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-brand-900/40 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed group"
                     >
                        <BrainCircuit size={24} className="group-hover:animate-pulse" /> 
                        <span className="text-lg tracking-wide">启动 AI 智能创作流</span>
                     </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* STEP 2: WORKSPACE */}
          <div className={`${state.activeStep === 1 ? 'block' : 'hidden'} animate-in fade-in slide-in-from-right-8 duration-500`}>
             <div className="flex flex-col lg:flex-row gap-8">
                {/* Left: Strategy Panel */}
                <div className="lg:w-[350px] flex-shrink-0 space-y-6">
                   <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 sticky top-28 shadow-2xl">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                           <Bot className="text-brand-500" /> 专家团队分析报告
                        </h2>
                      </div>
                      
                      {state.analysis && (
                        <div className="space-y-6 text-sm">
                           <div className="bg-brand-900/20 p-4 rounded-lg border border-brand-500/20">
                              <h3 className="text-brand-400 font-bold uppercase text-xs mb-2 flex items-center gap-1">🎯 核心策略</h3>
                              <p className="text-slate-200 leading-relaxed font-medium">{state.analysis.strategy}</p>
                           </div>
                           
                           <div>
                              <h3 className="text-slate-500 font-bold uppercase text-xs mb-1">🎣 强钩子</h3>
                              <p className="text-white italic bg-slate-950 p-2 rounded border border-slate-800">"{state.analysis.hook}"</p>
                           </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-slate-500 font-bold uppercase text-xs mb-1">👥 目标受众</h3>
                                    <p className="text-slate-300 text-xs">{state.analysis.targetAudience}</p>
                                </div>
                                <div>
                                    <h3 className="text-slate-500 font-bold uppercase text-xs mb-1">🗣️ 配音角色</h3>
                                    <p className="text-brand-300 text-xs font-mono bg-slate-800 px-2 py-1 rounded inline-block">{state.analysis.assignedVoice}</p>
                                </div>
                            </div>
                           
                           <div>
                              <h3 className="text-slate-500 font-bold uppercase text-xs mb-1">💡 卖点提炼</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.sellingPoints}</p>
                           </div>
                        </div>
                      )}
                   </div>
                </div>

                {/* Right: Storyboard */}
                <div className="flex-1 space-y-6">
                   <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur">
                     <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-white">分镜脚本</h2>
                        <span className="text-xs px-2 py-1 bg-brand-900/50 text-brand-300 rounded border border-brand-500/30">
                            共 {state.storyboard.length} 个镜头
                        </span>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-400">当前模式:</span>
                        <div className="text-sm px-3 py-1 bg-slate-800 rounded-full text-white border border-slate-700 font-medium shadow-sm">
                           {VIDEO_MODES.find(m => m.value === state.settings.videoMode)?.label}
                        </div>
                     </div>
                   </div>

                   <Storyboard 
                     scenes={state.storyboard} 
                     videoMode={state.settings.videoMode}
                     aspectRatio={state.settings.aspectRatio}
                     resolution={state.settings.imageResolution}
                     productImages={state.product.images}
                     modelImages={state.product.modelImages}
                     backgroundImages={state.product.backgroundImages}
                     assignedVoice={state.analysis?.assignedVoice || 'Kore'}
                     onUpdateScene={updateScene}
                     onPreview={(url, type) => setPreviewMedia({url, type})}
                   />
                </div>
             </div>
          </div>
        </main>

        {/* Media Modal */}
        {previewMedia && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setPreviewMedia(null)}>
             <button className="absolute top-6 right-6 text-white hover:text-brand-500 p-2 transition-colors">
               <X size={40} />
             </button>
             <div className="max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border border-slate-800 bg-black relative" onClick={e => e.stopPropagation()}>
               {previewMedia.type === 'image' ? (
                 <img src={previewMedia.url} className="max-h-[85vh] w-auto object-contain mx-auto" />
               ) : (
                  <div className="bg-slate-900 p-20 rounded-xl flex flex-col items-center gap-4">
                     <div className="w-20 h-20 rounded-full bg-brand-600 flex items-center justify-center animate-pulse">
                        <div className="w-full h-1 bg-white mx-4 rounded-full"></div>
                     </div>
                     <audio src={previewMedia.url} controls className="w-96" />
                     <a 
                       href={previewMedia.url}
                       download="preview-audio.wav"
                       className="flex items-center gap-2 text-brand-400 hover:text-white"
                     >
                       <Download size={16} /> 下载音频
                     </a>
                  </div>
               )}
             </div>
          </div>
        )}
      </div>
    </HashRouter>
  );
}

export default App;
