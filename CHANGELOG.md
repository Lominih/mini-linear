# 更新日志

本文件记录 Mini Linear 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循 [语义化版本](https://semver.org/)。

---

## [2.0.0] - 2026-06-22

### 深度迭代完成

经过四轮深度迭代，项目从 MVP 提升至生产级质量。

### Round 1 — 前端体验增强

- **错误边界**：全局错误边界 `error.tsx` + `global-error.tsx`，页面级优雅降级
- **加载状态**：骨架屏、`loading.tsx` 全局加载指示器、组件级 loading 状态
- **分页**：Issue 列表、评论列表支持服务端分页
- **键盘快捷键**：全局快捷键支持（`useKeyboardShortcuts` hook）
- **乐观更新**：Issue 状态变更、评论提交等操作支持乐观更新（`useOptimisticMutation` hook）

### Round 2 — 安全加固

- **CSRF 防护**：`csrf` 中间件，Token 验证
- **XSS 净化**：输入内容净化处理（`sanitize` 模块）
- **审计日志**：关键操作完整审计追踪（`AuditLog` 模型 + `audit` 服务）
- **账户锁定**：登录失败次数超限自动锁定（`account-lockout` 模块）
- **CSP 头**：Content-Security-Policy 响应头配置
- **登录限流**：基于 IP 的登录请求限流（`rate-limit` 模块）

### Round 3 — 性能优化

- **18 个数据库索引**：针对高频查询字段建立索引，覆盖 Issue、Comment、AuditLog、Notification 等模型
- **内存缓存**：应用级内存缓存层（`cache` 模块），减少重复数据库查询
- **gzip 压缩**：响应内容压缩（`compression` 模块）
- **慢查询日志**：数据库慢查询检测与日志记录（`slow-query-logger` 模块）

### Round 4 — 测试完善

- **34 个新测试**：覆盖 CSRF、缓存、压缩、审计、认证、权限、状态机等模块
- **总计 208 个测试**：单元测试 + 端到端测试
- 测试覆盖率显著提升，核心业务逻辑达到生产标准

---

## [1.0.0] - 2026-06-22

### 初始版本发布

Mini Linear 首个正式版本，功能完整的轻量级项目管理工具。

### 核心功能

- **项目管理**：创建、编辑、归档项目，支持项目 Key 标识
- **Issue 管理**：创建、编辑、删除 Issue，支持状态流转、优先级、标签、指派人
- **看板视图**：拖拽式看板，按状态分组展示 Issue
- **列表视图**：表格形式展示 Issue，支持排序和筛选
- **Sprint 管理**：创建 Sprint，规划迭代周期，管理 Sprint 待办
- **仪表盘**：项目概览、Issue 统计、Sprint 进度可视化
- **自定义视图**：保存筛选条件，支持团队共享视图
- **自定义字段**：灵活的 Issue 扩展字段
- **通知系统**：实时通知 + 未读管理
- **活动日志**：项目活动时间线
- **导出功能**：项目数据导出
- **API 文档**：内置 API 文档页面

### 技术架构

- **前端**：Next.js 16 (App Router) + React 19 + TypeScript
- **后端**：tRPC (类型安全 API)
- **数据库**：SQLite + Prisma ORM
- **认证**：JWT (Access Token + Refresh Token)
- **实时协作**：WebSocket (Socket.IO)
- **样式**：Tailwind CSS 4

### API

- **tRPC API**：类型安全的内部 API
- **REST API**：`/api/v1/` 兼容外部集成
- **认证 API**：注册、登录、Token 刷新

### 部署

- Docker 多阶段构建
- docker-compose 一键部署
- 生产环境 standalone 模式
