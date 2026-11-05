import Link from "next/link";
import { SetupWizard } from "@/components/setup-wizard";
import { SiteHeader } from "@/components/site-header";

export default function SetupPage() {
  return (
    <main className="min-h-screen pb-20">
      <SiteHeader
        right={
          <Link href="/edition" className="btn-ghost">
            Skip to edition
          </Link>
        }
      />
      <div className="px-5 pt-12 sm:px-8">
        <SetupWizard />
      </div>
    </main>
  );
}
