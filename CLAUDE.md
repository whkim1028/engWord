# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 코드 작업을 할 때 참고할 가이드입니다.

## 프로젝트 개요

"로이의 탄탄토익"이라는 한국어 토익 단어 학습 애플리케이션으로, React와 Create React App으로 구축되었습니다. 플래시카드, 퀴즈, 시험 관리 기능을 제공하는 단어 학습 앱입니다.

## 개발 명령어

```bash
# 개발 서버 시작
npm start
# 또는
npm run dev

# 프로덕션 빌드
npm run build

# 테스트 실행
npm test

# Eject (되돌릴 수 없는 작업)
npm run eject
```

## 아키텍처

### 기술 스택
- **프론트엔드**: React 19.1.1 + React Router DOM 7.8.2
- **데이터베이스**: Supabase (PostgreSQL)
- **UI**: Bootstrap CSS (public/bootstrap.css로 로드)
- **엑셀 처리**: xlsx 라이브러리로 파일 업로드
- **알림**: react-toastify
- **가상화**: react-window (큰 목록용)

### 핵심 컴포넌트 구조

```
src/
├── components/
│   ├── Login/Login.js          # 인증 컴포넌트
│   ├── Word/                   # 단어 학습 모듈
│   │   ├── Word.js            # 페이지네이션이 있는 메인 단어 목록
│   │   ├── FlipCard.js        # 상호작용 단어 카드
│   │   └── FlipCard.css       # 카드 애니메이션
│   ├── Quiz/Quiz.js           # 퀴즈 기능
│   ├── Test/Test.js           # 시험 관리 (관리자용)
│   └── common/
│       ├── Navbar.js          # 내비게이션 컴포넌트
│       └── ProtectedRoute.js  # 라우트 보호 래퍼
├── utils/
│   └── notification.js        # 토스트 알림 유틸리티
└── supabaseClient.js         # 데이터베이스 설정
```

### 데이터베이스 스키마 (Supabase)

주요 테이블:
- **Word**: 단어 저장, 컬럼: `id`, `engWord`, `korWord`, `etc`, `div`, `category`, `useYn`
- **Question**: 퀴즈 문제, 컬럼: `id`, `question`, `etc`, `version`
- **Answer**: 퀴즈 선택지, 컬럼: `id`, `answer`, `correctYn`, `etc`, `questionId`

### 주요 기능

1. **단어 학습** (`/word`):
   - 시드 기반 랜덤 순서로 페이지네이션된 단어 표시
   - 상호작용 플립 카드로 학습
   - localStorage로 진행상황 추적
   - 엑셀 업로드로 대량 단어 관리 (관리자)
   - 카테고리와 Day별 필터링

2. **퀴즈 시스템** (`/quiz`):
   - 버전 기반 문제 세트
   - 해설이 있는 객관식 문제
   - 실시간 채점과 결과 분석
   - 선택지 순서 랜덤화

3. **시험 관리** (`/test`):
   - 퀴즈 생성/관리를 위한 관리자 인터페이스
   - 문제/답안 대량 가져오기용 엑셀 업로드
   - 버전 관리 시스템

4. **인증**:
   - Supabase Auth 통합
   - 세션 관리를 통한 보호된 라우트
   - 라우트 상태를 통한 관리자 역할 확인

### 데이터 흐름 패턴

- **단어 완료**: localStorage 키 `completedWords`로 사용자 진행상황 추적
- **랜덤 시드**: sessionStorage 키 `randomSeed`로 페이지 새로고침 간 일관된 단어 순서 유지
- **페이지네이션**: 효율적인 데이터 로딩을 위한 RPC 함수 `get_words_random` 사용
- **파일 처리**: XLSX 라이브러리로 클라이언트 측 엑셀 파일 처리

### 중요한 구현 참고사항

- 단어 필터링은 성능을 위해 서버 측에서 완료 항목 제외
- 퀴즈 답안은 위치 암기 방지를 위해 클라이언트 측에서 셔플
- 관리자 기능은 React Router state로 전달되는 `isAdmin` 플래그 필요
- 엑셀 업로드는 데이터 일관성을 위해 전체 데이터셋(문제/단어)을 대체
- 반응형 디자인을 위한 Bootstrap 유틸리티 클래스 사용
- 모든 작업에 대한 사용자 피드백을 위한 토스트 알림

### 환경 변수

필수 환경 변수:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

### 데이터베이스 함수

앱은 다음과 같은 Supabase RPC 함수 `get_words_random`에 의존:
- 시드, 제한, 오프셋, 완료된 ID, div, 카테고리 필터를 받음
- 완료된 항목을 제외한 랜덤화된 단어 목록 반환
- 제외 로직이 있는 일관된 페이지네이션 지원