import { get, put } from './request';

const PROPERTY_ID_SYSTEM_CONFIG = 'system_config';

export interface SystemConfig {
    systemNameEn: string;  // 英文名称
    systemNameZh: string;  // 中文名称
    logoBase64: string;    // Logo 的 base64 编码
}

// 默认系统配置
export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    systemNameEn: 'Pika Monitor',
    systemNameZh: '皮卡监控',
    logoBase64: '',  // 默认为空，将使用 /logo.png
};

// 获取系统配置（管理后台使用）
export const getSystemConfig = async (): Promise<SystemConfig> => {
    try {
        const response = await get<{ id: string; name: string; value: SystemConfig }>(
            `/admin/properties/${PROPERTY_ID_SYSTEM_CONFIG}`
        );
        return response.data.value || DEFAULT_SYSTEM_CONFIG;
    } catch (error) {
        // 如果配置不存在，返回默认值
        return DEFAULT_SYSTEM_CONFIG;
    }
};

// 获取系统配置（公开访问，不需要认证）
export const getPublicSystemConfig = async (): Promise<SystemConfig> => {
    try {
        const response = await get<{ id: string; name: string; value: SystemConfig }>(
            `/system-config`
        );
        return response.data.value || DEFAULT_SYSTEM_CONFIG;
    } catch (error) {
        // 如果配置不存在，返回默认值
        return DEFAULT_SYSTEM_CONFIG;
    }
};

// 保存系统配置
export const saveSystemConfig = async (config: SystemConfig): Promise<void> => {
    await put(`/admin/properties/${PROPERTY_ID_SYSTEM_CONFIG}`, {
        name: '系统配置',
        value: config,
    });
};
