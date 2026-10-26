# Containerlab 中文版：网络拓扑可视化与网络仿真实验界面

**简体中文** | [English](README.en.md) | [安装与汉化维护](README.zh-CN.md)

Containerlab 中文版是 [Containerlab Apps](https://github.com/srl-labs/containerlab-app) 的社区汉化分支，为 Containerlab 网络实验提供简体中文图形界面（Web GUI）。在浏览器中编辑网络拓扑、管理容器实验、打开设备终端、使用 Wireshark 抓包，并通过延迟、丢包、抖动和带宽限制进行弱网测试。

本项目保留 Containerlab 的拓扑文件与工作方式，增加中文界面和中英文切换，适合网络工程学习、虚拟路由器组网、应用与 SDK 的网络稳定性测试。

## 这个中文版本提供什么

| 使用需求 | 对应功能 |
| --- | --- |
| 看懂和编辑网络拓扑 | 可视化节点与链路、YAML 编辑、分组、标注及布局 |
| 管理网络仿真实验 | 部署、销毁、重新部署实验，查看节点与接口状态 |
| 排查网络通信问题 | 设备终端、SSH、原始日志与 Wireshark 抓包入口 |
| 做延迟和丢包测试 | 网络故障面板中的延迟、抖动、丢包、带宽及损坏率设置 |
| 管理多个实验主机 | 添加多个 clab-api-server 连接，分别管理不同 Linux 实验环境 |
| 使用中文操作界面 | 工作区、连接管理、拓扑菜单、属性编辑、抓包和网络故障面板的简体中文文案 |

网页默认显示简体中文；在「设置 → 通用 → 界面语言」选择 English，再点击「重新加载并应用」即可切换。节点名称、接口名称、镜像、YAML 字段、命令和原始日志保留原值。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/app/workspace-dark.webp">
  <img alt="Containerlab 图形界面的实验管理器与网络拓扑可视化编辑器，上游共享界面示意" src="docs/images/app/workspace-light.webp">
</picture>

*上图是上游共享界面的功能示意；中文界面的具体范围见 [汉化说明](README.zh-CN.md#汉化范围)。*

## 如何开始使用 Containerlab 中文版

本分支的中文 Web 界面需要从源码构建。准备与根目录 `package.json` 一致的 Node.js 和 pnpm；当前声明为 Node.js `24.21.0`、pnpm `12.4.2`。

```bash
git clone https://github.com/steven2947/containerlab-app.git
cd containerlab-app
ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install --frozen-lockfile
pnpm web
WEB_TLS_ENABLE=false CLAB_API_URL=https://localhost:8090 NODE_ENV=production node apps/web/dist/server/index.cjs
```

打开 `http://127.0.0.1:3001`，填写已有 clab-api-server 的地址及其允许登录的 Linux 账户。这里的 HTTP 配置用于本机访问；远程部署和证书配置参见 [完整 Web 配置](README.en.md#configuration)。

Web 界面需要连接实际的实验主机。Containerlab、容器运行时和 clab-api-server 在 Linux 主机或 Linux 虚拟机中运行；只启动网页不会同时创建这些服务。环境准备见 [连接实验主机](README.en.md#connect-the-web-and-desktop-apps-to-your-lab-host)。

上游发布的容器镜像、桌面安装包和在线演示使用上游代码。获取本分支汉化界面请按上述步骤构建；更多构建方式见 [贡献与构建指南](CONTRIBUTING.md)。

## 适合哪些网络测试场景

- **网络拓扑与组网学习**：用节点和链路描述多设备拓扑，配合配置文件观察网络行为。
- **应用与 SDK 弱网测试**：让待测程序的流量经过实验链路，设置延迟、丢包或带宽限制，观察超时、重连与恢复情况。程序需要自行封装到节点镜像中。
- **虚拟路由器实验**：使用 Containerlab 支持的节点类型和相应镜像组织实验，例如 Linux 容器、FRRouting 或 OpenWrt；设备镜像和运行条件各不相同。
- **网络故障排查**：结合拓扑、接口状态、日志和抓包定位通信问题。

## 常见问题

### Mac 可以使用吗？

可以从 Mac 浏览器访问中文 Web 界面，Web 服务也可以在本机运行。实际的 Containerlab 实验和 API 服务放在 Linux 虚拟机或远程 Linux 主机中。设备镜像需要与实验主机的 CPU 架构及虚拟化条件相匹配。

### 可以模拟 OpenWrt 路由器吗？

Containerlab 提供 `openwrt` 节点类型，使用 vrnetlab 将 QEMU 虚拟机封装为容器。需要自行准备相应镜像并满足其运行条件，具体见 [Containerlab OpenWrt 文档](https://containerlab.dev/manual/kinds/openwrt/)。本仓库提供图形界面与中文文案，未附带 OpenWrt 固件或镜像。

### 可以测试 VPN 网络吗？

可以把运行 WireGuard 等 VPN 软件的节点加入实验拓扑，再让待测节点的流量经过隧道。VPN 端点、路由和出口需要在实验配置中准备；图形界面没有通用的「一键 VPN」功能。同一台主机上的多个虚拟节点也不代表拥有多个独立公网 IP。

### 是否包含现成的 SDK 压测平台？

本项目提供网络实验界面，待测 SDK、实例身份、测试凭据和后端观察工具需要按自己的项目集成。界面中的延迟和丢包功能可以用于 SDK 稳定性测试，测试结果仍需通过实际业务请求和日志验证。

### 所有组件都已汉化吗？

汉化集中在共享图形界面，本轮运行验收以 Web 端为准。桌面原生菜单、VS Code 扩展宿主命令、Containerlab CLI 及服务端原始错误沿用上游语言。尚未录入词库的界面文案回退英文，完整范围见 [安装与汉化说明](README.zh-CN.md)。

## 文档与反馈

- [中文版安装、语言切换与翻译维护](README.zh-CN.md)
- [英文完整说明与部署配置](README.en.md)
- [开发与源码构建](CONTRIBUTING.md)
- [反馈中文翻译或本分支的问题](https://github.com/steven2947/containerlab-app/issues)
- [Containerlab 官方文档与节点类型](https://containerlab.dev/)
- [Containerlab Apps 上游项目](https://github.com/srl-labs/containerlab-app)

## 上游与许可证

这是社区维护的 Containerlab 中文界面分支，保留上游作者署名与 [LICENSE](LICENSE)。Containerlab 核心网络编排能力及共享图形界面来自上游项目。
