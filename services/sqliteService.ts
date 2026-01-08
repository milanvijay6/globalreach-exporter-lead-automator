/**
 * SQLite Service
 * Native SQLite database for local caching and complex queries
 * Faster than IndexedDB for complex operations (5-10x)
 */

import { CapacitorSQLite, SQLiteDBConnection, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = process.env.SQLITE_DB_NAME || 'globalreach';
const DB_VERSION = 1;

let db: SQLiteDBConnection | null = null;
let isInitialized = false;

/**
 * Check if SQLite is available
 */
function isSQLiteAvailable(): boolean {
  return Capacitor.isNativePlatform() && !!CapacitorSQLite;
}

/**
 * Initialize SQLite database
 */
export async function initializeSQLite(): Promise<boolean> {
  if (isInitialized && db) {
    return true;
  }

  if (!isSQLiteAvailable()) {
    console.log('[SQLite] Not available on this platform, skipping initialization');
    return false;
  }

  try {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    
    // Check if database exists
    const dbExists = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

    if (!isConn) {
      // Create database
      db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
      await db.open();
      
      // Create tables
      await createTables();
      
      console.log('[SQLite] Database initialized successfully');
    } else {
      // Use existing connection
      db = await sqlite.retrieveConnection(DB_NAME, false);
    }

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[SQLite] Failed to initialize:', error);
    return false;
  }
}

/**
 * Create database tables
 */
async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // Leads table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT,
      companyName TEXT,
      country TEXT,
      contactDetail TEXT,
      status TEXT,
      leadScore INTEGER,
      lastContacted INTEGER,
      productsImported TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      userId TEXT,
      data TEXT
    )
  `);

  // Create indexes for common queries
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_leads_createdAt ON leads(createdAt)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_leads_userId ON leads(userId)`);

  // Messages table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      importerId TEXT,
      channel TEXT,
      sender TEXT,
      content TEXT,
      timestamp INTEGER,
      status TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      data TEXT
    )
  `);

  // Create indexes for messages
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_importerId ON messages(importerId)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)`);

  // Products table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      price REAL,
      category TEXT,
      tags TEXT,
      photos TEXT,
      status TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      data TEXT
    )
  `);

  // Create indexes for products
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_createdAt ON products(createdAt)`);

  // Config table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT,
      userId TEXT,
      updatedAt INTEGER
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_config_userId ON config(userId)`);

  console.log('[SQLite] Tables created successfully');
}

/**
 * Get database connection
 */
function getDB(): SQLiteDBConnection {
  if (!db || !isInitialized) {
    throw new Error('SQLite database not initialized. Call initializeSQLite() first.');
  }
  return db;
}

/**
 * Save leads to SQLite
 */
export async function saveLeads(leads: any[], userId?: string): Promise<void> {
  if (!isSQLiteAvailable() || !isInitialized) {
    return; // Fallback to other storage
  }

  try {
    const db = getDB();
    
    // Use transaction for batch insert
    await db.beginTransaction();
    
    try {
      for (const lead of leads) {
        await db.run(
          `INSERT OR REPLACE INTO leads (id, name, companyName, country, contactDetail, status, leadScore, lastContacted, productsImported, createdAt, updatedAt, userId, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lead.id,
            lead.name || null,
            lead.companyName || null,
            lead.country || null,
            lead.contactDetail || null,
            lead.status || null,
            lead.leadScore || null,
            lead.lastContacted || null,
            JSON.stringify(lead.productsImported || []),
            lead.createdAt || Date.now(),
            lead.updatedAt || Date.now(),
            userId || null,
            JSON.stringify(lead),
          ]
        );
      }
      
      await db.commitTransaction();
      console.log(`[SQLite] Saved ${leads.length} leads`);
    } catch (error) {
      await db.rollbackTransaction();
      throw error;
    }
  } catch (error) {
    console.error('[SQLite] Error saving leads:', error);
    throw error;
  }
}

/**
 * Get leads from SQLite with filtering
 */
export async function getLeads(filters: {
  status?: string;
  country?: string;
  userId?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<any[]> {
  if (!isSQLiteAvailable() || !isInitialized) {
    return []; // Fallback to other storage
  }

  try {
    const db = getDB();
    let query = 'SELECT * FROM leads WHERE 1=1';
    const params: any[] = [];

    if (filters.userId) {
      query += ' AND userId = ?';
      params.push(filters.userId);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.country) {
      query += ' AND country = ?';
      params.push(filters.country);
    }

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const result = await db.query(query, params);
    
    return result.values.map((row: any) => {
      try {
        const data = JSON.parse(row.data || '{}');
        return {
          ...data,
          id: row.id,
          productsImported: row.productsImported ? JSON.parse(row.productsImported) : [],
        };
      } catch (e) {
        return {
          id: row.id,
          name: row.name,
          companyName: row.companyName,
          country: row.country,
          contactDetail: row.contactDetail,
          status: row.status,
          leadScore: row.leadScore,
          lastContacted: row.lastContacted,
          productsImported: row.productsImported ? JSON.parse(row.productsImported) : [],
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }
    });
  } catch (error) {
    console.error('[SQLite] Error getting leads:', error);
    return [];
  }
}

/**
 * Save messages to SQLite
 */
export async function saveMessages(messages: any[]): Promise<void> {
  if (!isSQLiteAvailable() || !isInitialized) {
    return;
  }

  try {
    const db = getDB();
    await db.beginTransaction();
    
    try {
      for (const msg of messages) {
        await db.run(
          `INSERT OR REPLACE INTO messages (id, importerId, channel, sender, content, timestamp, status, createdAt, updatedAt, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            msg.id,
            msg.importerId || null,
            msg.channel || null,
            msg.sender || null,
            msg.content || null,
            msg.timestamp || Date.now(),
            msg.status || null,
            msg.createdAt || Date.now(),
            msg.updatedAt || Date.now(),
            JSON.stringify(msg),
          ]
        );
      }
      
      await db.commitTransaction();
      console.log(`[SQLite] Saved ${messages.length} messages`);
    } catch (error) {
      await db.rollbackTransaction();
      throw error;
    }
  } catch (error) {
    console.error('[SQLite] Error saving messages:', error);
    throw error;
  }
}

/**
 * Get messages from SQLite
 */
export async function getMessages(filters: {
  importerId?: string;
  channel?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  if (!isSQLiteAvailable() || !isInitialized) {
    return [];
  }

  try {
    const db = getDB();
    let query = 'SELECT * FROM messages WHERE 1=1';
    const params: any[] = [];

    if (filters.importerId) {
      query += ' AND importerId = ?';
      params.push(filters.importerId);
    }

    if (filters.channel) {
      query += ' AND channel = ?';
      params.push(filters.channel);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const result = await db.query(query, params);
    
    return result.values.map((row: any) => {
      try {
        return JSON.parse(row.data || '{}');
      } catch (e) {
        return {
          id: row.id,
          importerId: row.importerId,
          channel: row.channel,
          sender: row.sender,
          content: row.content,
          timestamp: row.timestamp,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }
    });
  } catch (error) {
    console.error('[SQLite] Error getting messages:', error);
    return [];
  }
}

/**
 * Save products to SQLite
 */
export async function saveProducts(products: any[]): Promise<void> {
  if (!isSQLiteAvailable() || !isInitialized) {
    return;
  }

  try {
    const db = getDB();
    await db.beginTransaction();
    
    try {
      for (const product of products) {
        await db.run(
          `INSERT OR REPLACE INTO products (id, name, description, price, category, tags, photos, status, createdAt, updatedAt, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.id,
            product.name || null,
            product.description || null,
            product.price || null,
            product.category || null,
            JSON.stringify(product.tags || []),
            JSON.stringify(product.photos || []),
            product.status || null,
            product.createdAt || Date.now(),
            product.updatedAt || Date.now(),
            JSON.stringify(product),
          ]
        );
      }
      
      await db.commitTransaction();
      console.log(`[SQLite] Saved ${products.length} products`);
    } catch (error) {
      await db.rollbackTransaction();
      throw error;
    }
  } catch (error) {
    console.error('[SQLite] Error saving products:', error);
    throw error;
  }
}

/**
 * Get products from SQLite
 */
export async function getProducts(filters: {
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  if (!isSQLiteAvailable() || !isInitialized) {
    return [];
  }

  try {
    const db = getDB();
    let query = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY createdAt DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const result = await db.query(query, params);
    
    return result.values.map((row: any) => {
      try {
        const data = JSON.parse(row.data || '{}');
        return {
          ...data,
          id: row.id,
          tags: row.tags ? JSON.parse(row.tags) : [],
          photos: row.photos ? JSON.parse(row.photos) : [],
        };
      } catch (e) {
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          price: row.price,
          category: row.category,
          tags: row.tags ? JSON.parse(row.tags) : [],
          photos: row.photos ? JSON.parse(row.photos) : [],
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }
    });
  } catch (error) {
    console.error('[SQLite] Error getting products:', error);
    return [];
  }
}

/**
 * Close database connection
 */
export async function closeSQLite(): Promise<void> {
  if (db && isInitialized) {
    try {
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      await sqlite.closeConnection(DB_NAME, false);
      db = null;
      isInitialized = false;
      console.log('[SQLite] Database closed');
    } catch (error) {
      console.error('[SQLite] Error closing database:', error);
    }
  }
}

