import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Activity, ArrowLeft, Cpu, HardDrive, Loader2, MemoryStick, Network, Server, Box, Thermometer, Zap, Clock, Globe} from 'lucide-react';
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
import {getAgent, getAgentLatestMetrics, getAgentMetrics, type GetAgentMetricsRequest} from '../../api/agent';
import type {
    Agent,
    AggregatedCPUMetric,
    AggregatedMemoryMetric,
    AggregatedNetworkMetric,
    AggregatedDiskMetric,
    AggregatedDiskIOMetric,
    AggregatedGPUMetric,
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
    if (seconds <= 0) return '0s';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join(' ') : '< 1m';
};

const formatDateTime = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null || value === '') {
        return '-';
    }

    const date = typeof value === 'number' ? new Date(value) : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const timeRangeOptions = [
    {label: '15m', value: '15m'},
    {label: '30m', value: '30m'},
    {label: '1h', value: '1h'},
] as const;

type TimeRange = typeof timeRangeOptions[number]['value'];

const LoadingSpinner = () => (
    <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500"/>
            <p className="text-sm text-zinc-500">Connecting to satellite...</p>
        </div>
    </div>
);

const EmptyState = ({message = 'Server unreachable or offline'}: { message?: string }) => (
    <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800">
                <Server className="h-8 w-8"/>
            </div>
            <p className="text-sm text-zinc-500">{message}</p>
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
    <section className="rounded-2xl border border-white/5 bg-zinc-900/30 backdrop-blur-sm p-6">
        {(title || description || action) && (
            <div
                className="flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-start sm:justify-between mb-6">
                <div>
                    {title ? <h2 className="text-lg font-bold text-zinc-100 tracking-tight">{title}</h2> : null}
                    {description ? <p className="mt-1 text-xs text-zinc-500">{description}</p> : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
        )}
        <div>{children}</div>
    </section>
);

type AccentVariant = 'blue' | 'emerald' | 'purple' | 'sky' | 'amber';

const accentThemes: Record<AccentVariant, { icon: string; badge: string; highlight: string }> = {
    blue: {
        icon: 'bg-blue-500/10 text-blue-400',
        badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        highlight: 'text-blue-400',
    },
    emerald: {
        icon: 'bg-emerald-500/10 text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        highlight: 'text-emerald-400',
    },
    purple: {
        icon: 'bg-purple-500/10 text-purple-400',
        badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        highlight: 'text-purple-400',
    },
    sky: {
        icon: 'bg-sky-500/10 text-sky-400',
        badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        highlight: 'text-sky-400',
    },
    amber: {
        icon: 'bg-amber-500/10 text-amber-400',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        highlight: 'text-amber-400',
    },
};

const InfoGrid = ({items}: { items: Array<{ label: string; value: ReactNode }> }) => (
    <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        {items.map((item) => (
            <div key={item.label} className="flex justify-between border-b border-white/5 pb-2 last:border-0">
                <span className="text-xs font-medium text-zinc-500">{item.label}</span>
                <span className="text-xs font-medium text-zinc-300 text-right">{item.value}</span>
            </div>
        ))}
    </div>
);

const TimeRangeSelector = ({
                               value,
                               onChange,
                           }: {
    value: TimeRange;
    onChange: (value: TimeRange) => void;
}) => (
    <div className="flex flex-wrap items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-white/5">
        {timeRangeOptions.map((option) => {
            const isActive = option.value === value;
            return (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                        isActive
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
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
                    className="rounded-xl border border-white/5 bg-white/5 p-4 transition hover:bg-white/10"
                >
                    <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${theme.icon}`}>
                                <card.icon className="h-4 w-4"/>
                            </span>
                            <p className="text-xs font-medium text-zinc-300">{card.title}</p>
                        </div>
                        <span className={`text-lg font-bold ${theme.highlight}`}>{card.usagePercent}</span>
                    </div>
                    <div className="space-y-2">
                        {card.metrics.map((metric) => (
                            <div key={metric.label} className="flex items-center justify-between text-[10px]">
                                <span className="text-zinc-500">{metric.label}</span>
                                <span className="ml-2 text-right font-mono text-zinc-300">{metric.value}</span>
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
                <h3 className="text-sm font-bold text-zinc-200">Resource Snapshot</h3>
                <p className="mt-1 text-xs text-zinc-500">Real-time metrics (5s interval)</p>
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
        <div className="rounded-lg border border-white/10 bg-zinc-900/90 backdrop-blur-md px-3 py-2 text-xs shadow-xl">
            <p className="font-medium text-zinc-400 mb-2">{label}</p>
            <div className="space-y-1">
                {payload.map((entry, index) => {
                    if (!entry) {
                        return null;
                    }

                    const dotColor = entry.stroke || entry.fill || entry.color || '#6366f1';
                    const title = entry.name ?? entry.dataKey ?? `Series ${index + 1}`;
                    const value =
                        typeof entry.value === 'number'
                            ? Number.isFinite(entry.value)
                                ? entry.value.toFixed(2)
                                : '-'
                            : entry.value;

                    return (
                        <div key={`${entry.dataKey ?? index}`} className="flex items-center gap-3">
                            <div className="flex items-center gap-2 min-w-[80px]">
                                <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: dotColor}}/>
                                <span className="text-zinc-300">{title}</span>
                            </div>
                            <span className="font-mono text-white font-medium ml-auto">
                                {value}<span className="text-zinc-500 ml-0.5">{unit}</span>
                            </span>
                        </div>
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

    const cpuChartData = useMemo(
        () =>
            metricsData.cpu.map((item) => ({
                time: new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                usage: Number(item.maxUsage.toFixed(2)),
            })),
        [metricsData.cpu]
    );

    const memoryChartData = useMemo(
        () =>
            metricsData.memory.map((item) => ({
                time: new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                usage: Number(item.maxUsage.toFixed(2)),
            })),
        [metricsData.memory]
    );

    const availableInterfaces = useMemo(() => {
        const interfaces = new Set<string>();
        metricsData.network.forEach((item) => {
            interfaces.add(item.interface);
        });
        return Array.from(interfaces).sort();
    }, [metricsData.network]);

    useEffect(() => {
        if (selectedInterface === 'all') {
            return;
        }
        if (!availableInterfaces.includes(selectedInterface)) {
            setSelectedInterface('all');
        }
    }, [availableInterfaces, selectedInterface]);

    const networkChartData = useMemo(() => {
        const aggregated: Record<string, { time: string; upload: number; download: number }> = {};

        const filteredData = selectedInterface === 'all'
            ? metricsData.network
            : metricsData.network.filter(item => item.interface === selectedInterface);

        filteredData.forEach((item) => {
            const time = new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

            if (!aggregated[time]) {
                aggregated[time] = {time, upload: 0, download: 0};
            }

            aggregated[time].upload += item.maxSentRate / 1024 / 1024;
            aggregated[time].download += item.maxRecvRate / 1024 / 1024;
        });

        return Object.values(aggregated).map((item) => ({
            ...item,
            upload: Number(item.upload.toFixed(2)),
            download: Number(item.download.toFixed(2)),
        }));
    }, [metricsData.network, selectedInterface]);

    const diskIOChartData = useMemo(() => {
        const aggregated: Record<string, { time: string; read: number; write: number }> = {};

        metricsData.diskIO.forEach((item) => {
            const time = new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

            if (!aggregated[time]) {
                aggregated[time] = {time, read: 0, write: 0};
            }

            aggregated[time].read += item.maxReadRate / 1024 / 1024;
            aggregated[time].write += item.maxWriteRate / 1024 / 1024;
        });

        return Object.values(aggregated).map((item) => ({
            ...item,
            read: Number(item.read.toFixed(2)),
            write: Number(item.write.toFixed(2)),
        }));
    }, [metricsData.diskIO]);

    const gpuChartData = useMemo(() => {
        const aggregated: Record<string, { time: string; utilization: number; temperature: number; count: number }> = {};

        metricsData.gpu.forEach((item) => {
            const time = new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

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

    const temperatureChartData = useMemo(() => {
        const aggregated: Record<string, { time: string; temperature: number; count: number }> = {};

        metricsData.temperature.forEach((item) => {
            const time = new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

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
        if (!latestMetrics) return [];

        const cards: Array<SnapshotCardData> = [];

        cards.push({
            key: 'cpu',
            icon: Cpu,
            title: 'CPU Usage',
            usagePercent: `${formatPercentValue(latestMetrics.cpu?.usagePercent)}%`,
            accent: 'blue',
            metrics: [
                {label: 'Current', value: `${formatPercentValue(latestMetrics.cpu?.usagePercent)}%`},
                {label: 'Cores', value: `${latestMetrics.cpu?.physicalCores || '-'}P / ${latestMetrics.cpu?.logicalCores || '-'}L`},
            ],
        });

        cards.push({
            key: 'memory',
            icon: MemoryStick,
            title: 'Memory',
            usagePercent: `${formatPercentValue(latestMetrics.memory?.usagePercent)}%`,
            accent: 'emerald',
            metrics: [
                {label: 'Used', value: formatBytes(latestMetrics.memory?.used)},
                {label: 'Total', value: formatBytes(latestMetrics.memory?.total)},
            ],
        });

        cards.push({
            key: 'disk',
            icon: HardDrive,
            title: 'Disk Usage',
            usagePercent: latestMetrics.disk ? `${formatPercentValue(latestMetrics.disk.avgUsagePercent)}%` : '-',
            accent: 'purple',
            metrics: [
                {label: 'Used', value: formatBytes(latestMetrics.disk?.used)},
                {label: 'Total', value: formatBytes(latestMetrics.disk?.total)},
            ],
        });

        cards.push({
            key: 'load',
            icon: Activity,
            title: 'System Load',
            usagePercent: latestMetrics.load ? `${latestMetrics.load.load1.toFixed(2)}` : '-',
            accent: 'amber',
            metrics: [
                {label: '1m / 5m / 15m', value: latestMetrics.load ? `${latestMetrics.load.load1.toFixed(2)} / ${latestMetrics.load.load5.toFixed(2)} / ${latestMetrics.load.load15.toFixed(2)}` : '-'},
                {label: 'Tasks', value: latestMetrics.host?.procs || '-'},
            ],
        });

        return cards;
    }, [latestMetrics]);

    const platformDisplay = latestMetrics?.host?.platform
        ? `${latestMetrics.host.platform} ${latestMetrics.host.platformVersion || ''}`.trim()
        : agent?.os || '-';
    const architectureDisplay = latestMetrics?.host?.kernelArch || agent?.arch || '-';
    const uptimeDisplay = formatUptime(latestMetrics?.host?.uptime);
    const lastSeenDisplay = agent ? formatDateTime(agent.lastSeenAt) : '-';
    const displayName = agent?.name?.trim() ? agent.name : 'Unnamed Node';
    const isOnline = agent?.status === 1;

    const environmentInfo = [
        {label: 'OS', value: platformDisplay},
        {label: 'Kernel', value: latestMetrics?.host?.kernelVersion || '-'},
        {label: 'Architecture', value: architectureDisplay},
        {label: 'CPU Model', value: <span className="truncate block max-w-[150px] md:max-w-[200px]" title={latestMetrics?.cpu?.modelName}>{latestMetrics?.cpu?.modelName || '-'}</span>},
    ];

    const statusInfo = [
        {label: 'Uptime', value: uptimeDisplay},
        {label: 'Last Seen', value: lastSeenDisplay},
        {label: 'IP Address', value: agent?.ip || '-'},
        {label: 'Location', value: agent?.location || 'Unknown'},
    ];

    if (loading) return <LoadingSpinner/>;
    if (!agent) return <EmptyState/>;

    return (
        <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-teal-500/30 pb-20">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black pointer-events-none" />
            
            <div className="relative z-10 mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
                {/* Header Section */}
                <div className="mb-8">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="group inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-teal-400 transition-colors mb-6"
                    >
                        <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1"/>
                        Back to Fleet
                    </button>
                    
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 shadow-2xl">
                                <Server className="h-8 w-8" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="text-3xl font-bold text-white tracking-tight">{displayName}</h1>
                                    <div className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                                        {isOnline ? 'Online' : 'Offline'}
                                    </div>
                                </div>
                                <p className="text-sm text-zinc-500 flex items-center gap-2">
                                    <span className="font-mono">{agent.id.substring(0, 8)}</span>
                                    <span>•</span>
                                    <Globe size={12} /> {agent.location || 'Global'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Grid & Snapshots */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-1 space-y-6">
                        <Card title="System Info">
                            <InfoGrid items={environmentInfo}/>
                        </Card>
                        <Card title="Status">
                            <InfoGrid items={statusInfo}/>
                        </Card>
                    </div>
                    <div className="lg:col-span-2">
                        <SnapshotSection cards={snapshotCards}/>
                    </div>
                </div>

                {/* Charts Section */}
                <Card
                    title="Performance Trends"
                    description="Historical metrics data"
                    action={<TimeRangeSelector value={timeRange} onChange={setTimeRange}/>}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        {/* CPU Chart */}
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Cpu size={14} className="text-teal-500" /> CPU Usage
                            </h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={cpuChartData}>
                                        <defs>
                                            <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                                        <Tooltip content={<CustomTooltip unit="%"/>} cursor={{stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4'}} />
                                        <Area type="monotone" dataKey="usage" stroke="#14b8a6" strokeWidth={2} fill="url(#cpuGradient)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Memory Chart */}
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <MemoryStick size={14} className="text-emerald-500" /> Memory Usage
                            </h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={memoryChartData}>
                                        <defs>
                                            <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                                        <Tooltip content={<CustomTooltip unit="%"/>} cursor={{stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4'}} />
                                        <Area type="monotone" dataKey="usage" stroke="#10b981" strokeWidth={2} fill="url(#memGradient)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Network Chart */}
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                    <Network size={14} className="text-indigo-500" /> Network Traffic
                                </h3>
                                {availableInterfaces.length > 0 && (
                                    <select
                                        value={selectedInterface}
                                        onChange={(e) => setSelectedInterface(e.target.value)}
                                        className="bg-zinc-900 text-zinc-400 text-[10px] border border-white/10 rounded px-2 py-1 outline-none focus:border-teal-500"
                                    >
                                        <option value="all">All Interfaces</option>
                                        {availableInterfaces.map(i => <option key={i} value={i}>{i}</option>)}
                                    </select>
                                )}
                            </div>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={networkChartData}>
                                        <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} MB`} />
                                        <Tooltip content={<CustomTooltip unit=" MB"/>} cursor={{stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4'}} />
                                        <Legend wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                                        <Line type="monotone" dataKey="upload" name="Upload" stroke="#14b8a6" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="download" name="Download" stroke="#6366f1" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Disk IO Chart */}
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <HardDrive size={14} className="text-rose-500" /> Disk I/O
                            </h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={diskIOChartData}>
                                        <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} MB`} />
                                        <Tooltip content={<CustomTooltip unit=" MB"/>} cursor={{stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4'}} />
                                        <Legend wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                                        <Line type="monotone" dataKey="read" name="Read" stroke="#6366f1" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="write" name="Write" stroke="#f43f5e" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ServerDetail;
