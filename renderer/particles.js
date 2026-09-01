// Ambient floating particles behind the panels — purely decorative, so it
// skips entirely under prefers-reduced-motion rather than drawing a static
// frame.
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COLORS = ['255, 47, 176', '41, 224, 255'];
const PARTICLE_COUNT = 46;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function spawnParticle(atBottom) {
  return {
    x: Math.random() * canvas.width,
    y: atBottom ? canvas.height + 10 : Math.random() * canvas.height,
    radius: Math.random() * 1.5 + 0.6,
    speed: Math.random() * 0.3 + 0.08,
    drift: (Math.random() - 0.5) * 0.15,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: Math.random() * 0.5 + 0.15
  };
}

resize();
window.addEventListener('resize', resize);

if (!prefersReducedMotion) {
  const particles = Array.from({ length: PARTICLE_COUNT }, () => spawnParticle(false));

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -10) Object.assign(p, spawnParticle(true));
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;

      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
      ctx.shadowColor = `rgba(${p.color}, ${p.alpha})`;
      ctx.shadowBlur = 4;
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(draw);
  };

  requestAnimationFrame(draw);
}
