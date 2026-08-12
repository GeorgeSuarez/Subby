import { useAuthStore } from '@/store/useAuthStore';

jest.mock('@/lib/supabase', () => {
  const authListeners = new Set<(event: string, session: unknown) => void>();
  const auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: jest.fn((callback: (event: string, session: unknown) => void) => {
      authListeners.add(callback);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
    }),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    resend: jest.fn().mockResolvedValue({ error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
  };
  return {
    isSupabaseConfigured: true,
    supabase: { auth },
    __emitAuth: (event: string, session: unknown) => {
      for (const cb of [...authListeners]) cb(event, session);
    },
  };
});

const fakeSession = (email = 'ada@lovelace.dev') => ({
  user: { email },
  access_token: 'token',
  refresh_token: 'refresh',
});

const mockAuth = () => jest.requireMock('@/lib/supabase').supabase.auth as {
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
  signInWithPassword: jest.Mock;
  signUp: jest.Mock;
  resend: jest.Mock;
  signOut: jest.Mock;
};

const emitAuth = (event: string, session: unknown) =>
  (jest.requireMock('@/lib/supabase') as { __emitAuth: (e: string, s: unknown) => void }).__emitAuth(event, session);

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      isSignedIn: false,
      email: null,
      isLoading: true,
      error: null,
      verificationEmail: null,
      hasInitialized: false,
    });
  });

  it('starts signed out and loading until initialize settles', async () => {
    expect(useAuthStore.getState().isSignedIn).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(true);

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isSignedIn).toBe(false);
  });

  it('restores a persisted session on initialize', async () => {
    mockAuth().getSession.mockResolvedValueOnce({ data: { session: fakeSession() } });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isSignedIn).toBe(true);
    expect(useAuthStore.getState().email).toBe('ada@lovelace.dev');
  });

  it('is idempotent — initialize only restores once', async () => {
    await useAuthStore.getState().initialize();
    await useAuthStore.getState().initialize();
    expect(mockAuth().getSession).toHaveBeenCalledTimes(1);
  });

  it('signs in with email + password and mirrors the session', async () => {
    mockAuth().signInWithPassword.mockResolvedValueOnce({
      data: { session: fakeSession('ada@lovelace.dev') },
      error: null,
    });

    await useAuthStore.getState().signIn('ada@lovelace.dev', 'secret');

    expect(mockAuth().signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@lovelace.dev',
      password: 'secret',
    });
    expect(useAuthStore.getState().isSignedIn).toBe(true);
    expect(useAuthStore.getState().email).toBe('ada@lovelace.dev');
  });

  it('records the error and rethrows on failed sign-in', async () => {
    mockAuth().signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(useAuthStore.getState().signIn('ada@lovelace.dev', 'wrong')).rejects.toThrow(
      'Invalid login credentials',
    );
    expect(useAuthStore.getState().error).toBe('Invalid login credentials');
    expect(useAuthStore.getState().isSignedIn).toBe(false);
  });

  it('sends a session-less sign-up to email verification', async () => {
    mockAuth().signUp.mockResolvedValueOnce({
      data: { session: null, user: { email: 'ada@lovelace.dev' } },
      error: null,
    });

    await useAuthStore.getState().signUp('ada@lovelace.dev', 'sup3r-secret');

    expect(useAuthStore.getState().isSignedIn).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
    expect(useAuthStore.getState().verificationEmail).toBe('ada@lovelace.dev');
  });

  it('resends the verification email to the pending address', async () => {
    useAuthStore.setState({ verificationEmail: 'ada@lovelace.dev' });
    await useAuthStore.getState().resendVerificationEmail();
    expect(mockAuth().resend).toHaveBeenCalledWith({ type: 'signup', email: 'ada@lovelace.dev' });
  });

  it('checkVerification reports confirmed once a session exists', async () => {
    expect(await useAuthStore.getState().checkVerification()).toBe(false);

    mockAuth().getSession.mockResolvedValueOnce({ data: { session: fakeSession() } });
    expect(await useAuthStore.getState().checkVerification()).toBe(true);
    expect(useAuthStore.getState().isSignedIn).toBe(true);
    expect(useAuthStore.getState().verificationEmail).toBeNull();
  });

  it('signs out and clears the session', async () => {
    useAuthStore.setState({ isSignedIn: true, email: 'ada@lovelace.dev' });

    await useAuthStore.getState().signOut();

    expect(mockAuth().signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().isSignedIn).toBe(false);
    expect(useAuthStore.getState().email).toBeNull();
  });

  it('reacts to auth state change events after initialize', async () => {
    await useAuthStore.getState().initialize();

    emitAuth('SIGNED_IN', fakeSession('ada@lovelace.dev'));
    expect(useAuthStore.getState().isSignedIn).toBe(true);

    emitAuth('SIGNED_OUT', null);
    expect(useAuthStore.getState().isSignedIn).toBe(false);
    expect(useAuthStore.getState().email).toBeNull();
  });
});
