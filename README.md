# Markdown to PDF

브라우저에서 Markdown을 PDF로 변환하는 클라이언트 사이드 웹 애플리케이션입니다.

## 주요 기능

- **실시간 미리보기**: 타이핑하는 동안 즉시 렌더링
- **한글 지원**: Noto Sans KR 폰트, `word-break: keep-all`, `line-break: strict`
- **코드 하이라이팅**: Prism.js를 통한 다양한 언어 지원
- **수학 수식**: KaTeX를 통한 LaTeX 수식 렌더링 (`$...$`, `$$...$$`)
- **Mermaid 다이어그램**: flowchart, sequence diagram 등 지원
- **자동 저장**: LocalStorage에 자동으로 저장 및 복원
- **완전한 클라이언트 사이드**: 서버 불필요, 개인정보 보호

## 사용법

1. 왼쪽 편집기에 Markdown을 작성합니다.
2. 오른쪽에서 실시간 미리보기를 확인합니다.
3. "PDF 다운로드" 버튼을 클릭하여 PDF를 생성합니다.

## 지원하는 Markdown 문법

### 기본 문법
- 제목 (`#`, `##`, `###`, ...)
- **굵게**, *기울임*, ~~취소선~~
- 목록 (순서 있는/없는)
- 링크 및 이미지
- 인용문
- 표
- 코드 블록

### 확장 문법

#### 코드 하이라이팅
\`\`\`javascript
console.log('Hello, World!');
\`\`\`

#### 수학 수식 (KaTeX)
- 인라인: `$E = mc^2$`
- 블록: `$$\int_{0}^{1} x^2 dx$$`

#### Mermaid 다이어그램
\`\`\`mermaid
flowchart LR
    A --> B --> C
\`\`\`

## 로컬 실행

정적 파일 서버를 사용하여 실행합니다:

\`\`\`bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve

# PHP
php -S localhost:8000
\`\`\`

브라우저에서 `http://localhost:8000` 접속

## 기술 스택

- **Markdown 파싱**: [marked.js](https://marked.js.org/)
- **코드 하이라이팅**: [Prism.js](https://prismjs.com/)
- **수학 수식**: [KaTeX](https://katex.org/)
- **다이어그램**: [Mermaid](https://mermaid.js.org/)
- **PDF 생성**: [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/)
- **한글 폰트**: [Noto Sans KR](https://fonts.google.com/noto/specimen/Noto+Sans+KR)

## 배포

GitHub Pages, Vercel, Netlify 등에 정적 파일로 배포 가능합니다.

\`\`\`bash
# GitHub Pages 배포 예시
git add .
git commit -m "Initial commit"
git push origin main
# Settings > Pages > Source: main branch
\`\`\`

## 라이선스

MIT License
