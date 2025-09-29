// data/store.js (CommonJS)
const path = require('path');
const fs = require('fs').promises;

const dataDir = path.join(__dirname);
const files = {
  farmers: path.join(dataDir, 'farmers.json'),
  milk: path.join(dataDir, 'milk.json'),
  advances: path.join(dataDir, 'advances.json'),
  users: path.join(dataDir, 'users.json'),
};

async function ensure() {
  // Ensure data files exist
  for (const file of Object.values(files)) {
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, '[]', 'utf8');
    }
  }
}

async function read(collection) {
  await ensure();
  const file = files[collection];
  const text = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(text || '[]');  // ✅ define parsed
  console.log(`📖 Read ${parsed.length} records from ${file}`);
  return parsed;
}

async function write(collection, data) {
  await ensure();
  const file = files[collection];
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
   // ✅ Debug log
  console.log(`📝 Saved ${data.length} records to ${file}`);

}

module.exports = { read, write };