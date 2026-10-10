import React, { useState, useEffect, useRef } from 'react';

/**
 * AnimatedNumber Component
 * Smooth 60fps number counting animation over a specified duration (default 750ms).
 * Employs easeOutCubic interpolation to avoid layout shifts and guarantee buttery smooth rollups.
 */
export default function AnimatedNumber({
  value,
  duration = 750,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = ''
}) {
  const [displayValue, setDisplayValue] = useState(Number(value) || 0);
  const startValueRef = useRef(Number(value) || 0);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = startValueRef.current;

    // If target equals current value, update immediately
    if (target === start) {
      setDisplayValue(target);
      return;
    }

    let animationFrameId;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1.0);

      // Ease Out Cubic: 1 - (1 - t)^3
      const ease = 1.0 - Math.pow(1.0 - progress, 3.0);
      const current = start + (target - start) * ease;

      setDisplayValue(current);

      if (progress < 1.0) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        startValueRef.current = target;
        startTimeRef.current = null;
        setDisplayValue(target);
      }
    };

    startTimeRef.current = null;
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, duration]);

  const formatted = decimals > 0
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toLocaleString('en-IN');

  return (
    <span className={`inline-block tabular-nums transition-colors duration-200 ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
