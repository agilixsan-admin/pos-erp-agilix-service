import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = (error as unknown as { driverError?: { code?: string } })
    .driverError;
  const code =
    (error as unknown as { code?: string }).code ?? driverError?.code;
  return code === POSTGRES_UNIQUE_VIOLATION;
}

// Retries `fn` when it fails on a Postgres unique-constraint violation —
// e.g. a randomly generated reference number (order/transaction number)
// colliding with one from a concurrent request. Any other error is rethrown
// immediately without retrying.
export async function retryOnUniqueViolation<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts || !isUniqueViolation(error)) {
        throw error;
      }
    }
  }
  // Unreachable: the loop always returns or throws.
  throw new Error('retryOnUniqueViolation: exhausted attempts');
}
