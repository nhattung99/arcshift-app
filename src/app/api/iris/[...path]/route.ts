import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const IRIS_SANDBOX = 'https://iris-api-sandbox.circle.com';
const IRIS_MAINNET = 'https://iris-api.circle.com';

async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } },
) {
  const resolvedParams = await params;
  const pathArray = resolvedParams.path || [];
  const pathStr = pathArray.join('/');
  const searchParams = req.nextUrl.search;
  const env = req.nextUrl.searchParams.get('env');
  const base = env === 'mainnet' ? IRIS_MAINNET : IRIS_SANDBOX;
  const filteredSearch = searchParams.replace(/([?&])env=(sandbox|mainnet)&?/, '$1').replace(/[?&]$/, '');
  const targetUrl = `${base}/${pathStr}${filteredSearch}`;

  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.text();
    } catch {
      body = undefined;
    }
  }

  const headers = new Headers();
  headers.set('Content-Type', req.headers.get('content-type') || 'application/json');
  headers.set('Accept', 'application/json');

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });
    const resBody = await response.text();
    return new NextResponse(resBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Iris proxy request failed', details: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest, context: any) {
  return handleProxy(req, context);
}

export async function POST(req: NextRequest, context: any) {
  return handleProxy(req, context);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
