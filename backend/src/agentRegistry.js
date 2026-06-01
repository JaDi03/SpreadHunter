const { keccak256, toHex } = require('viem');
const config = require('./config');
const walletManager = require('./walletManager');

class AgentRegistry {
  constructor() {
    this.reputationAddress = config.settings.agent.reputationRegistry;
  }

  /**
   * Returns the current agentId from config.json.
   * config.json is re-read via the live object — if registerAgent.mjs has written
   * the ID since startup, it will be reflected without a server restart.
   */
  _getAgentId() {
    try {
      const fs = require('fs');
      const path = require('path');
      const raw = fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8');
      return JSON.parse(raw).settings?.agent?.id || null;
    } catch {
      return config.settings?.agent?.id || null;
    }
  }


  /**
   * Records successful arbitrage feedback into the ERC-8004 Reputation Registry.
   * Uses Circle Developer-Controlled Wallets for signing and broadcasting.
   */
  async recordSuccess(reasoningText, opp = {}) {
    if (process.env.DEMO_MODE === 'true') {
      console.log(`[AgentRegistry] DEMO MODE: Mocking reputation feedback...`);
      return '0x' + Array(64).fill(0).map(()=>Math.floor(Math.random()*16).toString(16)).join('');
    }

    const agentId = this._getAgentId();
    const walletAddress = config.settings.agent.validatorAddress;

    if (!walletManager.enabled || !walletAddress) {
      console.warn('[AgentRegistry] Skipping reputation log: Circle SDK not configured or walletAddress missing');
      return null;
    }
    if (!agentId) {
      console.warn('[AgentRegistry] Skipping reputation log: agentId not set');
      return null;
    }

    try {
      const tag1 = 'successful_arbitrage';
      const tag2 = opp.pair
        ? `${opp.pair} | buy:${opp.buyDex} sell:${opp.sellDex} | net:${Number(opp.netSpreadPercent).toFixed(4)}%`
        : '';
      const endpoint = opp.buyDex && opp.sellDex ? `${opp.buyDex}->${opp.sellDex}` : '';
      const explorerBase = config.network?.explorer || 'https://testnet.arcscan.app';
      const feedbackURI = `${explorerBase}/token/${config.settings.agent.identityRegistry}/instance/${agentId}`;

      const feedbackHash = keccak256(toHex(reasoningText));
      const score = 100;

      console.log(`[AgentRegistry] Submitting reputation feedback for Agent ${agentId}…`);
      console.log(`  tag2      : ${tag2}`);
      console.log(`  endpoint  : ${endpoint}`);
      console.log(`  feedbackURI: ${feedbackURI}`);

      const txHash = await walletManager.executeContractCall({
        walletAddress,
        contractAddress: this.reputationAddress,
        abiFunctionSignature: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
        abiParameters: [
          agentId.toString(),
          score.toString(),
          "0",
          tag1,
          tag2,
          endpoint,
          feedbackURI,
          feedbackHash
        ]
      });

      console.log(`[AgentRegistry] Reputation recorded! Tx: https://testnet.arcscan.app/tx/${txHash}`);
      return txHash;

    } catch (error) {
      console.error('[AgentRegistry] Failed to record reputation:', error.message);
      return null;
    }
  }
}

module.exports = new AgentRegistry();
