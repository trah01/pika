import { get, post, put } from './request';

// ==================== 通用 Property 接口 ====================

// 通用的 Property 响应类型
export interface PropertyResponse<T> {
    id: string;
    name: string;
    value: T;
}

// 通用的获取 Property 方法
export const getProperty = async <T>(propertyId: string): Promise<T> => {
    const response = await get<PropertyResponse<T>>(`/admin/properties/${propertyId}`);
    return response.data.value;
};

// 通用的保存 Property 方法
export const saveProperty = async <T>(propertyId: string, name: string, value: T): Promise<void> => {
    await put(`/admin/properties/${propertyId}`, {
        name,
        value,
    });
};

// ==================== 指标配置 ====================

const PROPERTY_ID_METRICS_CONFIG = 'metrics_config';

export interface TimeRangeOption {
    label: string;  // 显示标签，如 "15分钟"
    value: string;  // 值，如 "15m"
}

export interface MetricsConfig {
    retentionHours: number;       // 数据保留时长（小时）
    maxQueryPoints: number;       // 最大查询点数
    timeRangeOptions: TimeRangeOption[];  // 时间范围选项
}

// 获取指标配置（管理后台使用，需认证）
export const getMetricsConfig = async (): Promise<MetricsConfig> => {
    return getProperty<MetricsConfig>(PROPERTY_ID_METRICS_CONFIG);
};

// 获取指标配置（公开访问，用于前端获取时间范围选项等）
export const getMetricsConfigPublic = async (): Promise<MetricsConfig> => {
    const response = await get<MetricsConfig>('/metrics-config');
    return response.data;
};

// 保存指标配置
export const saveMetricsConfig = async (config: MetricsConfig): Promise<void> => {
    return saveProperty(PROPERTY_ID_METRICS_CONFIG, '指标配置', config);
};

// ==================== 通知渠道配置 ====================

const PROPERTY_ID_NOTIFICATION_CHANNELS = 'notification_channels';

// 通知渠道配置（通过 type 标识，不再使用独立ID）
export interface NotificationChannel {
    type: 'dingtalk' | 'wecom' | 'feishu' | 'email' | 'webhook'; // 渠道类型，作为唯一标识
    enabled: boolean; // 是否启用
    config: Record<string, any>; // JSON配置，根据type不同而不同
}

// 获取通知渠道列表
export const getNotificationChannels = async (): Promise<NotificationChannel[]> => {
    const channels = await getProperty<NotificationChannel[]>(PROPERTY_ID_NOTIFICATION_CHANNELS);
    return channels || [];
};

// 保存通知渠道列表
export const saveNotificationChannels = async (channels: NotificationChannel[]): Promise<void> => {
    return saveProperty(PROPERTY_ID_NOTIFICATION_CHANNELS, '通知渠道配置', channels);
};

// 测试通知渠道（从数据库读取配置）
export const testNotificationChannel = async (type: string): Promise<{ message: string }> => {
    const response = await post<{ message: string }>(`/admin/notification-channels/${type}/test`);
    return response.data;
};

// ==================== 系统配置 ====================

const PROPERTY_ID_SYSTEM_CONFIG = 'system_config';

export interface SystemConfig {
    systemNameEn: string;  // 英文名称
    systemNameZh: string;  // 中文名称
    logoBase64: string;    // Logo 的 base64 编码
    icpCode: string;       // ICP 备案号
    defaultView: string;   // 默认视图 grid,list
}

// 获取系统配置（管理后台使用）
export const getSystemConfig = async (): Promise<SystemConfig> => {
    return getProperty<SystemConfig>(PROPERTY_ID_SYSTEM_CONFIG);
};

// 保存系统配置
export const saveSystemConfig = async (config: SystemConfig): Promise<void> => {
    return saveProperty(PROPERTY_ID_SYSTEM_CONFIG, '系统配置', config);
};

