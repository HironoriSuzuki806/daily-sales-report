import { NextRequest, NextResponse } from 'next/server';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, _ctx: Context): Promise<NextResponse> {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

export async function PUT(_req: NextRequest, _ctx: Context): Promise<NextResponse> {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}

export async function DELETE(_req: NextRequest, _ctx: Context): Promise<NextResponse> {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
