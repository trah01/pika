import {type ReactNode, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Cpu, HardDrive, LayoutGrid, List, Loader2, MemoryStick, Server, ArrowUp, ArrowDown, Globe, Clock} from 'lucide-react';
import {listAgents} from '../../api/agent';
import type {Agent, LatestMetrics} from '../../types';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';

interface AgentWithMetrics extends Agent {
    metrics?: LatestMetrics;
}

type ViewMode = 'grid' | 'list';

// --- Formatters ---
const formatSpeed = (bytesPerSecond: number): string => {
    if (!bytesPerSecond || bytesPerSecond <= 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
    const i = Math.min(Math.floor(Math.log(bytesPerSecond) / Math.log(k)), sizes.length - 1);
    return `${(bytesPerSecond / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// --- Components ---

const StatusBadge = ({ status }: { status: number }) => (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${
        status === 1 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
    }`}>
        <div className={`w-1.5 h-1.5 rounded-full ${status === 1 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
        <span className="text-[11px] font-medium tracking-wide uppercase">{status === 1 ? 'Operational' : 'Offline'}</span>
    </div>
);

const MetricCard = ({ icon: Icon, label, value, subValue, percent, colorClass }: any) => (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/5">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400">
                <Icon size={14} />
                <span className="text-xs font-medium">{label}</span>
            </div>
            <span className="text-xs font-bold text-zinc-200">{percent}%</span>
        </div>
        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div 
                className={`h-full ${colorClass} transition-all duration-500`} 
                style={{ width: `${Math.min(percent, 100)}%` }} 
            />
        </div>
        <div className="flex justify-between items-center text-[10px] text-zinc-500">
            <span>{value}</span>
            <span>{subValue}</span>
        </div>
    </div>
);

const NetworkStat = ({ up, down }: { up: number, down: number }) => (
    <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-zinc-400">
            <ArrowUp size={12} className="text-teal-400" />
            <span className="font-mono text-zinc-300">{formatSpeed(up)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
            <ArrowDown size={12} className="text-indigo-400" />
            <span className="font-mono text-zinc-300">{formatSpeed(down)}</span>
        </div>
    </div>
);

const ServerCard = ({ agent, onClick }: { agent: AgentWithMetrics, onClick: () => void }) => {
    const cpuUsage = agent.metrics?.cpu?.usagePercent ?? 0;
    const memoryUsage = agent.metrics?.memory?.usagePercent ?? 0;
    const diskUsage = agent.metrics?.disk?.avgUsagePercent ?? 0;
    
    const netUp = agent.metrics?.network?.totalBytesSentRate ?? 0;
    const netDown = agent.metrics?.network?.totalBytesRecvRate ?? 0;

    return (
        <div 
            onClick={onClick}
            className="group relative flex flex-col gap-5 p-5 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-teal-500/30 hover:bg-zinc-900/60 transition-all duration-300 cursor-pointer backdrop-blur-sm"
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center text-teal-500 shadow-inner">
                        <Server size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-100 text-sm group-hover:text-teal-400 transition-colors">
                            {agent.name || agent.hostname}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                            <span className="flex items-center gap-1"><Globe size={10} /> {agent.location || 'Unknown Location'}</span>
                            <span>•</span>
                            <span>{agent.os}</span>
                        </div>
                    </div>
                </div>
                <StatusBadge status={agent.status} />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
                <MetricCard 
                    icon={Cpu} 
                    label="CPU" 
                    percent={cpuUsage.toFixed(1)} 
                    value={`${agent.metrics?.cpu?.physicalCores || 0}C/${agent.metrics?.cpu?.logicalCores || 0}T`}
                    colorClass="bg-teal-500" 
                />
                <MetricCard 
                    icon={MemoryStick} 
                    label="RAM" 
                    percent={memoryUsage.toFixed(1)} 
                    value={formatBytes(agent.metrics?.memory?.used || 0)}
                    subValue={formatBytes(agent.metrics?.memory?.total || 0)}
                    colorClass="bg-indigo-500" 
                />
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <NetworkStat up={netUp} down={netDown} />
                <div className="text-[10px] text-zinc-600 font-mono flex items-center gap-1">
                    <Clock size={10} />
                    {agent.metrics?.bootTime ? new Date(agent.metrics.bootTime * 1000).toLocaleDateString() : 'Unknown'}
                </div>
            </div>
        </div>
    );
};

const ServerListItem = ({ agent, onClick }: { agent: AgentWithMetrics, onClick: () => void }) => {
    const cpuUsage = agent.metrics?.cpu?.usagePercent ?? 0;
    const memoryUsage = agent.metrics?.memory?.usagePercent ?? 0;
    const diskUsage = agent.metrics?.disk?.avgUsagePercent ?? 0;
    const netUp = agent.metrics?.network?.totalBytesSentRate ?? 0;
    const netDown = agent.metrics?.network?.totalBytesRecvRate ?? 0;

    return (
        <div 
            onClick={onClick}
            className="group grid grid-cols-12 gap-4 items-center p-4 rounded-xl bg-zinc-900/20 border border-white/5 hover:bg-white/5 transition-all cursor-pointer"
        >
            <div className="col-span-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-teal-400 transition-colors">
                    <Server size={16} />
                </div>
                <div>
                    <div className="font-medium text-sm text-zinc-200 group-hover:text-teal-400 transition-colors">{agent.name || agent.hostname}</div>
                    <div className="text-[10px] text-zinc-500">{agent.location} • {agent.ip}</div>
                </div>
            </div>

            <div className="col-span-2 flex items-center gap-2">
                <StatusBadge status={agent.status} />
            </div>

            <div className="col-span-2">
                <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-500">CPU</span>
                    <span className="text-zinc-300">{cpuUsage.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${cpuUsage}%` }} />
                </div>
            </div>

            <div className="col-span-2">
                 <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-500">RAM</span>
                    <span className="text-zinc-300">{memoryUsage.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${memoryUsage}%` }} />
                </div>
            </div>

            <div className="col-span-3 flex justify-end">
                <NetworkStat up={netUp} down={netDown} />
            </div>
        </div>
    );
};

const StatsOverview = ({ agents }: { agents: AgentWithMetrics[] }) => {
    const total = agents.length;
    const online = agents.filter(a => a.status === 1).length;
    const totalCores = agents.reduce((acc, curr) => acc + (curr.metrics?.cpu?.logicalCores || 0), 0);
    const totalRam = agents.reduce((acc, curr) => acc + (curr.metrics?.memory?.total || 0), 0);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
                { label: 'Total Servers', value: total, sub: 'Monitored', color: 'text-zinc-100' },
                { label: 'Online Status', value: `${((online/total || 0)*100).toFixed(0)}%`, sub: `${online}/${total} Online`, color: 'text-emerald-400' },
                { label: 'Total Cores', value: totalCores, sub: 'Logical CPU', color: 'text-teal-400' },
                { label: 'Total Memory', value: formatBytes(totalRam), sub: 'Aggregate RAM', color: 'text-indigo-400' },
            ].map((stat, i) => (
                <div key={i} className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 backdrop-blur-sm">
                    <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">{stat.label}</div>
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-[10px] text-zinc-600 mt-1">{stat.sub}</div>
                </div>
            ))}
        </div>
    );
};

const ServerList = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<ViewMode>('grid');

    const {data: agents = [], isLoading, dataUpdatedAt} = useQuery<AgentWithMetrics[]>({
        queryKey: ['agents', 'online'],
        queryFn: async () => {
            const response = await listAgents();
            return (response.data.items || []) as AgentWithMetrics[];
        },
        refetchInterval: 5000,
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-teal-500" size={32} />
            </div>
        );
    }

    const lastUpdated = dataUpdatedAt 
        ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour12: false }) 
        : '--:--:--';

    return (
        <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-teal-500/30">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black pointer-events-none" />
            
            <div className="relative z-10">
                <PublicHeader
                    title="Infrastructure Status"
                    lastUpdated={lastUpdated}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showViewToggle={true}
                />

                <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                    <StatsOverview agents={agents} />

                    {agents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
                            <HardDrive size={48} className="mb-4 opacity-20" />
                            <p>No servers connected</p>
                        </div>
                    ) : (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {agents.map(agent => (
                                    <ServerCard 
                                        key={agent.id} 
                                        agent={agent} 
                                        onClick={() => navigate(`/servers/${agent.id}`)} 
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {agents.map(agent => (
                                    <ServerListItem 
                                        key={agent.id} 
                                        agent={agent} 
                                        onClick={() => navigate(`/servers/${agent.id}`)} 
                                    />
                                ))}
                            </div>
                        )
                    )}
                </main>
                
                <PublicFooter />
            </div>
        </div>
    );
};

export default ServerList;
