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
        <div className="min-h-screen bg-slate-950">
            <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 py-10">
                <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-1">
                    <div className="rounded-[26px] bg-white p-8 shadow-2xl sm:p-10">
                        <div className="mb-8 text-center">
                            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-xs font-medium text-slate-600">
                                <Sparkles className="h-4 w-4 text-teal-600"/>
                                Pika Monitor
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold text-slate-900">登录 Pika 控制台</h1>
                            <p className="mt-2 text-sm text-slate-500">面向探针的统一监控后台</p>
                        </div>

                        <Form
                            name="login"
                            layout="vertical"
                            size="large"
                            onFinish={onFinish}
                            autoComplete="off"
                        >
                            <Form.Item
                                label="用户名"
                                name="username"
                                rules={[{required: true, message: '请输入用户名'}]}
                            >
                                <Input
                                    prefix={<UserOutlined/>}
                                    placeholder="请输入用户名"
                                />
                            </Form.Item>

                            <Form.Item
                                label="密码"
                                name="password"
                                rules={[{required: true, message: '请输入密码'}]}
                            >
                                <Input.Password
                                    prefix={<LockOutlined/>}
                                    placeholder="请输入密码"
                                />
                            </Form.Item>

                            <Form.Item className="mb-0">
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={loading}
                                    block
                                    size="large"
                                    className="h-12 rounded-2xl text-base font-semibold"
                                >
                                    登录
                                </Button>
                            </Form.Item>
                        </Form>

                        {(oidcEnabled || githubEnabled) && (
                            <div className="mt-8">
                                <Divider plain className="text-xs text-slate-400">其他登录方式</Divider>
                                <div className="mt-4 space-y-3">
                                    {githubEnabled && (
                                        <Button
                                            block
                                            loading={githubLoading}
                                            icon={<GithubOutlined/>}
                                            onClick={handleGitHubLogin}
                                            size="large"
                                            className="h-12 rounded-2xl border-slate-200 text-slate-800 hover:border-slate-300"
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
                                            className="h-12 rounded-2xl border-slate-200 text-slate-800 hover:border-slate-300"
                                        >
                                            OIDC 登录
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        <p className="mt-8 text-center text-xs text-slate-400">
                            登录即表示同意平台安全策略
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
