import { supabaseUrlForPlatform } from '@/lib/supabase-env';

describe('supabaseUrlForPlatform', () => {
  it('maps host loopback to the Android emulator host', () => {
    expect(supabaseUrlForPlatform('http://127.0.0.1:54321', 'android')).toBe(
      'http://10.0.2.2:54321',
    );
  });

  it('uses an explicit device host for physical Android development', () => {
    expect(
      supabaseUrlForPlatform(
        'http://localhost:54321/rest/v1',
        'android',
        '192.168.1.42',
      ),
    ).toBe('http://192.168.1.42:54321/rest/v1');
  });

  it('preserves loopback for iOS', () => {
    expect(supabaseUrlForPlatform('http://127.0.0.1:54321', 'ios')).toBe(
      'http://127.0.0.1:54321',
    );
  });

  it('does not rewrite hosted Supabase URLs', () => {
    const hosted = 'https://example.supabase.co';
    expect(supabaseUrlForPlatform(hosted, 'android')).toBe(hosted);
  });
});
