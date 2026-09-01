export interface RefreshCoordinator {
  request(): void;
  dispose(): void;
}

interface RefreshCoordinatorOptions<T> {
  load(): Promise<T>;
  onSuccess(value: T): void;
  onError(error: unknown): void;
}

/**
 * Serialize refreshes and collapse any notifications received during a load
 * into one trailing refresh. Disposed coordinators never publish state.
 */
export function createRefreshCoordinator<T>({
  load,
  onSuccess,
  onError,
}: RefreshCoordinatorOptions<T>): RefreshCoordinator {
  let disposed = false;
  let running = false;
  let pending = false;

  async function run(): Promise<void> {
    running = true;
    do {
      pending = false;
      try {
        const value = await load();
        if (!disposed) onSuccess(value);
      } catch (error) {
        if (!disposed) onError(error);
      }
    } while (!disposed && pending);
    running = false;
  }

  return {
    request() {
      if (disposed) return;
      if (running) {
        pending = true;
        return;
      }
      void run();
    },
    dispose() {
      disposed = true;
      pending = false;
    },
  };
}
