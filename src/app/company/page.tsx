import Link from "next/link";
import { SetupWizard } from "@/components/setup-wizard";
import { SiteHeader } from "@/components/site-header";

export default function CompanyPage() {
  return (
    <main className="min-h-screen pb-20">
      <SiteHeader
        right={
          <Link href="/setup" className="btn-ghost">
            Personal paper
          </Link>
        }
      />
      <div className="px-5 pt-12 sm:px-8">
        <SetupWizard initialKind="company" />
      </div>
    </main>
  );
}
