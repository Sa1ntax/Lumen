const tracks = [
  { id: "weightless", title: "Weightless", artist: "Marconi Union", art: "art/cabin.jpg", duration: 484 },
  { id: "echoes", title: "Echoes of Silence", artist: "Lucid Atlas", art: "art/ridge.jpg", duration: 312 },
  { id: "horizon", title: "Beyond the Horizon", artist: "Northlight", art: "art/peak.jpg", duration: 267 },
  { id: "midnight", title: "Midnight Echoes", artist: "Solaris", art: "art/beam.jpg", duration: 238 },
];

const notices = [
  { app: "Почта", title: "Макет утвердили", body: "Анна оставила комментарий к экрану острова." },
  { app: "Календарь", title: "Дизайн-ревью", body: "Через 15 минут · переговорная 4." },
  { app: "Сборки", title: "Сборка прошла", body: "Lumen 0.3 готов к просмотру." },
];

const state = {
  trackIndex: 0,
  hasSession: true,
  playing: true,
  progress: 72,
  volume: 0.68,
  volumeBeforeMute: 0.68,
  liked: { weightless: true },
  hover: false,
  pinned: false,
  notice: null,
  noticeUntil: 0,
  noticeCursor: 0,
  timerLeft: null,
  game: false,
  cpu: 14,
  mem: 37,
  fps: 141,
  toggles: { wifi: true, bluetooth: true, focus: false, night: false },
  systemLive: false,
  systemTitle: "",
  systemArtist: "",
  systemSource: "",
  systemArt: "",
  systemDuration: 0,
};

const svg = {
  play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
  prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 20 9 12 19 4zM5 19V5"/></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 4 10 8-10 8zM19 5v14"/></svg>',
  vol: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4zM16 9a5 5 0 0 1 0 6"/></svg>',
  mute: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/></svg>',
  heart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A4.5 4.5 0 0 0 17.5 4 4.7 4.7 0 0 0 12 6.4 4.7 4.7 0 0 0 6.5 4 4.5 4.5 0 0 0 2 8.5C2 10.8 3.5 12.5 5 14l7 7z"/></svg>',
  heartOn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A4.5 4.5 0 0 0 17.5 4 4.7 4.7 0 0 0 12 6.4 4.7 4.7 0 0 0 6.5 4 4.5 4.5 0 0 0 2 8.5C2 10.8 3.5 12.5 5 14l7 7z"/></svg>',
  bell: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/></svg>',
  wifi: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M2 8.8a16 16 0 0 1 20 0"/></svg>',
  bt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a7 7 0 1 0 9 9 9 9 0 1 1-9-9z"/></svg>',
  timer: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
};

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function track() {
  if (state.systemLive) {
    return {
      id: "system",
      title: state.systemTitle || "Без названия",
      artist: state.systemArtist || state.systemSource || "Сейчас играет",
      art: state.systemArt || tracks[0].art,
      duration: Math.max(1, state.systemDuration || 1),
    };
  }
  return tracks[state.trackIndex];
}

function shape() {
  const base = state.game
    ? "game"
    : state.notice
      ? "notice"
      : state.timerLeft != null && !state.hasSession
        ? "timer"
        : state.hasSession
          ? "media"
          : state.timerLeft != null
            ? "timer"
            : "idle";
  const canExpand = base === "media" || base === "idle" || base === "timer";
  return (state.hover || state.pinned) && canExpand ? "expanded" : base;
}

function slider(label, ratio) {
  const pct = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
  return `<input class="slider" data-slider="${label}" aria-label="${label}" type="range" min="0" max="1000" value="${Math.round(ratio * 1000)}" style="--fill:${pct}" />`;
}

function view() {
  const t = track();
  const liked = Boolean(state.liked[t.id]);
  const s = shape();
  const on = (name) => (s === name ? "layer on" : "layer");
  return `
    <div class="island" data-shape="${s}" role="group" aria-label="Lumen">
      <div class="layers">
        <div class="${on("idle")}">
          <div class="idle-row"><span class="dot"></span><span class="idle-label">Тишина</span><span class="meta">100%</span></div>
        </div>
        <div class="${on("media")}">
          <div class="pad">
            <img class="art" src="${t.art}" alt="" />
            <div class="grow">
              <h2 class="title">${t.title}</h2>
              <p class="sub">${t.artist}</p>
              ${slider("seek", state.progress / t.duration)}
            </div>
            <button class="icon-btn" data-act="play" aria-label="Играть">${state.playing ? svg.pause : svg.play}</button>
            <button class="icon-btn" data-act="mute" aria-label="Громкость">${state.volume === 0 ? svg.mute : svg.vol}</button>
          </div>
        </div>
        <div class="${on("notice")}">
          <div class="notice-row">
            <span class="badge">${svg.bell}</span>
            <div class="grow">
              <h2 class="title">${state.notice ? state.notice.title : ""}</h2>
              <p class="sub">${state.notice ? `${state.notice.app} · ${state.notice.body}` : ""}</p>
            </div>
          </div>
        </div>
        <div class="${on("timer")}">
          <div class="timer-row">
            <span class="badge">${svg.timer}</span>
            <div class="grow">
              <h2 class="title">${formatTime(state.timerLeft || 0)}</h2>
              <p class="sub">Фокус · 25 минут</p>
            </div>
          </div>
        </div>
        <div class="${on("game")}">
          <div class="game-row">
            <span class="meta">FPS ${state.fps}</span>
            <span class="meta">CPU ${Math.round(state.cpu)}%</span>
            <span class="meta">RAM ${Math.round(state.mem)}%</span>
          </div>
        </div>
        <div class="${on("expanded")}">
          <div class="expanded">
            <div class="exp-main">
              <img class="art-lg" src="${t.art}" alt="" />
              <div class="grow">
                <div class="transport">
                  <div class="grow">
                    <h2 class="title">${state.hasSession ? t.title : "Ничего не играет"}</h2>
                    <p class="sub">${state.hasSession ? t.artist : "Включите трек"}</p>
                  </div>
                  <button class="icon-btn ${liked ? "on" : ""}" data-act="like" aria-label="Нравится">${liked ? svg.heartOn : svg.heart}</button>
                  ${state.timerLeft != null ? `<span class="chip">${formatTime(state.timerLeft)}</span>` : ""}
                </div>
                ${slider("seek", state.hasSession ? state.progress / t.duration : 0)}
                <div class="times"><span>${formatTime(state.hasSession ? state.progress : 0)}</span><span>${formatTime(t.duration)}</span></div>
                <div class="transport">
                  <button class="icon-btn" data-act="prev" aria-label="Предыдущий">${svg.prev}</button>
                  <button class="icon-btn play-btn" data-act="play" aria-label="Играть">${state.playing && state.hasSession ? svg.pause : svg.play}</button>
                  <button class="icon-btn" data-act="next" aria-label="Следующий">${svg.next}</button>
                </div>
              </div>
            </div>
            <div class="exp-side">
              <div class="mini"><span>${svg.vol}</span><div class="grow"><p class="title" style="font-size:0.8rem">Динамики</p><p class="sub">Подключены</p></div></div>
              <div class="mini">
                <button class="icon-btn" data-act="mute" aria-label="Без звука">${state.volume === 0 ? svg.mute : svg.vol}</button>
                <div class="grow">${slider("volume", state.volume)}</div>
              </div>
              <div class="toggles">
                <button class="icon-btn ${state.toggles.wifi ? "on" : ""}" data-act="wifi">${svg.wifi}</button>
                <button class="icon-btn ${state.toggles.bluetooth ? "on" : ""}" data-act="bluetooth">${svg.bt}</button>
                <button class="icon-btn ${state.toggles.focus ? "on" : ""}" data-act="focus">${svg.bell}</button>
                <button class="icon-btn ${state.toggles.night ? "on" : ""}" data-act="night">${svg.moon}</button>
              </div>
              <div class="stat"><span>CPU</span><div class="bar"><span style="width:${Math.round(state.cpu)}%"></span></div><span>${Math.round(state.cpu)}%</span></div>
              <div class="stat"><span>Память</span><div class="bar"><span style="width:${Math.round(state.mem)}%"></span></div><span>${Math.round(state.mem)}%</span></div>
              <div class="extra">
                <button data-act="notice">Уведомление</button>
                <button data-act="timer">${state.timerLeft != null ? "Сбросить фокус" : "Фокус 25:00"}</button>
                <button data-act="game">${state.game ? "Выйти из игры" : "Игра"}</button>
                <button data-act="silence">Тишина</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

const root = document.getElementById("root");
let signature = "";

function signatureNow() {
  const t = track();
  return [
    shape(),
    t.id,
    t.title,
    (t.art || "").length,
    state.playing,
    state.volume === 0,
    state.liked[t.id],
    state.notice && state.notice.title,
    state.timerLeft != null,
    state.game,
    state.toggles.wifi,
    state.toggles.bluetooth,
    state.toggles.focus,
    state.toggles.night,
    state.hasSession,
  ].join("|");
}

function bind() {
  const island = root.querySelector(".island");
  island.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") state.hover = true;
    paint(true);
  });
  island.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") state.hover = false;
    paint(true);
  });
  island.addEventListener("click", (event) => {
    const target = event.target;
    if (target.closest("button, input")) return;
    if (state.notice) state.notice = null;
    else if (state.game) state.game = false;
    else state.pinned = !state.pinned;
    paint(true);
  });
  root.querySelectorAll("[data-act]").forEach((button) => {
    button.addEventListener("click", () => act(button.getAttribute("data-act")));
  });
  root.querySelectorAll("[data-slider]").forEach((input) => {
    input.addEventListener("input", () => {
      const ratio = Number(input.value) / 1000;
      input.style.setProperty("--fill", `${Math.round(ratio * 100)}%`);
      if (input.getAttribute("data-slider") === "volume") {
        state.volume = ratio;
        if (ratio > 0) state.volumeBeforeMute = ratio;
      } else if (state.systemLive && window.lumen && window.lumen.command) {
        state.progress = ratio * track().duration;
        window.lumen.command("seek", state.progress);
      } else {
        state.hasSession = true;
        state.progress = ratio * track().duration;
      }
    });
  });
}

function act(name) {
  const t = track();
  const system = state.systemLive && window.lumen && window.lumen.command;
  if (name === "play") {
    if (system) window.lumen.command("play");
    else {
      state.hasSession = true;
      state.playing = !state.playing;
    }
    state.game = false;
  } else if (name === "prev") {
    if (system) window.lumen.command("prev");
    else {
      state.hasSession = true;
      state.playing = true;
      if (state.progress > 3) state.progress = 0;
      else {
        state.trackIndex = (state.trackIndex - 1 + tracks.length) % tracks.length;
        state.progress = 0;
      }
    }
  } else if (name === "next") {
    if (system) window.lumen.command("next");
    else {
      state.trackIndex = (state.trackIndex + 1) % tracks.length;
      state.progress = 0;
      state.hasSession = true;
      state.playing = true;
    }
  } else if (name === "mute") {
    if (state.volume > 0) {
      state.volumeBeforeMute = state.volume;
      state.volume = 0;
    } else state.volume = state.volumeBeforeMute || 0.6;
  } else if (name === "like") {
    state.liked[t.id] = !state.liked[t.id];
  } else if (name === "wifi" || name === "bluetooth" || name === "focus" || name === "night") {
    state.toggles[name] = !state.toggles[name];
  } else if (name === "notice") {
    const item = notices[state.noticeCursor % notices.length];
    state.noticeCursor += 1;
    state.notice = item;
    state.noticeUntil = performance.now() + 4600;
    state.game = false;
  } else if (name === "timer") {
    state.timerLeft = state.timerLeft != null ? null : 25 * 60;
    state.game = false;
  } else if (name === "game") {
    state.game = !state.game;
    state.notice = null;
    state.pinned = false;
    state.hover = false;
  } else if (name === "silence") {
    state.hasSession = false;
    state.playing = false;
    state.progress = 0;
    state.pinned = false;
  }
  paint(true);
}

function updateLive() {
  const t = track();
  root.querySelectorAll('[data-slider="seek"]').forEach((input) => {
    if (document.activeElement === input) return;
    const ratio = state.hasSession ? state.progress / t.duration : 0;
    input.value = String(Math.round(ratio * 1000));
    input.style.setProperty("--fill", `${Math.round(ratio * 100)}%`);
  });
  root.querySelectorAll(".times span:first-child").forEach((node) => {
    node.textContent = formatTime(state.hasSession ? state.progress : 0);
  });
  const timerTitle = root.querySelector(".timer-row .title");
  if (timerTitle && state.timerLeft != null) timerTitle.textContent = formatTime(state.timerLeft);
  const chip = root.querySelector(".chip");
  if (chip && state.timerLeft != null) chip.textContent = formatTime(state.timerLeft);
  root.querySelectorAll(".stat").forEach((row, index) => {
    const value = index === 0 ? state.cpu : state.mem;
    const bar = row.querySelector(".bar > span");
    const label = row.querySelector("span:last-child");
    if (bar) bar.style.width = `${Math.round(value)}%`;
    if (label) label.textContent = `${Math.round(value)}%`;
  });
  const game = root.querySelector(".game-row");
  if (game && state.game) {
    const bits = game.querySelectorAll(".meta");
    if (bits[0]) bits[0].textContent = `FPS ${state.fps}`;
    if (bits[1]) bits[1].textContent = `CPU ${Math.round(state.cpu)}%`;
    if (bits[2]) bits[2].textContent = `RAM ${Math.round(state.mem)}%`;
  }
}

function paint(force) {
  const next = signatureNow();
  if (force || next !== signature) {
    signature = next;
    root.innerHTML = view();
    bind();
  } else updateLive();
  const island = root.querySelector(".island");
  if (island && window.lumen) {
    const rect = island.getBoundingClientRect();
    const over = state.hover || state.pinned;
    window.lumen.setInteractive(over || rect.width > 0 && state.hover);
  }
}

document.addEventListener("mousemove", (event) => {
  const island = root.querySelector(".island");
  if (!island || !window.lumen) return;
  const rect = island.getBoundingClientRect();
  const over =
    event.clientX >= rect.left - 6 &&
    event.clientX <= rect.right + 6 &&
    event.clientY >= rect.top - 6 &&
    event.clientY <= rect.bottom + 6;
  window.lumen.setInteractive(over);
});

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (state.playing && state.hasSession && !state.game && !state.systemLive) {
    state.progress += dt;
    if (state.progress >= track().duration) {
      state.trackIndex = (state.trackIndex + 1) % tracks.length;
      state.progress = 0;
    }
  }
  if (state.timerLeft != null) {
    state.timerLeft = Math.max(0, state.timerLeft - dt);
    if (state.timerLeft === 0) {
      state.timerLeft = null;
      state.notice = { app: "Фокус", title: "25 минут прошли", body: "Можно встать и размяться." };
      state.noticeUntil = now + 4600;
    }
  }
  if (state.notice && state.noticeUntil && now > state.noticeUntil) state.notice = null;
  const drift = (value, min, max) => Math.min(max, Math.max(min, value + (Math.random() - 0.48) * dt * 8));
  state.cpu = drift(state.cpu, 6, 42);
  state.mem = drift(state.mem, 28, 64);
  state.fps = Math.round(drift(state.fps, 96, 144));
  paint(false);
  requestAnimationFrame(tick);
}

paint(true);
requestAnimationFrame(tick);

if (window.lumen && window.lumen.onMedia) {
  window.lumen.onMedia((data) => {
    const was = state.systemLive;
    state.systemLive = Boolean(data && data.live);
    if (!state.systemLive) {
      if (was) paint(true);
      return;
    }
    const nextArt = data.art || state.systemArt;
    const changed =
      data.title !== state.systemTitle ||
      data.artist !== state.systemArtist ||
      data.playing !== state.playing ||
      nextArt !== state.systemArt;
    state.systemTitle = data.title || "";
    state.systemArtist = data.artist || "";
    state.systemSource = data.source || "";
    state.systemDuration = Number(data.duration) || 0;
    state.systemArt = nextArt;
    state.playing = Boolean(data.playing);
    state.progress = Number(data.position) || 0;
    state.hasSession = true;
    if (changed) paint(true);
  });
}
