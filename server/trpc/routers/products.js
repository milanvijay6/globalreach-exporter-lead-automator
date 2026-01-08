const { z } = require('zod');
const { router, publicProcedure, protectedProcedure, paginationSchema, idSchema } = require('../procedures');
const { TRPCError } = require('@trpc/server');
const Parse = require('parse/node');
const Product = require('../../models/Product');
const { applyCursor, getNextCursor, formatPaginatedResponse } = require('../../utils/pagination');
const { findWithCache } = require('../../utils/parseQueryCache');
const { productCatalogCache } = require('../../services/productCatalogCache');
const { projectFields } = require('../../utils/fieldProjection');

const productsRouter = router({
  /**
   * Get list of products with pagination and filtering
   */
  getProducts: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        search: z.string().optional(),
        tags: z.union([z.string(), z.array(z.string())]).optional(),
        status: z.string().optional(),
        fields: z.string().optional(),
      }).merge(paginationSchema)
    )
    .query(async ({ input, ctx }) => {
      try {
        const { category, search, tags, status, limit, cursor, fields } = input;
        const userId = ctx.userId || null;
        const sortField = 'createdAt';
        const sortOrder = 'desc';
        
        // Check in-memory product catalog cache first
        const cachedProducts = productCatalogCache.get(userId);
        if (cachedProducts && !search && !category && !tags && !status) {
          const projected = cachedProducts.map(p => projectFields(p, fields));
          return formatPaginatedResponse(projected, null, limit);
        }
        
        const query = new Parse.Query(Product);
        
        if (category) {
          query.equalTo('category', category);
        }
        
        if (status) {
          query.equalTo('status', status);
        }
        
        if (tags) {
          const tagArray = Array.isArray(tags) ? tags : tags.split(',');
          query.containsAll('tags', tagArray);
        }
        
        if (search) {
          query.matches('name', search, 'i');
        }
        
        // Apply cursor-based pagination
        applyCursor(query, cursor, sortField, sortOrder);
        query.limit(limit + 1);
        
        // Use Parse query cache
        const products = await findWithCache(query, {
          useMasterKey: true,
          cachePolicy: 'cacheElseNetwork',
          maxCacheAge: 300,
        });
        
        // Check if there's a next page
        const hasMore = products.length > limit;
        const results = hasMore ? products.slice(0, limit) : products;
        
        // Get next cursor
        const nextCursor = hasMore ? getNextCursor(results, sortField, sortOrder) : null;
        
        // Format results with field projection
        const formattedResults = results.map(p => {
          const base = {
            id: p.id,
            name: p.get('name'),
            description: p.get('description'),
            price: p.get('price'),
            category: p.get('category'),
            tags: p.get('tags') || [],
            photos: p.get('photos') || [],
            status: p.get('status'),
            createdAt: p.get('createdAt'),
            updatedAt: p.get('updatedAt'),
          };
          
          return projectFields(base, fields);
        });
        
        // Cache in-memory if no filters
        if (!search && !category && !tags && !status && !cursor) {
          productCatalogCache.set(formattedResults, userId);
        }
        
        return formatPaginatedResponse(formattedResults, nextCursor, limit);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to fetch products',
        });
      }
    }),

  /**
   * Get single product by ID
   */
  getProduct: publicProcedure
    .input(
      idSchema.extend({
        fields: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { id, fields } = input;
        const query = new Parse.Query(Product);
        const product = await query.get(id, { useMasterKey: true });
        
        const base = {
          id: product.id,
          name: product.get('name'),
          description: product.get('description'),
          price: product.get('price'),
          category: product.get('category'),
          tags: product.get('tags') || [],
          photos: product.get('photos') || [],
          status: product.get('status'),
          createdAt: product.get('createdAt'),
          updatedAt: product.get('updatedAt'),
        };
        
        return projectFields(base, fields);
      } catch (error) {
        if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Product not found',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to fetch product',
        });
      }
    }),

  /**
   * Create product
   */
  createProduct: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.number().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        photos: z.array(z.any()).optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const product = new Product();
        
        Object.keys(input).forEach(key => {
          if (input[key] !== undefined) {
            product.set(key, input[key]);
          }
        });
        
        await product.save(null, { useMasterKey: true });
        
        // Invalidate cache
        const { invalidateByTag } = require('../../middleware/cache');
        await invalidateByTag(['products']);
        productCatalogCache.invalidate(ctx.userId);
        
        return {
          success: true,
          id: product.id,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to create product',
        });
      }
    }),
});

module.exports = { productsRouter };

