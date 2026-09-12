import { ensureTable } from './table';

// CLI entry: `bun run local/setup.ts` (part of `bun run dev`). Bun loads .env.local.
const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is not set (see .env.example)');
const result = await ensureTable(tableName);
console.log(`[setup] table ${tableName}: ${result}`);
