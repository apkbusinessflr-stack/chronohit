import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/el/admin')) {
    const isAuthed = req.cookies.get('admin_auth')?.value === '1';
    if (!url.pathname.startsWith('/el')) {
      url.pathname = `/el${url.pathname}`;
      return NextResponse.redirect(url);
    }
    if (!isAuthed) {
      url.pathname = '/el';
      url.searchParams.set('err', 'admin_auth');
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next|public|api|favicon.ico).*)'] };