const { PrismaClient } = require('@prisma/client');
const path = require('path');

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:' + path.join(__dirname, 'prisma', 'dev.db'),
      },
    },
  });
  
  // Create tables using raw SQL
  await prisma.CREATE TABLE IF NOT EXISTS User (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    role TEXT DEFAULT 'MEMBER',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  await prisma.CREATE TABLE IF NOT EXISTS Project (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    key TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    ownerId TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ownerId) REFERENCES User(id)
  );
  
  await prisma.CREATE TABLE IF NOT EXISTS ProjectMember (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    userId TEXT NOT NULL,
    role TEXT DEFAULT 'MEMBER',
    FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
    UNIQUE(projectId, userId)
  );
  
  await prisma.CREATE TABLE IF NOT EXISTS Issue (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'BACKLOG',
    priority TEXT DEFAULT 'NONE',
    labels TEXT DEFAULT '[]',
    assigneeId TEXT,
    reporterId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    sprintId TEXT,
    dueDate DATETIME,
    parentId TEXT,
    "order" REAL DEFAULT 0,
    customFields TEXT DEFAULT '{}',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigneeId) REFERENCES User(id),
    FOREIGN KEY (reporterId) REFERENCES User(id),
    FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
  );
  
  await prisma.CREATE TABLE IF NOT EXISTS Sprint (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    startDate DATETIME NOT NULL,
    endDate DATETIME NOT NULL,
    goal TEXT,
    status TEXT DEFAULT 'PLANNED',
    projectId TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
  );
  
  await prisma.CREATE TABLE IF NOT EXISTS Comment (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    authorId TEXT NOT NULL,
    issueId TEXT NOT NULL,
    parentId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (authorId) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (issueId) REFERENCES Issue(id) ON DELETE CASCADE
  );
  
  await prisma.CREATE TABLE IF NOT EXISTS AuditLog (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entityId TEXT NOT NULL,
    userId TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  );
  
  await prisma.CREATE TABLE IF NOT EXISTS Notification (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    userId TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    link TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  );
  
  await prisma.CREATE TABLE IF NOT EXISTS View (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    filters TEXT DEFAULT '{}',
    projectId TEXT NOT NULL,
    userId TEXT NOT NULL,
    shared INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  );
  
  await prisma.CREATE TABLE IF NOT EXISTS IssueRelation (
    id TEXT PRIMARY KEY,
    fromIssueId TEXT NOT NULL,
    toIssueId TEXT NOT NULL,
    type TEXT NOT NULL,
    FOREIGN KEY (fromIssueId) REFERENCES Issue(id) ON DELETE CASCADE,
    FOREIGN KEY (toIssueId) REFERENCES Issue(id) ON DELETE CASCADE,
    UNIQUE(fromIssueId, toIssueId, type)
  );
  
  console.log('All tables created successfully!');
  await prisma.();
}

main().catch(console.error);
