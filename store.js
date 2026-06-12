const STORAGE_KEY = "teamplog:data:v1";
const CHANNEL_NAME = "teamplog:sync";

const pad = (value) => String(value).padStart(2, "0");
export const toDateInput = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addDays = (amount) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + amount);
  return toDateInput(date);
};

export const nowIso = () => new Date().toISOString();
export const makeId = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
export const makeTeamId = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase();

export async function hashPassword(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function seedData() {
  const createdAt = nowIso();
  const teamId = "LOG824";
  return {
    users: {
      minji: {
        id: "minji",
        name: "김민지",
        passwordHash:
          "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
        joinedTeams: { [teamId]: true },
      },
      yurim: {
        id: "yurim",
        name: "박유림",
        passwordHash:
          "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
        joinedTeams: { [teamId]: true },
      },
      joon: {
        id: "joon",
        name: "이준호",
        passwordHash:
          "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
        joinedTeams: { [teamId]: true },
      },
    },
    teams: {
      [teamId]: {
        teamId,
        teamName: "마케팅 전략 발표",
        subjectName: "디지털 마케팅",
        dueDate: addDays(9),
        inviteCode: "MARKET24",
        createdBy: "minji",
        createdAt,
        updatedAt: createdAt,
        members: {
          minji: { userId: "minji", name: "김민지", role: "조장 · 발표", joinedAt: createdAt, lastActive: createdAt },
          yurim: { userId: "yurim", name: "박유림", role: "PPT · 디자인", joinedAt: createdAt, lastActive: createdAt },
          joon: { userId: "joon", name: "이준호", role: "자료조사", joinedAt: createdAt, lastActive: createdAt },
        },
        messages: {
          msg1: { messageId: "msg1", userId: "yurim", userName: "박유림", text: "경쟁사 분석 슬라이드까지 정리해둘게요!", createdAt },
          msg2: { messageId: "msg2", userId: "minji", userName: "김민지", text: "좋아요. 오늘 저녁에 초안 같이 확인해요.", createdAt: new Date(Date.now() + 1000).toISOString() },
        },
        tasks: {
          task1: { taskId: "task1", title: "PPT 초안 만들기", assigneeId: "yurim", assigneeName: "박유림", dueDate: addDays(1), status: "진행 중", material: "발표 PPT", memo: "브랜드 컬러 적용", createdAt },
          task2: { taskId: "task2", title: "경쟁사 사례 3개 조사", assigneeId: "joon", assigneeName: "이준호", dueDate: addDays(0), status: "진행 전", material: "참고자료", memo: "국내 사례 우선", createdAt },
          task3: { taskId: "task3", title: "발표 대본 1차 검토", assigneeId: "minji", assigneeName: "김민지", dueDate: addDays(4), status: "진행 전", material: "대본", memo: "7분 분량", createdAt },
          task4: { taskId: "task4", title: "설문 문항 확정", assigneeId: "minji", assigneeName: "김민지", dueDate: addDays(-1), status: "완료", material: "설문지", memo: "", createdAt },
        },
        files: {
          file1: { fileId: "file1", teamId, title: "발표 PPT", fileName: "marketing_presentation_v3.pptx", fileType: "pptx", fileSize: 4823449, fileUrl: "", uploadedBy: "yurim", uploadedByName: "박유림", version: 3, updatedAt: createdAt, history: { h1: { oldFileName: "marketing_v2.pptx", newFileName: "marketing_presentation_v3.pptx", updatedBy: "yurim", updatedByName: "박유림", version: 3, updatedAt: createdAt } } },
          file2: { fileId: "file2", teamId, title: "경쟁사 참고자료", fileName: "competitor_research.pdf", fileType: "pdf", fileSize: 1280400, fileUrl: "", uploadedBy: "joon", uploadedByName: "이준호", version: 1, updatedAt: createdAt, history: {} },
        },
        minutes: {
          minute1: { minuteId: "minute1", date: addDays(-3), topic: "발표 방향 및 역할 분담", attendees: "김민지, 박유림, 이준호", content: "타깃 고객을 20대 대학생으로 좁히고 경쟁사 사례를 중심으로 발표 흐름을 구성하기로 함.", decisions: "민지 발표, 유림 PPT, 준호 자료조사 담당", nextMeeting: `${addDays(1)} 19:00`, authorId: "minji", authorName: "김민지", createdAt, updatedAt: createdAt },
        },
        events: {
          event1: { eventId: "event1", title: "PPT 초안 리뷰", type: "회의", date: addDays(1), time: "19:00", place: "중앙도서관 3층", description: "슬라이드 흐름과 분량 확인", authorId: "minji", authorName: "김민지", createdAt },
          event2: { eventId: "event2", title: "최종 발표", type: "발표", date: addDays(9), time: "14:00", place: "경영관 201호", description: "발표 7분, 질의응답 3분", authorId: "minji", authorName: "김민지", createdAt },
        },
      },
    },
    notifications: {
      minji: {
        noti1: { notificationId: "noti1", senderId: "yurim", senderName: "박유림", content: "발표 PPT 파일을 v3으로 업데이트했습니다.", teamId, teamName: "마케팅 전략 발표", taskId: "", createdAt, isRead: false },
      },
      yurim: {},
      joon: {},
    },
  };
}

const clone = (value) => JSON.parse(JSON.stringify(value));

function applyPatches(target, patches) {
  const next = clone(target);
  Object.entries(patches).forEach(([path, value]) => {
    const parts = path.split("/").filter(Boolean);
    const last = parts.pop();
    let cursor = next;
    parts.forEach((part) => {
      if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
      cursor = cursor[part];
    });
    if (value === null) delete cursor[last];
    else cursor[last] = value;
  });
  return next;
}

class LocalStore {
  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.data = saved ? JSON.parse(saved) : seedData();
    this.listeners = new Set();
    this.channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    this.channel?.addEventListener("message", ({ data }) => {
      if (data?.type === "sync") {
        this.data = data.payload;
        this.emit();
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(clone(this.data));
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = clone(this.data);
    this.listeners.forEach((listener) => listener(snapshot));
  }

  async update(patches) {
    this.data = applyPatches(this.data, patches);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    this.channel?.postMessage({ type: "sync", payload: this.data });
    this.emit();
  }

  async uploadFile(_teamId, _fileId, file) {
    return { url: "", fileName: file.name, fileSize: file.size, fileType: file.name.split(".").pop()?.toLowerCase() || "" };
  }
}

export async function createStore() {
  const config = window.TEAMPLOG_FIREBASE_CONFIG || {};
  if (config.apiKey && config.databaseURL && config.projectId) {
    try {
      const { FirebaseStore } = await import("./firebase-store.js");
      return { store: new FirebaseStore(config), mode: "firebase" };
    } catch (error) {
      console.error("Firebase 초기화 실패, 데모 모드로 전환합니다.", error);
    }
  }
  return { store: new LocalStore(), mode: "local" };
}
