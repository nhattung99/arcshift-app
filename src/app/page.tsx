'use client';

import { useState, useEffect } from 'react';
import { getArcClient } from '@/lib/arcClient';
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { getErc20Decimals, getNativeDecimals, isGasInsufficientError } from '@/lib/arcConstants';
import { sendErc20WithArcMemo } from '@/lib/arcMemo';
import { bridgeEurcViaCctp, getEurcBridgeTargets, isEurcCctpRoute } from '@/lib/cctpEurc';
import { 
  Wallet, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  ArrowDownUp,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import BaseAgentTab from '@/components/BaseAgentTab';
import AgentIdentityTab from '@/components/AgentIdentityTab';

type Tab = 'home' | 'swap' | 'send' | 'bridge' | 'agent' | 'base-agent' | 'identity';

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  text: string;
  txHash?: string;
  steps?: string[];
  currentStepIndex?: number;
}

interface Token {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
}

const SUPPORTED_TOKENS: Token[] = [
  { symbol: 'USDC', name: 'USD Coin', balance: '1,250.50', decimals: 6 },
  { symbol: 'EURC', name: 'Euro Coin', balance: '420.00', decimals: 6 },
  { symbol: 'USYC', name: 'US Yield Coin', balance: '500.00', decimals: 6 },
  { symbol: 'cirBTC', name: 'Circle Bitcoin', balance: '0.025', decimals: 8 },
];

const CHAIN_MAP: Record<number, { 
  name: string; 
  key: string; 
  isTestnet: boolean; 
  rpc: string; 
  usdc: string; 
  eurc: string; 
  usyc: string;
  cirbtc: string;
  nativeSymbol: string;
  nativeName: string;
  blockExplorer: string;
}> = {
  5042002: {
    name: 'Arc Testnet',
    key: 'Arc_Testnet',
    isTestnet: true,
    rpc: 'https://rpc.testnet.arc.network/',
    usdc: '0x3600000000000000000000000000000000000000',
    eurc: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    usyc: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
    cirbtc: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
    nativeSymbol: 'USDC',
    nativeName: 'USDC',
    blockExplorer: 'https://testnet.arcscan.app'
  },
  11155111: {
    name: 'Ethereum Sepolia',
    key: 'Ethereum_Sepolia',
    isTestnet: true,
    rpc: 'https://ethereum-sepolia.publicnode.com',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    eurc: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
    usyc: '',
    cirbtc: '',
    nativeSymbol: 'ETH',
    nativeName: 'Sepolia Ether',
    blockExplorer: 'https://sepolia.etherscan.io'
  },
  84532: {
    name: 'Base Sepolia',
    key: 'Base_Sepolia',
    isTestnet: true,
    rpc: 'https://sepolia.base.org',
    usdc: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
    eurc: '0x808456652fdb597867f38412077a9182bf77359f',
    usyc: '',
    cirbtc: '',
    nativeSymbol: 'ETH',
    nativeName: 'Sepolia Ether',
    blockExplorer: 'https://sepolia.basescan.org'
  },
  8453: {
    name: 'Base Mainnet',
    key: 'Base_Mainnet',
    isTestnet: false,
    rpc: 'https://mainnet.base.org',
    usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    eurc: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
    usyc: '',
    cirbtc: '',
    nativeSymbol: 'ETH',
    nativeName: 'Ether',
    blockExplorer: 'https://basescan.org'
  },
  421614: {
    name: 'Arbitrum Sepolia',
    key: 'Arbitrum_Sepolia',
    isTestnet: true,
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    eurc: '',
    usyc: '',
    cirbtc: '',
    nativeSymbol: 'ETH',
    nativeName: 'Sepolia Ether',
    blockExplorer: 'https://sepolia.arbiscan.io'
  },
  11155420: {
    name: 'Optimism Sepolia',
    key: 'Optimism_Sepolia',
    isTestnet: true,
    rpc: 'https://sepolia.optimism.io',
    usdc: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    eurc: '',
    usyc: '',
    cirbtc: '',
    nativeSymbol: 'ETH',
    nativeName: 'Sepolia Ether',
    blockExplorer: 'https://sepolia-optimism.etherscan.io'
  },
  43113: {
    name: 'Avalanche Fuji',
    key: 'Avalanche_Fuji',
    isTestnet: true,
    rpc: 'https://api.avax-test.network/ext/bc/C/rpc',
    usdc: '0x5425890298aed601595a70ab815c96711a31bc65',
    eurc: '0x5e44db7996c682e92a960b65ac713a54ad815c6b',
    usyc: '',
    cirbtc: '',
    nativeSymbol: 'AVAX',
    nativeName: 'Fuji AVAX',
    blockExplorer: 'https://testnet.snowtrace.io'
  },
  80002: {
    name: 'Polygon Amoy',
    key: 'Polygon_Amoy_Testnet',
    isTestnet: true,
    rpc: 'https://rpc-amoy.polygon.technology',
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    eurc: '',
    usyc: '',
    cirbtc: '',
    nativeSymbol: 'POL',
    nativeName: 'Amoy POL',
    blockExplorer: 'https://amoy.polygonscan.com'
  }
};

const getChainDisplayName = (keyOrName: string): string => {
  const displayMap: Record<string, string> = {
    'Arc_Testnet': 'Arc Testnet',
    'Ethereum_Sepolia': 'Ethereum Sepolia',
    'Base_Sepolia': 'Base Sepolia',
    'Base_Mainnet': 'Base Mainnet',
    'Arbitrum_Sepolia': 'Arbitrum Sepolia',
    'Avalanche_Fuji': 'Avalanche Fuji',
    'Polygon_Amoy_Testnet': 'Polygon Amoy',
    'Optimism_Sepolia': 'Optimism Sepolia',
  };
  return displayMap[keyOrName] || keyOrName;
};

const getTokenBadge = (symbol: string) => {
  switch (symbol) {
    case 'USDC':
      return { bg: 'bg-blue-600/20 border-blue-500/40 text-blue-400', letter: '◎' };
    case 'EURC':
      return { bg: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400', letter: '€' };
    case 'USYC':
      return { bg: 'bg-yellow-600/20 border-yellow-500/40 text-yellow-400', letter: 'Y' };
    case 'cirBTC':
      return { bg: 'bg-orange-600/20 border-orange-500/40 text-orange-400', letter: '₿' };
    default:
      return { bg: 'bg-slate-600/20 border-slate-500/40 text-slate-400', letter: symbol.slice(0, 1) };
  }
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  
  // Wallet State
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isSandbox, setIsSandbox] = useState<boolean>(true);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<Token[]>(SUPPORTED_TOKENS);

  // Agent Wallet State
  const [agentUsdcBalance, setAgentUsdcBalance] = useState<string>('0.00');
  const [agentEurcBalance, setAgentEurcBalance] = useState<string>('0.00');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [dailyLimit, setDailyLimit] = useState<string>('100');
  const [ruleAutoSwap, setRuleAutoSwap] = useState<boolean>(true);
  const [ruleAutoBridge, setRuleAutoBridge] = useState<boolean>(false);

  const agentWalletAddress = walletAddress 
    ? `0xAgent${walletAddress.slice(7)}` 
    : '0xAgent74b37a9e93c406e0cf49ce953';

  const handleDepositToAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || isNaN(parseFloat(depositAmount))) return;
    const amountVal = parseFloat(depositAmount);
    
    // Check main wallet USDC balance
    const usdcToken = walletBalance.find(t => t.symbol === 'USDC');
    const currentUsdc = usdcToken ? parseFloat(usdcToken.balance.replace(/,/g, '')) : 0;
    
    if (currentUsdc < amountVal && !isSandbox) {
      setStatus({ type: 'error', text: 'Insufficient USDC balance in main connected wallet.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', text: 'Initiating smart contract wallet transfer via Circle Developer API...' });
    
    setTimeout(() => {
      // Deduct from main balance
      setWalletBalance(prev => prev.map(t => {
        if (t.symbol === 'USDC') {
          const newBal = Math.max(0, parseFloat(t.balance.replace(/,/g, '')) - amountVal);
          return { ...t, balance: newBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) };
        }
        return t;
      }));
      // Add to agent balance
      setAgentUsdcBalance(prev => (parseFloat(prev) + amountVal).toFixed(2));
      
      const mockHash = '0x' + Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      setStatus({
        type: 'success',
        text: `Successfully deposited ${amountVal.toFixed(2)} USDC to Agent Wallet. Gas tank funded!`,
        txHash: mockHash
      });
      setDepositAmount('');
      setLoading(false);
    }, 1500);
  };

  const handleSaveBotConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const steps = [
      "AI Agent initializing machine-speed loops...",
      "Generating cryptographic session keys",
      `Registering Agent Wallet with Circle Agent Stack`,
      `Setting daily budget threshold: ${dailyLimit} USDC`,
      ...(ruleAutoSwap ? ["Active trigger: Swap USDC to EURC when target rate met"] : []),
      ...(ruleAutoBridge ? ["Active trigger: Auto-Bridge to Base chain on Ethereum gas surge"] : [])
    ];
    
    runSandboxSimulation(
      'Agent Setup',
      steps,
      `Circle Agent Stack successfully registered user's customized rules. Telemetry active!`,
      () => {
        // Callback
      }
    );
  };

  // Intercept fetch globally to proxy api.circle.com calls and bypass CORS
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        let url = '';
        if (typeof input === 'string') {
          url = input;
        } else if (input instanceof URL) {
          url = input.toString();
        } else if (input && typeof input === 'object' && 'url' in input) {
          url = (input as any).url;
        }

        if (url.startsWith('https://api.circle.com')) {
          const proxyUrl = url.replace('https://api.circle.com', '/api/circle');
          console.log(`[Fetch Interceptor] Proxying request to: ${proxyUrl}`);
          
          if (typeof input === 'string') {
            return originalFetch(proxyUrl, init);
          } else if (input instanceof URL) {
            return originalFetch(new URL(proxyUrl, window.location.origin), init);
          } else {
            const newRequest = new Request(proxyUrl, input as any);
            return originalFetch(newRequest);
          }
        }
        
        return originalFetch(input, init);
      };
      
      return () => {
        window.fetch = originalFetch;
      };
    }
  }, []);

  // Custom Token Selector Modal State
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState<boolean>(false);
  const [selectorType, setSelectorType] = useState<'in' | 'out' | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState<string>('');

  // Navbar Network switcher dropdown state
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState<boolean>(false);

  // Form States
  const [formData, setFormData] = useState({
    amount: '',
    tokenIn: 'USDC',
    tokenOut: 'EURC',
    recipient: '',
    sourceChain: 'Arc_Testnet',
    targetChain: 'Ethereum_Sepolia',
    destinationRecipient: '',
    memo: '',
    bridgeToken: 'USDC',
  });

  const getTargetChainOptions = () => {
    const activeSource = isSandbox 
      ? formData.sourceChain 
      : (currentChainId && CHAIN_MAP[currentChainId] ? CHAIN_MAP[currentChainId].key : 'Arc_Testnet');

    if (formData.bridgeToken === 'EURC') {
      return getEurcBridgeTargets(activeSource);
    }
      
    if (activeSource === 'Arc_Testnet') {
      return [
        { value: 'Ethereum_Sepolia', label: 'Ethereum Sepolia' },
        { value: 'Base_Sepolia', label: 'Base Sepolia' },
      ];
    } else {
      return [
        { value: 'Arc_Testnet', label: 'Arc Testnet' },
      ];
    }
  };

  // Synchronize targetChain dropdown selection when sourceChain or wallet network changes
  useEffect(() => {
    const validTargets = getTargetChainOptions().map(opt => opt.value);
    if (!validTargets.includes(formData.targetChain) && validTargets.length > 0) {
      setFormData(prev => ({ ...prev, targetChain: validTargets[0] }));
    }
  }, [currentChainId, isSandbox, formData.sourceChain, formData.targetChain, formData.bridgeToken]);

  // Autodetect Wallet and Sandbox mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.ethereum) {
        setIsSandbox(false);
        
        // Get initial account
        window.ethereum.request({ method: 'eth_accounts' })
          .then((accounts: any) => {
            if (accounts && accounts[0]) {
              setWalletAddress(accounts[0]);
            }
          })
          .catch((err: any) => {
            console.error("Error checking account:", err);
          });

        // Get initial chain
        window.ethereum.request({ method: 'eth_chainId' })
          .then((rawChainId: any) => {
            let chainId;
            if (typeof rawChainId === 'number') {
              chainId = rawChainId;
            } else if (typeof rawChainId === 'string') {
              chainId = rawChainId.startsWith('0x') ? parseInt(rawChainId, 16) : parseInt(rawChainId, 10);
            }
            if (chainId) {
              setCurrentChainId(chainId);
            }
          })
          .catch((err: any) => {
            console.error("Error checking chain ID:", err);
          });

        // Listen for account changes
        const handleAccountsChanged = (accounts: string[]) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setIsSandbox(false);
          } else {
            setWalletAddress('');
            setIsSandbox(true);
            setCurrentChainId(null);
          }
        };

        // Listen for chain changes
        const handleChainChanged = (rawChainId: any) => {
          let chainId;
          if (typeof rawChainId === 'number') {
            chainId = rawChainId;
          } else if (typeof rawChainId === 'string') {
            chainId = rawChainId.startsWith('0x') ? parseInt(rawChainId, 16) : parseInt(rawChainId, 10);
          }
          if (chainId) {
            setCurrentChainId(chainId);
          }
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
          if (window.ethereum.removeListener) {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
          }
        };
      } else {
        // No wallet, default to Sandbox Mode
        setIsSandbox(true);
        setWalletAddress('0xSandboxDemoWalletAddress389Cc1E1d165');
      }
    }
  }, []);

  // Fetch real on-chain balances when wallet is connected
  const fetchRealBalances = async (address: string, chainIdOverride?: number) => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    
    try {
      let chainId = chainIdOverride;
      if (!chainId) {
        const rawChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (typeof rawChainId === 'number') {
          chainId = rawChainId;
        } else if (typeof rawChainId === 'string') {
          chainId = rawChainId.startsWith('0x') ? parseInt(rawChainId, 16) : parseInt(rawChainId, 10);
        } else {
          chainId = 5042002; // default to Arc Testnet
        }
      }
      
      setCurrentChainId(chainId);
      
      const chainInfo = CHAIN_MAP[chainId] || CHAIN_MAP[5042002];
      const rpcUrl = chainInfo.rpc;
      const usdcAddress = chainInfo.usdc;
      const eurcAddress = chainInfo.eurc;
      const usycAddress = chainInfo.usyc;
      const cirbtcAddress = chainInfo.cirbtc;
      const nativeSymbol = chainInfo.nativeSymbol;
      const nativeName = chainInfo.nativeName;
      
      const client = createPublicClient({
        transport: http(rpcUrl),
      });
      
      // Fetch Native Balance
      let ethBalance = '0.0000';
      try {
        const ethBalanceWei = await client.getBalance({ address: address as `0x${string}` });
        ethBalance = parseFloat(formatUnits(ethBalanceWei, 18)).toFixed(4);
      } catch (err) {
        console.warn(`Failed to fetch native balance on ${chainInfo.name}:`, err);
      }
      
      // Helper to fetch ERC20 balance
      const getErc20Balance = async (tokenAddress: string, decimals: number) => {
        if (!tokenAddress) return '0.00';
        try {
          const bal = await client.readContract({
            address: tokenAddress as `0x${string}`,
            abi: [{
              inputs: [{ name: 'owner', type: 'address' }],
              name: 'balanceOf',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            }],
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
          }) as bigint;
          return parseFloat(formatUnits(bal, decimals)).toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 4 
          });
        } catch (e) {
          console.warn(`Error fetching balance for ${tokenAddress} on ${chainInfo.name}:`, e);
          return '0.00';
        }
      };
      
      let usdcBal = '0.00';
      let eurcBal = '0.00';
      let usycBal = '0.00';
      let cirbtcBal = '0.00';
      
      // On Arc, native USDC (18 decimals) and ERC-20 USDC (6 decimals) share one balance.
      // Prefer the native 18-decimal view for display; ERC-20 truncates dust below 1e-6.
      if (nativeSymbol !== 'USDC' && usdcAddress) {
        try {
          usdcBal = await getErc20Balance(usdcAddress, 6);
        } catch (e) {
          console.warn(`Failed to fetch USDC balance on ${chainInfo.name}:`, e);
        }
      }
      
      if (eurcAddress) {
        try {
          eurcBal = await getErc20Balance(eurcAddress, 6);
        } catch (e) {
          console.warn(`Failed to fetch EURC balance on ${chainInfo.name}:`, e);
        }
      }

      if (usycAddress) {
        try {
          usycBal = await getErc20Balance(usycAddress, 6);
        } catch (e) {
          console.warn(`Failed to fetch USYC balance on ${chainInfo.name}:`, e);
        }
      }

      if (cirbtcAddress) {
        try {
          cirbtcBal = await getErc20Balance(cirbtcAddress, 8);
        } catch (e) {
          console.warn(`Failed to fetch cirBTC balance on ${chainInfo.name}:`, e);
        }
      }
      
      console.log(`Balances fetched from public RPC (${rpcUrl}) for address ${address} (Chain: ${chainInfo.name}):`, {
        native: `${ethBalance} ${nativeSymbol}`,
        usdc: nativeSymbol === 'USDC' ? ethBalance : usdcBal,
        eurc: eurcBal,
        usyc: usycBal,
        cirbtc: cirbtcBal
      });

      // Native gas token is always 18 decimals, including Arc USDC.
      const finalBalances: Token[] = [
        {
          symbol: 'USDC',
          name: 'USD Coin',
          balance: nativeSymbol === 'USDC' ? ethBalance : usdcBal,
          decimals: 6
        },
        {
          symbol: 'EURC',
          name: 'Euro Coin',
          balance: eurcBal,
          decimals: 6
        },
        {
          symbol: 'USYC',
          name: 'US Yield Coin',
          balance: usycBal,
          decimals: 6
        },
        {
          symbol: 'cirBTC',
          name: 'Circle Bitcoin',
          balance: cirbtcBal,
          decimals: 8
        },
      ];
      setWalletBalance(finalBalances);
    } catch (error) {
      console.error("Error fetching real balances:", error);
    }
  };

  useEffect(() => {
    if (walletAddress && !isSandbox) {
      fetchRealBalances(walletAddress);
      
      // Poll balances every 12 seconds
      const interval = setInterval(() => {
        fetchRealBalances(walletAddress);
      }, 12000);
      return () => clearInterval(interval);
    } else if (isSandbox) {
      // Revert to default mock balances in sandbox mode
      setWalletBalance(SUPPORTED_TOKENS);
      setCurrentChainId(null);
    }
  }, [walletAddress, isSandbox]);

  // Keep form data token selections in sync with supported tokens on chain
  useEffect(() => {
    const symbols = walletBalance.map(t => t.symbol);
    let updated = false;
    let newIn = formData.tokenIn;
    let newOut = formData.tokenOut;

    if (!symbols.includes(formData.tokenIn)) {
      newIn = symbols[0] || 'USDC';
      updated = true;
    }
    if (!symbols.includes(formData.tokenOut)) {
      const fallbackOut = symbols.find(s => s !== newIn) || symbols[1] || symbols[0];
      newOut = fallbackOut || 'EURC';
      updated = true;
    }

    if (updated) {
      setFormData(prev => ({ ...prev, tokenIn: newIn, tokenOut: newOut }));
    }
  }, [walletBalance]);

  // Update rates & outputs dynamically
  const getExchangeRate = (inToken: string, outToken: string): number => {
    if (inToken === outToken) return 1;
    
    // Approximate USD values for sandbox mock rates
    const usdPrices: Record<string, number> = {
      USDC:   1,
      EURC:   1.09,
      USYC:   1.00,   // US Yield Coin — pegged close to $1
      cirBTC: 95000,  // Circle Bitcoin — approximate BTC price
      ETH:    3200,
      AVAX:   25,
      POL:    0.40,
    };
    
    const inPrice = usdPrices[inToken] || 1;
    const outPrice = usdPrices[outToken] || 1;
    
    return inPrice / outPrice;
  };

  const exchangeRate = getExchangeRate(formData.tokenIn, formData.tokenOut);
  const estimatedOutput = formData.amount 
    ? (parseFloat(formData.amount) * exchangeRate).toFixed(4)
    : '0.00';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'sourceChain') {
      setFormData(prev => {
        const nextTargets = prev.bridgeToken === 'EURC'
          ? getEurcBridgeTargets(value)
          : (value === 'Arc_Testnet'
            ? [{ value: 'Ethereum_Sepolia' }]
            : [{ value: 'Arc_Testnet' }]);
        return {
          ...prev,
          sourceChain: value,
          targetChain: nextTargets[0]?.value || prev.targetChain,
        };
      });
    } else if (name === 'bridgeToken') {
      setFormData(prev => {
        const nextTargets = value === 'EURC'
          ? getEurcBridgeTargets(prev.sourceChain)
          : (prev.sourceChain === 'Arc_Testnet'
            ? [{ value: 'Ethereum_Sepolia' }, { value: 'Base_Sepolia' }]
            : [{ value: 'Arc_Testnet' }]);
        const nextTarget = nextTargets.some(t => t.value === prev.targetChain)
          ? prev.targetChain
          : (nextTargets[0]?.value || prev.targetChain);
        return { ...prev, bridgeToken: value, targetChain: nextTarget };
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSwapTokens = () => {
    setFormData({
      ...formData,
      tokenIn: formData.tokenOut,
      tokenOut: formData.tokenIn
    });
  };

  const handleSelectToken = (symbol: string) => {
    if (selectorType === 'in') {
      if (symbol === formData.tokenOut) {
        setFormData(prev => ({ ...prev, tokenIn: symbol, tokenOut: prev.tokenIn }));
      } else {
        setFormData(prev => ({ ...prev, tokenIn: symbol }));
      }
    } else if (selectorType === 'out') {
      if (symbol === formData.tokenIn) {
        setFormData(prev => ({ ...prev, tokenOut: symbol, tokenIn: prev.tokenOut }));
      } else {
        setFormData(prev => ({ ...prev, tokenOut: symbol }));
      }
    }
    setIsTokenSelectorOpen(false);
    setTokenSearchQuery('');
  };

  const handleMaxClick = (type: 'in' | 'out') => {
    const symbol = type === 'in' ? formData.tokenIn : formData.tokenOut;
    const token = walletBalance.find(t => t.symbol === symbol);
    if (token) {
      let rawBalance = parseFloat(token.balance.replace(/,/g, '')) || 0;
      
      const activeSource = isSandbox 
        ? formData.sourceChain 
        : (currentChainId && CHAIN_MAP[currentChainId] ? CHAIN_MAP[currentChainId].key : 'Arc_Testnet');
        
      if (activeSource === 'Arc_Testnet' && symbol === 'USDC') {
        const gasReserve = 0.5; // Reserve 0.5 USDC for gas
        if (rawBalance > gasReserve) {
          rawBalance = rawBalance - gasReserve;
          setStatus({
            type: 'info',
            text: `Automatically reserved 0.5 USDC for gas fees on Arc Testnet.`
          });
        } else {
          rawBalance = 0;
          setStatus({
            type: 'error',
            text: `Insufficient USDC balance to pay for transaction gas on Arc Testnet. Minimum 0.5 USDC recommended.`
          });
        }
      }
      
      setFormData(prev => ({ ...prev, amount: rawBalance.toString() }));
    }
  };

  const handleNetworkChange = async (chainKey: string) => {
    if (isSandbox) {
      setFormData(prev => ({ 
        ...prev, 
        sourceChain: chainKey,
        targetChain: chainKey === 'Arc_Testnet' ? 'Ethereum_Sepolia' : 'Arc_Testnet'
      }));
      setStatus({
        type: 'success',
        text: `Sandbox network simulated to ${getChainDisplayName(chainKey)}!`
      });
    } else {
      const chainIdMap: Record<string, number> = {
        'Arc_Testnet': 5042002,
        'Ethereum_Sepolia': 11155111,
        'Base_Sepolia': 84532,
        'Base_Mainnet': 8453,
      };
      const targetChainId = chainIdMap[chainKey];
      if (targetChainId) {
        await requestSwitchChain(targetChainId);
      }
    }
  };

  const requestSwitchChain = async (chainId: number) => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    try {
      setLoading(true);
      const hexChainId = `0x${chainId.toString(16)}`;
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
      setStatus({
        type: 'success',
        text: `Switched wallet network successfully!`
      });
    } catch (switchError: any) {
      if (switchError.code === 4902 || (switchError.data && switchError.data.originalError && switchError.data.originalError.code === 4902)) {
        try {
          const chainInfo = CHAIN_MAP[chainId];
          if (!chainInfo) return;
          const hexChainId = `0x${chainId.toString(16)}`;
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: chainInfo.name,
                rpcUrls: [chainInfo.rpc],
                nativeCurrency: {
                  name: chainInfo.nativeName,
                  symbol: chainInfo.nativeSymbol,
                  // Arc native USDC uses 18 decimals for gas / msg.value (ERC-20 view is 6).
                  decimals: getNativeDecimals(),
                },
                blockExplorerUrls: [chainInfo.blockExplorer],
              },
            ],
          });
          setStatus({
            type: 'success',
            text: `Added and switched to ${chainInfo.name} successfully!`
          });
        } catch (addError: any) {
          console.error("Error adding network:", addError);
          setStatus({
            type: 'error',
            text: addError.message || `Failed to add ${CHAIN_MAP[chainId]?.name} to wallet.`
          });
        }
      } else {
        console.error("Error switching network:", switchError);
        setStatus({
          type: 'error',
          text: switchError.message || 'Failed to switch network.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        setLoading(true);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          setWalletAddress(accounts[0]);
          setIsSandbox(false);
          setStatus({
            type: 'success',
            text: 'Wallet connected successfully!'
          });
        }
      } catch (err: any) {
        setStatus({
          type: 'error',
          text: err.message || 'Failed to connect wallet.'
        });
      } finally {
        setLoading(false);
      }
    } else {
      setStatus({
        type: 'info',
        text: 'Metamask/Web3 wallet not found. Running in Sandbox Simulation Mode.'
      });
    }
  };

  const runSandboxSimulation = async (
    actionName: string, 
    steps: string[], 
    successMessage: string,
    onFinish: () => void
  ) => {
    setLoading(true);
    let currentStep = 0;
    setStatus({
      type: 'info',
      text: steps[0],
      steps,
      currentStepIndex: 0
    });

    const runNextStep = () => {
      currentStep++;
      if (currentStep < steps.length) {
        setStatus({
          type: 'info',
          text: steps[currentStep],
          steps,
          currentStepIndex: currentStep
        });
        setTimeout(runNextStep, 1500);
      } else {
        const mockHash = '0x' + Array.from({ length: 64 }, () => 
          Math.floor(Math.random() * 16).toString(16)
        ).join('');
        setStatus({
          type: 'success',
          text: successMessage,
          txHash: mockHash
        });
        setLoading(false);
        onFinish();
      }
    };

    setTimeout(runNextStep, 1500);
  };

  const mapTokenSymbolForTransaction = (symbol: string): string => {
    // Determine active chain
    const chainId = currentChainId || 5042002;
    const chainInfo = CHAIN_MAP[chainId] || CHAIN_MAP[5042002];
    
    // On Arc Testnet: USDC is the native gas token → use 'NATIVE'
    // All other tokens must use their contract address
    if (symbol === chainInfo.nativeSymbol) {
      return 'NATIVE';
    }
    
    // Map each token symbol to its contract address for the Circle SDK
    const symbolLower = symbol.toLowerCase();
    if (symbolLower === 'eurc' && chainInfo.eurc) return chainInfo.eurc;
    if (symbolLower === 'usyc' && chainInfo.usyc) return chainInfo.usyc;
    if (symbolLower === 'cirbtc' && chainInfo.cirbtc) return chainInfo.cirbtc;
    if (symbolLower === 'usdc') return 'NATIVE'; // USDC = native on Arc
    
    // Fallback: return symbol as-is (works for ETH on non-Arc chains)
    if (symbol === 'ETH') return 'NATIVE';
    return symbol;
  };

  const mapTokenSymbolForSwap = (symbol: string): string => {
    const chainId = currentChainId || 5042002;
    const chainInfo = CHAIN_MAP[chainId] || CHAIN_MAP[5042002];
    const symbolLower = symbol.toLowerCase();
    
    // On Arc Testnet: USDC is the native gas token, but for swaps we must use its ERC-20 contract address.
    if (symbolLower === 'usdc' && chainId === 5042002) {
      return chainInfo.usdc;
    }
    
    if (symbol === chainInfo.nativeSymbol) {
      return 'NATIVE';
    }
    
    if (symbolLower === 'eurc' && chainInfo.eurc) return chainInfo.eurc;
    if (symbolLower === 'usyc' && chainInfo.usyc) return chainInfo.usyc;
    if (symbolLower === 'cirbtc' && chainInfo.cirbtc) return chainInfo.cirbtc;
    if (symbolLower === 'usdc' && chainInfo.usdc) return chainInfo.usdc;
    
    if (symbol === 'ETH') return 'NATIVE';
    return symbol;
  };

  // 1. SWAP ACTION
  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) return;

    if (isSandbox) {
      const currentChainName = currentChainId && CHAIN_MAP[currentChainId] ? CHAIN_MAP[currentChainId].name : 'Sandbox Testnet';
      const steps = [
        `Analyzing route: ${formData.tokenIn} → ${formData.tokenOut} on ${currentChainName} (Arc Route Optimizer)`,
        `Acquiring allowance for ${formData.tokenIn} access`,
        `Signing transaction signature on Sandbox Network`,
        `Submitting order to liquidity pool router`,
      ];
      await runSandboxSimulation(
        'Swap',
        steps,
        `Successfully swapped ${formData.amount} ${formData.tokenIn} for ${estimatedOutput} ${formData.tokenOut}!`,
        () => {
          setWalletBalance(prev => prev.map(t => {
            if (t.symbol === formData.tokenIn) {
              const newBal = parseFloat(t.balance.replace(/,/g, '')) - parseFloat(formData.amount);
              return { ...t, balance: newBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) };
            }
            if (t.symbol === formData.tokenOut) {
              const newBal = parseFloat(t.balance.replace(/,/g, '')) + parseFloat(estimatedOutput);
              return { ...t, balance: newBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) };
            }
            return t;
          }));
        }
      );
      return;
    }

    // Live Web3 Mode
    const chainKey = currentChainId && CHAIN_MAP[currentChainId] 
      ? CHAIN_MAP[currentChainId].key 
      : 'Arc_Testnet';

    // Verify Gas Tank balance for USDC gas tokens on Arc Testnet
    if (chainKey === 'Arc_Testnet') {
      const usdcToken = walletBalance.find(t => t.symbol === 'USDC');
      const usdcBalance = usdcToken ? parseFloat(usdcToken.balance.replace(/,/g, '')) : 0;
      const amountVal = parseFloat(formData.amount);
      const isTransactingUSDC = formData.tokenIn === 'USDC';
      const requiredGas = 0.05;

      if (isTransactingUSDC) {
        if (amountVal + requiredGas > usdcBalance) {
          setStatus({
            type: 'error',
            text: `Transaction Simulation Failed: You are attempting to swap ${amountVal} USDC, leaving only ${(usdcBalance - amountVal).toFixed(4)} USDC. Please reserve at least 0.05 USDC to pay for native gas fees on Arc Testnet.`
          });
          return;
        }
      } else {
        if (usdcBalance < requiredGas) {
          setStatus({
            type: 'error',
            text: `Transaction Simulation Failed: Insufficient USDC gas tank balance. You need at least 0.05 USDC to pay for native gas fees on Arc Testnet.`
          });
          return;
        }
      }
    }

    setLoading(true);
    setStatus({ type: 'info', text: 'Initiating swap transaction via Arc SDK...' });
    const activeKitKey = process.env.NEXT_PUBLIC_KIT_KEY || process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY;
    console.log("Initiating swap with config:", {
      chainKey,
      tokenIn: formData.tokenIn,
      tokenOut: formData.tokenOut,
      amountIn: formData.amount,
      kitKey: activeKitKey && activeKitKey.trim() !== '' 
        ? `${activeKitKey.trim().slice(0, 15)}...` 
        : 'undefined/empty'
    });

    try {
      const { appKit, adapter } = await getArcClient();
      const kitKey = activeKitKey;
      const tx = await appKit.swap({
        from: { adapter, chain: chainKey as any },
        tokenIn: mapTokenSymbolForSwap(formData.tokenIn) as any,
        tokenOut: mapTokenSymbolForSwap(formData.tokenOut) as any,
        amountIn: formData.amount,
        config: {
          allowanceStrategy: 'approve',
          ...(kitKey && kitKey.trim() !== '' ? { kitKey: kitKey.trim() } : {})
        }
      });
      setStatus({ 
        type: 'success', 
        text: `Swap transaction successful!`, 
        txHash: tx.txHash 
      });
    } catch (error: any) {
      console.error("Swap error details:", error);
      let errorMsg = error.message || 'Transaction failed.';
      if (errorMsg.includes('No route available') || errorMsg.includes('route or resource not found') || errorMsg.includes('INPUT_UNSUPPORTED_ROUTE')) {
        errorMsg = 'No liquidity route available for this token pair on Arc Testnet. Please swap between USDC and EURC, which is the primary pair supported by Circle\'s testnet liquidity.';
      } else if (errorMsg.includes('Simulation failed') || errorMsg.includes('reverted') || isGasInsufficientError(errorMsg)) {
        if (chainKey === 'Arc_Testnet') {
          errorMsg = `Simulation failed: Transaction reverted. This is likely due to insufficient native USDC gas. On Arc Testnet, gas is paid in USDC (18-decimal native) — keep at least 0.05 USDC remaining.`;
        }
      }
      setStatus({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // 2. SEND ACTION
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.recipient) return;

    if (isSandbox) {
      const steps = [
        `Checking destination address: ${formData.recipient}`,
        `Validating asset reserves in sandbox balance`,
        `Signing multi-sig validation wrapper`,
        `Broadcasting payload to network`,
      ];
      await runSandboxSimulation(
        'Send',
        steps,
        `Transferred ${formData.amount} ${formData.tokenIn} to ${formData.recipient.slice(0, 6)}...${formData.recipient.slice(-4)} successfully!`,
        () => {
          setWalletBalance(prev => prev.map(t => {
            if (t.symbol === formData.tokenIn) {
              const newBal = parseFloat(t.balance.replace(/,/g, '')) - parseFloat(formData.amount);
              return { ...t, balance: newBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) };
            }
            return t;
          }));
        }
      );
      return;
    }

    // Live Web3 Mode
    const chainKey = currentChainId && CHAIN_MAP[currentChainId] 
      ? CHAIN_MAP[currentChainId].key 
      : 'Arc_Testnet';

    // Verify Gas Tank balance for USDC gas tokens on Arc Testnet
    if (chainKey === 'Arc_Testnet') {
      const usdcToken = walletBalance.find(t => t.symbol === 'USDC');
      const usdcBalance = usdcToken ? parseFloat(usdcToken.balance.replace(/,/g, '')) : 0;
      const amountVal = parseFloat(formData.amount);
      const isTransactingUSDC = formData.tokenIn === 'USDC';
      const requiredGas = 0.05;

      if (isTransactingUSDC) {
        if (amountVal + requiredGas > usdcBalance) {
          setStatus({
            type: 'error',
            text: `Transaction Simulation Failed: You are attempting to transfer ${amountVal} USDC, leaving only ${(usdcBalance - amountVal).toFixed(4)} USDC. Please reserve at least 0.05 USDC to pay for native gas fees on Arc Testnet.`
          });
          return;
        }
      } else {
        if (usdcBalance < requiredGas) {
          setStatus({
            type: 'error',
            text: `Transaction Simulation Failed: Insufficient USDC gas tank balance. You need at least 0.05 USDC to pay for native gas fees on Arc Testnet.`
          });
          return;
        }
      }
    }

    setLoading(true);

    if (formData.memo) {
      setStatus({ type: 'info', text: `Initiating transfer with on-chain memo: "${formData.memo}"...` });
      try {
        const isArc = chainKey === 'Arc_Testnet';
        let txHash: `0x${string}`;

        if (isArc) {
          const chainInfo = CHAIN_MAP[currentChainId || 5042002];
          const mappedToken = formData.tokenIn === 'USDC'
            ? chainInfo.usdc
            : mapTokenSymbolForTransaction(formData.tokenIn);
          if (!mappedToken || mappedToken === 'NATIVE') {
            throw new Error('Arc memos require an ERC-20 target. Use USDC, EURC, USYC, or cirBTC.');
          }
          txHash = await sendErc20WithArcMemo({
            tokenAddress: mappedToken as `0x${string}`,
            tokenSymbol: formData.tokenIn,
            amount: formData.amount,
            recipient: formData.recipient as `0x${string}`,
            memo: formData.memo,
            account: walletAddress as `0x${string}`,
          });
        } else {
          const { createWalletClient, custom, stringToHex } = await import('viem');
          const walletClient = createWalletClient({
            chain: { id: currentChainId || 5042002 } as any,
            transport: custom(window.ethereum)
          });
          const tokenAddress = mapTokenSymbolForTransaction(formData.tokenIn);
          if (tokenAddress !== 'NATIVE') {
            throw new Error('Structured transaction memos are supported on Arc Testnet. On other chains, memos attach only to native transfers.');
          }
          const amountBI = parseUnits(formData.amount, getNativeDecimals());
          txHash = await walletClient.sendTransaction({
            account: walletAddress as `0x${string}`,
            to: formData.recipient as `0x${string}`,
            value: amountBI,
            data: stringToHex(formData.memo)
          } as any);
        }

        setStatus({ 
          type: 'success', 
          text: `Transfer successful! On-chain memo recorded: "${formData.memo}"`, 
          txHash: txHash 
        });
      } catch (error: any) {
        setStatus({ type: 'error', text: error.message || 'Transaction failed.' });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Default SDK send if no memo
    setStatus({ type: 'info', text: 'Initiating transfer via Arc SDK...' });
    try {
      const { appKit, adapter } = await getArcClient();
      const kitKey = process.env.NEXT_PUBLIC_KIT_KEY || process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY;
      const tx = await appKit.send({
        from: { adapter, chain: chainKey as any },
        to: formData.recipient,
        amount: formData.amount,
        token: mapTokenSymbolForTransaction(formData.tokenIn) as any,
        ...(kitKey && kitKey.trim() !== '' ? { config: { kitKey: kitKey.trim() } } : {}),
      });
      setStatus({ 
        type: 'success', 
        text: `Transfer successful!`, 
        txHash: tx.txHash 
      });
    } catch (error: any) {
      let errorMsg = error.message || 'Transaction failed.';
      if (errorMsg.includes('Simulation failed') || errorMsg.includes('reverted') || isGasInsufficientError(errorMsg)) {
        if (chainKey === 'Arc_Testnet') {
          errorMsg = `Simulation failed: Transaction reverted. This is likely due to insufficient native USDC gas. On Arc Testnet, gas is paid in USDC (18-decimal native) — keep at least 0.05 USDC remaining.`;
        }
      }
      setStatus({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // 3. BRIDGE ACTION
  const handleBridge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) return;
    const bridgeToken = formData.bridgeToken || 'USDC';

    if (isSandbox) {
      const isEurc = bridgeToken === 'EURC';
      const steps = isEurc
        ? [
            `Burning native EURC on ${getChainDisplayName(formData.sourceChain)} via CrossChainTokenService`,
            `Requesting Iris attestation (CCTP for non-USDC)`,
            `Forwarding mint to ${getChainDisplayName(formData.targetChain)}`,
            `Minting equivalent EURC on destination chain`,
          ]
        : [
            `Burning USDC on source chain: ${getChainDisplayName(formData.sourceChain)}`,
            `Waiting for confirmation blocks from validator network`,
            `Calling Circle CCTP Attestation Service`,
            `Minting equivalent USDC on target chain: ${getChainDisplayName(formData.targetChain)}`,
          ];
      await runSandboxSimulation(
        'Bridge',
        steps,
        `Successfully bridged ${formData.amount} ${bridgeToken} from ${getChainDisplayName(formData.sourceChain)} to ${getChainDisplayName(formData.targetChain)}!`,
        () => {
          setWalletBalance(prev => prev.map(t => {
            if (t.symbol === bridgeToken) {
              const newBal = parseFloat(t.balance.replace(/,/g, '')) - parseFloat(formData.amount);
              return { ...t, balance: newBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) };
            }
            return t;
          }));
        }
      );
      return;
    }

    const sourceChainKey = currentChainId && CHAIN_MAP[currentChainId] 
      ? CHAIN_MAP[currentChainId].key 
      : 'Arc_Testnet';

    if (sourceChainKey === 'Arc_Testnet') {
      const usdcToken = walletBalance.find(t => t.symbol === 'USDC');
      const usdcBalance = usdcToken ? parseFloat(usdcToken.balance.replace(/,/g, '')) : 0;
      const amountVal = parseFloat(formData.amount);
      const requiredGas = 0.05;

      if (bridgeToken === 'USDC') {
        if (amountVal + requiredGas > usdcBalance) {
          setStatus({
            type: 'error',
            text: `Transaction Simulation Failed: You are attempting to bridge ${amountVal} USDC, leaving only ${(usdcBalance - amountVal).toFixed(4)} USDC. Please reserve at least 0.05 USDC to pay for native gas fees on Arc Testnet.`
          });
          return;
        }
      } else if (usdcBalance < requiredGas) {
        setStatus({
          type: 'error',
          text: 'Insufficient USDC gas tank. Keep at least 0.05 USDC on Arc Testnet to pay native gas (EURC CCTP fees are paid in native gas).'
        });
        return;
      }
    }

    if (bridgeToken === 'EURC' && !isEurcCctpRoute(sourceChainKey, formData.targetChain)) {
      setStatus({
        type: 'error',
        text: 'EURC CCTP currently supports Ethereum Sepolia, Base Sepolia, and Arc Testnet. Switch source/destination to a supported pair.',
      });
      return;
    }

    setLoading(true);
    setStatus({
      type: 'info',
      text: bridgeToken === 'EURC'
        ? 'Initiating EURC bridge via CCTP for non-USDC (CrossChainTokenService)...'
        : 'Initiating USDC bridge via Circle CCTP & Arc SDK...'
    });
    try {
      const targetChainKey = formData.targetChain;
      const recipient = (formData.destinationRecipient || walletAddress) as `0x${string}`;

      if (bridgeToken === 'EURC') {
        const txHash = await bridgeEurcViaCctp({
          sourceChainKey,
          destChainKey: targetChainKey,
          amount: formData.amount,
          recipient,
          account: walletAddress as `0x${string}`,
          onStatus: (text) => setStatus({ type: 'info', text }),
        });
        setStatus({
          type: 'success',
          text: `EURC burn broadcasted. Circle forwarding will mint on ${getChainDisplayName(targetChainKey)}.`,
          txHash,
        });
        return;
      }

      const { appKit, adapter } = await getArcClient();
      const toObj: any = { adapter, chain: targetChainKey as any };
      if (formData.destinationRecipient) {
        toObj.recipientAddress = formData.destinationRecipient;
      }
      const tx = await appKit.bridge({
        from: { adapter, chain: sourceChainKey as any },
        to: toObj,
        amount: formData.amount,
        token: 'USDC',
      });
      
      const txHash = tx.steps.find(s => s.txHash)?.txHash || '';
      setStatus({ 
        type: 'success', 
        text: `Bridge transaction broadcasted!`, 
        txHash: txHash 
      });
    } catch (error: any) {
      let errorMsg = error.message || 'Transaction failed.';
      if (errorMsg.includes('Simulation failed') || errorMsg.includes('reverted') || isGasInsufficientError(errorMsg)) {
        if (sourceChainKey === 'Arc_Testnet') {
          errorMsg = `Simulation failed: Transaction reverted. This is likely due to insufficient native USDC gas. On Arc Testnet, gas is paid in USDC (18-decimal native) — keep at least 0.05 USDC remaining.`;
        }
      }
      setStatus({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const currentInBalance = walletBalance.find(t => t.symbol === formData.tokenIn)?.balance || '0.00';
  const currentOutBalance = walletBalance.find(t => t.symbol === formData.tokenOut)?.balance || '0.00';

  // Modal Token Filter
  const filteredTokens = walletBalance.filter(t => 
    t.symbol.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
    t.name.toLowerCase().includes(tokenSearchQuery.toLowerCase())
  );

  const activeChainKey = isSandbox 
    ? formData.sourceChain 
    : (currentChainId && CHAIN_MAP[currentChainId] ? CHAIN_MAP[currentChainId].key : 'Arc_Testnet');

  const tabLabel: Record<Tab, string> = {
    home: 'Home',
    swap: 'Swap',
    send: 'Send',
    bridge: 'Bridge',
    agent: 'Agent',
    'base-agent': 'Base',
    identity: 'Identity',
  };

  const navTabs = ['home', 'swap', 'send', 'bridge', 'agent', 'base-agent', 'identity'] as Tab[];

  return (
    <main className="relative min-h-screen text-slate-100 flex flex-col items-center">
      <div className="pointer-events-none fixed inset-0 -z-10 ds-bg ds-grid" aria-hidden="true" />

      <header className="sticky top-0 z-40 w-full flex justify-center px-4 py-4">
        <div className="pointer-events-auto relative z-10 flex w-full max-w-5xl items-center justify-between rounded-full ds-nav px-4 md:px-6 py-2.5 gap-3">
          <button
            type="button"
            onClick={() => { setActiveTab('home'); setStatus(null); }}
            className="flex items-center gap-2 cursor-pointer select-none shrink-0"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M2 17c3-1.5 5-1.5 8 0s5 1.5 8 0 5-1.5 8 0" />
              <path d="M2 12c3-1.5 5-1.5 8 0s5 1.5 8 0 5-1.5 8 0" />
              <path d="M2 7c3-1.5 5-1.5 8 0s5 1.5 8 0 5-1.5 8 0" />
            </svg>
            <span className="text-sm font-semibold tracking-tight text-white">ArcShift</span>
          </button>

          <nav className="hidden md:flex items-center gap-6" aria-label="Main">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setActiveTab(tab); setStatus(null); }}
                  className={`relative text-sm font-medium transition-colors cursor-pointer ${
                    isActive ? 'text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {tabLabel[tab]}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-1.5 mx-auto h-1 w-1 rounded-full bg-white" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:inline-flex items-center h-9 px-3 rounded-full text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              Faucet
            </a>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
                className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeChainKey === 'Arc_Testnet' ? 'bg-indigo-400' : 'bg-slate-400'}`} />
                {getChainDisplayName(activeChainKey)}
                <ChevronDown size={12} className="text-white/40" />
              </button>

              {isNetworkDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 ds-card rounded-2xl shadow-2xl p-1.5 z-50 animate-scale-in">
                  {(['Arc_Testnet', 'Ethereum_Sepolia', 'Base_Sepolia', 'Base_Mainnet'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        handleNetworkChange(key);
                        setIsNetworkDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs hover:bg-white/5 transition-colors text-slate-300 hover:text-white"
                    >
                      {getChainDisplayName(key)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {walletAddress ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-full border border-white/10 text-xs text-white/80 font-mono select-none">
                <Wallet size={13} />
                <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={connectWallet}
                className="h-9 px-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="md:hidden w-full max-w-5xl px-4 pb-2 flex gap-1 overflow-x-auto" aria-label="Mobile">
        {navTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); setStatus(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              activeTab === tab ? 'bg-white/10 text-white' : 'text-white/50'
            }`}
          >
            {tabLabel[tab]}
          </button>
        ))}
      </nav>

      {/* Warning Banner if kitKey is missing or invalid */}
      {(() => {
        const activeKitKey = process.env.NEXT_PUBLIC_KIT_KEY || process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY;
        if (!activeKitKey || !activeKitKey.trim().startsWith('KIT_KEY:')) {
          return (
            <div className="w-full max-w-lg mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 text-amber-200 z-10 text-xs">
              <div className="flex-shrink-0 text-base">⚠️</div>
              <div className="flex flex-col gap-1 w-full">
                <span className="font-bold">Missing or Invalid Kit Key</span>
                <p className="mt-1 text-amber-300/80 leading-relaxed">
                  The <code>NEXT_PUBLIC_KIT_KEY</code> (or <code>NEXT_PUBLIC_CIRCLE_KIT_KEY</code>) environment variable is not configured or incorrect in Vercel. 
                  Live Web3 transactions will fail. Please add it exactly as <code>KIT_KEY:keyId:keySecret</code> in Vercel settings and trigger a <strong>redeploy</strong>.
                </p>
                <div className="mt-2 pt-2 border-t border-amber-500/20 text-[10px] text-amber-400 font-mono">
                  <strong>Diagnostics:</strong>
                  <br />- NEXT_PUBLIC_KIT_KEY: {process.env.NEXT_PUBLIC_KIT_KEY ? `${process.env.NEXT_PUBLIC_KIT_KEY.slice(0, 15)}... (length: ${process.env.NEXT_PUBLIC_KIT_KEY.length})` : 'undefined'}
                  <br />- NEXT_PUBLIC_CIRCLE_KIT_KEY: {process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY ? `${process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY.slice(0, 15)}... (length: ${process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY.length})` : 'undefined'}
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {activeTab === 'home' && (
        <section className="w-full max-w-3xl mx-auto px-6 pt-16 md:pt-24 pb-10 text-center animate-scale-in z-10">
          <p className="font-mono text-xs tracking-[0.2em] text-slate-400 uppercase">
            Programmable money on Arc
          </p>
          <div className="mx-auto mt-4 h-px w-12 bg-gradient-to-r from-transparent via-slate-300 to-transparent opacity-30" />
          <h1 className="mt-6 text-4xl sm:text-6xl md:text-7xl font-extralight tracking-tight text-slate-50 leading-[1.05]">
            Swap. Send. Bridge.
            <br />
            All in one terminal.
          </h1>
          <p className="mt-6 text-base md:text-lg text-slate-400 leading-relaxed max-w-xl mx-auto">
            USDC and EURC, native. Swap, send, or bridge from the wallet you already have.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => { setActiveTab('swap'); setStatus(null); }}
              className="btn-primary"
            >
              Launch app
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
            <a href="#how-it-works" className="btn-ghost">
              How it works
            </a>
          </div>
        </section>
      )}

      {/* Main Interactive Widget */}
      {activeTab !== 'home' && (
        <div className={`w-full ds-card rounded-[20px] p-6 z-10 mt-10 mb-16 mx-4 ${
          activeTab === 'base-agent' ? 'max-w-5xl' : activeTab === 'identity' ? 'max-w-xl' : 'max-w-lg'
        }`}>
          
          {/* Warning Banner if connected to Mainnet in testnet mode */}
          {!isSandbox && currentChainId && !CHAIN_MAP[currentChainId] && (
            <div className="bg-rose-950/45 border border-rose-500/30 rounded-2xl p-4 mb-4 flex flex-col gap-3 text-xs text-rose-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-rose-400 mt-0.5 flex-shrink-0 animate-pulse" />
                <p className="text-slate-300 font-medium leading-relaxed">
                  You are connected to an unsupported network (Chain ID: {currentChainId}). Switch to a supported test network.
                </p>
              </div>
              <button
                type="button"
                onClick={() => requestSwitchChain(5042002)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-3.5 rounded-xl transition-colors cursor-pointer text-xs"
              >
                Switch to Arc Testnet
              </button>
            </div>
          )}

        {/* TAB 1: SWAP COMPONENT */}
        {activeTab === 'swap' && (
          <form onSubmit={handleSwap} className="space-y-4">
            {/* YOU PAY input card */}
            <div className="ds-panel rounded-2xl p-5 mb-1 hover:border-slate-800 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  YOU PAY
                </span>
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                  Balance: <span className="text-slate-300 font-bold">{currentInBalance}</span>
                  <button
                    type="button"
                    onClick={() => handleMaxClick('in')}
                    className="text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
                  >
                    MAX
                  </button>
                </span>
              </div>
              
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    name="amount"
                    placeholder="0.0"
                    required
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="bg-transparent text-3xl font-bold w-full focus:outline-none text-white placeholder-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:margin-0 [&::-webkit-inner-spin-button]:margin-0"
                  />
                  <p className="text-[11px] text-slate-500 font-mono mt-1 select-none">
                    ${formData.amount ? (parseFloat(formData.amount) * (formData.tokenIn === 'USDC' ? 1.00 : formData.tokenIn === 'ETH' ? 3200.00 : formData.tokenIn === 'EURC' ? 1.09 : formData.tokenIn === 'WBTC' ? 71000.00 : 165.00)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
                {(() => {
                  const badge = getTokenBadge(formData.tokenIn);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectorType('in');
                        setIsTokenSelectorOpen(true);
                      }}
                      className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-200 cursor-pointer transition-colors"
                    >
                      <span className={`w-5 h-5 rounded-full border ${badge.bg} flex items-center justify-center text-[10px] font-black`}>
                        {badge.letter}
                      </span>
                      {formData.tokenIn}
                      <ChevronDown size={12} className="text-slate-500" />
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Swap Midpoint Button */}
            <div className="flex justify-center -my-3 relative z-10">
              <button
                type="button"
                onClick={handleSwapTokens}
                className="w-9 h-9 rounded-xl ds-panel flex items-center justify-center text-indigo-300 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
              >
                <ArrowDownUp size={14} className="text-indigo-300" />
              </button>
            </div>

            {/* YOU RECEIVE input card */}
            <div className="ds-panel rounded-2xl p-5 mb-2 hover:border-slate-800 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  YOU RECEIVE
                </span>
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                  Balance: <span className="text-slate-300 font-bold">{currentOutBalance}</span>
                  <button
                    type="button"
                    onClick={() => handleMaxClick('out')}
                    className="text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
                  >
                    MAX
                  </button>
                </span>
              </div>
              
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    disabled
                    placeholder="0.0"
                    value={estimatedOutput}
                    className="bg-transparent text-3xl font-bold w-full text-slate-400 focus:outline-none placeholder-slate-700"
                  />
                  <p className="text-[11px] text-slate-500 font-mono mt-1 select-none">
                    ${estimatedOutput && estimatedOutput !== '0.00' ? (parseFloat(estimatedOutput) * (formData.tokenOut === 'USDC' ? 1.00 : formData.tokenOut === 'ETH' ? 3200.00 : formData.tokenOut === 'EURC' ? 1.09 : formData.tokenOut === 'WBTC' ? 71000.00 : 165.00)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
                {(() => {
                  const badge = getTokenBadge(formData.tokenOut);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectorType('out');
                        setIsTokenSelectorOpen(true);
                      }}
                      className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-200 cursor-pointer transition-colors"
                    >
                      <span className={`w-5 h-5 rounded-full border ${badge.bg} flex items-center justify-center text-[10px] font-black`}>
                        {badge.letter}
                      </span>
                      {formData.tokenOut}
                      <ChevronDown size={12} className="text-slate-500" />
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Price Impact & Fee Details */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Price Impact</span>
                <span className="text-emerald-400 font-semibold select-none">&lt; 0.01%</span>
              </div>
              <div className="flex justify-between">
                <span>Network Fee</span>
                <span className="text-slate-200">~$0.42</span>
              </div>
              <div className="flex justify-between">
                <span>Rate</span>
                <span className="font-mono text-slate-300">
                  1 {formData.tokenIn} = {exchangeRate} {formData.tokenOut}
                </span>
              </div>
            </div>

            {!isSandbox && currentChainId && !CHAIN_MAP[currentChainId] ? (
              <button
                type="button"
                onClick={() => requestSwitchChain(5042002)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-rose-600/10 cursor-pointer text-xs uppercase tracking-wider font-sans"
              >
                Switch Wallet to Arc Testnet
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !formData.amount}
                className="btn-primary w-full disabled:pointer-events-none"
              >
                {loading ? <RefreshCw className="animate-spin" size={14} /> : 'Swap'}
              </button>
            )}
          </form>
        )}

        {/* TAB 2: SEND COMPONENT */}
        {activeTab === 'send' && (
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Recipient Wallet Address
              </label>
              <div className="glass-input rounded-2xl p-4">
                <input
                  type="text"
                  name="recipient"
                  required
                  placeholder="Enter EVM address (0x...) or ENS"
                  value={formData.recipient}
                  onChange={handleInputChange}
                  className="w-full bg-transparent text-sm text-white placeholder-slate-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="ds-panel rounded-2xl p-5 hover:border-slate-800 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Amount to Send
                </span>
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                  Balance: <span className="text-slate-300 font-bold">{currentInBalance}</span>
                  <button
                    type="button"
                    onClick={() => handleMaxClick('in')}
                    className="text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
                  >
                    MAX
                  </button>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    name="amount"
                    placeholder="0.0"
                    required
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="bg-transparent text-3xl font-bold w-full focus:outline-none text-white placeholder-slate-700"
                  />
                </div>
                {(() => {
                  const badge = getTokenBadge(formData.tokenIn);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectorType('in');
                        setIsTokenSelectorOpen(true);
                      }}
                      className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-200 cursor-pointer transition-colors"
                    >
                      <span className={`w-5 h-5 rounded-full border ${badge.bg} flex items-center justify-center text-[10px] font-black`}>
                        {badge.letter}
                      </span>
                      {formData.tokenIn}
                      <ChevronDown size={12} className="text-slate-500" />
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* OPTIONAL ON-CHAIN TRANSACTION MEMO (Arc Memo contract, Zero7+) */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Transaction Memo / Payment Reference (Optional)
              </label>
              <div className="glass-input rounded-2xl p-4">
                <input
                  type="text"
                  name="memo"
                  placeholder="Invoice ID or note — recorded via Arc Memo contract"
                  value={formData.memo}
                  onChange={handleInputChange}
                  className="w-full bg-transparent text-sm text-white placeholder-slate-700 focus:outline-none"
                />
              </div>
            </div>

            {/* Protocol info */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Send Fee (0.3% Bps)</span>
                <span className="font-mono text-indigo-300">
                  {formData.amount ? (parseFloat(formData.amount) * 0.003).toFixed(5) : '0.00000'} {formData.tokenIn}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Recipient Receive Value</span>
                <span className="font-mono text-slate-200">
                  {formData.amount ? (parseFloat(formData.amount) * 0.997).toFixed(5) : '0.00000'} {formData.tokenIn}
                </span>
              </div>
            </div>

            {!isSandbox && currentChainId && !CHAIN_MAP[currentChainId] ? (
              <button
                type="button"
                onClick={() => requestSwitchChain(5042002)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-rose-600/10 cursor-pointer text-xs uppercase tracking-wider font-sans"
              >
                Switch Wallet to Arc Testnet
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !formData.amount || !formData.recipient}
                className="btn-primary w-full disabled:pointer-events-none"
              >
                {loading ? <RefreshCw className="animate-spin" size={14} /> : 'Send'}
              </button>
            )}
          </form>
        )}

        {/* TAB 3: BRIDGE COMPONENT */}
        {activeTab === 'bridge' && (
          <form onSubmit={handleBridge} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Source Chain
                </label>
                <div className="ds-panel rounded-2xl p-3 flex items-center justify-between">
                  <select 
                    name="sourceChain" 
                    value={formData.sourceChain} 
                    onChange={handleInputChange} 
                    disabled={!isSandbox}
                    className="bg-transparent text-xs font-semibold text-slate-200 w-full focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSandbox ? (
                      <>
                        <option value="Arc_Testnet" className="bg-slate-950 text-white font-semibold">Arc Testnet</option>
                        <option value="Ethereum_Sepolia" className="bg-slate-950 text-white font-semibold">Ethereum Sepolia</option>
                        <option value="Base_Sepolia" className="bg-slate-950 text-white font-semibold">Base Sepolia</option>
                      </>
                    ) : (
                      <option value={currentChainId && CHAIN_MAP[currentChainId] ? CHAIN_MAP[currentChainId].key : 'Arc_Testnet'} className="bg-slate-950 text-white font-semibold">
                        {currentChainId && CHAIN_MAP[currentChainId] ? CHAIN_MAP[currentChainId].name : 'Arc Testnet'}
                      </option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Target Chain
                </label>
                <div className="ds-panel rounded-2xl p-3 flex items-center justify-between">
                  <select 
                    name="targetChain" 
                    value={formData.targetChain} 
                    onChange={handleInputChange} 
                    className="bg-transparent text-xs font-semibold text-slate-200 w-full focus:outline-none cursor-pointer"
                  >
                    {getTargetChainOptions().map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-slate-950 text-white font-semibold">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Animated Visual Bridge Routing Flow */}
            <div className="ds-panel rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
              {/* Grid Background Effect */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_24px] opacity-10 pointer-events-none" />

              <div className="flex items-center justify-between w-full relative z-10 px-2">
                {/* Source Badge */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Source</span>
                  <div className="px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 font-medium text-[10px] select-none">
                    {getChainDisplayName(activeChainKey)}
                  </div>
                </div>

                {/* Dotted Line & Neon Pulse Dot */}
                <div className="flex-1 mx-3 relative flex items-center justify-center">
                  <div className="w-full h-0.5 border-t-2 border-dashed border-slate-800" />
                  
                  <div className="absolute w-7 h-7 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center shadow-lg shadow-black/80">
                    <Sparkles size={10} className="text-indigo-300 animate-pulse" />
                  </div>
                  
                  <div className="absolute top-1/2 -mt-[4px] left-0 w-2 h-2 rounded-full bg-indigo-400 animate-bridge-pulse" />
                </div>

                {/* Target Badge */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Destination</span>
                  <div className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-[10px] shadow-sm select-none">
                    {getChainDisplayName(formData.targetChain)}
                  </div>
                </div>
              </div>
            </div>

            {/* Amount card */}
            <div className="ds-panel rounded-2xl p-5 hover:border-slate-800 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Amount to Bridge
                </span>
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                  Balance: <span className="text-slate-300 font-bold">
                    {walletBalance.find(t => t.symbol === formData.bridgeToken)?.balance || '0.00'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const token = walletBalance.find(t => t.symbol === formData.bridgeToken);
                      if (!token) return;
                      let rawBalance = parseFloat(token.balance.replace(/,/g, '')) || 0;
                      if (activeChainKey === 'Arc_Testnet' && formData.bridgeToken === 'USDC') {
                        const gasReserve = 0.5;
                        rawBalance = rawBalance > gasReserve ? rawBalance - gasReserve : 0;
                      }
                      setFormData(prev => ({ ...prev, amount: rawBalance.toString() }));
                    }}
                    className="text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
                  >
                    MAX
                  </button>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    name="amount"
                    placeholder="0.0"
                    required
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="bg-transparent text-3xl font-bold w-full focus:outline-none text-white placeholder-slate-700"
                  />
                </div>
                <select
                  name="bridgeToken"
                  value={formData.bridgeToken}
                  onChange={handleInputChange}
                  className="bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 text-xs font-bold text-indigo-300 cursor-pointer focus:outline-none"
                >
                  <option value="USDC" className="bg-slate-950 text-white">USDC</option>
                  <option value="EURC" className="bg-slate-950 text-white">EURC</option>
                </select>
              </div>
            </div>

            {/* Destination Address Input */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Destination Address (Optional)
              </label>
              <div className="glass-input rounded-2xl p-4">
                <input
                  type="text"
                  name="destinationRecipient"
                  placeholder="Leave empty to send to yourself"
                  value={formData.destinationRecipient}
                  onChange={handleInputChange}
                  className="w-full bg-transparent text-sm text-white placeholder-slate-700 focus:outline-none"
                />
              </div>
            </div>

            {/* Bridge route info */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Routing Protocol</span>
                <span className="text-indigo-300 font-semibold flex items-center gap-1 select-none">
                  <Sparkles size={12} /> {formData.bridgeToken === 'EURC' ? 'CCTP for non-USDC' : 'Circle CCTP V2'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Entry Contract</span>
                <span className="text-slate-200 font-mono text-[10px]">
                  {formData.bridgeToken === 'EURC' ? 'CrossChainTokenService' : 'TokenMessengerV2'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Arrival</span>
                <span className="text-slate-200 font-medium">
                  {formData.bridgeToken === 'EURC' ? '~ 8–20s (fast) / 15 min (standard)' : '~ 8–20s Fast Transfer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{formData.bridgeToken === 'EURC' ? 'Fee (native gas on source)' : 'Platform Fee (0.3%)'}</span>
                <span className="font-mono text-slate-200">
                  {formData.bridgeToken === 'EURC'
                    ? 'Quoted at send time'
                    : `${formData.amount ? (parseFloat(formData.amount) * 0.003).toFixed(2) : '0.00'} USDC`}
                </span>
              </div>
            </div>

            {!isSandbox && currentChainId && !CHAIN_MAP[currentChainId] ? (
              <button
                type="button"
                onClick={() => requestSwitchChain(5042002)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-rose-600/10 cursor-pointer text-xs uppercase tracking-wider font-sans"
              >
                Switch Wallet to Arc Testnet
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !formData.amount}
                className="btn-primary w-full disabled:pointer-events-none"
              >
                {loading ? <RefreshCw className="animate-spin" size={14} /> : `Bridge ${formData.bridgeToken}`}
              </button>
            )}
          </form>
        )}

        {/* TAB 4: AGENT WALLET COMPONENT */}
        {activeTab === 'agent' && (
          <div className="space-y-4 text-left">
            {/* Agent Wallet Status Card */}
            <div className="ds-panel rounded-2xl p-5 hover:border-slate-800 transition-colors">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Autonomous AI Agent Wallet
                </span>
                <span className="px-2 py-0.5 text-[9px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  Agent Stack Active
                </span>
              </div>
              
              <div className="flex items-center justify-between bg-slate-950/80 rounded-xl p-3 border border-slate-900 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-mono text-slate-300 tracking-wide select-all">
                    {agentWalletAddress.slice(0, 10)}...{agentWalletAddress.slice(-8)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(agentWalletAddress);
                    setStatus({ type: 'success', text: 'Agent Wallet Address copied to clipboard!' });
                    setTimeout(() => setStatus(null), 2500);
                  }}
                  className="text-indigo-300 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Copy
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111827]/30 border border-slate-900 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Agent USDC Balance</p>
                  <p className="text-xl font-bold text-white font-mono">
                    {agentUsdcBalance} <span className="text-xs text-slate-400 font-sans font-medium">USDC</span>
                  </p>
                </div>
                <div className="bg-[#111827]/30 border border-slate-900 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Agent EURC Balance</p>
                  <p className="text-xl font-bold text-white font-mono">
                    {agentEurcBalance} <span className="text-xs text-slate-400 font-sans font-medium">EURC</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Funding & Gas Tank Operations */}
            <div className="ds-panel rounded-2xl p-5 hover:border-slate-800 transition-colors">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Fund Agent Wallet
                </span>
                <a 
                  href="https://faucet.circle.com/" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-indigo-300 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                >
                  Circle Faucet <ExternalLink size={10} />
                </a>
              </div>

              <div className="mb-4 bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-3 text-[11px] text-cyan-300 leading-relaxed">
                ℹ️ <strong>Zero Gas Fees:</strong> Running on Arc Testnet means generating, funding, and running these autonomous AI agent routines costs 0 real-world fees. Get free testnet funds at the Circle Faucet.
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 flex items-center justify-between">
                  <input
                    type="number"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="bg-transparent text-sm font-bold text-white placeholder-slate-700 focus:outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:margin-0 [&::-webkit-inner-spin-button]:margin-0"
                  />
                  <span className="text-xs font-bold text-slate-400 ml-2">USDC</span>
                </div>
                <button
                  type="button"
                  onClick={handleDepositToAgent}
                  disabled={loading || !depositAmount}
                  className="bg-[#709bf0] hover:bg-[#5b88dd] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold px-4 py-3.5 rounded-xl transition-all shadow-md cursor-pointer whitespace-nowrap h-full"
                >
                  {loading ? <RefreshCw className="animate-spin" size={12} /> : 'Deposit USDC'}
                </button>
              </div>
            </div>

            {/* Spending Controls Form */}
            <form onSubmit={handleSaveBotConfig} className="ds-panel rounded-2xl p-5 hover:border-slate-800 transition-colors space-y-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  AI Spending Controls
                </span>
                <span className="text-[10px] text-slate-500 uppercase font-mono">
                  Autonomous Config
                </span>
              </div>

              {/* Daily Spending Limit */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Daily Spending Limit (USDC)
                </label>
                <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 flex items-center justify-between">
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    className="bg-transparent text-lg font-bold text-white focus:outline-none w-full"
                    required
                    min="1"
                  />
                  <span className="text-xs font-bold text-slate-400">USDC Limit</span>
                </div>
              </div>

              {/* Automated Rules Configuration */}
              <div className="space-y-3 pt-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Automated Spending Rules
                </label>

                {/* Rule 1 Toggle */}
                <div className="flex items-start justify-between gap-3 bg-[#111827]/20 border border-slate-900 rounded-xl p-3 hover:border-slate-850 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-200">Auto-Swap rate drop trigger</p>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Auto-Swap USDC to EURC if exchange rate drops below target.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRuleAutoSwap(!ruleAutoSwap)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex-shrink-0 cursor-pointer ${
                      ruleAutoSwap ? 'bg-indigo-500' : 'bg-slate-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-[#070b13] transition-transform duration-200 ${
                      ruleAutoSwap ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Rule 2 Toggle */}
                <div className="flex items-start justify-between gap-3 bg-[#111827]/20 border border-slate-900 rounded-xl p-3 hover:border-slate-850 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-200">Auto-Bridge gas surge trigger</p>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Auto-Bridge USDC or EURC via CCTP if Ethereum network gas surges.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRuleAutoBridge(!ruleAutoBridge)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex-shrink-0 cursor-pointer ${
                      ruleAutoBridge ? 'bg-indigo-500' : 'bg-slate-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-[#070b13] transition-transform duration-200 ${
                      ruleAutoBridge ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Save Bot Configurations */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2 disabled:pointer-events-none"
              >
                {loading ? <RefreshCw className="animate-spin" size={14} /> : 'Save and activate'}
              </button>
            </form>

            {/* Documentation & Links Integration */}
            <div className="ds-panel rounded-2xl p-5 hover:border-slate-800 transition-colors space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Circle Agent Stack Documentation
                </span>
                <p className="text-xs text-slate-400 leading-relaxed font-normal mt-1">
                  Circle Agent Stack is a robust financial infrastructure built to power the agentic economy. It enables AI agents to autonomously hold, send, swap, and bridge stablecoins with programmatic spending controls.
                </p>
              </div>

              <div className="space-y-2.5 pt-1 text-xs flex flex-col">
                <a 
                  href="https://agents.circle.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors font-semibold hover:underline w-fit"
                >
                  Explore Circle Agent Stack Portal
                  <ExternalLink size={12} />
                </a>

                <a 
                  href="http://www.circle.com/blog/introducing-circle-agent-stack-financial-infrastructure-for-the-agentic-economy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors font-semibold hover:underline w-fit"
                >
                  Read Official Announcement Blog
                  <ExternalLink size={12} />
                </a>

                <a 
                  href="https://www.circle.com/blog/cctp-extends-circles-crosschain-trust-layer-to-eurc" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors font-semibold hover:underline w-fit"
                >
                  CCTP now supports native EURC
                  <ExternalLink size={12} />
                </a>

                <a 
                  href="https://community.arc.io/home/blogs/arc-testnet-v080-hardfork-2026-08-28" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors font-semibold hover:underline w-fit"
                >
                  Arc Testnet v0.8.0 (Zero8) hardfork notes
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Status Message Display */}
        {status && (
          <div className={`mt-4 p-4 rounded-2xl border backdrop-blur-md text-xs relative overflow-hidden transition-all duration-300 ${
            status.type === 'success' ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' :
            status.type === 'error' ? 'bg-rose-950/20 border-rose-500/40 text-rose-300' :
            'bg-indigo-950/25 border-indigo-500/40 text-indigo-200'
          }`}>
            <div className="flex items-start gap-2.5">
              {status.type === 'success' ? (
                <CheckCircle2 size={15} className="text-emerald-400 mt-0.5 flex-shrink-0 animate-bounce" />
              ) : status.type === 'error' ? (
                <AlertCircle size={15} className="text-rose-400 mt-0.5 flex-shrink-0" />
              ) : (
                <RefreshCw size={15} className="text-indigo-400 mt-0.5 flex-shrink-0 animate-spin" />
              )}
              
              <div className="flex-1 space-y-1.5">
                <p className="font-semibold uppercase tracking-wider text-[9px]">
                  {status.type === 'success' ? 'Success' : status.type === 'error' ? 'Failed' : 'Processing'}
                </p>
                <p className="text-slate-300 font-medium leading-relaxed">{status.text}</p>
                
                {/* Steps Loader for Sandbox Simulation */}
                {status.steps && status.currentStepIndex !== undefined && (() => {
                  const stepIdx = status.currentStepIndex;
                  return (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-900 space-y-1">
                      {status.steps.map((stepText, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[10px] font-mono">
                          {idx < stepIdx ? (
                            <span className="text-emerald-400 font-bold">✓</span>
                          ) : idx === stepIdx ? (
                            <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping inline-block" />
                          ) : (
                            <span className="w-1 h-1 rounded-full bg-slate-800 inline-block" />
                          )}
                          <span className={idx === stepIdx ? 'text-cyan-300 font-bold' : idx < stepIdx ? 'text-slate-600 line-through' : 'text-slate-600'}>
                            {stepText}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {status.txHash && (() => {
                  const activeChain = currentChainId && CHAIN_MAP[currentChainId] ? CHAIN_MAP[currentChainId] : CHAIN_MAP[5042002];
                  const explorerUrl = `${activeChain.blockExplorer}/tx/${status.txHash}`;
                  const explorerName = activeChain.name.replace(' Testnet', '').replace(' Sepolia', '') + ' Explorer';
                  return (
                    <div className="pt-1.5">
                      <a 
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-300 hover:text-white transition-colors underline underline-offset-2"
                      >
                        View on {explorerName}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BASE AGENT SYSTEM */}
        {activeTab === 'base-agent' && (
          <BaseAgentTab 
            connectedWalletAddress={walletAddress || undefined}
            connectedWalletBalances={walletBalance}
            activeChainName={currentChainId && CHAIN_MAP[currentChainId] ? CHAIN_MAP[currentChainId].name : undefined}
            onRefreshConnectedBalances={walletAddress ? () => fetchRealBalances(walletAddress) : undefined}
          />
        )}

        {/* TAB 6: ERC-8004 Identity + x402 */}
        {activeTab === 'identity' && (
          <AgentIdentityTab walletAddress={walletAddress || undefined} />
        )}
      </div>
      )}
 
      {activeTab === 'home' && (
        <div className="w-full max-w-5xl px-6 z-10 space-y-20 pb-8">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <button
              type="button"
              onClick={() => { setActiveTab('swap'); setStatus(null); }}
              className="text-left ds-card rounded-[20px] p-7 hover:border-white/15 transition-colors cursor-pointer"
            >
              <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500 uppercase">On Arc</p>
              <h3 className="mt-3 text-2xl font-extralight text-slate-50">Swap and send</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Move USDC, EURC, USYC, and cirBTC from the wallet you already have. Optional Arc Memo on every send.
              </p>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('bridge'); setStatus(null); }}
              className="text-left ds-card rounded-[20px] p-7 hover:border-white/15 transition-colors cursor-pointer"
            >
              <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500 uppercase">Crosschain</p>
              <h3 className="mt-3 text-2xl font-extralight text-slate-50">Bridge USDC and EURC</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                CCTP V2 for USDC. CrossChainTokenService for EURC. Same Iris attestation, two entry contracts.
              </p>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('identity'); setStatus(null); }}
              className="text-left ds-card rounded-[20px] p-7 hover:border-white/15 transition-colors cursor-pointer md:col-span-2"
            >
              <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500 uppercase">Agent economy</p>
              <h3 className="mt-3 text-2xl font-extralight text-slate-50">ERC-8004 identity</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Mint an onchain agent ID, call an x402 paid endpoint, and write reputation feedback on Arc Testnet.
              </p>
            </button>
          </section>

          <section id="how-it-works" className="scroll-mt-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-mono text-xs tracking-[0.2em] text-slate-400 uppercase">How it works</p>
              <div className="mx-auto mt-4 h-px w-12 bg-gradient-to-r from-transparent via-slate-300 to-transparent opacity-30" />
              <h2 className="mt-4 text-3xl font-extralight tracking-tight text-slate-50 sm:text-4xl">
                From a wallet to a settled transfer
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
                Four steps. Every one of them is a button in the app.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { n: '01', t: 'Connect a wallet', d: 'Use the wallet you already have. Every action after this is signed by you.' },
                { n: '02', t: 'Pick a rail', d: 'Swap on Arc, send with an optional memo, or bridge USDC and EURC via CCTP.' },
                { n: '03', t: 'Sign it yourself', d: 'Every transfer is signed in your wallet. Funds stay in your EOA.' },
                { n: '04', t: 'Arc settles', d: 'USDC pays gas. Finality is sub-second. Funds stay in your EOA.' },
              ].map((step) => (
                <div key={step.n} className="ds-card rounded-[20px] p-6">
                  <p className="font-mono text-xs text-indigo-300">{step.n}</p>
                  <h3 className="mt-2 text-lg font-medium text-slate-50">{step.t}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{step.d}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Custom Token Selector Modal */}
      {isTokenSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md transition-all duration-350">
          <div className="w-full max-w-sm ds-card rounded-3xl p-6 shadow-2xl relative animate-scale-in">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Select a token</h3>
              <button
                type="button"
                onClick={() => {
                  setIsTokenSelectorOpen(false);
                  setTokenSearchQuery('');
                }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search name or paste address"
                value={tokenSearchQuery}
                onChange={(e) => setTokenSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 transition-colors"
              />
            </div>

            {/* Scrollable Token List */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {filteredTokens.map((token) => (
                <button
                  key={token.symbol}
                  type="button"
                  onClick={() => handleSelectToken(token.symbol)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-900/60 border border-transparent hover:border-slate-850 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-[10px] text-indigo-300 select-none">
                      {token.symbol}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{token.symbol}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-semibold text-slate-200">{token.balance}</p>
                  </div>
                </button>
              ))}
              {filteredTokens.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500">
                  No tokens found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="w-full mt-auto pt-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ArcShift. Built by <a href="https://x.com/nhattung00" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">@nhattung00</a></p>
          <p>Swap. Send. Bridge. All in one terminal.</p>
        </div>
      </footer>
    </main>
  );
}
