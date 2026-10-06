/** Arc native USDC uses 18 decimals for gas / msg.value. ERC-20 USDC uses 6. */
export const ARC_NATIVE_DECIMALS = 18;

export const ERC20_DECIMALS: Record<string, number> = {
  USDC: 6,
  EURC: 6,
  USYC: 6,
  cirBTC: 8,
};

export const ARC_MEMO_ADDRESS = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505' as const;
export const ARC_USDC_ERC20 = '0x3600000000000000000000000000000000000000' as const;
export const ARC_CHAIN_ID = 5042002;

export const CCTP_DOMAINS: Record<string, number> = {
  Ethereum_Sepolia: 0,
  Base_Sepolia: 6,
  Arc_Testnet: 26,
  Ethereum: 0,
  Base: 6,
  Base_Mainnet: 6,
};

/** Sandbox EURC tokenId used by Iris on domains 0 and 6 (and Arc 26). */
export const SANDBOX_EURC_TOKEN_ID =
  '0x2587821a0ee7daa174b95436b5dab1731cfa1844775b010217d3c0dd02a4eecd' as const;

/** Mainnet EURC tokenId for CCTP for non-USDC. */
export const MAINNET_EURC_TOKEN_ID =
  '0x6ca9e29fa53becc29becaf4a90b9ca7a995ad4d2234880da13ca38c657fb241c' as const;

/** CREATE3 CrossChainTokenService address (same on each listed testnet). */
export const CROSS_CHAIN_TOKEN_SERVICE =
  '0x63753E722bd2C2A5DF6EE19C5106662208B81077' as const;

/** ERC-8004 Identity Registry on Arc Testnet (documented constant). */
export const ERC8004_IDENTITY_REGISTRY =
  '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const;

/** ERC-8004 Reputation Registry on Arc Testnet (documented constant). */
export const ERC8004_REPUTATION_REGISTRY =
  '0x8004B663056A597Dffe9eCcC1965A193B7388713' as const;

export const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.io';
export const ARC_TESTNET_EXPLORER = 'https://testnet.arcscan.app';

export function getErc20Decimals(symbol: string): number {
  return ERC20_DECIMALS[symbol] ?? 18;
}

/** Native gas token is always 18 decimals on EVM, including Arc USDC. */
export function getNativeDecimals(): number {
  return ARC_NATIVE_DECIMALS;
}

export function isGasInsufficientError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('insufficient funds') ||
    m.includes('outoffunds') ||
    m.includes('out of funds') ||
    m.includes('gas required exceeds allowance') ||
    m.includes('missing or invalid parameters')
  );
}

export const EURC_CCTP_CHAIN_KEYS = ['Arc_Testnet', 'Ethereum_Sepolia', 'Base_Sepolia'] as const;
export type EurcCctpChainKey = (typeof EURC_CCTP_CHAIN_KEYS)[number];

export function isEurcCctpChain(key: string): key is EurcCctpChainKey {
  return (EURC_CCTP_CHAIN_KEYS as readonly string[]).includes(key);
}
