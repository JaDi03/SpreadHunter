# SpreadHunter

<div align="center">

**An autonomous AI arbitrage agent operating on Arc Testnet, scanning cross-DEX price spreads for EURC/USDC and executing profitable trades with on-chain reputation tracking.**

[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![ethers.js](https://img.shields.io/badge/ethers.js-6-3C3C3D?logo=ethereum&logoColor=white)](https://ethers.org)
[![Circle W3S](https://img.shields.io/badge/Circle_W3S-WaaS-00D4A1?logo=circle&logoColor=white)](https://circle.com)
[![Circle App Kit](https://img.shields.io/badge/Circle_App_Kit-SDK-00D4A1?logo=circle&logoColor=white)](https://circle.com)
[![Arc Testnet](https://img.shields.io/badge/Arc-Testnet-6366F1)](https://arc.network)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Agent%20Identity-EC4899)](https://docs.arc.network)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

</div>

---

## Overview

SpreadHunter is a **hybrid deterministic + AI arbitrage agent** that continuously monitors price spreads across decentralized exchanges on Arc Testnet. When a profitable opportunity is detected, it generates a natural-language reasoning trace via an advanced LLM, executes the trade, and records its reputation on-chain via the **ERC-8004 Agent Registry**.

```mermaid
flowchart TD
    subgraph Arc["Arc Testnet"]
        DEX[("DEX Liquidity Pools")]
        ERC8004{"ERC-8004 Registry"}
    end

    subgraph Agent["SpreadHunter Core"]
        direction TB
        PE["🔍 Price Engine<br/>(On-chain reads)"]
        Calc["🧮 Calculator<br/>(Deterministic math)"]
        RE["🧠 Reasoning Engine<br/>(AI Analysis)"]
        Exec["⚙️ Executor<br/>(Calldata Builder)"]
    end

    DEX -. "slot0 data" .-> PE
    PE ==> Calc
    Calc ==>|"Profitable Spread"| RE
    RE ==>|"Natural Language Trace"| Exec
    Exec -. "Execution & Feedback" .-> ERC8004

    %% Styling
    classDef blockchain fill:#1e293b,stroke:#475569,stroke-width:2px,color:#f8fafc,rx:8px
    classDef logic fill:#2563eb,stroke:#1e40af,stroke-width:2px,color:#fff,rx:6px
    classDef ai fill:#d946ef,stroke:#a21caf,stroke-width:2px,color:#fff,rx:6px
    classDef action fill:#059669,stroke:#047857,stroke-width:2px,color:#fff,rx:6px

    class DEX,ERC8004 blockchain
    class PE,Calc logic
    class RE ai
    class Exec action

    style Arc fill:#020617,stroke:#334155,stroke-width:2px,color:#cbd5e1,stroke-dasharray: 5 5
    style Agent fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#bfdbfe
```

---

## Architecture & Workflows

SpreadHunter is designed for maximum abstraction, allowing users to deploy an AI agent without dealing with private keys or complex bridging protocols. We utilize **Circle Web3 Services (W3S)** and **Arc Agent Standards** to achieve this.

### 1. Zero-Friction Wallet Generation (Circle W3S)

To operate autonomously, the agent requires its own keys. Instead of forcing users to manage private keys, SpreadHunter leverages **Circle Developer-Controlled Wallets (WaaS)**. 

During the initial setup, the backend generates a secure Wallet Set that automatically creates:
- **The Owner Wallet:** A multi-chain wallet (Arc Testnet, Base Sepolia, ETH Sepolia, Arbitrum Sepolia) sharing the *exact same address*. This acts as the Agent's main portfolio.
- **The Validator Wallet:** A single-chain wallet on Arc Testnet responsible solely for signing and verifying the Agent's reputation feedback.

```mermaid
sequenceDiagram
    participant User
    participant App as SpreadHunter UI
    participant Backend as SpreadHunter Backend
    participant W3S as Circle W3S API
    
    User->>App: Launch Application
    App->>Backend: Initialize Agent Setup
    Backend->>W3S: Authenticate (API Key & RSA Ciphertext)
    W3S-->>Backend: Authentication Success
    Backend->>W3S: createWallets(ARC, BASE, ETH, ARB)
    W3S-->>Backend: Return Multi-Chain Owner Wallet
    Backend->>W3S: createWallets(ARC)
    W3S-->>Backend: Return Arc Validator Wallet
    Backend-->>App: Agent Identity Secured
    App-->>User: Display Agent Portfolio Dashboard
```

### 2. Auto-Bridging Deposits (Circle App Kit + CCTP)

Funding an agent on a specific L2/AppChain can be a high-friction process for users. SpreadHunter abstracts this away entirely using the **Circle App Kit** and **CCTP**.

Users simply transfer USDC to the Agent's address on their preferred network (e.g., Ethereum Sepolia). Our backend detects these funds and utilizes the Circle App Kit SDK to automatically bridge the USDC directly into the Agent's active portfolio on Arc Testnet. 

```mermaid
flowchart TD
    User["👤 User (Any Wallet)"]
    W3SOwner["🏦 Agent's W3S Wallet<br/>(Sepolia, Base, Arb)"]
    AppKit["⚙️ SpreadHunter Backend<br/>(Circle App Kit SDK)"]
    CCTP["🌉 Circle CCTP Protocol"]
    ArcAgent["📈 Agent Portfolio<br/>(Arc Testnet)"]

    User -- "1. Standard USDC Transfer" --> W3SOwner
    AppKit -- "2. Detects Balance & Triggers Bridge" --> W3SOwner
    W3SOwner -- "3. Initiates Cross-Chain Transfer" --> CCTP
    CCTP -- "4. Burns Source & Mints on Arc" --> ArcAgent
    ArcAgent -- "5. Funds Available for Trading" --> Trade["SpreadHunter Execution Engine"]

    style User fill:#1e293b,stroke:#475569,stroke-width:2px,color:#fff
    style W3SOwner fill:#059669,stroke:#047857,stroke-width:2px,color:#fff
    style AppKit fill:#2563eb,stroke:#1e40af,stroke-width:2px,color:#fff
    style CCTP fill:#6366F1,stroke:#4338ca,stroke-width:2px,color:#fff
    style ArcAgent fill:#059669,stroke:#047857,stroke-width:2px,color:#fff
    style Trade fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
```

### 3. Execution & On-Chain Reputation (ERC-8004)

1. **Price Scanning:** Reads `slot0` from V3 liquidity pools deterministically (no oracle).
2. **Spread Calculation:** Computes raw spread, deducts estimated fees, and flags profitable arbitrage opportunities.
3. **AI Reasoning:** The Reasoning Engine calls an **advanced LLM** to generate a trader-like analysis of the opportunity.
4. **Execution:** The Executor builds calldata and submits the transaction.
5. **Reputation Anchoring:** After the trade, the `AgentRegistry` submits a `giveFeedback` call to the **Arc Testnet ERC-8004 Identity Registry**, anchoring the keccak256 hash of the LLM reasoning on-chain to build verifiable trust.

---

## Directory Structure

```
SpreadHunter/
├── backend/
│   ├── src/
│   │   ├── config.js           # Environment & static configuration
│   │   ├── walletManager.js    # W3S WaaS generation & Circle CCTP Auto-Bridging
│   │   ├── priceEngine.js      # On-chain reads via ethers.js
│   │   ├── calculator.js       # Deterministic spread math
│   │   ├── reasoningEngine.js  # AI analysis integration
│   │   ├── executor.js         # DEX Swap execution
│   │   ├── agentRegistry.js    # ERC-8004 identity & reputation
│   │   └── index.js            # Express API + WebSocket Broadcaster
│   ├── config.json             # Persistent agent state & network configs
│   └── package.json            
├── frontend/
│   └── src/
│       ├── App.jsx             # React dashboard & WebSocket client
│       └── components/         # UI Elements (Stats, Modal, Setup Wizard)
└── README.md
```

## Adding a New DEX

SpreadHunter is fully modular. To add a new DEX, add an entry to `backend/config.json`:

```json
{
  "name": "NewDex",
  "enabled": true,
  "type": "UniswapV3",
  "contracts": {
    "factory": "0x...",
    "router":  "0x..."
  },
  "routerType": "SwapRouter02"
}
```

No code changes are required. The DEX is automatically picked up on the next restart.

---

## Setup & Installation

### Prerequisites
- Node.js 22+
- npm or pnpm

### Installation

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Configuration

Copy the example environment file and add your keys:
```bash
cp backend/.env.example backend/.env
```

| Variable | Description |
|---|---|
| `ARC_RPC_URL` | Arc Testnet RPC endpoint |
| `LLM_API_KEY` | API key for the LLM provider (Anthropic) |
| `CIRCLE_API_KEY` | Circle Developer API Key for WaaS |
| `CIRCLE_ENTITY_SECRET` | 32-byte hex Entity Secret for W3S authentication |

### Running the Application

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The Setup Wizard will guide you through creating your W3S Developer-Controlled Wallets and registering your Agent's ERC-8004 identity on Arc Testnet automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Wallets | **Circle Web3 Services (Developer-Controlled Wallets)** |
| Auto-Bridging | **Circle App Kit** + **CCTP Protocol** |
| Agent Identity | **ERC-8004** (Arc Identity + Reputation Registry) |
| Blockchain interactions | **ethers.js v6** (RPC reads/writes) |
| AI Reasoning | Advanced LLM (Anthropic) |
| Backend | Node.js + Express + WebSocket |
| Frontend | React 19 + Vite 8 |
| Network | Arc Testnet (ChainID: 5042002) |
