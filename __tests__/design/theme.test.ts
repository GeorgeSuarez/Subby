import {
  resolveScheme,
  resolveTheme,
  normalizeSystem,
  type ThemePreference,
  type SystemScheme,
} from '@/design/theme-resolve';
import {
  darkPalette,
  lightPalette,
  darkShadows,
  lightShadows,
} from '@/design/tokens';

describe('normalizeSystem', () => {
  type Cases = Array<{
    name: string;
    input: SystemScheme;
    expected: 'light' | 'dark' | null;
  }>;
  const cases: Cases = [
    { name: 'light → light', input: 'light', expected: 'light' },
    { name: 'dark → dark', input: 'dark', expected: 'dark' },
    { name: 'unspecified → null', input: 'unspecified', expected: null },
    { name: 'null → null', input: null, expected: null },
    { name: 'undefined → null', input: undefined, expected: null },
  ];
  for (const c of cases) {
    it(c.name, () => {
      expect(normalizeSystem(c.input)).toBe(c.expected);
    });
  }
});

describe('resolveScheme', () => {
  // Default behavior: undefined pref + null system → dark (dark-first identity).
  it('falls back to dark when pref and system are both unknown', () => {
    expect(resolveScheme(undefined, null)).toBe('dark');
  });

  it("respects explicit 'light' preference over a dark system", () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
  });

  it("respects explicit 'dark' preference over a light system", () => {
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it("'system' pref follows the system", () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark'); // dark-first when system unknown
  });
});

describe('resolveTheme', () => {
  type Cases = Array<{
    name: string;
    pref: ThemePreference | undefined;
    system: SystemScheme;
    expectScheme: 'light' | 'dark';
  }>;

  const cases: Cases = [
    // Default fallback (undefined pref → system) — dark-first bias.
    {
      name: 'undefined pref + dark system → dark',
      pref: undefined,
      system: 'dark',
      expectScheme: 'dark',
    },
    {
      name: 'undefined pref + light system → light',
      pref: undefined,
      system: 'light',
      expectScheme: 'light',
    },
    // System = unspecified or null is treated as dark (dark-first identity).
    {
      name: 'undefined pref + unspecified system → dark (dark-first)',
      pref: undefined,
      system: 'unspecified',
      expectScheme: 'dark',
    },
    {
      name: 'undefined pref + null system → dark (dark-first)',
      pref: undefined,
      system: null,
      expectScheme: 'dark',
    },

    // Explicit 'system' preference behaves like undefined fallback.
    {
      name: 'system pref + light system → light',
      pref: 'system',
      system: 'light',
      expectScheme: 'light',
    },
    {
      name: 'system pref + dark system → dark',
      pref: 'system',
      system: 'dark',
      expectScheme: 'dark',
    },

    // Explicit overrides win regardless of system.
    {
      name: 'dark pref + light system → dark',
      pref: 'dark',
      system: 'light',
      expectScheme: 'dark',
    },
    {
      name: 'light pref + dark system → light',
      pref: 'light',
      system: 'dark',
      expectScheme: 'light',
    },
    {
      name: 'light pref + null system → light',
      pref: 'light',
      system: null,
      expectScheme: 'light',
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const theme = resolveTheme(c.pref, c.system);
      expect(theme.scheme).toBe(c.expectScheme);
      expect(theme.colors).toBe(
        c.expectScheme === 'dark' ? darkPalette : lightPalette,
      );
      // shadow(name) should resolve from the matching palette's shadow table.
      expect(theme.shadow('sm')).toBe(
        c.expectScheme === 'dark' ? darkShadows.sm : lightShadows.sm,
      );
      expect(theme.shadow('glowAccent')).toBe(
        c.expectScheme === 'dark'
          ? darkShadows.glowAccent
          : lightShadows.glowAccent,
      );
    });
  }
});
