export function initNavigation() {
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

export function goToArea(area) {
  const validAreas = ["overworld", "clouds", "underground"];
  if (!validAreas.includes(area)) return;

  const currentArea = document.body.className.match(/area-(overworld|clouds|underground)/)?.[1];
  
  const rootScroll = document.getElementById("root-scroll-wrapper");
  const cloudsPanel = document.getElementById("cloudsPanel");
  const undergroundPanel = document.getElementById("undergroundPanel");
  
  if (rootScroll) rootScroll.scrollTop = 0;
  if (cloudsPanel) cloudsPanel.scrollTop = 0;
  if (undergroundPanel) undergroundPanel.scrollTop = 0;
  
  if (area === "clouds" && currentArea !== "clouds") {
    document.body.classList.add("transitioning-to-clouds");
    setTimeout(() => document.body.classList.remove("transitioning-to-clouds"), 1000);
  } else if (area === "underground" && currentArea !== "underground") {
    document.body.classList.add("transitioning-to-underground");
    setTimeout(() => document.body.classList.remove("transitioning-to-underground"), 900);
  }

  document.body.classList.remove("area-overworld", "area-clouds", "area-underground");
  document.body.classList.add(`area-${area}`);

  requestAnimationFrame(() => {
    if (area === "underground" && undergroundPanel) {
      undergroundPanel.scrollTop = 0;
    } else if (area === "clouds" && cloudsPanel) {
      cloudsPanel.scrollTop = 0;
    } else if (area === "overworld" && rootScroll) {
      rootScroll.scrollTop = 0;
    }
  });

  updateWorldName(area);

  try { 
    localStorage.setItem("lastArea", area); 
  } catch (e) {}
  
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

export function restoreLastArea() {
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

if (typeof window !== 'undefined') {
  window.goToArea = goToArea;
}
