'use client';

import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const LINK_DIST = 150; // px within which two nodes connect
const MOUSE_DIST = 180; // px within which the cursor connects to nodes

// Global animated backdrop: a slow amber "constellation" (identity graph) on
// canvas. Non-interactive layer, reduced-motion aware, with cleanup.
export function ConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    // Non-null aliases so nested closures keep the narrowed types.
    const cv = canvas;
    const ctx = context;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#f59e0b';

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    const mouse = { x: -9999, y: -9999 };

    function resize() {
      width = cv.clientWidth;
      height = cv.clientHeight;
      cv.width = Math.floor(width * dpr);
      cv.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(80, Math.floor((width * height) / 20000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }

      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DIST) {
            ctx.globalAlpha = (1 - dist / LINK_DIST) * 0.22;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Cursor connects to nearby nodes for a subtle interactive feel.
      for (const n of nodes) {
        const dist = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        if (dist < MOUSE_DIST) {
          ctx.globalAlpha = (1 - dist / MOUSE_DIST) * 0.5;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 0.75;
      ctx.fillStyle = accent;
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    let raf = 0;
    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    resize();
    window.addEventListener('resize', resize);
    if (reduce) {
      draw();
    } else {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseout', onLeave);
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      <div className="absolute top-[-12%] left-1/2 h-[55vh] w-[70vw] -translate-x-1/2 glow" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-vignette" />
      <div className="absolute inset-0 bg-noise" />
    </div>
  );
}
