import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, Download, ArrowLeft, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface TaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result_url: string | null;
  error_message: string | null;
}

const Result: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let pollInterval: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const response = await api.get(`/api/video/task/${taskId}`);
        setTask(response.data);

        if (response.data.status === 'completed' || response.data.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (err: any) {
        console.error('Fetch status failed:', err);
        setError('无法获取任务状态');
        clearInterval(pollInterval);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 2 seconds
    pollInterval = setInterval(fetchStatus, 2000);

    return () => clearInterval(pollInterval);
  }, [taskId]);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
        <AlertCircle className="w-5 h-5 mr-2" />
        {error}
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回首页
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              {task.status === 'completed' ? '剪辑完成' : '正在处理视频...'}
            </h1>
            <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center
              ${task.status === 'completed' ? 'bg-green-100 text-green-700' :
                task.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'}`}>
              {task.status === 'completed' ? <CheckCircle className="w-4 h-4 mr-1" /> :
                task.status === 'failed' ? <AlertCircle className="w-4 h-4 mr-1" /> :
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {task.status === 'pending' ? '等待中' :
                task.status === 'processing' ? '处理中' :
                  task.status === 'completed' ? '已完成' : '失败'}
            </div>
          </div>

          {task.status !== 'completed' && task.status !== 'failed' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>处理进度</span>
                <span>{task.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${task.progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-slate-400 mt-4 text-center">
                AI 正在分析视频内容并执行剪辑指令，请稍候...
              </p>
            </div>
          )}

          {task.status === 'failed' && (
            <div className="bg-red-50 p-4 rounded-lg text-red-700 text-sm">
              <p className="font-medium">任务处理失败</p>
              <p>{task.error_message || '未知错误，请重试'}</p>
            </div>
          )}
        </div>

        {task.status === 'completed' && task.result_url && (
          <div className="p-8 bg-slate-50">
            <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-md mb-6 flex items-center justify-center">
              {(task.format === 'mp3' || task.result_url.endsWith('.mp3')) ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white">
                  <div className="mb-4 text-6xl">🎵</div>
                  <audio
                    src={task.result_url}
                    controls
                    crossOrigin="anonymous"
                    preload="auto"
                    className="w-3/4"
                  >
                    您的浏览器不支持音频播放。
                  </audio>
                </div>
              ) : (
                <video
                  src={task.result_url}
                  controls
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain"
                >
                  您的浏览器不支持视频播放。
                </video>
              )}
            </div>

            <div className="flex justify-center space-x-4">
              <a
                href={task.result_url}
                download={`edited_result_${task.task_id}.${task.result_url.split('.').pop()}`}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                <Download className="w-5 h-5 mr-2" />
                下载结果
              </a>
              <Link
                to="/upload"
                className="inline-flex items-center px-6 py-3 border border-slate-300 text-base font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                剪辑新视频
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Result;
