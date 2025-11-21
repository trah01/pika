import {Activity, Github, Heart, Server} from 'lucide-react';

const PublicFooter = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="border-t border-white/5 bg-slate-950/50 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* 底部版权信息 */}
                <div className="py-6">
                    <div className="flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
                        <div className="flex items-center gap-1">
                            <span>© {currentYear} Pika Monitor</span>
                            <span className="text-slate-700">·</span>
                            <span>保持洞察，稳定运行</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span>用</span>
                            <Heart className="h-3 w-3 fill-rose-500 text-rose-500 animate-pulse"/>
                            <span>构建</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default PublicFooter;
