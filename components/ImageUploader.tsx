
import React, { useRef } from 'react';
import { Upload, X, Maximize2, Video, Film } from 'lucide-react';

interface Props {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onPreview: (img: string) => void;
  maxImages?: number;
  gridCols?: number;
  label?: string;
  compact?: boolean; // If true, shows grid immediately instead of large dropzone
}

export const ImageUploader: React.FC<Props> = ({ 
    images, 
    onImagesChange, 
    onPreview, 
    maxImages = 8, 
    gridCols = 8, 
    label,
    compact = true 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages: string[] = [];
      const files = Array.from(e.target.files);

      let processedCount = 0;
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          newImages.push(base64);
          processedCount++;
          if (processedCount === files.length) {
            onImagesChange([...images, ...newImages].slice(0, maxImages));
          }
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const removeImage = (index: number) => {
    const newImgs = [...images];
    newImgs.splice(index, 1);
    onImagesChange(newImgs);
  };

  const showLargeDropzone = !compact && images.length === 0;

  return (
    <div className="w-full flex flex-col h-full">
      {label && <div className="text-xs font-bold text-slate-500 uppercase mb-2">{label} <span className="text-slate-600 font-normal">({images.length}/{maxImages})</span></div>}
      
      {showLargeDropzone ? (
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 border-2 border-dashed border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors bg-slate-800/50 group min-h-[120px]"
        >
            <div className="bg-slate-700 p-2 rounded-full mb-2 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5 text-brand-500" />
            </div>
            <p className="text-slate-300 font-medium text-sm">点击上传</p>
            <p className="text-slate-500 text-xs mt-1">JPG, PNG</p>
        </div>
      ) : (
        <div className={`grid gap-2 h-full ${gridCols === 8 ? 'grid-cols-8' : gridCols === 4 ? 'grid-cols-4' : 'grid-cols-4'}`}>
          {Array.from({ length: maxImages }).map((_, idx) => {
            const img = images[idx];
            return (
                <div 
                    key={idx} 
                    className={`aspect-square relative group rounded-md overflow-hidden border border-slate-700 bg-black/50 ${!img ? 'border-dashed border-slate-700/50 hover:border-slate-500 cursor-pointer' : ''}`}
                    onClick={() => !img && fileInputRef.current?.click()}
                >
                {img ? (
                    <>
                    <img 
                        src={`data:image/jpeg;base64,${img}`} 
                        alt={`Upload ${idx}`} 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 backdrop-blur-sm z-10">
                        <button 
                        onClick={(e) => { e.stopPropagation(); onPreview(`data:image/jpeg;base64,${img}`); }}
                        className="p-1 bg-brand-600 hover:bg-brand-500 rounded text-white shadow-lg"
                        >
                        <Maximize2 size={10} />
                        </button>
                        <button 
                        onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                        className="p-1 bg-red-500/90 hover:bg-red-500 rounded text-white shadow-lg"
                        >
                        <X size={10} />
                        </button>
                    </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full w-full hover:bg-slate-800/50 transition-colors">
                        <Upload className="text-slate-700 w-4 h-4" />
                    </div>
                )}
                </div>
            );
          })}
        </div>
      )}

      <input 
        type="file" 
        multiple 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange}
      />
    </div>
  );
};

interface VideoProps {
    video: { data: string; mimeType: string } | null | undefined;
    onVideoChange: (video: { data: string; mimeType: string } | null) => void;
    label?: string;
}

export const VideoUploader: React.FC<VideoProps> = ({ video, onVideoChange, label }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                onVideoChange({
                    data: base64,
                    mimeType: file.type
                });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="w-full flex flex-col h-full">
             {label && <div className="text-xs font-bold text-slate-500 uppercase mb-2">{label}</div>}
             
             <div 
                onClick={() => !video && fileInputRef.current?.click()}
                className={`relative w-full h-full min-h-[100px] border border-slate-700 rounded-xl overflow-hidden bg-black/50 ${!video ? 'border-dashed cursor-pointer hover:border-brand-500 hover:bg-slate-800/50' : ''}`}
             >
                 {video ? (
                    <div className="relative w-full h-full group">
                        <video 
                            src={`data:${video.mimeType};base64,${video.data}`} 
                            className="w-full h-full object-cover"
                            controls={false}
                            muted
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm z-10">
                             <button 
                                onClick={(e) => { e.stopPropagation(); onVideoChange(null); }}
                                className="px-3 py-1.5 bg-red-500/90 hover:bg-red-500 rounded text-white text-xs font-bold flex items-center gap-2 shadow-lg"
                            >
                                <X size={14} /> Remove Video
                            </button>
                        </div>
                        <div className="absolute top-2 right-2 bg-brand-600 text-white text-[10px] px-2 py-0.5 rounded shadow">
                            REF
                        </div>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                        <div className="bg-slate-800 p-2 rounded-full">
                            <Video size={18} className="text-slate-400" />
                        </div>
                        <span className="text-xs">上传参考视频 (MP4)</span>
                    </div>
                 )}
             </div>

             <input 
                type="file" 
                accept="video/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
            />
        </div>
    )
}