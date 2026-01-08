/**
 * Migration Script: Populate Lead Scores
 * Migrates existing leads to have embedded leadScore
 * 
 * Usage:
 *   node scripts/migrate-lead-scores.js
 */

const { denormalize } = require('../server/utils/denormalize');

async function migrateLeadScores() {
  console.log('='.repeat(80));
  console.log('Lead Score Migration');
  console.log('='.repeat(80));
  console.log('');

  try {
    console.log('Starting migration...');
    const result = await denormalize.migrateLeadScores({
      useMasterKey: true,
      limit: 100,
    });

    console.log('');
    console.log('Migration Results:');
    console.log(`  Processed: ${result.processed} leads`);
    console.log(`  Updated: ${result.updated} leads`);
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
  migrateLeadScores();
}

module.exports = { migrateLeadScores };

