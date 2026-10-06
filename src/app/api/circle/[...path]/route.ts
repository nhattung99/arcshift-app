import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CIRCLE_API_BASE = 'https://api.circle.com';

async function handleProxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const resolvedParams = await params;
  const pathArray = resolvedParams.path || [];
  const pathStr = pathArray.join('/');
  
  // Construct the target URL
  const searchParams = req.nextUrl.search;
  const targetUrl = `${CIRCLE_API_BASE}/${pathStr}${searchParams}`;
  
  console.log(`[Circle Proxy] Method: ${req.method} | Forwarding to: ${targetUrl}`);
  
  // Read request body if applicable
  let body: any = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.text();
    } catch (e) {
      console.error('[Circle Proxy] Failed to parse request body:', e);
    }
  }
  
  // Copy request headers, excluding host-specific headers
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const keyLower = key.toLowerCase();
    if (
      keyLower !== 'host' &&
      keyLower !== 'connection' &&
      keyLower !== 'origin' &&
      keyLower !== 'referer' &&
      keyLower !== 'accept-encoding' // Let fetch handle encoding
    ) {
      headers.set(key, value);
    }
  });

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });
    
    // Read response body
    const resBody = await response.text();
    
    // Copy response headers
    const resHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const keyLower = key.toLowerCase();
      if (
        keyLower !== 'transfer-encoding' &&
        keyLower !== 'content-encoding' &&
        keyLower !== 'content-length'
      ) {
        resHeaders.set(key, value);
      }
    });
    
    // Ensure CORS headers are present so the browser accepts the proxy response
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    resHeaders.set('Access-Control-Allow-Headers', '*');
    
    return new NextResponse(resBody, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    console.error(`[Circle Proxy] Error forwarding request:`, error);
    return NextResponse.json(
      { error: 'Proxy request failed', details: error.message },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

export async function GET(req: NextRequest, context: any) {
  return handleProxy(req, context);
}

export async function POST(req: NextRequest, context: any) {
  return handleProxy(req, context);
}

export async function PUT(req: NextRequest, context: any) {
  return handleProxy(req, context);
}

export async function DELETE(req: NextRequest, context: any) {
  return handleProxy(req, context);
}

export async function PATCH(req: NextRequest, context: any) {
  return handleProxy(req, context);
}

export async function OPTIONS(req: NextRequest) {
  // Handle preflight requests
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
