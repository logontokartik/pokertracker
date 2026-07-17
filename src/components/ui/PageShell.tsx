export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-5">
      {children}
    </main>
  )
}
