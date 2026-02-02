import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useStore';
import { Wand2, Play, AlertCircle, Loader2, Zap } from 'lucide-react';
import { api } from '../lib/api';

const Edit: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!videoId || !user) return;

    const fetchVideo = async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .eq('id', videoId)
          .single();

        if (error) throw error;
        setVideo(data);
      } catch (err: any) {
        setError('无法加载视频信息');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId, user]);

  const handleSubmit = async () => {
    if (!prompt.trim() || !user || !video) return;

    setSubmitting(true);
    try {
      const response = await api.post('/api/video/edit', {
        video_id: video.id,
        user_id: user.id,
        prompt: prompt,
      });

      // Navigate to result/processing page with the new task ID
      navigate(`/result/${response.data.task_id}`);
    } catch (err: any) {
      console.error('Task creation failed:', err);
      setError('创建任务失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const addQuickAction = (text: string) => {
    setPrompt((prev) => {
      const prefix = prev.trim() ? prev + '\n' : '';
      return prefix + text;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="max-w-4xl mx-auto p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
        <AlertCircle className="w-5 h-5 mr-2" />
        {error || '未找到视频'}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Video Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black rounded-xl overflow-hidden aspect-video relative shadow-lg">
            {/* Since we are in local mode, we might not be able to stream the video directly from the backend easily without setting up static file serving properly. 
                For now, we show a placeholder or try to serve it if possible. 
                In a real app, this would be a URL to Supabase Storage or CDN. 
            */}
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 bg-slate-900">
              {/* 
                  To make this work locally, we need the backend to serve the 'uploads' directory.
                  Let's assume we will add static file serving to the backend.
               */}
              <video
                src={`http://localhost:8000/uploads/${video.id}.${video.format}`}
                poster={`http://localhost:8000/uploads/${video.id}.jpg`}
                preload="none"
                controls
                className="w-full h-full object-contain"
              >
                您的浏览器不支持视频播放。
              </video>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-2">{video.filename}</h2>
            <div className="flex space-x-4 text-sm text-slate-500">
              <span>格式: {video.format.toUpperCase()}</span>
              <span>大小: {(video.file_size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </div>
        </div>

        {/* Right Column: AI Controls */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 sticky top-24">
            <div className="flex items-center space-x-2 mb-6">
              <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                <Wand2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">AI 剪辑指令</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-slate-700 mb-2">
                  你想怎么剪辑这个视频？
                </label>
                <textarea
                  id="prompt"
                  rows={6}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border"
                  placeholder="例如：&#10;1. 剪掉前 5 秒的静音部分&#10;2. 为视频添加一段欢快的背景音乐&#10;3. 将视频加速 1.5 倍"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => addQuickAction("将视频加速 2 倍")}
                  className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 focus:outline-none"
                >
                  <Zap className="w-3 h-3 mr-1 text-yellow-500" />
                  加速 2x
                </button>
                <button
                  onClick={() => addQuickAction("将视频减速至 0.5 倍")}
                  className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 focus:outline-none"
                >
                  <Zap className="w-3 h-3 mr-1 text-blue-500" />
                  慢放 0.5x
                </button>
                <button
                  onClick={() => addQuickAction("提取视频中的音频")}
                  className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 focus:outline-none"
                >
                  <Zap className="w-3 h-3 mr-1 text-purple-500" />
                  提取音频
                </button>
                <button
                  onClick={() => addQuickAction("移除视频声音")}
                  className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 focus:outline-none"
                >
                  <Zap className="w-3 h-3 mr-1 text-red-500" />
                  静音
                </button>
                <button
                  onClick={() => addQuickAction("自动检测场景并添加转场")}
                  className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 focus:outline-none"
                >
                  <Zap className="w-3 h-3 mr-1 text-green-500" />
                  智能分镜
                </button>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !prompt.trim()}
                  className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      正在创建任务...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      开始 AI 剪辑
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 mt-6">
                <h3 className="text-sm font-medium text-blue-900 mb-2">💡 提示示例</h3>
                <ul className="text-sm text-blue-700 space-y-2 list-disc list-inside">
                  <li>提取视频中的精彩高光时刻</li>
                  <li>生成适配 TikTok 的竖屏短视频</li>
                  <li>自动添加中文字幕</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Edit;
