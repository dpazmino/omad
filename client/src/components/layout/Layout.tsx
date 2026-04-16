import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col max-w-[100vw] overflow-hidden">
        {children}
      </main>
    </div>
  );
}