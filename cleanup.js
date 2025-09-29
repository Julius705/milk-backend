// cleanup.js
/*const { read, write } = require("./data/store");

async function cleanup() {
  try {
    let farmers = await read("farmers");
    let users = await read("users");

    const beforeFarmers = farmers.length;
    const beforeUsers = users.length;

    // Keep only active farmers
    const activeIds = farmers.filter(f => f.isActive !== false).map(f => f.id);
    farmers = farmers.filter(f => f.isActive !== false);

    // Keep only users linked to active farmers
    users = users.filter(u => activeIds.includes(u.farmerId));

    await write("farmers", farmers);
    await write("users", users);

    console.log("✅ Cleanup completed!");
    console.log(`Removed farmers: ${beforeFarmers - farmers.length}`);
    console.log(`Removed users: ${beforeUsers - users.length}`);
    console.log(`Remaining farmers: ${farmers.length}`);
    console.log(`Remaining users: ${users.length}`);
  } catch (err) {
    console.error("❌ Error during cleanup:", err);
  }
}

cleanup();

 cons key

cons Sec

*/
