const { encodePacked, encodeAbiParameters, parseUnits } = require('viem');
const walletManager = require('./src/walletManager');
const config = require('./config.json');

const UniversalRouter = '0xC43cC6A1E0F6EB48Cd4131522C1C73B13f3Da0F1';
const usdc = config.tokens.USDC.address;
const eurc = config.tokens.EURC.address;
const walletAddress = config.settings.agent.ownerAddress;

async function testV4Swap() {
  console.log("Starting V4 Swap Test on Unitflow...");
  
  // V4 SWAP_EXACT_IN_SINGLE (0x06) + SETTLE_ALL (0x0c) + TAKE_ALL (0x0f)
  const commands = '0x10'; // V4_SWAP
  
  const v4Actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [0x06, 0x0c, 0x0f]
  );
  
  const poolKey = {
    currency0: usdc < eurc ? usdc : eurc,
    currency1: usdc < eurc ? eurc : usdc,
    fee: 3000, // Assuming 3000 fee tier for V4
    tickSpacing: 60,
    hooks: '0x0000000000000000000000000000000000000000'
  };
  
  const zeroForOne = usdc < eurc; // true if usdc is currency0
  
  const swapParams = encodeAbiParameters(
    [{
      type: 'tuple',
      components: [
        { name: 'poolKey', type: 'tuple', components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ]},
        { name: 'zeroForOne', type: 'bool' },
        { name: 'amountIn', type: 'uint128' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' },
        { name: 'hookData', type: 'bytes' },
      ],
    }],
    [{ poolKey, zeroForOne, amountIn: parseUnits('1', 6), sqrtPriceLimitX96: 0n, hookData: '0x' }]
  );
  
  const settleParams = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [usdc, parseUnits('1', 6)]
  );
  
  const takeParams = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [eurc, 0n]
  );
  
  const v4Input = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    [v4Actions, [swapParams, settleParams, takeParams]]
  );
  
  try {
    const permit2 = '0x4ce562F687d0Ced27b79Ba51d79B63BD978F7F48';
    console.log("Approving Permit2...");
    await walletManager.executeContractCall({
      walletAddress,
      contractAddress: usdc,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [permit2, '115792089237316195423570985008687907853269984665640564039457584007913129639935']
    });

    console.log("Setting Permit2 allowance...");
    await walletManager.executeContractCall({
      walletAddress,
      contractAddress: permit2,
      abiFunctionSignature: "approve(address,address,uint160,uint48)",
      abiParameters: [usdc, UniversalRouter, parseUnits('1', 6).toString(), (Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30).toString()]
    });
    
    // 2. Execute Swap
    console.log("Executing Swap...");
    const txHash = await walletManager.executeContractCall({
      walletAddress,
      contractAddress: UniversalRouter,
      abiFunctionSignature: "execute(bytes,bytes[],uint256)",
      abiParameters: [
        commands,
        [v4Input],
        (Math.floor(Date.now() / 1000) + 300).toString()
      ]
    });
    console.log("Swap successful! Tx:", txHash);
  } catch (error) {
    console.error("Swap failed:", error.message);
  }
}

testV4Swap().catch(console.error);
