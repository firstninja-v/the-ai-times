import Link from "next/link";
import { SetupWizard } from "@/components/setup-wizard";

export default function SetupPage() {
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <div className="mx-auto mb-12 flex max-w-2xl items-center justify-between">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          The AI Times
        </Link>
        <span className="font-ui text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Free setup
        </span>
      </div>
      <SetupWizard />
    </main>
  );
}
