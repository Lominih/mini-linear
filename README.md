# Mini Linear

一款受 Linear 启发的轻量级项目管理工具，基于 Next.js 16、tRPC、Prisma 和 SQLite 构建。

## 功能特性

- **Issue 追踪** — 看板、列表和时间线视图，支持拖拽排序
- **Sprint 规划** — 创建 Sprint、自动推荐 Backlog Issue、跟踪 Sprint 健康度和燃尽图
- **自定义字段** — 每个项目可定义文本、数字、单选、多选、日期和人员字段
- **RBAC 权限控制** — 系统角色（Owner、Admin、Member、Viewer），支持项目级角色粒度
- **身份认证** — 基于 JWT 的认证，Access/Refresh Token 对，bcrypt 密码哈希
- **全文搜索** — 跨 Issue 标题和描述的全文检索，支持相关性排序
- **过滤器** — 可组合的 AND/OR 过滤组，支持排序和 Prisma 查询构建
- **实时协作** — Socket.io 实时 Issue 更新和输入状态指示
- **燃尽图** — 基于 Recharts 的 Sprint 燃尽图和速率图
- **审计日志** — 追踪所有创建、更新、删除、指派和评论操作

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router） |
| API | tRPC v11 |
| ORM | Prisma 7（SQLite） |
| 认证 | JWT（jsonwebtoken）+ bcryptjs |
| 校验 | Zod v4 |
| UI | Tailwind CSS v4 + Radix UI |
| 图表 | Recharts |
| 实时 | Socket.io |
| 测试 | Vitest + Playwright |

## 快速开始

### 环境要求

- Node.js 20+
- npm

### 安装

```bash
git clone <repo-url>
cd mini-linear
npm install
```

### 环境配置

```bash
cp .env.example .env
```

编辑 `.env` 填写你的配置。默认值适用于本地开发。

### 数据库初始化

```bash
npx prisma db push
npx prisma generate
```

### 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 测试

### 单元测试（Vitest）

```bash
npm run test            # 运行一次
npm run test:watch      # 监听模式
npm run test:coverage   # 生成覆盖率报告
```

单元测试位于 `src/server/__tests__/`：

| 测试文件 | 测试模块 |
|----------|----------|
| `auth.test.ts` | JWT 令牌、密码哈希、邮箱/密码校验 |
| `rbac.test.ts` | 角色层级、权限检查、项目权限 |
| `state-machine.test.ts` | Issue 状态流转、工作流配置 |
| `filter-engine.test.ts` | 过滤器应用、Prisma where 子句构建、排序 |
| `search.test.ts` | 全文搜索与相关性排序 |
| `sprint-planning.test.ts` | Sprint 启动/完成校验 |
| `burndown.test.ts` | 燃尽图数据计算 |
| `custom-fields.test.ts` | 自定义字段校验、默认值、合并、序列化 |

### E2E 测试（Playwright）

```bash
npx playwright install   # 安装浏览器（仅首次）
npm run test:e2e         # 运行测试
npm run test:e2e:ui      # 交互式 UI 模式
```

E2E 测试位于 `e2e/`：

| 测试文件 | 覆盖内容 |
|----------|----------|
| `auth.spec.ts` | 登录、注册、受保护路由 |
| `project.spec.ts` | 项目列表、创建、看板导航 |
| `issue.spec.ts` | Issue 看板、创建、详情、过滤器 |
| `sprint.spec.ts` | Sprint 列表、创建、详情、操作 |

## Docker

### 构建与运行

```bash
docker compose up -d
```

应用将在 [http://localhost:3000](http://localhost:3000) 启动。

### 生产构建

```bash
docker compose build
docker compose up -d
```

### 清理

```bash
docker compose down -v
```

多阶段 Dockerfile：

1. **deps** — 安装 node_modules
2. **prisma** — 生成 Prisma Client
3. **builder** — 构建 Next.js 应用
4. **runner** — 仅包含生产产物的最小 Alpine 镜像

## 项目结构

```
mini-linear/
├── prisma/                  # Prisma Schema 与迁移
├── public/                  # 静态资源
├── src/
│   ├── app/                 # Next.js App Router 页面
│   │   ├── (app)/           # 已认证布局
│   │   ├── api/             # API 路由（tRPC、auth、register）
│   │   └── auth/            # 登录与注册页面
│   ├── components/          # React 组件（UI、布局、Provider）
│   ├── generated/           # Prisma 生成的客户端
│   ├── hooks/               # React Hooks（实时、通知、Socket）
│   ├── lib/                 # 客户端工具（tRPC Client）
│   └── server/              # 服务端逻辑
│       ├── charts/          # 燃尽图与速率计算
│       ├── routers/         # tRPC Router 定义
│       ├── views/           # 看板、列表、时间线视图构建器
│       ├── auth.ts          # JWT 与密码工具
│       ├── rbac.ts          # 基于角色的访问控制
│       ├── state-machine.ts # Issue 工作流状态机
│       ├── filter-engine.ts # 过滤器解析与 Prisma 查询构建
│       ├── search.ts        # Issue 全文搜索
│       ├── sprint-planning.ts # Sprint 校验与容量
│       ├── custom-fields.ts # 自定义字段定义与校验
│       └── __tests__/       # 单元测试
├── e2e/                     # Playwright E2E 测试
├── Dockerfile               # 多阶段生产构建
├── docker-compose.yml       # Docker Compose 配置
├── vitest.config.ts         # Vitest 配置
├── playwright.config.ts     # Playwright 配置
└── .github/workflows/ci.yml # CI 流水线
```

## API 路由

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/auth/[...nextauth]` | * | NextAuth.js 处理器 |
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/refresh` | POST | 刷新令牌 |
| `/api/trpc/[trpc]` | * | tRPC API 端点 |

## 常用命令

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint |
| `npm run test` | 运行单元测试 |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run test:coverage` | 生成测试覆盖率报告 |
| `npm run test:e2e` | 运行 Playwright E2E 测试 |
| `npm run db:push` | 推送 Schema 到数据库 |
| `npm run db:studio` | 打开 Prisma Studio |
| `npm run db:generate` | 重新生成 Prisma Client |
| `npm run docker:build` | 构建 Docker 镜像 |
| `npm run docker:up` | 启动 Docker 容器 |
| `npm run docker:down` | 停止 Docker 容器 |

## 许可证

MIT
