import {useEffect} from 'react';
import {App, Button, Card, Form, Input, Space, Spin, Switch} from 'antd';
import {TestTube} from 'lucide-react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NotificationChannel} from '../../types';
import {
    getNotificationChannels,
    saveNotificationChannels,
    testNotificationChannel,
} from '../../api/notification-channel';
import {getErrorMessage} from '../../lib/utils';

const NotificationChannels = () => {
    const [form] = Form.useForm();
    const {message: messageApi} = App.useApp();
    const queryClient = useQueryClient();

    // 获取通知渠道列表
    const {data: channels = [], isLoading} = useQuery({
        queryKey: ['notificationChannels'],
        queryFn: getNotificationChannels,
    });

    // 保存 mutation
    const saveMutation = useMutation({
        mutationFn: saveNotificationChannels,
        onSuccess: () => {
            messageApi.success('保存成功');
            queryClient.invalidateQueries({queryKey: ['notificationChannels']});
        },
        onError: (error: unknown) => {
            messageApi.error(getErrorMessage(error, '保存失败'));
        },
    });

    // 测试 mutation
    const testMutation = useMutation({
        mutationFn: testNotificationChannel,
        onSuccess: () => {
            messageApi.success('测试通知已发送');
        },
        onError: (error: unknown) => {
            messageApi.error(getErrorMessage(error, '测试失败'));
        },
    });

    // 将渠道数组转换为表单值
    useEffect(() => {
        if (channels.length > 0) {
            const formValues: Record<string, any> = {};

            channels.forEach((channel) => {
                if (channel.type === 'dingtalk') {
                    formValues.dingtalkEnabled = channel.enabled;
                    formValues.dingtalkSecretKey = channel.config?.secretKey || '';
                    formValues.dingtalkSignSecret = channel.config?.signSecret || '';
                } else if (channel.type === 'wecom') {
                    formValues.wecomEnabled = channel.enabled;
                    formValues.wecomSecretKey = channel.config?.secretKey || '';
                } else if (channel.type === 'feishu') {
                    formValues.feishuEnabled = channel.enabled;
                    formValues.feishuSecretKey = channel.config?.secretKey || '';
                    formValues.feishuSignSecret = channel.config?.signSecret || '';
                } else if (channel.type === 'webhook') {
                    formValues.webhookEnabled = channel.enabled;
                    formValues.webhookUrl = channel.config?.url || '';
                }
            });

            form.setFieldsValue(formValues);
        }
    }, [channels, form]);

    // 将表单值转换回渠道数组
    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const newChannels: NotificationChannel[] = [];

            // 钉钉
            if (values.dingtalkEnabled || values.dingtalkSecretKey) {
                newChannels.push({
                    type: 'dingtalk',
                    enabled: values.dingtalkEnabled || false,
                    config: {
                        secretKey: values.dingtalkSecretKey || '',
                        signSecret: values.dingtalkSignSecret || '',
                    },
                });
            }

            // 企业微信
            if (values.wecomEnabled || values.wecomSecretKey) {
                newChannels.push({
                    type: 'wecom',
                    enabled: values.wecomEnabled || false,
                    config: {
                        secretKey: values.wecomSecretKey || '',
                    },
                });
            }

            // 飞书
            if (values.feishuEnabled || values.feishuSecretKey) {
                newChannels.push({
                    type: 'feishu',
                    enabled: values.feishuEnabled || false,
                    config: {
                        secretKey: values.feishuSecretKey || '',
                        signSecret: values.feishuSignSecret || '',
                    },
                });
            }

            // 自定义Webhook
            if (values.webhookEnabled || values.webhookUrl) {
                newChannels.push({
                    type: 'webhook',
                    enabled: values.webhookEnabled || false,
                    config: {
                        url: values.webhookUrl || '',
                    },
                });
            }

            saveMutation.mutate(newChannels);
        } catch (error) {
            // 表单验证失败
        }
    };

    const handleTest = (type: string) => {
        testMutation.mutate(type);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Spin size="large"/>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-200">通知渠道管理</h2>
                <p className="text-slate-400 mt-2">配置钉钉、企业微信、飞书和自定义Webhook通知渠道</p>
            </div>

            <Form form={form} layout="vertical" onFinish={handleSave}>
                <Space direction={'vertical'} className={'w-full'}>
                    {/* 钉钉通知 */}
                    <Card
                        title={
                            <div className={'flex items-center gap-2'}>
                                <div className="text-slate-200">钉钉通知</div>
                                <div className={'text-xs font-normal text-slate-400'}>
                                    了解更多：<a href="https://open.dingtalk.com/document/robots/custom-robot-access"
                                                target="_blank"
                                                rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">https://open.dingtalk.com/document/robots/custom-robot-access</a>
                                </div>
                            </div>
                        }
                        bordered={false}
                        className="mb-4 rounded-xl border border-white/5 bg-slate-900/30 backdrop-blur-xl"
                        extra={
                            <Button
                                type="link"
                                size="small"
                                icon={<TestTube size={14}/>}
                                onClick={() => handleTest('dingtalk')}
                                loading={testMutation.isPending}
                                disabled={!form.getFieldValue('dingtalkEnabled')}
                            >
                                测试
                            </Button>
                        }
                    >
                        <Form.Item label="启用钉钉通知" name="dingtalkEnabled" valuePropName="checked">
                            <Switch/>
                        </Form.Item>

                        <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, currentValues) =>
                                prevValues.dingtalkEnabled !== currentValues.dingtalkEnabled
                            }
                        >
                            {({getFieldValue}) =>
                                getFieldValue('dingtalkEnabled') ? (
                                    <>
                                        <Form.Item
                                            label="访问令牌 (Access Token)"
                                            name="dingtalkSecretKey"
                                            rules={[{required: true, message: '请输入访问令牌'}]}
                                            tooltip="在钉钉机器人配置中获取的 access_token"
                                        >
                                            <Input placeholder="输入访问令牌"/>
                                        </Form.Item>
                                        <Form.Item
                                            label="加签密钥（可选）"
                                            name="dingtalkSignSecret"
                                            tooltip="如果启用了加签，请填写 SEC 开头的密钥"
                                        >
                                            <Input.Password placeholder="SEC 开头的加签密钥"/>
                                        </Form.Item>
                                    </>
                                ) : null
                            }
                        </Form.Item>
                    </Card>

                    {/* 企业微信通知 */}
                    <Card
                        title={
                            <div className={'flex items-center gap-2'}>
                                <div className="text-slate-200">企业微信通知</div>
                                <div className={'text-xs font-normal text-slate-400'}>
                                    了解更多：<a href="https://work.weixin.qq.com/api/doc/90000/90136/91770"
                                                target="_blank"
                                                rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">https://work.weixin.qq.com/api/doc/90000/90136/91770</a>
                                </div>
                            </div>
                        }
                        bordered={false}
                        className="mb-4 rounded-xl border border-white/5 bg-slate-900/30 backdrop-blur-xl"
                        extra={
                            <Button
                                type="link"
                                size="small"
                                icon={<TestTube size={14}/>}
                                onClick={() => handleTest('wecom')}
                                loading={testMutation.isPending}
                                disabled={!form.getFieldValue('wecomEnabled')}
                            >
                                测试
                            </Button>
                        }
                    >
                        <Form.Item label="启用企业微信通知" name="wecomEnabled" valuePropName="checked">
                            <Switch/>
                        </Form.Item>

                        <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, currentValues) => prevValues.wecomEnabled !== currentValues.wecomEnabled}
                        >
                            {({getFieldValue}) =>
                                getFieldValue('wecomEnabled') ? (
                                    <Form.Item
                                        label="Webhook Key"
                                        name="wecomSecretKey"
                                        rules={[{required: true, message: '请输入 Webhook Key'}]}
                                        tooltip="企业微信群机器人的 Webhook Key"
                                    >
                                        <Input placeholder="输入 Webhook Key"/>
                                    </Form.Item>
                                ) : null
                            }
                        </Form.Item>
                    </Card>

                    {/* 飞书通知 */}
                    <Card
                        title={
                            <div className={'flex items-center gap-2'}>
                                <div className="text-slate-200">飞书通知</div>
                                <div className={'text-xs font-normal text-slate-400'}>
                                    点击 <a
                                    href="https://www.feishu.cn/hc/zh-CN/articles/360024984973-%E5%9C%A8%E7%BE%A4%E7%BB%84%E4%B8%AD%E4%BD%BF%E7%94%A8%E6%9C%BA%E5%99%A8%E4%BA%BA"
                                    target="_blank"
                                    rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">这里</a>
                                    了解如何获取 Webhook URL。
                                </div>
                            </div>
                        }
                        bordered={false}
                        className="mb-4 rounded-xl border border-white/5 bg-slate-900/30 backdrop-blur-xl"
                        extra={
                            <Button
                                type="link"
                                size="small"
                                icon={<TestTube size={14}/>}
                                onClick={() => handleTest('feishu')}
                                loading={testMutation.isPending}
                                disabled={!form.getFieldValue('feishuEnabled')}
                            >
                                测试
                            </Button>
                        }
                    >
                        <Form.Item label="启用飞书通知" name="feishuEnabled" valuePropName="checked">
                            <Switch/>
                        </Form.Item>

                        <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, currentValues) =>
                                prevValues.feishuEnabled !== currentValues.feishuEnabled
                            }
                        >
                            {({getFieldValue}) =>
                                getFieldValue('feishuEnabled') ? (
                                    <>
                                        <Form.Item
                                            label="Webhook Token"
                                            name="feishuSecretKey"
                                            rules={[{required: true, message: '请输入 Webhook Token'}]}
                                            tooltip="飞书群机器人的 Webhook Token"
                                        >
                                            <Input placeholder="输入 Webhook Token"/>
                                        </Form.Item>
                                        <Form.Item
                                            label="签名密钥（可选）"
                                            name="feishuSignSecret"
                                            tooltip="如果启用了签名验证，请填写密钥"
                                        >
                                            <Input.Password placeholder="输入签名密钥"/>
                                        </Form.Item>
                                    </>
                                ) : null
                            }
                        </Form.Item>
                    </Card>

                    {/* 自定义 Webhook */}
                    <Card
                        title={<span className="text-slate-200">自定义 Webhook</span>}
                        bordered={false}
                        className="mb-4 rounded-xl border border-white/5 bg-slate-900/30 backdrop-blur-xl"
                        extra={
                            <Button
                                type="link"
                                size="small"
                                icon={<TestTube size={14}/>}
                                onClick={() => handleTest('webhook')}
                                loading={testMutation.isPending}
                                disabled={!form.getFieldValue('webhookEnabled')}
                            >
                                测试
                            </Button>
                        }
                    >
                        <Form.Item label="启用自定义 Webhook" name="webhookEnabled" valuePropName="checked">
                            <Switch/>
                        </Form.Item>

                        <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, currentValues) =>
                                prevValues.webhookEnabled !== currentValues.webhookEnabled
                            }
                        >
                            {({getFieldValue}) =>
                                getFieldValue('webhookEnabled') ? (
                                    <Form.Item
                                        label="Webhook URL"
                                        name="webhookUrl"
                                        rules={[
                                            {required: true, message: '请输入自定义 Webhook URL'},
                                            {type: 'url', message: '请输入有效的 URL'},
                                        ]}
                                        tooltip="将发送完整的告警信息 JSON 到此地址"
                                    >
                                        <Input placeholder="https://your-server.com/webhook"/>
                                    </Form.Item>
                                ) : null
                            }
                        </Form.Item>

                        <div className={'space-y-2 text-slate-300'}>
                            <div>请求方式为 POST，消息格式如下</div>
                            <div>
                                <pre className={'border border-white/10 bg-slate-950/50 p-4 rounded-md font-mono text-xs text-slate-400'}>
                                    {JSON.stringify({
                                        "msg_type": "text",
                                        "text": {
                                            "content": "消息内容",
                                        }
                                    }, null, 4)}
                                </pre>
                            </div>
                        </div>
                    </Card>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
                            保存配置
                        </Button>
                    </Form.Item>
                </Space>
            </Form>
        </div>
    );
};

export default NotificationChannels;
