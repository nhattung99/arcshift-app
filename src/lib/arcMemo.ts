import {
  encodeFunctionData,
  keccak256,
  parseUnits,
  stringToHex,
  toBytes,
} from 'viem';
import { ARC_CHAIN_ID, ARC_MEMO_ADDRESS, getErc20Decimals } from '@/lib/arcConstants';

const MEMO_ABI = [
  {
    type: 'function',
    name: 'memo',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'memoId', type: 'bytes32' },
      { name: 'memoData', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export async function sendErc20WithArcMemo(params: {
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  amount: string;
  recipient: `0x${string}`;
  memo: string;
  account: `0x${string}`;
}): Promise<`0x${string}`> {
  const { createWalletClient, custom } = await import('viem');
  const walletClient = createWalletClient({
    chain: { id: ARC_CHAIN_ID } as any,
    transport: custom(window.ethereum),
  });

  const decimals = getErc20Decimals(params.tokenSymbol);
  const amountBI = parseUnits(params.amount, decimals);
  const innerData = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [params.recipient, amountBI],
  });

  const memoId = keccak256(toBytes(params.memo));
  const memoData = stringToHex(params.memo);

  return walletClient.writeContract({
    account: params.account,
    address: ARC_MEMO_ADDRESS,
    abi: MEMO_ABI,
    functionName: 'memo',
    args: [params.tokenAddress, innerData, memoId, memoData],
    gas: BigInt(300000),
  } as any);
}
