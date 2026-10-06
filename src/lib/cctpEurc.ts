import {
  createPublicClient,
  custom,
  encodePacked,
  http,
  parseUnits,
  zeroAddress,
} from 'viem';
import {
  CROSS_CHAIN_TOKEN_SERVICE,
  CCTP_DOMAINS,
  SANDBOX_EURC_TOKEN_ID,
  isEurcCctpChain,
} from '@/lib/arcConstants';

const CCTS = CROSS_CHAIN_TOKEN_SERVICE;

const SERVICE_ABI = [
  {
    name: 'resolveTokenManager',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'bytes32' }],
    outputs: [{ name: 'tokenManager', type: 'address' }],
  },
  {
    name: 'resolveTokenAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'bytes32' }],
    outputs: [{ name: 'token', type: 'address' }],
  },
] as const;

const TRANSFER_ABI = [
  {
    name: 'crossChainTransfer',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'destinationAddress', type: 'bytes' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'minFinalityThreshold', type: 'uint32' },
      {
        name: 'claim',
        type: 'tuple',
        components: [
          { name: 'signedQuote', type: 'bytes' },
          { name: 'refundAddress', type: 'address' },
        ],
      },
      { name: 'autoExecuteHookData', type: 'bool' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'ok', type: 'bool' }],
  },
] as const;

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

const CHAIN_RPC: Record<string, string> = {
  Ethereum_Sepolia: 'https://ethereum-sepolia.publicnode.com',
  Base_Sepolia: 'https://sepolia.base.org',
  Arc_Testnet: 'https://rpc.testnet.arc.network/',
};

const CHAIN_ID: Record<string, number> = {
  Ethereum_Sepolia: 11155111,
  Base_Sepolia: 84532,
  Arc_Testnet: 5042002,
};

export function isEurcCctpRoute(sourceKey: string, destKey: string): boolean {
  return sourceKey !== destKey && isEurcCctpChain(sourceKey) && isEurcCctpChain(destKey);
}

export function getEurcBridgeTargets(sourceKey: string): { value: string; label: string }[] {
  const all = [
    { value: 'Arc_Testnet', label: 'Arc Testnet' },
    { value: 'Ethereum_Sepolia', label: 'Ethereum Sepolia' },
    { value: 'Base_Sepolia', label: 'Base Sepolia' },
  ];
  return all.filter((c) => c.value !== sourceKey);
}

type FeeQuote = {
  signedQuote: `0x${string}`;
  feeTotalAmount: string;
};

async function irisFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api/iris${path}`, init);
}

async function fetchFeeQuote(params: {
  tokenId: string;
  sourceDomain: number;
  destDomain: number;
  amount: bigint;
  recipient: `0x${string}`;
  fast: boolean;
}): Promise<FeeQuote> {
  const requests: unknown[] = params.fast
    ? [
        { type: 'PRE_FINALITY' },
        {
          type: 'FORWARD',
          params: {
            msgType: 'TransferMessage',
            destinationAddress: params.recipient,
          },
        },
      ]
    : [
        {
          type: 'FORWARD',
          params: {
            msgType: 'TransferMessage',
            destinationAddress: params.recipient,
          },
        },
      ];

  const response = await irisFetch(
    `/v2/quote/cctpx/${params.tokenId}/${params.sourceDomain}/${params.destDomain}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: params.amount.toString(),
        feeToken: zeroAddress,
        requests,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function bridgeEurcViaCctp(params: {
  sourceChainKey: string;
  destChainKey: string;
  amount: string;
  recipient: `0x${string}`;
  account: `0x${string}`;
  onStatus?: (text: string) => void;
}): Promise<`0x${string}`> {
  if (!isEurcCctpRoute(params.sourceChainKey, params.destChainKey)) {
    throw new Error(
      'EURC CCTP currently supports native burn-and-mint between Ethereum, Base, and Arc Testnet.',
    );
  }

  const sourceDomain = CCTP_DOMAINS[params.sourceChainKey];
  const destDomain = CCTP_DOMAINS[params.destChainKey];
  const rpc = CHAIN_RPC[params.sourceChainKey];
  const chainId = CHAIN_ID[params.sourceChainKey];
  const tokenId = SANDBOX_EURC_TOKEN_ID;

  const status = params.onStatus || (() => {});
  status('Resolving EURC TokenManager via CrossChainTokenService...');

  const publicClient = createPublicClient({ transport: http(rpc) });
  const { createWalletClient } = await import('viem');
  const walletClient = createWalletClient({
    account: params.account,
    chain: { id: chainId } as any,
    transport: custom(window.ethereum),
  });

  const tokenManager = await publicClient.readContract({
    address: CCTS,
    abi: SERVICE_ABI,
    functionName: 'resolveTokenManager',
    args: [tokenId],
  });
  const tokenAddress = await publicClient.readContract({
    address: CCTS,
    abi: SERVICE_ABI,
    functionName: 'resolveTokenAddress',
    args: [tokenId],
  });

  const transferAmount = parseUnits(params.amount, 6);

  status('Approving EURC TokenManager for CCTP burn...');
  const approveHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [tokenManager, transferAmount],
  } as any);
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  status('Fetching Iris fee quote (fast transfer with forwarding)...');
  let quote: FeeQuote;
  let minFinality = 1000;
  try {
    quote = await fetchFeeQuote({
      tokenId,
      sourceDomain,
      destDomain,
      amount: transferAmount,
      recipient: params.recipient,
      fast: true,
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('FX_SYMBOL_NOT_CONFIGURED') || msg.toLowerCase().includes('pre_finality')) {
      status('Fast transfer unavailable — falling back to standard CCTP finality...');
      minFinality = 2000;
      quote = await fetchFeeQuote({
        tokenId,
        sourceDomain,
        destDomain,
        amount: transferAmount,
        recipient: params.recipient,
        fast: false,
      });
    } else {
      throw err;
    }
  }

  status('Burning EURC on source chain via CrossChainTokenService...');
  const destinationAddress = encodePacked(['address'], [params.recipient]);
  const feeTotalAmount = BigInt(quote.feeTotalAmount);

  const transferHash = await walletClient.writeContract({
    address: CCTS,
    abi: TRANSFER_ABI,
    functionName: 'crossChainTransfer',
    args: [
      tokenId,
      transferAmount,
      destDomain,
      destinationAddress,
      ZERO_BYTES32,
      minFinality,
      { signedQuote: quote.signedQuote, refundAddress: zeroAddress },
      false,
      '0x',
    ],
    value: feeTotalAmount,
  } as any);

  return transferHash;
}
