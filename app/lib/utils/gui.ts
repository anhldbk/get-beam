import { DependencyList, RefObject, useEffect } from "react";
const INTERSECTION_THRESHOLD = 0.5;

export function useOnDisplayed(
  parentRef: RefObject<HTMLDivElement | null>,
  callback: () => Promise<void>,
  deps?: DependencyList,
) {
  const lazyInit = () => {
    if (!parentRef.current) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;
        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= INTERSECTION_THRESHOLD
        ) {
          await callback();
        }
      },
      { threshold: INTERSECTION_THRESHOLD, rootMargin: "0px" },
    );

    observer.observe(parentRef.current);
    return () => observer.disconnect();
  };

  useEffect(lazyInit, [parentRef, callback, deps]);
}

export function useOnDisappeared(
  parentRef: RefObject<HTMLDivElement | null>,
  callback: () => Promise<void>,
  deps?: DependencyList,
) {
  const lazyInit = () => {
    if (!parentRef.current) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;
        if (
          !entry.isIntersecting
        ) {
          await callback();
        }
      },
      { threshold: INTERSECTION_THRESHOLD, rootMargin: "0px" },
    );

    observer.observe(parentRef.current);
    return () => observer.disconnect();
  };

  useEffect(lazyInit, [parentRef, callback, deps]);
}
