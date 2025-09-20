# Campaign Manager - Repository Setup Guide

## Document Information
- Version: 1.0
- Date: 2025-09-20
- Status: Active
- Purpose: Complete guide for Campaign Manager repository initialization
- Stack: TypeScript, Fastify, PostgreSQL, Redis, BullMQ

## Repository Creation

### Step 1: Create GitHub Repository
```bash
# Create repository in Digital-Clipboard organization
gh repo create Digital-Clipboard/campaign-manager \
  --public \
  --description "Pre-campaign coordination and team management agent" \
  --add-readme \
  --clone

cd campaign-manager
```

### Step 2: Initialize TypeScript Project
```bash
# Initialize package.json with pnpm
pnpm init

# Add type module
npm pkg set type="module"

# Install TypeScript and core dependencies
pnpm add -D typescript @types/node tsx tsup
pnpm add -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D prettier eslint eslint-config-prettier
pnpm add -D jest @types/jest ts-jest jest-extended
pnpm add -D @swc/core @swc/jest
pnpm add -D supertest @types/supertest
pnpm add -D msw @faker-js/faker

# Install production dependencies
pnpm add fastify @fastify/cors @fastify/helmet @fastify/jwt
pnpm add @fastify/rate-limit @fastify/websocket @fastify/multipart
pnpm add socket.io socket.io-client
pnpm add @prisma/client prisma
pnpm add bullmq ioredis
pnpm add node-cron
pnpm add zod zod-to-json-schema
pnpm add winston pino pino-pretty
pnpm add date-fns
pnpm add dotenv
pnpm add @modelcontextprotocol/sdk
```

### Step 3: Create Project Structure
```bash
# Create directory structure
mkdir -p src/{api,services,integrations,models,workers,utils,websocket}
mkdir -p src/api/{routes,controllers,middleware,validators,schemas}
mkdir -p src/services/{campaign,task,notification,approval,team}
mkdir -p src/integrations/{mcp,slack,mailjet,marketing}
mkdir -p src/workers/{processors,schedulers}
mkdir -p tests/{unit,integration,e2e,fixtures,factories,mocks}
mkdir -p prisma/{migrations,seeds}
mkdir -p scripts docker .github/workflows docs config
```

## Configuration Files

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@tests/*": ["tests/*"]
    },
    "types": ["node", "jest"],
    "allowJs": false,
    "checkJs": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage", "tests"]
}
```

### package.json scripts
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "setup": "bash scripts/setup.sh"
  }
}
```

### .eslintrc.json
```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-imports": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  },
  "env": {
    "node": true,
    "jest": true
  }
}
```

### .prettierrc
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

## Database Setup

### prisma/schema.prisma
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Campaign {
  id              String   @id @default(uuid())
  name            String
  type            String
  status          String   @default("planning")
  targetDate      DateTime
  objectives      Json
  audience        Json
  priority        String   @default("medium")
  ownerId         String
  owner           TeamMember @relation(fields: [ownerId], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  timeline        Timeline?
  tasks           Task[]
  approvals       Approval[]
  notifications   Notification[]
  assets          Asset[]
  activities      Activity[]

  @@index([status, targetDate])
  @@index([ownerId])
}

model Timeline {
  id              String     @id @default(uuid())
  campaignId      String     @unique
  campaign        Campaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  template        String
  milestones      Json       // Array of milestone objects
  criticalPath    String[]
  buffer          Int        // hours
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model Task {
  id              String     @id @default(uuid())
  campaignId      String
  campaign        Campaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  title           String
  description     String?
  assigneeId      String?
  assignee        TeamMember? @relation(fields: [assigneeId], references: [id])
  dueDate         DateTime
  priority        String     @default("medium")
  status          String     @default("pending")
  dependencies    String[]   // Task IDs
  completedAt     DateTime?
  blockedReason   String?
  timeTracked     Int        @default(0) // minutes
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  comments        Comment[]
  attachments     Attachment[]
  history         TaskHistory[]

  @@index([campaignId, status])
  @@index([assigneeId, dueDate])
  @@index([status, dueDate])
}

model TeamMember {
  id              String     @id @default(uuid())
  email           String     @unique
  name            String
  role            String
  skills          String[]
  timezone        String     @default("UTC")
  slackUserId     String?    @unique
  availability    Json       // Schedule object
  maxConcurrent   Int        @default(5)
  isActive        Boolean    @default(true)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  ownedCampaigns  Campaign[]
  tasks           Task[]
  approvals       Approval[]
  comments        Comment[]
  notifications   Notification[]
}

model Approval {
  id              String     @id @default(uuid())
  campaignId      String
  campaign        Campaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  stage           String     // draft, content, legal, final
  approverId      String
  approver        TeamMember @relation(fields: [approverId], references: [id])
  status          String     @default("pending") // pending, approved, rejected
  comments        String?
  conditions      String[]
  decidedAt       DateTime?
  deadline        DateTime
  autoApproveAt   DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@unique([campaignId, stage, approverId])
  @@index([status, deadline])
  @@index([approverId, status])
}

model Notification {
  id              String     @id @default(uuid())
  campaignId      String?
  campaign        Campaign?  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  recipientId     String
  recipient       TeamMember @relation(fields: [recipientId], references: [id])
  type            String
  channel         String     // email, slack, in-app
  urgency         String     @default("normal")
  payload         Json
  scheduledFor    DateTime
  sentAt          DateTime?
  readAt          DateTime?
  failedAttempts  Int        @default(0)
  lastError       String?
  createdAt       DateTime   @default(now())

  @@index([recipientId, readAt])
  @@index([scheduledFor, sentAt])
  @@index([type, urgency])
}

model Asset {
  id              String     @id @default(uuid())
  campaignId      String
  campaign        Campaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  name            String
  type            String     // copy, image, video, template
  url             String?
  content         String?    @db.Text
  version         Int        @default(1)
  status          String     @default("draft")
  uploadedById    String
  metadata        Json?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  attachments     Attachment[]

  @@index([campaignId, type])
}

model Comment {
  id              String     @id @default(uuid())
  taskId          String
  task            Task       @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorId        String
  author          TeamMember @relation(fields: [authorId], references: [id])
  text            String     @db.Text
  mentions        String[]   // User IDs
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@index([taskId, createdAt])
}

model Attachment {
  id              String     @id @default(uuid())
  taskId          String?
  task            Task?      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  assetId         String?
  asset           Asset?     @relation(fields: [assetId], references: [id], onDelete: Cascade)
  filename        String
  url             String
  size            Int        // bytes
  mimeType        String
  uploadedAt      DateTime   @default(now())

  @@index([taskId])
  @@index([assetId])
}

model TaskHistory {
  id              String     @id @default(uuid())
  taskId          String
  task            Task       @relation(fields: [taskId], references: [id], onDelete: Cascade)
  field           String
  oldValue        String?
  newValue        String?
  changedById     String
  changedAt       DateTime   @default(now())

  @@index([taskId, changedAt])
}

model Activity {
  id              String     @id @default(uuid())
  campaignId      String
  campaign        Campaign   @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  type            String
  description     String
  metadata        Json?
  actorId         String
  createdAt       DateTime   @default(now())

  @@index([campaignId, createdAt])
  @@index([type, createdAt])
}
```

## Docker Configuration

### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/campaign_manager
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=development_secret_key
      - PORT=3001
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src
      - ./tests:/app/tests
      - ./prisma:/app/prisma
    command: pnpm dev

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: campaign_manager
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  worker:
    build: .
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/campaign_manager
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src
    command: pnpm run worker

volumes:
  postgres_data:
  redis_data:
```

### Dockerfile
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate
RUN pnpm build

FROM base AS runtime
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## GitHub Actions Workflows

### .github/workflows/ci.yml
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: campaign_manager_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linter
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Setup test database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/campaign_manager_test
        run: |
          pnpm prisma generate
          pnpm prisma migrate deploy

      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/campaign_manager_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test_secret
        run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  build:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

### .github/workflows/claude-review.yml
```yaml
name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Claude Code Review
        uses: anthropics/claude-code-review@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          claude-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          review-level: comprehensive
          language: typescript
          focus-areas: |
            - Task assignment logic
            - Notification delivery
            - MCP integration
            - Performance optimization
```

## Environment Configuration

### .env.example
```bash
# Application
NODE_ENV=development
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5433/campaign_manager

# Redis
REDIS_URL=redis://localhost:6380

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# External Services
SLACK_MANAGER_URL=http://localhost:3002
MARKETING_AGENT_URL=http://localhost:3000
MAILJET_AGENT_URL=http://localhost:3003

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_APP_TOKEN=xapp-1-YOUR-TOKEN
SLACK_BOT_TOKEN=xoxb-YOUR-TOKEN

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Workers
WORKER_CONCURRENCY=10
JOB_RETENTION_DAYS=30

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
```

## Development Setup Script

### scripts/setup.sh
```bash
#!/bin/bash
set -e

echo "🚀 Setting up Campaign Manager development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Copy environment file
echo "🔧 Setting up environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Please update .env with your configuration"
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 5

# Run database migrations
echo "🗄️ Setting up database..."
pnpm prisma generate
pnpm prisma migrate dev --name init

# Seed database (optional)
# echo "🌱 Seeding database..."
# pnpm prisma db seed

# Run initial tests
echo "🧪 Running tests..."
pnpm test

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your configuration"
echo "2. Run 'pnpm dev' to start the development server"
echo "3. Access the API at http://localhost:3001"
echo "4. View database with 'pnpm prisma studio'"
```

## VS Code Configuration

### .vscode/settings.json
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.exclude": {
    "node_modules": true,
    "dist": true,
    "coverage": true,
    ".turbo": true
  },
  "jest.autoRun": {
    "watch": false,
    "onSave": "test-file"
  }
}
```

### .vscode/launch.json
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "tsc: build - tsconfig.json",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Jest Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-coverage"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## Initial Source Files

### src/index.ts
```typescript
import 'dotenv/config';
import { buildServer } from './api/server';
import { logger } from './utils/logger';
import { prisma } from './utils/prisma';
import { startWorkers } from './workers';
import { initializeWebSocket } from './websocket/socket.server';

async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');

    // Build Fastify server
    const server = await buildServer();

    // Initialize WebSocket
    const io = initializeWebSocket(server.server);

    // Start background workers
    await startWorkers();

    // Start server
    const port = process.env.PORT || 3001;
    await server.listen({ port: Number(port), host: '0.0.0.0' });

    logger.info(`Campaign Manager running on port ${port}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
```

### src/api/server.ts
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';

import { healthRoutes } from './routes/health';
import { campaignRoutes } from './routes/campaigns';
import { taskRoutes } from './routes/tasks';
import { notificationRoutes } from './routes/notifications';

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
    bodyLimit: 10485760, // 10MB
    trustProxy: true,
  });

  // Register plugins
  await server.register(helmet, {
    contentSecurityPolicy: false,
  });

  await server.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
  });

  await server.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW) || 60000,
  });

  await server.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });

  await server.register(websocket);

  // Register routes
  await server.register(healthRoutes, { prefix: '/health' });
  await server.register(campaignRoutes, { prefix: '/api/v1/campaigns' });
  await server.register(taskRoutes, { prefix: '/api/v1/tasks' });
  await server.register(notificationRoutes, { prefix: '/api/v1/notifications' });

  return server;
}
```

## Git Configuration

### .gitignore
```
# Dependencies
node_modules/
.pnp.*
.yarn/*

# Build
dist/
*.tsbuildinfo
.turbo/

# Testing
coverage/
.nyc_output/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
.idea/
*.swp
*.swo
.DS_Store

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Database
*.db
*.sqlite
prisma/migrations/dev/

# Temporary
tmp/
temp/
.cache/
```

## README.md Template
```markdown
# Campaign Manager Agent

Pre-campaign coordination and team management agent for Digital Clipboard.

## Features

- 📅 Campaign scheduling and timeline management
- ✅ Task assignment and tracking
- 👥 Team coordination and workload balancing
- 🔔 Smart notifications and escalations
- 📊 Real-time dashboard and analytics
- 🤝 MCP integration with other agents

## Quick Start

\`\`\`bash
# Clone repository
git clone https://github.com/Digital-Clipboard/campaign-manager.git
cd campaign-manager

# Run setup script
chmod +x scripts/setup.sh
./scripts/setup.sh

# Start development server
pnpm dev
\`\`\`

## Development

\`\`\`bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build for production
pnpm build
\`\`\`

## Architecture

See [docs/architecture.md](docs/02_architecture.md) for detailed architecture documentation.

## API Documentation

API documentation available at `http://localhost:3001/docs` when running locally.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

MIT
```

## First Commit

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "feat: Initial Campaign Manager setup

- TypeScript configuration with Fastify
- Prisma database schema
- Jest testing framework
- Docker development environment
- GitHub Actions CI/CD
- MCP integration structure
- WebSocket support for real-time updates

Co-Authored-By: Claude <noreply@anthropic.com>"

# Add remote origin
git remote add origin https://github.com/Digital-Clipboard/campaign-manager.git

# Push to main branch
git push -u origin main

# Create and switch to develop branch
git checkout -b develop
git push -u origin develop
```

## Next Steps

1. ✅ Run setup script: `./scripts/setup.sh`
2. ✅ Configure environment variables in `.env`
3. ✅ Start development server: `pnpm dev`
4. ✅ Verify health check: `curl http://localhost:3001/health`
5. ✅ Create first feature branch: `git checkout -b feature/campaign-core`
6. ✅ Begin Milestone 1 implementation