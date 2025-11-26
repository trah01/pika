import React, {type ReactNode, useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {
    Activity,
    ArrowLeft,
    Cpu,
    HardDrive,
    Loader2,
    MemoryStick,
    Network,
    Server,
    Thermometer,
    Zap
} from 'lucide-react';
import type {TooltipProps} from 'recharts';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    getAgent,
    getAgentLatestMetrics,
    getAgentMetrics,
    type GetAgentMetricsRequest,
    getNetworkMetricsByInterface,
    type NetworkMetricByInterface
} from '../../api/agent';
import type {
    Agent,
    AggregatedCPUMetric,
    AggregatedDiskIOMetric,
    AggregatedDiskMetric,
    AggregatedGPUMetric,
    AggregatedMemoryMetric,
    AggregatedNetworkMetric,
    AggregatedTemperatureMetric,
    LatestMetrics
} from '../../types';

const formatBytes = (bytes: number | undefined | null): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatPercentValue = (value: number | undefined | null): string => {
    if (value === undefined || value === null || Number.isNaN(value)) return '0.0';
    return value.toFixed(1);
};

const formatUptime = (seconds: number | undefined | null): string => {
    if (seconds === undefined || seconds === null) return '-';
    if (seconds <= 0) return '0 秒';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} 天`);
    if (hours > 0) parts.push(`${hours} 小时`);
    if (minutes > 0) parts.push(`${minutes} 分钟`);

    return parts.length > 0 ? parts.join(' ') : '不到 1 分钟';
};

const formatDateTime = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null || value === '') {
        return '-';
    }

    const date = typeof value === 'number' ? new Date(value) : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleString('zh-CN');
};

const timeRangeOptions = [
    {label: '15分钟', value: '15m'},
    {label: '30分钟', value: '30m'},
    {label: '1小时', value: '1h'},
] as const;

type TimeRange = typeof timeRangeOptions[number]['value'];

// 网卡颜色配置（上行和下行使用不同的色调）
const INTERFACE_COLORS = [
    {upload: '#6FD598', download: '#2C70F6'}, // 绿/蓝
    {upload: '#f59e0b', download: '#8b5cf6'}, // 橙/紫
    {upload: '#ec4899', download: '#06b6d4'}, // 粉/青
    {upload: '#10b981', download: '#f97316'}, // 翠绿/深橙
    {upload: '#14b8a6', download: '#2563eb'}, // 青绿/深蓝
];

const LoadingSpinner = () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400"/>
            <p className="text-sm text-slate-500">数据加载中，请稍候...</p>
        </div>
    </div>
);

const EmptyState = ({message = '服务器不存在或已离线'}: { message?: string }) => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Server className="h-8 w-8"/>
            </div>
            <p className="text-sm text-slate-500">{message}</p>
        </div>
    </div>
);

const Card = ({
                  title,
                  description,
                  action,
                  children,
              }: {
    title?: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
}) => (
    <section className="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm">
        {(title || description || action) && (
            <div
                className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
                    {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
        )}
        <div className="pt-4">{children}</div>
    </section>
);

type AccentVariant = 'blue' | 'emerald' | 'purple' | 'sky' | 'amber';

const accentThemes: Record<AccentVariant, { icon: string; badge: string; highlight: string }> = {
    blue: {
        icon: 'bg-blue-50 text-blue-600',
        badge: 'bg-blue-100 text-blue-600',
        highlight: 'text-blue-600',
    },
    emerald: {
        icon: 'bg-emerald-50 text-emerald-600',
        badge: 'bg-emerald-100 text-emerald-600',
        highlight: 'text-emerald-600',
    },
    purple: {
        icon: 'bg-purple-50 text-purple-600',
        badge: 'bg-purple-100 text-purple-600',
        highlight: 'text-purple-600',
    },
    sky: {
        icon: 'bg-sky-50 text-sky-600',
        badge: 'bg-sky-100 text-sky-600',
        highlight: 'text-sky-600',
    },
    amber: {
        icon: 'bg-amber-50 text-amber-600',
        badge: 'bg-amber-100 text-amber-600',
        highlight: 'text-amber-600',
    },
};

const InfoGrid = ({items}: { items: Array<{ label: string; value: ReactNode }> }) => (
    <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        {items.map((item) => (
            <div key={item.label}>
                <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
                <dd className="mt-1 font-medium text-slate-900">{item.value}</dd>
            </div>
        ))}
    </dl>
);

const TimeRangeSelector = ({
                               value,
                               onChange,
                           }: {
    value: TimeRange;
    onChange: (value: TimeRange) => void;
}) => (
    <div className="flex flex-wrap items-center gap-2">
        {timeRangeOptions.map((option) => {
            const isActive = option.value === value;
            return (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        isActive
                            ? 'border-blue-200 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                    }`}
                >
                    {option.label}
                </button>
            );
        })}
    </div>
);

type MetricsTooltipProps = TooltipProps<number, string> & { unit?: string, label?: string, payload?: any[] };

type MetricsState = {
    cpu: AggregatedCPUMetric[];
    memory: AggregatedMemoryMetric[];
    network: AggregatedNetworkMetric[];
    disk: AggregatedDiskMetric[];
    diskIO: AggregatedDiskIOMetric[];
    gpu: AggregatedGPUMetric[];
    temperature: AggregatedTemperatureMetric[];
};

const createEmptyMetricsState = (): MetricsState => ({
    cpu: [],
    memory: [],
    network: [],
    disk: [],
    diskIO: [],
    gpu: [],
    temperature: [],
});

const metricRequestConfig: Array<{ key: keyof MetricsState; type: GetAgentMetricsRequest['type'] }> = [
    {key: 'cpu', type: 'cpu'},
    {key: 'memory', type: 'memory'},
    {key: 'network', type: 'network'},
    {key: 'disk', type: 'disk'},
    {key: 'diskIO', type: 'disk_io'},
    {key: 'gpu', type: 'gpu'},
    {key: 'temperature', type: 'temperature'},
];

const useAgentOverview = (agentId?: string) => {
    const [agent, setAgent] = useState<Agent | null>(null);
    const [latestMetrics, setLatestMetrics] = useState<LatestMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        if (!agentId) {
            setAgent(null);
            setLatestMetrics(null);
            setLoading(false);
            return;
        }

        const fetchAgent = async () => {
            setLoading(true);
            try {
                const [agentRes, latestRes] = await Promise.all([getAgent(agentId), getAgentLatestMetrics(agentId)]);
                if (!cancelled) {
                    setAgent(agentRes.data);
                    setLatestMetrics(latestRes.data);
                }
            } catch (error) {
                console.error('Failed to load agent details:', error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchAgent();

        return () => {
            cancelled = true;
        };
    }, [agentId]);

    useEffect(() => {
        if (!agentId) return;

        let cancelled = false;

        const refreshLatest = async () => {
            try {
                const latestRes = await getAgentLatestMetrics(agentId);
                if (!cancelled) {
                    setLatestMetrics(latestRes.data);
                }
            } catch (error) {
                console.error('Failed to refresh latest metrics:', error);
            }
        };

        const timer = setInterval(refreshLatest, 5000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [agentId]);

    return {agent, latestMetrics, loading};
};

const useAggregatedMetrics = (agentId: string | undefined, range: TimeRange) => {
    const [metrics, setMetrics] = useState<MetricsState>(() => createEmptyMetricsState());

    useEffect(() => {
        if (!agentId) {
            setMetrics(createEmptyMetricsState());
            return;
        }

        let cancelled = false;

        const fetchMetrics = async () => {
            try {
                const responses = await Promise.all(
                    metricRequestConfig.map(({type}) => getAgentMetrics({agentId, type, range})),
                );
                if (cancelled) return;
                const nextState = createEmptyMetricsState();
                metricRequestConfig.forEach(({key}, index) => {
                    nextState[key] = responses[index].data.metrics || [];
                });
                setMetrics(nextState);
            } catch (error) {
                console.error('Failed to load metrics:', error);
            }
        };

        fetchMetrics();
        const timer = setInterval(fetchMetrics, 30000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [agentId, range]);

    return metrics;
};

// 用于获取按网卡分组的网络指标
const useNetworkMetricsByInterface = (agentId: string | undefined, range: TimeRange) => {
    const [networkMetrics, setNetworkMetrics] = useState<NetworkMetricByInterface[]>([]);

    useEffect(() => {
        if (!agentId) {
            setNetworkMetrics([]);
            return;
        }

        let cancelled = false;

        const fetchNetworkMetrics = async () => {
            try {
                const response = await getNetworkMetricsByInterface({agentId, range});
                if (cancelled) return;
                setNetworkMetrics(response.data.metrics || []);
            } catch (error) {
                console.error('Failed to load network metrics by interface:', error);
            }
        };

        fetchNetworkMetrics();
        const timer = setInterval(fetchNetworkMetrics, 30000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [agentId, range]);

    return networkMetrics;
};

type SnapshotCardData = {
    key: string;
    icon: typeof Cpu;
    title: string;
    usagePercent: string;
    accent: AccentVariant;
    metrics: Array<{ label: string; value: ReactNode }>;
};

const SnapshotGrid = ({cards}: { cards: SnapshotCardData[] }) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
            const theme = accentThemes[card.accent];
            return (
                <div
                    key={card.key}
                    className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                    <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${theme.icon}`}>
                                <card.icon className="h-4 w-4"/>
                            </span>
                            <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                        </div>
                        <span className={`text-xl font-bold ${theme.highlight}`}>{card.usagePercent}</span>
                    </div>
                    <div className="space-y-2">
                        {card.metrics.map((metric) => (
                            <div key={metric.label} className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">{metric.label}</span>
                                <span className="ml-2 text-right font-medium text-slate-900">{metric.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
);

const SnapshotSection = ({cards}: { cards: SnapshotCardData[] }) => {
    if (cards.length === 0) {
        return null;
    }
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-slate-700">资源快照</h3>
                <p className="mt-1 text-xs text-slate-500">最近 5 秒采集的资源使用状况</p>
            </div>
            <SnapshotGrid cards={cards}/>
        </div>
    );
};

const CustomTooltip = ({active, payload, label, unit = '%'}: MetricsTooltipProps) => {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <p className="font-semibold text-slate-700">{label}</p>
            <div className="mt-1 space-y-1">
                {payload.map((entry, index) => {
                    if (!entry) {
                        return null;
                    }

                    const dotColor = entry.color ?? '#6366f1';
                    const title = entry.name ?? entry.dataKey ?? `系列 ${index + 1}`;
                    const value =
                        typeof entry.value === 'number'
                            ? Number.isFinite(entry.value)
                                ? entry.value.toFixed(2)
                                : '-'
                            : entry.value;

                    return (
                        <p key={`${entry.dataKey ?? index}`} className="flex items-center gap-2 text-slate-600">
                        <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{backgroundColor: dotColor}}
                        />
                            <span>
                                {title}: {value}
                                {unit}
                            </span>
                        </p>
                    );
                })}
            </div>
        </div>
    );
};

const ServerDetail = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [timeRange, setTimeRange] = useState<TimeRange>('15m');
    const [selectedInterface, setSelectedInterface] = useState<string>('all');
    const {agent, latestMetrics, loading} = useAgentOverview(id);
    const metricsData = useAggregatedMetrics(id, timeRange);
    const networkMetricsByInterface = useNetworkMetricsByInterface(id, timeRange);

    const cpuChartData = useMemo(
        () =>
            metricsData.cpu.map((item) => ({
                time: new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                usage: Number(item.maxUsage.toFixed(2)),
            })),
        [metricsData.cpu]
    );

    const memoryChartData = useMemo(
        () =>
            metricsData.memory.map((item) => ({
                time: new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                usage: Number(item.maxUsage.toFixed(2)),
            })),
        [metricsData.memory]
    );

    // 获取所有可用的网卡列表（从按网卡分组的数据中获取）
    const availableInterfaces = useMemo(() => {
        const interfaces = new Set<string>();
        networkMetricsByInterface.forEach((item) => {
            interfaces.add(item.interface);
        });
        return Array.from(interfaces).sort();
    }, [networkMetricsByInterface]);

    useEffect(() => {
        if (selectedInterface === 'all') {
            return;
        }
        if (!availableInterfaces.includes(selectedInterface)) {
            setSelectedInterface('all');
        }
    }, [availableInterfaces, selectedInterface]);

    const networkChartData = useMemo(() => {
        if (networkMetricsByInterface.length === 0) return [];

        // 按时间戳分组数据
        const grouped = networkMetricsByInterface.reduce((acc, item) => {
            const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
            });

            if (!acc[time]) {
                acc[time] = {time};
            }

            // 根据选择的网卡过滤
            if (selectedInterface === 'all' || item.interface === selectedInterface) {
                const uploadKey = `${item.interface}_upload`;
                const downloadKey = `${item.interface}_download`;
                // 转换为 MB/s
                acc[time][uploadKey] = Number((item.maxSentRate / 1024 / 1024).toFixed(2));
                acc[time][downloadKey] = Number((item.maxRecvRate / 1024 / 1024).toFixed(2));
            }

            return acc;
        }, {} as Record<string, any>);

        return Object.values(grouped);
    }, [networkMetricsByInterface, selectedInterface]);

    // Disk I/O 图表数据（汇总所有磁盘）
    const diskIOChartData = useMemo(() => {
        const aggregated: Record<string, { time: string; read: number; write: number }> = {};

        metricsData.diskIO.forEach((item) => {
            const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
            });

            if (!aggregated[time]) {
                aggregated[time] = {time, read: 0, write: 0};
            }

            // 转换为 MB/s
            aggregated[time].read += item.maxReadRate / 1024 / 1024;
            aggregated[time].write += item.maxWriteRate / 1024 / 1024;
        });

        return Object.values(aggregated).map((item) => ({
            ...item,
            read: Number(item.read.toFixed(2)),
            write: Number(item.write.toFixed(2)),
        }));
    }, [metricsData.diskIO]);

    // GPU 图表数据（汇总所有GPU的平均利用率）
    const gpuChartData = useMemo(() => {
        const aggregated: Record<string, {
            time: string;
            utilization: number;
            temperature: number;
            count: number
        }> = {};

        metricsData.gpu.forEach((item) => {
            const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
            });

            if (!aggregated[time]) {
                aggregated[time] = {time, utilization: 0, temperature: 0, count: 0};
            }

            aggregated[time].utilization += item.maxUtilization;
            aggregated[time].temperature += item.maxTemperature;
            aggregated[time].count += 1;
        });

        return Object.values(aggregated).map((item) => ({
            time: item.time,
            utilization: Number((item.utilization / item.count).toFixed(2)),
            temperature: Number((item.temperature / item.count).toFixed(2)),
        }));
    }, [metricsData.gpu]);

    // Temperature 图表数据（所有传感器的平均温度）
    const temperatureChartData = useMemo(() => {
        const aggregated: Record<string, { time: string; temperature: number; count: number }> = {};

        metricsData.temperature.forEach((item) => {
            const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
            });

            if (!aggregated[time]) {
                aggregated[time] = {time, temperature: 0, count: 0};
            }

            aggregated[time].temperature += item.maxTemperature;
            aggregated[time].count += 1;
        });

        return Object.values(aggregated).map((item) => ({
            time: item.time,
            temperature: Number((item.temperature / item.count).toFixed(2)),
        }));
    }, [metricsData.temperature]);

    const snapshotCards: SnapshotCardData[] = useMemo(() => {
        if (!latestMetrics) {
            return [] as Array<{
                key: string;
                icon: typeof Cpu;
                title: string;
                usagePercent: string;
                accent: AccentVariant;
                metrics: Array<{ label: string; value: ReactNode }>;
            }>;
        }

        const cards: Array<{
            key: string;
            icon: typeof Cpu;
            title: string;
            usagePercent: string;
            accent: AccentVariant;
            metrics: Array<{ label: string; value: ReactNode }>;
        }> = [];

        cards.push({
            key: 'cpu',
            icon: Cpu,
            title: 'CPU 使用',
            usagePercent: `${formatPercentValue(latestMetrics.cpu?.usagePercent)}%`,
            accent: 'blue',
            metrics: [
                {label: '当前使用', value: `${formatPercentValue(latestMetrics.cpu?.usagePercent)}%`},
                {
                    label: '采样时间',
                    value: latestMetrics.cpu ? formatDateTime(latestMetrics.cpu.timestamp) : '-',
                },
            ],
        });

        cards.push({
            key: 'memory',
            icon: MemoryStick,
            title: '内存使用',
            usagePercent: `${formatPercentValue(latestMetrics.memory?.usagePercent)}%`,
            accent: 'emerald',
            metrics: [
                {
                    label: '已用 / 总量',
                    value: `${formatBytes(latestMetrics.memory?.used)} / ${formatBytes(latestMetrics.memory?.total)}`
                },
                {label: 'Swap 已用', value: formatBytes(latestMetrics.memory?.swapUsed)},
            ],
        });

        cards.push({
            key: 'disk',
            icon: HardDrive,
            title: '磁盘使用',
            usagePercent: latestMetrics.disk
                ? `${formatPercentValue(latestMetrics.disk.avgUsagePercent)}%`
                : '—',
            accent: 'purple',
            metrics: [
                {
                    label: '已用 / 总量',
                    value: `${formatBytes(latestMetrics.disk?.used)} / ${formatBytes(latestMetrics.disk?.total)}`
                },
                {label: '磁盘数量', value: latestMetrics.disk?.totalDisks ?? '-'},
            ],
        });

        cards.push({
            key: 'load',
            icon: Activity,
            title: '系统负载',
            usagePercent: latestMetrics.load
                ? `${latestMetrics.load.load1.toFixed(2)}`
                : '—',
            accent: 'amber',
            metrics: [
                {
                    label: '1 / 5 / 15 分钟',
                    value: latestMetrics.load
                        ? `${latestMetrics.load.load1.toFixed(2)} / ${latestMetrics.load.load5.toFixed(2)} / ${latestMetrics.load.load15.toFixed(2)}`
                        : '-',
                },
                {
                    label: '网络累计',
                    value: `${formatBytes(latestMetrics.network?.totalBytesSentTotal)} ↑ / ${formatBytes(
                        latestMetrics.network?.totalBytesRecvTotal,
                    )} ↓`,
                },
            ],
        });

        return cards;
    }, [latestMetrics]);

    const platformDisplay = latestMetrics?.host?.platform
        ? `${latestMetrics.host.platform} ${latestMetrics.host.platformVersion || ''}`.trim()
        : agent?.os || '-';
    const architectureDisplay = latestMetrics?.host?.kernelArch || agent?.arch || '-';
    const uptimeDisplay = formatUptime(latestMetrics?.host?.uptime);
    const bootTimeDisplay = latestMetrics?.host?.bootTime
        ? formatDateTime(latestMetrics.host.bootTime * 1000)
        : '-';
    const lastSeenDisplay = agent ? formatDateTime(agent.lastSeenAt) : '-';
    const displayName = agent?.name?.trim() ? agent.name : '未命名探针';
    const isOnline = agent?.status === 1;
    const statusDotStyles = isOnline ? 'bg-emerald-500' : 'bg-slate-400';
    const statusText = isOnline ? '在线' : '离线';

    const networkSummary = latestMetrics?.network
        ? `${formatBytes(latestMetrics.network.totalBytesSentTotal)} ↑ / ${formatBytes(
            latestMetrics.network.totalBytesRecvTotal,
        )} ↓`
        : '—';

    const environmentInfo = [
        {label: '操作系统', value: platformDisplay || '-'},
        {label: '内核版本', value: latestMetrics?.host?.kernelVersion || '-'},
        {label: '硬件架构', value: architectureDisplay || '-'},
        {label: 'CPU 型号', value: latestMetrics?.cpu?.modelName || '-'},
        {label: '逻辑核心', value: latestMetrics?.cpu?.logicalCores ?? '-'},
        {label: '物理核心', value: latestMetrics?.cpu?.physicalCores ?? '-'},
    ];

    const statusInfo = [
        {label: '运行时间', value: uptimeDisplay},
        {label: '启动时间', value: bootTimeDisplay},
        {label: '最近心跳', value: lastSeenDisplay},
        {label: '进程数', value: latestMetrics?.host?.procs ?? '-'},
        {label: '网络累计', value: networkSummary},
    ];

    const heroStats = [
        {label: '运行系统', value: platformDisplay || '-'},
        {label: '硬件架构', value: architectureDisplay || '-'},
        {label: '最近心跳', value: lastSeenDisplay},
        {label: '运行时长', value: uptimeDisplay},
    ];

    if (loading) {
        return <LoadingSpinner/>;
    }

    if (!agent) {
        return <EmptyState/>;
    }

    return (
        <div className="bg-slate-50">
            <div className="mx-auto flex max-w-7xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
                <section
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-xl">
                    <div
                        className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_top,rgba(255,255,255,0.35),transparent_55%)]"/>
                    <div className="relative flex flex-col gap-6">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-4">
                                <button
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:text-white"
                                >
                                    <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5"/>
                                    返回概览
                                </button>
                                <div className="flex items-start gap-4">
                                    <div
                                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                                        <Server className="h-7 w-7"/>
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h1 className="text-3xl font-semibold">{displayName}</h1>
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium ${
                                                    isOnline
                                                        ? 'bg-emerald-400/30 text-white'
                                                        : 'bg-white/20 text-white/80'
                                                }`}
                                            >
                                                <span className={`h-1.5 w-1.5 rounded-full ${statusDotStyles}`}/>
                                                {statusText}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-white/80">
                                            {agent.hostname} · {agent.ip}
                                        </p>
                                        <p className="text-xs text-white/60">公共视图 · 实时监控概览</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-2 xl:grid-cols-4">
                                {heroStats.map((stat) => (
                                    <div
                                        key={stat.label}
                                        className="rounded-2xl bg-white/10 p-4 text-left backdrop-blur"
                                    >
                                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">{stat.label}</p>
                                        <p className="mt-2 text-base font-semibold">{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
                            <span>探针 ID：{agent.id}</span>
                            <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:inline-block"/>
                            <span>版本：{agent.version || '-'}</span>
                            <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:inline-block"/>
                            <span>网络累计：{networkSummary}</span>
                        </div>
                    </div>
                </section>

                <main className="flex-1 py-10 space-y-10">
                    <Card title="系统信息" description="探针基础属性、运行状态与资源概览">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                                    <h3 className="text-sm font-semibold text-slate-700">运行环境</h3>
                                    <p className="mt-1 text-xs text-slate-500">来自最近一次探针上报的硬件与系统信息</p>
                                    <div className="mt-4">
                                        <InfoGrid items={environmentInfo}/>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                                    <h3 className="text-sm font-semibold text-slate-700">运行状态</h3>
                                    <p className="mt-1 text-xs text-slate-500">关键时间与网络指标，帮助快速判断主机健康状况</p>
                                    <div className="mt-4">
                                        <InfoGrid items={statusInfo}/>
                                    </div>
                                </div>
                            </div>
                            <SnapshotSection cards={snapshotCards}/>
                        </div>
                    </Card>

                    <Card
                        title="历史趋势"
                        description="针对选定时间范围展示 CPU、内存与网络的变化趋势"
                        action={<TimeRangeSelector value={timeRange} onChange={setTimeRange}/>}
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            <section>
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <span
                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                                        <Cpu className="h-4 w-4"/>
                                    </span>
                                    CPU 使用率
                                </h3>
                                {cpuChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={cpuChartData}>
                                            <defs>
                                                <linearGradient id="cpuAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4"/>
                                            <XAxis
                                                dataKey="time"
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                            />
                                            <YAxis
                                                domain={[0, 100]}
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                                tickFormatter={(value) => `${value}%`}
                                            />
                                            <Tooltip content={<CustomTooltip unit="%"/>}/>
                                            <Area
                                                type="monotone"
                                                dataKey="usage"
                                                name="CPU 使用率"
                                                stroke="#2563eb"
                                                strokeWidth={2}
                                                fill="url(#cpuAreaGradient)"
                                                activeDot={{r: 3}}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div
                                        className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                                        暂无数据
                                    </div>
                                )}
                            </section>

                            <section>
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <span
                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                                        <MemoryStick className="h-4 w-4"/>
                                    </span>
                                    内存使用率
                                </h3>
                                {memoryChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={memoryChartData}>
                                            <defs>
                                                <linearGradient id="memoryAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4"/>
                                            <XAxis
                                                dataKey="time"
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                            />
                                            <YAxis
                                                domain={[0, 100]}
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                                tickFormatter={(value) => `${value}%`}
                                            />
                                            <Tooltip content={<CustomTooltip unit="%"/>}/>
                                            <Area
                                                type="monotone"
                                                dataKey="usage"
                                                name="内存使用率"
                                                stroke="#10b981"
                                                strokeWidth={2}
                                                fill="url(#memoryAreaGradient)"
                                                activeDot={{r: 3}}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div
                                        className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                                        暂无数据
                                    </div>
                                )}
                            </section>

                            <section>
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <span
                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                                            <Network className="h-4 w-4"/>
                                        </span>
                                        网络流量（MB/s）
                                    </h3>
                                    {availableInterfaces.length > 0 && (
                                        <select
                                            value={selectedInterface}
                                            onChange={(e) => setSelectedInterface(e.target.value)}
                                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        >
                                            <option value="all">所有网卡</option>
                                            {availableInterfaces.map((iface) => (
                                                <option key={iface} value={iface}>
                                                    {iface}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                {networkChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={networkChartData}>
                                            <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4"/>
                                            <XAxis
                                                dataKey="time"
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                            />
                                            <YAxis
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                                tickFormatter={(value) => `${value} MB`}
                                            />
                                            <Tooltip content={<CustomTooltip unit=" MB/s"/>}/>
                                            <Legend/>
                                            {/* 动态渲染每个网卡的上行和下行曲线 */}
                                            {availableInterfaces
                                                .filter(iface => selectedInterface === 'all' || iface === selectedInterface)
                                                .map((iface, index) => {
                                                    const colorConfig = INTERFACE_COLORS[index % INTERFACE_COLORS.length];
                                                    const uploadKey = `${iface}_upload`;
                                                    const downloadKey = `${iface}_download`;
                                                    return (
                                                        <React.Fragment key={iface}>
                                                            <Line
                                                                type="monotone"
                                                                dataKey={uploadKey}
                                                                name={`${iface} 上行`}
                                                                stroke={colorConfig.upload}
                                                                strokeWidth={2}
                                                                dot={false}
                                                                activeDot={{r: 3}}
                                                            />
                                                            <Line
                                                                type="monotone"
                                                                dataKey={downloadKey}
                                                                name={`${iface} 下行`}
                                                                stroke={colorConfig.download}
                                                                strokeWidth={2}
                                                                dot={false}
                                                                activeDot={{r: 3}}
                                                            />
                                                        </React.Fragment>
                                                    );
                                                })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div
                                        className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                                        暂无数据
                                    </div>
                                )}
                            </section>

                            <section>
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <span
                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                                        <HardDrive className="h-4 w-4"/>
                                    </span>
                                    磁盘 I/O (MB/s)
                                </h3>
                                {diskIOChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={diskIOChartData}>
                                            <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4"/>
                                            <XAxis
                                                dataKey="time"
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                            />
                                            <YAxis
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                                tickFormatter={(value) => `${value} MB`}
                                            />
                                            <Tooltip content={<CustomTooltip unit=" MB"/>}/>
                                            <Legend/>
                                            <Line
                                                type="monotone"
                                                dataKey="read"
                                                name="读取"
                                                stroke="#2C70F6"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{r: 3}}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="write"
                                                name="写入"
                                                stroke="#6FD598"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{r: 3}}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div
                                        className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                                        暂无数据
                                    </div>
                                )}
                            </section>

                            {gpuChartData.length > 0 && (
                                <section>
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <span
                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                                            <Zap className="h-4 w-4"/>
                                        </span>
                                        GPU 使用率与温度
                                    </h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={gpuChartData}>
                                            <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4"/>
                                            <XAxis
                                                dataKey="time"
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                                tickFormatter={(value) => `${value}%`}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                                tickFormatter={(value) => `${value}°C`}
                                            />
                                            <Tooltip content={<CustomTooltip unit=""/>}/>
                                            <Legend/>
                                            <Line
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="utilization"
                                                name="使用率 (%)"
                                                stroke="#7c3aed"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{r: 3}}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="temperature"
                                                name="温度 (°C)"
                                                stroke="#f97316"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{r: 3}}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </section>
                            )}

                            {temperatureChartData.length > 0 && (
                                <section>
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <span
                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                                            <Thermometer className="h-4 w-4"/>
                                        </span>
                                        系统温度
                                    </h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <AreaChart data={temperatureChartData}>
                                            <defs>
                                                <linearGradient id="tempAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4"/>
                                            <XAxis
                                                dataKey="time"
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                            />
                                            <YAxis
                                                stroke="#94a3b8"
                                                style={{fontSize: '12px'}}
                                                tickFormatter={(value) => `${value}°C`}
                                            />
                                            <Tooltip content={<CustomTooltip unit="°C"/>}/>
                                            <Area
                                                type="monotone"
                                                dataKey="temperature"
                                                name="平均温度"
                                                stroke="#f97316"
                                                strokeWidth={2}
                                                fill="url(#tempAreaGradient)"
                                                activeDot={{r: 3}}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </section>
                            )}
                        </div>
                    </Card>


                    {/* GPU 监控 */}
                    {latestMetrics?.gpu && latestMetrics.gpu.length > 0 && (
                        <Card title="GPU 监控" description="显卡使用情况和温度监控">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {latestMetrics.gpu.map((gpu) => (
                                    <div
                                        key={gpu.index}
                                        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                                    >
                                        <div className="mb-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                                                    <Zap className="h-4 w-4"/>
                                                </span>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">GPU {gpu.index}</p>
                                                    <p className="text-xs text-slate-500">{gpu.name}</p>
                                                </div>
                                            </div>
                                            <span className="text-2xl font-bold text-purple-600">
                                                {gpu.utilization.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">温度</span>
                                                <span
                                                    className="font-medium text-slate-900">{gpu.temperature.toFixed(1)}°C</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">显存</span>
                                                <span className="font-medium text-slate-900">
                                                    {formatBytes(gpu.memoryUsed)} / {formatBytes(gpu.memoryTotal)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">功耗</span>
                                                <span
                                                    className="font-medium text-slate-900">{gpu.powerDraw.toFixed(1)}W</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">风扇转速</span>
                                                <span
                                                    className="font-medium text-slate-900">{gpu.fanSpeed.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* 温度监控 */}
                    {latestMetrics?.temperature && latestMetrics.temperature.length > 0 && (
                        <Card title="温度监控" description="系统各部件温度传感器数据">
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                {latestMetrics.temperature.map((temp) => (
                                    <div
                                        key={temp.sensorKey}
                                        className="rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <Thermometer className="h-4 w-4 text-orange-500"/>
                                            <p className="text-xs font-medium text-slate-600 truncate">{temp.sensorLabel}</p>
                                        </div>
                                        <p className="text-2xl font-bold text-slate-900">{temp.temperature.toFixed(1)}°C</p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ServerDetail;
