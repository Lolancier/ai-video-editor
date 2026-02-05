import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Wand2, Loader2, Play, Download, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useStore';

const VideoGen: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [size, setSize] = useState('720P');
  const [imageUrl, setImageUrl] = useState('');
  // Use a strict type for batch results
  interface BatchResult {
    original_url: string;
    prompt?: string;
    video_url: string | null;
    audio_url?: string;
    status: 'pending' | 'processing' | 'success' | 'failed';
    error?: string;
    task_id?: string;
  }
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [isBatch, setIsBatch] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(-1);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = React.useRef(false);
  
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to wait
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Single task poller that returns a promise resolving to video URL or null
  const pollTaskUntilFinished = async (id: string): Promise<{ status: string, videoUrl?: string, error?: string }> => {
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        // Check for stop request
        if (stopRequestedRef.current) {
           clearInterval(interval);
           resolve({ status: 'failed', error: '已手动停止' });
           return;
        }

        try {
          const res = await api.get(`/api/video/status/${encodeURIComponent(id)}`);
          const data = res.data?.data;
          
          if (data && ['success', 'completed'].includes(data.status)) {
            clearInterval(interval);
            resolve({ status: 'success', videoUrl: data.video_url });
          } else if (data && data.status === 'failed') {
            clearInterval(interval);
            resolve({ status: 'failed', error: data.error || '生成失败' });
          } else if (!data) {
             // Handle unexpected response format
             console.warn('Invalid status response:', res.data);
          }
          // Continue polling if pending or processing
        } catch (err: any) {
           // Network error during polling - ignore and retry next tick, 
           // or count errors and fail eventually. For now, we just log.
           console.error('Poll error:', err);
        }
      }, 3000);
    });
  };

  const processBatchQueueRef = async (items: { url: string, prompt?: string, audio?: string }[], title?: string) => {
    // Initialize results
    const initialResults: BatchResult[] = items.map(item => ({
      original_url: item.url,
      prompt: item.prompt,
      video_url: null,
      audio_url: item.audio,
      status: 'pending',
    }));
    setBatchResults(initialResults);
    stopRequestedRef.current = false;
    setStopRequested(false);
    
    // Helper for retry logic
    const retryApiCall = async (fn: () => Promise<any>, retries = 3, delay = 2000) => {
      let lastError: any;
      
      for (let i = 0; i < retries; i++) {
        // Check stop before retry attempt
        if (stopRequestedRef.current) throw new Error('已手动停止');
        
        try {
          const result = await fn();
          // Ensure we have a valid result data structure before considering it a success
          // If result.data is null/undefined, treat as failure and retry
          if (!result || !result.data) {
             throw new Error('API returned empty response');
          }
          return result;
        } catch (err: any) {
          console.warn(`Attempt ${i + 1} failed:`, err.message);
          lastError = err;
          
          if (i === retries - 1) break;
          
          // Check stop before wait
          if (stopRequestedRef.current) throw new Error('已手动停止');
          
          // Exponential backoff or simple delay
          await wait(delay * (i + 1));
        }
      }
      throw lastError || new Error('Request failed after retries');
    };
    
    for (let i = 0; i < items.length; i++) {
      if (stopRequestedRef.current) {
         // Mark remaining as canceled? Or just stop.
         setBatchResults(prev => prev.map((res, idx) => 
            idx >= i ? { ...res, status: 'failed', error: '已手动停止' } : res
         ));
         break;
      }

      setCurrentBatchIndex(i);
      const item = items[i];
      // Append title to the first item's prompt if it exists
      let currentPrompt = item.prompt || prompt; 
      if (i === 0 && title) {
          currentPrompt = `画面中央有标题：${title}，从0s就有标题字出现。${currentPrompt}`;
      }
      
      // Update status to processing
      setBatchResults(prev => prev.map((res, idx) => 
        idx === i ? { ...res, status: 'processing', prompt: currentPrompt } : res
      ));

      try {
        // 1. Submit task with retry
        // Increase retries to 10 for network congestion scenarios
        const response = await retryApiCall(() => api.post('/api/video/generate', {
          prompt: currentPrompt,
          image_url: item.url, // Single mode
          aspect_ratio: aspectRatio,
          size,
        }), 10, 3000); // 10 retries, starting with 3s delay (increasing)
        
        const data = response?.data;
        
        if (data?.status === 'success' && data?.data?.id) {
           const taskId = data.data.id;
           
           // Update task id
           setBatchResults(prev => prev.map((res, idx) => 
             idx === i ? { ...res, task_id: taskId } : res
           ));

           // 2. Poll until finished
           // We also need to support stopping during polling
           const result = await pollTaskUntilFinished(taskId);
           
           // 3. Update final result
           setBatchResults(prev => prev.map((res, idx) => 
             idx === i ? { 
               ...res, 
               status: result.status as any,
               video_url: result.videoUrl || null,
               error: result.error
             } : res
           ));

        } else {
           throw new Error('Task creation failed');
        }

      } catch (e: any) {
        console.error(`Failed to process ${item.url}`, e);
        setBatchResults(prev => prev.map((res, idx) => 
           idx === i ? { ...res, status: 'failed', error: e.message || '请求失败' } : res
        ));
      }

      // Wait a bit before next task to be safe
      await wait(1000);
    }
    
    setLoading(false);
    setCurrentBatchIndex(-1);
    setStopRequested(false);
  };

  const handleStop = () => {
     stopRequestedRef.current = true;
     setStopRequested(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Allow empty prompt if we are in batch mode with individual prompts
    // But for now let's just bypass the check if we detect batch input in other fields
    
    if (loading) return; // Prevent double submit

    setLoading(true);
    setError(null);
    setTaskId(null);
    setVideoUrl(null);
    setBatchResults([]);
    setIsBatch(false);
    setStatus('submitting');
    stopRequestedRef.current = false;
    setStopRequested(false);

    try {
      // 2. Parse Prompt input (support JSON with infos, infos1, url_list, title)
      const trimmedPrompt = prompt.trim();
      let promptList: string[] = [];
      let audioList: string[] = [];
      let jsonUrlList: string[] = [];
      let title = '';
      let hasBatchPrompt = false;

      // Check for batch prompt / full JSON
      if (trimmedPrompt.startsWith('{')) {
         try {
            // Clean trailing commas before parsing
            // Regex to remove trailing commas before closing braces/brackets
            const cleanJson = trimmedPrompt.replace(/,(\s*[}\]])/g, '$1');
            const json = JSON.parse(cleanJson);
            
            // Extract texts
            if (json.infos && Array.isArray(json.infos)) {
               promptList = json.infos;
               hasBatchPrompt = true;
            }
            
            // Extract audios
            if (json.infos1 && Array.isArray(json.infos1)) {
               audioList = json.infos1;
            }

            // Extract URLs from prompt box if present
            if (json.url_list && Array.isArray(json.url_list)) {
               jsonUrlList = json.url_list.map((u: string) => u.replace(/`/g, '').trim());
            }

            // Extract title
            if (json.title && Array.isArray(json.title) && json.title.length > 0) {
                title = json.title[0];
            }
         } catch (e) {
            // Not a valid JSON, treat as normal prompt
         }
      }

      // 1. Parse Image URL input (support JSON with url_list)
      // If url_list was found in prompt JSON, use that. Otherwise check imageUrl field.
      const trimmedUrl = imageUrl.trim();
      let urlList: string[] = [];
      
      if (jsonUrlList.length > 0) {
          urlList = jsonUrlList;
      } else if (trimmedUrl.startsWith('{') || trimmedUrl.includes('\n') || (trimmedUrl.includes(',') && trimmedUrl.includes('http'))) {
        try {
          if (trimmedUrl.startsWith('{')) {
             const cleanJson = trimmedUrl.replace(/,(\s*[}\]])/g, '$1');
             const json = JSON.parse(cleanJson);
             if (json.url_list && Array.isArray(json.url_list)) {
               urlList = json.url_list;
             }
          } else {
             // Split by newline or comma, handle backticks and spaces
             urlList = trimmedUrl.split(/[\n,]+/)
               .map(u => u.replace(/`/g, '').trim())
               .filter(u => u && u.startsWith('http'));
          }
        } catch (e) {
          // Fallback to simple string
        }
      }

      let isBatchMode = urlList.length > 0;

      if (isBatchMode) {
        setIsBatch(true);
        
        // Match prompts with URLs
        const items = urlList.map((url, idx) => ({
           url,
           prompt: hasBatchPrompt ? (promptList[idx] || promptList[0] || "") : trimmedPrompt,
           audio: audioList[idx] // Store audio for later use
        }));

        // Start client-side serial processing
        processBatchQueueRef(items, title);
        return; // Return early
      }

      if (hasBatchPrompt && !isBatchMode) {
         setError("检测到批量提示词，但未检测到批量图片链接。请同时提供批量图片链接。");
         setLoading(false);
         return;
      }
      
      if (!prompt) {
          setError("请输入提示词");
          setLoading(false);
          return;
      }

      // Single mode normal flow
      const payload = {
        prompt: trimmedPrompt,
        image_url: trimmedUrl || undefined,
        aspect_ratio: aspectRatio,
        size,
      };

      const response = await api.post('/api/video/generate', payload);
      const data = response?.data;
      
      if (data?.status === 'success' && data?.data?.id) {
        setTaskId(data.data.id);
        setStatus(data.data.status);
        pollStatus(data.data.id);
      } else {
        setError('生成任务创建失败');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Generation failed:', err);
      // Safety check for response data access
      const detail = err?.response?.data?.detail;
      setError(detail || '请求失败，请稍后重试');
      setLoading(false);
    }
  };

  // Remove old pollBatchStatus as we use pollTaskUntilFinished now
  
  const pollStatus = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/video/status/${encodeURIComponent(id)}`);
        const data = res.data?.data;
        
        if (data) {
           setStatus(data.status);
    
           if (['success', 'completed'].includes(data.status)) {
             clearInterval(interval);
             setLoading(false);
             // The video URL is in data.video_url
             setVideoUrl(data.video_url); 
           } else if (data.status === 'failed') {
             clearInterval(interval);
             setLoading(false);
             setError(data.error || '生成失败');
           }
        }
      } catch (err) {
        console.error('Poll failed:', err);
        // Don't stop polling immediately on network error, maybe transient
      }
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">AI 视频生成</h1>
        <p className="text-slate-500">输入提示词，让 AI 为你创造精彩视频</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                提示词 (Prompt)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={'描述你想要生成的视频内容，例如：一只可爱的小猫...\n或粘贴 JSON 批量提示词：\n{\n  "infos": [\n    "提示词1",\n    "提示词2"\n  ]\n}'}
                className="w-full h-32 px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                参考图片 URL (可选)
              </label>
              <textarea
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder={'输入单张图片 URL，或 JSON 格式的 url_list，例如：\n{\n  "url_list": [\n    "http://..."\n  ]\n}'}
                className="w-full px-4 py-2 h-24 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  画面比例
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="16:9">16:9 (横屏)</option>
                  <option value="9:16">9:16 (竖屏)</option>
                  <option value="3:2">3:2 (标准)</option>
                  <option value="1:1">1:1 (方形)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  分辨率
                </label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="720P">720P</option>
                  <option value="1080P">1080P</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !prompt}
              className={`w-full py-3 px-4 rounded-lg flex items-center justify-center space-x-2 font-medium text-white transition-colors
                ${loading || !prompt 
                  ? 'bg-slate-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>开始生成</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Preview/Result Section */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-[400px]">
          {error ? (
            <div className="text-center text-red-600 space-y-2">
              <AlertCircle className="w-12 h-12 mx-auto" />
              <p>{error}</p>
            </div>
          ) : isBatch ? (
             <div className="w-full space-y-4 max-h-[800px] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">批量生成结果 ({batchResults.length})</h3>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-slate-500">
                       {loading ? `正在处理: ${currentBatchIndex + 1}/${batchResults.length}` : '处理完成'}
                    </div>
                    {loading && (
                      <button
                        onClick={handleStop}
                        className="text-xs px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 font-medium transition-colors"
                      >
                        停止生成
                      </button>
                    )}
                  </div>
                </div>

                {/* JSON Output Area */}
                {!loading && batchResults.some(r => r.status === 'success') && (
                  <div className="mb-6 bg-slate-900 rounded-lg p-4 overflow-hidden">
                    <div className="flex justify-between items-center mb-2 text-slate-400 text-xs">
                       <span>JSON 结果 (仅包含成功项)</span>
                       <button 
                         onClick={() => {
                           const successResults = batchResults
                             .filter(r => r.status === 'success' && r.video_url)
                             .map(r => ({ 
                               text: r.prompt,
                               audio_url: r.audio_url,
                               video_url: r.video_url,
                             }));
                           navigator.clipboard.writeText(JSON.stringify(successResults, null, 2));
                         }}
                         className="hover:text-white transition-colors"
                       >
                         复制代码
                       </button>
                    </div>
                    <pre className="text-xs text-green-400 overflow-x-auto font-mono max-h-40">
                      {JSON.stringify(batchResults
                        .filter(r => r.status === 'success' && r.video_url)
                        .map(r => ({ 
                           text: r.prompt,
                           audio_url: r.audio_url,
                           video_url: r.video_url 
                        })), null, 2)}
                    </pre>
                  </div>
                )}

                {batchResults.map((result, idx) => (
                  <div key={idx} className={`bg-white p-4 rounded-lg shadow-sm border mb-4 transition-colors ${
                    result.status === 'processing' ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-100'
                  }`}>
                     <div className="text-xs text-slate-500 mb-2 truncate" title={result.original_url}>
                        <span className="font-semibold text-slate-700">图片:</span> {result.original_url}
                     </div>
                     {result.prompt && (
                        <div className="text-xs text-slate-500 mb-2 truncate" title={result.prompt}>
                           <span className="font-semibold text-slate-700">提示词:</span> {result.prompt}
                        </div>
                     )}
                     
                     {result.status === 'failed' ? (
                        <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
                           失败: {result.error}
                        </div>
                     ) : (
                        <div>
                           <div className="flex justify-between items-center mb-2">
                              <span className={`text-sm font-medium ${
                                 result.status === 'success' ? 'text-green-600' :
                                 result.status === 'processing' ? 'text-blue-600' : 'text-slate-400'
                              }`}>
                                 状态: {
                                   result.status === 'success' ? '完成' : 
                                   result.status === 'processing' ? '生成中...' : 
                                   '等待中'
                                 }
                              </span>
                           </div>
                           
                           {result.video_url ? (
                              <div className="space-y-2">
                                <video 
                                  src={result.video_url} 
                                  controls 
                                  className="w-full h-48 object-contain bg-black rounded"
                                />
                                <div className="flex gap-2">
                                   <input 
                                     type="text" 
                                     readOnly 
                                     value={result.video_url} 
                                     className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded px-2 text-slate-600"
                                     onClick={(e) => e.currentTarget.select()}
                                   />
                                   <a
                                     href={result.video_url}
                                     target="_blank"
                                     rel="noreferrer"
                                     className="text-center text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                   >
                                     下载
                                   </a>
                                </div>
                              </div>
                           ) : (
                              <div className="flex items-center justify-center h-24 bg-slate-50 rounded border border-dashed border-slate-200">
                                 {result.status === 'processing' ? (
                                    <div className="flex flex-col items-center gap-2">
                                       <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                       <span className="text-xs text-slate-500">AI 正在努力生成中...</span>
                                    </div>
                                 ) : (
                                    <span className="text-slate-400 text-xs">等待处理</span>
                                 )}
                              </div>
                           )}
                        </div>
                     )}
                  </div>
                ))}
             </div>
          ) : videoUrl ? (
            <div className="w-full space-y-4">
              <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
                <video 
                  src={videoUrl} 
                  controls 
                  className="w-full h-full object-contain"
                  poster={imageUrl} // Use input image as poster if available
                />
              </div>
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center w-full py-3 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium"
              >
                <Download className="w-5 h-5 mr-2" />
                下载视频
              </a>
            </div>
          ) : loading ? (
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-slate-900">正在生成视频</h3>
                <p className="text-slate-500 text-sm mt-1">
                  当前状态: {status === 'processing' ? '处理中...' : status === 'pending' ? '排队中...' : status}
                </p>
                <p className="text-slate-400 text-xs mt-4">这可能需要几分钟时间，请耐心等待</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 space-y-4">
              <Video className="w-16 h-16 mx-auto opacity-50" />
              <p>在左侧输入提示词开始生成预览</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoGen;
