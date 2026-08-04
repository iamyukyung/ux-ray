import { ReviewInputTabs } from "@/components/landing/ReviewInputTabs";

export function Hero() {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3 py-1 text-xs font-medium text-ink-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          AI 기반 UX 진단
        </span>
        <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-[2.75rem]">
          웹사이트의 UX 문제를 3분 안에 찾아보세요.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
          URL을 입력하거나 화면 이미지를 업로드하면 UX-Ray가 데스크톱·모바일 관점에서
          우선순위가 매겨진 진단 리포트를 만들어드립니다. 회원가입 없이 바로 확인할 수
          있어요.
        </p>
        <div className="mt-8">
          <ReviewInputTabs />
        </div>
      </div>
    </section>
  );
}
