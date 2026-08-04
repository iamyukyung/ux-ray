# UX-Ray (MVP)

웹사이트 URL을 입력하면 **데스크톱(1440×900)과 모바일(390×844)을 동시에** 분석하는
AI UX 리뷰 서비스의 프런트엔드 MVP입니다. 이번 범위는 **UI/UX 뼈대**이며, 실제 분석
엔진 없이 `lib/mock-review.ts`의 목업 데이터로 동작합니다.

## 실행 방법

```bash
npm install
npm run dev
```

`http://localhost:3000` 에서 확인할 수 있습니다.

## 페이지

- `/` — 랜딩 페이지 (헤드라인, URL 입력 폼, 7가지 평가 영역 안내)
- `/review/[id]` — 분석 중 → **종합 / 데스크톱 / 모바일** 3개 탭으로 전환되는 리포트 페이지
  (또는 오류 / 빈 상태)

## 상태 및 탭 시연 방법

목업 단계이므로 실제 크롤링 대신 입력한 URL 문자열로 상태를 분기합니다. 랜딩 페이지에서
아래 값을 입력해 각 상태를 확인해보세요.

| 입력 예시                     | 결과                                              |
| ------------------------------ | -------------------------------------------------- |
| `brightledger.io/pricing` (기본) | 정상 리포트 (`demo-1`) — 모바일 점수가 데스크톱보다 크게 낮은 SaaS 요금제 페이지 |
| `shop.northgrain.co`           | 정상 리포트 (`demo-2`) — 데스크톱·모바일 모두 양호하지만 격차가 있는 이커머스 페이지 |
| `error.example.com`            | **오류 상태** — 분석 실패 화면                        |
| `empty.example.com`             | **빈 상태** — 리포트를 찾을 수 없음 화면                |

분석 중 화면은 데스크톱·모바일 프레임을 함께 스캔하는 애니메이션으로, 약 2.8초간
노출됩니다 (`MOCK_ANALYSIS_DELAY_MS`).

결과 페이지 진입 후에는 상단에 고정된 탭으로 **종합 / 데스크톱 / 모바일**을 전환할 수
있습니다.

- **종합**: 전체·데스크톱·모바일 점수 카드, 두 환경의 차이 요약, 전체 우선순위 문제 목록
  (디바이스·심각도 필터 포함)
- **데스크톱 / 모바일**: 환경별 요약, 스크린샷(확대 보기 가능), 카테고리별 점수, 해당
  환경에서 발견된 문제 목록. 모바일 탭에는 공통 6개 영역에 더해 **모바일 사용성**
  (반응형 레이아웃 · 내비게이션 · 터치 상호작용 · CTA 노출성 · 폼 사용성 · 콘텐츠 밀도 ·
  침습적 오버레이) 영역이 추가됩니다.

## 모바일 화면 대응

- 점수 카드는 모바일에서 세로로 쌓이고(`grid-cols-1`), `sm` 이상에서 3열로 배치됩니다.
- 탭 바는 `sticky top-0`으로 스크롤 중에도 항상 화면 상단에 고정됩니다.
- 문제 카드는 기본적으로 접혀 있으며 "상세 내용 보기/접기" 버튼(44px 이상)으로
  펼칩니다.
- 스크린샷은 썸네일을 탭하면 확대 다이얼로그로 열리고, `Esc`나 바깥 영역 클릭으로
  닫힙니다.
- 표 형태의 가로 스크롤 UI 없이 카드/그리드 레이아웃만 사용합니다.
- 탭 버튼, 필터 칩, 토글 버튼 등 모든 상호작용 요소는 최소 44px 터치 영역을
  보장합니다(`min-h-11`/`h-11` = 44px).
- 분석 대상 URL은 항상 `truncate` 처리되어 긴 URL도 한 줄로 잘려 표시됩니다.

## 코드 구성

```
app/
  page.tsx                       랜딩 페이지
  review/[id]/page.tsx           리포트 페이지 (서버) — Suspense로 감싼 클라이언트 상태머신 렌더
  review/[id]/ReviewClient.tsx   analyzing → ready/error/not-found 상태 전환 + 탭 상태 관리
components/
  landing/                       Hero, URL 입력 폼, 7개 평가 영역 안내
  report/
    ReportHeader.tsx              URL·분석 시각 메타 바 (탭과 무관하게 항상 표시)
    ReviewTabs.tsx                 종합/데스크톱/모바일 sticky 탭 바
    OverallTab.tsx                 종합 탭: 점수 3종 + 차이 요약 + 전체 이슈 목록
    DeviceTab.tsx                  데스크톱/모바일 공용 탭: 요약 + 스크린샷 + 카테고리 점수 + 이슈 목록
    DeviceScreenshot.tsx           와이어프레임 스크린샷 목업 + 확대 보기 다이얼로그
    CategoryScoreGrid.tsx          카테고리별 점수 그리드
    IssueCard.tsx / IssueList.tsx  접기/펼치기 가능한 이슈 카드, 심각도·디바이스 필터
    AnalysisLimitations.tsx        분석 한계 안내
    ScanningState.tsx              데스크톱·모바일 동시 스캔 애니메이션 (분석 중 화면)
    ReportErrorState.tsx / ReportEmptyState.tsx  오류 / 빈 상태
  ui/                             Button, Badge(Severity/Category/Device), ScoreGauge, ScoreCard
  layout/                         헤더, 푸터
lib/
  types.ts        Severity/Device/Category/ReviewIssue/DeviceReport/ReviewReport 등 도메인 타입
  mock-review.ts  데스크톱·모바일 결과가 서로 다른 목업 리포트 2종 + 조회 헬퍼
  utils.ts        URL 검증, 날짜 포맷, 점수 톤 판별 등 유틸
```

## 실제 분석 파이프라인 연동 시

`lib/mock-review.ts`의 `getMockReview`, `resolveMockReviewId`를 실제 API 호출로
교체하면 되며, `ReviewReport`/`DeviceReport`/`ReviewIssue` 타입(`lib/types.ts`)이
그대로 API 응답 스키마 기준이 됩니다.
