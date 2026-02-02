document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  initNavigation();
  restoreLastArea();
});

async function loadProfile() {
  try {
    const uid = await getUserId();
    if (!uid) {
      showError("Not authenticated");
      return;
    }

    const [user, transactions, levelTx, progresses, skillTx] = await Promise.all([
      fetchUserData(uid),
      fetchXPTransactions(uid),
      fetchLevelTransactions(uid),
      fetchProgresses(uid),
      fetchSkillTransactions(uid)
    ]);

    if (!user) throw new Error("Unable to fetch user data");

    renderUserInfo(user);
    renderStats(user, transactions, levelTx);
    renderXPProgress(transactions, progresses);
    renderSkillGraphs(skillTx, progresses);

  } catch (err) {
    console.error("Profile load error:", err);
    showError(err.message || "Error loading profile");
  }
}

async function getUserId() {
  const token = localStorage.getItem("jwt");
  if (token) {
    try {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        const id = payload.sub 
          || payload["https://hasura.io/jwt/claims"]?.["x-hasura-user-id"]
          || payload.user_id 
          || payload.id;
        if (id) return Number(id);
      }
    } catch (e) {}
  }

  try {
    const res = await graphqlRequest(`{ user { id } }`);
    const user = Array.isArray(res.data.user) ? res.data.user[0] : res.data.user;
    return user?.id ? Number(user.id) : null;
  } catch (e) {
    return null;
  }
}

async function fetchUserData(uid) {
  const query = `query($uid: Int!) {
    user(where: { id: { _eq: $uid } }) {
      id login firstName lastName email attrs auditRatio totalUp totalDown
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  return Array.isArray(res.data.user) ? res.data.user[0] : res.data.user;
}

async function fetchXPTransactions(uid) {
  const query = `query($uid: Int!) {
    transaction(where: { userId: { _eq: $uid }, type: { _eq: "xp" } }, order_by: { createdAt: asc }) {
      amount createdAt path
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  const transactions = res.data?.transaction || [];
  
  return transactions.filter(t => {
    const path = (t.path || "").toLowerCase();
    const piscineIdx = path.indexOf("piscine");
    if (piscineIdx === -1) return true;
    return path.indexOf("/", piscineIdx + 7) === -1;
  });
}

async function fetchLevelTransactions(uid) {
  const query = `query($uid: Int!) {
    transaction(where: { userId: { _eq: $uid }, type: { _eq: "level" } }, order_by: { createdAt: asc }) {
      amount createdAt
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  return res.data?.transaction || [];
}

async function fetchProgresses(uid) {
  const query = `query($uid: Int!) {
    progress(where: { userId: { _eq: $uid } }) {
      grade createdAt path objectId
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  return res.data?.progress || [];
}

async function fetchSkillTransactions(uid) {
  const query = `query($uid: Int!) {
    transaction(where: { userId: { _eq: $uid }, type: { _like: "skill_%" } }) {
      type amount createdAt path
    }
  }`;
  const res = await graphqlRequest(query, { uid });
  return res.data?.transaction || [];
}

function renderUserInfo(user) {
  const first = user.firstName || user.first_name || "";
  const last = user.lastName || user.last_name || "";
  const welcomeEl = document.getElementById("welcomeName");
  if (welcomeEl) {
    const name = [first, last].filter(Boolean).join(" ");
    welcomeEl.textContent = name ? `Welcome, ${name}` : "Welcome";
  }

  setText("userName", `Username: ${user.login || "-"}`);
  setText("userEmail", `Email: ${user.email || "-"}`);
  
  let attrs = {};
  try {
    attrs = typeof user.attrs === "string" ? JSON.parse(user.attrs) : (user.attrs || {});
  } catch (e) { attrs = user.attrs || {}; }
  
  const cpr = attrs.CPRnumber || attrs.cprNumber || attrs.cpr || attrs.CPR || "-";
  setText("userCPR", `CPR: ${cpr}`);
}

function renderStats(user, transactions, levelTx) {
  const totalXP = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  setText("xpTotal", formatBytes(totalXP));

  let level = 1;
  if (levelTx.length) {
    const maxLevel = Math.max(...levelTx.map(t => Number(t.amount) || 0));
    level = Math.max(1, maxLevel - 1);
  } else {
    level = Math.max(1, Math.floor(totalXP / 1000));
  }
  
  drawLevelCircle(document.getElementById("levelCircle"), level);
  setText("levelLabel", `Level ${level}`);

  const ratio = Number(user.auditRatio) || 0;
  const up = Number(user.totalUp) || 0;
  const down = Number(user.totalDown) || 0;
  renderAuditRatio(ratio, up, down);
}

function renderAuditRatio(ratio, up, down) {
  let descriptor = "Unknown";
  if (ratio < 0.5) descriptor = "Insufficient";
  else if (ratio < 1.0) descriptor = "Meets Min";
  else if (ratio < 1.5) descriptor = "Strong";
  else descriptor = "Excellent";

  setText("auditDescriptor", descriptor);
  setText("auditRatioText", ratio.toFixed(2));

  const total = (up + down) || 1;
  const donePercent = Math.round((up / total) * 100);
  const recPercent = Math.round((down / total) * 100);

  setStyle("auditDone", "width", `${donePercent}%`);
  setStyle("auditReceived", "width", `${recPercent}%`);
  setText("auditDoneNum", `Done: ${formatBytes(up)}`);
  setText("auditReceivedNum", `Received: ${formatBytes(down)}`);
}

function renderXPProgress(transactions, progresses) {
  const xpByProject = {};
  transactions.forEach(t => {
    const parts = (t.path || "").split("/").filter(Boolean);
    const key = parts[parts.length - 1] || "unknown";
    xpByProject[key] = (xpByProject[key] || 0) + (t.amount || 0);
  });

  const entries = Object.entries(xpByProject)
    .map(([key, xp]) => {
      let finishedAt = 0;
      progresses.forEach(p => {
        const parts = (p.path || "").split("/").filter(Boolean);
        if (parts[parts.length - 1] === key) {
          const t = Date.parse(p.createdAt || "");
          if (!isNaN(t) && t > finishedAt) finishedAt = t;
        }
      });
      return { key, xp, finishedAt };
    })
    .filter(e => e.xp > 0)
    .sort((a, b) => b.finishedAt - a.finishedAt);

  setText("projectCount", entries.length.toString());

  const cloudList = document.getElementById("cloudProjectsList");
  if (cloudList) {
    cloudList.innerHTML = "";
    entries.forEach(e => {
      const li = document.createElement("li");
      li.textContent = `${e.key} — ${formatBytes(e.xp)}`;
      cloudList.appendChild(li);
    });
  }

  drawProjectsTimeline(document.getElementById("projectsTimeline"), entries);
}

function renderSkillGraphs(skillTx, progresses) {
  let skillData = [];

  if (skillTx.length) {
    const skillMap = {};
    skillTx.forEach(t => {
      const match = (t.type || "").match(/^skill_(.+)/);
      const name = match ? match[1] : "general";
      const amount = t.amount || 0;
      // Store only the maximum value for each skill
      if (!skillMap[name] || amount > skillMap[name]) {
        skillMap[name] = amount;
      }
    });
    skillData = Object.entries(skillMap).map(([name, value]) => ({ name, value }));
  } else {
    const skillCounts = {};
    progresses.forEach(p => {
      const parts = (p.path || "").split("/").filter(Boolean);
      const skill = parts[1] || parts[0] || "general";
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });
    skillData = Object.entries(skillCounts).map(([name, value]) => ({ name, value }));
  }

  skillData = skillData.sort((a, b) => b.value - a.value).slice(0, 12);

  while (skillData.length < 12) {
    skillData.push({ name: `Skill ${skillData.length + 1}`, value: 0 });
  }

  drawSkillsRadar(document.getElementById("skillsA"), skillData.slice(0, 6));
  drawSkillsRadar(document.getElementById("skillsB"), skillData.slice(6, 12));
  
  const undergroundList = document.getElementById("undergroundSkillsList");
  if (undergroundList) {
    undergroundList.innerHTML = "";
    skillData.filter(s => s.value > 0).forEach(skill => {
      const li = document.createElement("li");
      const nameSpan = document.createElement("span");
      nameSpan.textContent = skill.name;
      const valueSpan = document.createElement("span");
      valueSpan.className = "skill-value";
      valueSpan.textContent = `${skill.value.toFixed(1)}%`;
      li.appendChild(nameSpan);
      li.appendChild(valueSpan);
      undergroundList.appendChild(li);
    });
  }
}

function drawLevelCircle(svg, level) {
  if (!svg) return;
  svg.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";
  const cx = 60, cy = 60, r = 48;

  const bg = document.createElementNS(ns, "circle");
  Object.entries({ cx, cy, r, fill: "none", stroke: "rgba(255,255,255,0.1)", "stroke-width": "8" })
    .forEach(([k, v]) => bg.setAttribute(k, v));
  svg.appendChild(bg);

  const progress = Math.min(level, 100);
  const fg = document.createElementNS(ns, "circle");
  Object.entries({
    cx, cy, r, fill: "none", stroke: "#049cd8", "stroke-width": "8", "stroke-linecap": "round",
    "stroke-dasharray": `${progress * 3.01} 301`, transform: `rotate(-90 ${cx} ${cy})`
  }).forEach(([k, v]) => fg.setAttribute(k, v));
  svg.appendChild(fg);

  const text = document.createElementNS(ns, "text");
  Object.entries({ x: cx, y: cy + 2, "text-anchor": "middle", "font-size": "28", "font-weight": "700", fill: "#f1f5f9" })
    .forEach(([k, v]) => text.setAttribute(k, v));
  text.textContent = level;
  svg.appendChild(text);
}

function drawSkillsRadar(svg, data) {
  if (!svg) return;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", "0 0 200 200");

  if (!data?.length) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "100");
    text.setAttribute("y", "100");
    text.setAttribute("fill", "#64748b");
    text.setAttribute("text-anchor", "middle");
    text.textContent = "No skills data";
    svg.appendChild(text);
    return;
  }

  const ns = "http://www.w3.org/2000/svg";
  const cx = 100, cy = 100, radius = 70;
  const max = 100;
  const count = data.length;

  for (let i = 1; i <= 5; i++) {
    const circle = document.createElementNS(ns, "circle");
    Object.entries({ cx, cy, r: (radius * i) / 5, fill: "none", stroke: "rgba(255,255,255,0.08)", "stroke-width": "1" })
      .forEach(([k, v]) => circle.setAttribute(k, v));
    svg.appendChild(circle);
  }

  data.forEach((d, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x2 = cx + Math.cos(angle) * radius;
    const y2 = cy + Math.sin(angle) * radius;

    const line = document.createElementNS(ns, "line");
    Object.entries({ x1: cx, y1: cy, x2, y2, stroke: "rgba(255,255,255,0.05)" })
      .forEach(([k, v]) => line.setAttribute(k, v));
    svg.appendChild(line);

    const lx = cx + Math.cos(angle) * (radius + 20);
    const ly = cy + Math.sin(angle) * (radius + 20);
    const label = document.createElementNS(ns, "text");
    Object.entries({ x: lx, y: ly + 4, fill: "#94a3b8", "font-size": "10", "text-anchor": "middle" })
      .forEach(([k, v]) => label.setAttribute(k, v));
    label.textContent = d.name.slice(0, 8);
    svg.appendChild(label);
  });

  const points = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const r = (d.value / max) * radius;
    return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
  }).join(" ");

  const polygon = document.createElementNS(ns, "polygon");
  Object.entries({ points, fill: "rgba(92, 148, 252, 0.4)", stroke: "rgba(92, 148, 252, 0.8)", "stroke-width": "2" })
    .forEach(([k, v]) => polygon.setAttribute(k, v));
  svg.appendChild(polygon);

  const center = document.createElementNS(ns, "circle");
  Object.entries({ cx, cy, r: 3, fill: "rgba(255,255,255,0.5)" })
    .forEach(([k, v]) => center.setAttribute(k, v));
  svg.appendChild(center);
}

function drawProjectsTimeline(svg, entries) {
  if (!svg) return;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", "0 0 400 220");

  const ns = "http://www.w3.org/2000/svg";
  const padding = { top: 35, right: 25, bottom: 50, left: 45 };
  const width = 400 - padding.left - padding.right;
  const height = 220 - padding.top - padding.bottom;

  if (!entries.length) {
    const text = document.createElementNS(ns, "text");
    Object.entries({ x: 200, y: 110, fill: "#64748b", "text-anchor": "middle", "font-size": "14" })
      .forEach(([k, v]) => text.setAttribute(k, v));
    text.textContent = "No project data";
    svg.appendChild(text);
    return;
  }

  const sorted = [...entries].filter(e => e.finishedAt > 0).sort((a, b) => a.finishedAt - b.finishedAt);
  if (!sorted.length) {
    const text = document.createElementNS(ns, "text");
    Object.entries({ x: 200, y: 110, fill: "#64748b", "text-anchor": "middle", "font-size": "14" })
      .forEach(([k, v]) => text.setAttribute(k, v));
    text.textContent = "No timeline data";
    svg.appendChild(text);
    return;
  }

  const monthData = {};
  sorted.forEach(e => {
    const d = new Date(e.finishedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthData[key] = (monthData[key] || 0) + 1;
  });

  const months = Object.keys(monthData).sort();
  const values = months.map(m => monthData[m]);
  const maxVal = Math.max(...values, 1);

  const gridGroup = document.createElementNS(ns, "g");
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (height / 4) * i;
    const line = document.createElementNS(ns, "line");
    Object.entries({ x1: padding.left, y1: y, x2: padding.left + width, y2: y, stroke: "rgba(255,255,255,0.08)" })
      .forEach(([k, v]) => line.setAttribute(k, v));
    gridGroup.appendChild(line);
    
    const label = document.createElementNS(ns, "text");
    const val = Math.round(maxVal - (maxVal / 4) * i);
    Object.entries({ x: padding.left - 8, y: y + 4, fill: "#64748b", "font-size": "9", "text-anchor": "end" })
      .forEach(([k, v]) => label.setAttribute(k, v));
    label.textContent = val;
    gridGroup.appendChild(label);
  }
  svg.appendChild(gridGroup);

  const xStep = months.length > 1 ? width / (months.length - 1) : width / 2;
  const points = months.map((month, i) => {
    const x = padding.left + (months.length > 1 ? i * xStep : width / 2);
    const y = padding.top + height - (monthData[month] / maxVal) * height;
    return { x, y, month, value: monthData[month] };
  });

  if (points.length > 1) {
    const areaPath = document.createElementNS(ns, "path");
    let areaD = `M ${points[0].x} ${padding.top + height}`;
    areaD += ` L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      areaD += ` L ${points[i].x} ${points[i].y}`;
    }
    areaD += ` L ${points[points.length - 1].x} ${padding.top + height} Z`;
    Object.entries({ d: areaD, fill: "rgba(92, 148, 252, 0.15)" })
      .forEach(([k, v]) => areaPath.setAttribute(k, v));
    svg.appendChild(areaPath);

    const linePath = document.createElementNS(ns, "path");
    let lineD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      lineD += ` L ${points[i].x} ${points[i].y}`;
    }
    Object.entries({ d: lineD, fill: "none", stroke: "#5c94fc", "stroke-width": "2.5", "stroke-linecap": "round", "stroke-linejoin": "round" })
      .forEach(([k, v]) => linePath.setAttribute(k, v));
    svg.appendChild(linePath);
  }

  points.forEach((p, i) => {
    const circle = document.createElementNS(ns, "circle");
    Object.entries({ cx: p.x, cy: p.y, r: 4, fill: "#5c94fc", stroke: "#fff", "stroke-width": "2" })
      .forEach(([k, v]) => circle.setAttribute(k, v));
    svg.appendChild(circle);

    const valText = document.createElementNS(ns, "text");
    Object.entries({ x: p.x, y: p.y - 10, fill: "#f1f5f9", "font-size": "10", "font-weight": "600", "text-anchor": "middle" })
      .forEach(([k, v]) => valText.setAttribute(k, v));
    valText.textContent = p.value;
    svg.appendChild(valText);

    const labelText = document.createElementNS(ns, "text");
    const showFull = months.length <= 6;
    Object.entries({
      x: p.x, y: padding.top + height + 16,
      fill: "#94a3b8", "font-size": showFull ? "9" : "8", "text-anchor": "middle"
    }).forEach(([k, v]) => labelText.setAttribute(k, v));
    labelText.textContent = showFull ? p.month : p.month.slice(5);
    svg.appendChild(labelText);
  });

  const title = document.createElementNS(ns, "text");
  Object.entries({ x: 200, y: 18, fill: "#f1f5f9", "font-size": "13", "text-anchor": "middle", "font-weight": "600" })
    .forEach(([k, v]) => title.setAttribute(k, v));
  title.textContent = "Projects Completed Over Time";
  svg.appendChild(title);
}

function initNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    const area = btn.dataset.area;
    if (area) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        goToArea(area);
      });
    }
  });
}

function goToArea(area) {
  const validAreas = ["overworld", "clouds", "underground"];
  if (!validAreas.includes(area)) return;

  const currentArea = document.body.className.match(/area-(overworld|clouds|underground)/)?.[1];
  
  // Scroll reset - ensure every world opens at top
  const rootScroll = document.getElementById("root-scroll-wrapper");
  if (rootScroll) rootScroll.scrollTop = 0;
  
  const cloudsPanel = document.getElementById("cloudsPanel");
  const undergroundPanel = document.getElementById("undergroundPanel");
  if (cloudsPanel) cloudsPanel.scrollTop = 0;
  if (undergroundPanel) undergroundPanel.scrollTop = 0;
  
  // Add transition class for themed animations
  if (area === "clouds" && currentArea !== "clouds") {
    document.body.classList.add("transitioning-to-clouds");
    setTimeout(() => document.body.classList.remove("transitioning-to-clouds"), 1000);
  } else if (area === "underground" && currentArea !== "underground") {
    document.body.classList.add("transitioning-to-underground");
    setTimeout(() => document.body.classList.remove("transitioning-to-underground"), 900);
  }

  document.body.classList.remove("area-overworld", "area-clouds", "area-underground");
  document.body.classList.add(`area-${area}`);

  updateWorldName(area);

  try { localStorage.setItem("lastArea", area); } catch (e) {}
  showToast(`Entering ${area}`);
}

function updateWorldName(area) {
  const names = {
    overworld: "Overworld",
    clouds: "Sky World",
    underground: "Underground"
  };
  const el = document.getElementById("currentWorldName");
  if (el) el.textContent = names[area] || "Overworld";
}

function restoreLastArea() {
  try {
    const last = localStorage.getItem("lastArea");
    if (last && ["overworld", "clouds", "underground"].includes(last)) {
      document.body.classList.remove("area-overworld", "area-clouds", "area-underground");
      document.body.classList.add(`area-${last}`);
      updateWorldName(last);
    }
  } catch (e) {}
}

function showToast(message) {
  const toast = document.getElementById("marioToast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.opacity = "1";
  toast.setAttribute("aria-hidden", "false");

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.setAttribute("aria-hidden", "true");
  }, 800);
}

window.goToArea = goToArea;

function formatBytes(n) {
  const num = Number(n) || 0;
  const KB = 1000;
  const MB = 1000000;
  if (num < KB) return `${num} B`;
  if (num < MB) return `${(num / KB).toFixed(1)} KB`;
  return `${(num / MB).toFixed(2)} MB`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setStyle(id, prop, value) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = value;
}

function addListItem(ul, text) {
  const li = document.createElement("li");
  li.textContent = text;
  ul.appendChild(li);
}

function showError(message) {
  const el = document.getElementById("errorMsg");
  if (el) el.textContent = message;
}
