import { formatBytes, setText, setStyle } from './utils.js';

export function renderUserInfo(user) {
  const first = user.firstName || user.first_name || "";
  const last = user.lastName || user.last_name || "";
  const welcomeEl = document.getElementById("welcomeName");
  if (welcomeEl) {
    const name = [first, last].filter(Boolean).join(" ");
    welcomeEl.textContent = name ? `Welcome, ${name}` : "Welcome";
  }

  const headerUsername = document.getElementById("headerUsername");
  if (headerUsername) {
    headerUsername.textContent = user.login || "";
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

export function renderStats(statsData) {
  setText("xpTotal", formatBytes(statsData.totalXP));
  
  drawLevelCircle(document.getElementById("levelCircle"), statsData.level);
  setText("levelLabel", `Level ${statsData.level}`);

  renderAuditRatio(statsData.auditRatio);
}

function renderAuditRatio(auditData) {
  setText("auditDescriptor", auditData.descriptor);
  const ratioEl = document.getElementById("auditRatioText");
  if (ratioEl) {
    ratioEl.innerHTML = `<span class="ratio-label">Ratio:</span> ${auditData.ratio.toFixed(2)}`;
  }

  const total = (auditData.up + auditData.down) || 1;
  const donePercent = Math.round((auditData.up / total) * 100);
  const recPercent = Math.round((auditData.down / total) * 100);

  setStyle("auditDone", "width", `${donePercent}%`);
  setStyle("auditReceived", "width", `${recPercent}%`);
  setText("auditDoneNum", `Done: ${formatBytes(auditData.up)}`);
  setText("auditReceivedNum", `Received: ${formatBytes(auditData.down)}`);
}

export function renderXPProgress(xpData) {
  setText("projectCount", xpData.projectCount.toString());

  const cloudList = document.getElementById("cloudProjectsList");
  if (cloudList) {
    cloudList.innerHTML = "";
    xpData.projects.forEach(e => {
      const li = document.createElement("li");
      li.textContent = `${e.key} — ${formatBytes(e.xp)}`;
      cloudList.appendChild(li);
    });
  }
}

export function renderSkills(skillsData) {
  drawSkillsRadar(document.getElementById("skillsA"), skillsData.groupA);
  drawSkillsRadar(document.getElementById("skillsB"), skillsData.groupB);
  
  const undergroundList = document.getElementById("undergroundSkillsList");
  if (undergroundList) {
    undergroundList.innerHTML = "";
    skillsData.all.filter(s => s.value > 0).forEach(skill => {
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

  if (skillsData.topSkill) {
    setText("topSkillName", `${skillsData.topSkill.name}: ${skillsData.topSkill.value.toFixed(1)}%`);
  } else {
    setText("topSkillName", "-");
  }
}

export function renderProjectsTimeline(monthData) {
  const svg = document.getElementById("projectsTimeline");
  drawProjectsTimeline(svg, monthData);
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

function drawProjectsTimeline(svg, monthData) {
  if (!svg) return;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", "0 0 400 220");

  const ns = "http://www.w3.org/2000/svg";
  const padding = { top: 35, right: 25, bottom: 50, left: 45 };
  const width = 400 - padding.left - padding.right;
  const height = 220 - padding.top - padding.bottom;

  if (!monthData || Object.keys(monthData).length === 0) {
    const text = document.createElementNS(ns, "text");
    Object.entries({ x: 200, y: 110, fill: "#64748b", "text-anchor": "middle", "font-size": "14" })
      .forEach(([k, v]) => text.setAttribute(k, v));
    text.textContent = "No project data";
    svg.appendChild(text);
    return;
  }

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

export function showError(message) {
  const el = document.getElementById("errorMsg");
  if (el) el.textContent = message;
}
