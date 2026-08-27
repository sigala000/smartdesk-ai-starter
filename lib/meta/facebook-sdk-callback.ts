export function createFacebookSdkCallback<T>(
  handler: (value: T) => Promise<void>,
  onError: (error: unknown) => void,
): (value: T) => void {
  return function facebookSdkCallback(value: T): void {
    void handler(value).catch(onError);
  };
}
