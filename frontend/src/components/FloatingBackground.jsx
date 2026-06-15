import { useEffect, useRef } from 'react';

const FloatingBackground = ({ theme }) => {
  const canvasRef = useRef(null);
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    const particleCount = 75;
    const CONNECTION_DIST = 130; // max distance to draw a constellation line

    const mouse = { x: null, y: null, radius: 120 };

    const handleMouseMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const handleMouseLeave = () => { mouse.x = null; mouse.y = null; };

    const resizeCanvas = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    resizeCanvas();

    class Particle {
      constructor() {
        this.reset();
        this.y = Math.random() * canvas.height;
      }

      reset() {
        this.x         = Math.random() * canvas.width;
        this.y         = canvas.height + 20;
        this.size      = Math.random() * 2 + 0.5;
        this.speedY    = -(Math.random() * 0.4 + 0.15);
        this.speedX    = (Math.random() - 0.5) * 0.15;
        this.baseAlpha = Math.random() * 0.5 + 0.2;
        this.alpha     = this.baseAlpha;
        this.pulseSpeed = Math.random() * 0.02 + 0.005;
        this.pulseDir  = 1;
        this.type      = Math.random() > 0.4 ? 'cyan' : 'purple';
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;

        this.alpha += this.pulseSpeed * this.pulseDir;
        if (this.alpha > 0.8 || this.alpha < this.baseAlpha) this.pulseDir *= -1;

        if (mouse.x !== null && mouse.y !== null) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            this.x += (dx / dist) * force * 3;
            this.y += (dy / dist) * force * 2 + this.speedY * 0.5;
          }
        }

        if (this.y < -10 || this.x < -10 || this.x > canvas.width + 10) this.reset();
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);

        const isDark = themeRef.current === 'dark';
        const colorStr = this.type === 'cyan'
          ? (isDark ? 'rgba(0, 240, 255,' : 'rgba(8, 145, 178,')
          : (isDark ? 'rgba(171, 0, 255,' : 'rgba(124, 58, 237,');

        ctx.fillStyle = `${colorStr} ${this.alpha})`;

        if (this.size > 1.8) {
          ctx.shadowBlur  = isDark ? 10 : 4;
          ctx.shadowColor = this.type === 'purple'
            ? (isDark ? '#ab00ff' : '#7c3aed')
            : (isDark ? '#00f0ff' : '#0891b2');
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) particles.push(new Particle());

    const drawConstellations = () => {
      const isDark = themeRef.current === 'dark';
      ctx.shadowBlur = 0;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DIST) {
            // Fade the line based on distance
            const lineAlpha = (1 - dist / CONNECTION_DIST) * 0.18;

            // Mix colour based on particle types
            let lineColor;
            if (a.type === b.type) {
              lineColor = a.type === 'cyan'
                ? (isDark ? `rgba(0,240,255,${lineAlpha})` : `rgba(8,145,178,${lineAlpha})`)
                : (isDark ? `rgba(171,0,255,${lineAlpha})` : `rgba(124,58,237,${lineAlpha})`);
            } else {
              // Mixed — use a mid purple-cyan tint
              lineColor = isDark
                ? `rgba(90,120,255,${lineAlpha})`
                : `rgba(79,70,229,${lineAlpha})`;
            }

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = lineColor;
            ctx.lineWidth   = 0.6;
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isDark = themeRef.current === 'dark';

      const radialGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 10,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
      );
      if (isDark) {
        radialGrad.addColorStop(0,   '#0a0720');
        radialGrad.addColorStop(0.6, '#040212');
        radialGrad.addColorStop(1,   '#02000a');
      } else {
        radialGrad.addColorStop(0,   '#ffffff');
        radialGrad.addColorStop(0.6, '#f3f4f8');
        radialGrad.addColorStop(1,   '#e2e8f0');
      }
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Scanline overlay
      ctx.fillStyle = isDark ? 'rgba(0,240,255,0.007)' : 'rgba(99,102,241,0.008)';
      for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 1);

      // Constellation lines drawn before particles so they sit behind
      drawConstellations();

      particles.forEach((p) => { p.update(); p.draw(); });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-20 pointer-events-none"
    />
  );
};

export default FloatingBackground;
