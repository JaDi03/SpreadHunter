const fs = require('fs');
const path = require('path');
require('dotenv').config();

const configPath = path.join(__dirname, '..', 'config.json');
let config;

try {
  const rawData = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(rawData);
} catch (error) {
  console.error('Error reading config.json:', error);
  process.exit(1);
}

// Merge with environment variables
config.env = {
  ARC_RPC_URL: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network/',
  LLM_API_KEY: process.env.LLM_API_KEY || process.env.CLAUDE_API_KEY,
  CIRCLE_API_KEY: process.env.CIRCLE_API_KEY,
  CIRCLE_ENTITY_SECRET: process.env.CIRCLE_ENTITY_SECRET,
};

module.exports = config;
