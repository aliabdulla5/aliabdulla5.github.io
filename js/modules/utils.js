export function formatBytes(n) {
  const num = Number(n) || 0;
  const KB = 1000;
  const MB = 1000000;
  if (num < KB) return `${num} B`;
  if (num < MB) return `${(num / KB).toFixed(1)} KB`;
  return `${(num / MB).toFixed(2)} MB`;
}

export function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function setStyle(id, prop, value) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = value;
}

export function addListItem(ul, text) {
  const li = document.createElement("li");
  li.textContent = text;
  ul.appendChild(li);
}
