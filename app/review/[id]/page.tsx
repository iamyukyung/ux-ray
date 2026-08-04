import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ReviewClient } from "./ReviewClient";

export default function ReviewPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<div className="py-24" aria-hidden="true" />}>
          <ReviewClient reportId={params.id} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
