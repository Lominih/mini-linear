# 环境变量文档

## 必填变量

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `DATABASE_URL` | SQLite 数据库连接字符串 | `file:./prisma/dev.db` | ✅ |
| `JWT_SECRET` | JWT Access Token 签名密钥 | 开发默认值（生产必须设置） | ✅ |
| `JWT_REFRESH_SECRET` | JWT Refresh Token 签名密钥 | 开发默认值（生产必须设置） | ✅ |

## 可选变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `JWT_EXPIRES_IN` | Access Token 过期时间 | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 过期时间 | `30d` |
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | 服务端口 | `3000` |

## .env.example

```
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"
NODE_ENV="development"
PORT=3000
```

## 生产环境注意事项

- **必须**更改 `JWT_SECRET` 和 `JWT_REFRESH_SECRET` 为强随机字符串
- **必须**设置 `NODE_ENV=production`
- 使用 `openssl rand -hex 32` 生成安全密钥
- 不要在代码中硬编码密钥