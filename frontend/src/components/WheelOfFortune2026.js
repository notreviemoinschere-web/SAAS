import { useState, useRef, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";

const NEON_COLORS = [
  { bg: "#FF006E", glow: "rgba(255, 0, 110, 0.6)" },
  { bg: "#8338EC", glow: "rgba(131, 56, 236, 0.6)" },
  { bg: "#3A86FF", glow: "rgba(58, 134, 255, 0.6)" },
  { bg: "#06D6A0", glow: "rgba(6, 214, 160, 0.6)" },
  { bg: "#FFD60A", glow: "rgba(255, 214, 10, 0.6)" },
  { bg: "#FB5607", glow: "rgba(251, 86, 7, 0.6)" },
  { bg: "#E91E63", glow: "rgba(233, 30, 99, 0.6)" },
  { bg: "#00BCD4", glow: "rgba(0, 188, 212, 0.6)" },
];

export function WheelOfFortune2026({ 
  prizes = [], 
  onSpinRequest, 
  spinning, 
  disabled = false,
  primaryColor = "#6366f1",
  secondaryColor = "#8b5cf6"
}) {
  const canvasRef = useRef(null);
  const glowRef = useRef(null);
  const [rotation, setRotation] = useState(0);
  const [hasSpun, setHasSpun] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);
  const animationRef = useRef(null);
  const pulseRef = useRef(null);
  const targetRotationRef = useRef(0);
  const startTimeRef = useRef(0);
  const startRotationRef = useRef(0);

  const segmentCount = Math.max(prizes.length, 1);
  const segmentAngle = (2 * Math.PI) / segmentCount;

  // Pulse animation for idle state
  useEffect(() => {
    if (!isAnimating && !hasSpun) {
      const pulse = () => {
        setPulsePhase(p => (p + 0.02) % (Math.PI * 2));
        pulseRef.current = requestAnimationFrame(pulse);
      };
      pulseRef.current = requestAnimationFrame(pulse);
      return () => {
        if (pulseRef.current) cancelAnimationFrame(pulseRef.current);
      };
    }
  }, [isAnimating, hasSpun]);

  const drawWheel = useCallback((currentRotation) => {
    const canvas = canvasRef.current;
    const glowCanvas = glowRef.current;
    if (!canvas || !glowCanvas) return;
    
    const ctx = canvas.getContext("2d");
    const glowCtx = glowCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    glowCanvas.width = size * dpr;
    glowCanvas.height = size * dpr;
    
    ctx.scale(dpr, dpr);
    glowCtx.scale(dpr, dpr);

    const center = size / 2;
    const radius = size / 2 - 20;
    const pulseScale = 1 + Math.sin(pulsePhase) * 0.008;

    ctx.clearRect(0, 0, size, size);
    glowCtx.clearRect(0, 0, size, size);

    // Outer glow effect
    const gradient = glowCtx.createRadialGradient(center, center, radius * 0.7, center, center, radius + 30);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.7, `${primaryColor}20`);
    gradient.addColorStop(1, `${primaryColor}40`);
    glowCtx.fillStyle = gradient;
    glowCtx.fillRect(0, 0, size, size);

    // Outer metallic ring with gradient
    const ringGrad = ctx.createLinearGradient(0, 0, size, size);
    ringGrad.addColorStop(0, "#1e1e2e");
    ringGrad.addColorStop(0.5, "#2d2d44");
    ringGrad.addColorStop(1, "#1e1e2e");
    
    ctx.beginPath();
    ctx.arc(center, center, (radius + 14) * pulseScale, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();

    // LED lights ring
    const ledCount = 24;
    for (let i = 0; i < ledCount; i++) {
      const angle = (i / ledCount) * Math.PI * 2 - Math.PI / 2;
      const ledX = center + (radius + 8) * Math.cos(angle) * pulseScale;
      const ledY = center + (radius + 8) * Math.sin(angle) * pulseScale;
      const isLit = Math.floor((Date.now() / 100 + i) % 3) === 0;
      
      ctx.beginPath();
      ctx.arc(ledX, ledY, 3, 0, Math.PI * 2);
      ctx.fillStyle = isLit ? "#fff" : "#555";
      ctx.fill();
      
      if (isLit) {
        ctx.beginPath();
        ctx.arc(ledX, ledY, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fill();
      }
    }

    // Inner gold ring
    ctx.beginPath();
    ctx.arc(center, center, (radius + 2) * pulseScale, 0, Math.PI * 2);
    ctx.strokeStyle = "linear-gradient(#ffd700, #b8860b)";
    ctx.lineWidth = 3;
    const goldGrad = ctx.createLinearGradient(0, 0, size, size);
    goldGrad.addColorStop(0, "#ffd700");
    goldGrad.addColorStop(0.5, "#ffec8b");
    goldGrad.addColorStop(1, "#b8860b");
    ctx.strokeStyle = goldGrad;
    ctx.stroke();

    // Save for rotation
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((currentRotation * Math.PI) / 180);
    ctx.translate(-center, -center);

    // Draw segments with 3D effect
    if (prizes.length > 0) {
      prizes.forEach((prize, i) => {
        const startAngle = i * segmentAngle - Math.PI / 2;
        const endAngle = (i + 1) * segmentAngle - Math.PI / 2;
        const colors = NEON_COLORS[i % NEON_COLORS.length];
        const bgColor = prize.display_color || colors.bg;

        // Segment shadow for 3D effect
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius * pulseScale, startAngle, endAngle);
        ctx.closePath();
        
        // Create gradient for segment
        const midAngle = startAngle + segmentAngle / 2;
        const gradientX = center + radius * 0.5 * Math.cos(midAngle);
        const gradientY = center + radius * 0.5 * Math.sin(midAngle);
        const segGrad = ctx.createRadialGradient(
          gradientX, gradientY, 0,
          gradientX, gradientY, radius
        );
        segGrad.addColorStop(0, lightenColor(bgColor, 30));
        segGrad.addColorStop(0.5, bgColor);
        segGrad.addColorStop(1, darkenColor(bgColor, 20));
        
        ctx.fillStyle = segGrad;
        ctx.fill();

        // Segment border
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text with shadow
        const textDist = radius * 0.58;
        const textX = center + textDist * Math.cos(midAngle);
        const textY = center + textDist * Math.sin(midAngle);

        ctx.save();
        ctx.translate(textX, textY);
        ctx.rotate(midAngle + Math.PI / 2);
        
        // Text shadow
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.font = `bold ${segmentCount > 6 ? 11 : segmentCount > 4 ? 13 : 15}px 'Plus Jakarta Sans', system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        let label = prize.label || "";
        if (label.length > 16) label = label.substring(0, 14) + "...";
        ctx.fillText(label, 1, 1);
        
        // Main text
        ctx.fillStyle = "#fff";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      });
    }

    ctx.restore();

    // Center hub with glossy effect
    const hubGrad = ctx.createRadialGradient(center - 5, center - 5, 0, center, center, 28);
    hubGrad.addColorStop(0, "#444");
    hubGrad.addColorStop(0.5, "#222");
    hubGrad.addColorStop(1, "#111");
    
    ctx.beginPath();
    ctx.arc(center, center, 28, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner shine
    const shineGrad = ctx.createRadialGradient(center - 8, center - 8, 0, center, center, 22);
    shineGrad.addColorStop(0, "rgba(255,255,255,0.3)");
    shineGrad.addColorStop(1, "transparent");
    
    ctx.beginPath();
    ctx.arc(center, center, 22, 0, Math.PI * 2);
    ctx.fillStyle = shineGrad;
    ctx.fill();

    // Center button
    ctx.beginPath();
    ctx.arc(center, center, 12, 0, Math.PI * 2);
    const btnGrad = ctx.createRadialGradient(center - 3, center - 3, 0, center, center, 12);
    btnGrad.addColorStop(0, primaryColor);
    btnGrad.addColorStop(1, secondaryColor);
    ctx.fillStyle = btnGrad;
    ctx.fill();

  }, [prizes, segmentAngle, segmentCount, pulsePhase, primaryColor, secondaryColor]);

  // Ease function for smooth animation
  const easeOutExpo = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

  // Animation loop
  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    const duration = 5000; // 5 seconds for dramatic effect
    const progress = Math.min(elapsed / duration, 1);

    const eased = easeOutExpo(progress);
    const totalDelta = targetRotationRef.current - startRotationRef.current;
    const currentRot = startRotationRef.current + totalDelta * eased;

    drawWheel(currentRot);

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setRotation(targetRotationRef.current);
      setIsAnimating(false);
      // Trigger confetti on win
      triggerConfetti();
    }
  }, [drawWheel]);

  const triggerConfetti = () => {
    const colors = [primaryColor, secondaryColor, '#ffd700', '#ff006e'];
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors
    });
  };

  // Draw on mount and when prizes change
  useEffect(() => {
    drawWheel(rotation);
  }, [drawWheel, rotation, prizes, pulsePhase]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => drawWheel(rotation);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawWheel, rotation]);

  const handleSpin = useCallback(async () => {
    if (isAnimating || hasSpun || disabled) return;
    const result = await onSpinRequest();
    if (result === null || result === undefined) return;

    const idx = typeof result === "number" ? result : 0;
    const segDeg = 360 / segmentCount;
    const targetAngle = 360 - (idx * segDeg + segDeg / 2);
    const totalTarget = rotation + 360 * 7 + targetAngle; // 7 full rotations

    startRotationRef.current = rotation;
    targetRotationRef.current = totalTarget;
    startTimeRef.current = 0;
    setIsAnimating(true);
    setHasSpun(true);
    
    if (pulseRef.current) cancelAnimationFrame(pulseRef.current);
    animationRef.current = requestAnimationFrame(animate);
  }, [isAnimating, hasSpun, disabled, onSpinRequest, rotation, segmentCount, animate]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (pulseRef.current) cancelAnimationFrame(pulseRef.current);
    };
  }, []);

  return (
    <div className="relative inline-block" data-testid="wheel-of-fortune-2026">
      {/* Glow layer */}
      <canvas
        ref={glowRef}
        className="absolute inset-0 w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] pointer-events-none blur-xl opacity-60"
        style={{ width: 400, height: 400 }}
      />
      
      {/* Premium pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20" style={{ marginTop: "-8px" }}>
        <svg width="40" height="50" viewBox="0 0 40 50" fill="none">
          <defs>
            <linearGradient id="pointerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd700" />
              <stop offset="50%" stopColor="#ffec8b" />
              <stop offset="100%" stopColor="#b8860b" />
            </linearGradient>
            <filter id="pointerShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.5"/>
            </filter>
          </defs>
          <path 
            d="M20 45 L5 10 Q20 0 35 10 Z" 
            fill="url(#pointerGrad)" 
            filter="url(#pointerShadow)"
            stroke="#b8860b"
            strokeWidth="1"
          />
          <circle cx="20" cy="15" r="4" fill="#fff" opacity="0.6"/>
        </svg>
      </div>

      {/* Main wheel canvas */}
      <canvas
        ref={canvasRef}
        data-testid="wheel-canvas"
        onClick={handleSpin}
        className={`w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] cursor-pointer transition-transform ${
          !isAnimating && !hasSpun && !disabled ? "hover:scale-[1.02]" : ""
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        style={{ width: 400, height: 400 }}
      />
      
      {/* Spin text overlay */}
      {!hasSpun && !isAnimating && !disabled && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ marginTop: "0px" }}
        >
          <div className="animate-pulse text-white font-bold text-sm tracking-wider bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm">
            CLIQUEZ POUR TOURNER
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function lightenColor(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

function darkenColor(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return "#" + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

export default WheelOfFortune2026;
