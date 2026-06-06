# 🪙 Study Coin Quest (스터디 코인 퀘스트)

공부 시간을 게임 속 보상(코인)으로 전환하고, 보스를 처치하며 지속적인 학습 동기를 부여받는 게임형 자율 학습 타이머 웹 애플리케이션입니다! 

## 🎮 핵심 철학
> "학생마다 공부하는 과목과 내용은 다양하지만, 매일 꾸준히 책상 앞을 지킨 시간의 가치는 모두 동일합니다."
> 무엇을 공부하든 상관없이 오롯이 흘려보낸 집중의 기록이 코인이 되고, 획득한 성취가 더 뛰어난 학습 영웅의 칭호로 이어집니다.

---

## 🛠️ 기술 스택 및 구조
- **프론트엔드**: Vite + React 19 + TypeScript
- **스타일 프레임워크**: Tailwind CSS v4.x (Space Grotesk & Inter 폰트 장착)
- **모션 애니메이션**: Framer Motion (import from `motion/react`)
- **백엔드/인프라**: Supabase (PostgreSQL + Auth 인증 인프라)
- **배포 플랫폼**: Vercel

---

## 💾 1. Supabase 데이터베이스 구축 가이드
이 응용 프로그램은 Supabase를 활용한 실시간 데이터 동기화를 지원합니다. 본인의 Supabase 프로젝트 Dashboard 내 **SQL Editor**에 접속하여 아래 쿼리를 순서대로 실행하세요.

```sql
-- 1. profiles (도전자 정보) 테이블 생성
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  coins integer default 0,
  selected_title text default '첫걸음 학습자',
  created_at timestamp with time zone default now()
);

-- 2. study_sessions (공부 기록) 테이블 데이터 유효화
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone not null,
  duration_minutes integer not null,
  earned_coins integer not null,
  created_at timestamp with time zone default now()
);

-- 3. user_achievements (토벌한 보스 기록) 테이블 생성
create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  achievement_key text not null,
  achieved_at timestamp with time zone default now(),
  unique(user_id, achievement_key)
);

-- 4. user_titles (도전자가 언락한 전리품 칭호) 테이블 생성
create table public.user_titles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamp with time zone default now(),
  unique(user_id, title)
);

-- 5. Row Level Security(행수준 보안 RLS) 활성화
alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_titles enable row level security;

-- 6. 보안 권한 배포 정책 (Policies) 작성
create policy "사용자는 본인의 profile만 조회/수정 가능" on public.profiles 
  for all using (auth.uid() = id);

create policy "사용자는 본인의 study_sessions만 조회/생성 가능" on public.study_sessions 
  for all using (auth.uid() = user_id);

create policy "사용자는 본인의 achievements만 조회 가능" on public.user_achievements 
  for all using (auth.uid() = user_id);

create policy "사용자는 본인의 titles만 조회 가능" on public.user_titles 
  for all using (auth.uid() = user_id);

create policy "전체 랭킹 집계를 위한 profile 공개 select 권한 부여" on public.profiles 
  for select using (true);
```

---

## 🔑 2. 환경변수 구성 (.env)
로컬 폴더 루트에 `.env` 파일을 새로 생성한 뒤, 본인의 Supabase 프로젝트 정보를 입력합니다. (Vite CLI에 노출하려면 변수명에 `VITE_` 수식어가 붙어있어야 합니다.)

```env
# Supabase 서비스 주소 및 Anon 발급 키 주소 배치
VITE_SUPABASE_URL="본인의_SUPABASE_PROJECT_API_주소_URL"
VITE_SUPABASE_ANON_KEY="본인의_SUPABASE_ANON_PUBLIC_KEY"
```

> **로컬 가동 샌드박스 세이프가드**: 만약 부득이하게 환경변수를 공란으로 비워두더라도, 애플리케이션 프론트 패널은 즉석 가동되는 **LocalStorage 모드**로 자동 낙하합니다. 서버 없이도 완벽히 독립된 가상 라이벌 6인 랭킹 배판과 보스 토벌 및 칭호 교체 시뮬레이션을 브라우저에서 쾌적하게 선공개 탑승해볼 수 있습니다.

---

## 🏃 3. 로컬 가동 및 설치 방법
```bash
# 1. 의존성 노드 모듈 설치
npm install

# 2. 로컬 실행 서버 기동
npm run dev
# -> http://localhost:3000 으로 자동 주입 가동됩니다.
```

---

## 🚀 4. Vercel 실전 배포 설명 및 주의사항
어플리케이션을 Vercel에 연동 시 아래 안내를 숙지해 배포하세요.

1. **GitHub 연동**: 완성된 소스코드를 본인의 GitHub 저장소에 Push합니다.
2. **Vercel 프로젝트 생성**: Vercel Dashboard에서 `Add New` -> `Project`를 누른 뒤 업로드된 Repository를 가져옵니다.
3. **Environment Variables 구성**: 배포 구성 화면 하단의 `Environment Variables` 항목을 열고, 아래의 한 쌍을 각각 등록하세요:
   - **Key**: `VITE_SUPABASE_URL` | **Value**: *(자신의 Supabase URL)*
   - **Key**: `VITE_SUPABASE_ANON_KEY` | **Value**: *(자신의 Supabase Anon API Key)*
4. **Vite 빌드 스크립트 실행 확인**: Root 디렉터리의 `package.json` 패키지 설정을 파악하여, Vercel이 빌드 명령인 `npm run build`를 자동 실행하고 결과물인 빌드 자산 `dist` 폴더를 원활히 정적 서비스에 바인딩합니다.
5. **완료 및 실사용**: 배포된 Vercel 도메인으로 친구들과 모여 공부 시간을 겨뤄 보시기 바랍니다!
