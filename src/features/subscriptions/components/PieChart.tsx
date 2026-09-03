/**
 * PieChart — minimal donut chart built on react-native-svg.
 *
 * True arc slices (filled paths) with a center cutout and a per-slice angular
 * gap. Slices fade in with a stagger on mount — opacity only, no layout work
 * per frame.
 *
 * Skill rules:
 *  - `animation-gpu-properties`: entrance animates opacity only.
 *  - `react-compiler-reanimated-shared-values`: `.set()`/`.get()`.
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface PieSlice {
  value: number;
  color: string;
}

export interface PieChartProps {
  slices: PieSlice[];
  /** Outer diameter in dp. Default 148. */
  size?: number;
  /** Center-hole radius as a ratio of the outer radius. Default 0.62. */
  holeRatio?: number;
  /** Angular gap between slices in degrees (0 for a single slice). */
  gapDeg?: number;
  /** Center cutout fill — pass the card's surface color. */
  holeColor: string;
  /** Content rendered centered in the hole. */
  center?: ReactNode;
}

export function PieChart({
  slices,
  size = 148,
  holeRatio = 0.62,
  gapDeg = 1.5,
  holeColor,
  center,
}: PieChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const n = slices.length;
  const gap = n > 1 ? gapDeg : 0;
  const usable = 360 - n * gap;
  const r = size / 2;
  const holeR = r * holeRatio;

  // Build segments clockwise from 12 o'clock (-90°).
  let offset = 0;
  const segments = slices.map((s) => {
    const sweep = total > 0 ? (s.value / total) * usable : 0;
    const seg = { color: s.color, start: offset, sweep };
    offset += sweep + gap;
    return seg;
  });
  // Jitter-proof: extend the last slice to close the circle exactly.
  const last = segments[n - 1];
  if (n > 1 && last) {
    last.sweep += 360 - offset + gap;
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {segments.map((seg, i) => (
          <Slice
            key={i}
            cx={r}
            cy={r}
            r={r}
            start={seg.start}
            sweep={seg.sweep}
            color={seg.color}
            delayMs={i * 60}
          />
        ))}
      </Svg>
      <View
        style={[
          styles.hole,
          {
            left: r - holeR,
            top: r - holeR,
            width: holeR * 2,
            height: holeR * 2,
            borderRadius: holeR,
            backgroundColor: holeColor,
          },
        ]}
      >
        {center}
      </View>
    </View>
  );
}

// --- Internals --------------------------------------------------------------

/** One pie slice — owns its entrance animation (opacity only). */
function Slice({
  cx,
  cy,
  r,
  start,
  sweep,
  color,
  delayMs,
}: {
  cx: number;
  cy: number;
  r: number;
  start: number;
  sweep: number;
  color: string;
  delayMs: number;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.set(withDelay(delayMs, withTiming(1, { duration: 420 })));
  }, [opacity, delayMs]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.get(),
  }));

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      d={slicePath(cx, cy, r, start, start + sweep)}
      fill={color}
    />
  );
}

/** Named owner contract for a point on the circle. */
type PolarPoint = { x: number; y: number };

/** Polar → cartesian, with 0° at 12 o'clock and clockwise-positive angles. */
function polar(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): PolarPoint {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Pie-wedge path from the center to `start`, around to `end`. */
function slicePath(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
): string {
  const p1 = polar(cx, cy, r, start);
  const p2 = polar(cx, cy, r, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

const styles = StyleSheet.create({
  hole: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderCurve: 'continuous',
  },
});
