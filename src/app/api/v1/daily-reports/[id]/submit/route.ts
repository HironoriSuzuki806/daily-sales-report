import { NextRequest, NextResponse } from 'next/server';

type Context = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, _ctx: Context): Promise<NextResponse> {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
