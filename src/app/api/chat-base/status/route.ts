import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const globalForRequests = globalThis as unknown as {
      requestStatuses?: Map<string, { status: string; txHash?: string; checksCount: number; memo?: string }>
    };

    const requestStatuses = globalForRequests.requestStatuses;
    const request = requestStatuses?.get(id);

    if (!request) {
      return NextResponse.json({ status: 'not_found', message: 'Request ID not found.' });
    }

    // Simulate approval progression on each poll request
    request.checksCount += 1;
    if (request.checksCount >= 3 && request.status !== 'success') {
      request.status = 'success';
      request.txHash = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    }

    return NextResponse.json({
      status: request.status,
      txHash: request.txHash,
      memo: request.memo,
      message: request.status === 'success' 
        ? 'Transaction executed successfully onchain!' 
        : 'Transaction approval is still pending.'
    });
  } catch (error: any) {
    console.error('Error checking transaction status:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
