const fs = require("fs").promises;
const path = require("path");

const dataDir = path.join(__dirname, "../data");

// read JSON
async function read(filename) {
  try {
    const filePath = path.join(dataDir, `${filename}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return [];
  }
}

// write JSON
async function write(filename, content) {
  try {
    const filePath = path.join(dataDir, `${filename}.json`);
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
  }
}

module.exports = { read, write };