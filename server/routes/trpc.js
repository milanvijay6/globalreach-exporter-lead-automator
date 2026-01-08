const express = require('express');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const { appRouter } = require('../trpc/router');
const { createContext } = require('../trpc/procedures');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

const router = express.Router();

/**
 * tRPC endpoint
 * Handles all tRPC requests
 */
router.use(
  '/',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, path, type }) => {
      logger.error(`[tRPC] Error on path "${path}":`, error);
    },
  })
);

module.exports = router;

