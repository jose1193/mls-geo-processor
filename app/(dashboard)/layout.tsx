import { Navigation } from "@/components/Navigation";

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Navigation />
      {children}
    </div>
  );
}
