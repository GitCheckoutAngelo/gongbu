/**
 * Smoothly animates its height when its content changes size (e.g. a tall form swapped for a slim
 * bar), so the content below glides instead of jumping. Children are measured with ResizeObserver.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function AnimatedHeight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={`animated-height ${className}`} style={{ height }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
