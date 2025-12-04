import {Outlet, useOutletContext} from 'react-router-dom';
import {useState, useEffect} from 'react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

type ViewMode = 'grid' | 'list';

interface PublicLayoutContextType {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    showViewToggle: boolean;
    setShowViewToggle: (show: boolean) => void;
}

const getInitialViewMode = (): ViewMode => {
    // 检查是否为移动端（屏幕宽度小于 1024px）
    const isMobile = window.innerWidth < 1024;

    // 移动端默认使用 grid 视图
    if (isMobile) {
        return 'grid';
    }

    // 桌面端使用配置的默认视图
    return window.SystemConfig?.DefaultView === 'list' ? 'list' : 'grid';
};

const PublicLayout = () => {
    const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode());
    const [showViewToggle, setShowViewToggle] = useState(false);

    // 监听窗口大小变化，在移动端和桌面端切换时调整视图
    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth < 1024;
            if (isMobile && viewMode === 'list') {
                setViewMode('grid');
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [viewMode]);

    return (
        <div className="min-h-screen text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
            <PublicHeader
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showViewToggle={showViewToggle}
            />
            <main className="flex-1">
                <Outlet context={{viewMode, setViewMode, showViewToggle, setShowViewToggle}}/>
            </main>
            <PublicFooter/>
        </div>
    );
};

export function usePublicLayout() {
    return useOutletContext<PublicLayoutContextType>();
}

export default PublicLayout;
