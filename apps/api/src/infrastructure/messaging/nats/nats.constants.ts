/** Subjects that use JetStream for persistence and per-market ordering */
export const JETSTREAM_SUBJECT_PREFIXES = [
  'orders.commands.',
  'orders.events.',
  'trades.events.',
] as const;

export function shouldUseJetStream(subject: string): boolean {
  return JETSTREAM_SUBJECT_PREFIXES.some((p) => subject.startsWith(p));
}
