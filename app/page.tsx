import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { EvaluationAreas } from "@/components/landing/EvaluationAreas";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <EvaluationAreas />
      </main>
      <SiteFooter />
    </div>
  );
}
