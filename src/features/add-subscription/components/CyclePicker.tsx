/**
 * CyclePicker — 3-segment control wired to the form's `cycle` draft field.
 * Skill rule `list-performance-callbacks`: onSelect is parent-owned/stable.
 */

import { SegmentedControl } from '@/design/components';
import { CYCLES } from '@/utils/constants';
import type { Cycle } from '@/types/subscription';

const ORDER: readonly Cycle[] = CYCLES.map((c) => c.cycle);

export interface CyclePickerProps {
  value: Cycle;
  onSelect: (cycle: Cycle) => void;
}

export function CyclePicker({ value, onSelect }: CyclePickerProps) {
  const selectedIndex = ORDER.indexOf(value);
  const labels = CYCLES.map((c) => c.label);
  return (
    <SegmentedControl
      segments={labels}
      selectedIndex={selectedIndex}
      onSelect={(i) => onSelect(ORDER[i] ?? 'monthly')}
    />
  );
}