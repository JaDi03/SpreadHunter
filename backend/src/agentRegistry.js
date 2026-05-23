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
  async recordSuccess(reasoningText) {
    const agentId = this._getAgentId();
    const walletAddress = config.settings.agent.ownerAddress;

    if (!walletManager.enabled || !walletAddress) {
      console.warn('[AgentRegistry] Skipping reputation log: Circle SDK not configured or walletAddress missing');
      return null;
    }
    if (!agentId) {
      console.warn('[AgentRegistry] Skipping reputation log: agentId not set');
      return null;
    }

    try {
      const tag = 'successful_arbitrage';
      // Anchor the LLM reasoning on-chain as a keccak256 hash
      const feedbackHash = keccak256(toHex(reasoningText));
      const score = 100; // Max score for a confirmed successful execution

      console.log(`[AgentRegistry] Submitting reputation feedback for Agent ${agentId}…`);

      const txHash = await walletManager.executeContractCall({
        walletAddress,
        contractAddress: this.reputationAddress,
        abiFunctionSignature: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
        abiParameters: [
          agentId.toString(),
          score.toString(),
          "0",            // weight
          tag,
          "",           // reviewURI
          "",           // credentialsURI
          "",           // encryptedData
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
