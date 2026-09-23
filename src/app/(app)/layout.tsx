import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto max-w-xl pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
