'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { 
  Wallet, 
  Coins, 
  ArrowRight, 
  ExternalLink, 
  RefreshCw, 
  Send as SendIcon, 
  Terminal, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';

interface WalletInfo {
  address: string;
  name: string;
  network: string;
  chains: string[];
}

interface AssetInfo {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  priceUSD: number;
  valueUSD: number;
}

interface PortfolioInfo {
  totalValueUSD: number;
  assets: AssetInfo[];
}

interface BaseAgentTabProps {
  connectedWalletAddress?: string;
  connectedWalletBalances?: {
    symbol: string;
    name: string;
    balance: string;
    decimals: number;
  }[];
  activeChainName?: string;
  onRefreshConnectedBalances?: () => Promise<void>;
}

const TOKEN_PRICES: Record<string, number> = {
  'USDC': 1.00,
  'EURC': 1.09,
  'USYC': 1.00,
  'cirBTC': 68500.00,
  'ETH': 3245.00,
};

export default function BaseAgentTab({
  connectedWalletAddress,
  connectedWalletBalances,
  activeChainName,
  onRefreshConnectedBalances
}: BaseAgentTabProps) {
  const [walletLoading, setWalletLoading] = useState(false);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioInfo | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const [walletSource, setWalletSource] = useState<'personal' | 'agent'>('agent');

  useEffect(() => {
    if (connectedWalletAddress) {
      setWalletSource('personal');
    } else {
      setWalletSource('agent');
    }
  }, [connectedWalletAddress]);

  // Derive active wallets and portfolio from selected wallet source
  const isWalletConnected = !!connectedWalletAddress;
  const activeWalletSource = isWalletConnected && walletSource === 'personal' ? 'personal' : 'agent';

  const displayWallets = activeWalletSource === 'personal'
    ? [{
        address: connectedWalletAddress!,
        name: "Personal Wallet",
        network: activeChainName || "Base Network",
        chains: ["base"]
      }]
    : wallets;

  const displayPortfolio = activeWalletSource === 'personal' && connectedWalletBalances
    ? (() => {
        const assets = connectedWalletBalances.map(t => {
          const balanceNum = parseFloat(t.balance.replace(/,/g, '')) || 0;
          const price = TOKEN_PRICES[t.symbol] || 1.00;
          const valueUSD = balanceNum * price;
          return {
            symbol: t.symbol,
            name: t.name,
            balance: t.balance,
            decimals: t.decimals,
            priceUSD: price,
            valueUSD: valueUSD
          };
        });
        const totalValueUSD = assets.reduce((sum, item) => sum + item.valueUSD, 0);
        return {
          totalValueUSD,
          assets
        };
      })()
    : portfolio;

  // Tracks status checks of write operations
  // key: requestId, value: { status: string, txHash?: string, memo?: string, loading?: boolean }
  const [txStatuses, setTxStatuses] = useState<Record<string, { status: string; txHash?: string; memo?: string; loading?: boolean }>>({});

  const [input, setInput] = useState('');
  const { 
    messages, 
    status, 
    sendMessage, 
    error 
  } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat-base',
      body: {
        walletAddress: activeWalletSource === 'personal' ? connectedWalletAddress : "0x323b5d2735d45d2d46e37947118265e396dc34fa",
        walletBalances: activeWalletSource === 'personal' ? connectedWalletBalances : [
          { symbol: "USDC", name: "USD Coin", balance: "850.50", decimals: 6 },
          { symbol: "ETH", name: "Ethereum", balance: "0.185", decimals: 18 }
        ]
      }
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch wallet information from our helper route
  const fetchWalletInfo = async () => {
    setWalletLoading(true);
    try {
      const res = await fetch('/api/chat-base/wallet');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setWallets(data.wallets || []);
          setPortfolio(data.portfolio || null);
        }
      }
    } catch (error) {
      console.error('Error fetching Base wallet info:', error);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (activeWalletSource === 'personal' && onRefreshConnectedBalances) {
      setWalletLoading(true);
      await onRefreshConnectedBalances();
      setWalletLoading(false);
    } else {
      await fetchWalletInfo();
    }
  };

  useEffect(() => {
    fetchWalletInfo();
  }, []);

  // Auto scroll messages to the bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput('');
  };

  // Poll/Check status of a pending request ID
  const checkTransactionStatus = async (requestId: string) => {
    setTxStatuses(prev => ({ ...prev, [requestId]: { ...prev[requestId], loading: true } }));
    try {
      const res = await fetch(`/api/chat-base/status?id=${requestId}`);
      if (res.ok) {
        const data = await res.json();
        setTxStatuses(prev => ({
          ...prev,
          [requestId]: {
            status: data.status,
            txHash: data.txHash,
            memo: data.memo,
            loading: false
          }
        }));

        // If transaction succeeded, refresh the wallet info on the left panel
        if (data.status === 'success') {
          handleRefresh();
        }
      }
    } catch (err) {
      console.error('Error checking transaction status:', err);
      setTxStatuses(prev => ({ ...prev, [requestId]: { ...prev[requestId], loading: false } }));
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-h-[580px] lg:min-h-[660px]">
      
      {/* LEFT PANEL: Base Account details & Portfolio (Read-only) */}
      <div className="w-full lg:w-2/5 flex flex-col bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md">
        
        {/* Subtle background glow */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <Wallet className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Base Account</h3>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Base Network (Mainnet)</p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={walletLoading}
            className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-200 transition-all duration-300 cursor-pointer border border-zinc-900 disabled:opacity-40"
            title="Refresh balances"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        {/* Wallets List */}
        <div className="py-4 space-y-3 z-10 flex-shrink-0">
          {displayWallets.length === 0 ? (
            <div className="animate-pulse space-y-2">
              <div className="h-10 bg-zinc-900/50 rounded-xl" />
            </div>
          ) : (
            displayWallets.map((w, idx) => (
              <div key={idx} className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">{w.name}</span>
                  <span className="text-[9px] bg-blue-500/15 border border-blue-500/20 text-blue-400 font-semibold px-2 py-0.5 rounded-full uppercase">
                    Active
                  </span>
                </div>
                
                <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-900 rounded-lg p-2 text-[11px] font-mono text-zinc-400">
                  <span className="truncate max-w-[200px]">{w.address}</span>
                  <button
                    onClick={() => handleCopyAddress(w.address)}
                    className="p-1 hover:bg-zinc-900 rounded text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {copiedAddress === w.address ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Wallet Source Toggle */}
        <div className="flex bg-zinc-900/40 border border-zinc-850 rounded-xl p-1 mb-4 z-10 font-mono">
          <button
            type="button"
            onClick={() => setWalletSource('personal')}
            disabled={!connectedWalletAddress}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
              activeWalletSource === 'personal'
                ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400 font-semibold'
                : 'text-zinc-500 hover:text-zinc-350 disabled:opacity-30 disabled:hover:text-zinc-500'
            }`}
          >
            Personal Wallet
          </button>
          <button
            type="button"
            onClick={() => setWalletSource('agent')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
              activeWalletSource === 'agent'
                ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-semibold'
                : 'text-zinc-500 hover:text-zinc-350'
            }`}
          >
            Agent Wallet
          </button>
        </div>

        {/* Portfolio Valuation */}
        <div className="bg-gradient-to-br from-zinc-900/40 to-zinc-950/40 border border-zinc-800/60 rounded-xl p-4 mb-4 z-10 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-medium">
            <Coins className="w-3.5 h-3.5 text-zinc-500" />
            <span>Estimated Portfolio Value</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-1 tracking-tight">
            {displayPortfolio ? `$${displayPortfolio.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
          </div>
        </div>

        {/* Assets List */}
        <div className="flex-1 overflow-y-auto min-h-[160px] pr-1 z-10">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2.5">Asset Breakdown</div>
          
          {walletLoading && !displayPortfolio ? (
            <div className="space-y-2.5">
              <div className="h-10 bg-zinc-900/30 rounded-xl animate-pulse" />
              <div className="h-10 bg-zinc-900/30 rounded-xl animate-pulse" />
            </div>
          ) : displayPortfolio && displayPortfolio.assets && displayPortfolio.assets.length > 0 ? (
            <div className="space-y-2">
              {displayPortfolio.assets.map((asset, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/20 border border-zinc-900 hover:border-zinc-800/70 transition-all hover:bg-zinc-900/30 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-300 group-hover:text-blue-400 transition-colors">
                      {asset.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">{asset.symbol}</div>
                      <div className="text-[10px] text-zinc-500">{asset.name}</div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs font-bold text-zinc-200">
                      {parseFloat(asset.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      ${asset.valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-28 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-900 rounded-xl">
              <Coins className="w-6 h-6 mb-2 opacity-40" />
              <span className="text-xs">No assets detected</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Terminal Chatbot */}
      <div className="w-full lg:w-3/5 flex flex-col bg-zinc-950/40 border border-zinc-800/80 rounded-2xl shadow-lg relative overflow-hidden backdrop-blur-md h-[580px] lg:h-auto">
        
        {/* Terminal Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950/80 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wide">Base Agent Core</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 font-mono">MODEL CONTEXT PROTOCOL (SSE)</p>
            </div>
          </div>
          <div className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800/50 px-2.5 py-1 rounded-md">
            status: online
          </div>
        </div>

        {/* Chat Messages Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs scrollbar-thin z-10">
          
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-500 animate-pulse">
                <Sparkles className="w-6 h-6 text-emerald-400/80" />
              </div>
              <div className="space-y-1">
                <h4 className="text-zinc-200 font-bold tracking-wide">Base Network Agent Control</h4>
                <p className="text-[11px] text-zinc-500 max-w-[280px] leading-relaxed mx-auto">
                  Execute transactions, manage portfolios, and check smart wallet balances using natural language.
                </p>
              </div>
              
              <div className="w-full max-w-[340px] pt-3 text-[10px] border-t border-zinc-900/60 space-y-1.5">
                <p className="text-left font-bold text-zinc-500 mb-1 font-mono uppercase tracking-wider text-[9px]">Suggested Directives:</p>
                
                <button 
                  onClick={() => setInput('Check my Base smart wallet details and asset balances')}
                  className="w-full text-left py-1.5 px-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/90 border border-zinc-800/40 hover:border-zinc-700/60 transition-all text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  &gt; Check my Base wallet details &amp; balances
                </button>
                
                <button 
                  onClick={() => setInput('Send 5 USDC to address 0x5FbDB2315678afecb367f032d93F642f64180aa3')}
                  className="w-full text-left py-1.5 px-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/90 border border-zinc-800/40 hover:border-zinc-700/60 transition-all text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  &gt; Send 5 USDC to 0x5FbDB2315678...
                </button>

                <button 
                  onClick={() => setInput('Swap 0.05 ETH for USDC on Base')}
                  className="w-full text-left py-1.5 px-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/90 border border-zinc-800/40 hover:border-zinc-700/60 transition-all text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  &gt; Swap 0.05 ETH for USDC on Base
                </button>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div key={message.id} className="space-y-2 animate-fade-in">
                  
                  {/* Chat Message Bubble */}
                  <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[90%] rounded-xl px-4 py-3 leading-relaxed border font-mono ${
                        isUser
                          ? 'bg-blue-600/10 border-blue-500/20 text-blue-100 rounded-tr-none'
                          : 'bg-zinc-900/50 border-zinc-850 text-zinc-300 rounded-tl-none'
                      }`}
                    >
                      <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
                        {isUser ? 'User' : 'Base Agent'}
                      </div>
                      <div className="whitespace-pre-wrap">
                        {message.parts && message.parts.map((part: any, partIdx: number) => {
                          if (part.type === 'text') {
                            return <span key={partIdx}>{part.text}</span>;
                          }
                          if (part.type === 'reasoning') {
                            return (
                              <div key={partIdx} className="border-l-2 border-zinc-700 pl-2 text-zinc-500 italic my-1.5">
                                [thought] {part.text}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </div>

                  {/* CUSTOM TOOL TICKET RENDERER */}
                  {message.parts && message.parts.some((part: any) => part.type.startsWith('tool-')) && (
                    <div className="space-y-2.5 pl-3 border-l border-zinc-800 my-2">
                      {message.parts.map((part: any, partIdx: number) => {
                        if (!part.type.startsWith('tool-')) return null;

                        const toolCallId = (part as any).toolCallId;

                        // If it's a tool-call part:
                        if (part.type === 'tool-call') {
                          const toolName = (part as any).toolName;
                          // Show indicator for system tools, hide for action tools (rendered on tool-result)
                          if (toolName === 'get_wallets' || toolName === 'get_portfolio' || toolName === 'get_request_status') {
                            return (
                              <div key={toolCallId || partIdx} className="text-[10px] text-zinc-500 flex items-center gap-1.5 font-mono italic">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse"></span>
                                <span>Executed system tool: {toolName}</span>
                              </div>
                            );
                          }
                          return null;
                        }

                        // If it's a tool-result part:
                        if (part.type === 'tool-result') {
                          const toolName = (part as any).toolName;
                          // Skip rendering details for system tools
                          if (toolName === 'get_wallets' || toolName === 'get_portfolio' || toolName === 'get_request_status') {
                            return null;
                          }

                          // Find the corresponding tool-call part to get the input arguments
                          let toolCallPart = null;
                          for (const msg of messages) {
                            if (msg.parts) {
                              toolCallPart = msg.parts.find((p: any) => p.type === 'tool-call' && (p as any).toolCallId === toolCallId);
                              if (toolCallPart) break;
                            }
                          }

                          const toolInput = toolCallPart ? (((toolCallPart as any).args !== undefined) ? (toolCallPart as any).args : (toolCallPart as any).input) : undefined;
                          const toolResult = (part as any).result !== undefined ? (part as any).result : (part as any).output;

                           const requestId = toolResult?.requestId;
                          const approvalUrl = toolResult?.approvalUrl;

                          const txState = txStatuses[requestId] || { status: toolResult?.status || 'pending', memo: toolResult?.memo || toolInput?.memo };
                          const memo = txState.memo || toolResult?.memo || toolInput?.memo || (approvalUrl ? new URLSearchParams(approvalUrl.split('?')[1] || '').get('memo') : undefined);

                          return (
                            <div 
                              key={toolCallId || partIdx} 
                              className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-3 max-w-[90%] shadow-md animate-fade-in"
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                                <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                  {toolName === 'send' ? 'Action: Send Funds' : 'Action: Swap Assets'}
                                </div>
                                <div className="flex items-center gap-1">
                                  {txState.status === 'success' ? (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Success</span>
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[10px] text-yellow-500 font-bold uppercase">
                                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                                      <span>Awaiting Auth</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Details Details */}
                              <div className="bg-zinc-900/30 p-2.5 rounded-lg border border-zinc-900 text-[11px] text-zinc-300 space-y-1">
                                {toolName === 'send' ? (
                                  <>
                                    <div><span className="text-zinc-500">Asset:</span> <span className="font-semibold text-zinc-200">{toolInput?.amount} {toolInput?.asset}</span></div>
                                    <div><span className="text-zinc-500">To:</span> <span className="font-mono text-[10px] text-zinc-400 break-all">{toolInput?.toAddress}</span></div>
                                  </>
                                ) : (
                                  <>
                                    <div><span className="text-zinc-500">Swap:</span> <span className="font-semibold text-zinc-200">{toolInput?.amount} {toolInput?.fromAsset}</span></div>
                                    <div><span className="text-zinc-500">For:</span> <span className="font-semibold text-zinc-200">{toolInput?.toAsset}</span></div>
                                  </>
                                )}
                                {memo && (
                                  <div>
                                    <span className="text-zinc-500">Memo:</span> <span className="text-emerald-400 font-semibold">{memo}</span>
                                  </div>
                                )}
                                <div className="pt-1 border-t border-zinc-900 mt-1">
                                  <span className="text-zinc-500">Request ID:</span> <code className="text-zinc-400 text-[10px]">{requestId}</code>
                                </div>
                              </div>

                              {/* Controls */}
                              {txState.status !== 'success' ? (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <a
                                    href={approvalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all duration-200 text-center text-[10px] flex items-center justify-center gap-1 cursor-pointer border border-transparent shadow-[0_0_15px_rgba(59,130,246,0.25)]"
                                  >
                                    <span>Approve Transaction</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  
                                  <button
                                    onClick={() => checkTransactionStatus(requestId)}
                                    disabled={txState.loading || !requestId}
                                    className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 transition-all duration-200 text-center text-[10px] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                                  >
                                    {txState.loading ? (
                                      <>
                                        <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                                        <span>Verifying...</span>
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="w-3 h-3" />
                                        <span>Verify Status</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-emerald-950/15 border border-emerald-900/30 rounded-lg p-3 text-[11px] text-zinc-300 space-y-2">
                                  <div className="text-emerald-400 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Transaction Confirmed!</span>
                                  </div>
                                  {txState.txHash && (
                                    <div className="flex flex-col gap-1">
                                      <span className="text-zinc-500">Transaction Hash:</span>
                                      <a
                                        href={`https://basescan.org/tx/${txState.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-[10px] text-blue-400 hover:underline flex items-center gap-1 break-all"
                                      >
                                        <span>{txState.txHash}</span>
                                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900/50 border border-zinc-850 text-zinc-500 rounded-xl rounded-tl-none px-3.5 py-2.5 flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span>Agent executing directive...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl flex gap-1.5 items-start">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Execution error:</span>{' '}
                {error.message || 'Failed to reach the AI agent.'}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form Footer */}
        <form 
          onSubmit={handleFormSubmit}
          className="p-3 border-t border-zinc-900 bg-zinc-950/80 flex items-center gap-2 z-10"
        >
          <span className="text-emerald-400 font-mono pl-1 flex-shrink-0 select-none">&gt;</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Instruct Base Agent..."
            className="flex-1 font-mono text-xs rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 bg-zinc-950/60 border border-zinc-900/60"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-all duration-200 cursor-pointer"
            aria-label="Submit directive"
          >
            <SendIcon className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>

    </div>
  );
}
