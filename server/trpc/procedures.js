const { initTRPC, TRPCError } = require('@trpc/server');
const { z } = require('zod');

/**
 * Context for tRPC procedures
 * Contains request information and user session
 */
function createContext(opts) {
  // Extract user ID from headers or session
  const userId = opts.req.headers['x-user-id'] || opts.req.userId || null;
  const sessionToken = opts.req.headers['x-parse-session-token'] || opts.req.sessionToken || null;

  return {
    userId: userId || undefined,
    sessionToken: sessionToken || undefined,
    req: opts.req,
    res: opts.res,
  };
}

/**
 * Initialize tRPC
 */
const t = initTRPC.context().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.code,
        httpStatus: error.code === 'UNAUTHORIZED' ? 401 : error.code === 'FORBIDDEN' ? 403 : 500,
      },
    };
  },
});

/**
 * Base router and procedure exports
 */
const router = t.router;
const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 */
const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  return opts.next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // Now guaranteed to be defined
    },
  });
});

/**
 * Input validation schemas
 */
const paginationSchema = z.object({
  limit: z.number().min(1).max(200).default(50),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const fieldSelectionSchema = z.object({
  fields: z.string().optional(), // Comma-separated list of fields
});

const idSchema = z.object({
  id: z.string().min(1),
});

module.exports = {
  createContext,
  router,
  publicProcedure,
  protectedProcedure,
  paginationSchema,
  fieldSelectionSchema,
  idSchema,
};

