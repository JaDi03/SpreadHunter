const { ethers } = require('ethers');
const dexRegistry = require('./dexRegistry');
const config = require('./config');
const walletManager = require('./walletManager');

class Executor {
  /**
   * Builds swap calldata for one leg of an arbitrage.
   * (Used by /api/build-execute for frontend-signing flow if needed)
   */
  buildSwapCalldata(opportunity, recipientAddress) {
    const buyDex = dexRegistry.getDex(opportunity.buyDex);
    const recipient = recipientAddress || config.settings.agent.ownerAddress || ethers.ZeroAddress;
    const [tokenOutSymbol, tokenInSymbol] = opportunity.pair.split('/');
    const tokenIn = dexRegistry.tokens[tokenInSymbol];
    const tokenOut = dexRegistry.tokens[tokenOutSymbol];

    const amountInStr = config.settings.defaultAmountIn || '1000000';
    const amountIn = ethers.parseUnits(amountInStr, tokenIn.decimals);

    // We only need this for the frontend preview endpoint, returning dummy data if we migrate fully to backend.
    return { to: buyDex.contracts.routerAddress, data: '0x', value: '0x0', amountIn: amountIn.toString() };
  }

  /**
   * Autonomous execution using Circle Developer-Controlled Wallets
   */
  async executeArbitrage(opportunity) {
    const walletAddress = config.settings.agent.ownerAddress;
    if (!walletAddress || !walletManager.enabled) {
      throw new Error("No agent owner address or Circle SDK not configured.");
    }

    const [tokenOutSymbol, tokenInSymbol] = opportunity.pair.split('/');
    const tokenIn = dexRegistry.tokens[tokenInSymbol];   // USDC
    const tokenOut = dexRegistry.tokens[tokenOutSymbol]; // EURC
    const amountInStr = config.settings.defaultAmountIn || '1000000';
    let amountIn = ethers.parseUnits(amountInStr, tokenIn.decimals);

    const buyDex = dexRegistry.getDex(opportunity.buyDex);
    const sellDex = dexRegistry.getDex(opportunity.sellDex);

    console.log(`[Executor] Executing arbitrage via Circle Wallet: BUY ${tokenIn.symbol} on ${opportunity.buyDex}, SELL on ${opportunity.sellDex}`);

    // Check actual USDC balance
    const provider = new ethers.JsonRpcProvider(config.env.ARC_RPC_URL);
    const erc20Abi = ["function balanceOf(address owner) view returns (uint256)"];
    const usdcContract = new ethers.Contract(tokenIn.address, erc20Abi, provider);
    const eurcContract = new ethers.Contract(tokenOut.address, erc20Abi, provider);

    const initialUsdc = await usdcContract.balanceOf(walletAddress);
    if (initialUsdc < amountIn) {
      console.log(`[Executor] Insufficient ${tokenIn.symbol}. Have ${initialUsdc.toString()}, need ${amountIn.toString()}. Adjusting amountIn to available balance.`);
      amountIn = initialUsdc;
      if (amountIn <= 0n) throw new Error(`Not enough ${tokenIn.symbol} to start arbitrage.`);
    }

    // ─── LEG 1: Buy tokenOut on buyDex ───────────────────────────────────────
    // Approve Leg 1 (Permit2 flow for UniversalRouter, or direct ERC-20 approve)
    await this._ensureApproval(buyDex, tokenIn.address, amountIn, walletAddress);

    // Swap Leg 1
    const leg1 = this._getCirclePayload(buyDex, tokenIn, tokenOut, opportunity.feeTier, amountIn.toString(), "0", walletAddress);
    const tx1Hash = await walletManager.executeContractCall({
      walletAddress,
      contractAddress: leg1.contractAddress,
      abiFunctionSignature: leg1.abiFunctionSignature,
      abiParameters: leg1.abiParameters
    });
    console.log(`[Executor] Leg 1 confirmed ✓ (${tx1Hash})`);

    // ─── LEG 2: Sell tokenOut on sellDex ─────────────────────────────────────
    // Query exact tokenOut (EURC) balance received
    const actualOut = await eurcContract.balanceOf(walletAddress);
    console.log(`[Executor] Exact ${tokenOut.symbol} balance for Leg 2: ${actualOut.toString()}`);

    if (actualOut <= 0n) {
      throw new Error(`[Executor] Failed to receive any ${tokenOut.symbol} from Leg 1.`);
    }

    // 1. Approve Leg 2 (Permit2 flow for UniversalRouter, or direct ERC-20 approve)
    await this._ensureApproval(sellDex, tokenOut.address, actualOut, walletAddress);

    // 2. Swap Leg 2
    const leg2 = this._getCirclePayload(sellDex, tokenOut, tokenIn, opportunity.feeTier, actualOut.toString(), "0", walletAddress);
    const tx2Hash = await walletManager.executeContractCall({
      walletAddress,
      contractAddress: leg2.contractAddress,
      abiFunctionSignature: leg2.abiFunctionSignature,
      abiParameters: leg2.abiParameters
    });
    console.log(`[Executor] Leg 2 confirmed ✓ (${tx2Hash})`);

    return { leg1Hash: tx1Hash, leg2Hash: tx2Hash };
  }

  async _ensureApproval(dex, tokenAddress, amount, walletAddress) {
    if (dex.routerType === 'UniversalRouter') {
      // UniversalRouter uses Permit2 — approve Permit2 then set Permit2 allowance
      const permit2Address = dex.contracts.permit2Address;
      const routerAddress = dex.contracts.routerAddress;

      // Step 1: approve ERC-20 to Permit2
      console.log(`[Executor] Approving ${tokenAddress} → Permit2 (${permit2Address})...`);
      await walletManager.executeContractCall({
        walletAddress,
        contractAddress: tokenAddress,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [permit2Address, ethers.MaxUint256.toString()]
      });

      // Step 2: set Permit2 allowance for UniversalRouter (48-bit expiry far in future)
      const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
      console.log(`[Executor] Setting Permit2 allowance for UniversalRouter...`);
      await walletManager.executeContractCall({
        walletAddress,
        contractAddress: permit2Address,
        abiFunctionSignature: "approve(address,address,uint160,uint48)",
        abiParameters: [tokenAddress, routerAddress, amount.toString(), expiration.toString()]
      });
    } else {
      // Standard ERC-20 approve directly to router
      console.log(`[Executor] Approving ${tokenAddress} → ${dex.contracts.routerAddress}...`);
      await walletManager.executeContractCall({
        walletAddress,
        contractAddress: tokenAddress,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [dex.contracts.routerAddress, ethers.MaxUint256.toString()]
      });
    }
    console.log(`[Executor] Approval confirmed ✓`);
  }

  _getCirclePayload(dex, tokenIn, tokenOut, feeTier, amountIn, amountOutMin, recipient) {
    if (dex.routerType === 'StableSwapRouter' || dex.type === 'UniswapV2') {
      return {
        contractAddress: dex.contracts.routerAddress,
        abiFunctionSignature: "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
        abiParameters: [
          amountIn.toString(),
          amountOutMin.toString(),
          [tokenIn.address, tokenOut.address],
          recipient,
          (Math.floor(Date.now() / 1000) + 300).toString()
        ]
      };
    }

    if (dex.routerType === 'SwapRouter02') {
      return {
        contractAddress: dex.contracts.routerAddress,
        abiFunctionSignature: "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))",
        abiParameters: [[
          tokenIn.address,
          tokenOut.address,
          feeTier.toString(),
          recipient,
          amountIn.toString(),
          amountOutMin.toString(),
          "0"
        ]]
      };
    }

    // UniversalRouter (Synthra) — V3_SWAP_EXACT_IN with Permit2 (payerIsUser=true)
    const path = ethers.solidityPacked(
      ["address", "uint24", "address"],
      [tokenIn.address, feeTier, tokenOut.address]
    );
    const inputs = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256", "bytes", "bool"],
      [recipient, BigInt(amountIn), BigInt(amountOutMin), path, true]
    );

    return {
      contractAddress: dex.contracts.routerAddress,
      abiFunctionSignature: "execute(bytes,bytes[],uint256)",
      abiParameters: [
        "0x00",   // V3_SWAP_EXACT_IN command
        [inputs],
        (Math.floor(Date.now() / 1000) + 600).toString()
      ]
    };
  }
}

module.exports = new Executor();

