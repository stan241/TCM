import { Sidebar } from '@/components/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen overflow-auto">{children}</main>
    </div>
  )
}
