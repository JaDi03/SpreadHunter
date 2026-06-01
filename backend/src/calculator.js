const { ethers } = require('ethers');
const config = require('./config');

class Calculator {
  /**
   * Deterministically analyze prices to find arbitrage opportunities
   */
  findOpportunities(prices) {
    const opportunities = [];
    const minProfitBps = config.settings.profitThresholdBps;

    for (const [pairName, feeTiers] of Object.entries(prices)) {
      // Flatten all available pools for this pair
      const allPools = [];
      for (const [feeTier, dexPrices] of Object.entries(feeTiers)) {
        for (const [dexName, data] of Object.entries(dexPrices)) {
          allPools.push({ dexName, feeTier: Number(feeTier), ...data });
        }
      }

      // Need at least 2 pools to arbitrage
      if (allPools.length < 2) continue;

      // Compare every pool against every other pool
      for (let i = 0; i < allPools.length; i++) {
        for (let j = i + 1; j < allPools.length; j++) {
          const poolA = allPools[i];
          const poolB = allPools[j];

          // Skip comparing the exact same DEX unless it's a different fee tier, 
          // but typically we want cross-DEX arbitrage
          if (poolA.dexName === poolB.dexName) continue;

          let buyDex, sellDex, buyPrice, sellPrice, buyFee, sellFee;

          if (poolA.price < poolB.price) {
            buyDex = poolA.dexName;
            sellDex = poolB.dexName;
            buyPrice = poolA.price;
            sellPrice = poolB.price;
            buyFee = poolA.feeTier;
            sellFee = poolB.feeTier;
          } else {
            buyDex = poolB.dexName;
            sellDex = poolA.dexName;
            buyPrice = poolB.price;
            sellPrice = poolA.price;
            buyFee = poolB.feeTier;
            sellFee = poolA.feeTier;
          }

          // Raw spread calculation (difference in percentage)
          const rawSpreadPercent = ((sellPrice - buyPrice) / buyPrice) * 100;
          const rawSpreadBps = rawSpreadPercent * 100;
          
          // Fee estimation: We pay the fee tier on both DEXes.
          // Note: XyloNet uses feeTier=0 in our config conceptually, or it uses the feeTier loop
          // But actually XyloNet is V2 and has a fixed 0.3% (30 bps) fee. Let's use the max of feeTier or 30 for V2.
          const actualBuyFee = buyDex === 'XyloNet' ? 3000 : buyFee;
          const actualSellFee = sellDex === 'XyloNet' ? 3000 : sellFee;

          const feePercent = (actualBuyFee + actualSellFee) / 10000;
          const netSpreadPercent = rawSpreadPercent - feePercent;
          const netSpreadBps = rawSpreadBps - (actualBuyFee + actualSellFee);

          // If the spread covers fees and threshold, it's an opportunity
          const isProfitable = netSpreadBps > minProfitBps;

          // Always push so the UI can show the active pair monitoring
          opportunities.push({
            pair: pairName,
            feeTier: buyFee, // We'll keep one for backwards compatibility or executor
            buyDex,
            sellDex,
            buyPrice,
            sellPrice,
            rawSpreadPercent: Number(rawSpreadPercent.toFixed(4)),
            feePercent: Number(feePercent.toFixed(4)),
            netSpreadPercent: Number(netSpreadPercent.toFixed(4)),
            isProfitable,
            timestamp: Date.now()
          });
        }
      }
    }

    return opportunities;
  }
}

module.exports = new Calculator();
