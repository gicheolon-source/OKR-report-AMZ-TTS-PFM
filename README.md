# Dr.Rejuall OKR 보고 사이트

아마존 · 틱톡샵 · 퍼포먼스 마케팅 파트의 **월간 결산 / 분기 결산 OKR 보고서**를 한곳에서 보고, 페이지 안에서 바로 수정할 수 있는 정적 사이트입니다. 빌드 과정 없이 GitHub Pages에서 바로 동작합니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `#/` | 홈 — 2026년 분기(Q1~Q4) · 월(1~12월) 보고서 카드, 파트 구성 |
| `#/2026-09` | 9월 월간 결산 (아마존 / 틱톡샵 / 퍼포먼스 마케팅 / 🔒 면담시트 탭) |
| `#/2026-Q3` | 3분기 결산 (7~9월 월간 결산 링크 + 분기 OKR) |
| `#/2026-10` 등 | 데이터 파일이 없는 기간은 템플릿으로 자동 생성 (편집 후 JSON 내보내기로 저장) |

각 파트 탭은 **국가/영역별 그룹**(예: 아마존 → 미국·캐나다·자사몰·영국·호주·유럽·중동)으로 나뉘고, 그룹마다 담당자와 OKR(Objective → Key Result → Initiative), 성과/회고, 일정 표가 들어갑니다.

## 페이지 안에서 수정하기

1. 보고서 우측 상단 **✎ 편집** 클릭 → 텍스트를 클릭해 바로 수정, 행/열/Initiative/KR/Objective/섹션/그룹 추가·삭제, 상태 드롭다운 변경.
2. 변경 내용은 **이 브라우저(localStorage)에 자동 저장**됩니다. 다른 사람에게는 보이지 않습니다.
3. 팀 전체에 반영하려면 **⤓ JSON 내보내기** → 내려받은 `2026-09.json`을 레포의 `data/2026-09.json`에 덮어쓰고 커밋/푸시.
4. 새 기간(예: 10월)을 처음 저장할 때는 `data/index.json`의 `periods`에 `{ "id": "2026-10", "file": "2026-10.json" }`을 추가하세요.
5. **↺ 원본으로**를 누르면 브라우저 수정본을 지우고 레포 데이터로 되돌립니다.

## 🔒 면담시트

- 면담시트 탭은 **들어갈 때마다** 비밀번호를 묻습니다. (초기 비밀번호는 관리자에게 문의)
- 비밀번호는 SHA-256 해시로 `data/<기간>.json`의 `interviews.passwordHash`에 저장됩니다. 잠금 해제 후 **비밀번호 변경** 버튼으로 바꾼 뒤 JSON 내보내기 → 파일 교체 → 커밋하면 전체에 적용됩니다.
- 면담시트 원본 xlsx는 `interviews/` 폴더에 파일명 그대로 올리면(예: `[아마존]면담시트_김선우_2026.xlsx`) 목록의 **열기** 링크가 연결됩니다. 외부(구글 드라이브 등) 링크를 쓰려면 편집 모드에서 링크 열에 URL을 입력하세요.
- 정적 사이트의 비밀번호는 열람을 막는 용도이며, 레포가 공개(public)라면 JSON 자체는 누구나 볼 수 있습니다. 민감한 면담 내용은 xlsx를 비공개 저장소/드라이브에 두고 링크만 연결하는 것을 권장합니다.

## 데이터 구조 (`data/*.json`)

```
{
  "id": "2026-09", "type": "month", "label": "2026년 9월", "title": "9월 OKR 월간 결산", "date": "2026-09-30",
  "teams": [
    { "id": "amz", "name": "아마존", "color": "#e58a1f",
      "members": [{ "name", "role", "scope" }],
      "groups":  [{ "id": "us", "title": "미국", "flag": "🇺🇸", "owner": "김세빈" }],
      "sections": [
        { "type": "kpis",  "title", "items": [{ "label", "value", "sub" }] },
        { "group": "us", "type": "okr",   "title", "objectives": [{ "code", "title", "krs": [{ "code", "title", "initiatives": [{ "code", "title", "owner", "period", "status", "link", "note" }] }] }] },
        { "group": "us", "type": "text",  "title", "html": "<ul>…</ul>" },
        { "group": "us", "type": "table", "title", "columns": [], "rows": [[]], "badgeCols": [], "linkCol": 1, "links": [] }
      ] }
  ],
  "interviews": { "passwordHash": "…", "note": "…", "files": [{ "team", "name", "file", "updated", "link", "memo" }] }
}
```

- `status` 값: `Not Started` / `In Progress` / `Done` / `Hold` / `Exceeded` (배지 색으로 표시)
- `template-month.json`, `template-quarter.json`: 파일이 없는 기간을 열 때 쓰는 템플릿. OKR 트리와 파트 구성이 바뀌면 여기도 함께 갱신하세요.

## 로컬에서 보기

`fetch`로 JSON을 읽기 때문에 파일을 직접 열면(file://) 동작하지 않습니다. 간단한 서버로 실행하세요.

```bash
npx serve .
```

## GitHub Pages 배포

레포 **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`** 로 설정하면 `https://<계정>.github.io/OKR-report-AMZ-TTS-PFM/` 에서 열립니다. (`.nojekyll` 포함)

## 참고 원본

- OKR 시트: Project Schedule — 아마존 / 틱톡 탭 (구글 스프레드시트)
- 9월 성과·일정: 각 파트 주간 보고 및 슬랙 공유 내용
