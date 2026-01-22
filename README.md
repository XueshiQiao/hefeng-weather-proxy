# QWeather Proxy

一个轻量级的和风天气 API 代理服务，自动解压缩返回的 Gzip 数据，让客户端（如 ESP32）无需处理压缩。

## 功能特性

- **自动解压缩**: 自动处理和风天气返回的 Gzip 压缩数据，返回纯 JSON
- **身份验证**: 支持 Token 验证，防止未授权访问
- **错误防护**: 超时控制、体积限制、异常捕获，保证服务稳定
- **零配置转发**: 原样转发所有请求参数、Headers、Body
- **环境变量配置**: 通过 `.env` 文件或环境变量配置

## 快速开始

### 安装依赖

```bash
npm install
npm run build
```

### 配置

创建 `.env` 文件：

```env
# 和风天气 API Host（可选，未提供 X-Proxy-Host header 时使用）
HEFENG_HOST=xxx.qweatherapi.com

# 和风天气 API Key（可选，会自动添加到请求 header）
HEFENG_API_KEY=your-api-key

# 代理访问令牌（必填）
PROXY_TOKEN=your-secret-token

# 服务端口
PORT=3000

# 请求超时时间（毫秒）
TIMEOUT=15000

# 响应体最大大小（字节）
MAX_BODY_SIZE=1048576
```

### 启动

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

## 使用方法

### 请求格式

向代理服务器发送请求，需要在 Header 中指定：

| Header | 说明 | 必填 | 是否转发到和风天气 |
|--------|------|------|-------------------|
| `X-Proxy-Host` | 和风天气 API Host | 否* | 否 |
| `X-Proxy-Token` | 代理验证 Token | 是 | 否 |
| `X-QW-Api-Key` | 和风天气 API Key | 否** | 是 |
| 其他 Headers | 原样转发 | 否 | 是 |

> **注意**: `X-Proxy-Host` 和 `X-Proxy-Token` 仅用于代理内部处理，不会转发到和风天气 API。  
> * 如未提供，代理会使用 `.env` 中配置的 `HEFENG_HOST`。  
> ** 如未提供，代理会使用 `.env` 中配置的 `HEFENG_API_KEY`，如果都未提供则不添加。

### 最小请求

必须提供 `X-Proxy-Token`：

```bash
curl http://localhost:3000/v7/weather/now?location=101010100 \
  -H "X-Proxy-Token: your-secret-token"
```

### 完整请求

```bash
curl http://localhost:3000/v7/weather/now?location=101010100 \
  -H "X-Proxy-Host: xxx.qweatherapi.com" \
  -H "X-Proxy-Token: your-secret-token" \
  -H "X-QW-Api-Key: your-api-key"
```

### ESP32 示例

必须提供 `X-Proxy-Token`：

```cpp
#include <HTTPClient.h>

void getWeather() {
  HTTPClient http;
  
  http.begin("http://192.168.1.100:3000/v7/weather/now?location=101010100");
  http.addHeader("X-Proxy-Token", "your-secret-token");
  
  int code = http.GET();
  String response = http.getString();  // 直接是可解析的 JSON
  
  Serial.println(response);
  http.end();
}
```

如果同时配置了 `HEFENG_HOST` 和 `HEFENG_API_KEY`，ESP32 端只需提供 `X-Proxy-Token`：

```cpp
http.begin("http://192.168.1.100:3000/v7/weather/now?location=101010100");
http.addHeader("X-Proxy-Token", "your-secret-token");
// 无需 X-Proxy-Host 和 X-QW-Api-Key
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HEFENG_HOST` | 无 | 和风天气 API Host，未提供 `X-Proxy-Host` header 时使用 |
| `HEFENG_API_KEY` | 无 | 和风天气 API Key，会自动添加到请求 header |
| `PROXY_TOKEN` | 无 | 代理访问令牌，用于验证 `X-Proxy-Token` header |
| `PORT` | `3000` | 服务监听端口 |
| `TIMEOUT` | `10000` | 请求超时时间（毫秒） |
| `MAX_BODY_SIZE` | `1048576` | 响应体最大大小（字节） |

> **注意**: `PROXY_TOKEN` 和 `HEFENG_HOST` 必须至少通过一种方式提供。

## 工作原理

```
┌─────────────┐     ┌─────────────────┐     ┌────────────────────┐
│   ESP32     │────▶│  QWeather Proxy │────▶│  QWeather API      │
│  (Client)   │     │                 │     │  (Gzip Compressed) │
└─────────────┘     └─────────────────┘     └────────────────────┘
                           │
                           ▼
                     ┌─────────────────┐
                     │  Auto Decompress│
                     │  Return Plain   │
                     │  JSON           │
                     └─────────────────┘
```

1. 客户端向代理发送请求，包含目标 `X-Proxy-Host`
2. 代理转发请求到和风天气 API
3. 和风天气返回 Gzip 压缩数据
4. 代理自动解压缩
5. 代理返回纯 JSON 给客户端

## 为什么需要这个代理？

和风天气 API 默认返回 Gzip 压缩数据，这在以下场景会造成困扰：

- **ESP32**: 资源有限，解压缩库占用空间
- **嵌入式设备**: 可能没有解压缩能力
- **简化开发**: 客户端无需处理压缩逻辑

通过代理，客户端可以直接获取解压缩后的纯 JSON 数据。

## 开源协议

MIT License
