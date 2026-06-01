const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const config = require('./config');
const dexRegistry = require('./dexRegistry');
const priceEngine = require('./priceEngine');
const calculator = require('./calculator');
const reasoningEngine = require('./reasoningEngine');
const simulator = require('./simulator');
const broadcaster = require('./broadcaster');
const agentRegistry = require('./agentRegistry');
const bridgeService = require('./bridgeService');
const executor = require('./executor');
const walletManager = require('./walletManager');
const db = require('./db');

const app = express();

// Allow requests from the Vite dev server during development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());


const server = http.createServer(app);
broadcaster.init(server);

// Start scanning loop
async function scanLoop() {
  console.log("Starting scan cycle...");
  try {
    const prices = await priceEngine.scanPrices();
    broadcaster.broadcast('prices_updated', prices);

    const opportunities = calculator.findOpportunities(prices);

    // Deduplicate: only the best profitable opportunity per pair per cycle
    const seen = new Set();
    const toProcess = [];
    for (const opp of opportunities) {
      if (!opp.isProfitable) continue;
      const key = `${opp.pair}-${opp.buyDex}-${opp.sellDex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      toProcess.push(opp);
    }

    for (const opp of toProcess) {
      // 1. Simulate
      const simResult = await simulator.simulateArbitrage(opp);

      // 2. Generate AI reasoning
      const reasoning = await reasoningEngine.generateReasoning(simResult);
      const finalOpp = { ...simResult, reasoning: reasoning.text };

      console.log(`[Agent] Profitable: ${opp.pair} | Net: ${opp.netSpreadPercent}% | Decision: EXECUTE`);
      broadcaster.broadcast('opportunity_found', finalOpp);

      if (!reasoning.isLlm) {
        console.warn(`[Agent] LLM reasoning failed. Skipping autonomous execution. Error: ${reasoning.text}`);
        continue;
      }

      // 3. Autonomous execution via Circle Developer-Controlled Wallets
      const walletAddress = config.settings.agent.ownerAddress;
      if (walletAddress && walletManager.enabled) {
        try {
          broadcaster.broadcast('execution_started', { pair: opp.pair, buyDex: opp.buyDex, sellDex: opp.sellDex });
          const { leg1Hash, leg2Hash } = await executor.executeArbitrage(opp);

          console.log(`[Agent] ✓ Arbitrage executed! Leg1: ${leg1Hash} | Leg2: ${leg2Hash}`);

          // 4. Record reputation on-chain
          const repTxHash = await agentRegistry.recordSuccess(reasoning.text, opp);

          broadcaster.broadcast('execution_success', {
            pair: opp.pair,
            leg1Hash,
            leg2Hash,
            netSpreadPercent: opp.netSpreadPercent,
            reasoning: reasoning.text,
            explorerBase: config.network.explorer
          });
        } catch (execErr) {
          console.error(`[Agent] Execution failed: ${execErr.message}`);
          broadcaster.broadcast('execution_failed', { pair: opp.pair, error: execErr.message });
        }
      } else {
        console.warn("[Agent] No Circle wallet configured — opportunity found but skipping autonomous execution.");
      }
    }

    // Broadcast all non-profitable opportunities for UI monitoring
    const allOpps = opportunities.filter(o => !o.isProfitable);
    if (allOpps.length > 0) {
      broadcaster.broadcast('opportunities_update', allOpps);
    }

    // Track best EURC/USDC prices
    const eurcOpp = opportunities.find(o => o.pair === 'EURC/USDC');
    if (eurcOpp) {
      db.insertPrice('EURC/USDC', Number(eurcOpp.buyPrice), Number(eurcOpp.sellPrice));
    }

  } catch (err) {
    console.error("Error in scan loop:", err);
  }

  setTimeout(scanLoop, config.settings.pollIntervalMs);
}


// Endpoint to manually trigger reputation recording (called by frontend after successful tx)
app.post('/api/record-success', async (req, res) => {
  const { reasoningText } = req.body;
  if (!reasoningText) return res.status(400).json({ error: "Missing reasoning text" });
  
  const txHash = await agentRegistry.recordSuccess(reasoningText);
  res.json({ success: true, txHash });
});

// Endpoint to fetch price history
app.get('/api/prices/history', async (req, res) => {
  try {
    const pair = req.query.pair || 'EURC/USDC';
    const history = await db.getHistory(pair);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to fetch current config
app.get('/api/config', (req, res) => {
  res.json(config);
});

// Endpoint to update default trade amount
app.post('/api/config/trade-amount', (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    
    // Update memory
    config.settings.defaultAmountIn = amount.toString();
    
    // Persist to disk
    const configPath = path.join(__dirname, '..', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    res.json({ success: true, amount: config.settings.defaultAmountIn });
  } catch (err) {
    console.error("Error saving trade amount:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to initiate a Circle CCTP bridge (called by BridgeButton)
app.post('/api/bridge', async (req, res) => {
  try {
    const { amount, destinationDomain } = req.body;
    if (!amount) return res.status(400).json({ error: 'Missing amount' });

    // Use the agent wallet address as the mint recipient on Arc
    const recipientAddress = process.env.AGENT_ADDRESS || config.settings.agent.ownerAddress;
    if (!recipientAddress) {
      return res.status(400).json({ error: 'AGENT_ADDRESS not set in .env and agent owner address not configured.' });
    }

    const burnTxHash = await bridgeService.bridge(amount, recipientAddress);
    res.json({ success: true, burnTxHash });
  } catch (err) {
    console.error('[/api/bridge]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to build swap calldata (called by ExecuteButton before wallet signing)
app.post('/api/build-execute', async (req, res) => {
  try {
    const { opportunity } = req.body;
    if (!opportunity) return res.status(400).json({ error: 'Missing opportunity' });

    const calldata = await executor.buildSwapCalldata(opportunity);
    res.json({ success: true, calldata });
  } catch (err) {
    console.error('[/api/build-execute]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Circle Developer-Controlled Wallet creation
app.post('/api/wallets/create', async (req, res) => {
  try {
    const wallet = await walletManager.createWallet();
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Setup Wizard Endpoints ---

// Check if agent is registered
app.get('/api/setup/status', (req, res) => {
  const isRegistered = !!config.settings.agent.id;
  res.json({
    isRegistered,
    agentId: config.settings.agent.id,
    ownerAddress: config.settings.agent.ownerAddress,
    validatorAddress: config.settings.agent.validatorAddress,
    identityRegistry: config.settings.agent.identityRegistry,
  });
});

// Generate Master Wallets
app.post('/api/setup/generate-wallets', async (req, res) => {
  try {
    const wallets = await walletManager.generateMasterWallets();
    res.json({ success: true, wallets });
  } catch (err) {
    console.error('[/api/setup/generate-wallets]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Register Global Agent
app.post('/api/setup/register-agent', async (req, res) => {
  try {
    const { ownerWalletAddress } = req.body;
    if (!ownerWalletAddress) return res.status(400).json({ error: 'Missing ownerWalletAddress' });

    const metadataUri = config.settings.agent.metadataURI;
    const result = await walletManager.registerGlobalAgent(ownerWalletAddress, metadataUri);
    
    // Persist to memory
    config.settings.agent.id = result.agentId;
    config.settings.agent.ownerAddress = ownerWalletAddress;

    // Persist to disk so server restarts don't lose this
    const configPath = path.join(__dirname, '..', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Agent ${result.agentId} persisted to config.json ✓`);
    
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[/api/setup/register-agent]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Lookup a wallet by Circle walletId (used to restore session on new device)
app.get('/api/wallets/:walletId', async (req, res) => {
  try {
    const wallet = await walletManager.getWalletById(req.params.walletId);
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch USDC Balance on Arc Testnet
app.get('/api/wallet/:address/balance', async (req, res) => {
  try {
    const { address } = req.params;
    const provider = new ethers.JsonRpcProvider(config.env.ARC_RPC_URL);
    const erc20Abi = ["function balanceOf(address owner) view returns (uint256)"];

    const usdcContract = new ethers.Contract(config.tokens.USDC.address, erc20Abi, provider);
    const eurcContract = new ethers.Contract(config.tokens.EURC.address, erc20Abi, provider);

    const [usdcWei, eurcWei] = await Promise.all([
      usdcContract.balanceOf(address),
      eurcContract.balanceOf(address)
    ]);

    res.json({
      balance: ethers.formatUnits(usdcWei, config.tokens.USDC.decimals),
      eurcBalance: ethers.formatUnits(eurcWei, config.tokens.EURC.decimals)
    });
  } catch (err) {
    console.error('[/api/wallet/balance]', err.message);
    res.status(500).json({ error: err.message });
  }
});


// Auto-Bridge Endpoint
app.post('/api/bridge/auto', async (req, res) => {
  try {
    const { sourceChain, amount, walletAddress } = req.body;
    
    if (!sourceChain || !amount || !walletAddress) {
      return res.status(400).json({ error: 'Missing sourceChain, amount, or walletAddress' });
    }

    const result = await walletManager.bridgeToArc(sourceChain, amount, walletAddress);
    
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[/api/bridge/auto]', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SpreadHunter Backend running on port ${PORT}`);
  // Give provider a moment to connect before starting
  setTimeout(scanLoop, 2000);
});
