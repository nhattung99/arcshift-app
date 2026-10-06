import { AppKit } from '@circle-fin/app-kit';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';

// Extend window interface for typescript safety
declare global {
  interface Window {
    ethereum?: any;
  }
}

export async function getArcClient() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error("Web3 wallet not found. Please install MetaMask or similar wallet.");
  }

  // Create Adapter connecting browser's injected provider (MetaMask, Rabby, etc.) with Arc SDK
  const adapter = await createViemAdapterFromProvider({
    provider: window.ethereum,
  });

  const kitKey = process.env.NEXT_PUBLIC_KIT_KEY || process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY;
  // Initialize AppKit with monetization settings
  const appKit = new AppKit({
    ...(kitKey && kitKey.trim() !== '' ? { config: { kitKey: kitKey.trim() } } : {}),
    developerFee: {
      getFee: (params) => {
        const amountVal = parseFloat(params.amount || '0');
        const feeUSDC = amountVal * 0.003; // 0.3% fee (30 bps)
        return BigInt(Math.floor(feeUSDC * 1_000_000)); // ERC-20 USDC uses 6 decimals
      },
      getFeeRecipient: () => '0x95222290DD7278Aa3Dddd389Cc1E1d165CC4BAfe', // Hardcoded protocol fee recipient
    }
  });

  // developerFee is configured via the constructor above, so setCustomFeePolicy is not needed here.

  return { appKit, adapter };
}
