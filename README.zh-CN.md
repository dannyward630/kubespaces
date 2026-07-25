<p align="center">
  <img src="assets/logo.png" alt="KubeSpaces" width="340">
</p>

<p align="center">
  <strong>面向虚拟 Kubernetes 租户的开放控制平面。</strong>
</p>

<p align="center">
  <a href="https://github.com/kubespaces-io/kubespaces/releases/latest"><img src="https://img.shields.io/github/v/release/kubespaces-io/kubespaces?sort=semver&color=3730a3&label=release" alt="Release"></a>
  <a href="https://github.com/kubespaces-io/kubespaces/actions/workflows/ci.yml"><img src="https://github.com/kubespaces-io/kubespaces/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/kubespaces-io/kubespaces/actions/workflows/e2e.yml"><img src="https://github.com/kubespaces-io/kubespaces/actions/workflows/e2e.yml/badge.svg" alt="E2E"></a>
  <a href="https://github.com/kubespaces-io/kubespaces/actions/workflows/build.yml"><img src="https://github.com/kubespaces-io/kubespaces/actions/workflows/build.yml/badge.svg" alt="Build &amp; images"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License"></a>
</p>

<p align="center">
  <strong><a href="https://docs.kubespaces.io">文档</a></strong> · <a href="ROADMAP.md">路线图</a> · <a href="https://github.com/orgs/kubespaces-io/projects/3">项目看板</a> · <a href="CONTRIBUTING.md">贡献指南</a> · <a href="SECURITY.md">安全</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong> · <a href="README.it.md">Italiano</a>
</p>

这是 KubeSpaces 单体仓库（monorepo）：后端 API、租户 Operator、Web 前端，
以及一键部署完整环境的 umbrella Helm chart。
（前身仓库 —— kubespaces-io/login-api、ams0/frontend —— 已被本代码库取代。）

| 组件 | 位置 | 说明 |
|------|------|------|
| 后端 API | `api/` | Go · chi · pgx · OIDC。认证、租户 CRUD → Tenant CR、kubeconfig |
| Operator | `operator/` | Go · controller-runtime。唯一的置备器：Tenant CR → vCluster |
| 前端 | `frontend/` | Next.js 15 · Auth.js（Keycloak）。自助服务门户 |
| CLI | `cli/` | Go · cobra。`kubespaces` —— 设备码登录、租户 CRUD、kubeconfig |
| Chart | `charts/kubespaces/` | 产品本体：一条 `helm install` 部署所有组件 |

## 仓库结构

```
.
├── api/                       # 后端 API —— Go（chi、pgx、go-oidc）
│   ├── cmd/api/               #   入口
│   └── internal/              #   auth、server（handlers）、store（Postgres + migrations）、k8s（Tenant CR）
├── operator/                  # 租户 Operator —— Go（controller-runtime，kubebuilder 布局）
│   ├── api/v1alpha1/          #   Tenant 类型（CRD 的事实来源）
│   ├── config/                #   生成的 CRD + RBAC（make manifests）
│   └── internal/              #   controller（reconciler）、provisioner（通过 Helm SDK 部署 vCluster）
├── frontend/                  # 自助服务门户 —— Next.js 15 + Auth.js（Keycloak）
│   └── src/                   #   app router、components、hooks、lib
├── cli/                       # kubespaces CLI —— Go（cobra），OIDC 设备码登录
│   ├── cmd/kubespaces/        #   入口
│   ├── internal/              #   cli、client、auth、config、kubeconfig
│   └── DESIGN.md              #   命令集与设计决策
├── charts/
│   └── kubespaces/            # Umbrella Helm chart —— 产品本体：一键安装所有组件
├── examples/                  # values 配置档：kind 演示、GKE 测试、生产
├── docs/
│   ├── contracts.md           # 组件间约定（改动任何组件前先阅读）
│   ├── host-cluster.md        # 租户暴露的主机准备（Gateway API、DNS）
│   └── prerequisites.md       # 你需要什么：演示层 vs 生产层
├── .github/workflows/         # ci（各组件）、build（镜像 → ghcr）、release（CLI）、chart mirror
├── .goreleaser.yaml           # CLI 发布：二进制、校验和、Homebrew tap
├── Makefile                   # helm lint / template / install、kind 开发循环、CRD apply
├── LICENSE                    # Apache 2.0
└── NOTICE                     # vCluster 致谢
```

版本管理：整个仓库使用同一条版本线 —— 一个 `vX.Y.Z` tag 会同时发布 CLI
二进制（goreleaser）与 `api`/`operator`/`frontend` 镜像。

## 快速开始

```bash
helm install kubespaces charts/kubespaces \
  --namespace kubespaces --create-namespace
```

默认安装完全自包含：API + 前端 + PostgreSQL（官方 `postgres` 镜像）+
Keycloak（官方镜像，dev 模式，自动导入 realm）。生产环境请切换为外部
Postgres、外部 OIDC 提供方与真实 ingress —— 参见 `examples/values-production.yaml`。

**验收测试（每次发布的门禁）：** 全新 kind 集群 →
`helm install kubespaces` → 10 分钟内得到可用租户 + kubeconfig。

## 开发循环

```bash
make lint        # helm lint
make template    # 本地渲染 manifests
make kind-up     # 本地 kind 集群
make install     # 将 chart 安装/升级到当前 context
```

## 设计说明

- **不使用 Bitnami subchart。** Broadcom 在 2025 年将 Bitnami 镜像置于订阅之后；
  新的开源项目不应依赖它们。Postgres 与 Keycloak 以官方镜像的最小内置
  StatefulSet 形式随 all-in-one 方案发布，生产环境应替换为外部服务
  （`postgresql.enabled=false`、`keycloak.enabled=false`）。
- **与 API 的环境变量约定为临时性质**，直到后端重构完成 —— 名称集中在
  `templates/api/deployment.yaml`。
- Operator 架构讨论：[operator/README.md](operator/README.md)。
- 规划与决策记录：`plan` 仓库（同级目录）。

## 许可证

Apache 2.0 —— 见 [LICENSE](LICENSE)。基于 [vCluster](https://github.com/loft-sh/vcluster)（Apache 2.0）构建 —— 见 [NOTICE](NOTICE)。
