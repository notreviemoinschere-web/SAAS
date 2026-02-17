import { useState, useCallback } from "react";

const DEFAULT_COLORS = [
  "#4F46E5", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

export function WheelOfFortune({ prizes = [], onSpinRequest, spinning }) {
  const [rotation, setRotation] = useState(0);
  const [hasSpun, setHasSpun] = useState(false);
  const segmentCount = Math.max(prizes.length, 1);
  const segmentAngle = 360 / segmentCount;
  const size = 300;
  const center = size / 2;
  const radius = 135;

  const handleSpin = useCallback(async () => {
    if (spinning || hasSpun) return;
    const result = await onSpinRequest();
    if (result === null || result === undefined) return;

    const idx = typeof result === "number" ? result : 0;
    const targetAngle = 360 - (idx * segmentAngle + segmentAngle / 2);
    const totalRotation = rotation + 360 * 5 + targetAngle;
    setRotation(totalRotation);
    setHasSpun(true);
  }, [spinning, hasSpun, onSpinRequest, rotation, segmentAngle]);

  const createSegmentPath = (index) => {
    const startDeg = index * segmentAngle - 90;
    const endDeg = (index + 1) * segmentAngle - 90;
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArc = segmentAngle > 180 ? 1 : 0;

    return `M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z`;
  };

  const getTextPosition = (index) => {
    const midDeg = index * segmentAngle + segmentAngle / 2 - 90;
    const midRad = (midDeg * Math.PI) / 180;
    const dist = radius * 0.62;
    return {
      x: center + dist * Math.cos(midRad),
      y: center + dist * Math.sin(midRad),
      rotation: index * segmentAngle + segmentAngle / 2,
    };
  };

  return (
    <div className="relative inline-block" data-testid="wheel-of-fortune">
      {/* Pointer triangle */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10" style={{ marginTop: "-2px" }}>
        <svg width="32" height="32" viewBox="0 0 32 32">
          <polygon points="16,30 4,4 28,4" fill="#0F172A" stroke="white" strokeWidth="1" />
        </svg>
      </div>

      {/* Wheel SVG */}
      <div
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
        }}
        data-testid="wheel-container"
      >
        <svg
          width="300"
          height="300"
          viewBox={`0 0 ${size} ${size}`}
          className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px]"
          data-testid="wheel-svg"
        >
          {/* Background circle */}
          <circle cx={center} cy={center} r={radius + 6} fill="#0F172A" />
          <circle cx={center} cy={center} r={radius + 2} fill="#E5E7EB" />

          {/* Segments */}
          {prizes.length > 0 ? (
            prizes.map((prize, i) => {
              const color = prize.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
              const path = createSegmentPath(i);
              const textPos = getTextPosition(i);
              const label = (prize.label || "").length > 14
                ? prize.label.substring(0, 12) + "..."
                : prize.label || "";

              return (
                <g key={prize.id || i}>
                  <path
                    d={path}
                    fill={color}
                    stroke="white"
                    strokeWidth="2"
                  />
                  <text
                    x={textPos.x}
                    y={textPos.y}
                    fill="white"
                    fontSize={segmentCount > 6 ? "9" : segmentCount > 4 ? "10" : "12"}
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${textPos.rotation}, ${textPos.x}, ${textPos.y})`}
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })
          ) : (
            <circle cx={center} cy={center} r={radius} fill="#E5E7EB" />
          )}

          {/* Center hub */}
          <circle cx={center} cy={center} r="24" fill="#0F172A" />
          <circle cx={center} cy={center} r="20" fill="white" />
          <circle cx={center} cy={center} r="8" fill="#0F172A" />

          {/* Decorative dots on outer ring */}
          {prizes.map((_, i) => {
            const deg = (i * segmentAngle - 90) * Math.PI / 180;
            const dx = center + (radius + 4) * Math.cos(deg);
            const dy = center + (radius + 4) * Math.sin(deg);
            return <circle key={`dot-${i}`} cx={dx} cy={dy} r="3" fill="white" />;
          })}
        </svg>
      </div>
    </div>
  );
}
