import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {AlertCircle, CheckCircle2, Clock, Loader2, Shield, Activity, ExternalLink} from 'lucide-react';
import {getPublicMonitors} from '../../api/monitor';
import type {PublicMonitor} from '../../types';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';

type ViewMode = 'grid' | 'list';

const formatTime = (ms: number): string => {
    if (!ms || ms <= 0) return '0 ms';
    if (ms < 1000) return `${ms.toFixed(0)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
};

const formatDate = (timestamp: number): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const StatusBadge = ({status}: { status: string }) => {
    if (status === 'up') {
        return (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-medium tracking-wide uppercase">Operational</span>
            </div>
        );
    } 
    
    if (status === 'down') {
        return (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span className="text-[11px] font-medium tracking-wide uppercase">Downtime</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-400">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <span className="text-[11px] font-medium tracking-wide uppercase">Unknown</span>
        </div>
    );
};

const UptimeBar = ({uptime}: { uptime: number }) => {
    const percentage = Math.min(Math.max(uptime, 0), 100);
    const colorClass = percentage >= 99 ? 'bg-emerald-500' : percentage >= 95 ? 'bg-amber-500' : 'bg-rose-500';

    return (
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/50">
            <div
                className={`absolute inset-y-0 left-0 ${colorClass} transition-all duration-500 rounded-full`}
                style={{width: `${percentage}%`}}
            />
        </div>
    );
};

const MonitorCard = ({ stats, onClick }: { stats: PublicMonitor, onClick: () => void }) => {
    const hasCert = stats.certExpiryDate > 0;
    const certExpiringSoon = hasCert && stats.certExpiryDays < 30;

    return (
        <div 
            onClick={onClick}
            className="group relative flex flex-col gap-4 p-5 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-teal-500/30 hover:bg-zinc-900/60 transition-all duration-300 cursor-pointer backdrop-blur-sm"
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center text-teal-500 shadow-inner group-hover:text-teal-400 group-hover:border-teal-500/20 transition-colors">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-100 text-sm group-hover:text-teal-400 transition-colors">
                            {stats.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                            <span className="truncate max-w-[150px]">{stats.showTargetPublic ? stats.target : 'Target Hidden'}</span>
                            {stats.agentCount > 1 && (
                                <>
                                    <span>•</span>
                                    <span>{stats.agentCount} Nodes</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <StatusBadge status={stats.lastCheckStatus} />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Response Time</span>
                    <div className="flex items-end gap-1.5">
                        <span className="text-lg font-bold text-zinc-200">{formatTime(stats.currentResponse)}</span>
                        <span className="text-[10px] text-zinc-500 mb-1">avg {formatTime(stats.avgResponse24h)}</span>
                    </div>
                </div>
                
                {hasCert ? (
                    <div className={`p-3 rounded-xl border flex flex-col gap-1 ${certExpiringSoon ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/5'}`}>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium flex items-center gap-1">
                            <Shield size={10} /> SSL Certificate
                        </span>
                        <div className="flex items-end gap-1.5">
                            <span className={`text-sm font-bold ${certExpiringSoon ? 'text-amber-400' : 'text-zinc-200'}`}>
                                {stats.certExpiryDays} days
                            </span>
                            <span className="text-[10px] text-zinc-500 mb-0.5">remaining</span>
                        </div>
                    </div>
                ) : (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Uptime (24h)</span>
                        <span className="text-lg font-bold text-zinc-200">{stats.uptime24h.toFixed(2)}%</span>
                    </div>
                )}
            </div>

            <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>24h Uptime</span>
                        <span className="text-zinc-200">{stats.uptime24h.toFixed(3)}%</span>
                    </div>
                    <UptimeBar uptime={stats.uptime24h} />
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>30d Uptime</span>
                        <span className="text-zinc-200">{stats.uptime30d.toFixed(3)}%</span>
                    </div>
                    <UptimeBar uptime={stats.uptime30d} />
                </div>
            </div>
        </div>
    );
};

const StatsOverview = ({ monitors }: { monitors: PublicMonitor[] }) => {
    const total = monitors.length;
    const up = monitors.filter(m => m.lastCheckStatus === 'up').length;
    const down = monitors.filter(m => m.lastCheckStatus === 'down').length;
    const avgUptime = total > 0 ? monitors.reduce((acc, curr) => acc + curr.uptime24h, 0) / total : 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
                { label: 'Total Monitors', value: total, sub: 'Active Checks', color: 'text-zinc-100' },
                { label: 'Operational', value: up, sub: 'Systems Normal', color: 'text-emerald-400' },
                { label: 'Incidents', value: down, sub: 'Current Issues', color: down > 0 ? 'text-rose-400' : 'text-zinc-400' },
                { label: 'Avg Uptime (24h)', value: `${avgUptime.toFixed(2)}%`, sub: 'Global Availability', color: 'text-teal-400' },
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

const MonitorList = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<ViewMode>('grid');

    const {data: monitors = [], isLoading, dataUpdatedAt} = useQuery<PublicMonitor[]>({
        queryKey: ['publicMonitors'],
        queryFn: async () => {
            const response = await getPublicMonitors();
            return response.data || [];
        },
        refetchInterval: 30000,
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
                    title="Service Status"
                    lastUpdated={lastUpdated}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showViewToggle={true}
                />

                <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                    <StatsOverview monitors={monitors} />

                    {monitors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
                            <Activity size={48} className="mb-4 opacity-20" />
                            <p>No monitors configured</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {monitors.map(monitor => (
                                <MonitorCard 
                                    key={monitor.id} 
                                    stats={monitor} 
                                    onClick={() => navigate(`/monitors/${encodeURIComponent(monitor.id)}`)} 
                                />
                            ))}
                        </div>
                    )}
                </main>

                <PublicFooter/>
            </div>
        </div>
    );
};

export default MonitorList;
