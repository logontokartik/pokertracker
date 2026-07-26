export function PageShell({
  children,
  // Results pages need room for the full column grid on tablets and in landscape.
  wide = false,
}: {
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full flex-col gap-5 p-5 pb-[calc(5rem+env(safe-area-inset-bottom))] ${
        wide ? 'max-w-md sm:max-w-4xl' : 'max-w-md'
      }`}
    >
      {children}
    </main>
  )
}
