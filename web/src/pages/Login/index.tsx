import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {App, Button, Divider, Form, Input} from 'antd';
import {LockOutlined, UserOutlined, GithubOutlined} from '@ant-design/icons';
import {Sparkles} from 'lucide-react';
import {getAuthConfig, getOIDCAuthURL, getGitHubAuthURL, login} from '../../api/auth';
import type {LoginRequest} from '../../types';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [oidcEnabled, setOidcEnabled] = useState(false);
    const [githubEnabled, setGithubEnabled] = useState(false);
    const [oidcLoading, setOidcLoading] = useState(false);
    const [githubLoading, setGithubLoading] = useState(false);
    const navigate = useNavigate();
    const {message: messageApi} = App.useApp();

    // 获取认证配置
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

            // 保存 token 和用户信息
            localStorage.setItem('token', token);
            localStorage.setItem('userInfo', JSON.stringify(user));

            messageApi.success('登录成功');
            navigate('/admin/agents');
        } catch (error: any) {
            messageApi.error(error.response?.data?.message || '登录失败，请检查用户名和密码');
        } finally {
            setLoading(false);
        }
    };

    const handleOIDCLogin = async () => {
        setOidcLoading(true);
        try {
            const response = await getOIDCAuthURL();
            const {authUrl} = response.data;
            // 跳转到 OIDC 认证页面
            window.location.href = authUrl;
        } catch (error: any) {
            messageApi.error(error.response?.data?.message || '获取 OIDC 认证地址失败');
            setOidcLoading(false);
        }
    };

    const handleGitHubLogin = async () => {
        setGithubLoading(true);
        try {
            const response = await getGitHubAuthURL();
            const {authUrl} = response.data;
            // 跳转到 GitHub 认证页面
            window.location.href = authUrl;
        } catch (error: any) {
            messageApi.error(error.response?.data?.message || '获取 GitHub 认证地址失败');
            setGithubLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-black">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative w-full max-w-md px-4">
                <div className="relative rounded-3xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl p-8 shadow-2xl shadow-black/50 sm:p-10">
                    
                    {/* Header */}
                    <div className="mb-10 text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-teal-300 mb-6">
                            <Sparkles className="h-3.5 w-3.5"/>
                            <span>Pika Monitor</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">欢迎回来</h1>
                        <p className="mt-3 text-sm text-zinc-400">登录以管理您的监控探针</p>
                    </div>

                    <Form
                        name="login"
                        layout="vertical"
                        size="large"
                        onFinish={onFinish}
                        autoComplete="off"
                        requiredMark={false}
                    >
                        <Form.Item
                            label={<span className="text-zinc-300">用户名</span>}
                            name="username"
                            rules={[{required: true, message: '请输入用户名'}]}
                        >
                            <Input
                                prefix={<UserOutlined className="text-zinc-500"/>}
                                placeholder="请输入用户名"
                                className="!bg-black/50 !border-white/10 !text-white placeholder:!text-zinc-600 hover:!border-teal-500/50 focus:!border-teal-500"
                            />
                        </Form.Item>

                        <Form.Item
                            label={<span className="text-zinc-300">密码</span>}
                            name="password"
                            rules={[{required: true, message: '请输入密码'}]}
                        >
                            <Input.Password
                                prefix={<LockOutlined className="text-zinc-500"/>}
                                placeholder="请输入密码"
                                className="!bg-black/50 !border-white/10 !text-white placeholder:!text-zinc-600 hover:!border-teal-500/50 focus:!border-teal-500"
                            />
                        </Form.Item>

                        <Form.Item className="mb-0 pt-2">
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                block
                                size="large"
                                className="!h-12 !rounded-xl !bg-gradient-to-r !from-teal-500 !to-emerald-600 !text-white !font-semibold hover:!from-teal-400 hover:!to-emerald-500 border-none shadow-lg shadow-teal-500/20"
                            >
                                登录
                            </Button>
                        </Form.Item>
                    </Form>

                    {(oidcEnabled || githubEnabled) && (
                        <div className="mt-8">
                            <Divider plain className="!text-xs !text-zinc-500 !border-white/10">其他登录方式</Divider>
                            <div className="mt-6 space-y-3">
                                {githubEnabled && (
                                    <Button
                                        block
                                        loading={githubLoading}
                                        icon={<GithubOutlined/>}
                                        onClick={handleGitHubLogin}
                                        size="large"
                                        className="!h-12 !rounded-xl !bg-white/5 !border-white/10 !text-zinc-300 hover:!bg-white/10 hover:!text-white hover:!border-white/20"
                                    >
                                        GitHub 登录
                                    </Button>
                                )}
                                {oidcEnabled && (
                                    <Button
                                        block
                                        loading={oidcLoading}
                                        onClick={handleOIDCLogin}
                                        size="large"
                                        className="!h-12 !rounded-xl !bg-white/5 !border-white/10 !text-zinc-300 hover:!bg-white/10 hover:!text-white hover:!border-white/20"
                                    >
                                        OIDC 登录
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <p className="mt-8 text-center text-xs text-zinc-500">
                    © 2024 Pika Monitor. All rights reserved.
                </p>
            </div>
        </div>
    );
};

export default Login;
