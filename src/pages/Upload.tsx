import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Upload as UploadIcon,
  FileVideo,
  CheckCircle,
  AlertCircle,
  Loader2,
  LayoutGrid,
  List,
  Clock,
  Trash2,
  FolderOpen,
  Plus,
  Play,
  Music
} from 'lucide-react';
import { useAuthStore } from '../store/useStore';
import { uploadVideo, api } from '../lib/api';
import { supabase } from '../lib/supabase';

// Sidebar Component
const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => {
  const menuItems = [
    { id: 'uploads', label: '我的素材', icon: FolderOpen },
    { id: 'creations', label: '生成结果', icon: FileVideo },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 hidden md:block">
      <div className="space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === item.id
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
          >
            <item.icon className={`mr-3 h-5 w-5 ${activeTab === item.id ? 'text-blue-500' : 'text-slate-400'}`} />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Video Card Component
const VideoCard = ({ video, onClick, onDelete }: { video: any, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer"
    >
      <div className="aspect-video bg-slate-100 relative">
        {imageError ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <FileVideo className="w-8 h-8" />
          </div>
        ) : (
          <img
            src={`http://localhost:8000/uploads/${video.id}.jpg`}
            alt={video.filename}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="bg-white/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
            <FileVideo className="w-6 h-6 text-slate-700" />
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          title="删除素材"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-slate-900 truncate" title={video.filename}>
          {video.filename}
        </h3>
        <div className="flex items-center mt-1 text-xs text-slate-500">
          <Clock className="w-3 h-3 mr-1" />
          <span>{(video.file_size / 1024 / 1024).toFixed(2)} MB</span>
          <span className="mx-1">•</span>
          <span>{new Date(video.created_at || video.uploaded_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

// Creation Card Component
const CreationCard = ({ task, onClick, onDelete }: { task: any, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) => {
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  // Use format from backend if available, otherwise check url extension
  const isAudio = task.format === 'mp3' || task.result_url?.endsWith('.mp3');

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer"
    >
      <div className="aspect-video bg-slate-100 relative flex items-center justify-center">
        {isCompleted ? (
          isAudio ? (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white">
              <Music className="w-10 h-10" />
            </div>
          ) : (
            <video
              src={task.result_url}
              className="w-full h-full object-cover"
              preload="metadata"
              crossOrigin="anonymous"
            />
          )
        ) : isFailed ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-400">
            <AlertCircle className="w-8 h-8 mb-2" />
            <span className="text-xs">处理失败</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-xs">处理中...</span>
          </div>
        )}

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          title="删除记录"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-slate-900 truncate" title={task.prompt}>
          {task.prompt || "无指令"}
        </h3>
        <p className="text-xs text-slate-500 mt-1 truncate">源: {task.original_filename}</p>
        <div className="flex items-center justify-between mt-2">
          <div className={`text-xs px-2 py-0.5 rounded-full ${isCompleted ? 'bg-green-100 text-green-700' :
            isFailed ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>
            {isCompleted ? '完成' : isFailed ? '失败' : '进行中'}
          </div>
          <span className="text-xs text-slate-400">{new Date(task.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

const Upload: React.FC = () => {
  const [activeTab, setActiveTab] = useState('uploads');
  const [videos, setVideos] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload States
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Fetch Data
  const fetchData = useCallback(async (isPolling = false) => {
    if (!user) return;
    if (!isPolling) setLoading(true);
    try {
      if (activeTab === 'uploads') {
        // Only sync on initial load, not polling (too heavy)
        if (!isPolling) {
          await api.post(`/api/video/sync?user_id=${user.id}`);
        }
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .eq('user_id', user.id)
          .order('uploaded_at', { ascending: false });
        if (error) throw error;
        setVideos(data || []);
      } else {
        // Fetch tasks
        const res = await api.get(`/api/video/tasks?user_id=${user.id}`);
        setTasks(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling for tasks
  useEffect(() => {
    if (activeTab !== 'creations') return;

    const interval = setInterval(() => {
      fetchData(true);
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [activeTab, fetchData]);

  // Actions
  const handleDeleteVideo = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这个视频素材吗？这将同时删除相关联的编辑记录。')) return;

    try {
      await api.delete(`/api/video/${videoId}`);
      fetchData(); // Refresh
    } catch (err) {
      console.error('Delete failed:', err);
      alert('删除失败，请重试');
    }
  };

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这条生成记录吗？')) return;

    try {
      await api.delete(`/api/video/task/${taskId}`);
      fetchData(); // Refresh
    } catch (err) {
      console.error('Delete failed:', err);
      alert('删除失败，请重试');
    }
  };

  // Upload Logic
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    if (!user) return;

    setUploading(true);
    setProgress(0);
    setUploadError(null);

    try {
      const result = await uploadVideo(file, user.id, (p) => setProgress(p));
      console.log('Upload success:', result);
      await fetchData();
      setUploading(false);
      setShowUploadModal(false);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.detail || '上传失败，请重试');
      setUploading(false);
    }
  }, [user, fetchData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.mkv'] },
    maxFiles: 1,
    disabled: uploading
  });

  return (
    <div className="flex bg-slate-50 min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {activeTab === 'uploads' ? '我的素材库' : '生成结果'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === 'uploads' ? '管理您上传的所有视频素材' : '查看所有 AI 剪辑生成的视频'}
            </p>
          </div>
          {activeTab === 'uploads' && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              上传新素材
            </button>
          )}
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {activeTab === 'uploads' && (
              videos.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-300">
                  <div className="mx-auto h-12 w-12 text-slate-400 flex items-center justify-center rounded-full bg-slate-100 mb-4">
                    <FileVideo className="h-6 w-6" />
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-slate-900">暂无素材</h3>
                  <p className="mt-1 text-sm text-slate-500">上传您的第一个视频开始创作</p>
                  <div className="mt-6">
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      立即上传
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {videos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onClick={() => navigate(`/edit/${video.id}`)}
                      onDelete={(e) => handleDeleteVideo(e, video.id)}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'creations' && (
              tasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>还没有生成记录，快去剪辑视频吧！</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {tasks.map((task) => (
                    <CreationCard
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/result/${task.id}`)}
                      onDelete={(e) => handleDeleteTask(e, task.id)}
                    />
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Upload Modal Overlay */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background backdrop */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => !uploading && setShowUploadModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    上传视频
                  </h3>
                  <div className="mt-4">
                    <div
                      {...getRootProps()}
                      className={`
                        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}
                        ${uploading ? 'pointer-events-none opacity-50' : ''}
                        `}
                    >
                      <input {...getInputProps()} />
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <UploadIcon className={`w-10 h-10 ${isDragActive ? 'text-blue-500' : 'text-slate-400'}`} />
                        <p className="text-sm text-slate-600">
                          {isDragActive ? '释放文件以开始上传' : '点击或拖拽视频到此处'}
                        </p>
                      </div>
                    </div>

                    {uploadError && (
                      <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        {uploadError}
                      </div>
                    )}

                    {uploading && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{progress < 100 ? '上传中...' : '处理中...'}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
