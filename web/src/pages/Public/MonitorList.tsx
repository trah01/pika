import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {AlertCircle, CheckCircle2, Clock, Loader2, Shield} from 'lucide-react';
import {getPublicMonitors} from '../../api/monitor';
import type {PublicMonitor} from '../../types';
import {usePublicLayout} from '../PublicLayout';

type ViewMode = 'grid' | 'list';

const formatTime = (ms: number): string => {
    if (!ms || ms <= 0) return '0 ms';
    if (ms < 1000) return `${ms.toFixed(0)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
};

const formatDate = (timestamp: number): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

const formatPercentValue = (value: number): string => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

const LoadingSpinner = () => (
    <div className="flex min-h-[400px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-600 dark:text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin"/>
            <span className="text-sm">加载监控数据中...</span>
        </div>
    </div>
);

const StatusBadge = ({status}: { status: string }) => {
    let containerClass = 'bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300';
    let label = '未知';
    let icon = <Clock className="h-3.5 w-3.5"/>;

    if (status === 'up') {
        containerClass = 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
        label = '正常';
        icon = <CheckCircle2 className="h-3.5 w-3.5"/>;
    } else if (status === 'down') {
        containerClass = 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300';
        label = '异常';
        icon = <AlertCircle className="h-3.5 w-3.5"/>;
    }

    return (
        <div
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${containerClass}`}>
            {icon}
            {label}
        </div>
    );
};

const UptimeBar = ({uptime}: { uptime: number }) => {
    const percentage = Math.min(Math.max(uptime, 0), 100);
    const colorClass = percentage >= 99 ? 'bg-emerald-500' : percentage >= 95 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="relative h-2 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900/60">
            <div
                className={`absolute inset-y-0 left-0 ${colorClass} transition-all duration-500`}
                style={{width: `${percentage}%`}}
            />
        </div>
    );
};

const EmptyState = () => (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-slate-500 dark:text-slate-400">
        <Shield className="mb-4 h-16 w-16 opacity-20"/>
        <p className="text-lg font-medium">暂无监控数据</p>
        <p className="mt-2 text-sm">请先在管理后台添加监控任务</p>
    </div>
);

const MonitorList = () => {
    const navigate = useNavigate();
    const {viewMode, setShowViewToggle} = usePublicLayout();

    // 挂载时启用视图切换，卸载时禁用
    useEffect(() => {
        setShowViewToggle(true);
        return () => setShowViewToggle(false);
    }, [setShowViewToggle]);

    const {data: monitors = [], isLoading, dataUpdatedAt} = useQuery<PublicMonitor[]>({
        queryKey: ['publicMonitors'],
        queryFn: async () => {
            const response = await getPublicMonitors();
            return response.data || [];
        },
        refetchInterval: 30000, // 30秒刷新一次
    });

    const monitorSummaries = monitors;

    const renderGridView = () => (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {monitorSummaries.map((stats) => {
                const hasCert = stats.certExpiryDate > 0;
                const certExpiringSoon = hasCert && stats.certExpiryDays < 30;

                return (
                    <div
                        key={stats.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/monitors/${encodeURIComponent(stats.id)}`)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                navigate(`/monitors/${encodeURIComponent(stats.id)}`);
                            }
                        }}
                        className="group relative flex h-full cursor-pointer flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-transparent p-5 transition duration-200 hover:border-blue-300 dark:hover:border-blue-500/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                                        {stats.name}
                                    </h3>
                                    <StatusBadge status={stats.lastCheckStatus}/>
                                </div>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 truncate" title={stats.showTargetPublic ? stats.target : '已隐藏'}>
                                    {stats.showTargetPublic ? stats.target : '***'}
                                </p>
                                {stats.agentCount > 1 && (
                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                        {stats.agentCount} 个探针
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div
                                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                        <Clock className="h-3.5 w-3.5"/>
                                    </div>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">当前响应</span>
                                </div>
                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    {formatTime(stats.currentResponse)}
                                </span>
                            </div>

                            <div
                                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                        <Clock className="h-3.5 w-3.5"/>
                                    </div>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">24h 平均</span>
                                </div>
                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    {formatTime(stats.avgResponse24h)}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-slate-600 dark:text-slate-300">24h 在线率</span>
                                    <span
                                        className="font-semibold text-slate-900 dark:text-slate-100">{formatPercentValue(stats.uptime24h)}%</span>
                                </div>
                                <UptimeBar uptime={stats.uptime24h}/>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-slate-600 dark:text-slate-300">30d 在线率</span>
                                    <span
                                        className="font-semibold text-slate-900 dark:text-slate-100">{formatPercentValue(stats.uptime30d)}%</span>
                                </div>
                                <UptimeBar uptime={stats.uptime30d}/>
                            </div>

                            {hasCert && (
                                <div
                                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <Shield
                                            className={`h-4 w-4 ${certExpiringSoon ? 'text-yellow-600 dark:text-yellow-500' : 'text-blue-600 dark:text-blue-400'}`}/>
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">证书到期</span>
                                    </div>
                                    <div className="text-right">
                                        <div
                                            className={`text-xs font-medium ${certExpiringSoon ? 'text-yellow-700 dark:text-yellow-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {formatDate(stats.certExpiryDate)}
                                        </div>
                                        <div
                                            className={`text-xs ${certExpiringSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            剩余 {stats.certExpiryDays} 天
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderListView = () => (
        <>
            {/* 桌面端：使用表格布局 */}
            <div className="hidden overflow-hidden rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 lg:block">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600 text-sm">
                    <thead className="bg-blue-50 dark:bg-blue-900/30">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                        <th className="px-5 py-3">监控项</th>
                        <th className="px-5 py-3">状态</th>
                        <th className="px-5 py-3">当前响应</th>
                        <th className="px-5 py-3">24h 平均响应</th>
                        <th className="px-5 py-3">24h 在线率</th>
                        <th className="px-5 py-3">30d 在线率</th>
                        <th className="px-5 py-3">证书信息</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-600 text-slate-700 dark:text-slate-200">
                    {monitorSummaries.map((stats) => {
                        const hasCert = stats.certExpiryDate > 0;
                        const certExpiringSoon = hasCert && stats.certExpiryDays < 30;

                        return (
                            <tr
                                key={stats.id}
                                tabIndex={0}
                                onClick={() => navigate(`/monitors/${encodeURIComponent(stats.id)}`)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        navigate(`/monitors/${encodeURIComponent(stats.id)}`);
                                    }
                                }}
                                className="cursor-pointer transition hover:bg-blue-50 dark:hover:bg-slate-700 focus-within:bg-blue-50 dark:focus-within:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                            >
                                <td className="px-5 py-4 align-center">
                                    <div>
                                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                                            {stats.name}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-all">
                                            {stats.showTargetPublic ? stats.target : '***'}
                                        </div>
                                        {stats.agentCount > 1 && (
                                            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                {stats.agentCount} 个探针
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-5 py-4 align-center">
                                    <StatusBadge status={stats.lastCheckStatus}/>
                                </td>
                                <td className="px-5 py-4 align-center">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500"/>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                {formatTime(stats.currentResponse)}
                                            </span>
                                    </div>
                                </td>
                                <td className="px-5 py-4 align-center">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            {formatTime(stats.avgResponse24h)}
                                        </span>
                                </td>
                                <td className="px-5 py-4 align-center">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-24">
                                                <UptimeBar uptime={stats.uptime24h}/>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 w-14 text-right">
                                                    {formatPercentValue(stats.uptime24h)}%
                                                </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4 align-center">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-24">
                                                <UptimeBar uptime={stats.uptime30d}/>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 w-14 text-right">
                                                    {formatPercentValue(stats.uptime30d)}%
                                                </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4 align-center">
                                    {hasCert ? (
                                        <div className="flex items-center gap-2">
                                            <Shield
                                                className={`h-4 w-4 ${certExpiringSoon ? 'text-yellow-600 dark:text-yellow-500' : 'text-slate-400 dark:text-slate-500'}`}/>
                                            <div className="text-xs">
                                                <div
                                                    className={certExpiringSoon ? 'font-medium text-yellow-700 dark:text-yellow-300' : 'font-medium text-slate-700 dark:text-slate-200'}>
                                                    {formatDate(stats.certExpiryDate)}
                                                </div>
                                                <div
                                                    className={`${certExpiringSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    剩余 {stats.certExpiryDays} 天
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-400 dark:text-slate-500">-</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </>
    );

    if (isLoading) {
        return (
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <LoadingSpinner/>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {monitorSummaries.length === 0 ? (
                <EmptyState/>
            ) : viewMode === 'grid' ? (
                renderGridView()
            ) : (
                renderListView()
            )}
        </div>
    );
};

export default MonitorList;
