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

const SIDEBAR_WIDTH = 240;
const HEADER_HEIGHT = 56;

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
        <div className="min-h-screen bg-white">
            {/* 顶部导航栏 */}
            <header className="fixed top-0 left-0 right-0 z-[300] h-14 border-b border-white/10 bg-[#0f172a]/90 backdrop-blur-md shadow-sm">
                <div className="flex h-full items-center justify-between px-4 lg:px-6">
                    <div className="flex items-center gap-3 text-white">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
                            <img src="/logo.png" alt="Pika" className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400">Pika Monitor</p>
                            <p className="text-sm font-semibold text-slate-100">控制台</p>
                        </div>
                    </div>

                    <Space size={12} className="flex h-full items-center">
                        <Button
                            type="text"
                            icon={<Eye className="h-4 w-4" strokeWidth={2} />}
                            onClick={() => window.open('/', '_blank')}
                            className="hidden !h-8 !items-center !rounded-full !border !border-white/10 !bg-white/5 !px-4 !text-xs !font-medium !text-slate-300 hover:!bg-white/10 hover:!text-white sm:!inline-flex transition-all"
                        >
                            公共页面
                        </Button>
                        <Button
                            type="text"
                            icon={<BookOpen className="h-4 w-4" strokeWidth={2} />}
                            onClick={() => navigate('/admin/agents-install')}
                            className="hidden !h-8 !items-center !rounded-full !border !border-white/10 !bg-white/5 !px-4 !text-xs !font-medium !text-slate-300 hover:!bg-white/10 hover:!text-white sm:!inline-flex transition-all"
                        >
                            部署指南
                        </Button>
                        <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block"></div>
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
                            <button
                                type="button"
                                className="group flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-1 pr-3 py-1 text-left text-slate-200 transition-all hover:bg-white/10 hover:text-white"
                            >
                                <Avatar
                                    size={24}
                                    icon={<UserIcon className="h-3.5 w-3.5 text-slate-900" strokeWidth={2} />}
                                    className="!bg-teal-500"
                                />
                                <span className="text-xs font-medium group-hover:text-white">
                                    {userInfo?.nickname || userInfo?.username || '访客'}
                                </span>
                            </button>
                        </Dropdown>
                    </Space>
                </div>
            </header>

            {/* 侧边栏 */}
            <aside
                className="fixed left-0 z-[200] hidden h-screen overflow-hidden border-r border-slate-100 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] lg:block"
                style={{
                    width: SIDEBAR_WIDTH,
                    paddingTop: HEADER_HEIGHT,
                }}
            >
                <div className="flex h-full flex-col">
                    <div className="px-6 py-6">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">导航菜单</p>
                    </div>
                    {/* 菜单区域 */}
                    <nav className="flex-1 overflow-y-auto px-4 pb-6">
                        <div className="space-y-1.5">
                            {menuItems.map((item) => {
                                const isActive = item.key === selectedKey;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => handleNavigate(item)}
                                        className={cn(
                                            'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer',
                                            isActive
                                                ? 'bg-teal-50 text-teal-700 shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                                                isActive ? 'bg-white text-teal-600 shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm'
                                            )}
                                        >
                                            {item.icon}
                                        </span>
                                        <span className="truncate">{item.label}</span>
                                        {isActive && <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-teal-500" />}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>

                    {/* 版本信息 */}
                    {version && (
                        <div className="border-t border-slate-100 px-6 py-6">
                            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-teal-600 shadow-sm">
                                        <Activity className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500">当前版本</p>
                                        <p className="text-sm font-bold text-slate-900">{version}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* 主内容区 */}
            <div className="flex flex-col bg-white" style={{ paddingTop: HEADER_HEIGHT, minHeight: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
                {/* 内容区域 */}
                <main className="flex-grow bg-white pb-20 pt-5 lg:ml-[240px] lg:pb-10">
                    <div className="w-full px-4 pb-4 lg:px-8">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* 移动端底部导航栏 */}
            <nav className="fixed bottom-0 left-0 right-0 z-[300] border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden">
                <div className="grid h-16 grid-cols-5">
                    {menuItems.map((item) => {
                        const isActive = item.key === selectedKey;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => handleNavigate(item)}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1 text-xs font-medium',
                                    isActive ? 'text-teal-600' : 'text-gray-500'
                                )}
                            >
                                <span className={cn('rounded-full p-2', isActive ? 'bg-teal-50 text-teal-600' : 'text-current')}>
                                    {item.icon}
                                </span>
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
