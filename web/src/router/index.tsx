import {createBrowserRouter, Navigate} from 'react-router-dom';
import {type ComponentType, lazy, type LazyExoticComponent, Suspense} from 'react';
import PrivateRoute from '../components/PrivateRoute';

const LoginPage = lazy(() => import('../pages/Login'));
const GitHubCallbackPage = lazy(() => import('../pages/Login/GitHubCallback'));
const OIDCCallbackPage = lazy(() => import('../pages/Login/OIDCCallback'));
const PublicLayout = lazy(() => import('../pages/PublicLayout'));
const AdminLayout = lazy(() => import('../pages/AdminLayout'));
const AgentListPage = lazy(() => import('../pages/Agents/AgentList'));
const AgentDetailPage = lazy(() => import('../pages/Agents/AgentDetail'));
const AgentInstallPage = lazy(() => import('../pages/Agents/AgentInstall'));
const ApiKeyListPage = lazy(() => import('../pages/ApiKeys/ApiKeyList'));
const SettingsPage = lazy(() => import('../pages/Settings'));
const ServerListPage = lazy(() => import('../pages/Public/ServerList'));
const ServerDetailPage = lazy(() => import('../pages/Public/ServerDetail'));
const PublicMonitorListPage = lazy(() => import('../pages/Public/MonitorList'));
const PublicMonitorDetailPage = lazy(() => import('../pages/Public/MonitorDetail'));
const MonitorListPage = lazy(() => import('../pages/Monitors/MonitorList'));

const LoadingFallback = () => (
    <div className="flex min-h-[200px] w-full items-center justify-center text-gray-500">
        页面加载中...
    </div>
);

const lazyLoad = (Component: LazyExoticComponent<ComponentType<any>>) => (
    <Suspense fallback={<LoadingFallback/>}>
        <Component/>
    </Suspense>
);

const router = createBrowserRouter([
    // 登录页面
    {
        path: '/login',
        element: lazyLoad(LoginPage),
    },
    {
        path: '/github/callback',
        element: lazyLoad(GitHubCallbackPage),
    },
    {
        path: '/oidc/callback',
        element: lazyLoad(OIDCCallbackPage),
    },
    // 公开页面 - 不需要登录
    {
        element: lazyLoad(PublicLayout),
        children: [
            {
                path: '/',
                element: lazyLoad(ServerListPage),
            },
            {
                path: '/servers/:id',
                element: lazyLoad(ServerDetailPage),
            },
            {
                path: '/monitors',
                element: lazyLoad(PublicMonitorListPage),
            },
            {
                path: '/monitors/:id',
                element: lazyLoad(PublicMonitorDetailPage),
            },
        ],
    },
    // 管理员页面 - 需要登录
    {
        path: '/admin',
        element: (
            <PrivateRoute>
                {lazyLoad(AdminLayout)}
            </PrivateRoute>
        ),
        children: [
            {
                index: true,
                element: <Navigate to="/admin/agents" replace/>,
            },
            {
                path: 'agents',
                element: lazyLoad(AgentListPage),
            },
            {
                path: 'agents/:id',
                element: lazyLoad(AgentDetailPage),
            },
            {
                path: 'agents-install',
                element: lazyLoad(AgentInstallPage),
            },
            {
                path: 'api-keys',
                element: lazyLoad(ApiKeyListPage),
            },
            {
                path: 'monitors',
                element: lazyLoad(MonitorListPage),
            },
            {
                path: 'settings',
                element: lazyLoad(SettingsPage),
            },
        ],
    },
]);

export default router;
