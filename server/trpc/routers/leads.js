const { z } = require('zod');
const { router, publicProcedure, protectedProcedure, paginationSchema, idSchema } = require('../procedures');
const { TRPCError } = require('@trpc/server');
const Parse = require('parse/node');
const Lead = require('../../models/Lead');
const { applyCursor, getNextCursor, formatPaginatedResponse } = require('../../utils/pagination');
const { projectFields } = require('../../utils/fieldProjection');

const leadsRouter = router({
  /**
   * Get list of leads with pagination and filtering
   */
  getLeads: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        country: z.string().optional(),
        getArchived: z.boolean().default(false),
        fields: z.string().optional(),
      }).merge(paginationSchema)
    )
    .query(async ({ input, ctx }) => {
      try {
        const { status, country, limit, cursor, sortBy = 'createdAt', sortOrder = 'desc', getArchived, fields } = input;
        
        const query = new Parse.Query(Lead);
        
        // Exclude archived leads by default
        if (!getArchived) {
          query.notEqualTo('archived', true);
        }
        
        if (status) {
          query.equalTo('status', status);
        }
        
        if (country) {
          query.equalTo('country', country);
        }
        
        // Apply cursor-based pagination
        applyCursor(query, cursor, sortBy, sortOrder);
        query.limit(limit + 1); // Fetch one extra to check if there's more
        
        const leads = await query.find({ useMasterKey: true });
        
        // Check if there's a next page
        const hasMore = leads.length > limit;
        const results = hasMore ? leads.slice(0, limit) : leads;
        
        // Get next cursor
        const nextCursor = hasMore ? getNextCursor(results, sortBy, sortOrder) : null;
        
        // Format results with field projection
        const formattedResults = results.map(l => {
          const base = {
            id: l.id,
            name: l.get('name'),
            companyName: l.get('companyName'),
            country: l.get('country'),
            contactDetail: l.get('contactDetail'),
            status: l.get('status'),
            leadScore: l.get('leadScore'),
            lastContacted: l.get('lastContacted'),
            createdAt: l.get('createdAt'),
            updatedAt: l.get('updatedAt'),
          };
          
          return projectFields(base, fields);
        });
        
        return formatPaginatedResponse(formattedResults, nextCursor, limit);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to fetch leads',
        });
      }
    }),

  /**
   * Get single lead by ID
   */
  getLead: publicProcedure
    .input(
      idSchema.extend({
        fields: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { id, fields } = input;
        const query = new Parse.Query(Lead);
        const lead = await query.get(id, { useMasterKey: true });
        
        const base = {
          id: lead.id,
          name: lead.get('name'),
          companyName: lead.get('companyName'),
          country: lead.get('country'),
          contactDetail: lead.get('contactDetail'),
          status: lead.get('status'),
          leadScore: lead.get('leadScore'),
          lastContacted: lead.get('lastContacted'),
          productsImported: lead.get('productsImported'),
          chatHistory: lead.get('chatHistory') || [],
          createdAt: lead.get('createdAt'),
          updatedAt: lead.get('updatedAt'),
        };
        
        return projectFields(base, fields);
      } catch (error) {
        if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Lead not found',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to fetch lead',
        });
      }
    }),

  /**
   * Update lead
   */
  updateLead: protectedProcedure
    .input(
      idSchema.extend({
        updates: z.record(z.any()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, updates } = input;
        const query = new Parse.Query(Lead);
        const lead = await query.get(id, { useMasterKey: true });
        
        // Apply updates
        Object.keys(updates).forEach(key => {
          lead.set(key, updates[key]);
        });
        
        await lead.save(null, { useMasterKey: true });
        
        return {
          success: true,
          id: lead.id,
        };
      } catch (error) {
        if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Lead not found',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to update lead',
        });
      }
    }),

  /**
   * Send message to lead
   */
  sendMessage: protectedProcedure
    .input(
      idSchema.extend({
        message: z.string().min(1),
        channel: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, message, channel } = input;
        const query = new Parse.Query(Lead);
        const lead = await query.get(id, { useMasterKey: true });
        
        // Invalidate cache
        const { invalidateCache } = require('../../middleware/cache');
        await invalidateCache(`cache:/api/leads:*`);
        
        // This would send the message via the appropriate channel
        // For now, return success
        return {
          success: true,
          messageId: `msg_${Date.now()}`,
        };
      } catch (error) {
        if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Lead not found',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to send message',
        });
      }
    }),
});

module.exports = { leadsRouter };

