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

    const prompt = `You are SpreadHunter, an autonomous AI arbitrage agent operating on Arc Testnet.
Analyze the following cross-DEX arbitrage opportunity and provide professional, trader-like reasoning (3-5 sentences). Include: raw spread found, fee deduction, net spread, and your final EXECUTE or SKIP decision with a clear justification.

Data:
- Pair: ${opportunity.pair}
- Buy on: ${opportunity.buyDex} at price ${Number(opportunity.buyPrice).toFixed(6)}
- Sell on: ${opportunity.sellDex} at price ${Number(opportunity.sellPrice).toFixed(6)}
- Raw Spread: ${opportunity.rawSpreadPercent}%
- Fees + Slippage: ${opportunity.feePercent}% + 0.15%
- Net Spread: ${opportunity.netSpreadPercent}%
- Decision: ${opportunity.isProfitable ? 'EXECUTE' : 'SKIP'}

Write the reasoning in English, plain text only, no markdown, no bullet points.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 450,
        },
        systemInstruction: {
          parts: [{ text: "You are an AI trading agent. Output only the requested reasoning block in plain text." }]
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("--- LLM HTTP ERROR RESPONSE ---");
        console.error(err);
        console.error("-------------------------------");
        throw new Error(`Gemini API error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error("--- LLM UNEXPECTED RESPONSE FORMAT ---");
        console.error(JSON.stringify(data, null, 2));
        console.error("--------------------------------------");
        throw new Error("Empty response from Gemini");
      }

      return { text: text.trim(), isLlm: true };
    } catch (error) {
      console.error("--- LLM EXECUTION ERROR ---");
      console.error("LLM Error:", error.message);
      console.error(error);
      console.error("---------------------------");
      return { text: `AI reasoning failed: ${error.message}`, isLlm: false };
    }
  }
}

module.exports = new ReasoningEngine();
