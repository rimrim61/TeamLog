# 팀플로그

팀플 회의 내용과 할 일을 한눈에 정리하는 React 기반 웹 앱입니다.

## 바로 실행

정적 파일 서버로 프로젝트 루트를 열면 됩니다.

```bash
npx serve .
```

또는 Vite를 사용할 수 있습니다.

```bash
npm install
npm run dev
```

## Firebase 연결

1. Firebase 프로젝트에서 Realtime Database와 Storage를 생성합니다.
2. Firebase Authentication에서 `익명` 로그인 제공업체를 활성화합니다.
3. `firebase.database.rules.json`과 `storage.rules`의 규칙을 각 Firebase 서비스에 적용합니다.
4. `firebase-config.js`의 빈 값을 Firebase 웹 앱 설정값으로 교체합니다.
5. 페이지를 새로고침하면 상단의 `데모 모드` 표시가 `Firebase 실시간 연결`로 바뀝니다.

Firebase 설정이 비어 있으면 localStorage와 BroadcastChannel을 이용한 데모 모드로 실행됩니다. 데모 계정은 `minji / 1234`입니다.

현재 규칙은 프로토타입용으로, 익명 인증을 통과한 앱 사용자에게 프로젝트 데이터를 허용합니다. 실제 서비스에서는 Firebase Authentication 사용자 UID와 앱 사용자 정보를 연결하고 팀별 멤버십을 규칙에서 검사하도록 강화하세요.

## 배포

GitHub 저장소에 올린 뒤 Vercel에서 저장소를 연결하면 됩니다. 별도 빌드 없이 정적 배포할 수 있고, Vite 빌드를 사용할 경우 Build Command는 `npm run build`, Output Directory는 `dist`로 지정하세요.

GitHub 저장소의 최상위에는 `index.html`, `app.js`, `store.js`, `firebase-store.js`, `styles.css`, `firebase-config.js`, `package.json`이 함께 있어야 합니다. Vercel 설정은 Framework Preset `Vite`, Build Command `npm run build`, Output Directory `dist`를 사용하세요.
