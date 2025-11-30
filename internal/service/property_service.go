package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/dushixiang/pika/internal/models"
	"github.com/dushixiang/pika/internal/repo"
	"github.com/dushixiang/pika/web"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	// PropertyIDNotificationChannels 通知渠道配置的固定 ID
	PropertyIDNotificationChannels = "notification_channels"
	// PropertyIDSystemConfig 系统配置的固定 ID
	PropertyIDSystemConfig = "system_config"
	// PropertyIDMetricsConfig 指标配置的固定 ID
	PropertyIDMetricsConfig = "metrics_config"
)

type PropertyService struct {
	repo   *repo.PropertyRepo
	logger *zap.Logger
	// 内存缓存，key 为 property ID，value 为 Property 对象
	cache map[string]models.Property
	// 缓存读写锁
	mu sync.RWMutex
}

func NewPropertyService(logger *zap.Logger, db *gorm.DB) *PropertyService {
	return &PropertyService{
		repo:   repo.NewPropertyRepo(db),
		logger: logger,
		cache:  make(map[string]models.Property),
	}
}

// Get 获取属性（返回原始 JSON 字符串）
func (s *PropertyService) Get(ctx context.Context, id string) (models.Property, error) {
	// 先尝试从缓存读取
	s.mu.RLock()
	if cached, ok := s.cache[id]; ok {
		s.mu.RUnlock()
		return cached, nil
	}
	s.mu.RUnlock()

	// 缓存未命中，从数据库读取
	property, err := s.repo.FindById(ctx, id)
	if err != nil {
		return models.Property{}, err
	}

	// 更新缓存
	s.mu.Lock()
	s.cache[id] = property
	s.mu.Unlock()

	return property, nil
}

// GetValue 获取属性值并反序列化
func (s *PropertyService) GetValue(ctx context.Context, id string, target interface{}) error {
	// 使用 Get 方法，内部已经支持缓存
	property, err := s.Get(ctx, id)
	if err != nil {
		return err
	}

	if property.Value == "" {
		return nil
	}

	return json.Unmarshal([]byte(property.Value), target)
}

// Set 设置属性（接收对象，自动序列化）
func (s *PropertyService) Set(ctx context.Context, id string, name string, value interface{}) error {
	jsonValue, err := json.Marshal(value)
	if err != nil {
		return err
	}

	property := &models.Property{
		ID:        id,
		Name:      name,
		Value:     string(jsonValue),
		CreatedAt: time.Now().UnixMilli(),
		UpdatedAt: time.Now().UnixMilli(),
	}

	err = s.repo.Save(ctx, property)
	if err != nil {
		return err
	}

	// 清空缓存中的该项，下次读取时会重新从数据库加载
	s.mu.Lock()
	delete(s.cache, id)
	s.mu.Unlock()

	return nil
}

func (s *PropertyService) GetNotificationChannelConfigs(ctx context.Context) ([]models.NotificationChannelConfig, error) {
	var allChannels []models.NotificationChannelConfig
	err := s.GetValue(ctx, PropertyIDNotificationChannels, &allChannels)
	if err != nil {
		return nil, fmt.Errorf("获取通知渠道配置失败: %w", err)
	}
	return allChannels, nil
}

func (s *PropertyService) GetSystemConfig(ctx context.Context) (*models.SystemConfig, error) {
	var systemConfig models.SystemConfig
	err := s.GetValue(ctx, PropertyIDSystemConfig, &systemConfig)
	if err != nil {
		return nil, fmt.Errorf("获取系统配置失败: %w", err)
	}
	return &systemConfig, nil
}

// GetMetricsConfig 获取指标配置
func (s *PropertyService) GetMetricsConfig(ctx context.Context) models.MetricsConfig {
	var config models.MetricsConfig
	err := s.GetValue(ctx, PropertyIDMetricsConfig, &config)
	if err != nil {
		// 返回默认配置
		return models.MetricsConfig{}
	}
	return config
}

// SetMetricsConfig 设置指标配置
func (s *PropertyService) SetMetricsConfig(ctx context.Context, config models.MetricsConfig) error {
	return s.Set(ctx, PropertyIDMetricsConfig, "指标数据配置", config)
}

// defaultPropertyConfig 默认配置项定义
type defaultPropertyConfig struct {
	ID    string
	Name  string
	Value interface{}
}

// InitializeDefaultConfigs 初始化默认配置（如果数据库中不存在）
func (s *PropertyService) InitializeDefaultConfigs(ctx context.Context) error {
	// 定义所有需要初始化的默认配置
	defaultConfigs := []defaultPropertyConfig{
		{
			ID:   PropertyIDSystemConfig,
			Name: "系统配置",
			Value: models.SystemConfig{
				SystemNameZh: "皮卡监控",
				SystemNameEn: "Pika Monitor",
				LogoBase64:   web.DefaultLogoBase64(),
				ICPCode:      "",
				DefaultView:  "grid",
			},
		},
		{
			ID:    PropertyIDNotificationChannels,
			Name:  "通知渠道配置",
			Value: []models.NotificationChannelConfig{},
		},
		{
			ID:   PropertyIDMetricsConfig,
			Name: "指标数据配置",
			Value: models.MetricsConfig{
				RetentionHours: 168, // 默认7天
				MaxQueryPoints: 300, // 默认300个点（优化前端渲染性能）
				TimeRangeOptions: []models.TimeRangeOption{
					{Label: "15分钟", Value: "15m"},
					{Label: "30分钟", Value: "30m"},
					{Label: "1小时", Value: "1h"},
					{Label: "3小时", Value: "3h"},
					{Label: "6小时", Value: "6h"},
					{Label: "12小时", Value: "12h"},
					{Label: "1天", Value: "1d"},
					{Label: "3天", Value: "3d"},
					{Label: "7天", Value: "7d"},
				},
			},
		},
	}

	// 遍历并初始化每个配置
	for _, config := range defaultConfigs {
		if err := s.initializeProperty(ctx, config); err != nil {
			return fmt.Errorf("初始化 %s 失败: %w", config.Name, err)
		}
	}

	s.logger.Info("默认配置初始化完成")
	return nil
}

// initializeProperty 初始化单个配置项
func (s *PropertyService) initializeProperty(ctx context.Context, config defaultPropertyConfig) error {
	// 检查配置是否已存在
	exists, err := s.repo.ExistsById(ctx, config.ID)
	if err != nil {
		return err
	}

	if exists {
		// 配置已存在，无需初始化
		s.logger.Info("配置已存在，跳过初始化", zap.String("name", config.Name))
		return nil
	}

	// 配置不存在，创建默认配置
	if err := s.Set(ctx, config.ID, config.Name, config.Value); err != nil {
		return err
	}
	s.logger.Info("配置默认值已初始化", zap.String("name", config.Name))
	return nil
}
