const { ethers } = require('ethers');
const config = require('./config');

// Generic V3 DEX interfaces — implemented by UnitFlow and Synthra on Arc Testnet
const factoryAbi   = require('../abi/IV3Factory.json');
const quoterV1Abi  = require('../abi/IQuoterV1.json');
const quoterV2Abi  = require('../abi/IQuoterV2.json');
const poolAbi      = require('../abi/IV3Pool.json');
const erc20Abi     = require('../abi/IERC20.json');

class DexRegistry {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.env.ARC_RPC_URL);
    this.dexes = {};
    this.tokens = {};
    this.pairs = [];
    
    this.init();
  }

  init() {
    // Load enabled DEXes from config
    for (const dexConf of config.dexes) {
      if (!dexConf.enabled) continue;
      
      let factoryContract;
      if (dexConf.type === 'StableSwap') {
        factoryContract = new ethers.Contract(
          dexConf.contracts.factory, 
          ["function getPool(address,address) view returns (address)"], 
          this.provider
        );
      } else {
        factoryContract = new ethers.Contract(dexConf.contracts.factory, factoryAbi, this.provider);
      }

      this.dexes[dexConf.name] = {
        name: dexConf.name,
        type: dexConf.type,
        routerType: dexConf.routerType,
        contracts: {
          factory: factoryContract,
          // We can use the appropriate ABI depending on Quoter version. 
          // For now, let's store the address and we instantiate when quoting
          quoterAddress: dexConf.contracts.quoter,
          routerAddress: dexConf.contracts.router,
          permit2Address: dexConf.contracts.permit2
        }
      };
    }

    // Load tokens
    for (const [symbol, tokenConf] of Object.entries(config.tokens)) {
      this.tokens[symbol] = {
        symbol: symbol,
        address: tokenConf.address,
        decimals: tokenConf.decimals,
        contract: new ethers.Contract(tokenConf.address, erc20Abi, this.provider)
      };
    }

    // Load pairs
    for (const pairConf of config.pairs) {
      this.pairs.push({
        name: pairConf.name,
        tokenA: this.tokens[pairConf.tokenA],
        tokenB: this.tokens[pairConf.tokenB],
        feeTiers: pairConf.feeTiers
      });
    }
  }

  getDex(name) {
    return this.dexes[name];
  }

  getAllDexes() {
    return Object.values(this.dexes);
  }

  getPairs() {
    return this.pairs;
  }
}

module.exports = new DexRegistry();
