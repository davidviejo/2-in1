import { NextResponse } from 'next/server';
import { analyzeClusterSerp } from '@/lib/clusterSerp';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const keywords = Array.isArray(body.keywords) ? body.keywords : String(body.keywords || '').split(/\n|,/);
    if (!keywords.map((k: string) => k.trim()).filter(Boolean).length) return NextResponse.json({ error: 'Añade al menos una keyword.' }, { status: 400 });
    const result = await analyzeClusterSerp({ ...body, keywords });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error inesperado' }, { status: 500 });
  }
}
