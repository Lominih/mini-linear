# Mini Linear — 项目介绍

> **最后更新：2026-06-22 | 版本：0.1.0**

---

## 一句话简介

Mini Linear 是一款受 Linear 启发的轻量级项目管理工具，基于 Next.js 16 + tRPC + Prisma + SQLite 构建，提供 Issue 追踪、Sprint 规划、看板视图、RBAC 权限控制和实时协作等完整功能。

---

## 项目背景

### 解决什么问题

在团队协作开发中，项目管理工具是不可或缺的基础设施。然而：

- **Jira** 功能强大但配置复杂、学习曲线陡峭，小团队使用往往"杀鸡用牛刀"
- **Linear** 体验出色但为 SaaS 模式，数据存储在海外服务器，对数据敏感团队不友好
- **GitHub Issues** 缺乏 Sprint 规划、看板视图等项目管理功能

Mini Linear 旨在提供一个**自托管、零成本、开箱即用**的项目管理解决方案，让小到中型团队在自己的服务器上拥有类 Linear 的项目管理体验。

### 替代什么工具

| 场景 | 替代方案 |
|------|---------|
| 小团队项目管理 | Jira（降低复杂度） |
| 自托管需求 | Linear Cloud（数据本地化） |
| 开源替代 | Plane、Gitea Issues（更完整的项目管理功能） |
| 快速原型 | Notion Databases（结构化 Issue 追踪） |

---

## 核心功能

### 1. Issue 追踪

提供看板（Kanban）、列表（List）和时间线（Timeline）三种视图，支持拖拽排序、优先级标签、父子 Issue 关系、Issue 关联（blocks / related_to 等类型）。每个 Issue 包含标题、描述、状态、优先级、标签、截止日期、指派人等完整字段。

### 2. Sprint 规划

支持创建 Sprint 并设定起止日期、目标描述。系统自动从 Backlog 中推荐未分配的 Issue，提供 Sprint 容量检查和健康度评分。Sprint 状态遵循 PLANNED → ACTIVE → COMPLETED 的状态机流转。

### 3. 燃尽图与速率分析

基于 Recharts 构建的燃尽图（Burndown）和速率图（Velocity），实时展示 Sprint 进度与团队产出。数据来自每日 Issue 完成情况的自动计算，帮助团队了解交付节奏。

### 4. 自定义字段

支持在项目级别定义自定义字段，类型包括文本、数字、单选、多选、日期、人员。自定义字段值以 JSON 格式存储，提供验证、默认值填充、合并策略和序列化/反序列化等完整支持。

### 5. 角色权限控制（RBAC）

系统级角色（Owner / Admin / Member / Viewer）与项目级角色双重权限模型。共定义 22 种操作权限（project、issue、sprint、comment 四大类），通过权限矩阵精确控制每个角色的操作范围。系统管理员拥有全局只读权限。

### 6. 全文搜索

基于 Prisma 的全文搜索实现，支持 Issue 标题和描述的关键词匹配，内置相关性排序算法。搜索结果按匹配度加权，确保最相关的结果排在最前面。

### 7. 组合过滤器

支持 AND/OR 嵌套过滤组，可按状态、优先级、标签、指派人、截止日期等多维度组合筛选。过滤条件直接编译为 Prisma where 子句，支持多种排序规则。

### 8. 实时协作

基于 Socket.io 的实时通信层，支持 Issue 状态变更的实时广播、多人在线状态显示和打字指示器。前端通过自定义 React Hooks（`useRealtimeIssue`、`useSocket`、`useOnlineStatus`）封装实时交互逻辑。

---

## 技术架构

### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                        客户端 (Browser)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │  React   │  │  Recharts│  │ Radix UI │  │ Socket.io   │  │
│  │ 19.2.4   │  │  3.8.1   │  │          │  │  Client     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       │              │              │               │         │
│  ┌────┴──────────────┴──────────────┴───────────────┴──────┐  │
│  │              TanStack React Query + tRPC Client          │  │
│  └─────────────────────────┬───────────────────────────────┘  │
└────────────────────────────┼──────────────────────────────────┘
                             │ HTTP / WebSocket
┌────────────────────────────┼──────────────────────────────────┐
│                     服务端 (Next.js 16)                       │
│  ┌─────────────────────────┴───────────────────────────────┐  │
│  │                    API 层 (双协议)                       │  │
│  │  ┌────────────────────┐  ┌────────────────────────────┐  │
│  │  │    REST API v1     │  │     tRPC API (7 routers)   │  │
│  │  │ /api/v1/projects   │  │  issue / issueBatch /      │  │
│  │  │ /api/v1/issues     │  │  sprint / notification /   │  │
│  │  │ /api/v1/sprints    │  │  activity / integration /  │  │
│  │  │ /api/auth/*        │  │  webhook / view            │  │
│  │  └────────────────────┘  └────────────────────────────┘  │
│  └─────────────────────────┬───────────────────────────────┘  │
│                            │                                  │
│  ┌─────────────────────────┴───────────────────────────────┐  │
│  │                  业务逻辑层 (Server)                     │  │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ RBAC     │ │ Auth      │ │ State    │ │ Filter   │  │  │
│  │  │ 权限控制 │ │ JWT/BCrypt│ │ Machine  │ │ Engine   │  │  │
│  │  └──────────┘ └───────────┘ └──────────┘ └──────────┘  │  │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ Search   │ │ Sprint    │ │ Custom   │ │ Audit    │  │  │
│  │  │ 全文搜索 │ │ Planning  │ │ Fields   │ │ Log      │  │  │
│  │  └──────────┘ └───────────┘ └──────────┘ └──────────┘  │  │
│  └─────────────────────────┬───────────────────────────────┘  │
│                            │                                  │
│  ┌─────────────────────────┴───────────────────────────────┐  │
│  │              Prisma ORM 7 (SQLite Driver)               │  │
│  └─────────────────────────┬────────────────────────────────┘  │
│                            │                                  │
│  ┌─────────────────────────┴───────────────────────────────┐  │
│  │                  SQLite Database                         │  │
│  │              file:./data/mini-linear.db                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Socket.io Server (WebSocket)                │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 技术选型说明

| 层级 | 技术 | 选型原因 |
|------|------|---------|
| **框架** | Next.js 16 (App Router) | Server Components + App Router 提供最优的首屏性能和 SEO 支持，同时简化了 API Routes 和页面路由的组织 |
| **API** | tRPC v11 | 端到端类型安全，无需手写类型定义或 API 文档生成，前后端共享 `AppRouter` 类型，重构时编译器自动捕获不一致 |
| **ORM** | Prisma 7 | 声明式 Schema 定义、自动生成类型安全的 Client、内置迁移系统，对 SQLite 支持完善 |
| **数据库** | SQLite | 零配置嵌入式数据库，适合单机部署和开发环境，通过 Prisma 抽象可在生产环境中替换为 PostgreSQL |
| **认证** | JWT + bcryptjs | Access Token (7天) + Refresh Token (30天) 双令牌模式，bcrypt 12 轮加盐哈希，兼顾安全与性能 |
| **验证** | Zod v4 | 与 tRPC 深度集成的运行时验证库，同时提供 TypeScript 类型推导，实现"一次定义，类型 + 运行时双重校验" |
| **UI** | Tailwind CSS v4 + Radix UI | Tailwind 提供原子化 CSS 高效开发体验，Radix UI 提供无障碍、可组合的底层组件 |
| **实时** | Socket.io | 自动处理 WebSocket 连接、断线重连、房间管理，适合 Issue 状态变更广播和打字指示器场景 |
| **图表** | Recharts | React 声明式图表库，与 React 组件模型天然契合，适合构建燃尽图和速率分析图 |
| **测试** | Vitest + Playwright | Vitest 提供快速的单元测试，Playwright 覆盖跨浏览器 E2E 测试，两者均与 Vite 生态集成良好 |

---

## 数据模型

### 核心实体关系

```
User ──────────┬──────────────────┬──────────────────┐
               │ 1:N              │ 1:N              │ 1:N
               ▼                  ▼                  ▼
          ProjectMember        Issue               Comment
               │ N:1            │ N:1 N:1            │ 1:N
               ▼                ▼                    ▼
           Project ──1:N──▶ Sprint             Comment (自关联)
               │
               ├──1:N──▶ Issue
               ├──1:N──▶ View
               └──1:N──▶ Webhook
```

### 实体详情

#### User（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `email` | String (unique) | 登录邮箱 |
| `name` | String | 显示名称 |
| `password` | String | bcrypt 哈希密码 |
| `avatar` | String? | 头像 URL |
| `role` | SystemRole | 系统角色：OWNER / ADMIN / MEMBER / VIEWER |

#### Project（项目）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `name` | String | 项目名称 |
| `key` | String (unique) | 项目缩写（如 ML、WEB） |
| `description` | String? | 项目描述 |
| `status` | String | ACTIVE / ARCHIVED |
| `ownerId` | FK → User | 项目创建者 |

#### Issue（工单）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `title` | String | 工单标题 |
| `description` | String? | 工单描述（Markdown） |
| `status` | IssueStatus | BACKLOG / TODO / IN_PROGRESS / IN_REVIEW / DONE / CANCELLED |
| `priority` | IssuePriority | NONE / LOW / MEDIUM / HIGH / URGENT |
| `labels` | JSON | 标签数组 |
| `order` | Float | 排序权重 |
| `parentId` | FK → Issue? | 父工单（子任务） |
| `assigneeId` | FK → User? | 指派人 |
| `reporterId` | FK → User | 报告人 |
| `projectId` | FK → Project | 所属项目 |
| `sprintId` | FK → Sprint? | 所属 Sprint |
| `customFields` | JSON | 自定义字段值 |

#### Sprint（冲刺）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `name` | String | Sprint 名称 |
| `startDate` / `endDate` | DateTime | 起止日期 |
| `status` | SprintStatus | PLANNED / ACTIVE / COMPLETED |
| `goal` | String? | Sprint 目标 |
| `projectId` | FK → Project | 所属项目 |

#### 其他实体

- **Comment** — 评论，支持嵌套回复（parent / replies 自关联）
- **IssueRelation** — Issue 间关系（blocks / related_to 等，带唯一约束）
- **ProjectMember** — 项目成员（含项目级角色）
- **AuditLog** — 审计日志（action / entity / entityId / details）
- **Notification** — 用户通知（已读/未读状态、跳转链接）
- **View** — 保存的视图（含过滤条件和排序规则，支持共享）

---

## API 概览

### tRPC 路由（7 个路由器）

| 路由器 | 路径 | 主要功能 |
|--------|------|---------|
| `issue` | `trpc.issue.*` | Issue CRUD、状态变更、排序、评论、过滤查询 |
| `issueBatch` | `trpc.issueBatch.*` | 批量操作：批量更新状态、批量分配、批量删除 |
| `sprint` | `trpc.sprint.*` | Sprint 创建/启动/完成、容量计算、Backlog 推荐 |
| `notification` | `trpc.notification.*` | 通知列表、已读标记、未读计数 |
| `activity` | `trpc.activity.*` | 审计日志查询、活动时间线 |
| `integration` | `trpc.integration.*` | 第三方集成管理（GitHub、GitLab） |
| `webhook` | `trpc.webhook.*` | Webhook 配置、触发、日志查询 |

### REST 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册（验证邮箱唯一性、密码强度） |
| `/api/auth/refresh` | POST | Access Token 刷新 |
| `/api/auth/[...nextauth]` | * | NextAuth.js 会话管理 |
| `/api/v1/projects` | GET/POST | 项目列表 / 创建项目 |
| `/api/v1/issues` | GET/POST | Issue 列表（含过滤） / 创建 Issue |
| `/api/v1/sprints` | GET/POST | Sprint 列表 / 创建 Sprint |
| `/api/export/[projectId]` | GET | 项目数据导出 |

### 认证方式

- **Header**: `Authorization: Bearer <access_token>`
- **Cookie**: `access-token=<access_token>`
- Access Token 默认有效期 7 天，Refresh Token 默认有效期 30 天

---

## 安全特性

### Rate Limiting（速率限制）

基于内存的滑动窗口限流器，支持三级限流策略：

| 策略 | 窗口 | 最大请求数 | 适用场景 |
|------|------|-----------|---------|
| `globalLimiter` | 60s | 100 | 全局默认 |
| `apiLimiter` | 60s | 30 | API 端点 |
| `authLimiter` | 60s | 10 | 认证端点（登录/注册） |

特性：
- 自动清理过期条目（每 60 秒），防止内存泄漏
- 最大存储 10,000 条记录，超出时自动驱逐最旧条目
- 支持 `X-Forwarded-For` 头解析真实 IP
- 超限返回 `429 Too Many Requests` + `Retry-After` 头

### RBAC（角色权限控制）

双层权限模型：

**系统级角色**（`SystemRole`）：

| 角色 | 全局权限 |
|------|---------|
| OWNER | 完全控制所有项目 |
| ADMIN | 管理所有项目、成员、全局设置 |
| MEMBER | 创建项目、读写自身参与的项目 |
| VIEWER | 全局只读 |

**项目级角色**（`ProjectMemberRole`）：

| 角色 | 权限范围 |
|------|---------|
| OWNER | 完全控制项目及其 Issue、Sprint、成员 |
| ADMIN | 管理项目配置、Issue、Sprint、成员管理 |
| MEMBER | 创建/编辑 Issue、参与讨论 |
| VIEWER | 项目只读 |

共定义 **22 种细粒度操作**，覆盖 project、issue、sprint、comment 四个领域。

### JWT 认证

- **双令牌模式**：Access Token (HS256, 7天) + Refresh Token (HS256, 30天)
- **密码安全**：bcrypt 12 轮加盐哈希
- **密码强度验证**：最少 8 字符、包含大小写字母和数字
- **邮箱格式验证**：正则表达式校验

### 输入验证

- **Zod v4** Schema 验证：所有 API 输入均通过 Zod schema 运行时校验
- **Prisma 类型安全**：ORM 层自动防止 SQL 注入
- **Next.js Middleware**：请求预处理和路由保护

---

## 部署指南

### Docker 快速启动

```bash
# 1. 克隆项目
git clone <repo-url>
cd mini-linear

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET、JWT_REFRESH_SECRET 等

# 3. 启动服务
docker compose up -d

# 4. 访问应用
open http://localhost:3000
```

### Docker Compose 配置说明

```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=file:./data/prod.db
      - JWT_SECRET=${JWT_SECRET:-change-me-in-production}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-change-me-refresh-in-production}
      - NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-change-me-nextauth-secret}
    volumes:
      - app-data:/app/data        # SQLite 数据持久化
    restart: unless-stopped
    healthcheck:
      interval: 30s
      timeout: 10s
      retries: 3
```

### 多阶段 Docker 构建

| 阶段 | 用途 | 说明 |
|------|------|------|
| `deps` | 安装依赖 | 只安装 node_modules |
| `prisma` | 生成 Client | 运行 `prisma generate` |
| `builder` | 构建应用 | 执行 `next build` |
| `runner` | 运行时 | 最小化 Alpine 镜像，仅包含生产产物 |

### 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | 是 | `file:./data/prod.db` | SQLite 数据库路径 |
| `JWT_SECRET` | 是 | — | Access Token 签名密钥 |
| `JWT_REFRESH_SECRET` | 是 | — | Refresh Token 签名密钥 |
| `JWT_EXPIRES_IN` | 否 | `7d` | Access Token 有效期 |
| `JWT_REFRESH_EXPIRES_IN` | 否 | `30d` | Refresh Token 有效期 |
| `NEXTAUTH_URL` | 否 | `http://localhost:3000` | NextAuth 回调地址 |
| `NEXTAUTH_SECRET` | 否 | — | NextAuth 加密密钥 |

### 管理命令

```bash
docker compose up -d      # 启动
docker compose down -v    # 停止并清除数据
docker compose logs -f    # 查看日志
docker compose build      # 重新构建
```

---

## 开发指南

### 环境要求

- Node.js 20+
- npm
- Git

### 本地开发环境搭建

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env

# 3. 初始化数据库
npx prisma db push      # 推送 Schema 到 SQLite
npx prisma generate     # 生成 Prisma Client

# 4. 启动开发服务器
npm run dev
```

应用启动后访问 [http://localhost:3000](http://localhost:3000)。

### 常用开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `npm run test` | 运行 Vitest 单元测试 |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run test:coverage` | 测试覆盖率报告 |
| `npm run test:e2e` | Playwright E2E 测试 |
| `npm run test:e2e:ui` | Playwright 交互式 UI 模式 |
| `npm run db:studio` | 打开 Prisma Studio（数据库 GUI） |
| `npm run db:push` | 推送 Schema 变更到数据库 |
| `npm run db:generate` | 重新生成 Prisma Client |

### 测试覆盖

#### 单元测试（`src/server/__tests__/`）

| 测试文件 | 测试模块 |
|---------|---------|
| `auth.test.ts` | JWT 令牌生成/验证、密码哈希、邮箱/密码校验 |
| `rbac.test.ts` | 角色层级、权限检查、项目权限矩阵 |
| `state-machine.test.ts` | Issue 状态流转、工作流配置 |
| `filter-engine.test.ts` | 过滤器应用、Prisma where 子句构建、排序 |
| `search.test.ts` | 全文搜索与相关性排序 |
| `sprint-planning.test.ts` | Sprint 启动/完成校验 |
| `burndown.test.ts` | 燃尽图数据计算 |
| `custom-fields.test.ts` | 自定义字段验证、默认值、合并、序列化 |

#### E2E 测试（`e2e/`）

| 测试文件 | 覆盖范围 |
|---------|---------|
| `auth.spec.ts` | 登录、注册、受保护路由 |
| `project.spec.ts` | 项目列表、创建、看板导航 |
| `issue.spec.ts` | 看板、Issue 创建、详情、过滤器 |
| `sprint.spec.ts` | Sprint 列表、创建、详情、操作 |

---

## 项目结构

```
mini-linear/
├── prisma/                          # Prisma Schema 和数据库配置
│   └── schema.prisma                # 数据模型定义（12 个模型）
├── public/                          # 静态资源
├── src/
│   ├── app/                         # Next.js App Router 页面
│   │   ├── (app)/                   # 需认证的应用页面
│   │   │   ├── layout.tsx           # 应用布局（侧边栏 + 顶栏）
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx         # 仪表盘首页
│   │   │   ├── my-issues/
│   │   │   │   └── page.tsx         # 个人 Issue 列表
│   │   │   └── projects/
│   │   │       ├── page.tsx         # 项目列表
│   │   │       └── [id]/
│   │   │           ├── page.tsx     # 项目概览
│   │   │           ├── board/
│   │   │           │   └── page.tsx # 看板视图
│   │   │           ├── list/
│   │   │           │   └── page.tsx # 列表视图
│   │   │           └── sprints/
│   │   │               ├── page.tsx         # Sprint 列表
│   │   │               └── [sprintId]/
│   │   │                   └── page.tsx     # Sprint 详情
│   │   ├── api/                     # API 路由
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/
│   │   │   │   │   └── route.ts    # NextAuth.js 处理器
│   │   │   │   ├── register/
│   │   │   │   │   └── route.ts    # 用户注册
│   │   │   │   └── refresh/
│   │   │   │       └── route.ts    # Token 刷新
│   │   │   ├── export/
│   │   │   │   └── [projectId]/
│   │   │   │       └── route.ts    # 数据导出
│   │   │   ├── trpc/
│   │   │   │   ├── [trpc]/
│   │   │   │   │   └── route.ts    # tRPC 动态路由
│   │   │   │   └── route.ts        # tRPC 批量路由
│   │   │   └── v1/                 # REST API v1
│   │   │       ├── issues/
│   │   │       │   └── route.ts
│   │   │       ├── projects/
│   │   │       │   └── route.ts
│   │   │       └── sprints/
│   │   │           └── route.ts
│   │   ├── auth/                    # 认证页面
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── api-docs/
│   │   │   └── page.tsx            # API 文档页面
│   │   ├── layout.tsx              # 根布局
│   │   ├── page.tsx                # 首页
│   │   └── globals.css             # 全局样式
│   ├── components/                  # React 组件
│   │   ├── layout/                  # 布局组件
│   │   │   ├── AppLayout.tsx
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── providers/
│   │   │   └── trpc-provider.tsx   # tRPC + React Query Provider
│   │   ├── ui/                      # UI 基础组件
│   │   │   ├── Avatar.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── IssueRow.tsx
│   │   │   ├── KanbanCard.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── SprintCard.tsx
│   │   │   ├── Textarea.tsx
│   │   │   └── Toast.tsx
│   │   └── TypingIndicator.tsx     # 打字指示器
│   ├── generated/                   # Prisma 生成代码（勿手动编辑）
│   │   └── prisma/
│   │       ├── client.ts
│   │       ├── models/
│   │       └── ...
│   ├── hooks/                       # React Hooks
│   │   ├── useNotifications.ts      # 通知 Hook
│   │   ├── useOnlineStatus.ts       # 在线状态 Hook
│   │   ├── useRealtimeIssue.ts      # 实时 Issue 更新 Hook
│   │   └── useSocket.ts            # Socket.io 连接 Hook
│   ├── lib/                         # 客户端工具
│   │   ├── cache.ts                 # 缓存工具
│   │   ├── rate-limit.ts            # 速率限制中间件
│   │   └── trpc.ts                  # tRPC 客户端配置
│   ├── middleware.ts                 # Next.js 中间件（路由保护）
│   └── server/                      # 服务端逻辑
│       ├── __tests__/               # 单元测试（8 个测试文件）
│       ├── charts/                  # 图表数据计算
│       │   ├── burndown.ts          # 燃尽图算法
│       │   └── velocity.ts          # 速率图算法
│       ├── routers/                 # tRPC 路由定义
│       │   ├── _app.ts             # 根路由器（7 个子路由）
│       │   ├── issue.ts
│       │   ├── issue-batch.ts
│       │   ├── sprint.ts
│       │   ├── notification.ts
│       │   ├── activity.ts
│       │   ├── integration.ts
│       │   ├── view.ts
│       │   └── webhook.ts
│       ├── views/                   # 视图构建器
│       │   ├── kanban.ts
│       │   ├── list.ts
│       │   └── timeline.ts
│       ├── integrations/            # 第三方集成
│       │   ├── github.ts
│       │   └── gitlab.ts
│       ├── auth.ts                  # JWT + 密码工具
│       ├── auth-middleware.ts        # 认证中间件
│       ├── audit.ts                 # 审计日志
│       ├── context.ts               # tRPC Context
│       ├── custom-fields.ts         # 自定义字段引擎
│       ├── default-views.ts         # 默认视图配置
│       ├── export.ts                # 数据导出
│       ├── filter-engine.ts         # 过滤器 → Prisma 查询编译器
│       ├── prisma.ts                # Prisma Client 单例
│       ├── rbac.ts                  # 角色权限控制
│       ├── retrospective.ts         # 回顾/复盘
│       ├── search.ts                # 全文搜索引擎
│       ├── socket-server.ts         # Socket.io 服务端
│       ├── socket-types.ts          # Socket 类型定义
│       ├── sprint-planning.ts       # Sprint 规划逻辑
│       ├── sprint-reports.ts        # Sprint 报告
│       ├── state-machine.ts         # Issue 状态机
│       ├── trpc.ts                  # tRPC 初始化 + 中间件
│       └── webhooks.ts              # Webhook 触发引擎
├── e2e/                             # Playwright E2E 测试
│   ├── auth.spec.ts
│   ├── project.spec.ts
│   ├── issue.spec.ts
│   └── sprint.spec.ts
├── Dockerfile                       # 多阶段 Docker 构建
├── docker-compose.yml               # Docker Compose 配置
├── vitest.config.ts                 # Vitest 配置
├── playwright.config.ts             # Playwright 配置
├── package.json                     # 项目依赖和脚本
├── README.md                        # 项目说明
├── API.md                           # API 文档
├── INTRODUCTION.md                  # 项目介绍（本文档）
└── .github/workflows/ci.yml        # CI/CD 流水线
```

---

## 附录

### 技术栈速查

| 类别 | 技术 | 版本 |
|------|------|------|
| 运行时 | Node.js | 20+ |
| 框架 | Next.js | 16.2.9 |
| 语言 | TypeScript | 5.x |
| API 层 | tRPC | 11.18.0 |
| ORM | Prisma | 5.22.0 |
| 数据库 | SQLite | — |
| 认证 | JWT + bcryptjs | 9.0.3 / 3.0.3 |
| 验证 | Zod | 4.4.3 |
| UI 框架 | React | 19.2.4 |
| 样式 | Tailwind CSS | 4.x |
| 组件库 | Radix UI | — |
| 图表 | Recharts | 3.8.1 |
| 实时 | Socket.io | 4.8.3 |
| 单元测试 | Vitest | 4.1.9 |
| E2E 测试 | Playwright | 1.61.0 |
| 构建 | Docker | 多阶段构建 |

### 许可证

MIT License
