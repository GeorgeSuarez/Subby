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
    resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    verifyOtp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    setSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    updateUser: jest.fn().mockResolvedValue({
      data: { user: { email: 'ada@lovelace.dev' } },
      error: null,
    }),
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
  user: { id: 'user-ada', email },
  access_token: 'token',
  refresh_token: 'refresh',
});

/** Build a signed-looking JWT with a given `sub` (for deep-link tests). */
const fakeJwt = (sub: string) => {
  const b64 = (s: string) => Buffer.from(s).toString('base64url');
  return `${b64(JSON.stringify({ alg: 'none' }))}.${b64(JSON.stringify({ sub }))}.sig`;
};

const mockAuth = () => jest.requireMock('@/lib/supabase').supabase.auth as {
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
  signInWithPassword: jest.Mock;
  signUp: jest.Mock;
  resend: jest.Mock;
  resetPasswordForEmail: jest.Mock;
  verifyOtp: jest.Mock;
  setSession: jest.Mock;
  updateUser: jest.Mock;
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
      recoveryPending: false,
      recoveryEmail: null,
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

  it('requests a password reset with the deep-link redirect', async () => {
    await useAuthStore.getState().requestPasswordReset('ada@lovelace.dev', 'exp://x/--/reset-password');

    expect(mockAuth().resetPasswordForEmail).toHaveBeenCalledWith('ada@lovelace.dev', {
      redirectTo: 'exp://x/--/reset-password',
    });
    expect(useAuthStore.getState().recoveryEmail).toBe('ada@lovelace.dev');
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('records and rethrows reset request failures', async () => {
    mockAuth().resetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'Rate limit exceeded' },
    });

    await expect(
      useAuthStore.getState().requestPasswordReset('ada@lovelace.dev', 'exp://x'),
    ).rejects.toThrow('Rate limit exceeded');
    expect(useAuthStore.getState().error).toBe('Rate limit exceeded');
  });

  it('verifies a pasted recovery link and flags the recovery session', async () => {
    mockAuth().verifyOtp.mockResolvedValueOnce({
      data: { session: fakeSession('ada@lovelace.dev') },
      error: null,
    });

    await useAuthStore
      .getState()
      .verifyRecoveryLink('http://localhost:54321/auth/v1/verify?token=abc123&type=recovery');

    expect(mockAuth().verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'recovery' });
    expect(useAuthStore.getState().isSignedIn).toBe(true);
    expect(useAuthStore.getState().email).toBe('ada@lovelace.dev');
    expect(useAuthStore.getState().recoveryPending).toBe(true);
  });

  it('verifies a 6-digit recovery code from the email', async () => {
    mockAuth().verifyOtp.mockResolvedValueOnce({
      data: { session: fakeSession('ada@lovelace.dev') },
      error: null,
    });

    await useAuthStore.getState().verifyRecoveryCode('ada@lovelace.dev', '483920');

    expect(mockAuth().verifyOtp).toHaveBeenCalledWith({
      email: 'ada@lovelace.dev',
      token: '483920',
      type: 'recovery',
    });
    expect(useAuthStore.getState().isSignedIn).toBe(true);
    expect(useAuthStore.getState().recoveryEmail).toBe('ada@lovelace.dev');
    expect(useAuthStore.getState().recoveryPending).toBe(true);
  });

  it('surfaces a bad recovery code error', async () => {
    mockAuth().verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Email link is invalid or has expired' },
    });

    await expect(
      useAuthStore.getState().verifyRecoveryCode('ada@lovelace.dev', '000000'),
    ).rejects.toThrow('Email link is invalid or has expired');
    expect(useAuthStore.getState().recoveryPending).toBe(false);
  });

  it('rejects a malformed recovery link without calling verifyOtp', async () => {
    await expect(useAuthStore.getState().verifyRecoveryLink('https://example.com/nope')).rejects.toThrow(
      'does not look like a password reset link',
    );
    expect(mockAuth().verifyOtp).not.toHaveBeenCalled();
  });

  it('updates the password and clears the recovery flag', async () => {
    useAuthStore.setState({ isSignedIn: true, email: 'ada@lovelace.dev', recoveryPending: true });

    await useAuthStore.getState().updatePassword('new-password-123');

    expect(mockAuth().updateUser).toHaveBeenCalledWith({ password: 'new-password-123' });
    expect(useAuthStore.getState().recoveryPending).toBe(false);
    expect(useAuthStore.getState().isSignedIn).toBe(true);
  });

  it('clears the recovery flag on sign out', async () => {
    useAuthStore.setState({ isSignedIn: true, recoveryPending: true });

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().recoveryPending).toBe(false);
  });

  it('sets recoveryPending on the PASSWORD_RECOVERY event', async () => {
    await useAuthStore.getState().initialize();

    emitAuth('PASSWORD_RECOVERY', fakeSession('ada@lovelace.dev'));

    expect(useAuthStore.getState().recoveryPending).toBe(true);
    expect(useAuthStore.getState().isSignedIn).toBe(true);
  });

  it('sets the session from a recovery deep link', async () => {
    mockAuth().setSession.mockResolvedValueOnce({
      data: { session: fakeSession('ada@lovelace.dev') },
      error: null,
    });

    const handled = await useAuthStore.getState().handleAuthUrl(
      'exp://127.0.0.1:8081/--/reset-password#access_token=at&refresh_token=rt&type=recovery',
    );

    expect(handled).toBe(true);
    expect(mockAuth().setSession).toHaveBeenCalledWith({
      access_token: 'at',
      refresh_token: 'rt',
    });
    expect(useAuthStore.getState().recoveryPending).toBe(true);
  });

  it('does not setSession when a session for the same user already exists', async () => {
    useAuthStore.setState({ isSignedIn: true, email: 'ada@lovelace.dev' });
    mockAuth().getSession.mockResolvedValueOnce({
      data: { session: fakeSession('ada@lovelace.dev') },
    });

    const handled = await useAuthStore.getState().handleAuthUrl(
      'exp://127.0.0.1:8081/--/reset-password#access_token=' +
        fakeJwt('user-ada') +
        '&refresh_token=rt&type=recovery',
    );

    expect(handled).toBe(true);
    expect(mockAuth().setSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().recoveryPending).toBe(true);
  });

  it('ignores a recovery link for a different account while signed in', async () => {
    useAuthStore.setState({ isSignedIn: true, email: 'ada@lovelace.dev' });
    mockAuth().getSession.mockResolvedValueOnce({
      data: { session: fakeSession('ada@lovelace.dev') },
    });

    const handled = await useAuthStore.getState().handleAuthUrl(
      'exp://127.0.0.1:8081/--/reset-password#access_token=' +
        fakeJwt('user-grace') +
        '&refresh_token=rt&type=recovery',
    );

    expect(handled).toBe(false);
    expect(mockAuth().setSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().recoveryPending).toBe(false);
  });

  it('ignores non-recovery deep links', async () => {
    const handled = await useAuthStore
      .getState()
      .handleAuthUrl('subby://reset-password#access_token=at&refresh_token=rt&type=signup');

    expect(handled).toBe(false);
    expect(mockAuth().setSession).not.toHaveBeenCalled();
  });

  it('rejects deep links without a session', async () => {
    const handled = await useAuthStore
      .getState()
      .handleAuthUrl('exp://127.0.0.1:8081/--/reset-password#type=recovery');

    expect(handled).toBe(false);
    expect(mockAuth().setSession).not.toHaveBeenCalled();
  });

  it('verifies the current password for the signed-in user', async () => {
    useAuthStore.setState({ isSignedIn: true, email: 'ada@lovelace.dev' });
    mockAuth().signInWithPassword.mockResolvedValueOnce({
      data: { session: fakeSession('ada@lovelace.dev') },
      error: null,
    });

    await useAuthStore.getState().verifyCurrentPassword('current-pass');

    expect(mockAuth().signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@lovelace.dev',
      password: 'current-pass',
    });
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('rejects a wrong current password', async () => {
    useAuthStore.setState({ isSignedIn: true, email: 'ada@lovelace.dev' });
    mockAuth().signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      useAuthStore.getState().verifyCurrentPassword('wrong-pass'),
    ).rejects.toThrow('Current password is incorrect.');
    expect(useAuthStore.getState().error).toBe('Current password is incorrect.');
  });

  it('requires a signed-in account to verify a password', async () => {
    useAuthStore.setState({ isSignedIn: false, email: null });

    await expect(
      useAuthStore.getState().verifyCurrentPassword('current-pass'),
    ).rejects.toThrow('No signed-in account.');
    expect(mockAuth().signInWithPassword).not.toHaveBeenCalled();
  });
});
