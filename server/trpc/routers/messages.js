const { z } = require('zod');
const { router, publicProcedure, protectedProcedure, paginationSchema } = require('../procedures');
const { TRPCError } = require('@trpc/server');
const Parse = require('parse/node');
const Message = require('../../models/Message');
const { parseFileService } = require('../../utils/parseFileService');
const { findWithCache } = require('../../utils/parseQueryCache');
const { projectFields } = require('../../utils/fieldProjection');

const messagesRouter = router({
  /**
   * Get messages for an importer
   */
  getMessages: publicProcedure
    .input(
      z.object({
        importerId: z.string().min(1),
        channel: z.string().optional(),
        status: z.string().optional(),
        getArchived: z.boolean().default(false),
        fields: z.string().optional(),
      }).merge(paginationSchema)
    )
    .query(async ({ input, ctx }) => {
      try {
        const { importerId, channel, status, limit, cursor, getArchived, fields } = input;
        
        const query = new Parse.Query(Message);
        query.equalTo('importerId', importerId);
        
        // Exclude archived messages by default
        if (!getArchived) {
          query.notEqualTo('archived', true);
        }
        
        if (channel) {
          query.equalTo('channel', channel);
        }
        
        if (status) {
          query.equalTo('status', status);
        }
        
        // Use compound index: importerId_channel_timestamp
        query.descending('timestamp');
        query.limit(limit + 1);
        
        // Use Parse query cache
        const messages = await findWithCache(query, {
          useMasterKey: true,
          cachePolicy: 'cacheElseNetwork',
          maxCacheAge: 60,
        });
        
        // Check if there's a next page
        const hasMore = messages.length > limit;
        const results = hasMore ? messages.slice(0, limit) : messages;
        
        // Get next cursor
        const nextCursor = hasMore ? results[results.length - 1].id : null;
        
        // Format results and fetch file content if needed
        const formattedResults = await Promise.all(results.map(async (msg) => {
          const base = {
            id: msg.id,
            importerId: msg.get('importerId'),
            channel: msg.get('channel'),
            sender: msg.get('sender'),
            timestamp: msg.get('timestamp'),
            status: msg.get('status'),
            createdAt: msg.get('createdAt'),
            updatedAt: msg.get('updatedAt'),
          };
          
          // Get content (from inline field or Parse File) - only if content field is requested
          if (!fields || fields.includes('content')) {
            const content = await parseFileService.getContent(msg, { useMasterKey: true });
            base.content = content;
          }
          
          return projectFields(base, fields);
        }));
        
        return {
          success: true,
          data: formattedResults,
          pagination: {
            limit,
            hasMore,
            nextCursor,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to fetch messages',
        });
      }
    }),

  /**
   * Send a message
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        importerId: z.string().min(1),
        channel: z.string().min(1),
        sender: z.string().min(1),
        content: z.string().min(1),
        timestamp: z.number().optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { importerId, channel, sender, content, timestamp, status } = input;
        
        const message = new Message();
        message.set('importerId', importerId);
        message.set('channel', channel);
        message.set('sender', sender);
        message.set('timestamp', timestamp || Date.now());
        message.set('status', status || 'sent');
        
        // Use Parse File service for large content
        await parseFileService.setContent(message, content, { useMasterKey: true });
        
        await message.save(null, { useMasterKey: true });
        
        // Invalidate cache
        const { invalidateByTag } = require('../../middleware/cache');
        await invalidateByTag(['messages']);
        
        return {
          success: true,
          id: message.id,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to send message',
        });
      }
    }),
});

module.exports = { messagesRouter };

