const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const migrationsDir = path.join(__dirname, '..', 'migrations');

const runMigrations = async () => {
  const files = fs.readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sqlPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    if (!sql.trim()) {
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(`Running migration: ${file}`);
    await db.raw(sql);
  }

  await db.destroy();
};

runMigrations()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Migrations completed');
    process.exit(0);
  })
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error('Migration failed', error);
    process.exit(1);
  });
