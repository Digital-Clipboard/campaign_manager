import { setupServer } from 'msw/node';
import { slackHandlers } from './handlers/slack';
import { mailjetHandlers } from './handlers/mailjet';
import { marketingHandlers } from './handlers/marketing';

// Setup MSW server with all mock handlers
export const server = setupServer(
  ...slackHandlers,
  ...mailjetHandlers,
  ...marketingHandlers
);