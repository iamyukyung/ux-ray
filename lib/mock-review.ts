import type { ReviewReport } from "./types";

/**
 * MVP 단계에서는 실제 크롤링/분석 파이프라인이 없으므로,
 * 이 파일의 목업 데이터로 결과 페이지 UI를 검증합니다.
 * 데스크톱(1440×900)과 모바일(390×844) 두 환경을 각각 분석했다고 가정한
 * 현실적인 점수·이슈 격차를 담아두었습니다.
 * 실제 연동 시 이 파일을 API 호출로 교체하면 됩니다.
 */
const MOCK_REPORTS: Record<string, ReviewReport> = {
  "demo-1": {
    id: "demo-1",
    status: "ready",
    url: "https://www.brightledger.io/pricing",
    analyzedAt: "2026-08-03T09:12:00+09:00",
    overallScore: 57,
    aiInsight: {
      summary:
        "이 사이트는 정보 전달은 명확하지만\n\n사용자의 행동을 유도하는 흐름이 약합니다.\n\n특히 모바일에서 CTA가 첫 화면 아래로 내려가 전환율에 영향을 줄 가능성이 있습니다.\n\n데스크톱에서는 요금제 비교가 잘 구성되어 있지만, 모바일에서 비교표와 하단 배너가 핵심 행동을 방해하고 있습니다.",
      confidence: 91,
      evidence: [
        {
          label: "Hero CTA 위치",
          description:
            "주요 전환 버튼이 히어로 영역보다 아래 요금제 카드에 배치되어, 첫 화면에서 행동 유도가 약합니다.",
        },
        {
          label: "Mobile Fold",
          description:
            "390px 뷰포트에서 결제 CTA와 비교표 핵심 열이 첫 화면 fold 아래에 위치합니다.",
        },
        {
          label: "Contrast",
          description:
            "기본 CTA와 보조 링크의 색상 대비가 거의 없어 클릭 우선순위를 구분하기 어렵습니다.",
        },
        {
          label: "Navigation",
          description:
            "긴 페이지에 앵커 내비게이션이 없어 원하는 요금제 정보를 다시 찾기 어렵습니다.",
        },
      ],
    },
    overallSummary:
      "요금제 비교 콘텐츠 자체는 명확하지만, 모바일에서 비교표가 깨지고 하단 배너가 CTA를 가리는 문제로 데스크톱과 모바일 경험 격차가 큽니다. 신뢰 요소는 두 환경 모두 양호합니다.",
    differenceSummary:
      "데스크톱(62점)에 비해 모바일(52점)이 10점 낮습니다. 격차의 대부분은 새로 추가된 모바일 사용성 항목(33점)에서 발생했으며, 특히 침습적 오버레이와 터치 상호작용에서 두 환경의 체감 차이가 가장 큽니다.",
    desktop: {
      device: "desktop",
      viewport: "1440×900",
      score: 62,
      summary:
        "요금제 비교표와 신뢰 요소는 안정적으로 표시되지만, 히어로 문구가 기능 나열 중심이라 대상 고객이 불분명하고 CTA 위계가 약합니다.",
      screenshotLabel: "브라이트렛저 요금제 페이지 — 데스크톱 뷰",
      categoryScores: [
        { category: "purpose", score: 58, note: "히어로 문구가 기능 나열 중심이라 대상 고객이 불분명합니다." },
        { category: "structure", score: 71, note: "섹션 순서는 논리적이지만 앵커 내비게이션이 없습니다." },
        { category: "cta", score: 46, note: "주요 버튼과 보조 버튼의 시각적 위계가 거의 동일합니다." },
        { category: "readability", score: 68, note: "본문 대비는 양호하나 문장이 평균보다 깁니다." },
        { category: "trust", score: 74, note: "고객 로고와 보안 인증 배지가 적절히 배치되어 있습니다." },
        { category: "accessibility", score: 52, note: "포커스 표시가 일부 커스텀 버튼에서 제거되어 있습니다." },
      ],
    },
    mobile: {
      device: "mobile",
      viewport: "390×844",
      score: 52,
      summary:
        "요금제 비교표가 화면 밖으로 잘리고, 하단 고정 프로모션 배너가 결제 CTA를 가려 전환 경로가 끊깁니다. 폼 필드 간격도 좁아 오탭이 잦습니다.",
      screenshotLabel: "브라이트렛저 요금제 페이지 — 모바일 뷰",
      categoryScores: [
        { category: "purpose", score: 68, note: "히어로 문구는 동일하지만 화면이 작아 대상 불명확성이 더 두드러집니다." },
        { category: "structure", score: 55, note: "섹션이 길어지며 원하는 정보를 다시 찾기 어렵습니다." },
        { category: "cta", score: 38, note: "결제 CTA가 하단 고정 배너에 가려 탭하기 어렵습니다." },
        { category: "readability", score: 58, note: "줄 간격이 좁아 긴 문장을 읽기 부담스럽습니다." },
        { category: "trust", score: 66, note: "보안 배지는 노출되지만 고객 로고 슬라이더가 잘려 보입니다." },
        { category: "accessibility", score: 46, note: "터치 영역이 44px 미만인 버튼이 다수 있습니다." },
        { category: "mobileUsability", score: 33, note: "반응형 레이아웃과 오버레이 처리에서 감점이 집중되었습니다." },
      ],
    },
    issues: [
      {
        id: "demo-1-issue-1",
        title: "히어로 영역에서 타깃 고객을 특정할 수 없음",
        device: "both",
        location: "홈 상단 히어로 섹션",
        severity: "high",
        category: "purpose",
        evidence:
          "헤드라인이 '가장 빠른 원장 관리 솔루션'으로 되어 있어, 1인 사업자용인지 대기업 재무팀용인지 첫 화면만으로는 구분되지 않습니다.",
        userImpact:
          "자신에게 맞는 제품인지 확신하지 못한 방문자는 스크롤을 멈추고 이탈할 가능성이 높습니다.",
        recommendation:
          "헤드라인에 구체적인 대상과 상황을 명시하고, 서브헤드라인에서 대표 사용 사례 1개를 제시하세요.",
        copySuggestion: "10인 이하 스타트업을 위한 원장 자동화 — 마감을 3일에서 3시간으로",
        confidence: 88,
        generatedFix: {
          goal:
            "히어로 영역에서 5초 안에 '누구를 위한 제품인지'가 드러나도록 헤드라인·서브헤드라인 위계를 재구성합니다.\n\n기능 나열 중심 문구를 대상·상황 중심으로 바꿔, 첫 화면 이탈을 줄이는 것이 목표입니다.",
          layoutSuggestions: [
            "헤드라인 아래에 1줄 서브헤드라인 슬롯을 추가하고, 대표 페르소나(예: 10인 이하 스타트업)를 명시합니다.",
            "기능 목록은 히어로 바로 아래가 아닌, 스크롤 후 '어떻게 도와주나요' 섹션으로 이동합니다.",
            "데스크톱·모바일 모두 첫 fold 안에 대상 고객 + 핵심 가치 + CTA 1개가 보이도록 여백을 조정합니다.",
          ],
          copySuggestion: "10인 이하 스타트업을 위한 원장 자동화 — 마감을 3일에서 3시간으로",
          figmaPrompt: `Redesign the hero section at the top of the pricing page.

Problem:
Headline reads "가장 빠른 원장 관리 솔루션" — visitors cannot tell if this is for solo founders or enterprise finance teams within 5 seconds.

Layout changes:
1. Replace headline with persona-specific value prop
2. Add subheadline with one concrete use case
3. Move feature bullet list below the fold
4. Keep single primary CTA above the fold on mobile (390×844)

Copy direction:
"10인 이하 스타트업을 위한 원장 자동화 — 마감을 3일에서 3시간으로"

Annotate typography scale, line-height, and CTA placement for desktop 1440×900 and mobile 390×844.`,
          cursorPrompt: `Update the hero section component on the pricing page.

Issue: Headline is feature-focused ("가장 빠른 원장 관리 솔루션") and doesn't specify target customer.

Changes:
- Replace h1 with persona-specific headline
- Add subheadline with one use case example
- Move feature list to a section below hero
- Ensure primary CTA remains visible in first viewport on mobile

Suggested copy:
"10인 이하 스타트업을 위한 원장 자동화 — 마감을 3일에서 3시간으로"

Files likely affected: Hero.tsx, pricing page layout
Test: 390px and 1440px viewports`,
          experiment: {
            hypothesis:
              "대상 고객을 명시한 히어로 카피로 교체하면, 첫 화면에서 스크롤 없이 이탈하는 비율이 감소할 것입니다.",
            metrics: ["히어로 구간 이탈률", "첫 CTA 클릭률", "요금제 섹션 도달률"],
            variants: [
              "Control — 현재 기능 나열형 헤드라인",
              "Variant A — 페르소나 + 상황 명시 헤드라인 + 서브헤드라인",
            ],
          },
        },
      },
      {
        id: "demo-1-issue-2",
        title: "기본 CTA와 보조 링크의 대비가 거의 없음",
        device: "both",
        location: "요금제 카드 하단 버튼",
        severity: "critical",
        category: "cta",
        evidence:
          "'무료로 시작하기' 버튼과 '영업팀 문의' 링크가 동일한 회색 톤에 두께만 다르게 적용되어 있습니다.",
        userImpact:
          "전환 목표에 해당하는 행동을 사용자가 즉시 인지하지 못해 클릭률이 낮아질 수 있습니다.",
        recommendation:
          "주요 전환 버튼에는 브랜드 강조색을 단독으로 사용하고, 보조 링크는 텍스트 버튼으로 낮춰 위계를 분리하세요.",
        copySuggestion: "무료로 시작하기",
        confidence: 92,
        generatedFix: {
          goal:
            "요금제 카드 하단에서 주요 전환 버튼('무료로 시작하기')과 보조 행동('영업팀 문의')의 시각적 위계를 명확히 분리합니다.\n\n동일한 회색 톤으로 인해 전환 CTA가 묻히는 문제를 해결해 클릭 우선순위를 즉시 인지하게 합니다.",
          layoutSuggestions: [
            "주요 CTA는 브랜드 accent 색 단독 fill 버튼(full-width on mobile)으로 적용합니다.",
            "보조 링크는 텍스트 버튼 또는 ghost 스타일로 CTA 아래 12px 간격을 두고 배치합니다.",
            "카드당 버튼 영역 높이를 44px 이상 확보하고, hover/focus 상태를 명확히 구분합니다.",
          ],
          copySuggestion: "무료로 시작하기",
          figmaPrompt: `Redesign CTA hierarchy on pricing cards (bottom of each plan card).

Problem:
"무료로 시작하기" button and "영업팀 문의" link use nearly identical gray tones — only font-weight differs.

Design spec:
- Primary: filled button, brand accent (#2851D6), min-height 44px
- Secondary: text link below primary, ink-muted color, underline on hover
- Spacing: 12px gap between primary and secondary
- Apply to all pricing tiers consistently

Create component variants for desktop card row and stacked mobile cards (390px).
Include focus ring specs for keyboard users.`,
          cursorPrompt: `Fix CTA visual hierarchy on pricing card buttons.

Problem:
Primary "무료로 시작하기" and secondary "영업팀 문의" look almost identical (same gray tone).

Implementation:
- Primary button: use accent background, white text, min-h-11
- Secondary: text button with text-ink-muted, placed 12px below primary
- Remove duplicate border styles on secondary
- Add focus-visible ring matching design system

Location: pricing card component, bottom action area
Verify contrast ratio meets WCAG AA for both states`,
          experiment: {
            hypothesis:
              "주요 CTA에 accent fill을 적용하고 보조 링크를 텍스트 버튼으로 낮추면, '무료로 시작하기' 클릭률이 유의미하게 상승할 것입니다.",
            metrics: ["주요 CTA 클릭률", "보조 링크 클릭률", "카드→가입 전환율"],
            variants: [
              "Control — 동일 회색 톤 버튼 2개",
              "Variant A — Accent fill CTA + 텍스트 보조 링크",
            ],
          },
        },
      },
      {
        id: "demo-1-issue-3",
        title: "요금제 비교표가 가로 스크롤 없이 화면 밖으로 잘림",
        device: "mobile",
        location: "요금제 비교표 · 반응형 레이아웃",
        severity: "critical",
        category: "mobileUsability",
        evidence:
          "390px 뷰포트에서 표의 4번째 열이 화면 밖으로 벗어나며, 가로 스크롤 힌트도 제공되지 않습니다.",
        userImpact:
          "모바일 방문자 다수가 상위 요금제 정보를 아예 확인하지 못하고 이탈합니다.",
        recommendation:
          "좁은 화면에서는 표를 세로 카드형 아코디언으로 전환하고, 비교 항목은 토글로 열람하게 하세요.",
        confidence: 95,
        generatedFix: {
          goal:
            "390px 뷰포트에서 요금제 비교표 4번째 열이 화면 밖으로 잘리는 문제를 해결합니다.\n\n모바일에서는 가로 스크롤 없이 모든 요금제 정보에 접근할 수 있도록 카드형 아코디언 레이아웃으로 전환합니다.",
          layoutSuggestions: [
            "768px 미만에서 비교표를 숨기고, 요금제별 세로 카드 + '기능 비교' 아코디언으로 대체합니다.",
            "각 카드 상단에 요금제명·가격·CTA를 배치하고, 비교 항목은 '자세히 보기' 토글로 펼칩니다.",
            "가로 스크롤 힌트 대신 세로 스크롤만 사용해 한 손 조작 시 혼란을 줄입니다.",
          ],
          figmaPrompt: `Redesign mobile pricing comparison (390×844 viewport).

Problem:
4-column comparison table overflows viewport — 4th column is cut off with no horizontal scroll hint.

Mobile layout (replace table):
1. Stack plan cards vertically
2. Each card: plan name, price, primary CTA
3. Accordion "기능 비교" inside each card for feature rows
4. No horizontal scroll required

Desktop (1440×900): keep table layout

Prototype interaction: accordion expand/collapse, preserve selected plan state`,
          cursorPrompt: `Replace mobile pricing comparison table with card + accordion pattern.

Problem at 390px:
Table column 4 overflows off-screen, no scroll hint.

Implementation:
- @media (max-width: 767px): hide <table>, render plan cards
- Each card: PlanName, Price, CTA button
- Accordion component for feature comparison rows
- Ensure no overflow-x on container

Location: pricing comparison section
Test: iPhone 14 viewport (390×844), verify all plans accessible without horizontal scroll`,
          experiment: {
            hypothesis:
              "모바일에서 비교표를 카드+아코디언으로 전환하면, 상위 요금제 정보 열람률과 CTA 클릭률이 증가할 것입니다.",
            metrics: ["상위 요금제 정보 열람률", "비교표 구간 이탈률", "모바일 CTA 클릭률"],
            variants: [
              "Control — 4열 비교표 (현재, 가로 overflow)",
              "Variant A — 세로 카드 + 기능 비교 아코디언",
            ],
          },
        },
      },
      {
        id: "demo-1-issue-4",
        title: "하단 고정 프로모션 배너가 결제 CTA를 가림",
        device: "mobile",
        location: "화면 하단 고정 배너 · 침습적 오버레이",
        severity: "critical",
        category: "mobileUsability",
        evidence:
          "'첫 달 50% 할인' 배너가 화면 하단에 항상 고정되어 있어, 요금제 카드의 '시작하기' 버튼과 약 12px밖에 떨어져 있지 않습니다.",
        userImpact:
          "의도치 않게 배너를 탭하거나, 반대로 실제 CTA를 배너로 오인해 전환을 포기하는 경우가 발생합니다.",
        recommendation:
          "배너에 닫기(X) 버튼을 추가하고, 실제 CTA와 최소 24px 이상의 여백을 확보하세요.",
        confidence: 90,
      },
      {
        id: "demo-1-issue-5",
        title: "햄버거 메뉴 버튼의 터치 영역이 44px 미만",
        device: "mobile",
        location: "상단 내비게이션 · 터치 상호작용",
        severity: "high",
        category: "mobileUsability",
        evidence: "햄버거 아이콘 버튼의 실제 탭 가능 영역이 32×32px로 측정되었습니다.",
        userImpact: "손이 크거나 이동 중인 사용자가 메뉴를 여러 번 잘못 탭하게 됩니다.",
        recommendation: "버튼의 padding을 늘려 최소 44×44px의 탭 영역을 확보하세요.",
        confidence: 84,
      },
      {
        id: "demo-1-issue-6",
        title: "회원가입 폼 입력 필드 간격이 좁아 오탭 유발",
        device: "mobile",
        location: "회원가입 폼 · 폼 사용성",
        severity: "medium",
        category: "mobileUsability",
        evidence: "이메일과 비밀번호 입력 필드 사이 여백이 4px로, 인접 필드를 잘못 탭하기 쉽습니다.",
        userImpact: "입력 도중 실수가 반복되면 가입을 중도 포기할 수 있습니다.",
        recommendation: "필드 간 최소 12px 이상의 여백을 두고, 포커스 시 확대 애니메이션을 추가하세요.",
        confidence: 77,
      },
      {
        id: "demo-1-issue-7",
        title: "커스텀 버튼에서 키보드 포커스 표시가 제거됨",
        device: "desktop",
        location: "전역 버튼 컴포넌트",
        severity: "medium",
        category: "accessibility",
        evidence:
          "CSS에서 outline: none이 전역 버튼 클래스에 적용되어 있고, 대체 포커스 스타일이 정의되어 있지 않습니다.",
        userImpact:
          "키보드로만 탐색하는 사용자가 현재 어떤 요소에 포커스가 있는지 알 수 없어 탐색이 사실상 불가능해집니다.",
        recommendation:
          "outline 제거 대신 box-shadow 또는 outline-offset을 활용한 대체 포커스 스타일을 모든 상호작용 요소에 적용하세요.",
        confidence: 90,
      },
      {
        id: "demo-1-issue-8",
        title: "본문 단락의 평균 문장 길이가 권장 기준을 초과",
        device: "desktop",
        location: "'왜 브라이트렛저인가' 섹션",
        severity: "medium",
        category: "readability",
        evidence:
          "해당 섹션 문장의 평균 길이가 42단어로, 웹 콘텐츠 권장 기준(20단어 내외)의 두 배를 넘습니다.",
        userImpact:
          "빠르게 훑어보는 방문자가 핵심 메시지를 놓치고 다음 섹션으로 넘어갈 가능성이 높습니다.",
        recommendation:
          "문장을 15–20단어 단위로 분리하고, 핵심 주장은 굵게 표시하거나 불릿으로 전환하세요.",
        confidence: 81,
      },
      {
        id: "demo-1-issue-9",
        title: "모바일에서 줄 간격이 좁아 가독성이 떨어짐",
        device: "mobile",
        location: "본문 단락 전반",
        severity: "low",
        category: "readability",
        evidence: "본문 line-height가 1.3으로, 작은 화면 기준 권장치(1.5 이상)보다 낮습니다.",
        userImpact: "긴 설명 문단을 읽을 때 눈의 피로가 커지고 이탈 가능성이 높아집니다.",
        recommendation: "모바일 브레이크포인트에서 line-height를 1.5~1.6으로 상향하세요.",
        confidence: 72,
      },
    ],
    limitations: [
      "로그인 이후 화면 등 인증이 필요한 페이지는 분석 대상에 포함되지 않았습니다.",
      "실제 사용자 행동 데이터(클릭·스크롤 로그) 없이 화면 구조와 콘텐츠만으로 추정한 결과입니다.",
      "데스크톱 1440×900, 모바일 390×844 두 뷰포트 기준으로만 점검되어, 다른 해상도에서는 다른 문제가 있을 수 있습니다.",
    ],
  },
  "demo-2": {
    id: "demo-2",
    status: "ready",
    url: "https://shop.northgrain.co/collections/all",
    analyzedAt: "2026-08-02T21:40:00+09:00",
    overallScore: 74,
    aiInsight: {
      summary:
        "전반적으로 상품 탐색과 신뢰 신호는 잘 갖춰져 있습니다.\n\n다만 모바일에서 구매 직전 정보(가격·필터)가 가려지는 패턴이 반복되어, 데스크톱 대비 전환 경험이 한 단계 떨어집니다.\n\n장바구니 담기 피드백과 접근성(대체 텍스트)을 보완하면 체감 품질을 더 끌어올릴 수 있습니다.",
      confidence: 86,
      evidence: [
        {
          label: "Hero CTA 위치",
          description:
            "상품 카드의 '담기' 버튼은 노출되지만, 담김 확인 피드백이 약해 다음 행동으로 이어지기 어렵습니다.",
        },
        {
          label: "Mobile Fold",
          description:
            "하단 고정 구매 바가 상품 가격 영역을 가려 첫 화면·스크롤 중 모두 가격 확인이 방해됩니다.",
        },
        {
          label: "Contrast",
          description:
            "품절 뱃지와 프로모션 뱃지의 색상 구분이 약해 빠른 스캔 시 상태 파악이 어렵습니다.",
        },
        {
          label: "Navigation",
          description:
            "모바일 카테고리 탭이 가로 스크롤만 가능해 추가 카테고리 존재를 인지하기 어렵습니다.",
        },
      ],
    },
    overallSummary:
      "상품 목록의 필터·정렬·신뢰 신호는 데스크톱과 모바일 모두에서 안정적입니다. 다만 모바일에서는 하단 고정 구매 유도 바가 가격 정보를 가리고, 필터 칩의 터치 영역이 작아 탐색 경험이 다소 떨어집니다.",
    differenceSummary:
      "데스크톱(78점)과 모바일(69점) 모두 합격점이지만 9점 차이가 있습니다. 격차는 주로 모바일 사용성(54점) 항목에서 발생했으며, 특히 침습적 오버레이와 터치 상호작용이 원인입니다.",
    desktop: {
      device: "desktop",
      viewport: "1440×900",
      score: 78,
      summary:
        "카테고리 구성과 필터·정렬 흐름이 직관적이고 리뷰 수·배송 정책 등 신뢰 신호가 상품 카드에서 바로 보입니다. 장바구니 담기 피드백만 다소 약합니다.",
      screenshotLabel: "노스그레인 상품 목록 — 데스크톱 뷰",
      categoryScores: [
        { category: "purpose", score: 84, note: "카테고리 구성만으로 쇼핑몰의 취급 품목이 명확히 전달됩니다." },
        { category: "structure", score: 80, note: "필터 → 정렬 → 목록 순서가 사용자의 탐색 흐름과 일치합니다." },
        { category: "cta", score: 66, note: "장바구니 담기 후 확인 피드백이 즉각적이지 않습니다." },
        { category: "readability", score: 85, note: "가격·할인율 표기가 일관되고 읽기 쉽습니다." },
        { category: "trust", score: 88, note: "리뷰 수와 배송 정책이 상품 카드에서 바로 보입니다." },
        { category: "accessibility", score: 63, note: "일부 상품 썸네일에 대체 텍스트가 누락되어 있습니다." },
      ],
    },
    mobile: {
      device: "mobile",
      viewport: "390×844",
      score: 69,
      summary:
        "상품 탐색 흐름은 데스크톱과 유사하지만, 하단 고정 구매 유도 바가 가격을 가리고 필터 칩이 좁아 탭 실수가 잦습니다. 카테고리 메뉴는 스와이프로만 접근할 수 있어 발견성이 낮습니다.",
      screenshotLabel: "노스그레인 상품 목록 — 모바일 뷰",
      categoryScores: [
        { category: "purpose", score: 80, note: "카테고리 라벨이 축약되어도 의미는 유지됩니다." },
        { category: "structure", score: 70, note: "정렬 변경 시 스크롤이 초기화되어 흐름이 끊깁니다." },
        { category: "cta", score: 58, note: "구매 유도 바가 상품 가격을 가려 판단이 늦어집니다." },
        { category: "readability", score: 78, note: "품절 뱃지 구분이 다소 약하지만 전반적으로 읽기 쉽습니다." },
        { category: "trust", score: 82, note: "리뷰 수 배지는 작은 화면에서도 잘 보입니다." },
        { category: "accessibility", score: 60, note: "대체 텍스트 누락이 모바일에서도 동일하게 발견됩니다." },
        { category: "mobileUsability", score: 54, note: "오버레이와 터치 영역 문제로 점수가 낮습니다." },
      ],
    },
    issues: [
      {
        id: "demo-2-issue-1",
        title: "장바구니 담기 후 상태 변화가 시각적으로 미미함",
        device: "both",
        location: "상품 카드 '담기' 버튼",
        severity: "high",
        category: "cta",
        evidence:
          "버튼 텍스트가 0.3초간 '담김'으로 바뀌었다가 원래 상태로 되돌아갈 뿐, 장바구니 아이콘의 수량 배지 갱신에는 딜레이가 있습니다.",
        userImpact:
          "여러 상품을 연속으로 담는 사용자가 실제로 담겼는지 확신하지 못해 같은 상품을 중복 클릭합니다.",
        recommendation:
          "담기 즉시 장바구니 아이콘 배지를 갱신하고, 짧은 토스트 메시지로 담긴 상품명을 확인시켜주세요.",
        copySuggestion: "장바구니에 담았어요 · 담은 상품 보기",
        confidence: 79,
        generatedFix: {
          goal:
            "상품 카드 '담기' 클릭 직후 사용자가 담김 여부를 확신할 수 있도록 즉각적인 시각·텍스트 피드백을 제공합니다.\n\n장바구니 배지 갱신 딜레이와 미미한 버튼 텍스트 변화로 인한 중복 클릭을 줄입니다.",
          layoutSuggestions: [
            "담기 성공 시 장바구니 아이콘 배지를 0ms 지연으로 +1 갱신합니다.",
            "버튼 아래 또는 화면 하단에 3초간 토스트: '장바구니에 담았어요 · {상품명}'",
            "토스트에 '담은 상품 보기' 텍스트 링크를 포함해 다음 행동을 연결합니다.",
          ],
          copySuggestion: "장바구니에 담았어요 · 담은 상품 보기",
          figmaPrompt: `Design add-to-cart feedback flow for product listing cards.

Problem:
Button text flickers to "담김" for 0.3s then reverts; cart badge updates with delay — users double-click.

Interaction spec:
1. On tap "담기": instant cart badge increment (no delay)
2. Toast slides up from bottom: "장바구니에 담았어요 · {product name}"
3. Toast includes link "담은 상품 보기" → cart drawer
4. Button state: brief checkmark icon (1s) then return to "담기"

Mobile 390×844 and desktop 1440×900 frames.`,
          cursorPrompt: `Improve add-to-cart feedback on product cards.

Problem:
- Button text changes to "담김" for 0.3s only
- Cart badge updates with noticeable delay
- Users double-click unsure if item was added

Implementation:
1. Optimistic cart badge update on click (immediate +1)
2. Toast component: "장바구니에 담았어요 · {productName}" for 3s
3. Toast action link: "담은 상품 보기" → /cart
4. Optional: brief checkmark on button (1s)

Location: ProductCard add-to-cart handler, cart state, Toast provider`,
          experiment: {
            hypothesis:
              "담기 즉시 배지 갱신 + 토스트 피드백을 추가하면, 중복 클릭률이 감소하고 장바구니→결제 전환율이 개선될 것입니다.",
            metrics: ["중복 담기 클릭률", "장바구니 진입률", "카드→장바구니 전환율"],
            variants: [
              "Control — 0.3초 텍스트 변경 + 지연 배지",
              "Variant A — 즉시 배지 + 토스트 + 담은 상품 보기 링크",
            ],
          },
        },
      },
      {
        id: "demo-2-issue-2",
        title: "상품 썸네일 다수에 대체 텍스트가 비어 있음",
        device: "both",
        location: "상품 목록 그리드",
        severity: "high",
        category: "accessibility",
        evidence: "목록에 노출된 상품 24개 중 9개의 이미지 alt 속성이 빈 문자열로 설정되어 있습니다.",
        userImpact: "스크린리더 사용자는 해당 상품이 무엇인지 이미지 정보만으로 전혀 알 수 없습니다.",
        recommendation:
          "상품명과 핵심 특징(색상, 소재 등)을 포함한 대체 텍스트를 모든 상품 이미지에 일괄 적용하세요.",
        confidence: 96,
        generatedFix: {
          goal:
            "상품 목록 그리드의 9개 썸네일(alt=\"\")을 스크린리더 사용자도 이해할 수 있는 설명으로 교체합니다.\n\n상품명 + 핵심 속성(색상, 소재) 패턴을 일괄 적용해 접근성과 SEO를 동시에 개선합니다.",
          layoutSuggestions: [
            "alt 텍스트 패턴: '{상품명}, {색상}, {소재}' — CMS 필드 또는 자동 생성 규칙으로 통일",
            "장식용 배지·아이콘은 aria-hidden 처리, 의미 있는 정보만 alt에 포함",
            "품절·할인 상태는 alt가 아닌 별도 텍스트/aria-label로 전달",
          ],
          figmaPrompt: `Audit and spec alt text for product listing grid images.

Problem:
9 of 24 product thumbnails have empty alt="" — screen reader users get no product info.

Alt text pattern:
"{Product name}, {color}, {material}"
Example: "오트밀 린넨 셔츠, 베이지, 100% 린넨"

Deliverables:
- Annotation layer on product card component
- alt text field mapping from CMS (name, color, material)
- Decorative badges marked aria-hidden
- Before/after accessibility review checklist`,
          cursorPrompt: `Add descriptive alt text to product listing images.

Problem:
9/24 product images have alt="" in the collection grid.

Implementation:
- Template: alt={\`\${product.name}, \${product.color}, \${product.material}\`}
- Fallback if fields missing: alt={product.name}
- Decorative elements (sale badge icon): aria-hidden="true"
- Batch update existing products via CMS script or migration

Location: ProductCard image component, product listing grid
Verify with screen reader (VoiceOver) on mobile and desktop`,
          experiment: {
            hypothesis:
              "상품명+속성 alt 텍스트를 일괄 적용하면, 스크린리더 사용자의 상품 탐색 완료율이 개선되고 이미지 SEO 노출이 증가할 것입니다.",
            metrics: ["접근성 감사 통과율", "이미지 검색 유입", "보조기기 사용자 세션 지속 시간"],
            variants: [
              "Control — alt=\"\" (9개 상품)",
              "Variant A — '{상품명}, {색상}, {소재}' 패턴 일괄 적용",
            ],
          },
        },
      },
      {
        id: "demo-2-issue-3",
        title: "하단 고정 구매 유도 바가 상품 가격을 가림",
        device: "mobile",
        location: "상품 상세 하단 고정 바 · 침습적 오버레이",
        severity: "critical",
        category: "mobileUsability",
        evidence: "'바로 구매' 고정 바의 높이가 88px로, 가격과 할인율이 표시되는 영역을 절반 이상 가립니다.",
        userImpact: "구매 직전 가격을 다시 확인하려는 사용자가 정보를 보지 못해 이탈하거나 오구매할 수 있습니다.",
        recommendation: "고정 바 안에 현재 가격을 함께 표시하거나, 바의 높이를 줄여 가격 영역을 가리지 않게 하세요.",
        confidence: 87,
        generatedFix: {
          goal:
            "상품 상세 하단 88px 고정 '바로 구매' 바가 가격·할인율 영역을 가리는 문제를 해결합니다.\n\n구매 직전 가격 확인이 가능하도록 고정 바 내부에 가격 정보를 통합하거나 바 높이를 축소합니다.",
          layoutSuggestions: [
            "고정 바 좌측에 현재 가격 + 할인율(있을 경우)을 표시하고, 우측에 '바로 구매' CTA를 배치합니다.",
            "바 높이를 64px 이하로 줄이고, 본문 하단 padding-bottom을 bar height + 16px로 확보합니다.",
            "스크롤 시 바 등장 애니메이션은 200ms fade만 사용 — 과한 motion 금지.",
          ],
          figmaPrompt: `Redesign mobile sticky purchase bar on product detail page (390×844).

Problem:
Fixed "바로 구매" bar is 88px tall and covers ~50% of price/discount area.

Option A (preferred):
- Bar height: 64px max
- Left: current price + discount badge
- Right: primary "바로 구매" button (min 44px touch target)
- Content area: padding-bottom = bar height + 16px

Show before/after scroll states. Annotate safe area for iOS home indicator.`,
          cursorPrompt: `Fix sticky purchase bar covering price on mobile product detail.

Problem:
88px fixed bottom bar covers price and discount display area.

Implementation:
- Reduce bar height to 64px
- Include price + discount in bar layout (flex row)
- Add pb-[calc(64px+16px)] to main content wrapper
- CTA min-height 44px, full tap area

Location: ProductDetail sticky bar component
Test: 390×844, verify price visible before and during scroll`,
          experiment: {
            hypothesis:
              "고정 바에 가격을 포함하고 높이를 줄이면, 구매 직전 이탈률이 감소하고 '바로 구매' 클릭률이 상승할 것입니다.",
            metrics: ["상세 페이지 이탈률", "바로 구매 클릭률", "가격 확인 후 구매 전환율"],
            variants: [
              "Control — 88px 바, 가격 영역 가림",
              "Variant A — 64px 바 + 가격 표시 + CTA",
            ],
          },
        },
      },
      {
        id: "demo-2-issue-4",
        title: "필터 칩의 터치 영역이 44px 미만",
        device: "mobile",
        location: "필터 칩 목록 · 터치 상호작용",
        severity: "high",
        category: "mobileUsability",
        evidence: "필터 칩 버튼의 실제 높이가 30px로 측정되어 권장 최소 터치 영역에 미치지 못합니다.",
        userImpact: "인접한 칩을 잘못 선택하는 오탭이 반복되어 원하는 필터 조합을 만들기 어렵습니다.",
        recommendation: "칩의 상하 padding을 늘려 높이 44px 이상을 확보하고, 칩 간 여백도 8px 이상으로 넓히세요.",
        confidence: 83,
      },
      {
        id: "demo-2-issue-5",
        title: "카테고리 메뉴가 스와이프로만 접근 가능해 발견성이 낮음",
        device: "mobile",
        location: "상단 카테고리 내비게이션 · 내비게이션",
        severity: "medium",
        category: "mobileUsability",
        evidence: "카테고리 탭이 가로로 넘치며, 스크롤 가능하다는 시각적 힌트(그림자, 화살표 등)가 없습니다.",
        userImpact: "화면에 보이지 않는 카테고리가 있다는 사실을 모른 채 일부 상품군을 놓치게 됩니다.",
        recommendation: "탭 영역 끝에 그라디언트 페이드나 화살표 아이콘을 추가해 추가 콘텐츠가 있음을 알려주세요.",
        confidence: 75,
      },
      {
        id: "demo-2-issue-6",
        title: "결제 폼 라벨이 placeholder로만 제공되어 입력 중 사라짐",
        device: "mobile",
        location: "배송 정보 입력 폼 · 폼 사용성",
        severity: "medium",
        category: "mobileUsability",
        evidence: "'받는 분 이름', '연락처' 등 라벨이 별도 텍스트 없이 placeholder로만 표시됩니다.",
        userImpact: "입력을 시작하면 어떤 항목인지 다시 확인할 수 없어 특히 긴 배송지 정보 입력 시 혼란을 겪습니다.",
        recommendation: "입력 필드 위에 고정 라벨을 별도로 두고, placeholder는 예시 텍스트로만 사용하세요.",
        confidence: 80,
      },
      {
        id: "demo-2-issue-7",
        title: "정렬 기준 변경 시 스크롤 위치가 초기화됨",
        device: "desktop",
        location: "정렬 드롭다운",
        severity: "medium",
        category: "structure",
        evidence: "정렬 옵션을 변경하면 페이지가 최상단으로 스크롤되며, 이전에 보던 위치로 돌아오지 않습니다.",
        userImpact: "목록을 훑어보던 도중 정렬을 바꾼 사용자가 처음부터 다시 스크롤해야 해 탐색 흐름이 끊깁니다.",
        recommendation: "정렬 변경 시 현재 스크롤 위치를 유지하거나, 최소한 필터 영역 바로 아래로 스크롤을 고정하세요.",
        confidence: 70,
      },
      {
        id: "demo-2-issue-8",
        title: "품절 상품과 판매 중 상품의 구분이 약함",
        device: "desktop",
        location: "상품 카드 뱃지",
        severity: "low",
        category: "readability",
        evidence: "품절 뱃지가 다른 프로모션 뱃지와 동일한 회색 계열로 표시되어 빠르게 훑어볼 때 구분이 어렵습니다.",
        userImpact: "품절 상품을 장바구니에 담으려다 결제 단계에서야 알게 되는 사용자가 생길 수 있습니다.",
        recommendation: "품절 뱃지는 다른 색상 체계를 사용하고, 썸네일 전체를 흐리게 처리해 시각적으로 즉시 구분되게 하세요.",
        confidence: 66,
      },
    ],
    limitations: [
      "결제 단계 이후 흐름은 이번 분석 범위에 포함되지 않았습니다.",
      "재고·가격 데이터는 크롤링 시점 기준이며 실시간으로 변할 수 있습니다.",
      "데스크톱 1440×900, 모바일 390×844 두 뷰포트 기준으로만 점검되어 태블릿 등 다른 기기는 대상이 아닙니다.",
    ],
  },
  "screenshot-demo": {
    id: "screenshot-demo",
    status: "ready",
    inputType: "screenshots",
    url: "업로드한 화면 이미지",
    analyzedAt: "2026-08-03T14:30:00+09:00",
    overallScore: 61,
    aiInsight: {
      summary:
        "업로드하신 화면 흐름을 기준으로 보면\n\n정보 구조는 단계별로 잘 나뉘어 있지만, 화면 간 전환에서 사용자가 다음 행동을 예측하기 어려운 구간이 있습니다.\n\n모바일 화면에서는 입력 필드와 CTA 간격이 좁아 오탭 위험이 있으며, 데스크톱 화면에서는 보조 정보가 주요 행동을 분산시키고 있습니다.\n\n전체 흐름의 목표는 명확하지만, 중간 단계에서 이탈을 유발할 수 있는 마찰 지점이 몇 군데 보입니다.",
      confidence: 84,
      evidence: [
        {
          label: "화면 순서",
          description:
            "업로드된 화면 순서상 핵심 전환 단계가 중후반에 몰려 있어, 초반 화면에서 목표 달성까지의 경로가 길게 느껴집니다.",
        },
        {
          label: "정보 밀도",
          description:
            "데스크톱 화면에서 보조 설명과 링크가 CTA 주변에 밀집해 있어 시선이 분산됩니다.",
        },
        {
          label: "모바일 입력",
          description:
            "모바일 화면의 폼 필드와 버튼 간격이 좁아 터치 오류 가능성이 있습니다.",
        },
        {
          label: "상태 피드백",
          description:
            "단계 진행 중 완료·오류 상태를 알려주는 시각적 피드백이 일부 화면에서 누락되어 있습니다.",
        },
      ],
    },
    overallSummary:
      "업로드하신 화면 흐름 기준으로 정보 구조는 비교적 명확하지만, 단계 간 전환과 CTA 위계에서 개선 여지가 있습니다. 모바일 화면에서 입력·터치 관련 마찰이 더 두드러집니다.",
    differenceSummary:
      "데스크톱(65점)에 비해 모바일(57점)이 8점 낮습니다. 격차는 주로 모바일 사용성과 CTA 노출성에서 발생했으며, 업로드된 모바일 화면에서 폼·터치 영역 관련 이슈가 더 많이 관찰됩니다.",
    desktop: {
      device: "desktop",
      viewport: "1440×900",
      score: 65,
      summary:
        "데스크톱 화면은 정보 위계가 비교적 분명하지만, 보조 콘텐츠가 주요 CTA를 분산시키고 단계 간 안내 문구가 일관되지 않습니다.",
      screenshotLabel: "업로드한 데스크톱 화면",
      categoryScores: [
        { category: "purpose", score: 68, note: "화면별 목적은 파악되지만 전체 흐름의 최종 목표가 초반에 충분히 강조되지 않습니다." },
        { category: "structure", score: 72, note: "단계별 화면 구분은 명확하나 중간 단계에서 정보 우선순위가 흐려집니다." },
        { category: "cta", score: 54, note: "주요·보조 버튼의 시각적 위계가 약합니다." },
        { category: "readability", score: 70, note: "본문 가독성은 양호하나 라벨·힌트 텍스트 길이가 다소 깁니다." },
        { category: "trust", score: 62, note: "보안·정책 관련 안내가 일부 화면에서만 노출됩니다." },
        { category: "accessibility", score: 58, note: "이미지 기반 분석으로 코드 수준 접근성은 확인되지 않았습니다." },
      ],
    },
    mobile: {
      device: "mobile",
      viewport: "390×844",
      score: 57,
      summary:
        "모바일 화면은 세로 스크롤 흐름은 자연스럽지만, 입력 필드와 CTA 간격이 좁고 하단 고정 요소가 행동을 방해할 수 있습니다.",
      screenshotLabel: "업로드한 모바일 화면",
      categoryScores: [
        { category: "purpose", score: 64, note: "화면별 목적은 전달되나 작은 화면에서 핵심 메시지가 압축되어 보입니다." },
        { category: "structure", score: 60, note: "단계가 많을수록 진행 상태 파악이 어려워집니다." },
        { category: "cta", score: 48, note: "하단 CTA가 다른 UI 요소와 겹치거나 시선 경쟁을 합니다." },
        { category: "readability", score: 62, note: "본문 크기는 적절하나 입력 라벨 대비가 약한 구간이 있습니다." },
        { category: "trust", score: 58, note: "개인정보 관련 안내가 뒤 단계에만 나타납니다." },
        { category: "accessibility", score: 50, note: "터치 영역 크기는 이미지로만 추정 가능하며 코드 검증은 필요합니다." },
        { category: "mobileUsability", score: 45, note: "폼 필드 간격과 터치 타겟에서 개선이 필요합니다." },
      ],
    },
    issues: [
      {
        id: "screenshot-issue-1",
        title: "단계 진행 상태가 화면마다 일관되지 않음",
        device: "both",
        location: "단계 표시 영역",
        severity: "high",
        category: "structure",
        evidence:
          "업로드된 화면 중 일부는 진행 단계 표시가 있고, 일부는 없어 사용자가 현재 위치를 파악하기 어렵습니다.",
        userImpact: "중간 단계에서 이탈하거나 동일 정보를 반복 입력할 가능성이 있습니다.",
        recommendation:
          "모든 화면 상단에 동일한 진행 표시 컴포넌트를 배치하고, 완료·현재·남은 단계를 시각적으로 구분하세요.",
        confidence: 86,
      },
      {
        id: "screenshot-issue-2",
        title: "모바일 CTA와 입력 필드 간격이 좁음",
        device: "mobile",
        location: "하단 CTA 영역",
        severity: "high",
        category: "mobileUsability",
        evidence:
          "모바일 화면에서 주요 버튼이 마지막 입력 필드와 8px 이하로 붙어 있어 오탭 위험이 보입니다.",
        userImpact: "의도치 않은 제출이나 입력 오류로 인한 재시도가 발생할 수 있습니다.",
        recommendation:
          "CTA 상단에 최소 16px 이상 여백을 두고, 버튼 높이를 44px 이상으로 확보하세요.",
        confidence: 82,
      },
      {
        id: "screenshot-issue-3",
        title: "데스크톱 화면의 보조 링크가 CTA를 분산시킴",
        device: "desktop",
        location: "CTA 주변",
        severity: "medium",
        category: "cta",
        evidence:
          "주요 전환 버튼 주변에 3개 이상의 보조 링크가 같은 시각적 무게로 배치되어 있습니다.",
        userImpact: "사용자가 다음 행동을 선택하는 데 시간이 더 걸리거나, 핵심 전환율이 낮아질 수 있습니다.",
        recommendation:
          "보조 링크는 텍스트 링크 스타일로 위계를 낮추고, Primary CTA를 시각적으로 강조하세요.",
        confidence: 78,
      },
      {
        id: "screenshot-issue-4",
        title: "오류·완료 상태 피드백 부재",
        device: "both",
        location: "폼 제출 후 화면",
        severity: "medium",
        category: "purpose",
        evidence:
          "업로드된 흐름에서 성공·실패 상태를 명확히 보여주는 화면이 누락되어 있습니다.",
        userImpact: "사용자가 작업 완료 여부를 확신하지 못하고 불안감을 느낄 수 있습니다.",
        recommendation:
          "성공·실패·로딩 상태 각각에 대한 전용 화면 또는 인라인 피드백을 추가하세요.",
        confidence: 74,
      },
    ],
    limitations: [
      "이미지 기반 분석은 화면에 보이는 정보와 흐름을 중심으로 진행됩니다. 실제 인터랙션, 접근성 코드 및 성능은 별도 확인이 필요합니다.",
      "업로드된 이미지에 포함되지 않은 화면·상태는 분석 범위에 포함되지 않았습니다.",
      "점수, AI Insight, Issue, Generate Fix는 Mock 리포트입니다.",
    ],
  },
};

export function getMockReview(id: string): ReviewReport | undefined {
  return MOCK_REPORTS[id];
}

/** `/review/[id]` 데모 전용 id — 실제 AI URL 리뷰 job id(UUID)와 구분합니다. */
const MOCK_REVIEW_IDS = new Set([
  "demo-1",
  "demo-2",
  "screenshot-demo",
  "error-demo",
  "not-found-demo",
]);

export function isMockReviewId(id: string): boolean {
  return MOCK_REVIEW_IDS.has(id);
}

/**
 * 랜딩 페이지에서 URL을 제출했을 때 이동할 리포트 id를 결정합니다.
 * MVP에는 실제 분석 파이프라인이 없으므로, 입력값에 특정 키워드가 포함되면
 * 오류/빈 상태 화면을 시연할 수 있도록 라우팅합니다.
 */
export function resolveMockReviewId(inputUrl: string): string {
  const normalized = inputUrl.toLowerCase();
  if (normalized.includes("error")) return "error-demo";
  if (normalized.includes("empty") || normalized.includes("notfound")) {
    return "not-found-demo";
  }
  if (normalized.includes("shop") || normalized.includes("store")) {
    return "demo-2";
  }
  return "demo-1";
}

/** 이미지 업로드 기반 리뷰 Mock 리포트 id */
export function resolveScreenshotReviewId(): string {
  return "screenshot-demo";
}
