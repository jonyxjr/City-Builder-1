const canvas = document.getElementById("cityCanvas");
const ctx = canvas.getContext("2d");

const moneyEl = document.getElementById("money");
const populationEl = document.getElementById("population");
const buildingsEl = document.getElementById("buildings");
const messageEl = document.getElementById("message");

const TILE = 32;

const costs = {
  road: 50,
  residential: 500,
  commercial: 800,
  industrial: 1000
};

const populationPerBuilding = {
  residential: 12,
  commercial: 2,
  industrial: 4,
  road: 0
};

let money = 50000;
let selectedTool = "select";

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let dragging = false;

let lastMouse = {
  x: 0,
  y: 0
};

const grid = new Map();

function resize() {
  const dpr = window.devicePixelRatio || 1;

  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  draw();
}

window.addEventListener("resize", resize);

function key(x, y) {
  return `${x},${y}`;
}

function screenToGrid(x, y) {
  return {
    x: Math.floor(
      (x - canvas.clientWidth / 2 - offsetX) /
      (TILE * zoom)
    ),

    y: Math.floor(
      (y - canvas.clientHeight / 2 - offsetY) /
      (TILE * zoom)
    )
  };
}

function gridToScreen(x, y) {
  return {
    x:
      canvas.clientWidth / 2 +
      offsetX +
      x * TILE * zoom,

    y:
      canvas.clientHeight / 2 +
      offsetY +
      y * TILE * zoom
  };
}

function setMessage(text) {
  messageEl.textContent = text;

  clearTimeout(setMessage.timer);

  setMessage.timer = setTimeout(() => {
    messageEl.textContent =
      "Wähle ein Werkzeug und baue deine Stadt.";
  }, 2200);
}

function updateStats() {
  let population = 0;
  let buildings = 0;

  for (const item of grid.values()) {
    if (item.type !== "road") {
      buildings++;
    }

    population += populationPerBuilding[item.type] || 0;
  }

  moneyEl.textContent =
    `${money.toLocaleString("de-DE")} €`;

  populationEl.textContent =
    population.toLocaleString("de-DE");

  buildingsEl.textContent =
    buildings.toLocaleString("de-DE");
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);

  // Boden
  ctx.fillStyle = "#78a85a";
  ctx.fillRect(0, 0, w, h);

  const halfX =
    Math.ceil(w / (TILE * zoom)) + 3;

  const halfY =
    Math.ceil(h / (TILE * zoom)) + 3;

  const center = screenToGrid(
    w / 2,
    h / 2
  );

  // Raster
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(40,70,35,.25)";

  for (
    let x = center.x - halfX;
    x <= center.x + halfX;
    x++
  ) {
    const p = gridToScreen(x, 0);

    ctx.beginPath();
    ctx.moveTo(p.x, 0);
    ctx.lineTo(p.x, h);
    ctx.stroke();
  }

  for (
    let y = center.y - halfY;
    y <= center.y + halfY;
    y++
  ) {
    const p = gridToScreen(0, y);

    ctx.beginPath();
    ctx.moveTo(0, p.y);
    ctx.lineTo(w, p.y);
    ctx.stroke();
  }

  // Gebäude und Straßen
  for (const [k, item] of grid) {
    const [x, y] =
      k.split(",").map(Number);

    const p = gridToScreen(x, y);
    const size = TILE * zoom;

    if (item.type === "road") {
      // Straße
      ctx.fillStyle = "#454545";

      ctx.fillRect(
        p.x + 1,
        p.y + 1,
        size - 2,
        size - 2
      );

      // Straßenmarkierung
      ctx.strokeStyle = "#d9d9a8";
      ctx.lineWidth =
        Math.max(1, 2 * zoom);

      ctx.setLineDash([
        6 * zoom,
        6 * zoom
      ]);

      ctx.beginPath();

      ctx.moveTo(
        p.x,
        p.y + size / 2
      );

      ctx.lineTo(
        p.x + size,
        p.y + size / 2
      );

      ctx.stroke();

      ctx.setLineDash([]);
    }

    else {
      const colors = {
        residential: "#5aa469",
        commercial: "#4d8edb",
        industrial: "#d39a3a"
      };

      ctx.fillStyle =
        colors[item.type];

      ctx.fillRect(
        p.x + 3,
        p.y + 3,
        size - 6,
        size - 6
      );

      const icons = {
        residential: "🏠",
        commercial: "🏪",
        industrial: "🏭"
      };

      ctx.fillStyle =
        "rgba(255,255,255,.9)";

      ctx.font =
        `${Math.max(10, 15 * zoom)}px Arial`;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(
        icons[item.type],
        p.x + size / 2,
        p.y + size / 2
      );
    }
  }
}

function buildAt(x, y) {
  const k = key(x, y);

  // Auswahl
  if (selectedTool === "select") {
    const item = grid.get(k);

    if (item) {
      setMessage(
        `${item.type} — Feld ${x}, ${y}`
      );
    }
    else {
      setMessage(
        "Dieses Feld ist leer."
      );
    }

    return;
  }

  // Abriss
  if (selectedTool === "bulldoze") {
    if (grid.has(k)) {
      grid.delete(k);

      money += 100;

      updateStats();
      save();
      draw();

      setMessage(
        "Objekt entfernt. +100 €"
      );
    }

    return;
  }

  // Feld bereits belegt
  if (grid.has(k)) {
    setMessage(
      "Dieses Feld ist bereits belegt."
    );

    return;
  }

  const cost = costs[selectedTool];

  // Geld prüfen
  if (money < cost) {
    setMessage(
      "Nicht genug Geld!"
    );

    return;
  }

  // Objekt bauen
  grid.set(k, {
    type: selectedTool
  });

  money -= cost;

  updateStats();
  save();
  draw();
}

function save() {
  localStorage.setItem(
    "cityBuilder3",
    JSON.stringify({
      money: money,
      grid: [...grid.entries()]
    })
  );
}

function load() {
  const raw =
    localStorage.getItem(
      "cityBuilder3"
    );

  if (!raw) {
    return;
  }

  try {
    const data =
      JSON.parse(raw);

    money =
      data.money ?? 50000;

    grid.clear();

    for (
      const [k, item]
      of data.grid ?? []
    ) {
      grid.set(k, item);
    }
  }

  catch {
    console.warn(
      "Spielstand konnte nicht geladen werden."
    );
  }
}

// Werkzeuge
document
  .querySelectorAll(".tool")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".tool")
          .forEach(b =>
            b.classList.remove("active")
          );

        button.classList.add("active");

        selectedTool =
          button.dataset.tool;
      }
    );
  });

// Linksklick
canvas.addEventListener(
  "click",
  e => {

    if (dragging) {
      return;
    }

    const rect =
      canvas.getBoundingClientRect();

    const point =
      screenToGrid(
        e.clientX - rect.left,
        e.clientY - rect.top
      );

    buildAt(
      point.x,
      point.y
    );
  }
);

// Rechtsklick = entfernen
canvas.addEventListener(
  "contextmenu",
  e => {

    e.preventDefault();

    const rect =
      canvas.getBoundingClientRect();

    const point =
      screenToGrid(
        e.clientX - rect.left,
        e.clientY - rect.top
      );

    const k =
      key(point.x, point.y);

    if (grid.has(k)) {

      grid.delete(k);

      money += 100;

      updateStats();
      save();
      draw();

      setMessage(
        "Objekt entfernt. +100 €"
      );
    }
  }
);

// Mittlere Maustaste = Karte bewegen
canvas.addEventListener(
  "mousedown",
  e => {

    if (e.button === 1) {

      dragging = true;

      lastMouse = {
        x: e.clientX,
        y: e.clientY
      };

      e.preventDefault();
    }
  }
);

window.addEventListener(
  "mouseup",
  e => {

    if (e.button === 1) {
      dragging = false;
    }
  }
);

window.addEventListener(
  "mousemove",
  e => {

    if (!dragging) {
      return;
    }

    offsetX +=
      e.clientX - lastMouse.x;

    offsetY +=
      e.clientY - lastMouse.y;

    lastMouse = {
      x: e.clientX,
      y: e.clientY
    };

    draw();
  }
);

// Zoom
canvas.addEventListener(
  "wheel",
  e => {

    e.preventDefault();

    const rect =
      canvas.getBoundingClientRect();

    const mouseX =
      e.clientX - rect.left;

    const mouseY =
      e.clientY - rect.top;

    const before =
      screenToGrid(
        mouseX,
        mouseY
      );

    zoom *=
      e.deltaY < 0
        ? 1.1
        : 0.9;

    zoom =
      Math.max(
        0.45,
        Math.min(2.5, zoom)
      );

    const after =
      gridToScreen(
        before.x,
        before.y
      );

    offsetX +=
      mouseX - after.x;

    offsetY +=
      mouseY - after.y;

    draw();
  },
  {
    passive: false
  }
);

// Spiel starten
load();
updateStats();
resize();