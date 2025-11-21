import {useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import type {ActionType, ProColumns} from '@ant-design/pro-components';
import {ProTable} from '@ant-design/pro-components';
import {App, Button, DatePicker, Divider, Form, Input, Modal, Space, Tag} from 'antd';
import {Edit, Eye, RefreshCw} from 'lucide-react';
import {getAgentPaging, updateAgentInfo} from '../../api/agent';
import type {Agent} from '../../types';
import {getErrorMessage} from '../../lib/utils';
import dayjs from 'dayjs';
import {PageHeader} from '../../components';

const AgentList = () => {
    const navigate = useNavigate();
    const {message: messageApi} = App.useApp();
    const actionRef = useRef<ActionType>(null);
    const [form] = Form.useForm();
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(false);

    // 打开编辑模态框
    const handleEdit = (agent: Agent) => {
        setCurrentAgent(agent);
        form.setFieldsValue({
            name: agent.name,
            platform: agent.platform,
            location: agent.location,
            expireTime: agent.expireTime ? dayjs(agent.expireTime) : null,
        });
        setEditModalVisible(true);
    };

    // 保存探针信息
    const handleSave = async () => {
        if (!currentAgent) return;

        try {
            const values = await form.validateFields();
            setLoading(true);

            // 转换到期时间为时间戳（设置为当天的23:59:59）
            const data: any = {
                name: values.name,
                platform: values.platform,
                location: values.location,
            };

            if (values.expireTime) {
                data.expireTime = values.expireTime.endOf('day').valueOf();
            }

            await updateAgentInfo(currentAgent.id, data);
            messageApi.success('探针信息更新成功');
            setEditModalVisible(false);
            actionRef.current?.reload();
        } catch (error: unknown) {
            messageApi.error(getErrorMessage(error, '更新探针信息失败'));
        } finally {
            setLoading(false);
        }
    };

    const columns: ProColumns<Agent>[] = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            hideInSearch: true,
            fixed: 'left',
            render: (_, record) => (
                <div className="space-y-1">
                    <div className="font-medium text-zinc-200">{record.name || record.hostname}</div>
                    <Tag color="cyan" bordered={false} className="bg-cyan-500/10 text-cyan-400 border-0">{record.os} · {record.arch}</Tag>
                </div>
            ),
        },
        {
            title: '平台',
            dataIndex: 'platform',
            key: 'platform',
            hideInSearch: true,
            render: (text) => text ? <Tag color="blue" bordered={false}>{text}</Tag> : '-',
        },
        {
            title: '位置',
            dataIndex: 'location',
            key: 'location',
            hideInSearch: true,
            render: (text) => text ? <Tag color="geekblue" bordered={false}>{text}</Tag> : '-',
        },
        {
            title: '到期时间',
            dataIndex: 'expireTime',
            key: 'expireTime',
            hideInSearch: true,
            width: 100,
            render: (val) => {
                if (!val) return '-';
                const expireDate = new Date(val as number);
                const now = new Date();
                const isExpired = expireDate < now;
                const daysLeft = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                return (
                    <div className="flex flex-col gap-1">
                        <div>{expireDate.toLocaleDateString('zh-CN')}</div>
                        {isExpired ? (
                            <Tag color="red" bordered={false}>已过期</Tag>
                        ) : daysLeft <= 7 ? (
                            <Tag color="orange" bordered={false}>{daysLeft}天后到期</Tag>
                        ) : daysLeft <= 30 ? (
                            <Tag color="gold" bordered={false}>{daysLeft}天后到期</Tag>
                        ) : null}
                    </div>
                );
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            hideInSearch: true,
            width: 80,
            render: (_, record) => (
                <Tag color={record.status === 1 ? 'success' : 'default'}>
                    {record.status === 1 ? '在线' : '离线'}
                </Tag>
            ),
        },
        {
            title: '主机名',
            dataIndex: 'hostname',
            key: 'hostname',
            ellipsis: true,
            width: 150,
        },
        {
            title: 'IP 地址',
            dataIndex: 'ip',
            key: 'ip',
        },
        {
            title: '状态筛选',
            dataIndex: 'status',
            valueType: 'select',
            hideInTable: true,
            valueEnum: {
                online: {text: '在线'},
                offline: {text: '离线'},
            },
        },
        {
            title: '版本',
            dataIndex: 'version',
            key: 'version',
        },
        {
            title: '最后活跃时间',
            dataIndex: 'lastSeenAt',
            key: 'lastSeenAt',
            hideInSearch: true,
            valueType: 'dateTime',
            width: 180,
        },
        {
            title: '操作',
            key: 'action',
            valueType: 'option',
            width: 150,
            fixed: 'right',
            render: (_, record) => (
                <Space>
                    <Button
                        type="link"
                        icon={<Edit size={14}/>}
                        onClick={() => handleEdit(record)}
                        style={{padding: 0, margin: 0}}
                    >
                        编辑
                    </Button>
                    <Button
                        type="link"
                        icon={<Eye size={14}/>}
                        onClick={() => navigate(`/admin/agents/${record.id}`)}
                        style={{padding: 0, margin: 0}}
                    >
                        详情
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* 页面头部 */}
            <PageHeader
                title="探针管理"
                description="管理和监控系统探针状态"
                actions={[
                    {
                        key: 'refresh',
                        label: '刷新',
                        icon: <RefreshCw size={16}/>,
                        onClick: () => actionRef.current?.reload(),
                    },
                ]}
            />

            <Divider className="border-white/5" />

            {/* 探针列表 */}
            <div className="rounded-xl border border-white/5 bg-zinc-900/30 backdrop-blur-xl overflow-hidden">
                <ProTable<Agent>
                    actionRef={actionRef}
                    rowKey="id"
                    search={{
                        labelWidth: 80,
                        filterType: 'light',
                        className: "!bg-transparent !p-4"
                    }}
                    columns={columns}
                    scroll={{x: 'max-content'}}
                    pagination={{
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        className: "!px-6 !py-4"
                    }}
                    options={false}
                    tableAlertRender={false}
                    className="bg-transparent"
                    tableStyle={{ background: 'transparent' }}
                    cardProps={{
                        bodyStyle: { padding: 0 },
                        className: '!bg-transparent'
                    }}
                    request={async (params) => {
                        const {current = 1, pageSize = 10, hostname, ip, status} = params;
                        try {
                            const response = await getAgentPaging(
                                current,
                                pageSize,
                                hostname,
                                ip,
                                status as string | undefined
                            );
                            const items = response.data.items || [];
                            return {
                                data: items,
                                success: true,
                                total: response.data.total,
                            };
                        } catch (error: unknown) {
                            messageApi.error(getErrorMessage(error, '获取探针列表失败'));
                            return {
                                data: [],
                                success: false,
                            };
                        }
                    }}
                />
            </div>

            {/* 编辑探针信息模态框 */}
            <Modal
                title="编辑探针信息"
                open={editModalVisible}
                onOk={handleSave}
                onCancel={() => setEditModalVisible(false)}
                confirmLoading={loading}
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label="名称"
                        name="name"
                        rules={[{required: true, message: '请输入探针名称'}]}
                    >
                        <Input placeholder="请输入探针名称"/>
                    </Form.Item>
                    <Form.Item
                        label="平台"
                        name="platform"
                    >
                        <Input placeholder="请输入平台信息，如：阿里云、腾讯云"/>
                    </Form.Item>
                    <Form.Item
                        label="位置"
                        name="location"
                    >
                        <Input placeholder="请输入位置信息，如：北京、香港"/>
                    </Form.Item>
                    <Form.Item
                        label="到期时间"
                        name="expireTime"
                    >
                        <DatePicker
                            style={{width: '100%'}}
                            format="YYYY-MM-DD"
                            placeholder="请选择到期时间"
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AgentList;
