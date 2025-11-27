import {useEffect} from 'react';
import {App, Button, Card, Collapse, Form, Input, Select, Space, Spin, Switch} from 'antd';
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
                    formValues.webhookMethod = channel.config?.method || 'POST';
                    formValues.webhookBodyTemplate = channel.config?.bodyTemplate || 'json';
                    formValues.webhookCustomBody = channel.config?.customBody || '';

                    // 解析 headers 为数组形式方便编辑
                    const headers = channel.config?.headers || {};
                    formValues.webhookHeaders = Object.entries(headers).map(([key, value]) => ({
                        key,
                        value
                    }));
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
                // 将 headers 数组转换为对象
                const headersObj: Record<string, string> = {};
                if (values.webhookHeaders && Array.isArray(values.webhookHeaders)) {
                    values.webhookHeaders.forEach((item: { key: string; value: string }) => {
                        if (item.key && item.value) {
                            headersObj[item.key] = item.value;
                        }
                    });
                }

                newChannels.push({
                    type: 'webhook',
                    enabled: values.webhookEnabled || false,
                    config: {
                        url: values.webhookUrl || '',
                        method: values.webhookMethod || 'POST',
                        bodyTemplate: values.webhookBodyTemplate || 'json',
                        customBody: values.webhookCustomBody || '',
                        headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
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
            <div className="mb-4">
                <h2 className="text-xl font-bold">通知渠道管理</h2>
                <p className="text-gray-500 mt-2">配置钉钉、企业微信、飞书和自定义Webhook通知渠道</p>
            </div>

            <Form form={form} layout="vertical" onFinish={handleSave}>
                <Space direction={'vertical'} className={'w-full'}>
                    {/* 钉钉通知 */}
                    <Card
                        title={
                            <div className={'flex items-center gap-2'}>
                                <div>钉钉通知</div>
                                <div className={'text-xs font-normal'}>
                                    了解更多：<a href="https://open.dingtalk.com/document/robots/custom-robot-access"
                                                target="_blank"
                                                rel="noopener noreferrer">https://open.dingtalk.com/document/robots/custom-robot-access</a>
                                </div>
                            </div>
                        }
                        type="inner"
                        className="mb-4"
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
                                <div>企业微信通知</div>
                                <div className={'text-xs font-normal'}>
                                    了解更多：<a href="https://work.weixin.qq.com/api/doc/90000/90136/91770"
                                                target="_blank"
                                                rel="noopener noreferrer">https://work.weixin.qq.com/api/doc/90000/90136/91770</a>
                                </div>
                            </div>
                        }
                        type="inner"
                        className="mb-4"
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
                                <div>飞书通知</div>
                                <div className={'text-xs font-normal'}>
                                    点击 <a
                                    href="https://www.feishu.cn/hc/zh-CN/articles/360024984973-%E5%9C%A8%E7%BE%A4%E7%BB%84%E4%B8%AD%E4%BD%BF%E7%94%A8%E6%9C%BA%E5%99%A8%E4%BA%BA"
                                    target="_blank"
                                    rel="noopener noreferrer">这里</a>
                                    了解如何获取 Webhook URL。
                                </div>
                            </div>
                        }
                        type="inner"
                        className="mb-4"
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
                        title="自定义 Webhook"
                        type="inner"
                        className="mb-4"
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
                                prevValues.webhookEnabled !== currentValues.webhookEnabled ||
                                prevValues.webhookBodyTemplate !== currentValues.webhookBodyTemplate
                            }
                        >
                            {({getFieldValue}) =>
                                getFieldValue('webhookEnabled') ? (
                                    <>
                                        <Form.Item
                                            label="Webhook URL"
                                            name="webhookUrl"
                                            rules={[
                                                {required: true, message: '请输入自定义 Webhook URL'},
                                                {type: 'url', message: '请输入有效的 URL'},
                                            ]}
                                        >
                                            <Input placeholder="https://your-server.com/webhook"/>
                                        </Form.Item>
                                        <div className={'mb-4'}>
                                            <Collapse
                                                ghost
                                                items={[
                                                    {
                                                        key: '1',
                                                        label: '高级配置',
                                                        children: (
                                                            <Space direction="vertical" className="w-full">
                                                                {/* HTTP 方法 */}
                                                                <Form.Item
                                                                    label="HTTP 方法"
                                                                    name="webhookMethod"
                                                                    tooltip="选择 HTTP 请求方法"
                                                                >
                                                                    <Select
                                                                        placeholder="选择 HTTP 方法"
                                                                        options={[
                                                                            {label: 'GET', value: 'GET'},
                                                                            {label: 'POST', value: 'POST'},
                                                                            {label: 'PUT', value: 'PUT'},
                                                                            {label: 'PATCH', value: 'PATCH'},
                                                                            {label: 'DELETE', value: 'DELETE'},
                                                                        ]}
                                                                    />
                                                                </Form.Item>

                                                                {/* 请求体模板 */}
                                                                <Form.Item
                                                                    label="请求体模板"
                                                                    name="webhookBodyTemplate"
                                                                    tooltip="选择请求体的格式"
                                                                >
                                                                    <Select
                                                                        placeholder="选择请求体模板"
                                                                        options={[
                                                                            {
                                                                                label: 'JSON (默认)',
                                                                                value: 'json'
                                                                            },
                                                                            {
                                                                                label: 'Form 表单',
                                                                                value: 'form'
                                                                            },
                                                                            {
                                                                                label: '自定义模板',
                                                                                value: 'custom'
                                                                            },
                                                                        ]}
                                                                    />
                                                                </Form.Item>

                                                                {/* 自定义请求体 */}
                                                                {getFieldValue('webhookBodyTemplate') === 'custom' && (
                                                                    <Form.Item
                                                                        label="自定义请求体"
                                                                        name="webhookCustomBody"
                                                                        rules={[
                                                                            {
                                                                                required: true,
                                                                                message: '请输入自定义请求体模板'
                                                                            }
                                                                        ]}
                                                                        tooltip="支持变量替换，可用变量见下方说明"
                                                                    >
                                                                        <Input.TextArea
                                                                            rows={6}
                                                                            placeholder='示例: {"alert": "{{alert.message}}", "host": "{{agent.hostname}}"}'
                                                                        />
                                                                    </Form.Item>
                                                                )}

                                                                {/* 自定义请求头 */}
                                                                <Form.Item label="自定义请求头"
                                                                           tooltip="添加自定义 HTTP 请求头">
                                                                    <Form.List name="webhookHeaders">
                                                                        {(fields, {add, remove}) => (
                                                                            <>
                                                                                {fields.map(({
                                                                                                 key,
                                                                                                 name,
                                                                                                 ...restField
                                                                                             }) => (
                                                                                    <Space
                                                                                        key={key}
                                                                                        style={{
                                                                                            display: 'flex',
                                                                                            marginBottom: 8
                                                                                        }}
                                                                                        align="baseline"
                                                                                    >
                                                                                        <Form.Item
                                                                                            {...restField}
                                                                                            name={[name, 'key']}
                                                                                            rules={[{
                                                                                                required: true,
                                                                                                message: '请输入 Header 名称'
                                                                                            }]}
                                                                                        >
                                                                                            <Input
                                                                                                placeholder="Header 名称"
                                                                                                style={{width: 200}}
                                                                                            />
                                                                                        </Form.Item>
                                                                                        <Form.Item
                                                                                            {...restField}
                                                                                            name={[name, 'value']}
                                                                                            rules={[{
                                                                                                required: true,
                                                                                                message: '请输入 Header 值'
                                                                                            }]}
                                                                                        >
                                                                                            <Input
                                                                                                placeholder="Header 值"
                                                                                                style={{width: 300}}
                                                                                            />
                                                                                        </Form.Item>
                                                                                        <Button
                                                                                            onClick={() => remove(name)}
                                                                                            danger
                                                                                            type="link"
                                                                                        >
                                                                                            删除
                                                                                        </Button>
                                                                                    </Space>
                                                                                ))}
                                                                                <Form.Item>
                                                                                    <Button
                                                                                        type="dashed"
                                                                                        onClick={() => add()}
                                                                                        block
                                                                                    >
                                                                                        添加请求头
                                                                                    </Button>
                                                                                </Form.Item>
                                                                            </>
                                                                        )}
                                                                    </Form.List>
                                                                </Form.Item>
                                                            </Space>
                                                        ),
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </>
                                ) : null
                            }
                        </Form.Item>

                        <div className={'space-y-3 text-sm'}>
                            <div className={'font-semibold'}>请求体格式说明：</div>

                            {/* JSON 格式说明 */}
                            <div className={'space-y-1'}>
                                <strong>1. JSON 格式 (默认)：</strong>
                                <div className={'text-gray-600 text-xs'}>
                                    发送 <code className={'bg-gray-100 px-1 rounded'}>application/json</code> 格式的数据
                                </div>
                                <pre className={'border p-2 rounded-md text-xs mt-1 bg-gray-50'}>
                                    {JSON.stringify({
                                        "msg_type": "text",
                                        "text": {"content": "告警消息内容"},
                                        "agent": {
                                            "id": "agent-id",
                                            "name": "探针名称",
                                            "hostname": "主机名",
                                            "ip": "192.168.1.1"
                                        },
                                        "alert": {
                                            "type": "cpu",
                                            "level": "warning",
                                            "status": "firing",
                                            "message": "CPU使用率过高",
                                            "threshold": 80,
                                            "actualValue": 85.5,
                                            "firedAt": 1234567890000,
                                            "resolvedAt": 0
                                        }
                                    }, null, 2)}
                                </pre>
                            </div>

                            {/* Form 表单格式说明 */}
                            <div className={'space-y-1'}>
                                <strong>2. Form 表单格式：</strong>
                                <div className={'text-gray-600 text-xs'}>
                                    发送 <code
                                    className={'bg-gray-100 px-1 rounded'}>application/x-www-form-urlencoded</code> 格式的数据
                                </div>
                                <div className={'border p-2 rounded-md text-xs mt-1 bg-gray-50'}>
                                    <div className={'font-semibold mb-1'}>包含以下字段：</div>
                                    <div className={'grid grid-cols-2 gap-x-4 gap-y-1'}>
                                        <div>• <code>message</code> - 告警消息</div>
                                        <div>• <code>agent_id</code> - 探针ID</div>
                                        <div>• <code>agent_name</code> - 探针名称</div>
                                        <div>• <code>agent_hostname</code> - 主机名</div>
                                        <div>• <code>agent_ip</code> - IP地址</div>
                                        <div>• <code>alert_type</code> - 告警类型</div>
                                        <div>• <code>alert_level</code> - 告警级别</div>
                                        <div>• <code>alert_status</code> - 告警状态</div>
                                        <div>• <code>alert_message</code> - 告警详情</div>
                                        <div>• <code>threshold</code> - 阈值</div>
                                        <div>• <code>actual_value</code> - 当前值</div>
                                        <div>• <code>fired_at</code> - 触发时间戳</div>
                                        <div>• <code>resolved_at</code> - 恢复时间戳</div>
                                    </div>
                                </div>
                            </div>

                            {/* 自定义模板说明 */}
                            <div className={'space-y-1'}>
                                <strong>3. 自定义模板：</strong>
                                <div className={'text-gray-600 text-xs'}>
                                    支持变量替换，Content-Type 为 <code
                                    className={'bg-gray-100 px-1 rounded'}>text/plain</code>
                                </div>
                                <div className={'border p-2 rounded-md text-xs mt-1 bg-gray-50'}>
                                    <div className={'font-semibold mb-1'}>可用变量：</div>
                                    <div className={'grid grid-cols-2 gap-x-4 gap-y-1'}>
                                        <div>• <code>{`{{message}}`}</code> - 告警消息</div>
                                        <div>• <code>{`{{agent.id}}`}</code> - 探针ID</div>
                                        <div>• <code>{`{{agent.name}}`}</code> - 探针名称</div>
                                        <div>• <code>{`{{agent.hostname}}`}</code> - 主机名</div>
                                        <div>• <code>{`{{agent.ip}}`}</code> - IP地址</div>
                                        <div>• <code>{`{{alert.type}}`}</code> - 告警类型</div>
                                        <div>• <code>{`{{alert.level}}`}</code> - 告警级别</div>
                                        <div>• <code>{`{{alert.status}}`}</code> - 告警状态</div>
                                        <div>• <code>{`{{alert.message}}`}</code> - 告警消息</div>
                                        <div>• <code>{`{{alert.threshold}}`}</code> - 阈值</div>
                                        <div>• <code>{`{{alert.actualValue}}`}</code> - 当前值</div>
                                        <div>• <code>{`{{alert.firedAt}}`}</code> - 触发时间</div>
                                        <div>• <code>{`{{alert.resolvedAt}}`}</code> - 恢复时间</div>
                                    </div>
                                    <div className={'mt-2 pt-2 border-t'}>
                                        <div className={'font-semibold mb-1'}>示例：</div>
                                        <pre className={'text-xs'}>
                                            {`{
  "alert": "{{alert.message}}",
  "host": "{{agent.hostname}}",
  "level": "{{alert.level}}"
}`}
                                        </pre>
                                    </div>
                                </div>
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
