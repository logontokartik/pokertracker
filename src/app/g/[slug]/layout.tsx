import { notFound } from 'next/navigation'
import { getGroupForViewer } from '@/lib/access'
import { BottomNav } from '@/components/nav/BottomNav'

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ctx = await getGroupForViewer(slug)
  if (!ctx) notFound()
  return (
    <>
      {children}
      {ctx.isAdmin && <BottomNav slug={ctx.group.slug} />}
    </>
  )
}
