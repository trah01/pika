import {Outlet, useOutletContext} from 'react-router-dom';
import {useState} from 'react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

type ViewMode = 'grid' | 'list';

interface PublicLayoutContextType {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    showViewToggle: boolean;
    setShowViewToggle: (show: boolean) => void;
}

const PublicLayout = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [showViewToggle, setShowViewToggle] = useState(false);

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
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
