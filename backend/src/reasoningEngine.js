const config = require('./config');

class ReasoningEngine {
  constructor() {
    this.enabled = config.settings.llm.enabled;
    this.apiKey = config.env.LLM_API_KEY;
    this.model = config.settings.llm.model || 'gemini-2.5-flash';
  }

  async generateReasoning(opportunity) {
    if (!this.enabled || !this.apiKey) {
      return { text: "AI reasoning unavailable: Missing LLM_API_KEY in .env.", isLlm: false };
    }

    const tradeAmountUsdc = config.settings.defaultAmountIn || '100';
    const buyFeeLabel  = opportunity.buyDex  === 'XyloNet' ? '0.30% (V2 fixed)' : `${(opportunity.feeTier / 10000).toFixed(2)}% (V3 tier ${opportunity.feeTier})`;
    const sellFeeLabel = opportunity.sellDex === 'XyloNet' ? '0.30% (V2 fixed)' : `${(opportunity.feeTier / 10000).toFixed(2)}% (V3 tier ${opportunity.feeTier})`;
    const estimatedGrossProfit = (parseFloat(tradeAmountUsdc) * opportunity.rawSpreadPercent / 100).toFixed(4);
    const estimatedNetProfit   = (parseFloat(tradeAmountUsdc) * opportunity.netSpreadPercent / 100).toFixed(4);

    const prompt = `You are SpreadHunter, an autonomous AI arbitrage agent running on Arc Testnet. You operate in a hybrid model: a deterministic math engine detected this opportunity and sent you the data below. Your job is to reason through it step by step like a professional on-chain trader and issue a final decision.

--- DETERMINISTIC ENGINE OUTPUT ---
Pair:           ${opportunity.pair}
Trade Size:     ${tradeAmountUsdc} USDC
Buy on:         ${opportunity.buyDex} @ ${Number(opportunity.buyPrice).toFixed(6)} EURC/USDC
Sell on:        ${opportunity.sellDex} @ ${Number(opportunity.sellPrice).toFixed(6)} EURC/USDC
Raw Spread:     ${opportunity.rawSpreadPercent}%
Buy-leg Fee:    ${buyFeeLabel}
Sell-leg Fee:   ${sellFeeLabel}
Total Fees:     ${(opportunity.feePercent * 100).toFixed(4)}%
Slippage est.:  0.15% (two-leg combined)
Net Spread:     ${opportunity.netSpreadPercent}%
Est. Gross P&L: +${estimatedGrossProfit} USDC
Est. Net P&L:   +${estimatedNetProfit} USDC
Threshold:      10 bps minimum net
Decision flag:  ${opportunity.isProfitable ? 'EXECUTE' : 'SKIP'}
---

Write a step-by-step analysis in plain English (no markdown, no bullets, no headers). Walk through: (1) what the deterministic scanner found, (2) fee analysis per leg, (3) slippage risk assessment, (4) net profit calculation, (5) your final EXECUTE or SKIP verdict and why. Sound like a confident algorithmic trader. 6-8 sentences max.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 600,
        },
        systemInstruction: {
          parts: [{ text: "You are SpreadHunter, an AI arbitrage agent. Output only the requested reasoning in plain text. No markdown. No lists. Just flowing analytical prose." }]
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 400 && err.includes("API_KEY_INVALID")) {
           return { text: "AI reasoning skipped: Please configure a valid LLM_API_KEY.", isLlm: false };
        }
        throw new Error(`Gemini API error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response from Gemini");
      }

      return { text: text.trim(), isLlm: true };
    } catch (error) {
      if (error.message.includes("API_KEY_INVALID")) {
        return { text: "AI reasoning skipped: Please configure a valid LLM_API_KEY.", isLlm: false };
      }
      return { text: `AI reasoning skipped (API Error): ${error.message.split('\n')[0]}`, isLlm: false };
    }
  }
}

module.exports = new ReasoningEngine();
