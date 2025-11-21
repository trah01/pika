import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card,
    Button,
    Space,
    Spin,
    App,
    Descriptions,
    Tag,
    List,
    Collapse,
    Alert,
    Row,
    Col,
    Statistic
} from 'antd';
import {
    ArrowLeft,
    Shield,
    CheckCircle,
    XCircle,
    AlertTriangle,
    MinusCircle,
    RefreshCw,
    FileText,
    Hash,
    GitBranch,
    Clock,
    Activity
} from 'lucide-react';
import { getAuditResult, sendAuditCommand, listAuditResults } from '../../api/agent';
import type { VPSAuditResult, AuditResultSummary } from '../../api/agent';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

const { Panel } = Collapse;

const AuditResult = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { message: messageApi } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [auditing, setAuditing] = useState(false);
    const [result, setResult] = useState<VPSAuditResult | null>(null);
    const [historyList, setHistoryList] = useState<AuditResultSummary[]>([]);

    const fetchData = async () => {
        if (!id) return;

        setLoading(true);
        try {
            const [resultRes, historyRes] = await Promise.all([
                getAuditResult(id).catch(() => ({ data: null })),
                listAuditResults(id),
            ]);

            setResult(resultRes.data);
            setHistoryList(historyRes.data.items || []);
        } catch (error: any) {
            // 如果没有审计结果,不显示错误
            if (error.response?.status !== 404) {
                messageApi.error(error.response?.data?.message || '获取审计结果失败');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

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
        } catch (error: any) {
            messageApi.error(error.response?.data?.message || '启动审计失败');
        } finally {
            setAuditing(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pass':
                return <CheckCircle size={16} className="text-green-500" />;
            case 'fail':
                return <XCircle size={16} className="text-red-500" />;
            case 'warn':
                return <AlertTriangle size={16} className="text-yellow-500" />;
            case 'skip':
                return <MinusCircle size={16} className="text-gray-400" />;
            default:
                return null;
        }
    };

    const getStatusTag = (status: string) => {
        const configs = {
            pass: { color: 'success', text: '通过' },
            fail: { color: 'error', text: '失败' },
            warn: { color: 'warning', text: '警告' },
            skip: { color: 'default', text: '跳过' },
        };
        const config = configs[status as keyof typeof configs] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
    };

    const getCategoryName = (category: string) => {
        const names: Record<string, string> = {
            'non_root_user': '非Root用户',
            'ufw_security': 'UFW防火墙',
            'ssh_security': 'SSH安全',
            'access_control': '访问控制',
            'port_security': '端口安全',
            'unattended_upgrades': '自动更新',
            'fail2ban': 'Fail2ban',
            'rootkit_detection': 'Rootkit检测',
            'suspicious_processes': '可疑进程检测',
            'listening_ports': '端口监听检查',
            'cron_jobs': '定时任务检查',
            'suspicious_files': '可疑文件检查',
            'system_accounts': '系统账户检查',
            'network_connections': '网络连接检查',
            'file_integrity': '文件完整性检查',
            'login_history': '登录历史检查',
            'immutable_files': '不可变文件检查',
            'suspicious_env_vars': '环境变量检查',
        };
        return names[category] || category;
    };

    const getThreatLevelConfig = (level: string) => {
        const configs = {
            low: { color: 'success', text: '低风险', icon: CheckCircle },
            medium: { color: 'warning', text: '中风险', icon: AlertTriangle },
            high: { color: 'error', text: '高风险', icon: XCircle },
            critical: { color: 'error', text: '严重风险', icon: XCircle },
        };
        return configs[level as keyof typeof configs] || configs.low;
    };

    const formatUptime = (seconds: number) => {
        const d = dayjs.duration(seconds, 'seconds');
        const days = Math.floor(d.asDays());
        const hours = d.hours();
        const minutes = d.minutes();
        return `${days}天 ${hours}小时 ${minutes}分钟`;
    };

    if (loading) {
        return (
            <div className="text-center py-24">
                <Spin size="large" />
            </div>
        );
    }

    const passCount = result?.securityChecks.filter(c => c.status === 'pass').length || 0;
    const failCount = result?.securityChecks.filter(c => c.status === 'fail').length || 0;
    const warnCount = result?.securityChecks.filter(c => c.status === 'warn').length || 0;
    const totalCount = result?.securityChecks.length || 0;

    return (
        <Space direction={'vertical'} className={'w-full'}>
            {/* 页面头部 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                    icon={<ArrowLeft size={16} />}
                    onClick={() => navigate(`/admin/agents/${id}`)}
                    size="middle"
                >
                    返回详情
                </Button>

                <Button
                    type="primary"
                    icon={<RefreshCw size={16} />}
                    onClick={handleStartAudit}
                    loading={auditing}
                    size="middle"
                >
                    {auditing ? '审计中...' : '开始审计'}
                </Button>
            </div>

            {!result && (
                <Alert
                    message="暂无审计结果"
                    description='点击上方"开始审计"按钮执行VPS安全审计'
                    type="info"
                    showIcon
                    className="rounded-lg"
                />
            )}

            {result && (
                <>
                    {/* 统计信息 */}
                    <Card className="rounded-lg border border-gray-200 mt-0">
                        <Row gutter={[16, 16]}>
                            <Col xs={12} sm={6} md={4}>
                                <Statistic
                                    title="总检查项"
                                    value={totalCount}
                                    prefix={<Shield size={18} className="lg:w-5 lg:h-5" />}
                                />
                            </Col>
                            <Col xs={12} sm={6} md={4}>
                                <Statistic
                                    title="通过"
                                    value={passCount}
                                    valueStyle={{ color: '#52c41a' }}
                                    prefix={<CheckCircle size={18} className="lg:w-5 lg:h-5" />}
                                />
                            </Col>
                            <Col xs={12} sm={6} md={4}>
                                <Statistic
                                    title="失败"
                                    value={failCount}
                                    valueStyle={{ color: '#ff4d4f' }}
                                    prefix={<XCircle size={18} className="lg:w-5 lg:h-5" />}
                                />
                            </Col>
                            <Col xs={12} sm={6} md={4}>
                                <Statistic
                                    title="警告"
                                    value={warnCount}
                                    valueStyle={{ color: '#faad14' }}
                                    prefix={<AlertTriangle size={18} className="lg:w-5 lg:h-5" />}
                                />
                            </Col>
                            <Col xs={12} sm={12} md={4}>
                                <Statistic
                                    title="风险评分"
                                    value={result.riskScore}
                                    suffix="/ 100"
                                    valueStyle={{
                                        color: result.riskScore >= 80 ? '#ff4d4f' :
                                               result.riskScore >= 50 ? '#faad14' :
                                               result.riskScore >= 20 ? '#1890ff' : '#52c41a'
                                    }}
                                    prefix={<Activity size={18} className="lg:w-5 lg:h-5" />}
                                />
                            </Col>
                            <Col xs={12} sm={12} md={4}>
                                <div className="text-sm text-gray-500 mb-2">威胁等级</div>
                                <Tag
                                    color={getThreatLevelConfig(result.threatLevel).color}
                                    className="text-base px-3 py-1"
                                >
                                    {getThreatLevelConfig(result.threatLevel).text}
                                </Tag>
                            </Col>
                        </Row>
                    </Card>

                    {/* 系统信息 */}
                    <Card
                        title={<span className="font-semibold">系统信息</span>}
                        className="rounded-lg border border-gray-200 mt-4 lg:mt-6"
                    >
                        <Descriptions column={{ xs: 1, sm: 2 }} bordered>
                            <Descriptions.Item label="主机名">
                                {result.systemInfo.hostname}
                            </Descriptions.Item>
                            <Descriptions.Item label="操作系统">
                                {result.systemInfo.os}
                            </Descriptions.Item>
                            <Descriptions.Item label="内核版本">
                                {result.systemInfo.kernelVersion}
                            </Descriptions.Item>
                            <Descriptions.Item label="运行时长">
                                {formatUptime(result.systemInfo.uptime)}
                            </Descriptions.Item>
                            {result.systemInfo.publicIP && (
                                <Descriptions.Item label="公网IP" span={2}>
                                    {result.systemInfo.publicIP}
                                </Descriptions.Item>
                            )}
                            <Descriptions.Item label="审计时间" span={2}>
                                {dayjs(result.startTime).format('YYYY-MM-DD HH:mm:ss')} - {dayjs(result.endTime).format('HH:mm:ss')}
                                <span className="ml-2 text-gray-500">
                                    (耗时: {((result.endTime - result.startTime) / 1000).toFixed(2)}秒)
                                </span>
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>

                    {/* 安全检查结果 */}
                    <Card
                        title={<span className="font-semibold">安全检查结果</span>}
                        className="rounded-lg border border-gray-200 mt-4 lg:mt-6"
                    >
                        <Collapse accordion>
                            {result.securityChecks.map((check, index) => (
                                <Panel
                                    key={index}
                                    header={
                                        <Space>
                                            {getStatusIcon(check.status)}
                                            <span className="font-medium">
                                                {getCategoryName(check.category)}
                                            </span>
                                            {getStatusTag(check.status)}
                                            <span className="text-gray-500 text-sm">
                                                {check.message}
                                            </span>
                                        </Space>
                                    }
                                >
                                    {check.details && check.details.length > 0 && (
                                        <List
                                            size="small"
                                            dataSource={check.details}
                                            renderItem={(detail) => (
                                                <List.Item className="flex-col items-start">
                                                    <Space className="w-full">
                                                        {getStatusIcon(detail.status)}
                                                        <span className="font-mono text-sm">
                                                            {detail.name}
                                                        </span>
                                                        {getStatusTag(detail.status)}
                                                        <span className="text-gray-600 flex-1">
                                                            {detail.message}
                                                        </span>
                                                    </Space>
                                                    {detail.evidence && (
                                                        <div className="ml-6 mt-2 p-3 bg-gray-50 rounded text-xs w-full">
                                                            <div className="font-semibold mb-2 flex items-center gap-2">
                                                                <FileText size={14} />
                                                                证据信息
                                                                {detail.evidence.riskLevel && (
                                                                    <Tag
                                                                        color={
                                                                            detail.evidence.riskLevel === 'high' ? 'error' :
                                                                            detail.evidence.riskLevel === 'medium' ? 'warning' : 'default'
                                                                        }
                                                                        className="ml-2"
                                                                    >
                                                                        {detail.evidence.riskLevel === 'high' ? '高危' :
                                                                         detail.evidence.riskLevel === 'medium' ? '中危' : '低危'}
                                                                    </Tag>
                                                                )}
                                                            </div>
                                                            {detail.evidence.filePath && (
                                                                <div className="mb-1">
                                                                    <span className="font-medium">文件路径: </span>
                                                                    <code className="bg-white px-1">{detail.evidence.filePath}</code>
                                                                </div>
                                                            )}
                                                            {detail.evidence.fileHash && (
                                                                <div className="mb-1 flex items-start gap-1">
                                                                    <Hash size={12} className="mt-0.5" />
                                                                    <span className="font-medium">SHA256: </span>
                                                                    <code className="bg-white px-1 break-all">{detail.evidence.fileHash}</code>
                                                                </div>
                                                            )}
                                                            {detail.evidence.timestamp && (
                                                                <div className="mb-1 flex items-center gap-1">
                                                                    <Clock size={12} />
                                                                    <span className="font-medium">时间: </span>
                                                                    {dayjs(detail.evidence.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                                                                </div>
                                                            )}
                                                            {detail.evidence.networkConn && (
                                                                <div className="mb-1">
                                                                    <span className="font-medium">网络连接: </span>
                                                                    <code className="bg-white px-1">{detail.evidence.networkConn}</code>
                                                                </div>
                                                            )}
                                                            {detail.evidence.processTree && detail.evidence.processTree.length > 0 && (
                                                                <div className="mt-2">
                                                                    <div className="font-medium mb-1 flex items-center gap-1">
                                                                        <GitBranch size={12} />
                                                                        进程树:
                                                                    </div>
                                                                    <div className="bg-white p-2 rounded font-mono text-xs overflow-x-auto">
                                                                        {detail.evidence.processTree.map((line, idx) => (
                                                                            <div key={idx} className="whitespace-nowrap">
                                                                                {line}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </List.Item>
                                            )}
                                        />
                                    )}
                                </Panel>
                            ))}
                        </Collapse>
                    </Card>

                    {/* 修复建议 */}
                    {result.recommendations && result.recommendations.length > 0 && (
                        <Card
                            title={<span className="font-semibold">修复建议</span>}
                            className="rounded-lg border border-gray-200 mt-4 lg:mt-6"
                        >
                            <List
                                dataSource={result.recommendations}
                                renderItem={(item, index) => (
                                    <List.Item>
                                        <Space align="start">
                                            <span className="font-semibold text-gray-500">{index + 1}.</span>
                                            <span className={
                                                item.startsWith('【紧急】') ? 'text-red-600 font-medium' :
                                                item.startsWith('【警告】') ? 'text-yellow-600' :
                                                'text-gray-700'
                                            }>
                                                {item}
                                            </span>
                                        </Space>
                                    </List.Item>
                                )}
                            />
                        </Card>
                    )}
                </>
            )}

            {/* 历史记录 */}
            {historyList.length > 0 && (
                <Card
                    title={<span className="font-semibold">审计历史</span>}
                    className="rounded-lg border border-gray-200 mt-4 lg:mt-6"
                >
                    <List
                        dataSource={historyList}
                        renderItem={(item) => (
                            <List.Item>
                                <List.Item.Meta
                                    title={
                                        <Space>
                                            <span>
                                                {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                                            </span>
                                            <Tag color="cyan">{item.systemInfo.os}</Tag>
                                        </Space>
                                    }
                                    description={
                                        <Space size="large">
                                            <span>
                                                <CheckCircle size={14} className="inline mr-1 text-green-500" />
                                                通过: {item.passCount}
                                            </span>
                                            <span>
                                                <XCircle size={14} className="inline mr-1 text-red-500" />
                                                失败: {item.failCount}
                                            </span>
                                            <span>
                                                <AlertTriangle size={14} className="inline mr-1 text-yellow-500" />
                                                警告: {item.warnCount}
                                            </span>
                                        </Space>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            )}
        </Space>
    );
};

export default AuditResult;
