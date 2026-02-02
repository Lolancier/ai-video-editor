import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Video, Wand2, Share2 } from 'lucide-react';
import { useAuthStore } from '../store/useStore';

const Home: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-24 pb-12">
      {/* Hero Section */}
      <section className="text-center space-y-8 pt-12">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
          AI 智能驱动的
          <span className="text-blue-600 block mt-2">视频自动剪辑助手</span>
        </h1>
        <p className="max-w-2xl mx-auto text-xl text-slate-500">
          只需一句指令，AI 帮你完成剪辑、配乐、字幕。让视频创作变得前所未有的简单。
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to={user ? "/upload" : "/register"}
            className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:text-lg md:px-10"
          >
            {user ? '开始创作' : '免费试用'}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
          {!user && (
            <Link
              to="/login"
              className="inline-flex items-center px-8 py-3 border border-slate-300 text-base font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 md:text-lg md:px-10"
            >
              登录
            </Link>
          )}
        </div>
      </section>

      {/* Feature Section */}
      <section className="grid md:grid-cols-3 gap-12 px-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
            <Video className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">智能素材分析</h3>
          <p className="text-slate-500">
            自动识别视频内容、场景和语音，精准定位精彩片段。
          </p>
        </div>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto text-purple-600">
            <Wand2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">自然语言指令</h3>
          <p className="text-slate-500">
            "剪掉静音部分，添加欢快背景音乐"，像对话一样指挥 AI 剪辑。
          </p>
        </div>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto text-green-600">
            <Share2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">快速导出分享</h3>
          <p className="text-slate-500">
            云端高速渲染，支持多种格式导出，一键分享到社交平台。
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;
