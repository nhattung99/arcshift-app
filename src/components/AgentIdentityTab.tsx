'use client';

/**
 * ERC-8004 Agent Identity + Reputation + x402 paid endpoint on Arc Testnet.
 */

import { useState, useCallback } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEventLogs,
  keccak256,
  toBytes,
  type Hash,
} from 'viem';
import {
  Bot,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Star,
  ChevronRight,
} from 'lucide-react';
import {
  ARC_CHAIN_ID,
  ARC_TESTNET_EXPLORER,
  ARC_TESTNET_RPC,
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_REGISTRY,
} from '@/lib/arcConstants';

const IDENTITY_ABI = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const;

const REPUTATION_ABI = [
  {
    type: 'function',
    name: 'giveFeedback',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

interface Props {
  walletAddress?: string;
}

type RegStep = 'idle' | 'signing' | 'confirming' | 'done' | 'error';
type X402Step = 'idle' | 'probing' | 'success' | 'error' | 'gate402';
type FbStep = 'idle' | 'signing' | 'confirming' | 'done' | 'error';

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getPublicClient() {
  return createPublicClient({ transport: http(ARC_TESTNET_RPC) });
}

function arcChain() {
  return {
    id: ARC_CHAIN_ID,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [ARC_TESTNET_RPC] } },
  } as const;
}

export default function AgentIdentityTab({ walletAddress }: Props) {
  const [reg, setReg] = useState({
    step: 'idle' as RegStep,
    agentId: null as bigint | null,
    txHash: null as Hash | null,
    errorMsg: '',
    agentName: 'ArcShift Summarizer Agent',
    agentDesc: 'Onchain summarizer gated by x402 on Arc Testnet',
  });

  const [x402, setX402] = useState({
    step: 'idle' as X402Step,
    topic: 'governance',
    result: '',
    errorMsg: '',
  });

  const [fb, setFb] = useState({
    step: 'idle' as FbStep,
    score: '90',
    comment: 'Delivered on time, accurate summary.',
    txHash: null as Hash | null,
    errorMsg: '',
  });

  const handleRegister = useCallback(() => {
    if (!walletAddress || typeof window === 'undefined' || !window.ethereum) return;
    setReg((prev) => ({ ...prev, step: 'signing', errorMsg: '', txHash: null, agentId: null }));

    void (async () => {
      try {
        const agentCard = {
          type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
          name: reg.agentName,
          description: reg.agentDesc,
          services: [{ name: 'summarize', endpoint: '/api/agent/summarize', version: '1.0.0' }],
          x402Support: true,
          active: true,
        };
        const agentURI = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(agentCard))}`;

        const walletClient = createWalletClient({
          account: walletAddress as `0x${string}`,
          chain: arcChain() as any,
          transport: custom(window.ethereum),
        });

        const txHash = await walletClient.writeContract({
          address: ERC8004_IDENTITY_REGISTRY,
          abi: IDENTITY_ABI,
          functionName: 'register',
          args: [agentURI],
          account: walletAddress as `0x${string}`,
          chain: arcChain() as any,
        });

        setReg((prev) => ({ ...prev, step: 'confirming', txHash }));

        const receipt = await getPublicClient().waitForTransactionReceipt({ hash: txHash });
        const [event] = parseEventLogs({
          abi: IDENTITY_ABI,
          eventName: 'Registered',
          logs: receipt.logs,
        });
        const agentId = event?.args?.agentId ?? BigInt(0);
        setReg((prev) => ({ ...prev, step: 'done', agentId }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        const friendly =
          msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('denied')
            ? 'Transaction cancelled.'
            : msg.slice(0, 140);
        setReg((prev) => ({ ...prev, step: 'error', errorMsg: friendly }));
      }
    })();
  }, [walletAddress, reg.agentName, reg.agentDesc]);

  const handleX402Call = useCallback(() => {
    setX402((prev) => ({ ...prev, step: 'probing', result: '', errorMsg: '' }));

    void (async () => {
      try {
        const res = await fetch('/api/agent/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: x402.topic, agentId: reg.agentId?.toString() }),
        });

        if (res.status === 402) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setX402((prev) => ({
            ...prev,
            step: 'gate402',
            errorMsg:
              body.message ??
              '402 Payment Required. Buyer agents attach an X-Payment header (Circle Gateway Nanopayment).',
          }));
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as { summary?: string };
        setX402((prev) => ({
          ...prev,
          step: 'success',
          result: data.summary ?? JSON.stringify(data),
        }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setX402((prev) => ({ ...prev, step: 'error', errorMsg: msg.slice(0, 140) }));
      }
    })();
  }, [x402.topic, reg.agentId]);

  const handleFeedback = useCallback(() => {
    if (!walletAddress || !reg.agentId || typeof window === 'undefined' || !window.ethereum) return;
    setFb((prev) => ({ ...prev, step: 'signing', errorMsg: '', txHash: null }));

    void (async () => {
      try {
        const scoreInt = Math.max(0, Math.min(100, parseInt(fb.score, 10) || 0));
        const feedbackHash = keccak256(
          toBytes(JSON.stringify({ score: scoreInt, comment: fb.comment })),
        );

        const walletClient = createWalletClient({
          account: walletAddress as `0x${string}`,
          chain: arcChain() as any,
          transport: custom(window.ethereum),
        });

        const txHash = await walletClient.writeContract({
          address: ERC8004_REPUTATION_REGISTRY,
          abi: REPUTATION_ABI,
          functionName: 'giveFeedback',
          args: [reg.agentId!, BigInt(scoreInt), 0, 'summarize', '', '', '', feedbackHash],
          account: walletAddress as `0x${string}`,
          chain: arcChain() as any,
        });

        setFb((prev) => ({ ...prev, step: 'confirming', txHash }));
        await getPublicClient().waitForTransactionReceipt({ hash: txHash });
        setFb((prev) => ({ ...prev, step: 'done' }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        const friendly = msg.toLowerCase().includes('user rejected')
          ? 'Transaction cancelled.'
          : msg.slice(0, 140);
        setFb((prev) => ({ ...prev, step: 'error', errorMsg: friendly }));
      }
    })();
  }, [walletAddress, reg.agentId, fb.score, fb.comment]);

  const isRegistered = reg.step === 'done' && reg.agentId !== null;

  return (
    <div className="space-y-5 text-left">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Bot size={18} className="text-indigo-300" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Agent Identity</h2>
          <p className="text-[11px] text-slate-500">
            ERC-8004 Identity · Reputation · x402 · Arc Testnet
          </p>
        </div>
      </div>

      {/* Step 1 — Register */}
      <div className="ds-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">
            Step 1
          </span>
          <span className="text-xs font-semibold text-slate-300">
            Register on ERC-8004 Identity Registry
          </span>
        </div>

        {!walletAddress ? (
          <p className="text-xs text-slate-500">Connect a wallet to mint your agent identity NFT.</p>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Agent name
                </label>
                <input
                  type="text"
                  value={reg.agentName}
                  onChange={(e) => setReg((p) => ({ ...p, agentName: e.target.value }))}
                  disabled={reg.step !== 'idle' && reg.step !== 'error'}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={reg.agentDesc}
                  onChange={(e) => setReg((p) => ({ ...p, agentDesc: e.target.value }))}
                  disabled={reg.step !== 'idle' && reg.step !== 'error'}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>

            {reg.step === 'done' && reg.agentId !== null && (
              <div className="flex items-start gap-2.5 rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-emerald-300">Registered onchain</p>
                  <p className="text-[11px] font-mono text-slate-400">
                    Agent ID: <strong className="text-white">#{reg.agentId.toString()}</strong>
                  </p>
                  {reg.txHash && (
                    <a
                      href={`${ARC_TESTNET_EXPLORER}/tx/${reg.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-300 hover:text-white"
                    >
                      <ExternalLink size={11} /> View transaction
                    </a>
                  )}
                </div>
              </div>
            )}

            {reg.step === 'error' && (
              <div className="flex items-start gap-2.5 rounded-xl p-3 bg-rose-500/10 border border-rose-500/20">
                <AlertCircle size={14} className="text-rose-400 mt-0.5 shrink-0" />
                <p className="text-xs text-rose-300">{reg.errorMsg}</p>
              </div>
            )}

            {(reg.step === 'signing' || reg.step === 'confirming') && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 size={13} className="animate-spin" />
                {reg.step === 'signing' ? 'Waiting for wallet signature…' : 'Confirming onchain…'}
              </div>
            )}

            {(reg.step === 'idle' || reg.step === 'error') && (
              <button
                type="button"
                onClick={handleRegister}
                className="btn-primary w-full"
              >
                <Bot size={15} />
                Register agent identity
                <ChevronRight size={14} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Step 2 — x402 */}
      <div className="ds-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">
            Step 2
          </span>
          <span className="text-xs font-semibold text-slate-300">
            Call paid endpoint (x402)
          </span>
        </div>

        <div className="rounded-xl p-3 text-[11px] font-mono space-y-1 bg-white/[0.03] border border-white/10 text-slate-400">
          <p>
            <span className="text-indigo-300">POST</span> /api/agent/summarize
          </p>
          <p>
            Gate: <span className="text-indigo-300">$0.01 USDC</span> · Circle Gateway Nanopayments
          </p>
          <p>
            x402Support: <span className="text-emerald-400">true</span>
          </p>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Topic
          </label>
          <input
            type="text"
            value={x402.topic}
            onChange={(e) => setX402((p) => ({ ...p, topic: e.target.value }))}
            placeholder="governance, defi, arc…"
            className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        {x402.step === 'gate402' && (
          <div className="rounded-xl p-3 space-y-1.5 bg-indigo-500/10 border border-indigo-500/20">
            <div className="flex items-center gap-1.5">
              <Zap size={13} className="text-indigo-300" />
              <span className="text-xs font-bold text-indigo-300">402 Payment Required</span>
            </div>
            <p className="text-[11px] text-slate-400">{x402.errorMsg}</p>
          </div>
        )}

        {x402.step === 'success' && (
          <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300">Paid call succeeded</span>
            </div>
            <p className="text-xs text-slate-300">{x402.result}</p>
          </div>
        )}

        {x402.step === 'error' && (
          <div className="flex items-start gap-2 rounded-xl p-3 bg-rose-500/10 border border-rose-500/20">
            <AlertCircle size={13} className="text-rose-400 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-300">{x402.errorMsg}</p>
          </div>
        )}

        {x402.step === 'probing' && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 size={13} className="animate-spin" />
            Calling endpoint…
          </div>
        )}

        <button
          type="button"
          onClick={handleX402Call}
          disabled={x402.step === 'probing'}
          className="btn-primary w-full disabled:pointer-events-none"
        >
          {x402.step === 'probing' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          {x402.step === 'probing' ? 'Calling…' : 'Call paid endpoint'}
        </button>
      </div>

      {/* Step 3 — Reputation */}
      {isRegistered && (
        <div className="ds-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">
              Step 3
            </span>
            <span className="text-xs font-semibold text-slate-300">
              Give reputation feedback
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Self-feedback is blocked by the registry. Use a second wallet to rate this agent.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Score (0–100)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={fb.score}
                onChange={(e) => setFb((p) => ({ ...p, score: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Comment
              </label>
              <input
                type="text"
                value={fb.comment}
                onChange={(e) => setFb((p) => ({ ...p, comment: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          {fb.step === 'done' && fb.txHash && (
            <div className="flex items-start gap-2.5 rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-300">Feedback recorded onchain</p>
                <a
                  href={`${ARC_TESTNET_EXPLORER}/tx/${fb.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-300 hover:text-white"
                >
                  <ExternalLink size={11} /> View transaction
                </a>
              </div>
            </div>
          )}

          {fb.step === 'error' && (
            <div className="flex items-start gap-2.5 rounded-xl p-3 bg-rose-500/10 border border-rose-500/20">
              <AlertCircle size={14} className="text-rose-400 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-300">{fb.errorMsg}</p>
            </div>
          )}

          {(fb.step === 'signing' || fb.step === 'confirming') && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 size={13} className="animate-spin" />
              {fb.step === 'signing' ? 'Waiting for wallet signature…' : 'Confirming onchain…'}
            </div>
          )}

          {(fb.step === 'idle' || fb.step === 'error' || fb.step === 'done') && (
            <button type="button" onClick={handleFeedback} className="btn-primary w-full">
              <Star size={14} />
              Submit feedback
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl p-4 text-[11px] space-y-1 ds-panel text-slate-500">
        <p className="font-semibold text-slate-400">Registry addresses</p>
        <p>
          Identity:{' '}
          <span className="font-mono text-indigo-300">{truncate(ERC8004_IDENTITY_REGISTRY)}</span>
        </p>
        <p>
          Reputation:{' '}
          <span className="font-mono text-indigo-300">{truncate(ERC8004_REPUTATION_REGISTRY)}</span>
        </p>
        <p>
          Docs:{' '}
          <a
            href="https://eips.ethereum.org/EIPS/eip-8004"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-300 hover:text-white underline underline-offset-2"
          >
            ERC-8004
          </a>
        </p>
      </div>
    </div>
  );
}
