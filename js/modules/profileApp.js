import { enforceAuth, getUserIdFromToken } from './authManager.js';
import { 
  getUserIdFromAPI, 
  fetchUserData, 
  fetchXPTransactions, 
  fetchLevelTransactions, 
  fetchProgresses, 
  fetchSkillTransactions 
} from './api.js';
import { processStats, processXPProgress, processTimelineData, processSkillsData } from './stats.js';
import { initNavigation, restoreLastArea } from './navigation.js';
import { 
  renderUserInfo, 
  renderStats, 
  renderXPProgress, 
  renderSkills, 
  renderProjectsTimeline,
  showError 
} from './uiRenderer.js';

export async function initProfile() {
  if (!enforceAuth()) {
    throw new Error("Unauthorized");
  }

  setupPageListeners();
  
  initNavigation();
  
  restoreLastArea();
  
  await loadProfile();
}

function setupPageListeners() {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      enforceAuth();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      enforceAuth();
    }
  });
}

async function loadProfile() {
  try {
    const token = localStorage.getItem("jwt");
    if (!token) {
      location.replace("index.html");
      return;
    }
    
    let uid = getUserIdFromToken();
    if (!uid) {
      uid = await getUserIdFromAPI();
    }
    
    if (!uid) {
      showError("Not authenticated");
      localStorage.removeItem("jwt");
      localStorage.removeItem("lastArea");
      setTimeout(() => location.replace("index.html"), 1000);
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

    const statsData = processStats(user, transactions, levelTx);
    renderStats(statsData);

    const xpData = processXPProgress(transactions, progresses);
    renderXPProgress(xpData);

    const timelineData = processTimelineData(transactions, progresses);
    renderProjectsTimeline(timelineData);

    const skillsData = processSkillsData(skillTx, progresses);
    renderSkills(skillsData);

  } catch (err) {
    console.error("Profile load error:", err);
    showError(err.message || "Error loading profile");
  }
}
