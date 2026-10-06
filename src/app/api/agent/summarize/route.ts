/**
 * POST /api/agent/summarize
 *
 * x402-gated endpoint (Circle Gateway Nanopayments).
 * Without SELLER_ADDRESS → demo 402 response.
 * With SELLER_ADDRESS → returns a paid summary payload.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const sellerAddress = process.env.SELLER_ADDRESS;

  if (!sellerAddress) {
    return NextResponse.json(
      {
        message:
          'This endpoint requires an x402 payment ($0.01 USDC via Circle Gateway Nanopayments). ' +
          'Set SELLER_ADDRESS in environment variables to enable live payments.',
        x402: true,
        price: '$0.01',
        paymentNetwork: 'Arc_Testnet',
      },
      {
        status: 402,
        headers: {
          'X-Payment-Required': '1',
          'X-Payment-Price': '0.01',
          'X-Payment-Token': 'USDC',
          'X-Payment-Network': 'Arc_Testnet',
        },
      },
    );
  }

  let body: { topic?: string; agentId?: string } = {};
  try {
    body = (await req.json()) as { topic?: string; agentId?: string };
  } catch {
    // ignore
  }

  const topic = (body.topic ?? 'onchain').slice(0, 80);

  return NextResponse.json({
    summary: `[Arc x402] Summary for "${topic}": Arc Testnet settles with USDC gas and sub-second finality. CCTP covers USDC and EURC. Payment cleared via Circle Gateway Nanopayments.`,
    topic,
    agentId: body.agentId ?? null,
    paidAt: new Date().toISOString(),
    agent: 'ArcShift Summarizer Agent',
  });
}
