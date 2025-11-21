import { type JSX, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { MenuProps } from 'antd';
import { App, Avatar, Button, Dropdown, Space } from 'antd';
import { Eye, Key, LogOut, Server, User as UserIcon, BookOpen, Settings, Activity } from 'lucide-react';
import { logout } from '../../api/auth';
import { getServerVersion } from '../../api/agent';
import type { User } from '../../types';
import { cn } from '../../lib/utils';

interface NavItem {
    key: string;
    label: string;
    path: string;
    icon: JSX.Element;
}

const SIDEBAR_WIDTH = 260;
const HEADER_HEIGHT = 64;

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { message: messageApi, modal } = App.useApp();
    const [userInfo, setUserInfo] = useState<User | null>(null);
    const [selectedKey, setSelectedKey] = useState('agents');
    const [version, setVersion] = useState<string>('');

    const menuItems: NavItem[] = useMemo(
        () => [
            {
                key: 'agents',
                label: '探针管理',
                path: '/admin/agents',
                icon: <Server className="h-4 w-4" strokeWidth={2} />,
            },
            {
                key: 'api-keys',
                label: 'API密钥',
                path: '/admin/api-keys',
                icon: <Key className="h-4 w-4" strokeWidth={2} />,
            },
            {
                key: 'monitors',
                label: '服务监控',
                path: '/admin/monitors',
                icon: <Activity className="h-4 w-4" strokeWidth={2} />,
            },
            {
                key: 'settings',
                label: '系统设置',
                path: '/admin/settings',
                icon: <Settings className="h-4 w-4" strokeWidth={2} />,
            },
        ],
        [],
    );

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userInfoStr = localStorage.getItem('userInfo');

        if (!token || !userInfoStr) {
            navigate('/login');
            return;
        }

        setUserInfo(JSON.parse(userInfoStr));

        const path = location.pathname;
        if (path.startsWith('/admin/api-keys')) {
            setSelectedKey('api-keys');
        } else if (path.startsWith('/admin/monitors')) {
            setSelectedKey('monitors');
        } else if (path.startsWith('/admin/settings')) {
            setSelectedKey('settings');
        } else {
            setSelectedKey('agents');
        }

        // 获取服务端版本信息
        getServerVersion()
            .then((res) => {
                setVersion(res.data.version);
            })
            .catch((err) => {
                console.error('获取版本信息失败:', err);
            });
    }, [navigate, location]);

    const handleLogout = () => {
        modal.confirm({
            title: '确认退出',
            content: '确定要退出登录吗？',
            onOk: async () => {
                try {
                    await logout();
                } finally {
                    localStorage.removeItem('token');
                    localStorage.removeItem('userInfo');
                    messageApi.success('已退出登录');
                    navigate('/login');
                }
            },
        });
    };

    const userMenuItems: MenuProps['items'] = [
        {
            key: 'logout',
            icon: <LogOut size={16} strokeWidth={2} />,
            label: '退出登录',
            onClick: handleLogout,
        },
    ];

    const handleNavigate = (item: NavItem) => {
        if (item.key === selectedKey) {
            return;
        }

        setSelectedKey(item.key);
        navigate(item.path);
    };

    return (
        <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-teal-500/30">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black pointer-events-none" />

            {/* 顶部导航栏 */}
            <header className="fixed top-0 left-0 right-0 z-[300] h-16 border-b border-white/5 bg-black/50 backdrop-blur-xl shadow-sm transition-all duration-300">
                <div className="flex h-full items-center justify-between px-4 lg:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 text-teal-500 shadow-inner">
                            <img src="/logo.png" alt="Pika" className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-teal-500/80 drop-shadow-sm">Pika Monitor</span>
                            <span className="text-sm font-bold text-zinc-100 tracking-tight">Console</span>
                        </div>
                    </div>

                    <Space size={16} className="flex h-full items-center">
                        <Button
                            type="text"
                            icon={<Eye className="h-4 w-4" strokeWidth={2} />}
                            onClick={() => window.open('/', '_blank')}
                            className="hidden !h-8 !items-center !rounded-lg !border !border-white/5 !bg-white/5 !px-4 !text-xs !font-medium !text-zinc-400 hover:!bg-white/10 hover:!text-white hover:!border-white/10 sm:!inline-flex transition-all duration-200"
                        >
                            View Site
                        </Button>
                        
                        <div className="h-4 w-px bg-white/5 mx-2 hidden sm:block"></div>
                        
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']} overlayClassName="glass-dropdown">
                            <button
                                type="button"
                                className="group flex cursor-pointer items-center gap-3 rounded-full border border-white/5 bg-zinc-900/50 pl-1 pr-4 py-1 text-left text-zinc-200 transition-all duration-200 hover:bg-zinc-800 hover:border-white/10"
                            >
                                <Avatar
                                    size={24}
                                    icon={<UserIcon className="h-3.5 w-3.5 text-zinc-900" strokeWidth={2} />}
                                    className="!bg-teal-500"
                                />
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="text-xs font-medium group-hover:text-white transition-colors">
                                        {userInfo?.nickname || userInfo?.username || 'Admin'}
                                    </span>
                                </div>
                            </button>
                        </Dropdown>
                    </Space>
                </div>
            </header>

            {/* 侧边栏 */}
            <aside
                className="fixed left-0 z-[200] hidden h-screen overflow-hidden border-r border-white/5 bg-black/20 backdrop-blur-xl lg:block transition-all duration-300"
                style={{
                    width: SIDEBAR_WIDTH,
                    paddingTop: HEADER_HEIGHT,
                }}
            >
                <div className="flex h-full flex-col">
                    <div className="px-6 py-8">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Navigation</p>
                    </div>
                    {/* 菜单区域 */}
                    <nav className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
                        {menuItems.map((item) => {
                            const isActive = item.key === selectedKey;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleNavigate(item)}
                                    className={cn(
                                        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer',
                                        isActive
                                            ? 'text-white bg-white/5 shadow-sm border border-white/5'
                                            : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300 border border-transparent'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex items-center justify-center transition-colors duration-200',
                                            isActive ? 'text-teal-400' : 'text-zinc-500 group-hover:text-zinc-300'
                                        )}
                                    >
                                        {item.icon}
                                    </span>
                                    <span className="truncate">{item.label}</span>
                                    
                                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />}
                                </button>
                            );
                        })}
                    </nav>

                    {/* 版本信息 */}
                    {version && (
                        <div className="border-t border-white/5 px-6 py-6">
                            <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400 border border-white/5">
                                        <Activity className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Version</p>
                                        <p className="text-xs font-bold text-zinc-300 font-mono">{version}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* 主内容区 */}
            <div className="flex flex-col relative z-10" style={{ paddingTop: HEADER_HEIGHT, minHeight: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
                {/* 内容区域 */}
                <main className="flex-grow pb-20 pt-8 lg:ml-[260px] lg:pb-10 transition-all duration-300">
                    <div className="w-full max-w-[1600px] mx-auto px-4 lg:px-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* 移动端底部导航栏 */}
            <nav className="fixed bottom-0 left-0 right-0 z-[300] border-t border-white/10 bg-black/80 backdrop-blur-xl lg:hidden pb-safe">
                <div className="grid h-16 grid-cols-4">
                    {menuItems.map((item) => {
                        const isActive = item.key === selectedKey;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => handleNavigate(item)}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1.5 text-[10px] font-medium transition-colors',
                                    isActive ? 'text-teal-400' : 'text-slate-500'
                                )}
                            >
                                <div className={cn(
                                    'rounded-2xl p-2.5 transition-all', 
                                    isActive ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400'
                                )}>
                                    {item.icon}
                                </div>
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default AdminLayout;
