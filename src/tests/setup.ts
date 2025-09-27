import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret';
process.env.APP_URL = 'http://localhost:3001';

// Mock logger to avoid console output during tests
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock Prisma client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn()
}));

// Mock Redis
vi.mock('ioredis', () => ({
  Redis: vi.fn()
}));

// Global test utilities
global.createMockRequest = (overrides = {}) => ({
  method: 'GET',
  url: '/',
  headers: {},
  user: { id: 'test-user', email: 'test@example.com' },
  ...overrides
});

global.createMockReply = () => ({
  status: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
  header: vi.fn().mockReturnThis()
});

// Setup global mocks for common dependencies
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after tests
afterEach(() => {
  vi.resetAllMocks();
});