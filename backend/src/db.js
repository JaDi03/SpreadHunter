const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'TU_SUPABASE_URL_AQUI') {
  supabase = createClient(supabaseUrl, supabaseKey);
}

async function insertPrice(pair, buyPrice, sellPrice) {
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
  if (!supabase) return [];
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
    return [];
  }
}

module.exports = {
  insertPrice,
  getHistory
};
