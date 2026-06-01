"use client";

import { useEffect, useRef } from "react";

const RES = 4; // pixel step for performance

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;

    function resize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    const isDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

    function draw() {
      ctx!.clearRect(0, 0, w, h);

      const t = performance.now() * 0.0003;
      const dark = isDark();
      const maxAlpha = dark ? 0.08 : 0.06;

      // Two endpoint colors — the caustic value interpolates between them
      const r1 = dark ? 80 : 200;
      const g1 = dark ? 60 : 180;
      const b1 = dark ? 100 : 220; // indigo/warm
      const r2 = dark ? 30 : 230;
      const g2 = dark ? 50 : 200;
      const b2 = dark ? 60 : 190; // teal/cool

      const imageData = ctx!.createImageData(w, h);
      const data = imageData.data;

      for (let y = 0; y < h; y += RES) {
        for (let x = 0; x < w; x += RES) {
          // Layered sine waves creating caustic interference
          const nx = x / w;
          const ny = y / h;

          const v =
            Math.sin(nx * 8 + t * 1.3) * Math.cos(ny * 6 + t * 0.7) +
            Math.sin(nx * 5 - t * 0.9 + 2) * Math.cos(ny * 7 + t * 1.1) +
            Math.sin(nx * 10 + ny * 4 + t * 0.5) * 0.5;

          // Normalize to 0-1
          const brightness = (v + 2.5) / 5;
          const alpha = brightness * maxAlpha;

          // Interpolate hue between the two color endpoints
          const r = Math.round(r1 + (r2 - r1) * brightness);
          const g = Math.round(g1 + (g2 - g1) * brightness);
          const bb = Math.round(b1 + (b2 - b1) * brightness);

          // Fill the RES×RES block
          for (let dy = 0; dy < RES && y + dy < h; dy++) {
            for (let dx = 0; dx < RES && x + dx < w; dx++) {
              const idx = ((y + dy) * w + (x + dx)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = bb;
              data[idx + 3] = Math.round(alpha * 255);
            }
          }
        }
      }

      ctx!.putImageData(imageData, 0, 0);
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10" aria-hidden />;
}
