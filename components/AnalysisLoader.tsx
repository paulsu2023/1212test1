
import React, { useEffect, useRef, useState } from 'react';

const MATH_SYMBOLS = [
  '∑', '∫', 'π', '∞', '√', '≈', '≠', '∆', 'Ω',
  '🌸', '🦁', '🌿', '🦋', '🧬', '🪐',
  '⚛️', '🎬', '🎯', '🛒', '📦', '✨'
];

const WORDS = ["IMAGINE", "CREATE", "RENDER", "LIGHT", "COLOR", "TIKTOK", "VIRAL", "MAGIC"];

interface Props {
  mode?: 'analysis' | 'generation'; // Analysis = Math/Scan, Generation = Words/Particles
  variant?: 'fullscreen' | 'contained'; // Fullscreen overlay or Contained in a div
}

export const AnalysisLoader: React.FC<Props> = ({ mode = 'analysis', variant = 'fullscreen' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState("");

  const ANALYSIS_MSGS = [
    "正在扫描产品多维特征...",
    "调用 Gemini 3.0 Pro 深度神经网络...",
    "营销大师正在构思爆款钩子...",
    "导演正在规划运镜轨迹...",
    "计算视觉情感张力...",
    "正在生成最终分镜脚本..."
  ];

  const GEN_MSGS = [
    "正在构建3D场景...",
    "AI 粒子加速渲染中...",
    "增强光影质感...",
    "优化视觉细节...",
  ];

  useEffect(() => {
    const msgs = mode === 'analysis' ? ANALYSIS_MSGS : GEN_MSGS;
    setCurrentMessage(msgs[0]);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) return 98;
        const increment = prev > 80 ? 0.5 : 1.5;
        return prev + increment;
      });
    }, 100);

    const msgInterval = setInterval(() => {
      setCurrentMessage(prev => {
        const idx = msgs.indexOf(prev);
        return msgs[(idx + 1) % msgs.length];
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(msgInterval);
    };
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationId: number;

    const resize = () => {
        if (variant === 'fullscreen') {
            width = window.innerWidth;
            height = window.innerHeight;
        } else {
            // Use parent container dimensions
             width = containerRef.current?.parentElement?.clientWidth || 300;
             height = containerRef.current?.parentElement?.clientHeight || 300;
        }
        canvas.width = width;
        canvas.height = height;
    };

    // Initial resize
    resize();

    // Resize observer for contained mode
    const resizeObserver = new ResizeObserver(resize);
    if (containerRef.current?.parentElement) {
        resizeObserver.observe(containerRef.current.parentElement);
    }
    window.addEventListener('resize', resize);

    // INCREASE PARTICLE COUNT FOR SHOCKING EFFECT
    const isGeneration = mode === 'generation';
    const particleCount = variant === 'contained' 
        ? (isGeneration ? 100 : 40)  // Double count for contained generation
        : (isGeneration ? 400 : 200); // Double count for fullscreen generation
        
    const particles: Particle[] = [];
    const focalLength = variant === 'contained' ? 200 : 400;

    class Particle {
      x: number;
      y: number;
      z: number;
      text: string;
      color: string;
      size: number;
      rotation: number;
      rotationSpeed: number;
      isWord: boolean;
      speedZ: number;

      constructor() {
        this.x = (Math.random() - 0.5) * width * 3;
        this.y = (Math.random() - 0.5) * height * 3;
        this.z = Math.random() * 2000;
        
        this.isWord = isGeneration && Math.random() > 0.8;
        this.text = this.isWord 
            ? WORDS[Math.floor(Math.random() * WORDS.length)]
            : MATH_SYMBOLS[Math.floor(Math.random() * MATH_SYMBOLS.length)];

        // More vibrant, shocking colors for generation
        const genColors = ['#00ff9d', '#00e1ff', '#ff0055', '#ffee00', '#ffffff'];
        const analysisColors = ['#14b8a6', '#8b5cf6', '#f472b6', '#fbbf24', '#ffffff'];
        const colors = isGeneration ? genColors : analysisColors;

        this.color = colors[Math.floor(Math.random() * colors.length)];
        
        const baseSize = variant === 'contained' ? 12 : 24;
        this.size = this.isWord ? baseSize * 1.5 : (baseSize/2) + Math.random() * baseSize;
        
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        
        // Faster speed for generation "shock"
        this.speedZ = isGeneration ? 15 + Math.random() * 20 : 8; 
      }

      move() {
        this.z -= this.speedZ;
        
        if (mode === 'analysis') {
            const angle = 0.002;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const nx = this.x * cos - this.y * sin;
            const ny = this.x * sin + this.y * cos;
            this.x = nx;
            this.y = ny;
        } 
        
        // Swirling vortex effect for generation
        if (isGeneration && variant === 'contained') {
             const angle = 0.05; // Faster swirl
             const cos = Math.cos(angle);
             const sin = Math.sin(angle);
             const nx = this.x * cos - this.y * sin;
             const ny = this.x * sin + this.y * cos;
             this.x = nx;
             this.y = ny;
        }

        this.rotation += this.rotationSpeed;

        if (this.z <= 0) {
          this.z = 2000;
          this.x = (Math.random() - 0.5) * width * 3;
          this.y = (Math.random() - 0.5) * height * 3;
          // Randomly change text on reset
          if (isGeneration) {
             this.isWord = Math.random() > 0.8;
             this.text = this.isWord ? WORDS[Math.floor(Math.random() * WORDS.length)] : MATH_SYMBOLS[Math.floor(Math.random() * MATH_SYMBOLS.length)];
          }
        }
      }

      draw() {
        if (!ctx) return;
        const scale = focalLength / (focalLength + this.z);
        const x2d = this.x * scale + width / 2;
        const y2d = this.y * scale + height / 2;
        
        // Fade out as it gets very close to prevent jarring pop
        const alpha = Math.min(1, (1 - this.z / 2000) * 1.5) * (this.z < 100 ? this.z/100 : 1);
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x2d, y2d);
        ctx.rotate(this.rotation);
        
        ctx.font = this.isWord ? `bold ${this.size * scale}px Arial` : `${this.size * scale}px monospace`;
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Intense glow for generation
        ctx.shadowBlur = (this.isWord ? 30 : 15) * scale; 
        ctx.shadowColor = this.color;
        
        ctx.fillText(this.text, 0, 0);
        
        // Add extra sparkly dot if generating
        if (isGeneration && Math.random() > 0.95) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-2, -2, 4, 4);
        }

        ctx.restore();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height); 
      if (variant === 'contained') {
          // Darker, high contrast background for generation card
          ctx.fillStyle = isGeneration ? 'rgba(0,0,0,0.95)' : 'rgba(2, 6, 23, 0.9)';
          ctx.fillRect(0,0,width,height);
      } else {
          ctx.fillStyle = 'rgba(2, 6, 23, 0.2)';
          ctx.fillRect(0, 0, width, height);
      }
      
      particles.forEach(p => { p.move(); p.draw(); });
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      resizeObserver.disconnect();
    };
  }, [mode, variant]);

  // If contained, we return a simpler structure
  if (variant === 'contained') {
      return (
          <div ref={containerRef} className="absolute inset-0 z-20 overflow-hidden rounded-lg">
              <canvas ref={canvasRef} className="w-full h-full block" />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className={`font-bold text-xs animate-pulse tracking-widest ${mode === 'generation' ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'text-brand-400'}`}>
                    {currentMessage}
                 </span>
              </div>
          </div>
      )
  }

  // Fullscreen implementation
  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-dark-950">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-brand-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
          <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-brand-500/50 flex items-center justify-center shadow-lg relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-b from-brand-500/20 to-transparent opacity-50 animate-[scan_2s_linear_infinite]"></div>
             {mode === 'analysis' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 12v.01"/><path d="M12 16v.01"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
             ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
             )}
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
          {mode === 'analysis' ? 'AI 智能分析中' : 'AI 资源生成中'}
        </h2>
        
        <div className="h-8 mb-6 flex items-center justify-center">
            <span className="text-brand-300 font-mono text-sm animate-pulse">
            {currentMessage}
            </span>
        </div>

        <div className="w-full bg-slate-800/50 rounded-full h-2 mb-4 overflow-hidden border border-slate-700">
          <div 
            className="h-full bg-gradient-to-r from-brand-600 via-brand-400 to-purple-500 transition-all duration-300 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/50 blur-[2px]"></div>
          </div>
        </div>
      </div>
       <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
};
