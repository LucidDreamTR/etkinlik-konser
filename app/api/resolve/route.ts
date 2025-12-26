import { resolveRecipient } from '@/lib/address';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const input = url.searchParams.get('value') ?? 'konser.eth';

  try {
    const address = await resolveRecipient(input);
    return NextResponse.json({ input, address });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
