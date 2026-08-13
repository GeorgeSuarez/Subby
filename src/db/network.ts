/**
 * Connectivity wrapper around expo-network.
 *
 * Kept in its own module so Jest tests can mock it without importing the
 * native module. `isInternetReachable` is nullable on some platforms (iOS) —
 * callers treat `null` as "unknown → attempt the request and fall back on
 * failure".
 */

import * as Network from 'expo-network';

export type NetworkReachability = boolean | null;

/** Is the device currently on a network with (believed) internet? */
export async function getNetworkReachability(): Promise<NetworkReachability> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (!state.isConnected) return false;
    return state.isInternetReachable ?? null;
  } catch {
    return null;
  }
}

/** Subscribe to connectivity changes. Returns an unsubscribe function. */
export function subscribeToNetwork(
  listener: (reachable: NetworkReachability) => void,
): () => void {
  const sub = Network.addNetworkStateListener((state) => {
    if (state.isConnected === false) {
      listener(false);
    } else {
      listener(state.isInternetReachable ?? null);
    }
  });
  return () => sub.remove();
}
