import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import type {MenuProps} from 'antd';
import {App, Button, Card, Col, Descriptions, Dropdown, Row, Space, Spin, Tag} from 'antd';
import {Activity, ArrowLeft, Clock, RefreshCw, Shield, Terminal} from 'lucide-react';
import {getAgentForAdmin, getAuditResult, sendAuditCommand, type VPSAuditResult} from '../../api/agent';
import type {Agent} from '../../types';
import dayjs from 'dayjs';
import {getErrorMessage} from '../../lib/utils';

const AgentDetail = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const {message: messageApi} = App.useApp();
    const [loading, setLoading] = useState(false);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [auditResult, setAuditResult] = useState<VPSAuditResult | null>(null);
    const [auditing, setAuditing] = useState(false);

    const fetchData = async () => {
        if (!id) return;

        setLoading(true);
        try {
            const [agentRes, auditRes] = await Promise.all([
                getAgentForAdmin(id),
                getAuditResult(id).catch(() => ({data: null})),
            ]);

            setAgent(agentRes.data);
            setAuditResult(auditRes.data);
        } catch (error: any) {
            messageApi.error(error.response?.data?.message || '获取探针信息失败');
        } finally {
            setLoading(false);
        }
    };

    const handleStartAudit = async () => {
        if (!id) return;

        setAuditing(true);
        try {
            await sendAuditCommand(id);
            messageApi.success('安全审计已启动,请稍后查看结果');

            // 5秒后刷新结果
            setTimeout(() => {
                fetchData();
            }, 5000);
        } catch (error: unknown) {
            messageApi.error(getErrorMessage(error, '启动审计失败'));
        } finally {
            setAuditing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    if (loading && !agent) {
        return (
            <div className="text-center py-24">
                <Spin size="large"/>
            </div>
        );
    }

    // 命令菜单配置 - 方便扩展新命令
    const commandMenuItems: MenuProps['items'] = [
        {
            key: 'audit',
            icon: <Shield size={16}/>,
            label: '安全审计',
            onClick: handleStartAudit,
        },
        {
            type: 'divider',
        },
        {
            key: 'refresh',
            icon: <RefreshCw size={16}/>,
            label: '刷新数据',
            onClick: fetchData,
        },
        // 可以在这里添加更多命令
        // {
        //     key: 'restart',
        //     icon: <RotateCw size={16} />,
        //     label: '重启探针',
        //     onClick: handleRestartAgent,
        // },
        // {
        //     key: 'update',
        //     icon: <Download size={16} />,
        //     label: '更新探针',
        //     onClick: handleUpdateAgent,
        // },
    ];

    return (
        <div className="space-y-4 lg:space-y-6">
            {/* 页面头部 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                    icon={<ArrowLeft size={16}/>}
                    onClick={() => navigate('/admin/agents')}
                    size="middle"
                >
                    返回列表
                </Button>

                <Space size={8}>
                    {auditResult && (
                        <Button
                            icon={<Shield size={16}/>}
                            onClick={() => navigate(`/admin/agents/${id}/audit`)}
                            size="middle"
                        >
                            <span className="hidden sm:inline">查看审计结果</span>
                            <span className="sm:hidden">审计</span>
                        </Button>
                    )}
                    <Dropdown
                        menu={{items: commandMenuItems}}
                        placement="bottomRight"
                        trigger={['click']}
                    >
                        <Button
                            type="primary"
                            icon={<Terminal size={16}/>}
                            loading={auditing}
                            size="middle"
                        >
                            <span className="hidden sm:inline">下发命令</span>
                            <span className="sm:hidden">命令</span>
                        </Button>
                    </Dropdown>
                </Space>
            </div>

            {/* 基本信息 */}
            <div>
                <Card
                    title={
                        <Space>
                            <Activity size={20}/>
                            <span className="font-semibold">探针信息</span>
                            {agent?.status === 1 && <Tag color="success">在线</Tag>}
                            {agent?.status !== 1 && <Tag color="error">离线</Tag>}
                        </Space>
                    }
                    className="rounded-lg border border-gray-200 mt-0"
                >
                    <Descriptions column={{xs: 1, sm: 2}} bordered>
                        <Descriptions.Item label="探针名称">{agent?.name}</Descriptions.Item>
                        <Descriptions.Item label="探针ID">{agent?.id}</Descriptions.Item>
                        <Descriptions.Item label="主机名">{agent?.hostname}</Descriptions.Item>
                        <Descriptions.Item label="IP地址">{agent?.ip}</Descriptions.Item>
                        <Descriptions.Item label="操作系统">
                            <Tag color="cyan">{agent?.os}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="系统架构">
                            <Tag>{agent?.arch}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="探针版本">{agent?.version}</Descriptions.Item>
                        <Descriptions.Item label="最后活跃时间">
                            <Space>
                                <Clock size={14}/>
                                {agent?.lastSeenAt && dayjs(agent.lastSeenAt).format('YYYY-MM-DD HH:mm:ss')}
                            </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                            {agent?.createdAt && dayjs(agent.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                        </Descriptions.Item>
                        <Descriptions.Item label="更新时间">
                            {agent?.updatedAt && dayjs(agent.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>
            </div>

            {/* 审计结果预览 */}
            <div>
                {auditResult && (
                    <Card
                        title={
                            <Space>
                                <Shield size={20}/>
                                <span className="font-semibold">最近审计结果</span>
                                <Tag color="cyan">
                                    {dayjs(auditResult.startTime).format('YYYY-MM-DD HH:mm')}
                                </Tag>
                            </Space>
                        }
                        className="rounded-lg border border-gray-200 mt-4 lg:mt-6"
                        extra={
                            <Button
                                type="link"
                                onClick={() => navigate(`/admin/agents/${id}/audit`)}
                            >
                                查看详情
                            </Button>
                        }
                    >
                        <Row gutter={[16, 16]}>
                            <Col xs={12} sm={6}>
                                <div className="text-center">
                                    <div className="text-2xl font-semibold text-gray-900">
                                        {auditResult.securityChecks.length}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">总检查项</div>
                                </div>
                            </Col>
                            <Col xs={12} sm={6}>
                                <div className="text-center">
                                    <div className="text-2xl font-semibold text-emerald-600">
                                        {auditResult.securityChecks.filter(c => c.status === 'pass').length}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">通过</div>
                                </div>
                            </Col>
                            <Col xs={12} sm={6}>
                                <div className="text-center">
                                    <div className="text-2xl font-semibold text-rose-600">
                                        {auditResult.securityChecks.filter(c => c.status === 'fail').length}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">失败</div>
                                </div>
                            </Col>
                            <Col xs={12} sm={6}>
                                <div className="text-center">
                                    <div className="text-2xl font-semibold text-orange-600">
                                        {auditResult.securityChecks.filter(c => c.status === 'warn').length}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">警告</div>
                                </div>
                            </Col>
                        </Row>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default AgentDetail;

