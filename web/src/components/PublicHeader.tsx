import {useEffect, useRef, useState} from 'react';
import {Activity, LayoutGrid, List, LogIn, Moon, Server, Settings, Sun} from 'lucide-react';
import {getCurrentUser} from '../api/auth';
import {Link, useLocation} from "react-router-dom";
import {flushSync} from "react-dom";

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
    const [isDarkMode, setIsDarkMode] = useState(false);
    const darkModeButtonRef = useRef<HTMLButtonElement>(null);
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
                // token 无效,清除本地存储
                localStorage.removeItem('token');
                localStorage.removeItem('userInfo');
                setIsLoggedIn(false);
            });
    }, []);

    // 初始化暗色主题
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

        setIsDarkMode(shouldBeDark);
        if (shouldBeDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    // 切换暗色主题的函数,带动画效果
    const toggleDarkMode = async (newIsDarkMode: boolean) => {
        if (
            !darkModeButtonRef.current ||
            !document.startViewTransition ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            // 如果不支持 View Transition API 或用户偏好减少动画,直接切换
            setIsDarkMode(newIsDarkMode);
            if (newIsDarkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            localStorage.setItem('theme', newIsDarkMode ? 'dark' : 'light');
            return;
        }

        await document.startViewTransition(() => {
            flushSync(() => {
                setIsDarkMode(newIsDarkMode);
                if (newIsDarkMode) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
                localStorage.setItem('theme', newIsDarkMode ? 'dark' : 'light');
            });
        }).ready;

        const {top, left, width, height} = darkModeButtonRef.current.getBoundingClientRect();
        const x = left + width / 2;
        const y = top + height / 2;
        const right = window.innerWidth - left;
        const bottom = window.innerHeight - top;
        const maxRadius = Math.hypot(
            Math.max(left, right),
            Math.max(top, bottom),
        );

        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0px at ${x}px ${y}px)`,
                    `circle(${maxRadius}px at ${x}px ${y}px)`,
                ],
            },
            {
                duration: 500,
                easing: 'ease-in-out',
                pseudoElement: '::view-transition-new(root)',
            }
        );
    };

    // 判断导航是否激活
    const currentPath = location.pathname;
    const isDeviceActive = currentPath === '/';
    const isMonitorActive = currentPath === '/monitors';

    return (
        <header
            className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-gradient-to-r dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 backdrop-blur">
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
                                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-sky-300">
                                    {window.SystemConfig?.SystemNameEn}
                                </p>
                                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-50">
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
                                            ? 'bg-blue-50 dark:bg-sky-500/15 text-blue-600 dark:text-sky-200'
                                            : 'text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50'
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
                                            ? 'bg-blue-50 dark:bg-sky-500/15 text-blue-600 dark:text-sky-200'
                                            : 'text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50'
                                    }`}>
                                    <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                                    <span className="sm:inline">服务监控</span>
                                </div>
                            </Link>
                        </nav>
                    </div>

                    {/* 右侧：功能区 */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* 暗色主题切换 */}
                        <button
                            ref={darkModeButtonRef}
                            type="button"
                            onClick={() => toggleDarkMode(!isDarkMode)}
                            className="inline-flex items-center rounded-lg p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-all"
                            title={isDarkMode ? "切换到亮色模式" : "切换到暗色模式"}
                        >
                            {isDarkMode ? (
                                <Sun className="h-4 w-4 sm:h-5 sm:w-5"/>
                            ) : (
                                <Moon className="h-4 w-4 sm:h-5 sm:w-5"/>
                            )}
                        </button>

                        {/* 视图切换 */}
                        {showViewToggle && viewMode && onViewModeChange && (
                            <div
                                className="hidden sm:inline-flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => onViewModeChange('grid')}
                                    className={`inline-flex items-center rounded-md p-1.5 transition-all cursor-pointer ${
                                        viewMode === 'grid'
                                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-sky-200 shadow-sm dark:shadow-slate-900/60'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
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
                                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-sky-200 shadow-sm dark:shadow-slate-900/60'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
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
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium text-white hover:bg-blue-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-all"
                            >
                                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4"/>
                                <span className="sm:inline">管理后台</span>
                            </a>
                        ) : (
                            <a
                                href="/login"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium text-white hover:bg-blue-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-all"
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
