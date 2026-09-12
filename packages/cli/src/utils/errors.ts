/**
 * Message from a thrown value of unknown shape.
 *
 * `catch` binds `unknown` under `strict`, and not every throw is an `Error` —
 * a rejected promise or a plugin hook can carry anything. Every site that
 * reports a caught failure used to inline the same `instanceof` check, which
 * left an untestable branch in each file; one helper keeps the fallback
 * consistent and testable in a single place.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}
