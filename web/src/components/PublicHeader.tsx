import {Activity, LayoutGrid, List, LogIn, Server} from 'lucide-react';
import GithubSvg from "../assets/github.svg";

interface PublicHeaderProps {
    title: string;
    lastUpdated?: string;
    viewMode?: 'grid' | 'list';
    onViewModeChange?: (mode: 'grid' | 'list') => void;
    showViewToggle?: boolean;
}

const PublicHeader = ({
                          title,
                          lastUpdated,
                          viewMode,
                          onViewModeChange,
                          showViewToggle = false
                      }: PublicHeaderProps) => {
    return (
        <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* 左侧：品牌和标题 */}
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 shadow-sm">
                            <img src={'/logo.png'} className="h-7 w-7" alt={'logo'}/>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-teal-600/80">
                                Pika Monitor
                            </p>
                            <h1 className="text-xl font-bold text-slate-900 lg:text-2xl tracking-tight">{title}</h1>
                        </div>
                    </div>

                    {/* 右侧：操作区域 */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        {/* 最后更新时间 */}
                        {lastUpdated && (
                            <>
                                <div
                                    className="flex items-center gap-2 rounded-full bg-slate-100/50 border border-slate-200/50 px-3 py-1.5 text-slate-500">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </div>
                                    <span className="text-[11px] font-medium">
                                        更新：<span className="font-semibold text-slate-700">{lastUpdated}</span>
                                    </span>
                                </div>
                                <span className="hidden h-4 w-px bg-slate-200 lg:inline-block"/>
                            </>
                        )}

                        {/* 视图切换 */}
                        {showViewToggle && viewMode && onViewModeChange && (
                            <>
                                <div
                                    className="inline-flex items-center p-1 gap-1 rounded-lg border border-slate-200 bg-slate-100/50">
                                    <button
                                        type="button"
                                        onClick={() => onViewModeChange('grid')}
                                        className={`inline-flex items-center justify-center rounded-md h-7 w-7 transition-all ${
                                            viewMode === 'grid'
                                                ? 'bg-white text-teal-600 shadow-sm'
                                                : 'text-slate-400 hover:text-teal-600'
                                        }`}
                                        title="网格视图"
                                    >
                                        <LayoutGrid className="h-4 w-4"/>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onViewModeChange('list')}
                                        className={`inline-flex items-center justify-center rounded-md h-7 w-7 transition-all ${
                                            viewMode === 'list'
                                                ? 'bg-white text-teal-600 shadow-sm'
                                                : 'text-slate-400 hover:text-teal-600'
                                        }`}
                                        title="列表视图"
                                    >
                                        <List className="h-4 w-4"/>
                                    </button>
                                </div>
                                <span className="hidden h-4 w-px bg-slate-200 lg:inline-block"/>
                            </>
                        )}

                        {/* 导航链接 */}
                        <nav className="flex items-center gap-1">
                            {/* 服务器链接 */}
                            <a
                                href="/"
                                className="group inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900"
                            >
                                <Server className="h-4 w-4 text-slate-400 transition-colors group-hover:text-teal-500"/>
                                <span className="hidden sm:inline">设备</span>
                            </a>

                            {/* 监控链接 */}
                            <a
                                href="/monitors"
                                className="group inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900"
                            >
                                <Activity className="h-4 w-4 text-slate-400 transition-colors group-hover:text-teal-500"/>
                                <span className="hidden sm:inline">服务</span>
                            </a>
                        </nav>

                        <span className="hidden h-4 w-px bg-slate-200 lg:inline-block"/>

                        {/* GitHub 链接 */}
                        <a
                            href="https://github.com/dushixiang/pika"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow"
                            title="查看 GitHub 仓库"
                        >
                            <img src={GithubSvg} className="h-4 w-4 opacity-70 hover:opacity-100" alt="GitHub"/>
                        </a>

                        {/* 登录按钮 */}
                        <a
                            href="/login"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-teal-600 bg-teal-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-teal-500/20 transition-all hover:bg-teal-700 hover:shadow-teal-500/30"
                        >
                            <LogIn className="h-3.5 w-3.5"/>
                            <span>登录</span>
                        </a>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default PublicHeader;
