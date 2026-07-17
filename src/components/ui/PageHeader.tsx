export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-neutral-50">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-neutral-400">{subtitle}</div>}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-3 text-sm text-neutral-400">{action}</div>
      )}
    </div>
  )
}
