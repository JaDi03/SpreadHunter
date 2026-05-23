// bridgeService.js — Circle CCTP cross-chain transfer
// Initiates a USDC burn on the source chain and monitors the Circle Attestation
// API to obtain the signed message needed to mint on Arc Testnet.

const { ethers } = require('ethers');
const config = require('./config');

// Circle CCTP contract addresses (Ethereum Sepolia → Arc Testnet path for testnet)
// Adjust source chain / TokenMessenger address if bridging from a different chain.
const CCTP = {
  // Source chain: Ethereum Sepolia (chainId 11155111)
  sourceRpcUrl: process.env.SOURCE_CHAIN_RPC_URL || 'https://rpc.sepolia.org',
  tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Sepolia TokenMessenger
  usdcSource: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',     // Sepolia USDC

  // Destination: Arc Testnet
  messageTransmitter: process.env.ARC_MESSAGE_TRANSMITTER || '', // Set in .env once available
  destinationDomain: 5, // Circle domain for Arc Testnet (confirm in Circle docs)

  // Circle Attestation REST API
  attestationApi: 'https://iris-api-sandbox.circle.com/attestations',
};

// Minimal ABIs
const TOKEN_MESSENGER_ABI = [
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) returns (uint64 nonce)',
];
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];
const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes message, bytes attestation) returns (bool)',
];

class BridgeService {
  constructor() {
    this.enabled = !!config.env.AGENT_PRIVATE_KEY;
  }

  /**
   * Bridges USDC from source chain to Arc Testnet via Circle CCTP.
   * Returns the burn transaction hash immediately; minting on Arc happens async.
   * @param {string} amountMicro - Amount in USDC micro-units (6 decimals). E.g. "10000000" = 10 USDC
   * @param {string} recipientAddress - Address to receive USDC on Arc Testnet
   */
  async bridge(amountMicro, recipientAddress) {
    if (!this.enabled) {
      throw new Error('AGENT_PRIVATE_KEY not set — cannot sign bridge transaction');
    }

    const pk = config.env.AGENT_PRIVATE_KEY;
    const wallet = new ethers.Wallet(pk, new ethers.JsonRpcProvider(CCTP.sourceRpcUrl));

    const usdc = new ethers.Contract(CCTP.usdcSource, ERC20_ABI, wallet);
    const messenger = new ethers.Contract(CCTP.tokenMessenger, TOKEN_MESSENGER_ABI, wallet);

    // 1. Approve the TokenMessenger to spend USDC
    const currentAllowance = await usdc.allowance(wallet.address, CCTP.tokenMessenger);
    if (currentAllowance < BigInt(amountMicro)) {
      console.log('[Bridge] Approving USDC spend…');
      const approveTx = await usdc.approve(CCTP.tokenMessenger, amountMicro);
      await approveTx.wait();
      console.log('[Bridge] Approved.');
    }

    // 2. depositForBurn — mintRecipient must be bytes32-padded
    const mintRecipient = ethers.zeroPadValue(ethers.getBytes(recipientAddress), 32);

    console.log(`[Bridge] Burning ${amountMicro} USDC on source chain…`);
    const burnTx = await messenger.depositForBurn(
      BigInt(amountMicro),
      CCTP.destinationDomain,
      mintRecipient,
      CCTP.usdcSource,
    );
    const receipt = await burnTx.wait();
    console.log(`[Bridge] Burn tx confirmed: ${burnTx.hash}`);

    // 3. Poll Circle Attestation API for the signed message (async — frontend polls status)
    // We return the burn hash immediately and let the frontend/user know to wait.
    this._pollAndMint(burnTx.hash, receipt).catch((err) =>
      console.error('[Bridge] Mint phase failed:', err.message),
    );

    return burnTx.hash;
  }

  /**
   * Polls Circle's Attestation API until signed, then submits receiveMessage on Arc.
   */
  async _pollAndMint(burnTxHash, receipt) {
    if (!CCTP.messageTransmitter) {
      console.warn('[Bridge] ARC_MESSAGE_TRANSMITTER not set — skipping mint phase');
      return;
    }

    // Extract messageHash from MessageSent event
    const messageSentTopic = ethers.id('MessageSent(bytes)');
    const log = receipt.logs.find((l) => l.topics[0] === messageSentTopic);
    if (!log) {
      console.warn('[Bridge] MessageSent event not found in receipt');
      return;
    }
    const messageBytes = ethers.AbiCoder.defaultAbiCoder().decode(['bytes'], log.data)[0];
    const messageHash = ethers.keccak256(messageBytes);

    console.log(`[Bridge] Waiting for Circle attestation for messageHash ${messageHash}…`);

    // Poll every 10 s, up to 20 times (3.3 min)
    let attestation = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      try {
        const resp = await fetch(`${CCTP.attestationApi}/${messageHash}`);
        const body = await resp.json();
        if (body.status === 'complete') {
          attestation = body.attestation;
          break;
        }
        console.log(`[Bridge] Attestation pending… (attempt ${i + 1})`);
      } catch (_) {
        // ignore transient fetch errors
      }
    }

    if (!attestation) {
      console.error('[Bridge] Timed out waiting for Circle attestation');
      return;
    }

    // Submit receiveMessage on Arc Testnet
    const pk = config.env.AGENT_PRIVATE_KEY;
    const arcWallet = new ethers.Wallet(
      pk,
      new ethers.JsonRpcProvider(config.env.ARC_RPC_URL),
    );
    const transmitter = new ethers.Contract(
      CCTP.messageTransmitter,
      MESSAGE_TRANSMITTER_ABI,
      arcWallet,
    );
    const mintTx = await transmitter.receiveMessage(messageBytes, attestation);
    await mintTx.wait();
    console.log(`[Bridge] USDC minted on Arc Testnet! Tx: ${mintTx.hash}`);
  }
}

module.exports = new BridgeService();
