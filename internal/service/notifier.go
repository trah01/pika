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
	"net/url"
	"strings"
	"time"

	"github.com/dushixiang/pika/internal/models"
	"github.com/valyala/fasttemplate"
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
func (n *Notifier) sendCustomWebhook(ctx context.Context, config map[string]interface{}, agent *models.Agent, record *models.AlertRecord) error {
	// 解析配置
	webhookURL, ok := config["url"].(string)
	if !ok || webhookURL == "" {
		return fmt.Errorf("自定义Webhook配置缺少 url")
	}

	// 获取请求方法，默认 POST
	method := "POST"
	if m, ok := config["method"].(string); ok && m != "" {
		method = strings.ToUpper(m)
	}

	// 获取自定义请求头
	headers := make(map[string]string)
	if h, ok := config["headers"].(map[string]interface{}); ok {
		for k, v := range h {
			if strVal, ok := v.(string); ok {
				headers[k] = strVal
			}
		}
	}

	// 获取请求体模板类型，默认 json
	bodyTemplate := "json"
	if bt, ok := config["bodyTemplate"].(string); ok && bt != "" {
		bodyTemplate = bt
	}

	// 构建消息内容
	message := n.buildMessage(agent, record)

	// 根据模板类型构建请求体
	var reqBody io.Reader
	var contentType string

	switch bodyTemplate {
	case "json":
		// JSON 格式
		body := map[string]interface{}{
			"msg_type": "text",
			"text": map[string]string{
				"content": message,
			},
			"agent": map[string]interface{}{
				"id":       agent.ID,
				"name":     agent.Name,
				"hostname": agent.Hostname,
				"ip":       agent.IP,
			},
			"alert": map[string]interface{}{
				"type":        record.AlertType,
				"level":       record.Level,
				"status":      record.Status,
				"message":     record.Message,
				"threshold":   record.Threshold,
				"actualValue": record.ActualValue,
				"firedAt":     record.FiredAt,
				"resolvedAt":  record.ResolvedAt,
			},
		}
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("序列化 JSON 失败: %w", err)
		}
		reqBody = bytes.NewReader(data)
		contentType = "application/json"

	case "form":
		// Form 表单格式
		formData := url.Values{}
		formData.Set("message", message)
		formData.Set("agent_id", agent.ID)
		formData.Set("agent_name", agent.Name)
		formData.Set("agent_hostname", agent.Hostname)
		formData.Set("agent_ip", agent.IP)
		formData.Set("alert_type", record.AlertType)
		formData.Set("alert_level", record.Level)
		formData.Set("alert_status", record.Status)
		formData.Set("alert_message", record.Message)
		formData.Set("threshold", fmt.Sprintf("%.2f", record.Threshold))
		formData.Set("actual_value", fmt.Sprintf("%.2f", record.ActualValue))
		formData.Set("fired_at", fmt.Sprintf("%d", record.FiredAt))
		if record.ResolvedAt > 0 {
			formData.Set("resolved_at", fmt.Sprintf("%d", record.ResolvedAt))
		}
		reqBody = strings.NewReader(formData.Encode())
		contentType = "application/x-www-form-urlencoded"

	case "custom":
		// 自定义模板，支持变量替换
		customBody, ok := config["customBody"].(string)
		if !ok || customBody == "" {
			return fmt.Errorf("使用 custom 模板时必须提供 customBody")
		}

		// 使用 fasttemplate 进行变量替换
		t := fasttemplate.New(customBody, "{{", "}}")
		bodyStr := t.ExecuteFuncString(func(w io.Writer, tag string) (int, error) {
			switch tag {
			case "message":
				return w.Write([]byte(message))
			case "agent.id":
				return w.Write([]byte(agent.ID))
			case "agent.name":
				return w.Write([]byte(agent.Name))
			case "agent.hostname":
				return w.Write([]byte(agent.Hostname))
			case "agent.ip":
				return w.Write([]byte(agent.IP))
			case "alert.type":
				return w.Write([]byte(record.AlertType))
			case "alert.level":
				return w.Write([]byte(record.Level))
			case "alert.status":
				return w.Write([]byte(record.Status))
			case "alert.message":
				return w.Write([]byte(record.Message))
			case "alert.threshold":
				return w.Write([]byte(fmt.Sprintf("%.2f", record.Threshold)))
			case "alert.actualValue":
				return w.Write([]byte(fmt.Sprintf("%.2f", record.ActualValue)))
			case "alert.firedAt":
				return w.Write([]byte(fmt.Sprintf("%d", record.FiredAt)))
			case "alert.resolvedAt":
				return w.Write([]byte(fmt.Sprintf("%d", record.ResolvedAt)))
			default:
				// 未知变量保持原样
				return w.Write([]byte("{{" + tag + "}}"))
			}
		})
		reqBody = strings.NewReader(bodyStr)
		contentType = "text/plain"

	default:
		return fmt.Errorf("不支持的 bodyTemplate: %s", bodyTemplate)
	}

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, method, webhookURL, reqBody)
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置 Content-Type
	req.Header.Set("Content-Type", contentType)

	// 设置自定义请求头
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	// 发送请求
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("发送请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("请求失败，状态码: %d, 响应: %s", resp.StatusCode, string(respBody))
	}

	n.logger.Info("自定义Webhook发送成功",
		zap.String("url", webhookURL),
		zap.String("method", method),
		zap.String("response", string(respBody)),
	)

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
func (n *Notifier) sendWebhookByConfig(ctx context.Context, config map[string]interface{}, agent *models.Agent, record *models.AlertRecord) error {
	return n.sendCustomWebhook(ctx, config, agent, record)
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
		return n.sendWebhookByConfig(ctx, channelConfig.Config, agent, record)
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

// SendWebhookByConfig 导出方法供外部调用（测试用）
func (n *Notifier) SendWebhookByConfig(ctx context.Context, config map[string]interface{}, message string) error {
	// 为了测试，创建一个临时的 agent 和 record
	agent := &models.Agent{
		ID:       "test-agent",
		Name:     "测试探针",
		Hostname: "test-host",
		IP:       "127.0.0.1",
	}
	record := &models.AlertRecord{
		AlertType:   "test",
		Level:       "info",
		Status:      "firing",
		Message:     message,
		Threshold:   0,
		ActualValue: 0,
		FiredAt:     time.Now().UnixMilli(),
	}
	return n.sendWebhookByConfig(ctx, config, agent, record)
}
