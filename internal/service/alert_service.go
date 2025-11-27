package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/dushixiang/pika/internal/models"
	"github.com/dushixiang/pika/internal/repo"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// AlertService 告警服务
type AlertService struct {
	alertRepo       *repo.AlertRepo
	agentRepo       *repo.AgentRepo
	metricRepo      *repo.MetricRepo
	propertyService *PropertyService
	notifier        *Notifier
	logger          *zap.Logger

	// 告警状态缓存（内存中维护）
	states map[string]*models.AlertState
	mu     sync.RWMutex
}

func NewAlertService(logger *zap.Logger, db *gorm.DB, propertyService *PropertyService, notifier *Notifier) *AlertService {
	return &AlertService{
		alertRepo:       repo.NewAlertRepo(db),
		agentRepo:       repo.NewAgentRepo(db),
		metricRepo:      repo.NewMetricRepo(db),
		propertyService: propertyService,
		notifier:        notifier,
		logger:          logger,
		states:          make(map[string]*models.AlertState),
	}
}

// CreateAlertConfig 创建告警配置
func (s *AlertService) CreateAlertConfig(ctx context.Context, config *models.AlertConfig) error {
	config.ID = uuid.New().String()
	config.CreatedAt = time.Now().UnixMilli()
	config.UpdatedAt = time.Now().UnixMilli()

	return s.alertRepo.CreateAlertConfig(ctx, config)
}

// UpdateAlertConfig 更新告警配置
func (s *AlertService) UpdateAlertConfig(ctx context.Context, config *models.AlertConfig) error {
	config.UpdatedAt = time.Now().UnixMilli()
	return s.alertRepo.UpdateAlertConfig(ctx, config)
}

// DeleteAlertConfig 删除告警配置
func (s *AlertService) DeleteAlertConfig(ctx context.Context, id string) error {
	// 清理该配置相关的状态
	s.mu.Lock()
	for key, state := range s.states {
		if state.ConfigID == id {
			delete(s.states, key)
		}
	}
	s.mu.Unlock()

	return s.alertRepo.DeleteAlertConfig(ctx, id)
}

// GetAlertConfig 获取告警配置
func (s *AlertService) GetAlertConfig(ctx context.Context, id string) (*models.AlertConfig, error) {
	return s.alertRepo.GetAlertConfig(ctx, id)
}

// ListAlertConfigsByAgent 列出探针的告警配置
func (s *AlertService) ListAlertConfigsByAgent(ctx context.Context, agentID string) ([]models.AlertConfig, error) {
	return s.alertRepo.FindByAgentID(ctx, agentID)
}

// ListAlertRecords 列出告警记录
func (s *AlertService) ListAlertRecords(ctx context.Context, agentID string, limit int, offset int) ([]models.AlertRecord, int64, error) {
	return s.alertRepo.ListAlertRecords(ctx, agentID, limit, offset)
}

// CheckMetrics 检查指标并触发告警
func (s *AlertService) CheckMetrics(ctx context.Context, agentID string, cpu, memory, disk float64) error {
	// 获取全局告警配置
	globalConfigs, err := s.alertRepo.FindEnabledByAgentID(ctx, "global")
	if err != nil {
		s.logger.Error("获取全局告警配置失败", zap.Error(err))
		return err
	}

	// 获取探针信息（用于发送通知）
	agent, err := s.agentRepo.FindById(ctx, agentID)
	if err != nil {
		s.logger.Error("获取探针信息失败", zap.Error(err))
		return err
	}

	now := time.Now().UnixMilli()

	// 检查每个配置的告警规则
	for _, config := range globalConfigs {
		// 检查 CPU 告警
		if config.Rules.CPUEnabled {
			s.checkAlert(ctx, &config, &agent, "cpu", cpu, config.Rules.CPUThreshold, config.Rules.CPUDuration, now)
		}

		// 检查内存告警
		if config.Rules.MemoryEnabled {
			s.checkAlert(ctx, &config, &agent, "memory", memory, config.Rules.MemoryThreshold, config.Rules.MemoryDuration, now)
		}

		// 检查磁盘告警
		if config.Rules.DiskEnabled {
			s.checkAlert(ctx, &config, &agent, "disk", disk, config.Rules.DiskThreshold, config.Rules.DiskDuration, now)
		}
	}

	return nil
}

// checkAlert 检查单个告警规则
func (s *AlertService) checkAlert(ctx context.Context, config *models.AlertConfig, agent *models.Agent, alertType string, currentValue, threshold float64, duration int, now int64) {
	stateKey := fmt.Sprintf("%s:%s:%s", config.AgentID, config.ID, alertType)

	s.mu.Lock()
	state, exists := s.states[stateKey]
	if !exists {
		state = &models.AlertState{
			AgentID:   config.AgentID,
			ConfigID:  config.ID,
			AlertType: alertType,
			Threshold: threshold,
			Duration:  duration,
		}
		s.states[stateKey] = state
	}
	s.mu.Unlock()

	// 更新当前值和检查时间
	state.Value = currentValue
	state.LastCheckTime = now

	// 判断是否超过阈值
	if currentValue >= threshold {
		// 超过阈值
		if state.StartTime == 0 {
			// 首次超过阈值，记录开始时间
			state.StartTime = now
		}

		// 计算已持续时间（秒）
		elapsedSeconds := (now - state.StartTime) / 1000

		// 判断是否达到持续时间要求
		if elapsedSeconds >= int64(duration) {
			// 达到持续时间要求，触发告警
			if !state.IsFiring {
				// 从未触发状态变为触发状态
				s.fireAlert(ctx, config, agent, state)
			}
		}
	} else {
		// 未超过阈值
		if state.IsFiring {
			// 从触发状态变为恢复状态
			s.resolveAlert(ctx, config, agent, state)
		}

		// 重置开始时间
		state.StartTime = 0
	}
}

// fireAlert 触发告警
func (s *AlertService) fireAlert(ctx context.Context, config *models.AlertConfig, agent *models.Agent, state *models.AlertState) {
	s.logger.Info("触发告警",
		zap.String("agentId", agent.ID),
		zap.String("agentName", agent.Name),
		zap.String("configId", config.ID),
		zap.String("alertType", state.AlertType),
		zap.Float64("value", state.Value),
		zap.Float64("threshold", state.Threshold),
	)

	// 创建告警记录
	record := &models.AlertRecord{
		AgentID:     agent.ID,
		ConfigID:    config.ID,
		ConfigName:  config.Name,
		AlertType:   state.AlertType,
		Message:     s.buildAlertMessage(state),
		Threshold:   state.Threshold,
		ActualValue: state.Value,
		Level:       s.calculateLevel(state.Value, state.Threshold),
		Status:      "firing",
		FiredAt:     time.Now().UnixMilli(),
		CreatedAt:   time.Now().UnixMilli(),
	}

	err := s.alertRepo.CreateAlertRecord(ctx, record)
	if err != nil {
		s.logger.Error("创建告警记录失败", zap.Error(err))
		return
	}

	// 更新状态
	state.IsFiring = true
	state.LastRecordID = record.ID

	// 发送通知
	go func() {
		// 获取所有通知渠道配置
		channelConfigs, err := s.propertyService.GetNotificationChannelConfigs(context.Background())
		if err != nil {
			s.logger.Error("获取通知渠道配置失败", zap.Error(err))
			return
		}

		var enabledChannels []models.NotificationChannelConfig
		for _, channel := range channelConfigs {
			if !channel.Enabled {
				continue
			}
			enabledChannels = append(enabledChannels, channel)
		}
		if err := s.notifier.SendNotificationByConfigs(context.Background(), enabledChannels, record, agent); err != nil {
			s.logger.Error("发送告警通知失败", zap.Error(err))
		}
	}()
}

// resolveAlert 恢复告警
func (s *AlertService) resolveAlert(ctx context.Context, config *models.AlertConfig, agent *models.Agent, state *models.AlertState) {
	s.logger.Info("告警恢复",
		zap.String("agentId", agent.ID),
		zap.String("agentName", agent.Name),
		zap.String("configId", config.ID),
		zap.String("alertType", state.AlertType),
		zap.Float64("value", state.Value),
	)

	// 更新告警记录状态
	if state.LastRecordID > 0 {
		// 先查询完整记录
		existingRecord, err := s.alertRepo.GetLatestAlertRecord(ctx, config.ID, state.AlertType)
		if err == nil && existingRecord != nil {
			existingRecord.Status = "resolved"
			existingRecord.ActualValue = state.Value
			existingRecord.ResolvedAt = time.Now().UnixMilli()
			existingRecord.UpdatedAt = time.Now().UnixMilli()

			err = s.alertRepo.UpdateAlertRecord(ctx, existingRecord)
			if err != nil {
				s.logger.Error("更新告警记录失败", zap.Error(err))
			} else {
				// 发送恢复通知
				go func() {
					// 获取所有通知渠道配置
					channelConfigs, err := s.propertyService.GetNotificationChannelConfigs(context.Background())
					if err != nil {
						s.logger.Error("获取通知渠道配置失败", zap.Error(err))
						return
					}

					var enabledChannels []models.NotificationChannelConfig
					for _, channel := range channelConfigs {
						if !channel.Enabled {
							continue
						}
						enabledChannels = append(enabledChannels, channel)
					}

					if err := s.notifier.SendNotificationByConfigs(context.Background(), enabledChannels, existingRecord, agent); err != nil {
						s.logger.Error("发送恢复通知失败", zap.Error(err))
					}
				}()
			}
		}
	}

	// 更新状态
	state.IsFiring = false
	state.LastRecordID = 0
}

// buildAlertMessage 构建告警消息
func (s *AlertService) buildAlertMessage(state *models.AlertState) string {
	var alertTypeName string
	switch state.AlertType {
	case "cpu":
		alertTypeName = "CPU使用率"
	case "memory":
		alertTypeName = "内存使用率"
	case "disk":
		alertTypeName = "磁盘使用率"
	case "network":
		alertTypeName = "网络连接"
	case "cert":
		return fmt.Sprintf("HTTPS证书剩余天数%.0f天，低于阈值%.0f天", state.Value, state.Threshold)
	case "service":
		return fmt.Sprintf("服务持续离线%d秒", state.Duration)
	default:
		alertTypeName = state.AlertType
	}

	return fmt.Sprintf("%s持续%d秒超过%.2f%%，当前值%.2f%%",
		alertTypeName,
		state.Duration,
		state.Threshold,
		state.Value,
	)
}

// calculateLevel 计算告警级别
func (s *AlertService) calculateLevel(value, threshold float64) string {
	diff := value - threshold

	if diff < 20 {
		return "info"
	} else if diff < 50 {
		return "warning"
	} else {
		return "critical"
	}
}

// CheckMonitorAlerts 检查监控相关告警（证书和服务下线）
func (s *AlertService) CheckMonitorAlerts(ctx context.Context) error {
	// 获取全局告警配置
	globalConfigs, err := s.alertRepo.FindEnabledByAgentID(ctx, "global")
	if err != nil {
		s.logger.Error("获取全局告警配置失败", zap.Error(err))
		return err
	}

	now := time.Now().UnixMilli()

	// 检查每个配置的告警规则
	for _, config := range globalConfigs {
		// 检查证书告警
		if config.Rules.CertEnabled {
			if err := s.checkCertificateAlerts(ctx, &config, now); err != nil {
				s.logger.Error("检查证书告警失败", zap.Error(err))
			}
		}

		// 检查服务下线告警
		if config.Rules.ServiceEnabled {
			if err := s.checkServiceDownAlerts(ctx, &config, now); err != nil {
				s.logger.Error("检查服务下线告警失败", zap.Error(err))
			}
		}

		// 检查探针离线告警
		if config.Rules.AgentOfflineEnabled {
			if err := s.checkAgentOfflineAlerts(ctx, &config, now); err != nil {
				s.logger.Error("检查探针离线告警失败", zap.Error(err))
			}
		}
	}

	return nil
}

// checkCertificateAlerts 检查证书告警
func (s *AlertService) checkCertificateAlerts(ctx context.Context, config *models.AlertConfig, now int64) error {
	// 获取所有最新的监控指标（仅HTTPS类型）
	// 这里需要查询最新的 monitor_metrics 记录，获取证书剩余天数
	monitors, err := s.metricRepo.GetLatestMonitorMetricsByType(ctx, "http")
	if err != nil {
		return err
	}

	for _, monitor := range monitors {
		// 如果证书不存在或已过期，跳过
		if monitor.CertExpiryTime == 0 {
			continue
		}

		certDaysLeft := float64(monitor.CertDaysLeft)

		// 获取探针信息
		agent, err := s.agentRepo.FindById(ctx, monitor.AgentId)
		if err != nil {
			s.logger.Error("获取探针信息失败", zap.String("agentId", monitor.AgentId), zap.Error(err))
			continue
		}

		// 检查证书剩余天数是否低于阈值
		if certDaysLeft <= config.Rules.CertThreshold && certDaysLeft >= 0 {
			// 触发告警（证书告警不需要持续时间，直接触发）
			s.checkCertAlert(ctx, config, &agent, monitor, certDaysLeft, now)
		} else {
			// 恢复告警（如果之前触发过）
			s.resolveCertAlert(ctx, config, &agent, monitor, certDaysLeft)
		}
	}

	return nil
}

// checkCertAlert 检查并触发证书告警
func (s *AlertService) checkCertAlert(ctx context.Context, config *models.AlertConfig, agent *models.Agent, monitor *models.MonitorMetric, certDaysLeft float64, now int64) {
	stateKey := fmt.Sprintf("%s:%s:cert:%s", config.AgentID, config.ID, monitor.MonitorId)

	s.mu.Lock()
	state, exists := s.states[stateKey]
	if !exists {
		state = &models.AlertState{
			AgentID:   agent.ID,
			ConfigID:  config.ID,
			AlertType: "cert",
			Threshold: config.Rules.CertThreshold,
			Duration:  0, // 证书告警不需要持续时间
		}
		s.states[stateKey] = state
	}
	s.mu.Unlock()

	state.Value = certDaysLeft
	state.LastCheckTime = now

	// 如果尚未触发告警，则触发
	if !state.IsFiring {
		s.logger.Info("触发证书告警",
			zap.String("agentId", agent.ID),
			zap.String("monitorId", monitor.MonitorId),
			zap.String("target", monitor.Target),
			zap.Float64("certDaysLeft", certDaysLeft),
			zap.Float64("threshold", config.Rules.CertThreshold),
		)

		// 创建告警记录
		record := &models.AlertRecord{
			AgentID:     agent.ID,
			ConfigID:    config.ID,
			ConfigName:  config.Name,
			AlertType:   "cert",
			Message:     fmt.Sprintf("监控项 %s 的HTTPS证书剩余天数%.0f天，低于阈值%.0f天", monitor.Target, certDaysLeft, config.Rules.CertThreshold),
			Threshold:   config.Rules.CertThreshold,
			ActualValue: certDaysLeft,
			Level:       s.calculateCertLevel(certDaysLeft),
			Status:      "firing",
			FiredAt:     now,
			CreatedAt:   now,
		}

		err := s.alertRepo.CreateAlertRecord(ctx, record)
		if err != nil {
			s.logger.Error("创建证书告警记录失败", zap.Error(err))
			return
		}

		state.IsFiring = true
		state.LastRecordID = record.ID

		// 发送通知
		go func() {
			channelConfigs, err := s.propertyService.GetNotificationChannelConfigs(context.Background())
			if err != nil {
				s.logger.Error("获取通知渠道配置失败", zap.Error(err))
				return
			}

			var enabledChannels []models.NotificationChannelConfig
			for _, channel := range channelConfigs {
				if channel.Enabled {
					enabledChannels = append(enabledChannels, channel)
				}
			}

			if err := s.notifier.SendNotificationByConfigs(context.Background(), enabledChannels, record, agent); err != nil {
				s.logger.Error("发送证书告警通知失败", zap.Error(err))
			}
		}()
	}
}

// resolveCertAlert 恢复证书告警
func (s *AlertService) resolveCertAlert(ctx context.Context, config *models.AlertConfig, agent *models.Agent, monitor *models.MonitorMetric, certDaysLeft float64) {
	stateKey := fmt.Sprintf("%s:%s:cert:%s", config.AgentID, config.ID, monitor.MonitorId)

	s.mu.RLock()
	state, exists := s.states[stateKey]
	s.mu.RUnlock()

	if !exists || !state.IsFiring {
		return
	}

	s.logger.Info("证书告警恢复",
		zap.String("agentId", agent.ID),
		zap.String("monitorId", monitor.MonitorId),
		zap.String("target", monitor.Target),
		zap.Float64("certDaysLeft", certDaysLeft),
	)

	// 更新告警记录状态
	if state.LastRecordID > 0 {
		existingRecord, err := s.alertRepo.GetLatestAlertRecord(ctx, config.ID, "cert")
		if err == nil && existingRecord != nil {
			existingRecord.Status = "resolved"
			existingRecord.ActualValue = certDaysLeft
			existingRecord.ResolvedAt = time.Now().UnixMilli()
			existingRecord.UpdatedAt = time.Now().UnixMilli()

			err = s.alertRepo.UpdateAlertRecord(ctx, existingRecord)
			if err != nil {
				s.logger.Error("更新证书告警记录失败", zap.Error(err))
			} else {
				// 发送恢复通知
				go func() {
					channelConfigs, err := s.propertyService.GetNotificationChannelConfigs(context.Background())
					if err != nil {
						s.logger.Error("获取通知渠道配置失败", zap.Error(err))
						return
					}

					var enabledChannels []models.NotificationChannelConfig
					for _, channel := range channelConfigs {
						if channel.Enabled {
							enabledChannels = append(enabledChannels, channel)
						}
					}

					if err := s.notifier.SendNotificationByConfigs(context.Background(), enabledChannels, existingRecord, agent); err != nil {
						s.logger.Error("发送证书恢复通知失败", zap.Error(err))
					}
				}()
			}
		}
	}

	state.IsFiring = false
	state.LastRecordID = 0
}

// calculateCertLevel 计算证书告警级别
func (s *AlertService) calculateCertLevel(daysLeft float64) string {
	if daysLeft <= 7 {
		return "critical"
	} else if daysLeft <= 30 {
		return "warning"
	} else {
		return "info"
	}
}

// checkServiceDownAlerts 检查服务下线告警
func (s *AlertService) checkServiceDownAlerts(ctx context.Context, config *models.AlertConfig, now int64) error {
	// 获取所有最新的监控指标
	monitors, err := s.metricRepo.GetAllLatestMonitorMetrics(ctx)
	if err != nil {
		return err
	}

	for _, monitor := range monitors {
		// 获取探针信息
		agent, err := s.agentRepo.FindById(ctx, monitor.AgentId)
		if err != nil {
			s.logger.Error("获取探针信息失败", zap.String("agentId", monitor.AgentId), zap.Error(err))
			continue
		}

		stateKey := fmt.Sprintf("%s:%s:service:%s", config.AgentID, config.ID, monitor.MonitorId)

		s.mu.Lock()
		state, exists := s.states[stateKey]
		if !exists {
			state = &models.AlertState{
				AgentID:   agent.ID,
				ConfigID:  config.ID,
				AlertType: "service",
				Threshold: 0,
				Duration:  config.Rules.ServiceDuration,
			}
			s.states[stateKey] = state
		}
		s.mu.Unlock()

		state.LastCheckTime = now

		// 检查服务状态
		if monitor.Status == "down" {
			// 服务离线
			if state.StartTime == 0 {
				// 首次检测到离线，记录开始时间
				state.StartTime = monitor.Timestamp
			}

			// 计算已持续离线时间（秒）
			elapsedSeconds := (now - state.StartTime) / 1000

			// 判断是否达到持续时间要求
			if elapsedSeconds >= int64(config.Rules.ServiceDuration) {
				// 达到持续时间要求，触发告警
				if !state.IsFiring {
					s.fireServiceDownAlert(ctx, config, &agent, monitor, state, now)
				}
			}
		} else {
			// 服务在线
			if state.IsFiring {
				// 从告警状态变为恢复状态
				s.resolveServiceDownAlert(ctx, config, &agent, monitor, state)
			}

			// 重置开始时间
			state.StartTime = 0
		}
	}

	return nil
}

// fireServiceDownAlert 触发服务下线告警
func (s *AlertService) fireServiceDownAlert(ctx context.Context, config *models.AlertConfig, agent *models.Agent, monitor *models.MonitorMetric, state *models.AlertState, now int64) {
	s.logger.Info("触发服务下线告警",
		zap.String("agentId", agent.ID),
		zap.String("monitorId", monitor.MonitorId),
		zap.String("target", monitor.Target),
		zap.Int("duration", state.Duration),
	)

	// 创建告警记录
	record := &models.AlertRecord{
		AgentID:     agent.ID,
		ConfigID:    config.ID,
		ConfigName:  config.Name,
		AlertType:   "service",
		Message:     fmt.Sprintf("监控项 %s 持续离线%d秒", monitor.Target, state.Duration),
		Threshold:   0,
		ActualValue: float64(state.Duration),
		Level:       "critical",
		Status:      "firing",
		FiredAt:     now,
		CreatedAt:   now,
	}

	err := s.alertRepo.CreateAlertRecord(ctx, record)
	if err != nil {
		s.logger.Error("创建服务下线告警记录失败", zap.Error(err))
		return
	}

	state.IsFiring = true
	state.LastRecordID = record.ID

	// 发送通知
	go func() {
		channelConfigs, err := s.propertyService.GetNotificationChannelConfigs(context.Background())
		if err != nil {
			s.logger.Error("获取通知渠道配置失败", zap.Error(err))
			return
		}

		var enabledChannels []models.NotificationChannelConfig
		for _, channel := range channelConfigs {
			if channel.Enabled {
				enabledChannels = append(enabledChannels, channel)
			}
		}

		if err := s.notifier.SendNotificationByConfigs(context.Background(), enabledChannels, record, agent); err != nil {
			s.logger.Error("发送服务下线告警通知失败", zap.Error(err))
		}
	}()
}

// resolveServiceDownAlert 恢复服务下线告警
func (s *AlertService) resolveServiceDownAlert(ctx context.Context, config *models.AlertConfig, agent *models.Agent, monitor *models.MonitorMetric, state *models.AlertState) {
	s.logger.Info("服务下线告警恢复",
		zap.String("agentId", agent.ID),
		zap.String("monitorId", monitor.MonitorId),
		zap.String("target", monitor.Target),
	)

	// 更新告警记录状态
	if state.LastRecordID > 0 {
		existingRecord, err := s.alertRepo.GetLatestAlertRecord(ctx, config.ID, "service")
		if err == nil && existingRecord != nil {
			existingRecord.Status = "resolved"
			existingRecord.ResolvedAt = time.Now().UnixMilli()
			existingRecord.UpdatedAt = time.Now().UnixMilli()

			err = s.alertRepo.UpdateAlertRecord(ctx, existingRecord)
			if err != nil {
				s.logger.Error("更新服务下线告警记录失败", zap.Error(err))
			} else {
				// 发送恢复通知
				go func() {
					channelConfigs, err := s.propertyService.GetNotificationChannelConfigs(context.Background())
					if err != nil {
						s.logger.Error("获取通知渠道配置失败", zap.Error(err))
						return
					}

					var enabledChannels []models.NotificationChannelConfig
					for _, channel := range channelConfigs {
						if channel.Enabled {
							enabledChannels = append(enabledChannels, channel)
						}
					}

					if err := s.notifier.SendNotificationByConfigs(context.Background(), enabledChannels, existingRecord, agent); err != nil {
						s.logger.Error("发送服务恢复通知失败", zap.Error(err))
					}
				}()
			}
		}
	}

	state.IsFiring = false
	state.LastRecordID = 0
}

// checkAgentOfflineAlerts 检查探针离线告警
func (s *AlertService) checkAgentOfflineAlerts(ctx context.Context, config *models.AlertConfig, now int64) error {
	// 获取所有探针
	agents, err := s.agentRepo.FindAll(ctx)
	if err != nil {
		return err
	}

	for _, agent := range agents {
		stateKey := fmt.Sprintf("%s:%s:agent_offline:%s", config.AgentID, config.ID, agent.ID)

		s.mu.Lock()
		state, exists := s.states[stateKey]
		if !exists {
			state = &models.AlertState{
				AgentID:   agent.ID,
				ConfigID:  config.ID,
				AlertType: "agent_offline",
				Threshold: 0,
				Duration:  config.Rules.AgentOfflineDuration,
			}
			s.states[stateKey] = state
		}
		s.mu.Unlock()

		state.LastCheckTime = now

		// 计算探针离线时间（秒）
		offlineSeconds := (now - agent.LastSeenAt) / 1000

		// 检查探针是否离线超过阈值
		if offlineSeconds >= int64(config.Rules.AgentOfflineDuration) {
			// 探针离线超过阈值
			if !state.IsFiring {
				// 触发告警
				s.fireAgentOfflineAlert(ctx, config, &agent, state, offlineSeconds, now)
			}
		} else {
			// 探针在线或离线时间未达到阈值
			if state.IsFiring {
				// 从告警状态变为恢复状态
				s.resolveAgentOfflineAlert(ctx, config, &agent, state)
			}
		}
	}

	return nil
}

// fireAgentOfflineAlert 触发探针离线告警
func (s *AlertService) fireAgentOfflineAlert(ctx context.Context, config *models.AlertConfig, agent *models.Agent, state *models.AlertState, offlineSeconds int64, now int64) {
	s.logger.Info("触发探针离线告警",
		zap.String("agentId", agent.ID),
		zap.String("agentName", agent.Name),
		zap.Int64("offlineSeconds", offlineSeconds),
		zap.Int("threshold", state.Duration),
	)

	// 创建告警记录
	record := &models.AlertRecord{
		AgentID:     agent.ID,
		ConfigID:    config.ID,
		ConfigName:  config.Name,
		AlertType:   "agent_offline",
		Message:     fmt.Sprintf("探针 %s 已离线%d秒，超过阈值%d秒", agent.Name, offlineSeconds, state.Duration),
		Threshold:   float64(state.Duration),
		ActualValue: float64(offlineSeconds),
		Level:       "critical",
		Status:      "firing",
		FiredAt:     now,
		CreatedAt:   now,
	}

	err := s.alertRepo.CreateAlertRecord(ctx, record)
	if err != nil {
		s.logger.Error("创建探针离线告警记录失败", zap.Error(err))
		return
	}

	state.IsFiring = true
	state.LastRecordID = record.ID

	// 发送通知
	go func() {
		channelConfigs, err := s.propertyService.GetNotificationChannelConfigs(context.Background())
		if err != nil {
			s.logger.Error("获取通知渠道配置失败", zap.Error(err))
			return
		}

		var enabledChannels []models.NotificationChannelConfig
		for _, channel := range channelConfigs {
			if channel.Enabled {
				enabledChannels = append(enabledChannels, channel)
			}
		}

		if err := s.notifier.SendNotificationByConfigs(context.Background(), enabledChannels, record, agent); err != nil {
			s.logger.Error("发送探针离线告警通知失败", zap.Error(err))
		}
	}()
}

// resolveAgentOfflineAlert 恢复探针离线告警
func (s *AlertService) resolveAgentOfflineAlert(ctx context.Context, config *models.AlertConfig, agent *models.Agent, state *models.AlertState) {
	s.logger.Info("探针离线告警恢复",
		zap.String("agentId", agent.ID),
		zap.String("agentName", agent.Name),
	)

	// 更新告警记录状态
	if state.LastRecordID > 0 {
		existingRecord, err := s.alertRepo.GetLatestAlertRecord(ctx, config.ID, "agent_offline")
		if err == nil && existingRecord != nil {
			existingRecord.Status = "resolved"
			existingRecord.ResolvedAt = time.Now().UnixMilli()
			existingRecord.UpdatedAt = time.Now().UnixMilli()

			err = s.alertRepo.UpdateAlertRecord(ctx, existingRecord)
			if err != nil {
				s.logger.Error("更新探针离线告警记录失败", zap.Error(err))
			} else {
				// 发送恢复通知
				go func() {
					channelConfigs, err := s.propertyService.GetNotificationChannelConfigs(context.Background())
					if err != nil {
						s.logger.Error("获取通知渠道配置失败", zap.Error(err))
						return
					}

					var enabledChannels []models.NotificationChannelConfig
					for _, channel := range channelConfigs {
						if channel.Enabled {
							enabledChannels = append(enabledChannels, channel)
						}
					}

					if err := s.notifier.SendNotificationByConfigs(context.Background(), enabledChannels, existingRecord, agent); err != nil {
						s.logger.Error("发送探针恢复通知失败", zap.Error(err))
					}
				}()
			}
		}
	}

	state.IsFiring = false
	state.LastRecordID = 0
}
