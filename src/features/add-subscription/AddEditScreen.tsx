/**
 * AddEditScreen — subscription add/edit modal.
 *
 * Skill rules followed:
 *  - `react-state-minimize`: the screen holds a single draft `state` object
 *    (no separate fields). Validation errors are DERIVED each render, never
 *    cached in state.
 *  - `react-state-dispatcher`: every field updater uses the dispatch form
 *    `setState((prev) => ({ ...prev, field: value }))`, never reading state
 *    directly inside a callback closure. Avoids stale closures.
 *  - `react-state-fallback`: draft is initialized LAZILY via `useState(() => …)`
 *    so we start from the existing sub (edit) or default (add), but user
 *    edits immediately replace those values — no `useEffect` syncing.
 *  - `list-performance-callbacks`: all field updaters are stable via
 *    `useCallback`, so child input components stay memoized.
 *  - `ui-pressable`: every Chip/SegmentedControl/Pressable swatch uses
 *    Pressable, never Touchable*.
 *  - `rendering-no-falsy-and`: ternaries only — no `value && <X />`.
 *  - `ui-menus` / `ui-native-modals`: the modal is presented by the route
 *    group (`/subscription/_layout.tsx`), not a JS bottom sheet.
 *  - `state-ground-truth`: the draft is ground truth; we interpolate category
 *    defaults from the user's chosen category only when `id` editing changes
 *    the icon slot — never overwriting user-typed values.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { spacing } from '@/design/tokens';
import { FormField } from '@/features/add-subscription/components/FormField';
import { TextField } from '@/features/add-subscription/components/TextField';
import { AmountInput } from '@/features/add-subscription/components/AmountInput';
import { DateInput } from '@/features/add-subscription/components/DateInput';
import { CyclePicker } from '@/features/add-subscription/components/CyclePicker';
import { CategoryPicker } from '@/features/add-subscription/components/CategoryPicker';
import { IconColorPicker } from '@/features/add-subscription/components/IconColorPicker';
import {
  defaultDraft,
  draftFromSubscription,
  errorsByField,
  validateDraft,
  categoryMeta,
  type FieldKey,
} from '@/features/add-subscription/form-helpers';
import type {
  CurrencyCode,
  Subscription,
  SubscriptionDraft,
} from '@/types/subscription';
import { useUIStore } from '@/store/useUIStore';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { FREE_SUB_LIMIT_MESSAGE } from '@/utils/limits';
import { toast } from '@/store/useToastStore';

export interface AddEditScreenProps {
  /** Pass an existing subscription to enter "edit" mode; undefined = add new. */
  existing?: Subscription | null | undefined;
  /** Default currency for new drafts when adding (overrides prefs). */
  defaultCurrency?: CurrencyCode;
  /** Save handler: parent owns navigation; receives saved sub id on success. */
  onSaved: (id: string) => void;
  onDismiss: () => void;
  /** Called when a free account has reached its subscription limit. */
  onLimitReached?: () => void;
}

export function AddEditScreen({
  existing,
  defaultCurrency,
  onSaved,
  onDismiss,
  onLimitReached,
}: AddEditScreenProps) {
  // Initialize the draft exactly once from the existing sub or a default.
  // Skill `react-state-fallback`: `undefined` means "no preference yet" — the
  // lazy init resolves that to a concrete defaultDraft the first time the
  // screen mounts, after which user edits strictly own the value.
  const persistedCurrency = useUIStore((s) => s.currency);
  const initialCurrency = defaultCurrency ?? persistedCurrency;

  // Single source of truth for the form: a draft that can mutate per field.
  // Per skill `react-state-minimize` we keep one state object, not N fields.
  const [draft, setDraft] = useState<SubscriptionDraft>(() =>
    existing ? draftFromSubscription(existing) : defaultDraft(initialCurrency),
  );

  // Track which fields the user has interacted with so we don't surface errors
  // until they've touched a field (or attempted submit).
  const [touched, setTouched] = useState<ReadonlySet<FieldKey>>(new Set());
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const isEdit = Boolean(existing);

  const add = useSubscriptionsStore((s) => s.add);
  const edit = useSubscriptionsStore((s) => s.edit);
  // Refs to the mutators so the stable updaters / submit memo don't snap referents.
  const addRef: MutableRefObject<typeof add> = useRef(add);
  const editRef: MutableRefObject<typeof edit> = useRef(edit);
  useEffect(() => {
    addRef.current = add;
  }, [add]);
  useEffect(() => {
    editRef.current = edit;
  }, [edit]);

  // Derived validation errors — recomputed each render (skill `react-state-minimize`).
  const errors = useMemo(() => validateDraft(draft), [draft]);
  const errorMap = useMemo(() => errorsByField(errors), [errors]);
  const isValid = errors.length === 0;

  // --- Stable field updaters (each dispatch via setState, not direct read) --
  // Skill `react-state-dispatcher`.
  const setName = useCallback((raw: string) => {
    setDraft((prev) => ({ ...prev, name: raw }));
  }, []);

  const setAmount = useCallback((raw: string) => {
    setDraft((prev) => ({
      ...prev,
      // Keep the raw string (ground truth) so a trailing decimal point
      // survives typing; the number is derived at save time.
      amount: raw,
    }));
  }, []);

  const setDate = useCallback((raw: string) => {
    setDraft((prev) => ({ ...prev, nextRenewal: raw }));
  }, []);

  const setTrialEnds = useCallback((raw: string) => {
    setDraft((prev) => ({ ...prev, trialEnds: raw }));
  }, []);

  const clearTrialEnds = useCallback(() => {
    setDraft((prev) => ({ ...prev, trialEnds: undefined }));
  }, []);

  const setCycle = useCallback((cycle: SubscriptionDraft['cycle']) => {
    setDraft((prev) => ({ ...prev, cycle }));
  }, []);

  const setCategory = useCallback((category: SubscriptionDraft['category']) => {
    setDraft((prev) => {
      // If the user added nothing custom to the icon yet, follow the category
      // default for convenience. Otherwise leave their chosen icon alone.
      const icon =
        prev.icon === categoryMeta(prev.category).icon
          ? categoryMeta(category).icon
          : prev.icon;
      return { ...prev, category, icon };
    });
  }, []);

  const setIcon = useCallback((icon: string) => {
    setDraft((prev) => ({ ...prev, icon }));
  }, []);

  const setColor = useCallback((hex: string) => {
    setDraft((prev) => ({ ...prev, color: hex }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setDraft((prev) => ({ ...prev, notes }));
  }, []);

  const markTouched = useCallback((field: FieldKey) => {
    setTouched((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }, []);

  // --- Submit -------------------------------------------------------------
  const onSubmit = useCallback(async () => {
    setAttemptedSubmit(true);
    if (!isValid) return;

    // Force-blur everything by attempting save regardless of focus.
    const cleanedDraft: SubscriptionDraft = {
      ...draft,
      name: draft.name.trim(),
      notes: draft.notes?.trim() || undefined,
      color: draft.color && draft.color.length > 0 ? draft.color : undefined,
    };

    if (isEdit && existing) {
      const saved = await editRef.current(existing.id, cleanedDraft);
      if (saved) {
        toast('Changes saved');
        onSaved(saved.id);
      } else if (useSubscriptionsStore.getState().queuedChange) {
        // Offline — the edit is queued and will sync on reconnect.
        toast("Saved — will sync when you're online");
        onDismiss();
      } else {
        // Not found — surface a native alert and stay in the modal.
        Alert.alert(
          'Subscription not found',
          'It may have been deleted elsewhere. Please dismiss and try again.',
          [{ text: 'Dismiss', onPress: onDismiss }],
        );
      }
    } else {
      const saved = await addRef.current(cleanedDraft);
      if (saved) {
        toast('Subscription added');
        onSaved(saved.id);
      } else {
        // The store swallows the underlying failure — surface its error so
        // real problems aren't hidden behind a generic message.
        const state = useSubscriptionsStore.getState();
        if (state.error === FREE_SUB_LIMIT_MESSAGE && onLimitReached) {
          onLimitReached();
        } else if (state.queuedChange) {
          // Offline — the add is queued and will sync on reconnect.
          toast("Saved — will sync when you're online");
          onDismiss();
        } else {
          const reason = state.error;
          Alert.alert(
            'Could not add subscription',
            reason
              ? `Something went wrong saving: ${reason}`
              : 'Something went wrong saving. Try again.',
          );
        }
      }
    }
  }, [draft, isValid, isEdit, existing, onSaved, onDismiss, onLimitReached]);

  const shouldShow = useCallback(
    (field: FieldKey) => attemptedSubmit || touched.has(field),
    [attemptedSubmit, touched],
  );

  return (
    <Surface background="surface" style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Card padding={spacing.lg} elevation="flat">
          <View style={styles.header}>
            <Text variant="title" weight="700" color="textPrimary">
              {isEdit ? 'Edit subscription' : 'New subscription'}
            </Text>
            <Button onPress={onDismiss} variant="ghost" size="sm">
              Cancel
            </Button>
          </View>
        </Card>

        <Card padding={spacing.lg} elevation="low">
          <View style={styles.stack}>
            <FormField
              field="name"
              label="Name"
              errorMap={errorMap}
              showError={shouldShow('name')}
            >
              <TextField
                value={draft.name}
                onChangeText={setName}
                onEndEditing={() => markTouched('name')}
                placeholder="e.g. Netflix"
                returnKeyType="next"
              />
            </FormField>

            <FormField
              field="amount"
              label="Amount"
              errorMap={errorMap}
              showError={shouldShow('amount')}
              helper={`Per ${cycleLabelFor(draft.cycle)}`}
            >
              <AmountInput
                currency={draft.currency}
                value={draft.amount}
                onChangeText={setAmount}
                onEndEditing={() => markTouched('amount')}
              />
            </FormField>

            <FormField
              field="nextRenewal"
              label="Next renewal"
              errorMap={errorMap}
              showError={shouldShow('nextRenewal')}
              helper="The next time this subscription charges"
            >
              <DateInput
                value={draft.nextRenewal}
                onChange={(iso) => {
                  setDate(iso);
                  markTouched('nextRenewal');
                }}
              />
            </FormField>

            <FormField
              field="trialEnds"
              label="Trial ends (optional)"
              errorMap={errorMap}
              showError={shouldShow('trialEnds')}
              helper="The last day of a free trial, if any"
            >
              <View style={styles.dateRow}>
                <View style={styles.dateRowField}>
                  <DateInput
                    value={draft.trialEnds ?? ''}
                    onChange={(iso) => {
                      setTrialEnds(iso);
                      markTouched('trialEnds');
                    }}
                  />
                </View>
                {draft.trialEnds ? (
                  <Button onPress={clearTrialEnds} variant="ghost" size="sm">
                    Clear
                  </Button>
                ) : null}
              </View>
            </FormField>

            <FormField
              field="cycle"
              label="Billing cycle"
              errorMap={errorMap}
              showError={shouldShow('cycle')}
            >
              <CyclePicker value={draft.cycle} onSelect={setCycle} />
            </FormField>

            <FormField
              field="category"
              label="Category"
              errorMap={errorMap}
              showError={shouldShow('category')}
            >
              <CategoryPicker value={draft.category} onSelect={setCategory} />
            </FormField>

            <IconColorPicker
              icon={draft.icon}
              color={draft.color}
              onSelectIcon={(name) => {
                setIcon(name);
                markTouched('icon');
              }}
              onSelectColor={(hex) => {
                setColor(hex);
                markTouched('color');
              }}
            />

            <FormField
              field="notes"
              label="Notes (optional)"
              errorMap={errorMap}
              showError={shouldShow('notes')}
              helper="Up to 280 characters"
            >
              <TextField
                value={draft.notes ?? ''}
                onChangeText={setNotes}
                onEndEditing={() => markTouched('notes')}
                placeholder="Renewal reminder, plan details…"
                multiline
                numberOfLines={3}
                maxLength={280}
                style={styles.notesInput}
              />
            </FormField>
          </View>
        </Card>

        <Button
          testID="add-submit"
          onPress={onSubmit}
          variant="primary"
          size="lg"
          disabled={!isValid && attemptedSubmit}
        >
          {isEdit ? 'Save changes' : 'Add subscription'}
        </Button>
      </ScrollView>
    </Surface>
  );
}

function cycleLabelFor(cycle: SubscriptionDraft['cycle']): string {
  switch (cycle) {
    case 'monthly':
      return 'month';
    case 'quarterly':
      return 'quarter';
    case 'yearly':
      return 'year';
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md, // tighter for Quiet Ledger
    paddingBottom: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stack: {
    gap: spacing.md, // tighter for Quiet Ledger
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateRowField: {
    flex: 1,
  },
  notesInput: {
    height: 48,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
});
