import {useEffect, useState} from 'react';
import {Activity, LayoutGrid, List, LogIn, Server, Settings} from 'lucide-react';
import {getCurrentUser} from '../api/auth';
import {Link, useLocation} from "react-router-dom";

interface PublicHeaderProps {
    viewMode?: 'grid' | 'list';
    onViewModeChange?: (mode: 'grid' | 'list') => void;
    showViewToggle?: boolean;
}

const PublicHeader = ({
                          viewMode,
                          onViewModeChange,
                          showViewToggle = false
                      }: PublicHeaderProps) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    let location = useLocation();

    useEffect(() => {
        // 检查本地是否有 token
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('userInfo');

        if (!token || !userInfo) {
            setIsLoggedIn(false);
            return;
        }

        // 调用后端接口验证 token 是否有效
        getCurrentUser()
            .then(() => {
                setIsLoggedIn(true);
            })
            .catch(() => {
                // token 无效，清除本地存储
                localStorage.removeItem('token');
                localStorage.removeItem('userInfo');
                setIsLoggedIn(false);
            });
    }, []);

    // 判断导航是否激活
    const currentPath = location.pathname;
    const isDeviceActive = currentPath === '/';
    const isMonitorActive = currentPath === '/monitors';

    return (
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-4">
                    {/* 左侧：品牌和导航 */}
                    <div className="flex items-center gap-3 sm:gap-6">
                        {/* Logo 和品牌 */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            <img
                                src={"/api/logo"}
                                className="h-8 w-8 sm:h-9 sm:w-9 object-contain rounded-md"
                                alt={'logo'}
                                onError={(e) => {
                                    e.currentTarget.src = '/logo.png';
                                }}
                            />
                            <div className="hidden md:block">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600">
                                    {window.SystemConfig?.SystemNameEn}
                                </p>
                                <h1 className="text-sm font-bold text-slate-900">
                                    {window.SystemConfig?.SystemNameZh}
                                </h1>
                            </div>
                        </div>

                        {/* 导航链接 */}
                        <nav className="flex items-center gap-1">
                            <Link to="/">
                                <div
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium transition-all ${
                                        isDeviceActive
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                >
                                    <Server className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                                    <span className="sm:inline">设备监控</span>
                                </div>
                            </Link>
                            <Link to="/monitors">
                                <div
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium transition-all ${
                                        isMonitorActive
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}>
                                    <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                                    <span className="sm:inline">服务监控</span>
                                </div>
                            </Link>
                        </nav>
                    </div>

                    {/* 右侧：功能区 */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* 视图切换 */}
                        {showViewToggle && viewMode && onViewModeChange && (
                            <div
                                className="hidden sm:inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => onViewModeChange('grid')}
                                    className={`inline-flex items-center rounded-md p-1.5 transition-all cursor-pointer ${
                                        viewMode === 'grid'
                                            ? 'bg-white text-blue-600'
                                            : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                    title="网格视图"
                                >
                                    <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onViewModeChange('list')}
                                    className={`inline-flex items-center rounded-md p-1.5 transition-all cursor-pointer ${
                                        viewMode === 'list'
                                            ? 'bg-white text-blue-600'
                                            : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                    title="列表视图"
                                >
                                    <List className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                                </button>
                            </div>
                        )}

                        {/* 登录/管理后台按钮 */}
                        {isLoggedIn ? (
                            <a
                                href="/admin"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium text-white hover:bg-blue-700 transition-all"
                            >
                                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                                <span className="sm:inline">管理后台</span>
                            </a>
                        ) : (
                            <a
                                href="/login"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium text-white hover:bg-blue-700 transition-all"
                            >
                                <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                                <span className="sm:inline">登录</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default PublicHeader;
