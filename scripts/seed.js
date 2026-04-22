const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const seedsDir = path.join(__dirname, '..', 'seeds');

const runSeeds = async () => {
  if (!fs.existsSync(seedsDir)) {
    // eslint-disable-next-line no-console
    console.log('No seeds directory found');
    return;
  }

  const files = fs.readdirSync(seedsDir)
    .filter(name => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sqlPath = path.join(seedsDir, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    if (!sql.trim()) {
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(`Running seed: ${file}`);
    await db.raw(sql);
  }

  await db.destroy();
};

runSeeds()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Seeds completed');
    process.exit(0);
  })
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error('Seed failed', error);
    process.exit(1);
  });
