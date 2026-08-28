export function createFacebookSdkCallback<T>(
  handler: (value: T) => Promise<void>,
  onError: (error: unknown) => void,
): (value: T) => void {
  return function facebookSdkCallback(value: T): void {
    void handler(value).catch(onError);
  };
}

export type MetaEmbeddedSignupAssets = Readonly<{
  wabaId: string;
  phoneNumberId: string;
}>;

export function createMetaAssetCollector() {
  let current: Partial<MetaEmbeddedSignupAssets> = {};
  let resolvePending: ((assets: MetaEmbeddedSignupAssets) => void) | undefined;

  function completeAssets(): MetaEmbeddedSignupAssets | undefined {
    return current.wabaId && current.phoneNumberId
      ? { wabaId: current.wabaId, phoneNumberId: current.phoneNumberId }
      : undefined;
  }

  return {
    record(next: Partial<MetaEmbeddedSignupAssets>) {
      current = { ...current, ...next };
      const complete = completeAssets();
      if (complete) {
        resolvePending?.(complete);
        resolvePending = undefined;
      }
    },
    wait(timeoutMs = 5_000): Promise<MetaEmbeddedSignupAssets | undefined> {
      const complete = completeAssets();
      if (complete) return Promise.resolve(complete);
      return new Promise((resolve) => {
        const timeout = globalThis.setTimeout(() => {
          resolvePending = undefined;
          resolve(undefined);
        }, timeoutMs);
        resolvePending = (assets) => {
          globalThis.clearTimeout(timeout);
          resolve(assets);
        };
      });
    },
  };
}
