import { useAuthStore } from '@/store/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(async () => {
    // Clear any persisted session from a previous test so hydration can't
    // resurrect it mid-run.
    await useAuthStore.persist.clearStorage();
    useAuthStore.setState({ isSignedIn: false, email: null });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts signed out', () => {
    expect(useAuthStore.getState().isSignedIn).toBe(false);
    expect(useAuthStore.getState().email).toBeNull();
  });

  it('signs in only after the mock latency resolves', async () => {
    const promise = useAuthStore.getState().signIn('ada@lovelace.dev');
    expect(useAuthStore.getState().isSignedIn).toBe(false);

    await jest.runAllTimersAsync();
    await promise;

    expect(useAuthStore.getState().isSignedIn).toBe(true);
    expect(useAuthStore.getState().email).toBe('ada@lovelace.dev');
  });

  it('signs up and remembers the (trimmed) email', async () => {
    const promise = useAuthStore.getState().signUp('  ada@lovelace.dev  ');
    await jest.runAllTimersAsync();
    await promise;

    expect(useAuthStore.getState().isSignedIn).toBe(true);
    expect(useAuthStore.getState().email).toBe('ada@lovelace.dev');
  });

  it('signs out and clears the email', () => {
    useAuthStore.setState({ isSignedIn: true, email: 'ada@lovelace.dev' });
    useAuthStore.getState().signOut();

    expect(useAuthStore.getState().isSignedIn).toBe(false);
    expect(useAuthStore.getState().email).toBeNull();
  });

  it('writes the session to persistent storage', async () => {
    const promise = useAuthStore.getState().signIn('ada@lovelace.dev');
    await jest.runAllTimersAsync();
    await promise;

    const storage = useAuthStore.persist.getOptions().storage;
    const stored = await storage?.getItem('subby.auth');

    expect(stored).toEqual({ state: { isSignedIn: true, email: 'ada@lovelace.dev' }, version: 0 });
  });

  it('clears the persisted session on sign out', async () => {
    useAuthStore.getState().signOut();

    const storage = useAuthStore.persist.getOptions().storage;
    const stored = await storage?.getItem('subby.auth');

    expect(stored).toEqual({ state: { isSignedIn: false, email: null }, version: 0 });
  });
});
