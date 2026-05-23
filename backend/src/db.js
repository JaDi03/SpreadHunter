const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prices_db.json');

// Initialize DB file if not exists
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([]));
  console.log('Created local JSON database for prices.');
}

function insertPrice(pair, buyPrice, sellPrice) {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(raw);
    
    data.push({
      timestamp: Date.now(),
      pair,
      buyPrice,
      sellPrice
    });
    
    // Keep only last 1000 records to prevent memory bloat
    if (data.length > 1000) {
      data.shift();
    }
    
    fs.writeFileSync(dbPath, JSON.stringify(data));
  } catch (err) {
    console.error('Error writing to JSON db', err.message);
  }
}

function getHistory(pair, limit = 100) {
  return new Promise((resolve, reject) => {
    try {
      const raw = fs.readFileSync(dbPath, 'utf8');
      const data = JSON.parse(raw);
      const filtered = data.filter(d => d.pair === pair);
      const sliced = filtered.slice(-limit); // get last `limit` elements
      resolve(sliced);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  insertPrice,
  getHistory
};
