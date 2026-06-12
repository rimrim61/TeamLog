import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@19.1.0";
import { createRoot } from "https://esm.sh/react-dom@19.1.0/client";
import htm from "https://esm.sh/htm@3.1.1";
import { addDays, createStore, hashPassword, makeId, makeTeamId, nowIso } from "./store.js";

const html = htm.bind((type, props, ...children) =>
  React.createElement(type || React.Fragment, props, ...children));
const SESSION_KEY = "teamplog:session";
const allowedExtensions = ["pdf", "doc", "docx", "hwp", "hwpx", "ppt", "pptx", "jpg", "jpeg", "png", "zip"];
const { store, mode } = await createStore();

const values = (object) => Object.values(object || {});
const formatDate = (value, withTime = false) => {
  if (!value) return "-";
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("ko-KR", withTime
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" }).format(date);
};
const relativeTime = (value) => {
  if (!value) return "방금 전";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / 1440)}일 전`;
};
const daysFromToday = (value) => {
  const target = new Date(`${value}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};
const dueMeta = (date, status) => {
  if (status === "완료") return { text: "완료", tone: "success" };
  const days = daysFromToday(date);
  if (days < 0) return { text: "마감 지남", tone: "danger" };
  if (days === 0) return { text: "오늘 마감", tone: "warning" };
  if (days <= 3) return { text: `D-${days}`, tone: "warning" };
  return { text: `D-${days}`, tone: "neutral" };
};
const fileSize = (size = 0) => size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
const sorted = (object, key = "createdAt", direction = "desc") =>
  values(object).sort((a, b) => direction === "desc"
    ? String(b[key] || "").localeCompare(String(a[key] || ""))
    : String(a[key] || "").localeCompare(String(b[key] || "")));

function Field({ label, name, type = "text", placeholder = "", required = false, defaultValue = "", children }) {
  return html`<label className="field">
    <span>${label}${required && html`<b> *</b>`}</span>
    ${children || html`<input name=${name} type=${type} placeholder=${placeholder} defaultValue=${defaultValue} required=${required} />`}
  </label>`;
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return html`<div className="modal-backdrop" onMouseDown=${(event) => event.target === event.currentTarget && onClose()}>
    <section className=${`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true">
      <button className="icon-button modal-close" onClick=${onClose} aria-label="닫기">×</button>
      <div className="modal-heading"><h2>${title}</h2>${subtitle && html`<p>${subtitle}</p>`}</div>
      ${children}
    </section>
  </div>`;
}

function Empty({ title, detail }) {
  return html`<div className="empty-state"><div className="empty-mark">T</div><strong>${title}</strong>${detail && html`<p>${detail}</p>`}</div>`;
}

function Badge({ children, tone = "neutral" }) {
  return html`<span className=${`badge badge-${tone}`}>${children}</span>`;
}

function Logo({ compact = false }) {
  return html`<div className=${`brand ${compact ? "brand-compact" : ""}`}>
    <span className="brand-mark"><i></i><i></i><i></i></span>
    <span><b>팀플로그</b>${!compact && html`<small>TEAM PROJECT NOTE</small>`}</span>
  </div>`;
}

function Toast({ toast }) {
  if (!toast) return null;
  return html`<div className=${`toast toast-${toast.tone || "info"}`}>${toast.message}</div>`;
}

function AuthScreen({ data, onLogin, notify }) {
  const [view, setView] = useState("login");
  const [busy, setBusy] = useState(false);

  const submitLogin = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get("id") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    if (!id) return notify("아이디를 입력해주세요.", "error");
    if (!password) return notify("비밀번호를 입력해주세요.", "error");
    setBusy(true);
    const passwordHash = await hashPassword(password);
    const snapshot = data;
    setBusy(false);
    if (!snapshot.users?.[id] || snapshot.users[id].passwordHash !== passwordHash) {
      return notify("아이디 또는 비밀번호가 올바르지 않습니다.", "error");
    }
    onLogin(id);
  };

  const submitSignup = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get("id") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    const name = String(form.get("name") || "").trim();
    if (!id) return notify("아이디를 입력해주세요.", "error");
    if (!password) return notify("비밀번호를 입력해주세요.", "error");
    if (password !== confirm) return notify("비밀번호가 일치하지 않습니다.", "error");
    if (!name) return notify("이름을 입력해주세요.", "error");
    setBusy(true);
    const snapshot = data;
    if (snapshot.users?.[id]) {
      setBusy(false);
      return notify("이미 사용 중인 아이디입니다.", "error");
    }
    await store.update({
      [`users/${id}`]: { id, name, passwordHash: await hashPassword(password), joinedTeams: {} },
      [`notifications/${id}`]: {},
    });
    setBusy(false);
    notify("회원가입이 완료되었습니다.", "success");
    onLogin(id);
  };

  return html`<main className="auth-shell">
    <section className="auth-story">
      <${Logo} />
      <div className="story-copy">
        <${Badge} tone="light">대학생 팀플을 위한 한 권의 노트</${Badge}>
        <h1>흩어진 팀플,<br/><em>한눈에 정리하세요.</em></h1>
        <p>회의 내용부터 할 일, 최신 자료, 일정까지.<br/>팀플에 필요한 모든 기록을 한곳에서 관리해요.</p>
      </div>
      <div className="story-preview">
        <div className="preview-head"><span>마케팅 전략 발표</span><${Badge} tone="warning">D-9</${Badge}></div>
        <div className="preview-row"><i className="check done">✓</i><span>PPT 구성안 확정</span><small>김민지</small></div>
        <div className="preview-row"><i className="check">2</i><span>경쟁사 사례 조사</span><small>이준호</small></div>
        <div className="preview-row"><i className="check">3</i><span>발표 자료 디자인</span><small>박유림</small></div>
      </div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <${Logo} compact=${true} />
        <div className="auth-tabs">
          <button className=${view === "login" ? "active" : ""} onClick=${() => setView("login")}>로그인</button>
          <button className=${view === "signup" ? "active" : ""} onClick=${() => setView("signup")}>회원가입</button>
        </div>
        ${view === "login" ? html`
          <div className="form-heading"><h2>다시 만나서 반가워요</h2><p>오늘의 팀플 진행 상황을 확인해볼까요?</p></div>
          <form onSubmit=${submitLogin} className="stack-form">
            <${Field} label="아이디" name="id" placeholder="아이디를 입력하세요" />
            <${Field} label="비밀번호" name="password" type="password" placeholder="비밀번호를 입력하세요" />
            <button className="primary-button" disabled=${busy}>${busy ? "확인 중..." : "로그인"}</button>
          </form>
          <div className="demo-account"><span>DEMO</span><p><b>minji</b> / <b>1234</b>로 바로 둘러볼 수 있어요.</p></div>
        ` : html`
          <div className="form-heading"><h2>팀플로그 시작하기</h2><p>간단한 정보로 나만의 팀플 노트를 만들어요.</p></div>
          <form onSubmit=${submitSignup} className="stack-form">
            <${Field} label="아이디" name="id" placeholder="영문 아이디" />
            <${Field} label="이름(실명)" name="name" placeholder="팀원에게 표시될 이름" />
            <${Field} label="비밀번호" name="password" type="password" placeholder="비밀번호" />
            <${Field} label="비밀번호 확인" name="confirm" type="password" placeholder="비밀번호를 다시 입력하세요" />
            <button className="primary-button" disabled=${busy}>${busy ? "가입 중..." : "회원가입"}</button>
          </form>
        `}
      </div>
    </section>
  </main>`;
}

function Header({ user, notifications, onLogout, onHome, inTeam = false }) {
  const unread = values(notifications).filter((item) => !item.isRead).length;
  return html`<header className="topbar">
    <button className="header-logo" onClick=${onHome}><${Logo} compact=${true} /></button>
    <div className="topbar-actions">
      <span className=${`connection ${mode}`}><i></i>${mode === "firebase" ? "Firebase 실시간 연결" : "데모 모드"}</span>
      ${inTeam && html`<button className="text-button desktop-only" onClick=${onHome}>내 팀플 홈</button>`}
      <button className="notification-button" onClick=${() => { location.hash = "home"; setTimeout(() => document.querySelector("#notifications")?.scrollIntoView({ behavior: "smooth" }), 50); }} aria-label="알림">
        알림${unread > 0 && html`<b>${unread}</b>`}
      </button>
      <div className="profile-chip"><span>${user.name.slice(-2)}</span><div><b>${user.name}</b><small>${user.id}</small></div></div>
      <button className="outline-button small" onClick=${onLogout}>로그아웃</button>
    </div>
  </header>`;
}

function CreateTeamModal({ user, onClose, notify }) {
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const teamId = makeTeamId();
    const createdAt = nowIso();
    const teamName = String(form.get("teamName") || "").trim();
    const subjectName = String(form.get("subjectName") || "").trim();
    const dueDate = String(form.get("dueDate") || "");
    const inviteCode = String(form.get("inviteCode") || "").trim() || Math.random().toString(36).slice(2, 8).toUpperCase();
    const role = String(form.get("role") || "조장").trim();
    if (!teamName || !subjectName || !dueDate) return notify("필수 항목을 입력해주세요.", "error");
    const team = {
      teamId, teamName, subjectName, dueDate, inviteCode, createdBy: user.id, createdAt, updatedAt: createdAt,
      members: { [user.id]: { userId: user.id, name: user.name, role, joinedAt: createdAt, lastActive: createdAt } },
      messages: {}, tasks: {}, files: {}, minutes: {}, events: {},
    };
    await store.update({ [`teams/${teamId}`]: team, [`users/${user.id}/joinedTeams/${teamId}`]: true });
    notify("팀플방을 만들었습니다.", "success");
    location.hash = `team/${teamId}`;
    onClose();
  };
  return html`<${Modal} title="새 팀플방 만들기" subtitle="팀플의 기본 정보를 입력하면 바로 팀원을 초대할 수 있어요." onClose=${onClose}>
    <form className="grid-form" onSubmit=${submit}>
      <${Field} label="팀플 이름" name="teamName" placeholder="예: 마케팅 전략 발표" required=${true} />
      <${Field} label="과목명" name="subjectName" placeholder="예: 디지털 마케팅" required=${true} />
      <${Field} label="발표일 또는 제출일" name="dueDate" type="date" defaultValue=${addDays(14)} required=${true} />
      <${Field} label="초대코드" name="inviteCode" placeholder="비워두면 자동 생성" />
      <${Field} label="내 역할" name="role" placeholder="예: 조장 · 발표" defaultValue="조장" />
      <div className="form-actions"><button type="button" className="outline-button" onClick=${onClose}>취소</button><button className="primary-button">팀플방 만들기</button></div>
    </form>
  </${Modal}>`;
}

function JoinTeamModal({ data, user, onClose, notify }) {
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const teamId = String(form.get("teamId") || "").trim().toUpperCase();
    const inviteCode = String(form.get("inviteCode") || "").trim();
    if (!teamId) return notify("teamId를 입력해주세요.", "error");
    const team = data.teams?.[teamId];
    if (!team) return notify("존재하지 않는 팀플방입니다.", "error");
    if (team.inviteCode !== inviteCode) return notify("초대코드가 올바르지 않습니다.", "error");
    if (team.members?.[user.id]) {
      notify("이미 참여 중인 팀플방입니다.", "info");
      location.hash = `team/${teamId}`;
      return onClose();
    }
    const joinedAt = nowIso();
    await store.update({
      [`teams/${teamId}/members/${user.id}`]: { userId: user.id, name: user.name, role: "역할 미정", joinedAt, lastActive: joinedAt },
      [`users/${user.id}/joinedTeams/${teamId}`]: true,
      [`teams/${teamId}/updatedAt`]: joinedAt,
    });
    notify("팀플방에 참여했습니다.", "success");
    location.hash = `team/${teamId}`;
    onClose();
  };
  return html`<${Modal} title="팀플방 참여하기" subtitle="팀원에게 받은 teamId와 초대코드를 입력하세요." onClose=${onClose}>
    <form className="stack-form" onSubmit=${submit}>
      <${Field} label="Team ID" name="teamId" placeholder="예: A7K29Q" required=${true} />
      <${Field} label="초대코드" name="inviteCode" placeholder="초대코드 입력" required=${true} />
      <button className="primary-button">참여하고 입장하기</button>
    </form>
  </${Modal}>`;
}

function Dashboard({ data, user, notify }) {
  const [modal, setModal] = useState("");
  const joinedIds = Object.keys(user.joinedTeams || {});
  const teams = joinedIds.map((id) => data.teams?.[id]).filter(Boolean);
  const myTasks = teams.flatMap((team) => values(team.tasks).filter((task) => task.assigneeId === user.id && task.status !== "완료").map((task) => ({ ...task, team })));
  const myNotifications = sorted(data.notifications?.[user.id]);
  const unread = myNotifications.filter((item) => !item.isRead);
  const upcoming = teams.flatMap((team) => values(team.events).filter((event) => daysFromToday(event.date) >= 0).map((event) => ({ ...event, team }))).sort((a, b) => a.date.localeCompare(b.date));

  return html`<main className="page dashboard-page">
    <section className="welcome-row">
      <div><p className="eyebrow">MY TEAM PROJECTS</p><h1>${user.name}님, 오늘도<br className="mobile-only"/> 팀플을 가볍게 시작해요.</h1><p>마감과 할 일을 확인하고 팀원들과 진행 상황을 나눠보세요.</p></div>
      <div className="welcome-actions"><button className="outline-button" onClick=${() => setModal("join")}>Team ID로 참여</button><button className="primary-button" onClick=${() => setModal("create")}>+ 새 팀플방</button></div>
    </section>

    <section className="summary-grid">
      <article className="summary-card urgent"><div><span>오늘의 할 일</span><strong>${myTasks.length}</strong></div><p>${myTasks.filter((task) => daysFromToday(task.dueDate) <= 1).length}개가 곧 마감돼요</p><i>01</i></article>
      <article className="summary-card"><div><span>읽지 않은 알림</span><strong>${unread.length}</strong></div><p>${unread.length ? "새로운 팀 소식이 있어요" : "모든 알림을 확인했어요"}</p><i>02</i></article>
      <article className="summary-card"><div><span>다가오는 일정</span><strong>${upcoming.length}</strong></div><p>${upcoming[0] ? `${formatDate(upcoming[0].date)} · ${upcoming[0].title}` : "예정된 일정이 없어요"}</p><i>03</i></article>
      <article className="summary-card"><div><span>참여 중인 팀플</span><strong>${teams.length}</strong></div><p>이번 학기 팀플을 한곳에서</p><i>04</i></article>
    </section>

    <section className="dashboard-layout">
      <div className="dashboard-main">
        <div className="section-title"><div><p className="eyebrow">PROJECT ROOMS</p><h2>내 팀플방</h2></div><span>${teams.length}개의 팀플</span></div>
        <div className="team-grid">
          ${teams.length ? teams.map((team) => {
            const member = team.members?.[user.id];
            const pending = values(team.tasks).filter((task) => task.assigneeId === user.id && task.status !== "완료").length;
            const teamUnread = unread.filter((item) => item.teamId === team.teamId).length;
            return html`<button className="team-card" key=${team.teamId} onClick=${() => location.hash = `team/${team.teamId}`}>
              <div className="team-card-top"><span className="subject-label">${team.subjectName}</span><${Badge} tone=${daysFromToday(team.dueDate) <= 3 ? "warning" : "light"}>D-${Math.max(0, daysFromToday(team.dueDate))}</${Badge}></div>
              <h3>${team.teamName}</h3>
              <p className="role-line"><span>${member?.name?.slice(-2) || "나"}</span>${member?.role || "역할 미정"}</p>
              <div className="team-progress"><span><i style=${{ width: `${Math.min(100, values(team.tasks).filter((task) => task.status === "완료").length / Math.max(1, values(team.tasks).length) * 100)}%` }}></i></span><small>${values(team.tasks).filter((task) => task.status === "완료").length}/${values(team.tasks).length} 완료</small></div>
              <div className="team-meta"><span>미완료 <b>${pending}</b></span><span>새 알림 <b>${teamUnread}</b></span><span>${relativeTime(team.updatedAt)}</span></div>
              <div className="team-card-foot"><span>마감 ${formatDate(team.dueDate)}</span><b>팀플방 열기 →</b></div>
            </button>`;
          }) : html`<${Empty} title="아직 참여한 팀플방이 없습니다." detail="팀플방을 만들거나 teamId로 참여해보세요." />`}
        </div>

        <section className="panel task-overview">
          <div className="panel-heading"><div><p className="eyebrow">MY TASKS</p><h2>내가 해야 할 일</h2></div><${Badge} tone="warning">${myTasks.length}개 남음</${Badge}></div>
          <div className="compact-list">
            ${myTasks.length ? myTasks.slice(0, 5).map((task) => {
              const due = dueMeta(task.dueDate, task.status);
              return html`<button className="compact-task" onClick=${() => location.hash = `team/${task.team.teamId}/work`}>
                <span className=${`task-dot ${task.status === "진행 중" ? "active" : ""}`}></span>
                <div><b>${task.title}</b><small>${task.team.teamName} · ${formatDate(task.dueDate)}</small></div>
                <${Badge} tone=${due.tone}>${due.text}</${Badge}>
              </button>`;
            }) : html`<${Empty} title="아직 등록된 할 일이 없습니다." />`}
          </div>
        </section>
      </div>

      <aside className="dashboard-side">
        <section className="panel schedule-panel"><div className="panel-heading"><div><p className="eyebrow">UPCOMING</p><h2>다가오는 일정</h2></div></div>
          <div className="timeline">
            ${upcoming.length ? upcoming.slice(0, 4).map((event) => html`<button onClick=${() => location.hash = `team/${event.team.teamId}/calendar`}><time><b>${new Date(`${event.date}T12:00:00`).getDate()}</b><small>${new Date(`${event.date}T12:00:00`).toLocaleString("ko-KR", { month: "short" })}</small></time><div><${Badge} tone=${event.type === "발표" || event.type === "제출" ? "warning" : "light"}>${event.type}</${Badge}><b>${event.title}</b><small>${event.time} · ${event.team.teamName}</small></div></button>`) : html`<${Empty} title="아직 등록된 일정이 없습니다." />`}
          </div>
        </section>

        <section className="panel notification-panel" id="notifications"><div className="panel-heading"><div><p className="eyebrow">NOTIFICATIONS</p><h2>최근 알림</h2></div>${unread.length > 0 && html`<button className="text-button" onClick=${async () => { const patches = {}; unread.forEach((item) => patches[`notifications/${user.id}/${item.notificationId}/isRead`] = true); await store.update(patches); }}>전체 읽음</button>`}</div>
          <div className="notification-list">
            ${myNotifications.length ? myNotifications.slice(0, 5).map((item) => html`<button className=${item.isRead ? "read" : ""} onClick=${async () => { await store.update({ [`notifications/${user.id}/${item.notificationId}/isRead`]: true }); location.hash = `team/${item.teamId}/${item.taskId ? "work" : "notifications"}`; }}><span>${item.senderName.slice(-2)}</span><div><p>${item.content}</p><small>${item.teamName} · ${relativeTime(item.createdAt)}</small></div>${!item.isRead && html`<i></i>`}</button>`) : html`<${Empty} title="아직 받은 알림이 없습니다." />`}
          </div>
        </section>
      </aside>
    </section>
    ${modal === "create" && html`<${CreateTeamModal} user=${user} onClose=${() => setModal("")} notify=${notify} />`}
    ${modal === "join" && html`<${JoinTeamModal} data=${data} user=${user} onClose=${() => setModal("")} notify=${notify} />`}
  </main>`;
}

function ChatTab({ team, user, search, notify }) {
  const endRef = useRef(null);
  const messages = sorted(team.messages).filter((item) => item.text.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);
  const submit = async (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.message;
    const text = input.value.trim();
    if (!text) return;
    const messageId = makeId("msg");
    const createdAt = nowIso();
    await store.update({
      [`teams/${team.teamId}/messages/${messageId}`]: { messageId, userId: user.id, userName: user.name, text, createdAt },
      [`teams/${team.teamId}/updatedAt`]: createdAt,
      [`teams/${team.teamId}/members/${user.id}/lastActive`]: createdAt,
    });
    input.value = "";
  };
  return html`<section className="tab-card chat-tab">
    <div className="tab-heading"><div><h2>팀 대화</h2><p>짧은 의견과 확인할 내용을 빠르게 나눠보세요.</p></div><span className="live-label"><i></i> 실시간</span></div>
    <div className="chat-date"><span>최근 대화</span></div>
    <div className="messages">
      ${messages.length ? messages.map((message) => html`<div className=${`message ${message.userId === user.id ? "mine" : ""}`} key=${message.messageId}>
        ${message.userId !== user.id && html`<span className="avatar">${message.userName.slice(-2)}</span>`}
        <div><small>${message.userId === user.id ? "나" : message.userName}</small><p>${message.text}</p><time>${formatDate(message.createdAt, true)}</time></div>
        ${(message.userId === user.id || team.createdBy === user.id) && html`<button className="message-delete" onClick=${async () => { await store.update({ [`teams/${team.teamId}/messages/${message.messageId}`]: null }); notify("메시지를 삭제했습니다.", "success"); }}>삭제</button>`}
      </div>`) : html`<${Empty} title=${search ? "검색 결과가 없습니다." : "아직 대화가 없습니다. 첫 메시지를 남겨보세요!"} />`}
      <div ref=${endRef}></div>
    </div>
    <form className="message-form" onSubmit=${submit}><input name="message" placeholder="팀원에게 메시지를 남겨보세요" autoComplete="off"/><button className="primary-button">전송</button></form>
  </section>`;
}

function FileModal({ team, user, target, onClose, notify }) {
  const [uploading, setUploading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const file = form.get("file");
    if (!title || !(file instanceof File) || !file.name) return notify("자료 제목과 파일을 선택해주세요.", "error");
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!allowedExtensions.includes(extension)) return notify("지원하지 않는 파일 형식입니다.", "error");
    if (file.size > 20 * 1024 * 1024) return notify("20MB 이하의 파일만 업로드할 수 있습니다.", "error");
    setUploading(true);
    try {
      const fileId = target?.fileId || makeId("file");
      const uploaded = await store.uploadFile(team.teamId, fileId, file);
      const updatedAt = nowIso();
      const version = (target?.version || 0) + 1;
      const patches = {
        [`teams/${team.teamId}/files/${fileId}/fileId`]: fileId,
        [`teams/${team.teamId}/files/${fileId}/teamId`]: team.teamId,
        [`teams/${team.teamId}/files/${fileId}/title`]: title,
        [`teams/${team.teamId}/files/${fileId}/fileName`]: uploaded.fileName,
        [`teams/${team.teamId}/files/${fileId}/fileType`]: uploaded.fileType,
        [`teams/${team.teamId}/files/${fileId}/fileSize`]: uploaded.fileSize,
        [`teams/${team.teamId}/files/${fileId}/fileUrl`]: uploaded.url,
        [`teams/${team.teamId}/files/${fileId}/uploadedBy`]: user.id,
        [`teams/${team.teamId}/files/${fileId}/uploadedByName`]: user.name,
        [`teams/${team.teamId}/files/${fileId}/version`]: version,
        [`teams/${team.teamId}/files/${fileId}/updatedAt`]: updatedAt,
        [`teams/${team.teamId}/updatedAt`]: updatedAt,
      };
      if (target) {
        const historyId = makeId("history");
        patches[`teams/${team.teamId}/files/${fileId}/history/${historyId}`] = {
          oldFileName: target.fileName, newFileName: uploaded.fileName, updatedBy: user.id,
          updatedByName: user.name, version, updatedAt,
        };
      } else {
        patches[`teams/${team.teamId}/files/${fileId}/history`] = {};
      }
      await store.update(patches);
      notify(target ? "파일이 업데이트되었습니다." : "자료를 업로드했습니다.", "success");
      onClose();
    } catch (error) {
      console.error(error);
      notify("파일 업로드에 실패했습니다. 다시 시도해주세요.", "error");
    } finally {
      setUploading(false);
    }
  };
  return html`<${Modal} title=${target ? "자료 업데이트" : "새 자료 올리기"} subtitle="같은 자료의 새 버전은 기존 카드에 이어서 기록됩니다." onClose=${onClose}>
    <form className="stack-form" onSubmit=${submit}>
      <${Field} label="자료 제목" name="title" defaultValue=${target?.title || ""} placeholder="예: 발표 PPT" required=${true}/>
      <${Field} label="파일 선택" name="file"><input name="file" type="file" accept=".pdf,.doc,.docx,.hwp,.hwpx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" required /></${Field}>
      <p className="form-note">PDF, Word, HWP, PowerPoint, 이미지, ZIP · 최대 20MB</p>
      <button className="primary-button" disabled=${uploading}>${uploading ? "업로드 중..." : target ? `v${target.version + 1}로 업데이트` : "자료 업로드"}</button>
    </form>
  </${Modal}>`;
}

function FilesTab({ team, user, search, notify }) {
  const [modal, setModal] = useState(null);
  const [history, setHistory] = useState(null);
  const files = sorted(team.files, "updatedAt").filter((file) => `${file.title} ${file.fileName}`.toLowerCase().includes(search.toLowerCase()));
  return html`<section className="tab-card files-tab">
    <div className="tab-heading"><div><h2>자료 최신본</h2><p>자료마다 최신 파일 하나만 보여주고 이전 버전은 기록으로 남겨요.</p></div><button className="primary-button small" onClick=${() => setModal({})}>+ 새 자료</button></div>
    <div className="file-grid">
      ${files.length ? files.map((file) => html`<article className="file-card">
        <div className="file-icon"><b>${file.fileType?.toUpperCase()}</b><span>FILE</span></div>
        <div className="file-card-body"><div className="file-title"><div><h3>${file.title}</h3><p>${file.fileName}</p></div><${Badge} tone="light">v${file.version}</${Badge}></div>
          <div className="file-info"><span>${fileSize(file.fileSize)}</span><span>${file.uploadedByName}</span><span>${relativeTime(file.updatedAt)}</span></div>
          <div className="file-actions">
            ${file.fileUrl ? html`<a className="outline-button small" href=${file.fileUrl} target="_blank" rel="noreferrer">다운로드</a>` : html`<button className="outline-button small" onClick=${() => notify("데모 모드에서는 파일 정보만 저장됩니다.", "info")}>파일 확인</button>`}
            <button className="outline-button small" onClick=${() => setModal(file)}>파일 업데이트</button>
            <button className="text-button" onClick=${() => setHistory(file)}>수정 기록 ${values(file.history).length}</button>
          </div>
        </div>
        ${team.createdBy === user.id && html`<button className="card-delete" onClick=${async () => { if (confirm("이 자료 항목을 삭제할까요?")) await store.update({ [`teams/${team.teamId}/files/${file.fileId}`]: null }); }}>×</button>`}
      </article>`) : html`<${Empty} title=${search ? "검색 결과가 없습니다." : "아직 업로드된 자료가 없습니다."} />`}
    </div>
    ${modal && html`<${FileModal} team=${team} user=${user} target=${modal.fileId ? modal : null} onClose=${() => setModal(null)} notify=${notify}/>`}
    ${history && html`<${Modal} title="수정 기록" subtitle=${history.title} onClose=${() => setHistory(null)}>
      <div className="history-list">${values(history.history).length ? sorted(history.history, "updatedAt").map((item) => html`<div><${Badge} tone="light">v${item.version}</${Badge}><p><b>${item.newFileName}</b><small>${item.oldFileName}에서 업데이트</small></p><span>${item.updatedByName}<small>${formatDate(item.updatedAt, true)}</small></span></div>`) : html`<${Empty} title="아직 수정 기록이 없습니다."/>`}</div>
    </${Modal}>`}
  </section>`;
}

function MembersTab({ team, user, search, notify }) {
  const members = values(team.members).filter((member) => member.name.toLowerCase().includes(search.toLowerCase()) || member.role.toLowerCase().includes(search.toLowerCase()));
  const changeRole = async (member, role) => {
    if (team.createdBy !== user.id && member.userId !== user.id) return notify("본인의 역할만 수정할 수 있습니다.", "error");
    await store.update({ [`teams/${team.teamId}/members/${member.userId}/role`]: role, [`teams/${team.teamId}/updatedAt`]: nowIso() });
    notify("역할을 수정했습니다.", "success");
  };
  return html`<section className="tab-card members-tab">
    <div className="tab-heading"><div><h2>팀원과 역할</h2><p>누가 무엇을 맡았는지, 진행 중인 일은 무엇인지 확인하세요.</p></div><${Badge} tone="light">${members.length}명 참여 중</${Badge}></div>
    <div className="member-grid">
      ${members.length ? members.map((member, index) => {
        const tasks = values(team.tasks).filter((task) => task.assigneeId === member.userId);
        const done = tasks.filter((task) => task.status === "완료").length;
        return html`<article className="member-card">
          <div className=${`member-avatar color-${index % 4}`}>${member.name.slice(-2)}${team.createdBy === member.userId && html`<i>방장</i>`}</div>
          <h3>${member.name}</h3><p>${member.role}</p>
          <div className="member-stats"><span><b>${tasks.length - done}</b> 진행 중</span><span><b>${done}</b> 완료</span></div>
          <div className="member-progress"><span><i style=${{ width: `${done / Math.max(1, tasks.length) * 100}%` }}></i></span><small>${tasks.length ? Math.round(done / tasks.length * 100) : 0}%</small></div>
          <label>역할 수정<input defaultValue=${member.role} onBlur=${(event) => event.target.value.trim() && event.target.value.trim() !== member.role && changeRole(member, event.target.value.trim())} disabled=${team.createdBy !== user.id && member.userId !== user.id}/></label>
          <small>마지막 활동 ${relativeTime(member.lastActive)}</small>
          ${team.createdBy === user.id && member.userId !== user.id && html`<button className="text-button danger-text" onClick=${async () => { if (!confirm(`${member.name}님을 내보낼까요?`)) return; await store.update({ [`teams/${team.teamId}/members/${member.userId}`]: null, [`users/${member.userId}/joinedTeams/${team.teamId}`]: null }); }}>팀원 내보내기</button>`}
        </article>`;
      }) : html`<${Empty} title="검색 결과가 없습니다."/>`}
    </div>
  </section>`;
}

function NotificationsTab({ data, team, user }) {
  const notifications = sorted(data.notifications?.[user.id]).filter((item) => item.teamId === team.teamId);
  const unread = notifications.filter((item) => !item.isRead);
  return html`<section className="tab-card notifications-tab">
    <div className="tab-heading"><div><h2>알림함</h2><p>나를 부른 팀원의 메시지와 자료 업데이트를 확인하세요.</p></div>${unread.length > 0 && html`<button className="outline-button small" onClick=${async () => { const patches = {}; unread.forEach((item) => patches[`notifications/${user.id}/${item.notificationId}/isRead`] = true); await store.update(patches); }}>전체 읽음</button>`}</div>
    <div className="full-notification-list">
      ${notifications.length ? notifications.map((item) => html`<button className=${item.isRead ? "read" : ""} onClick=${async () => { await store.update({ [`notifications/${user.id}/${item.notificationId}/isRead`]: true }); if (item.taskId) location.hash = `team/${team.teamId}/work`; }}><span className="avatar">${item.senderName.slice(-2)}</span><div><p>${item.content}</p><small>${item.senderName} · ${formatDate(item.createdAt, true)}</small></div><${Badge} tone=${item.isRead ? "neutral" : "primary"}>${item.isRead ? "읽음" : "새 알림"}</${Badge}></button>`) : html`<${Empty} title="아직 받은 알림이 없습니다." />`}
    </div>
  </section>`;
}

function TaskModal({ team, target, onClose, notify }) {
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const assigneeId = String(form.get("assigneeId"));
    const member = team.members[assigneeId];
    const taskId = target?.taskId || makeId("task");
    const task = {
      taskId,
      title: String(form.get("title") || "").trim(),
      assigneeId,
      assigneeName: member.name,
      dueDate: String(form.get("dueDate") || ""),
      status: String(form.get("status") || "진행 전"),
      material: String(form.get("material") || "").trim(),
      memo: String(form.get("memo") || "").trim(),
      createdAt: target?.createdAt || nowIso(),
    };
    if (!task.title || !task.dueDate) return notify("할 일 내용과 마감일을 입력해주세요.", "error");
    await store.update({ [`teams/${team.teamId}/tasks/${taskId}`]: task, [`teams/${team.teamId}/updatedAt`]: nowIso() });
    notify(target ? "할 일을 수정했습니다." : "할 일을 추가했습니다.", "success");
    onClose();
  };
  return html`<${Modal} title=${target ? "할 일 수정" : "새 할 일 추가"} onClose=${onClose}>
    <form className="grid-form" onSubmit=${submit}>
      <${Field} label="할 일 내용" name="title" defaultValue=${target?.title || ""} placeholder="예: PPT 초안 만들기" required=${true}/>
      <${Field} label="담당자" name="assigneeId"><select name="assigneeId" defaultValue=${target?.assigneeId || Object.keys(team.members)[0]}>${values(team.members).map((member) => html`<option value=${member.userId}>${member.name} · ${member.role}</option>`)}</select></${Field}>
      <${Field} label="마감일" name="dueDate" type="date" defaultValue=${target?.dueDate || addDays(3)} required=${true}/>
      <${Field} label="진행 상태" name="status"><select name="status" defaultValue=${target?.status || "진행 전"}><option>진행 전</option><option>진행 중</option><option>완료</option></select></${Field}>
      <${Field} label="관련 자료" name="material" defaultValue=${target?.material || ""} placeholder="예: 발표 PPT"/>
      <${Field} label="메모" name="memo" defaultValue=${target?.memo || ""} placeholder="참고할 내용"/>
      <div className="form-actions"><button type="button" className="outline-button" onClick=${onClose}>취소</button><button className="primary-button">저장하기</button></div>
    </form>
  </${Modal}>`;
}

function MinuteModal({ team, user, onClose, notify }) {
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const minuteId = makeId("minute");
    const stamp = nowIso();
    const minute = { minuteId, date: String(form.get("date")), topic: String(form.get("topic") || "").trim(), attendees: String(form.get("attendees") || "").trim(), content: String(form.get("content") || "").trim(), decisions: String(form.get("decisions") || "").trim(), nextMeeting: String(form.get("nextMeeting") || ""), authorId: user.id, authorName: user.name, createdAt: stamp, updatedAt: stamp };
    if (!minute.topic || !minute.content) return notify("회의 주제와 내용을 입력해주세요.", "error");
    await store.update({ [`teams/${team.teamId}/minutes/${minuteId}`]: minute, [`teams/${team.teamId}/updatedAt`]: stamp });
    notify("회의록을 저장했습니다.", "success");
    onClose();
  };
  return html`<${Modal} title="회의록 작성" subtitle="결정 사항과 다음 행동을 명확하게 기록해보세요." onClose=${onClose} wide=${true}>
    <form className="grid-form two-columns" onSubmit=${submit}>
      <${Field} label="회의 날짜" name="date" type="date" defaultValue=${addDays(0)} required=${true}/>
      <${Field} label="회의 주제" name="topic" placeholder="회의 주제" required=${true}/>
      <${Field} label="참석자" name="attendees" defaultValue=${values(team.members).map((m) => m.name).join(", ")} />
      <${Field} label="다음 회의 일정" name="nextMeeting" type="datetime-local" />
      <label className="field full"><span>회의 내용 *</span><textarea name="content" rows="5" placeholder="논의한 내용을 정리하세요" required></textarea></label>
      <label className="field full"><span>결정 사항</span><textarea name="decisions" rows="3" placeholder="결정된 내용을 항목별로 정리하세요"></textarea></label>
      <div className="form-actions full"><button type="button" className="outline-button" onClick=${onClose}>취소</button><button className="primary-button">회의록 저장</button></div>
    </form>
  </${Modal}>`;
}

function WorkTab({ team, user, search, notify }) {
  const [view, setView] = useState("tasks");
  const [taskModal, setTaskModal] = useState(null);
  const [minuteModal, setMinuteModal] = useState(false);
  const [openMinute, setOpenMinute] = useState(null);
  const tasks = sorted(team.tasks, "dueDate", "asc").filter((task) => `${task.title} ${task.assigneeName} ${task.memo}`.toLowerCase().includes(search.toLowerCase()));
  const minutes = sorted(team.minutes, "date").filter((minute) => `${minute.topic} ${minute.content} ${minute.decisions}`.toLowerCase().includes(search.toLowerCase()));
  const callMember = async (task) => {
    if (task.status === "완료") return;
    if (task.lastPingAt && Date.now() - new Date(task.lastPingAt).getTime() < 600000) return notify("이미 최근에 부르기 알림을 보냈습니다.", "error");
    const notificationId = makeId("notification");
    const createdAt = nowIso();
    await store.update({
      [`notifications/${task.assigneeId}/${notificationId}`]: { notificationId, senderId: user.id, senderName: user.name, content: `${task.assigneeName}님, '${task.title}' 할 일을 확인해주세요.`, teamId: team.teamId, teamName: team.teamName, taskId: task.taskId, createdAt, isRead: false },
      [`teams/${team.teamId}/tasks/${task.taskId}/lastPingAt`]: createdAt,
    });
    notify(`${task.assigneeName}님에게 부르기 알림을 보냈습니다.`, "success");
  };
  return html`<section className="tab-card work-tab">
    <div className="tab-heading work-heading"><div className="work-switch"><button className=${view === "tasks" ? "active" : ""} onClick=${() => setView("tasks")}>할 일 <b>${values(team.tasks).filter((t) => t.status !== "완료").length}</b></button><button className=${view === "minutes" ? "active" : ""} onClick=${() => setView("minutes")}>회의록 <b>${values(team.minutes).length}</b></button></div><button className="primary-button small" onClick=${() => view === "tasks" ? setTaskModal({}) : setMinuteModal(true)}>+ ${view === "tasks" ? "할 일 추가" : "회의록 작성"}</button></div>
    ${view === "tasks" ? html`<div className="task-board">
      ${["진행 전", "진행 중", "완료"].map((status) => html`<section className=${`task-column status-${status.replace(" ", "")}`}><header><h3>${status}</h3><span>${tasks.filter((task) => task.status === status).length}</span></header><div>
        ${tasks.filter((task) => task.status === status).map((task) => { const due = dueMeta(task.dueDate, task.status); return html`<article className="task-card"><div className="task-card-top"><${Badge} tone=${due.tone}>${due.text}</${Badge}><button onClick=${() => setTaskModal(task)}>수정</button></div><h4>${task.title}</h4>${task.memo && html`<p>${task.memo}</p>`}<div className="task-assignee"><span>${task.assigneeName.slice(-2)}</span><div><b>${task.assigneeName}</b><small>${task.material || "관련 자료 없음"}</small></div></div><div className="task-card-foot"><select value=${task.status} onChange=${async (event) => await store.update({ [`teams/${team.teamId}/tasks/${task.taskId}/status`]: event.target.value, [`teams/${team.teamId}/updatedAt`]: nowIso() })}><option>진행 전</option><option>진행 중</option><option>완료</option></select>${task.status !== "완료" && html`<button className="call-button" onClick=${() => callMember(task)}>부르기</button>`}<button className="delete-text" onClick=${async () => { if (confirm("이 할 일을 삭제할까요?")) await store.update({ [`teams/${team.teamId}/tasks/${task.taskId}`]: null }); }}>삭제</button></div></article>`; })}
        ${!tasks.some((task) => task.status === status) && html`<p className="column-empty">해당하는 할 일이 없어요.</p>`}
      </div></section>`)}
      ${!tasks.length && search && html`<${Empty} title="검색 결과가 없습니다."/>`}
    </div>` : html`<div className="minute-list">
      ${minutes.length ? minutes.map((minute) => html`<article className="minute-card" onClick=${() => setOpenMinute(minute)}><time><b>${new Date(`${minute.date}T12:00:00`).getDate()}</b><span>${new Date(`${minute.date}T12:00:00`).toLocaleString("ko-KR", { month: "short" })}</span></time><div><h3>${minute.topic}</h3><p>${minute.decisions || minute.content}</p><div><span>참석 ${minute.attendees}</span><span>${minute.authorName} 작성</span></div></div><b>상세 보기 →</b></article>`) : html`<${Empty} title=${search ? "검색 결과가 없습니다." : "아직 작성된 회의록이 없습니다."}/>`}
    </div>`}
    ${taskModal && html`<${TaskModal} team=${team} target=${taskModal.taskId ? taskModal : null} onClose=${() => setTaskModal(null)} notify=${notify}/>`}
    ${minuteModal && html`<${MinuteModal} team=${team} user=${user} onClose=${() => setMinuteModal(false)} notify=${notify}/>`}
    ${openMinute && html`<${Modal} title=${openMinute.topic} subtitle=${`${formatDate(openMinute.date)} · ${openMinute.authorName} 작성`} onClose=${() => setOpenMinute(null)} wide=${true}><div className="minute-detail"><section><span>참석자</span><p>${openMinute.attendees}</p></section><section><span>회의 내용</span><p>${openMinute.content}</p></section><section><span>결정 사항</span><p>${openMinute.decisions || "기록된 결정 사항이 없습니다."}</p></section><section><span>다음 회의</span><p>${openMinute.nextMeeting ? formatDate(openMinute.nextMeeting, true) : "미정"}</p></section>${(openMinute.authorId === user.id || team.createdBy === user.id) && html`<button className="outline-button danger" onClick=${async () => { await store.update({ [`teams/${team.teamId}/minutes/${openMinute.minuteId}`]: null }); setOpenMinute(null); }}>회의록 삭제</button>`}</div></${Modal}>`}
  </section>`;
}

function EventModal({ team, user, onClose, notify }) {
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const eventId = makeId("event");
    const createdAt = nowIso();
    const item = { eventId, title: String(form.get("title") || "").trim(), type: String(form.get("type")), date: String(form.get("date")), time: String(form.get("time")), place: String(form.get("place") || "").trim(), description: String(form.get("description") || "").trim(), authorId: user.id, authorName: user.name, createdAt };
    if (!item.title || !item.date) return notify("일정 제목과 날짜를 입력해주세요.", "error");
    await store.update({ [`teams/${team.teamId}/events/${eventId}`]: item, [`teams/${team.teamId}/updatedAt`]: createdAt });
    notify("일정을 등록했습니다.", "success"); onClose();
  };
  return html`<${Modal} title="새 일정 등록" onClose=${onClose}><form className="grid-form" onSubmit=${submit}><${Field} label="일정 제목" name="title" placeholder="예: 중간 점검 회의" required=${true}/><${Field} label="일정 종류" name="type"><select name="type"><option>회의</option><option>발표</option><option>제출</option><option>기타</option></select></${Field}><${Field} label="날짜" name="date" type="date" defaultValue=${addDays(1)} required=${true}/><${Field} label="시간" name="time" type="time" defaultValue="19:00"/><${Field} label="장소" name="place" placeholder="예: 중앙도서관 3층"/><${Field} label="설명" name="description" placeholder="준비할 내용"/><div className="form-actions"><button type="button" className="outline-button" onClick=${onClose}>취소</button><button className="primary-button">일정 등록</button></div></form></${Modal}>`;
}

function CalendarTab({ team, user, search, notify }) {
  const [modal, setModal] = useState(false);
  const events = sorted(team.events, "date", "asc").filter((item) => `${item.title} ${item.type} ${item.place}`.toLowerCase().includes(search.toLowerCase()));
  const current = new Date();
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const start = new Date(first); start.setDate(first.getDate() - first.getDay());
  const cells = Array.from({ length: 35 }, (_, index) => { const d = new Date(start); d.setDate(start.getDate() + index); return d; });
  return html`<section className="tab-card calendar-tab"><div className="tab-heading"><div><h2>팀플 캘린더</h2><p>회의, 발표, 제출 일정을 한눈에 확인하세요.</p></div><button className="primary-button small" onClick=${() => setModal(true)}>+ 일정 등록</button></div>
    <div className="calendar-layout"><div className="calendar"><header><button disabled>‹</button><h3>${current.getFullYear()}년 ${current.getMonth() + 1}월</h3><button disabled>›</button></header><div className="weekdays">${["일", "월", "화", "수", "목", "금", "토"].map((day) => html`<span>${day}</span>`)}</div><div className="calendar-grid">${cells.map((date) => { const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; const dayEvents = values(team.events).filter((event) => event.date === key); const today = key === addDays(0); return html`<div className=${`${date.getMonth() !== current.getMonth() ? "muted" : ""} ${today ? "today" : ""}`}><b>${date.getDate()}</b>${dayEvents.slice(0, 2).map((event) => html`<span className=${`event-${event.type}`}>${event.title}</span>`)}</div>`; })}</div></div>
      <aside className="event-list"><h3>다가오는 일정</h3>${events.length ? events.map((event) => html`<article><time><b>${new Date(`${event.date}T12:00:00`).getDate()}</b><small>${new Date(`${event.date}T12:00:00`).toLocaleString("ko-KR", { month: "short" })}</small></time><div><${Badge} tone=${event.type === "발표" || event.type === "제출" ? "warning" : "light"}>${event.type}</${Badge}><h4>${event.title}</h4><p>${event.time || "시간 미정"}${event.place ? ` · ${event.place}` : ""}</p><small>${event.description}</small></div>${(event.authorId === user.id || team.createdBy === user.id) && html`<button onClick=${async () => { if (confirm("일정을 삭제할까요?")) await store.update({ [`teams/${team.teamId}/events/${event.eventId}`]: null }); }}>×</button>`}</article>`) : html`<${Empty} title=${search ? "검색 결과가 없습니다." : "아직 등록된 일정이 없습니다."}/>`}</aside>
    </div>${modal && html`<${EventModal} team=${team} user=${user} onClose=${() => setModal(false)} notify=${notify}/>`}</section>`;
}

const tabs = [
  ["chat", "대화창"], ["files", "자료창"], ["members", "팀원정보"],
  ["notifications", "알림함"], ["work", "회의록 / 할 일"], ["calendar", "캘린더"],
];

function TeamRoom({ data, user, teamId, initialTab, notify }) {
  const team = data.teams?.[teamId];
  const [tab, setTab] = useState(initialTab || "chat");
  const [search, setSearch] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  if (!team || !team.members?.[user.id]) return html`<main className="page"><${Empty} title="접근할 수 없는 팀플방입니다." detail="Team ID와 참여 여부를 확인해주세요."/><button className="primary-button centered" onClick=${() => location.hash = "home"}>내 팀플 홈으로</button></main>`;
  const member = team.members[user.id];
  const copy = async (text, message) => { await navigator.clipboard.writeText(text); notify(message, "success"); };
  const selectTab = (next) => { setTab(next); setSearch(""); location.hash = `team/${team.teamId}/${next}`; };
  const deleteTeam = async () => {
    if (team.createdBy !== user.id) return notify("방장만 삭제할 수 있습니다.", "error");
    if (!confirm("팀플방과 모든 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    const patches = { [`teams/${team.teamId}`]: null };
    values(team.members).forEach((item) => patches[`users/${item.userId}/joinedTeams/${team.teamId}`] = null);
    await store.update(patches); location.hash = "home";
  };
  return html`<main className="team-page">
    <section className="team-hero"><div className="page team-hero-inner"><button className="back-link" onClick=${() => location.hash = "home"}>← 내 팀플 홈</button><div className="team-title-row"><div><span className="subject-label">${team.subjectName}</span><h1>${team.teamName}</h1><div className="team-quick-meta"><span>마감 ${formatDate(team.dueDate)}</span><span>팀원 ${values(team.members).length}명</span><span>${member.role}</span>${team.createdBy === user.id && html`<${Badge} tone="primary">방장</${Badge}>`}</div></div><div className="team-share"><button className="outline-button" onClick=${() => copy(team.teamId, "Team ID를 복사했습니다.")}>ID ${team.teamId}</button><button className="outline-button" onClick=${() => copy(`${location.origin}${location.pathname}#team/${team.teamId}`, "공유 링크를 복사했습니다.")}>공유 링크</button><button className="icon-button" onClick=${() => setShowMenu(!showMenu)}>···</button>${showMenu && html`<div className="action-menu"><button onClick=${() => copy(team.inviteCode, "초대코드를 복사했습니다.")}>초대코드 복사</button><button className="danger-text" onClick=${deleteTeam}>팀플방 삭제</button></div>`}</div></div></div></section>
    <div className="team-nav-wrap"><div className="page team-nav"><nav>${tabs.map(([id, label]) => html`<button className=${tab === id ? "active" : ""} onClick=${() => selectTab(id)}>${label}${id === "notifications" && values(data.notifications?.[user.id]).filter((n) => n.teamId === team.teamId && !n.isRead).length > 0 && html`<b>${values(data.notifications?.[user.id]).filter((n) => n.teamId === team.teamId && !n.isRead).length}</b>`}</button>`)}</nav><label className="team-search"><span>검색</span><input value=${search} onChange=${(event) => setSearch(event.target.value)} placeholder="대화, 할 일, 자료 검색"/></label></div></div>
    <div className="page tab-content">
      ${tab === "chat" && html`<${ChatTab} team=${team} user=${user} search=${search} notify=${notify}/>`}
      ${tab === "files" && html`<${FilesTab} team=${team} user=${user} search=${search} notify=${notify}/>`}
      ${tab === "members" && html`<${MembersTab} team=${team} user=${user} search=${search} notify=${notify}/>`}
      ${tab === "notifications" && html`<${NotificationsTab} data=${data} team=${team} user=${user}/>`}
      ${tab === "work" && html`<${WorkTab} team=${team} user=${user} search=${search} notify=${notify}/>`}
      ${tab === "calendar" && html`<${CalendarTab} team=${team} user=${user} search=${search} notify=${notify}/>`}
    </div>
  </main>`;
}

function App() {
  const [data, setData] = useState({ users: {}, teams: {}, notifications: {} });
  const [session, setSession] = useState(() => localStorage.getItem(SESSION_KEY) || "");
  const [route, setRoute] = useState(() => location.hash.slice(1) || "home");
  const [toast, setToast] = useState(null);
  useEffect(() => store.subscribe(setData), []);
  useEffect(() => { const handler = () => setRoute(location.hash.slice(1) || "home"); addEventListener("hashchange", handler); return () => removeEventListener("hashchange", handler); }, []);
  const notify = (message, tone = "info") => { setToast({ message, tone }); clearTimeout(window.__teamplogToast); window.__teamplogToast = setTimeout(() => setToast(null), 3200); };
  const login = (id) => { localStorage.setItem(SESSION_KEY, id); setSession(id); location.hash = "home"; };
  const logout = () => { localStorage.removeItem(SESSION_KEY); setSession(""); location.hash = "home"; notify("로그아웃했습니다.", "success"); };
  const user = data.users?.[session];
  if (!session || !user) return html`<div><${AuthScreen} data=${data} onLogin=${login} notify=${notify}/><${Toast} toast=${toast}/></div>`;
  const parts = route.split("/");
  const isTeam = parts[0] === "team";
  return html`<div className="app-shell"><${Header} user=${user} notifications=${data.notifications?.[user.id]} onLogout=${logout} onHome=${() => location.hash = "home"} inTeam=${isTeam}/>${isTeam ? html`<${TeamRoom} data=${data} user=${user} teamId=${parts[1]} initialTab=${parts[2]} notify=${notify}/>` : html`<${Dashboard} data=${data} user=${user} notify=${notify}/>`}<${Toast} toast=${toast}/></div>`;
}

createRoot(document.getElementById("root")).render(html`<${App}/>`);
