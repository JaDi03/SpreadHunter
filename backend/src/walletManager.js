const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const { AppKit } = require('@circle-fin/app-kit');
const { createCircleWalletsAdapter } = require('@circle-fin/adapter-circle-wallets');
const forge = require('node-forge');
const crypto = require('crypto');
const config = require('./config');

class WalletManager {
  constructor() {
    this.enabled = !!config.env.CIRCLE_API_KEY && !!config.env.CIRCLE_ENTITY_SECRET;
    
    if (this.enabled) {
      this.client = initiateDeveloperControlledWalletsClient({
        apiKey: config.env.CIRCLE_API_KEY,
        entitySecret: config.env.CIRCLE_ENTITY_SECRET
      });
      
      this.appKit = new AppKit();
      this.bridgeAdapter = createCircleWalletsAdapter({
        apiKey: config.env.CIRCLE_API_KEY,
        entitySecret: config.env.CIRCLE_ENTITY_SECRET
      });
    }
  }

  /**
   * Generates a 32-byte RSA encrypted entity secret ciphertext
   */
  async _generateCiphertext() {
    // 1. Fetch public key from Circle
    const pubKeyResp = await this.client.getPublicKey();
    const publicKey = forge.pki.publicKeyFromPem(pubKeyResp.data.publicKey);

    // 2. Encrypt Entity Secret
    const entitySecret = forge.util.hexToBytes(config.env.CIRCLE_ENTITY_SECRET);
    const encryptedData = publicKey.encrypt(entitySecret, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() }
    });

    return forge.util.encode64(encryptedData);
  }

  /**
   * Creates a new EVM wallet using Circle Developer-Controlled Wallets
   * Configured for ARC-TESTNET as requested.
   */
  async createWallet(description = "SpreadHunter Agent Wallet") {
    if (!this.enabled) {
      throw new Error("Circle SDK not configured. Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET.");
    }

    try {
      const idempotencyKey = crypto.randomUUID();
      const entitySecretCiphertext = await this._generateCiphertext();

      let walletSetId = config.settings.walletSetId;
      if (!walletSetId) {
        console.log("Creating new Circle Wallet Set...");
        const walletSetResp = await this.client.createWalletSet({
          idempotencyKey: crypto.randomUUID(),
          entitySecretCiphertext,
          name: "SpreadHunter Agent Set"
        });
        walletSetId = walletSetResp.data.walletSet.id;
        console.log(`Wallet Set created: ${walletSetId}`);
      }

      console.log("Generating Developer-Controlled Wallet...");
      const walletResp = await this.client.createWallets({
        idempotencyKey,
        entitySecretCiphertext,
        blockchains: ["ARC-TESTNET"],
        count: 1,
        walletSetId
      });

      const wallet = walletResp.data.wallets[0];
      
      return {
        id: wallet.id,
        address: wallet.address,
        blockchain: wallet.blockchain
      };

    } catch (error) {
      console.error("Failed to create Circle wallet:", error?.response?.data || error.message);
      throw error;
    }
  }

  async getWalletById(walletId) {
    if (!this.enabled) throw new Error("Circle SDK not configured.");
    const resp = await this.client.getWallet({ id: walletId });
    const w = resp.data.wallet;
    return { id: w.id, address: w.address, blockchain: w.blockchain };
  }
  // --- Setup Wizard Methods ---

  async generateMasterWallets() {
    if (!this.enabled) throw new Error("Circle SDK not configured.");
    
    const entitySecretCiphertext = await this._generateCiphertext();

    const walletSetResp = await this.client.createWalletSet({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext,
      name: "SpreadHunter Global Registration",
    });
    
    const walletSetId = walletSetResp.data.walletSet.id;

    console.log("Generating Owner Wallet on Multiple Networks...");
    // Create Owner Wallet on 4 networks
    const ownerResp = await this.client.createWallets({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: await this._generateCiphertext(),
      blockchains: ["ARC-TESTNET", "ETH-SEPOLIA", "ARB-SEPOLIA", "BASE-SEPOLIA"],
      count: 1, // 1 wallet per blockchain
      walletSetId,
      accountType: "SCA",
    });

    console.log("Generating Validator Wallet on Arc Testnet...");
    // Create Validator Wallet only on ARC-TESTNET
    const validatorResp = await this.client.createWallets({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: await this._generateCiphertext(),
      blockchains: ["ARC-TESTNET"],
      count: 1,
      walletSetId,
      accountType: "SCA",
    });

    // The owner addresses will be identical across all EVM networks generated together
    // so we can just grab the first one (ARC-TESTNET) as the canonical address.
    const ownerWalletAddress = ownerResp.data.wallets[0].address;
    const validatorWalletAddress = validatorResp.data.wallets[0].address;

    return {
      ownerWallet: ownerWalletAddress,
      validatorWallet: validatorWalletAddress
    };
  }

  async registerGlobalAgent(ownerWalletAddress, metadataUri) {
    if (!this.enabled) throw new Error("Circle SDK not configured.");
    
    const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
    const entitySecretCiphertext = await this._generateCiphertext();

    const registerTx = await this.client.createContractExecutionTransaction({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext,
      walletAddress: ownerWalletAddress,
      blockchain: "ARC-TESTNET",
      contractAddress: IDENTITY_REGISTRY,
      abiFunctionSignature: "register(string)",
      abiParameters: [metadataUri],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const txId = registerTx.data.id;

    // Wait for transaction
    let txHash = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const { data } = await this.client.getTransaction({ id: txId });
      if (data?.transaction?.state === "COMPLETE") {
        txHash = data.transaction.txHash;
        break;
      }
      if (data?.transaction?.state === "FAILED") {
        throw new Error("Registration transaction failed onchain");
      }
    }

    if (!txHash) throw new Error("Transaction confirmation timed out");

    // Fetch the Agent ID using viem
    const { createPublicClient, http, parseAbiItem } = require('viem');
    const publicClient = createPublicClient({
      transport: http(config.env.ARC_RPC_URL)
    });

    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock = latestBlock > 10000n ? latestBlock - 10000n : 0n;

    const transferLogs = await publicClient.getLogs({
      address: IDENTITY_REGISTRY,
      event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
      args: { to: ownerWalletAddress },
      fromBlock,
      toBlock: latestBlock,
    });

    if (transferLogs.length === 0) {
      throw new Error("No Transfer events found. Agent registration may have failed.");
    }

    const agentId = transferLogs[transferLogs.length - 1].args.tokenId.toString();

    return { agentId, txHash };
  }

  /**
   * Reusable method to execute a contract call using the developer-controlled wallet.
   * Handles entity secret encryption, tx submission, and polling for confirmation.
   */
  async executeContractCall({ walletAddress, contractAddress, abiFunctionSignature, abiParameters }) {
    if (!this.enabled) throw new Error("Circle SDK not configured.");
    if (!walletAddress) throw new Error("Wallet address required for execution");

    const entitySecretCiphertext = await this._generateCiphertext();

    const tx = await this.client.createContractExecutionTransaction({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext,
      walletAddress,
      blockchain: "ARC-TESTNET",
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const txId = tx.data.id;
    let txHash = null;

    // Poll for status
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const { data } = await this.client.getTransaction({ id: txId });
      if (data?.transaction?.state === "COMPLETE") {
        txHash = data.transaction.txHash;
        break;
      }
      if (data?.transaction?.state === "FAILED") {
        throw new Error(`Transaction failed onchain: ${data?.transaction?.errorCode || 'Unknown'}`);
      }
    }

    if (!txHash) throw new Error("Transaction confirmation timed out");
    return txHash;
  }
}

module.exports = new WalletManager();
