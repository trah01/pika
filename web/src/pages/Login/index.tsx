import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {App, Button, Form, Input} from 'antd';
import {GithubOutlined, GlobalOutlined, LockOutlined, UserOutlined} from '@ant-design/icons';
import {getAuthConfig, getGitHubAuthURL, getOIDCAuthURL, login} from '@/api/auth.ts';
import type {LoginRequest} from '@/types';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [oidcEnabled, setOidcEnabled] = useState(false);
    const [githubEnabled, setGithubEnabled] = useState(false);
    const [oidcLoading, setOidcLoading] = useState(false);
    const [githubLoading, setGithubLoading] = useState(false);
    const navigate = useNavigate();
    const {message: messageApi} = App.useApp();

    useEffect(() => {
        fetchAuthConfig();
    }, []);

    const fetchAuthConfig = async () => {
        try {
            const response = await getAuthConfig();
            setOidcEnabled(response.data.oidcEnabled);
            setGithubEnabled(response.data.githubEnabled);
        } catch (error) {
            console.error('获取认证配置失败:', error);
        }
    };

    const onFinish = async (values: LoginRequest) => {
        setLoading(true);
        try {
            const response = await login(values);
            const {token, user} = response.data;
            localStorage.setItem('token', token);
            localStorage.setItem('userInfo', JSON.stringify(user));
            messageApi.success('欢迎回来');
            navigate('/admin/agents');
        } catch (error: any) {
            messageApi.error(error.response?.data?.message || '账号或密码错误');
        } finally {
            setLoading(false);
        }
    };

    const handleOIDCLogin = async () => {
        setOidcLoading(true);
        try {
            const response = await getOIDCAuthURL();
            window.location.href = response.data.authUrl;
        } catch (error: any) {
            messageApi.error('OIDC 跳转失败');
            setOidcLoading(false);
        }
    };

    const handleGitHubLogin = async () => {
        setGithubLoading(true);
        try {
            const response = await getGitHubAuthURL();
            window.location.href = response.data.authUrl;
        } catch (error: any) {
            messageApi.error('GitHub 跳转失败');
            setGithubLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-4">

            <div className="w-full max-w-[400px] glass p-8 sm:p-10 rounded-2xl shadow-2xl ring-1 ring-white/50">

                <div className="mb-10 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {window.SystemConfig.SystemNameZh}
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        保持洞察，稳定运行
                    </p>
                </div>

                <Form
                    name="login"
                    layout="vertical"
                    
                    onFinish={onFinish}
                    autoComplete="off"
                    requiredMark={false}
                >
                    <Form.Item
                        name="username"
                        rules={[{required: true, message: '请输入用户名'}]}
                        className="mb-4"
                    >
                        <Input
                            prefix={<UserOutlined className="text-slate-500 mr-1"/>}
                            placeholder="用户名"
                            className="rounded-xl px-4 py-2.5 bg-white/40 border-white/40 hover:bg-white/60 focus:bg-white/80 transition-all placeholder:text-slate-400"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{required: true, message: '请输入密码'}]}
                        className="mb-6"
                    >
                        <Input.Password
                            prefix={<LockOutlined className="text-slate-500 mr-1"/>}
                            placeholder="密码"
                            className="rounded-xl px-4 py-2.5 bg-white/40 border-white/40 hover:bg-white/60 focus:bg-white/80 transition-all placeholder:text-slate-400"
                        />
                    </Form.Item>

                    <Form.Item className="mb-0">
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            className="h-11 rounded-xl bg-slate-900/90 hover:bg-slate-800 border-none font-medium shadow-lg shadow-slate-900/20 transition-all"
                        >
                            登 录
                        </Button>
                    </Form.Item>
                </Form>

                {(oidcEnabled || githubEnabled) && (
                    <div className="mt-8">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-300/50"/>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="px-2 text-slate-500 font-medium drop-shadow-sm">或者</span>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            {githubEnabled && (
                                <Button
                                    block
                                    loading={githubLoading}
                                    icon={<GithubOutlined/>}
                                    onClick={handleGitHubLogin}
                                    className={`h-10 rounded-xl bg-white/40 border-white/40 text-slate-700 font-medium hover:bg-white/60 hover:text-slate-900 shadow-sm ${!oidcEnabled ? 'col-span-2' : ''}`}
                                >
                                    GitHub
                                </Button>
                            )}
                            {oidcEnabled && (
                                <Button
                                    block
                                    loading={oidcLoading}
                                    icon={<GlobalOutlined/>}
                                    onClick={handleOIDCLogin}
                                    className={`h-10 rounded-xl bg-white/40 border-white/40 text-slate-700 font-medium hover:bg-white/60 hover:text-slate-900 shadow-sm ${!githubEnabled ? 'col-span-2' : ''}`}
                                >
                                    OIDC
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;