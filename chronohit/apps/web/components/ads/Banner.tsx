'use client';
import { useEffect, useRef, useState } from 'react';
export default function Banner({ placement }: {placement: 'home'|'store'|'leaderboards'|'results'}) {
  const [viewable, setViewable] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setViewable(e.isIntersecting && e.intersectionRatio >= 0.5), { threshold: [0.5]});
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    let t: any;
    if (viewable) {
      t = setInterval(() => { /* call ad provider refresh here */ }, Number(process.env.NEXT_PUBLIC_ADS_REFRESH_SECONDS || '60') * 1000);
    }
    return () => t && clearInterval(t);
  }, [viewable]);
  return <div ref={ref} className="w-full h-24 bg-neutral-800/50 rounded-xl flex items-center justify-center text-neutral-400">Banner • {placement}</div>;
}