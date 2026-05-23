const { ethers } = require('ethers');
const config = require('./config');
const dexRegistry = require('./dexRegistry');
// IV3Pool — generic V3 pool interface implemented by UnitFlow and Synthra
const poolAbi = require('../abi/IV3Pool.json');

class PriceEngine {
  constructor() {
    this.provider = dexRegistry.provider;
  }

  /**
   * Fetch slot0 data for all DEXes and all Pairs
   */
  async scanPrices() {
    const prices = {};
    const pairs = dexRegistry.getPairs();
    const dexes = dexRegistry.getAllDexes();

    for (const pair of pairs) {
      prices[pair.name] = {};
      
      for (const feeTier of pair.feeTiers) {
        prices[pair.name][feeTier] = {};

        for (const dex of dexes) {
          try {
            if (dex.type === 'UniswapV2' || dex.type === 'StableSwap') {
              // The XyloNet documentation was incorrect; it uses standard UniswapV2 getAmountsOut
              const dexConfig = config.dexes.find(d => d.name === dex.name);
              const poolAddress = dexConfig.pools ? dexConfig.pools[pair.name] : null;
              if (!poolAddress) continue;

              const routerAbi = [
                "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)"
              ];
              const routerContract = new ethers.Contract(dex.contracts.routerAddress, routerAbi, this.provider);
              
              const amountIn = ethers.parseUnits("1", pair.tokenA.decimals);
              
              const amountsOut = await routerContract.getAmountsOut(
                amountIn,
                [pair.tokenA.address, pair.tokenB.address]
              );
              
              const price = Number(ethers.formatUnits(amountsOut[1], pair.tokenB.decimals));
              
              prices[pair.name][feeTier][dex.name] = {
                poolAddress,
                price: price,
                rawSqrtPriceX96: "0" // Not used for V2
              };
              continue;
            }

            // UniswapV3 Logic — use Quoter.staticCall (not slot0, which gives garbage for empty pools)
            const factory = dex.contracts.factory;
            const poolAddress = await factory.getPool(pair.tokenA.address, pair.tokenB.address, feeTier);

            if (poolAddress === ethers.ZeroAddress) {
              continue; // Pool doesn't exist on this DEX/fee combo
            }

            const quoterAddress = dex.contracts.quoterAddress;
            let price;
            let sourceStr;
            
            if (quoterAddress) {
              const quoterAbi = [
                "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
              ];
              const quoterContract = new ethers.Contract(quoterAddress, quoterAbi, this.provider);
              
              const amountIn = ethers.parseUnits("1", pair.tokenA.decimals);

              let amountOut;
              try {
                amountOut = await quoterContract.quoteExactInputSingle.staticCall(
                  pair.tokenA.address,
                  pair.tokenB.address,
                  feeTier,
                  amountIn,
                  0
                );
              } catch (quoterErr) {
                // Pool exists but no liquidity — skip silently
                console.log(`[PriceEngine] ${dex.name} ${pair.name} fee=${feeTier}: no liquidity, skipping`);
                continue;
              }

              price = Number(ethers.formatUnits(amountOut, pair.tokenB.decimals));
              sourceStr = 'V3-Quoter';
            } else {
              // Fallback to slot0 if no Quoter provided
              const poolContract = new ethers.Contract(poolAddress, poolAbi, this.provider);
              const slot0 = await poolContract.slot0();
              
              if (slot0.sqrtPriceX96 === 0n) {
                console.log(`[PriceEngine] ${dex.name} ${pair.name} fee=${feeTier}: empty slot0, skipping`);
                continue; 
              }
              
              const isTokenA0 = BigInt(pair.tokenA.address.toLowerCase()) < BigInt(pair.tokenB.address.toLowerCase());
              price = this.calculatePriceFromSqrtPriceX96(slot0.sqrtPriceX96, pair.tokenA.decimals, pair.tokenB.decimals, isTokenA0);
              sourceStr = 'V3-Slot0';
            }
            
            prices[pair.name][feeTier][dex.name] = {
              poolAddress,
              price: price,
              source: sourceStr
            };
            
          } catch (error) {
            console.error(`Error scanning ${dex.name} for ${pair.name} (${feeTier}):`, error.message);
          }
        }
      }
    }
    
    return prices;
  }

  calculatePriceFromSqrtPriceX96(sqrtPriceX96, decimals0, decimals1, isTokenA0) {
    const numerator = sqrtPriceX96 ** 2n;
    const denominator = 2n ** 192n;
    
    // price = (sqrtPriceX96^2 / 2^192) * 10^(decimals0 - decimals1)
    // To handle decimals accurately without losing precision, we use Number
    const priceRatio = Number(numerator) / Number(denominator);
    const decimalAdjust = 10 ** (decimals0 - decimals1);
    
    const priceToken0PerToken1 = priceRatio * decimalAdjust;
    
    if (isTokenA0) {
      // Return price of tokenA in terms of tokenB
      return priceToken0PerToken1;
    } else {
      // Return price of tokenB in terms of tokenA, so invert it
      return 1 / priceToken0PerToken1;
    }
  }
}

module.exports = new PriceEngine();
