/** Prisma unique-constraint violation (P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Error && 'code' in e && e.code === 'P2002'
}
