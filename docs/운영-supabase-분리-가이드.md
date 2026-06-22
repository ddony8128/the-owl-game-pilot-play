# 게임별 Supabase 분리 운영 가이드

게임 1·2·3을 **독립적으로(다른 시간·팀·명단) 운영**하려면 게임마다 별도 Supabase 프로젝트를 써야 한다.
현재 스키마는 `players`(전역 단일 명단)와 `game_state`(싱글톤 `active_game`)를 전제로 하므로,
**하나의 Supabase를 공유하면 명단·진행 상태·전체 초기화가 게임끼리 충돌한다.**

> 결론: **현재 프로젝트 = 1게임(이상교통)으로 유지**, 2게임(마피아)·3게임(디펜스)용 Supabase 프로젝트를 **새로 만든다.**

코드(브랜치)는 이미 분리돼 있다. 각 배포가 **자기 Supabase를 보도록 env만 바꾸면** 된다.

| 게임 | 브랜치 | Supabase |
| --- | --- | --- |
| 1게임 이상교통 | `1game-only` | (기존 프로젝트 그대로) |
| 2게임 마피아 | `2game-only` | 신규 프로젝트 `owl-mafia` |
| 3게임 디펜스 | `3game-only` | 신규 프로젝트 `owl-defense` |

---

## 왜 "스키마만 export" 하면 안 되나

스키마만 뽑으면 **시드/참조 데이터가 빠진다.** 특히 `rules_state` 의 규칙 행은 코드가 자동 생성하지 않고(초기화는 `is_open` 만 갱신) **행이 이미 있다고 가정**한다.
그래서 아래처럼 **스키마+데이터를 통째로 복제한 뒤, 앱의 "전체 초기화"로 플레이 데이터만 비우는** 방식이 가장 안전하다. (시드/규칙은 남고, 명단·진행 기록만 깨끗이 비워진다.)

---

## 준비물

- 현재(1게임) 프로젝트의 **DB 접속 문자열**: Supabase 대시보드 → Settings → Database → *Connection string* (`postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`)
- `pg_dump` / `psql` (PostgreSQL 클라이언트). 또는 저장소의 Supabase CLI(`npx supabase`).

---

## 절차

### 1) 현재 DB 전체 덤프 (스키마 + 데이터)

```bash
pg_dump "postgresql://postgres:[PWD]@db.[기존REF].supabase.co:5432/postgres" \
  --schema=public --no-owner --no-privileges \
  -f owl-full.sql
```

> 대안(Supabase CLI): `npx supabase db dump --db-url "<기존 접속문자열>" -f owl-schema.sql` 는 기본이 스키마만이다. 데이터까지 받으려면 `--data-only` 로 한 번 더 받아 합치거나, 위 `pg_dump`(스키마+데이터 한 번에)를 권장.

### 2) 새 프로젝트 생성

Supabase 대시보드에서 새 프로젝트 2개 생성: **`owl-mafia`**, **`owl-defense`**.
각 프로젝트의 **접속 문자열**(Settings → Database)과 **URL·service_role 키**(Settings → API)를 메모.

### 3) 새 프로젝트에 덤프 적용

각 새 프로젝트에 대해:

```bash
psql "postgresql://postgres:[PWD]@db.[새REF].supabase.co:5432/postgres" -f owl-full.sql
```

### 4) 아카이브 테이블 추가

각 새 프로젝트에 `docs/sql/game-archive.sql` 를 실행 (마피아/디펜스 플레이 데이터 보존용).
Supabase 대시보드 → SQL Editor 에 붙여넣고 실행해도 된다. (idempotent)

### 5) 배포 env 전환

각 게임 배포(예: Vercel 프로젝트)에서 환경변수를 그 게임 프로젝트로 설정:

```
SUPABASE_URL=https://[새REF].supabase.co
SUPABASE_SERVICE_KEY=<그 프로젝트의 service_role 키>
```

- `2game-only` 배포 → `owl-mafia`
- `3game-only` 배포 → `owl-defense`
- `1game-only` 배포 → 기존 프로젝트(변경 없음)

> 로컬에서 테스트한다면 해당 브랜치의 `.env.local` 도 동일하게 바꾼다.

### 6) 깨끗한 시작 — 플레이 데이터만 비우기

새 프로젝트는 1게임 데이터를 복제한 상태다. 해당 게임 GM 대시보드 →
**메인 → 참가자 관리 → "세션 종료 / 다음 팀 준비 (참가자 포함 초기화)"** 를 한 번 실행한다.
→ 복제돼 온 참가자·진행 기록이 모두 비워지고, 규칙/시드는 남는다. 이제 그 게임 전용 빈 DB가 된다.

---

## 체크리스트 (게임별)

- [ ] 새 Supabase 프로젝트 생성
- [ ] `owl-full.sql` 적용 (스키마+시드)
- [ ] `docs/sql/game-archive.sql` 적용
- [ ] 배포 env(`SUPABASE_URL`/`SUPABASE_SERVICE_KEY`) 그 프로젝트로 설정
- [ ] GM "전체 초기화"로 복제 데이터 비우기
- [ ] 참가자 등록 → 게임 진행 정상 동작 확인

---

## 참고 — 코드가 자동 시드하는 것 / 아닌 것

초기화(`lib/admin/reset.ts`) 시 **코드가 자동 복원**: `game_state`(id=1), `mafia_stock_state`(주가 시드),
`defense_phase_state`·`defense_monster_count`(`lib/defense/monsters.ts` 기준).
**코드가 만들지 않음(덤프로 가져와야 함)**: `rules_state` 규칙 행 등 정적 참조 데이터. → 그래서 5단계가 아니라 "풀 덤프"가 필요하다.
