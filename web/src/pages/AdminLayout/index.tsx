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
        <div className="min-h-screen bg-transparent text-slate-200 selection:bg-teal-500/30 selection:text-teal-200">
            {/* 顶部导航栏 */}
            <header className="fixed top-0 left-0 right-0 z-[300] h-16 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl shadow-sm transition-all duration-300">
                <div className="flex h-full items-center justify-between px-4 lg:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                            <img src="/logo.png" alt="Pika" className="h-6 w-6 invert brightness-0 filter" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold uppercase tracking-[0.25em] text-teal-400 drop-shadow-sm">Pika Monitor</span>
                            <span className="text-sm font-medium text-slate-300">控制台</span>
                        </div>
                    </div>

                    <Space size={16} className="flex h-full items-center">
                        <Button
                            type="text"
                            icon={<Eye className="h-4 w-4" strokeWidth={2} />}
                            onClick={() => window.open('/', '_blank')}
                            className="hidden !h-9 !items-center !rounded-full !border !border-white/5 !bg-white/5 !px-5 !text-xs !font-medium !text-slate-300 hover:!bg-white/10 hover:!text-white hover:!border-white/10 sm:!inline-flex transition-all duration-300"
                        >
                            公共页面
                        </Button>
                        <Button
                            type="text"
                            icon={<BookOpen className="h-4 w-4" strokeWidth={2} />}
                            onClick={() => navigate('/admin/agents-install')}
                            className="hidden !h-9 !items-center !rounded-full !border !border-white/5 !bg-white/5 !px-5 !text-xs !font-medium !text-slate-300 hover:!bg-white/10 hover:!text-white hover:!border-white/10 sm:!inline-flex transition-all duration-300"
                        >
                            部署指南
                        </Button>
                        
                        <div className="h-5 w-px bg-white/10 mx-2 hidden sm:block"></div>
                        
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']} overlayClassName="glass-dropdown">
                            <button
                                type="button"
                                className="group flex cursor-pointer items-center gap-3 rounded-full border border-white/5 bg-white/5 pl-1 pr-4 py-1.5 text-left text-slate-200 transition-all duration-300 hover:bg-white/10 hover:border-white/10"
                            >
                                <Avatar
                                    size={28}
                                    icon={<UserIcon className="h-4 w-4 text-white" strokeWidth={2} />}
                                    className="!bg-gradient-to-br !from-teal-500 !to-emerald-600"
                                />
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="text-xs font-medium group-hover:text-white transition-colors">
                                        {userInfo?.nickname || userInfo?.username || '访客'}
                                    </span>
                                </div>
                            </button>
                        </Dropdown>
                    </Space>
                </div>
            </header>

            {/* 侧边栏 */}
            <aside
                className="fixed left-0 z-[200] hidden h-screen overflow-hidden border-r border-white/5 bg-slate-900/30 backdrop-blur-xl lg:block transition-all duration-300"
                style={{
                    width: SIDEBAR_WIDTH,
                    paddingTop: HEADER_HEIGHT,
                }}
            >
                <div className="flex h-full flex-col">
                    <div className="px-6 py-8">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Main Menu</p>
                    </div>
                    {/* 菜单区域 */}
                    <nav className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
                        {menuItems.map((item) => {
                            const isActive = item.key === selectedKey;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleNavigate(item)}
                                    className={cn(
                                        'group relative flex w-full items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 cursor-pointer overflow-hidden',
                                        isActive
                                            ? 'text-teal-200 bg-teal-500/10 shadow-[0_0_20px_rgba(20,184,166,0.1)] border border-teal-500/20'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                                    )}
                                >
                                    {isActive && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 shadow-[0_0_10px_#14b8a6]" />
                                    )}
                                    
                                    <span
                                        className={cn(
                                            'flex h-5 w-5 items-center justify-center transition-colors duration-300',
                                            isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'
                                        )}
                                    >
                                        {item.icon}
                                    </span>
                                    <span className="truncate">{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* 版本信息 */}
                    {version && (
                        <div className="border-t border-white/5 px-6 py-6">
                            <div className="rounded-xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 shadow-sm border border-teal-500/20">
                                        <Activity className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">System Version</p>
                                        <p className="text-sm font-bold text-slate-200">{version}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* 主内容区 */}
            <div className="flex flex-col" style={{ paddingTop: HEADER_HEIGHT, minHeight: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
                {/* 内容区域 */}
                <main className="flex-grow pb-20 pt-8 lg:ml-[260px] lg:pb-10 transition-all duration-300">
                    <div className="w-full max-w-[1600px] mx-auto px-4 lg:px-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* 移动端底部导航栏 */}
            <nav className="fixed bottom-0 left-0 right-0 z-[300] border-t border-white/10 bg-slate-900/80 backdrop-blur-xl lg:hidden">
                <div className="grid h-20 grid-cols-4 pb-4">
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
