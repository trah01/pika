package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/dushixiang/pika/internal/models"
	"go.uber.org/zap"
)

// Notifier 告警通知服务
type Notifier struct {
	logger *zap.Logger
}

func NewNotifier(logger *zap.Logger) *Notifier {
	return &Notifier{
		logger: logger,
	}
}

// buildMessage 构建告警消息文本
func (n *Notifier) buildMessage(agent *models.Agent, record *models.AlertRecord) string {
	var message string

	// 告警级别图标
	levelIcon := ""
	switch record.Level {
	case "info":
		levelIcon = "ℹ️"
	case "warning":
		levelIcon = "⚠️"
	case "critical":
		levelIcon = "🚨"
	}

	// 告警类型名称
	alertTypeName := ""
	switch record.AlertType {
	case "cpu":
		alertTypeName = "CPU告警"
	case "memory":
		alertTypeName = "内存告警"
	case "disk":
		alertTypeName = "磁盘告警"
	case "network":
		alertTypeName = "网络断开告警"
	case "cert":
		alertTypeName = "证书告警"
	case "service":
		alertTypeName = "服务告警"
	}

	if record.Status == "firing" {
		// 告警触发消息
		message = fmt.Sprintf(
			"%s %s\n\n"+
				"探针: %s (%s)\n"+
				"主机: %s\n"+
				"IP: %s\n"+
				"告警类型: %s\n"+
				"告警消息: %s\n"+
				"阈值: %.2f%%\n"+
				"当前值: %.2f%%\n"+
				"触发时间: %s",
			levelIcon,
			alertTypeName,
			agent.Name,
			agent.ID,
			agent.Hostname,
			agent.IP,
			record.AlertType,
			record.Message,
			record.Threshold,
			record.ActualValue,
			time.Unix(record.FiredAt/1000, 0).Format("2006-01-02 15:04:05"),
		)
	} else if record.Status == "resolved" {
		// 告警恢复消息
		message = fmt.Sprintf(
			"✅ %s已恢复\n\n"+
				"探针: %s (%s)\n"+
				"主机: %s\n"+
				"IP: %s\n"+
				"告警类型: %s\n"+
				"当前值: %.2f%%\n"+
				"恢复时间: %s",
			alertTypeName,
			agent.Name,
			agent.ID,
			agent.Hostname,
			agent.IP,
			record.AlertType,
			record.ActualValue,
			time.Unix(record.ResolvedAt/1000, 0).Format("2006-01-02 15:04:05"),
		)
	}

	return message
}

// sendDingTalk 发送钉钉通知
func (n *Notifier) sendDingTalk(ctx context.Context, webhook, secret, message string) error {
	// 构造钉钉消息体
	body := map[string]interface{}{
		"msgtype": "text",
		"text": map[string]string{
			"content": message,
		},
	}

	// 如果有加签密钥，计算签名
	timestamp := time.Now().UnixMilli()
	if secret != "" {
		sign := n.calculateDingTalkSign(timestamp, secret)
		webhook = fmt.Sprintf("%s&timestamp=%d&sign=%s", webhook, timestamp, sign)
	}
	_, err := n.sendJSONRequest(ctx, webhook, body)
	if err != nil {
		return err
	}
	return nil
}

// calculateDingTalkSign 计算钉钉加签
func (n *Notifier) calculateDingTalkSign(timestamp int64, secret string) string {
	stringToSign := fmt.Sprintf("%d\n%s", timestamp, secret)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(stringToSign))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

type WeComResult struct {
	Errcode   int    `json:"errcode"`
	Errmsg    string `json:"errmsg"`
	Type      string `json:"type"`
	MediaId   string `json:"media_id"`
	CreatedAt string `json:"created_at"`
}

// sendWeCom 发送企业微信通知
func (n *Notifier) sendWeCom(ctx context.Context, webhook, message string) error {
	body := map[string]interface{}{
		"msgtype": "text",
		"text": map[string]string{
			"content": message,
		},
	}
	result, err := n.sendJSONRequest(ctx, webhook, body)
	if err != nil {
		return err
	}
	var weComResult WeComResult
	if err := json.Unmarshal(result, &weComResult); err != nil {
		return err
	}
	if weComResult.Errcode != 0 {
		return fmt.Errorf("%s", weComResult.Errmsg)
	}
	return nil
}

// sendFeishu 发送飞书通知
func (n *Notifier) sendFeishu(ctx context.Context, webhook, message string) error {
	body := map[string]interface{}{
		"msg_type": "text",
		"content": map[string]string{
			"text": message,
		},
	}

	_, err := n.sendJSONRequest(ctx, webhook, body)
	if err != nil {
		return err
	}
	return nil
}

// sendCustomWebhook 发送自定义Webhook
func (n *Notifier) sendCustomWebhook(ctx context.Context, webhook string, message string) error {
	// 发送完整的告警记录和探针信息
	body := map[string]interface{}{
		"msg_type": "text",
		"text": map[string]string{
			"content": message,
		},
	}

	_, err := n.sendJSONRequest(ctx, webhook, body)
	if err != nil {
		return err
	}
	return nil
}

// sendJSONRequest 发送JSON请求
func (n *Notifier) sendJSONRequest(ctx context.Context, url string, body interface{}) ([]byte, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("序列化请求体失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("发送请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("请求失败，状态码: %d, 响应: %s", resp.StatusCode, string(respBody))
	}

	n.logger.Info("通知发送成功", zap.String("url", url), zap.String("response", string(respBody)))
	return respBody, nil
}

// sendDingTalkByConfig 根据配置发送钉钉通知
func (n *Notifier) sendDingTalkByConfig(ctx context.Context, config map[string]interface{}, message string) error {
	secretKey, ok := config["secretKey"].(string)
	if !ok || secretKey == "" {
		return fmt.Errorf("钉钉配置缺少 secretKey")
	}

	// 构造 Webhook URL
	webhook := fmt.Sprintf("https://oapi.dingtalk.com/robot/send?access_token=%s", secretKey)

	// 检查是否有加签密钥
	signSecret, _ := config["signSecret"].(string)

	return n.sendDingTalk(ctx, webhook, signSecret, message)
}

// sendWeComByConfig 根据配置发送企业微信通知
func (n *Notifier) sendWeComByConfig(ctx context.Context, config map[string]interface{}, message string) error {
	secretKey, ok := config["secretKey"].(string)
	if !ok || secretKey == "" {
		return fmt.Errorf("企业微信配置缺少 secretKey")
	}

	// 构造 Webhook URL
	webhook := fmt.Sprintf("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=%s", secretKey)

	return n.sendWeCom(ctx, webhook, message)
}

// sendFeishuByConfig 根据配置发送飞书通知
func (n *Notifier) sendFeishuByConfig(ctx context.Context, config map[string]interface{}, message string) error {
	secretKey, ok := config["secretKey"].(string)
	if !ok || secretKey == "" {
		return fmt.Errorf("飞书配置缺少 secretKey")
	}

	// 构造 Webhook URL
	webhook := fmt.Sprintf("https://open.feishu.cn/open-apis/bot/v2/hook/%s", secretKey)

	return n.sendFeishu(ctx, webhook, message)
}

// sendWebhookByConfig 根据配置发送自定义Webhook
func (n *Notifier) sendWebhookByConfig(ctx context.Context, config map[string]interface{}, message string) error {
	url, ok := config["url"].(string)
	if !ok || url == "" {
		return fmt.Errorf("自定义Webhook配置缺少 url")
	}

	return n.sendCustomWebhook(ctx, url, message)
}

// SendNotificationByConfig 根据新的配置结构发送通知
func (n *Notifier) SendNotificationByConfig(ctx context.Context, channelConfig *models.NotificationChannelConfig, record *models.AlertRecord, agent *models.Agent) error {
	if !channelConfig.Enabled {
		return fmt.Errorf("通知渠道已禁用")
	}

	n.logger.Info("发送通知",
		zap.String("channelType", channelConfig.Type),
	)

	// 构造通知消息内容
	message := n.buildMessage(agent, record)

	switch channelConfig.Type {
	case "dingtalk":
		return n.sendDingTalkByConfig(ctx, channelConfig.Config, message)
	case "wecom":
		return n.sendWeComByConfig(ctx, channelConfig.Config, message)
	case "feishu":
		return n.sendFeishuByConfig(ctx, channelConfig.Config, message)
	case "webhook":
		return n.sendWebhookByConfig(ctx, channelConfig.Config, message)
	case "email":
		// TODO: 实现邮件通知
		return fmt.Errorf("邮件通知暂未实现")
	default:
		return fmt.Errorf("不支持的通知渠道类型: %s", channelConfig.Type)
	}
}

// SendNotificationByConfigs 根据新的配置结构向多个渠道发送通知
func (n *Notifier) SendNotificationByConfigs(ctx context.Context, channelConfigs []models.NotificationChannelConfig, record *models.AlertRecord, agent *models.Agent) error {
	var errs []error

	for _, channelConfig := range channelConfigs {
		if err := n.SendNotificationByConfig(ctx, &channelConfig, record, agent); err != nil {
			n.logger.Error("发送通知失败",
				zap.String("channelType", channelConfig.Type),
				zap.Error(err),
			)
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("部分通知发送失败: %v", errs)
	}

	return nil
}

// SendDingTalkByConfig 导出方法供外部调用
func (n *Notifier) SendDingTalkByConfig(ctx context.Context, config map[string]interface{}, message string) error {
	return n.sendDingTalkByConfig(ctx, config, message)
}

// SendWeComByConfig 导出方法供外部调用
func (n *Notifier) SendWeComByConfig(ctx context.Context, config map[string]interface{}, message string) error {
	return n.sendWeComByConfig(ctx, config, message)
}

// SendFeishuByConfig 导出方法供外部调用
func (n *Notifier) SendFeishuByConfig(ctx context.Context, config map[string]interface{}, message string) error {
	return n.sendFeishuByConfig(ctx, config, message)
}

// SendWebhookByConfig 导出方法供外部调用
func (n *Notifier) SendWebhookByConfig(ctx context.Context, config map[string]interface{}, message string) error {
	return n.sendWebhookByConfig(ctx, config, message)
}
