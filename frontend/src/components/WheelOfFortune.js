import { useState, useRef, useEffect, useCallback } from "react";

const DEFAULT_COLORS = [
  "#4F46E5", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

export function WheelOfFortune({ prizes = [], onSpinRequest, spinning }) {
  const canvasRef = useRef(null);
  const [rotation, setRotation] = useState(0);
  const [hasSpun, setHasSpun] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef(null);
  const targetRotationRef = useRef(0);
  const startTimeRef = useRef(0);
  const startRotationRef = useRef(0);

  const segmentCount = Math.max(prizes.length, 1);
  const segmentAngle = (2 * Math.PI) / segmentCount;

  const drawWheel = useCallback((currentRotation) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const radius = size / 2 - 12;

    ctx.clearRect(0, 0, size, size);

    // Outer dark ring
    ctx.beginPath();
    ctx.arc(center, center, radius + 6, 0, Math.PI * 2);
    ctx.fillStyle = "#0F172A";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center, center, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = "#E2E8F0";
    ctx.fill();

    // Save for rotation
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((currentRotation * Math.PI) / 180);
    ctx.translate(-center, -center);

    // Draw segments
    if (prizes.length > 0) {
      prizes.forEach((prize, i) => {
        const startAngle = i * segmentAngle - Math.PI / 2;
        const endAngle = (i + 1) * segmentAngle - Math.PI / 2;
        const color = prize.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];

        // Segment path
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Text
        const midAngle = startAngle + segmentAngle / 2;
        const textDist = radius * 0.62;
        const textX = center + textDist * Math.cos(midAngle);
        const textY = center + textDist * Math.sin(midAngle);

        ctx.save();
        ctx.translate(textX, textY);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.fillStyle = "white";
        ctx.font = `bold ${segmentCount > 6 ? 10 : segmentCount > 4 ? 12 : 14}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let label = prize.label || "";
        if (label.length > 14) label = label.substring(0, 12) + "...";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      });
    } else {
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#E5E7EB";
      ctx.fill();
    }

    // Separator dots
    prizes.forEach((_, i) => {
      const angle = i * segmentAngle - Math.PI / 2;
      const dx = center + (radius + 4) * Math.cos(angle);
      const dy = center + (radius + 4) * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
    });

    ctx.restore();

    // Center hub (not rotated)
    ctx.beginPath();
    ctx.arc(center, center, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#0F172A";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center, center, 18, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center, center, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#0F172A";
    ctx.fill();
  }, [prizes, segmentAngle, segmentCount]);

  // Animation loop
  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    const duration = 4000;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const totalDelta = targetRotationRef.current - startRotationRef.current;
    const currentRot = startRotationRef.current + totalDelta * eased;

    drawWheel(currentRot);

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setRotation(targetRotationRef.current);
      setIsAnimating(false);
    }
  }, [drawWheel]);

  // Draw on mount and when prizes change
  useEffect(() => {
    drawWheel(rotation);
  }, [drawWheel, rotation, prizes]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => drawWheel(rotation);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawWheel, rotation]);

  const handleSpin = useCallback(async () => {
    if (isAnimating || hasSpun) return;
    const result = await onSpinRequest();
    if (result === null || result === undefined) return;

    const idx = typeof result === "number" ? result : 0;
    const segDeg = 360 / segmentCount;
    const targetAngle = 360 - (idx * segDeg + segDeg / 2);
    const totalTarget = rotation + 360 * 5 + targetAngle;

    startRotationRef.current = rotation;
    targetRotationRef.current = totalTarget;
    startTimeRef.current = 0;
    setIsAnimating(true);
    setHasSpun(true);
    animationRef.current = requestAnimationFrame(animate);
  }, [isAnimating, hasSpun, onSpinRequest, rotation, segmentCount, animate]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="relative inline-block" data-testid="wheel-of-fortune">
      {/* Pointer triangle */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10" style={{ marginTop: "-2px" }}>
        <canvas
          ref={useCallback((el) => {
            if (!el) return;
            const dpr = window.devicePixelRatio || 1;
            el.width = 32 * dpr;
            el.height = 32 * dpr;
            const ctx = el.getContext("2d");
            ctx.scale(dpr, dpr);
            ctx.beginPath();
            ctx.moveTo(16, 28);
            ctx.lineTo(4, 4);
            ctx.lineTo(28, 4);
            ctx.closePath();
            ctx.fillStyle = "#0F172A";
            ctx.fill();
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;
            ctx.stroke();
          }, [])}
          width="32"
          height="32"
          style={{ width: 32, height: 32 }}
        />
      </div>

      {/* Wheel Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="wheel-canvas"
        className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px]"
        style={{ width: 340, height: 340 }}
      />
    </div>
  );
}
