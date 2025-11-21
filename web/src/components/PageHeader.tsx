import React from 'react';
import {Button, Space} from 'antd';
import type {LucideIcon} from 'lucide-react';

export interface Action {
    key: string;
    label: string;
    icon?: React.ReactElement<LucideIcon>;
    type?: 'default' | 'primary';
    onClick: () => void;
}

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: Action[];
}

/**
 * 统一的页面头部组件
 */
export const PageHeader: React.FC<PageHeaderProps> = ({title, description, actions}) => {
    return (
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-white/5 pb-6">
            <div>
                <div className="relative">
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-200 to-teal-500 bg-clip-text text-transparent w-fit">
                        {title}
                    </h1>
                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-500/50 rounded-full blur-[2px]" />
                </div>
                {description && <p className="mt-2 text-base text-slate-400 max-w-2xl">{description}</p>}
            </div>
            {actions && actions.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    {actions.map((action) => (
                        <Button
                            key={action.key}
                            type={action.type || 'default'}
                            icon={action.icon}
                            onClick={action.onClick}
                            className={action.type !== 'primary' ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/20' : ''}
                        >
                            {action.label}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
};
