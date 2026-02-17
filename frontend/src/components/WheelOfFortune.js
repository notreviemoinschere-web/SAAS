import { useState, useCallback } from "react";

const COLORS = [
  "#4F46E5", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

export function WheelOfFortune({ prizes, onSpinRequest, spinning, resultIndex }) {
  const [rotation, setRotation] = useState(0);
  const [hasSpun, setHasSpun] = useState(false);
  const segmentCount = prizes.length || 1;
  const segmentAngle = 360 / segmentCount;

  const handleSpin = useCallback(async () => {
    if (spinning || hasSpun) return;
    const result = await onSpinRequest();
    if (result === null || result === undefined) return;

    const idx = typeof result === "number" ? result : 0;
    // Calculate target rotation: land on the winning segment
    const targetAngle = 360 - (idx * segmentAngle + segmentAngle / 2);
    const totalRotation = rotation + 360 * 5 + targetAngle;
    setRotation(totalRotation);
    setHasSpun(true);
  }, [spinning, hasSpun, onSpinRequest, rotation, segmentAngle]);

  const viewBoxSize = 300;
  const center = viewBoxSize / 2;
  const radius = 140;

  const renderSegments = () => {
    if (prizes.length === 0) {
      return <circle cx={center} cy={center} r={radius} fill="#E5E7EB" />;
    }

    return prizes.map((prize, i) => {
      const startAngle = (i * segmentAngle - 90) * (Math.PI / 180);
      const endAngle = ((i + 1) * segmentAngle - 90) * (Math.PI / 180);

      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);

      const largeArc = segmentAngle > 180 ? 1 : 0;
      const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      const color = prize.color || COLORS[i % COLORS.length];
      const midAngle = ((i * segmentAngle + segmentAngle / 2) - 90) * (Math.PI / 180);
      const textDist = radius * 0.65;
      const textX = center + textDist * Math.cos(midAngle);
      const textY = center + textDist * Math.sin(midAngle);
      const textRotation = i * segmentAngle + segmentAngle / 2;

      return (
        <g key={i}>
          <path d={pathData} fill={color} stroke="white" strokeWidth="2" />
          <text
            x={textX}
            y={textY}
            fill="white"
            fontSize={segmentCount > 6 ? "9" : "11"}
            fontWeight="600"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${textRotation}, ${textX}, ${textY})`}
          >
            {(prize.label || "").length > 12 ? prize.label.substring(0, 12) + "..." : prize.label}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="relative inline-block" data-testid="wheel-of-fortune">
      {/* Pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
        <svg width="30" height="30" viewBox="0 0 30 30">
          <polygon points="15,28 5,5 25,5" fill="#0F172A" />
        </svg>
      </div>
      
      {/* Wheel */}
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px]"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
        }}
        data-testid="wheel-svg"
      >
        {/* Outer ring */}
        <circle cx={center} cy={center} r={radius + 4} fill="none" stroke="#0F172A" strokeWidth="4" />
        {renderSegments()}
        {/* Center circle */}
        <circle cx={center} cy={center} r="20" fill="#0F172A" />
        <circle cx={center} cy={center} r="16" fill="white" />
        <circle cx={center} cy={center} r="6" fill="#0F172A" />
      </svg>
    </div>
  );
}
