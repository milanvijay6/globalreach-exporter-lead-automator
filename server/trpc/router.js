const { router } = require('./procedures');
const { leadsRouter } = require('./routers/leads');
const { productsRouter } = require('./routers/products');
const { messagesRouter } = require('./routers/messages');
const { analyticsRouter } = require('./routers/analytics');

/**
 * Main tRPC router
 * Combines all sub-routers
 */
const appRouter = router({
  leads: leadsRouter,
  products: productsRouter,
  messages: messagesRouter,
  analytics: analyticsRouter,
});

module.exports = {
  appRouter,
};

