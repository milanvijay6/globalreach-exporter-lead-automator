const { z } = require('zod');
const { router, publicProcedure } = require('../procedures');
const { TRPCError } = require('@trpc/server');
const AnalyticsDaily = require('../../models/AnalyticsDaily');
const Lead = require('../../models/Lead');
const Parse = require('parse/node');

const analyticsRouter = router({
  /**
   * Get analytics data
   */
  getAnalytics: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        userId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { startDate, endDate, userId } = input;
        
        const query = new Parse.Query(AnalyticsDaily);
        
        if (startDate) {
          query.greaterThanOrEqualTo('date', new Date(startDate));
        }
        
        if (endDate) {
          query.lessThanOrEqualTo('date', new Date(endDate));
        }
        
        if (userId) {
          query.equalTo('userId', userId);
        }
        
        query.descending('date');
        query.limit(30); // Last 30 days
        
        const analytics = await query.find({ useMasterKey: true });
        
        return {
          success: true,
          data: analytics.map(a => ({
            date: a.get('date'),
            totalLeads: a.get('totalLeads'),
            statusCounts: a.get('statusCounts'),
            countryCounts: a.get('countryCounts'),
            averageLeadScore: a.get('averageLeadScore'),
          })),
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to fetch analytics',
        });
      }
    }),

  /**
   * Get dashboard overview
   */
  getDashboard: publicProcedure
    .query(async ({ input, ctx }) => {
      try {
        // Get recent leads count
        const leadsQuery = new Parse.Query(Lead);
        leadsQuery.notEqualTo('archived', true);
        const totalLeads = await leadsQuery.count({ useMasterKey: true });
        
        // Get leads by status
        const statusCounts = {};
        const statuses = ['Pending', 'Contacted', 'Engaged', 'Interested', 'Negotiation', 'Closed', 'Cold'];
        
        for (const status of statuses) {
          const statusQuery = new Parse.Query(Lead);
          statusQuery.equalTo('status', status);
          statusQuery.notEqualTo('archived', true);
          statusCounts[status] = await statusQuery.count({ useMasterKey: true });
        }
        
        // Get recent analytics (last 7 days)
        const analyticsQuery = new Parse.Query(AnalyticsDaily);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        analyticsQuery.greaterThanOrEqualTo('date', sevenDaysAgo);
        analyticsQuery.descending('date');
        analyticsQuery.limit(7);
        const recentAnalytics = await analyticsQuery.find({ useMasterKey: true });
        
        return {
          success: true,
          data: {
            totalLeads,
            statusCounts,
            recentAnalytics: recentAnalytics.map(a => ({
              date: a.get('date'),
              totalLeads: a.get('totalLeads'),
              averageLeadScore: a.get('averageLeadScore'),
            })),
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to fetch dashboard data',
        });
      }
    }),
});

module.exports = { analyticsRouter };

