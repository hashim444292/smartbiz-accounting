import net from 'net';

let isDbOnlineCache: boolean | null = null;
let lastCheckTime = 0;

/**
 * Rapidly checks if the PostgreSQL database port (5432) is active and accepting connections.
 * Resolves in ~2-3ms instead of waiting for Prisma's 4,000ms TCP connection timeout.
 * Caches the result for 15 seconds to avoid repeated socket creation.
 */
export async function isDatabaseOnline(): Promise<boolean> {
  const now = Date.now();
  if (isDbOnlineCache !== null && now - lastCheckTime < 15000) {
    return isDbOnlineCache;
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(250);

    const onFinish = (status: boolean) => {
      isDbOnlineCache = status;
      lastCheckTime = Date.now();
      socket.destroy();
      resolve(status);
    };

    socket.once('connect', () => onFinish(true));
    socket.once('timeout', () => onFinish(false));
    socket.once('error', () => onFinish(false));

    try {
      socket.connect(5432, '127.0.0.1');
    } catch {
      onFinish(false);
    }
  });
}
