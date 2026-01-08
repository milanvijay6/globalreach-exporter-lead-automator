/**
 * Migration Script: Migrate Large Messages to Parse Files
 * Moves email bodies >1KB to Parse Files
 * 
 * Usage:
 *   node scripts/migrate-large-messages.js
 */

const { parseFileService } = require('../server/utils/parseFileService');

async function migrateLargeMessages() {
  console.log('='.repeat(80));
  console.log('Large Message Migration');
  console.log('='.repeat(80));
  console.log('');

  try {
    console.log('Starting migration...');
    const result = await parseFileService.migrateLargeMessages({
      useMasterKey: true,
      limit: 100,
    });

    console.log('');
    console.log('Migration Results:');
    console.log(`  Processed: ${result.processed} messages`);
    console.log(`  Migrated: ${result.migrated} messages`);
    console.log('');
    console.log('✅ Migration complete!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateLargeMessages();
}

module.exports = { migrateLargeMessages };

