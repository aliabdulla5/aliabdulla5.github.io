import { formatBytes } from './utils.js';

export function processStats(user, transactions, levelTx) {
  const totalXP = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  
  let level = 1;
  if (levelTx.length) {
    const currentLevel = Number(levelTx[0].amount) || 0;
    level = Math.max(1, currentLevel);
  } else {
    level = Math.max(1, Math.floor(totalXP / 1000));
  }
  
  const ratio = Number(user.auditRatio) || 0;
  const up = Number(user.totalUp) || 0;
  const down = Number(user.totalDown) || 0;
  
  return {
    totalXP,
    level,
    auditRatio: {
      ratio,
      up,
      down,
      descriptor: getAuditDescriptor(ratio)
    }
  };
}

function getAuditDescriptor(ratio) {
  if (ratio < 0.5) return "Insufficient";
  if (ratio < 1.0) return "Meets Min";
  if (ratio < 1.5) return "Strong";
  return "Excellent";
}

export function processXPProgress(transactions, progresses) {
  const projectCount = transactions.length;
  
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

  return {
    projectCount,
    projects: entries
  };
}

export function processTimelineData(transactions, progresses) {
  const sorted = transactions
    .filter(t => {
      const parts = (t.path || "").split("/").filter(Boolean);
      const key = parts[parts.length - 1] || "unknown";
      return progresses.some(p => {
        const pparts = (p.path || "").split("/").filter(Boolean);
        return pparts[pparts.length - 1] === key;
      });
    })
    .map(t => {
      const parts = (t.path || "").split("/").filter(Boolean);
      const key = parts[parts.length - 1] || "unknown";
      let finishedAt = 0;
      progresses.forEach(p => {
        const pparts = (p.path || "").split("/").filter(Boolean);
        if (pparts[pparts.length - 1] === key) {
          const dt = Date.parse(p.createdAt || "");
          if (!isNaN(dt) && dt > finishedAt) finishedAt = dt;
        }
      });
      return { finishedAt };
    })
    .sort((a, b) => a.finishedAt - b.finishedAt);

  if (!sorted.length) return null;

  const monthData = {};
  sorted.forEach(e => {
    const d = new Date(e.finishedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthData[key] = (monthData[key] || 0) + 1;
  });

  return monthData;
}

export function processSkillsData(skillTx, progresses) {
  let skillData = [];

  if (skillTx.length) {
    const skillMap = {};
    skillTx.forEach(t => {
      const match = (t.type || "").match(/^skill_(.+)/);
      const name = match ? match[1] : "general";
      const amount = t.amount || 0;
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

  const topSkill = skillData.find(s => s.value > 0);
  
  return {
    all: skillData,
    groupA: skillData.slice(0, 6),
    groupB: skillData.slice(6, 12),
    topSkill
  };
}
