import type { Metadata, Viewport } from "next";
import AdminApp from "@/components/admin/AdminApp";

export const metadata: Metadata = {
  title: "BASST CUT · Admin",
  manifest: "/admin/manifest.json",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "BASST Admin", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#141110", viewportFit: "cover" };

export default function AdminPage() {
  return <AdminApp />;
}
