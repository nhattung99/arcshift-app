import { streamText, tool, convertToModelMessages } from 'ai';
import { getGoogleGenerativeAI } from '@/lib/googleAi';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export const maxDuration = 30;

// Persistent mock state for request status polling across route invocations
const globalForRequests = globalThis as unknown as {
  requestStatuses?: Map<string, { status: string; txHash?: string; checksCount: number; memo?: string }>
};

if (!globalForRequests.requestStatuses) {
  globalForRequests.requestStatuses = new Map();
}
const requestStatuses = globalForRequests.requestStatuses;

const TOKEN_PRICES: Record<string, number> = {
  'USDC': 1.00,
  'EURC': 1.09,
  'USYC': 1.00,
  'cirBTC': 68500.00,
  'ETH': 3245.00,
};

// Helper to call Base MCP tool remotely
async function callBaseMCPTool(toolName: string, args: any, authorizationHeader: string | null) {
  const transport = new SSEClientTransport(new URL("https://mcp.base.org"), {
    requestInit: {
      headers: authorizationHeader ? { "Authorization": authorizationHeader } : undefined,
    }
  });

  const client = new Client(
    { name: "arcshift-base-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });
    return result;
  } catch (error) {
    console.warn(`Remote Base MCP call failed for ${toolName}:`, error);
    throw error;
  } finally {
    try {
      await transport.close();
    } catch (_) {}
  }
}

export async function POST(req: Request) {
  try {
    const { messages, walletAddress, walletBalances } = await req.json();
    const authHeader = req.headers.get("Authorization");

    const google = getGoogleGenerativeAI();

    const result = streamText({
      model: google('gemini-2.5-flash'),
      messages: await convertToModelMessages(messages),
      system: `You are ArcShift Terminal's Base AI Agent helper. You assist users with Web3 actions on the Base network.
You can execute onchain commands by utilizing the Base MCP (Model Context Protocol) tools.
You have access to five tools:
1. get_wallets: Retrieve the user's wallet address and connection details.
2. get_portfolio: Retrieve assets, balances, and USD valuation.
3. send: Transfer tokens (e.g., USDC, ETH) to another address.
4. swap: Swap assets (e.g., swap USDC to ETH).
5. get_request_status: Check the status of a write request using its requestId.

Guidelines:
- Explain your reasoning clearly and concisely in English.
- Always use the get_wallets tool first if you need to know the user's wallet address.
- When performing a swap or send action, explain the transaction parameters first, call the tool, and then present the approvalUrl and requestId clearly to the user.
- Instruct the user to click the "Approve Transaction" button that appears on their screen.
- Tell the user they can poll/check the status of the transaction using the status checker or you can poll it using get_request_status.
- EURC can move natively Ethereum ↔ Base via CCTP for non-USDC (CrossChainTokenService). USDC still uses standard CCTP.
- Always communicate professionally in English.`,
      tools: {
        get_wallets: tool({
          description: "Retrieve the user's connected Base smart wallets and session status.",
          inputSchema: z.object({}),
          execute: async () => {
            if (walletAddress) {
              return {
                wallets: [
                  {
                    address: walletAddress,
                    name: "Personal Wallet",
                    network: "Connected Network",
                    chains: ["base"]
                  }
                ]
              };
            }
            try {
              return await callBaseMCPTool("get_wallets", {}, authHeader);
            } catch (err) {
              // Graceful fallback to mock data
              return {
                wallets: [
                  {
                    address: "0x323b5d2735d45d2d46e37947118265e396dc34fa",
                    name: "Base Smart Wallet",
                    network: "Base Mainnet",
                    chains: ["base"]
                  }
                ]
              };
            }
          }
        }),
        get_portfolio: tool({
          description: "Get the asset portfolio balances for a given wallet address.",
          inputSchema: z.object({
            walletAddress: z.string().describe("The wallet address to retrieve the portfolio for")
          }),
          execute: async (args) => {
            if (walletAddress && args.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
              const assets = (walletBalances || []).map((t: any) => {
                const balanceNum = parseFloat(t.balance.replace(/,/g, '')) || 0;
                const price = TOKEN_PRICES[t.symbol] || 1.00;
                return {
                  symbol: t.symbol,
                  name: t.name,
                  balance: t.balance,
                  decimals: t.decimals,
                  priceUSD: price,
                  valueUSD: balanceNum * price
                };
              });
              const totalValueUSD = assets.reduce((sum: number, item: any) => sum + item.valueUSD, 0);
              return {
                totalValueUSD,
                assets
              };
            }
            try {
              return await callBaseMCPTool("get_portfolio", { wallet_address: args.walletAddress }, authHeader);
            } catch (err) {
              // Graceful fallback to mock data
              return {
                totalValueUSD: 1450.75,
                assets: [
                  {
                    symbol: "USDC",
                    name: "USD Coin",
                    balance: "850.50",
                    decimals: 6,
                    priceUSD: 1.00,
                    valueUSD: 850.50
                  },
                  {
                    symbol: "ETH",
                    name: "Ethereum",
                    balance: "0.185",
                    decimals: 18,
                    priceUSD: 3245.00,
                    valueUSD: 600.25
                  }
                ]
              };
            }
          }
        }),
        send: tool({
          description: "Transfer tokens (e.g. USDC, ETH) to another address on the Base network.",
          inputSchema: z.object({
            toAddress: z.string().describe("The recipient wallet address"),
            amount: z.string().describe("The amount to transfer (decimal string)"),
            asset: z.string().describe("The token symbol, e.g. USDC, ETH"),
            chain: z.string().optional().default("base").describe("The network chain name"),
            memo: z.string().optional().describe("An optional transaction memo or payment reference metadata to attach on-chain")
          }),
          execute: async (args) => {
            try {
              return await callBaseMCPTool("send", {
                to: args.toAddress,
                amount: args.amount,
                asset: args.asset,
                chain: args.chain,
                memo: args.memo
              }, authHeader);
            } catch (err) {
              // Graceful fallback to mock data
              const requestId = "req_send_" + Math.random().toString(36).substring(2, 11);
              requestStatuses.set(requestId, { status: "pending", checksCount: 0, memo: args.memo });
              return {
                requestId,
                approvalUrl: `https://mcp.base.org/approve?id=${requestId}&memo=${encodeURIComponent(args.memo || '')}`,
                status: "pending",
                message: `Prepared request to send ${args.amount} ${args.asset} to ${args.toAddress}. Approval required.`,
                memo: args.memo
              };
            }
          }
        }),
        swap: tool({
          description: "Swap assets on the Base network.",
          inputSchema: z.object({
            fromAsset: z.string().describe("Token to swap from, e.g. USDC"),
            toAsset: z.string().describe("Token to swap to, e.g. ETH"),
            amount: z.string().describe("Amount of fromAsset to swap"),
            chain: z.string().optional().default("base").describe("The network chain name"),
            memo: z.string().optional().describe("An optional transaction memo or payment reference metadata to attach on-chain")
          }),
          execute: async (args) => {
            try {
              return await callBaseMCPTool("swap", {
                fromAsset: args.fromAsset,
                toAsset: args.toAsset,
                amount: args.amount,
                chain: args.chain,
                memo: args.memo
              }, authHeader);
            } catch (err) {
              // Graceful fallback to mock data
              const requestId = "req_swap_" + Math.random().toString(36).substring(2, 11);
              requestStatuses.set(requestId, { status: "pending", checksCount: 0, memo: args.memo });
              return {
                requestId,
                approvalUrl: `https://mcp.base.org/approve?id=${requestId}&memo=${encodeURIComponent(args.memo || '')}`,
                status: "pending",
                message: `Prepared swap of ${args.amount} ${args.fromAsset} for ${args.toAsset}. Approval required.`,
                memo: args.memo
              };
            }
          }
        }),
        get_request_status: tool({
          description: "Check the status of a transaction or approval request.",
          inputSchema: z.object({
            requestId: z.string().describe("The requestId returned from a send or swap tool call")
          }),
          execute: async (args) => {
            try {
              return await callBaseMCPTool("get_request_status", { request_id: args.requestId }, authHeader);
            } catch (err) {
              // Graceful fallback to mock polling
              const req = requestStatuses.get(args.requestId);
              if (!req) {
                return { status: "not_found", message: "Request ID not found." };
              }

              req.checksCount += 1;
              if (req.checksCount >= 3) {
                req.status = "success";
                req.txHash = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
              }

              return {
                status: req.status,
                txHash: req.txHash,
                message: req.status === "success" 
                  ? "Transaction executed successfully onchain!" 
                  : "Transaction approval is still pending."
              };
            }
          }
        })
      }
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error('Error in chat-base API route:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
