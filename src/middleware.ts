import { NextRequest, NextResponse } from 'next/server';
import { globalLimiter, apiLimiter, authLimiter } from '@/lib/rate-limit';

export function middleware(req: NextRequest): NextResponse | void {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith('/api/auth/')) {
    const authResult = authLimiter(req);
    if (authResult) return authResult;
    const apiResult = apiLimiter(req);
    if (apiResult) return apiResult;
  } else if (pathname.startsWith('/api/')) {
    const apiResult = apiLimiter(req);
    if (apiResult) return apiResult;
  }

  const globalResult = globalLimiter(req);
  if (globalResult) return globalResult;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
