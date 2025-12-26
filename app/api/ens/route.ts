import { resolveEnsAddressCached } from '@/lib/ens';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nameParam = url.searchParams.get('name') ?? 'konser.eth';
  const name = nameParam.trim().toLowerCase();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const address = await resolveEnsAddressCached(name);
    return NextResponse.json({ name, address });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.toLowerCase().includes('required') ? 400 : 500;
    return NextResponse.json({ error: message, name }, { status });
  }
}
