const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'TU_SUPABASE_URL_AQUI') {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const dbPath = path.join(__dirname, '..', 'prices_db.json');

async function insertPrice(pair, buyPrice, sellPrice) {
  // Always log locally to ensure fallback data is captured
  try {
    let history = [];
    if (fs.existsSync(dbPath)) {
      try {
        const raw = fs.readFileSync(dbPath, 'utf8');
        history = JSON.parse(raw);
      } catch (e) {
        history = [];
      }
    }
    history.push({
      timestamp: Date.now(),
      pair,
      buyPrice,
      sellPrice
    });
    // Keep last 500 entries to prevent files from growing too large
    if (history.length > 500) {
      history = history.slice(-500);
    }
    fs.writeFileSync(dbPath, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Error writing local price database:', err.message);
  }

  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('price_history')
      .insert([
        {
          xylo_price: buyPrice,
          syntra_price: sellPrice
          // created_at is automatically set by Supabase
        }
      ]);
    if (error) throw error;
  } catch (err) {
    console.error('Error writing to Supabase:', err.message);
  }
}

async function getHistory(pair, limit = 100) {
  if (!supabase) {
    try {
      if (fs.existsSync(dbPath)) {
        const raw = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(raw);
        return data.slice(-limit);
      }
    } catch (err) {
      console.error('Error reading local price database:', err.message);
    }
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    // Map back to the expected UI format (reverse so oldest is first for the graph)
    const formatted = data.map(row => ({
      timestamp: new Date(row.created_at).getTime(),
      pair: 'EURC/USDC', // Default pair since it's not in the DB
      buyPrice: row.xylo_price,
      sellPrice: row.syntra_price
    })).reverse();
    
    return formatted;
  } catch (err) {
    console.error('Error fetching from Supabase:', err.message);
    // fallback to local on failure
    try {
      if (fs.existsSync(dbPath)) {
        const raw = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(raw).slice(-limit);
      }
    } catch (_) {}
    return [];
  }
}

module.exports = {
  insertPrice,
  getHistory
};

