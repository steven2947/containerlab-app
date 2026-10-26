# Containerlab 中文版安装与汉化说明

[项目介绍](README.md) | **安装与汉化维护** | [English](README.en.md)

基于 [srl-labs/containerlab-app](https://github.com/srl-labs/containerlab-app) 的社区汉化分支。网页默认使用简体中文，可在「设置 → 通用 → 界面语言」选择 English，再点击「重新加载并应用」。语言偏好保存在当前浏览器中。

## 汉化范围

- 工作区、实验和文件资源管理器、连接管理、设置、主题及常用操作提示。
- 拓扑工具栏、节点与链路菜单、属性编辑器、实验设置、抓包与网络故障设置。
- 共享 UI 供 Web、桌面端和 VS Code Webview 使用；本轮实际运行验收以 Web 端为准。桌面原生菜单、VS Code 扩展宿主的命令名称及 Containerlab CLI 仍沿用上游语言。

节点名、接口名、镜像名、YAML 字段、命令、原始日志和服务端返回的数据保留原值。服务端产生的原始错误也可能显示英文。新增加的上游文案尚未录入词库时会显示英文。

## 本地构建并启动 Web

准备与根目录 `package.json` 一致的 Node.js 版本和 pnpm 版本。当前声明为 Node.js 24.21.0、pnpm 12.4.2。以下操作均在本仓库根目录执行：

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install --frozen-lockfile
pnpm web
WEB_TLS_ENABLE=false CLAB_API_URL=https://localhost:8090 NODE_ENV=production node apps/web/dist/server/index.cjs
```

打开 `http://127.0.0.1:3001`，在连接管理中填写已有 clab-api-server 的地址和 Linux 账户。上述 HTTP 启动方式用于本机访问；远程部署保留上游默认 HTTPS 配置，详见 [完整部署配置](README.en.md#configuration)。

Mac 上的网页负责显示界面，Containerlab、Docker 和 API 服务运行在 Linux 虚拟机或远程 Linux 主机中。Web 服务连接 API，所以连接地址中的 `localhost` 指 Web 服务所在的主机。汉化无需变更实验中的 SDK、Fleet Token 或业务后端。

`pnpm web` 会生成便于复制的 `apps/web/dist`，包含浏览器资源及打包后的服务端。上游发布的 `ghcr.io/srl-labs/containerlab-web` 镜像继续使用上游代码；使用本分支时须运行本分支构建的产物。

## 检查修改

```bash
pnpm typecheck
pnpm test
pnpm lint
```

这些命令都会构建共享 UI，请按顺序执行，避免同时清理、写入同一个 `dist` 目录。保留的上游浏览器回归用例显式选择英文，便于继续验证原有行为；新增中文用例可通过浏览器的 `clab-ui-language` 本地偏好选择 `zh-CN`。

## 补充翻译

翻译实现位于 `packages/clab-ui/src/i18n/`：

- `index.ts`：语言偏好、精确文案查找和变量插值。
- `zh-CN.ts`：英文原文到简体中文的词库。
- `index.test.ts`：占位符完整性、插值数据、英文回退、空白及偏好存储检查。

新增文案在界面展示位置调用 `uiText("English copy")`，并在词库补充对应中文。动态名称使用占位符，例如 `uiText("Actions for {0}", { 0: nodeName })`。仅翻译界面文案，保持配置、标识符和网络请求参数原值。切换语言会刷新网页以更新初始化时创建的菜单，不触发实验部署或容器重启。

## 上游与许可证

保留上游的 [LICENSE](LICENSE) 文件和作者署名。本分支的翻译与界面语言选择属于社区修改，未作为 Containerlab 官方中文版本发布。
