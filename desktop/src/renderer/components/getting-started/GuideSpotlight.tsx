import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import AnchoredGuide from './AnchoredGuide';
import type { RunnerGuide } from '../../../shared/runner-tutorial';

/** An outside glow leaves the actual control's shape and styling intact. */
export default function GuideSpotlight({
  target,
  guide,
}: {
  target: RunnerGuide['highlight'];
  guide?: RunnerGuide;
}) {
  const [bounds, setBounds] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    borderRadius: number;
  } | null>(null);
  useEffect(() => {
    setBounds(null);
    if (!target) return undefined;
    const workspace = document.querySelector('.desktop-workspace');
    if (!workspace) return undefined;
    let frame = 0;
    const measure = () => {
      const control = workspace.querySelector<HTMLElement>(
        `[data-coaching-control="${target}"]`,
      );
      const rect = control?.getBoundingClientRect();
      if (
        !control ||
        !rect?.width ||
        !rect.height ||
        !control.getClientRects().length
      ) {
        setBounds(null);
        return;
      }
      const padding = 7;
      setBounds({
        left: rect.left - padding,
        top: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius:
          target === 'tool'
            ? 999
            : Math.max(
                12,
                parseFloat(getComputedStyle(control).borderRadius) + padding ||
                  12,
              ),
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(schedule);
    resize?.observe(workspace);
    const mutation = new MutationObserver(schedule);
    mutation.observe(workspace, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutation.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [target]);
  return target && bounds
    ? createPortal(
        <>
          <div className="coco-guide-spotlight" style={bounds} aria-hidden="true" />
          {guide && <AnchoredGuide guide={guide} bounds={bounds} />}
        </>,
        document.body,
      )
    : null;
}
