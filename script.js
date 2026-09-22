const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE = 32;
const START_MONEY = 100000;
const SAVE_PREFIX = "cityBuilder1_slot_";

const COSTS = {
  road: 50,
  power: 5000,
  water: 4000,
  residential: 0,
  commercial: 0,
  industrial: 0,
  park: 750
};

const CAPACITY = {
  residential: 12
};

const JOBS = {
  commercial: 4,
  industrial: 8
};

const POWER_PER_PLANT = 250;
const WATER_PER_PLANT = 250;

const BASE_INCOME = {
  residential: 2,
  commercial: 18,
  industrial: 25
};

const BASE_EXPENSE = {
  residential: 1,
  commercial: 5,
  industrial: 10
};

const RESIDENT_TAX_PER_MONTH = 10;
const ROAD_MAINTENANCE_PER_TILE = 0.5;

const ROAD_CAPACITY = 8;
const MAX_VEHICLES = 500;

// 1x = 20 reale Sekunden pro Spielmonat.
const MONTH_SECONDS = 20;

const ZONE_TYPES = {
  residential: "zoneResidential",
  commercial: "zoneCommercial",
  industrial: "zoneIndustrial"
};

let money = START_MONEY;
let population = 0;
let year = 1;
let month = 1;

let selectedTool = "select";
let roadRotation = 0;

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let panning = false;
let building = false;
let movedPointer = false;

let lastPointer = {
  x: 0,
  y: 0
};

let vehicles = [];
let vehicleSpawnTimer = 0;

let grid = {};
let loans = [];

let currentSlot = 1;
let lastFrame = performance.now();
let gameTimeAccumulator = 0;
let timeScale = 1;
let previousTimeScale = 1;
let isPaused = false;

let selectedLoanAmount = null;

const els = {
  money: document.getElementById("money"),
  population: document.getElementById("population"),
  vehicles: document.getElementById("vehicles"),
  satisfaction: document.getElementById("satisfaction"),
  date: document.getElementById("date"),

  housing: document.getElementById("housing"),
  commercial: document.getElementById("commercial"),
  industrial: document.getElementById("industrial"),
  parks: document.getElementById("parks"),

  residentialZones: document.getElementById("residentialZones"),
  commercialZones: document.getElementById("commercialZones"),
  industrialZones: document.getElementById("industrialZones"),

  power: document.getElementById("power"),
  water: document.getElementById("water"),

  jobs: document.getElementById("jobs"),
  unemployed: document.getElementById("unemployed"),

  vehicleCount: document.getElementById("vehicleCount"),
  traffic: document.getElementById("traffic"),

  satisfactionCity: document.getElementById("satisfactionCity"),
  balance: document.getElementById("balance"),

  demandResidential: document.getElementById("demandResidential"),
  demandCommercial: document.getElementById("demandCommercial"),
  demandIndustrial: document.getElementById("demandIndustrial"),

  debt: document.getElementById("debt"),
  loanPayment: document.getElementById("loanPayment"),
  interest: document.getElementById("interest"),

  warning: document.getElementById("warning"),
  message: document.getElementById("message"),

  saveSlots: document.getElementById("saveSlots"),

  bankModal: document.getElementById("bankModal"),
  bankMoney: document.getElementById("bankMoney"),
  bankDebt: document.getElementById("bankDebt"),
  loanInfo: document.getElementById("loanInfo"),
  confirmLoan: document.getElementById("confirmLoan"),
  loanList: document.getElementById("loanList"),

  pauseGame: document.getElementById("pauseGame"),
  speedButtons: document.querySelectorAll(".speed-button")
};


/* =========================================================
   BASIC HELPERS
========================================================= */

function key(x, y) {
  return `${x},${y}`;
}

function getTile(x, y) {
  return grid[key(x, y)] || null;
}

function isRoad(x, y) {
  return getTile(x, y)?.type === "road";
}

function countType(type) {
  return Object.values(grid).filter(tile => tile.type === type).length;
}

function countZone(type) {
  return Object.values(grid).filter(tile => tile.type === type).length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatEuro(amount) {
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString("de-DE")} €`;
}

function setMessage(text) {
  els.message.textContent = text;
  clearTimeout(setMessage.timer);

  setMessage.timer = setTimeout(() => {
    els.message.textContent = "";
  }, 2800);
}

function isZoneType(type) {
  return Object.values(ZONE_TYPES).includes(type);
}

function zoneForTool(tool) {
  return ZONE_TYPES[tool] || null;
}

function buildingTypeForZone(zoneType) {
  const map = {
    zoneResidential: "residential",
    zoneCommercial: "commercial",
    zoneIndustrial: "industrial"
  };

  return map[zoneType] || null;
}

function getZoneDemand(zoneType, demand) {
  const map = {
    zoneResidential: demand.residential,
    zoneCommercial: demand.commercial,
    zoneIndustrial: demand.industrial
  };

  return map[zoneType] ?? 0;
}


/* =========================================================
   CANVAS
========================================================= */

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

window.addEventListener("resize", resizeCanvas);

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: Math.floor((clientX - rect.left - offsetX) / zoom / TILE),
    y: Math.floor((clientY - rect.top - offsetY) / zoom / TILE)
  };
}

function worldToScreen(x, y) {
  return {
    x: x * TILE * zoom + offsetX,
    y: y * TILE * zoom + offsetY
  };
}


/* =========================================================
   ROADS
========================================================= */

function roadMask(x, y) {
  let mask = 0;

  if (isRoad(x, y - 1)) mask |= 1;
  if (isRoad(x + 1, y)) mask |= 2;
  if (isRoad(x, y + 1)) mask |= 4;
  if (isRoad(x - 1, y)) mask |= 8;

  return mask;
}

function hasAdjacentRoad(x, y) {
  return (
    isRoad(x + 1, y) ||
    isRoad(x - 1, y) ||
    isRoad(x, y + 1) ||
    isRoad(x, y - 1)
  );
}

function drawRoad(x, y) {
  const p = worldToScreen(x, y);
  const s = TILE * zoom;
  const mask = roadMask(x, y);
  const width = Math.max(8, s * 0.56);
  const cx = p.x + s / 2;
  const cy = p.y + s / 2;

  ctx.fillStyle = "#454545";
  ctx.fillRect(p.x, p.y, s, s);

  if (mask === 0) {
    if (roadRotation === 0) {
      ctx.fillRect(p.x, cy - width / 2, s, width);
    } else {
      ctx.fillRect(cx - width / 2, p.y, width, s);
    }
  } else {
    ctx.fillRect(cx - width / 2, cy - width / 2, width, width);

    if (mask & 1) ctx.fillRect(cx - width / 2, p.y, width, s / 2);
    if (mask & 2) ctx.fillRect(cx, cy - width / 2, s / 2, width);
    if (mask & 4) ctx.fillRect(cx - width / 2, cy, width, s / 2);
    if (mask & 8) ctx.fillRect(p.x, cy - width / 2, s / 2, width);
  }

  ctx.strokeStyle = "#e5e7a6";
  ctx.lineWidth = Math.max(1, 1.5 * zoom);
  ctx.setLineDash([6 * zoom, 6 * zoom]);
  ctx.beginPath();

  if (
    mask === 10 ||
    mask === 3 ||
    mask === 6 ||
    mask === 12 ||
    (mask === 0 && roadRotation === 0)
  ) {
    ctx.moveTo(p.x, cy);
    ctx.lineTo(p.x + s, cy);
  } else {
    ctx.moveTo(cx, p.y);
    ctx.lineTo(cx, p.y + s);
  }

  ctx.stroke();
  ctx.setLineDash([]);
}


/* =========================================================
   ZONES
========================================================= */

function drawZone(x, y, zoneType) {
  const p = worldToScreen(x, y);
  const s = TILE * zoom;

  const colors = {
    zoneResidential: "rgba(34, 197, 94, 0.30)",
    zoneCommercial: "rgba(168, 85, 247, 0.28)",
    zoneIndustrial: "rgba(249, 115, 22, 0.28)"
  };

  const borders = {
    zoneResidential: "#4ade80",
    zoneCommercial: "#c084fc",
    zoneIndustrial: "#fb923c"
  };

  ctx.fillStyle = colors[zoneType] || "rgba(255,255,255,0.15)";
  ctx.fillRect(p.x + 1, p.y + 1, s - 2, s - 2);

  ctx.strokeStyle = borders[zoneType] || "#fff";
  ctx.lineWidth = Math.max(1, 1.5 * zoom);
  ctx.strokeRect(p.x + 2, p.y + 2, s - 4, s - 4);
}


/* =========================================================
   BUILDINGS
========================================================= */

function drawBuilding(x, y, tile) {
  const p = worldToScreen(x, y);
  const s = TILE * zoom;

  const colors = {
    power: "#f59e0b",
    water: "#3b82f6",
    residential: "#22c55e",
    commercial: "#a855f7",
    industrial: "#f97316",
    park: "#16a34a"
  };

  const icons = {
    power: "⚡",
    water: "💧",
    residential: "🏠",
    commercial: "🏪",
    industrial: "🏭",
    park: "🌳"
  };

  ctx.fillStyle = colors[tile.type] || "#6b7280";
  ctx.fillRect(p.x + 2, p.y + 2, s - 4, s - 4);

  // Eine kleine Zonen-Umrandung bleibt auch nach dem Bebauen sichtbar.
  if (tile.zoneType && isZoneType(tile.zoneType)) {
    ctx.strokeStyle = {
      zoneResidential: "#4ade80",
      zoneCommercial: "#c084fc",
      zoneIndustrial: "#fb923c"
    }[tile.zoneType];
    ctx.lineWidth = Math.max(1, 1.5 * zoom);
    ctx.strokeRect(p.x + 2, p.y + 2, s - 4, s - 4);
  }

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(10, s * 0.48)}px Arial`;
  ctx.fillText(icons[tile.type] || "", p.x + s / 2, p.y + s / 2);

  if (["residential", "commercial", "industrial"].includes(tile.type)) {
    const level = getBuildingLevel(tile);
    const w = s * 0.74;
    const h = Math.max(2, s * 0.07);

    ctx.fillStyle = "#111827";
    ctx.fillRect(p.x + (s - w) / 2, p.y + s - h - 3, w, h);

    ctx.fillStyle = "#fff";
    ctx.fillRect(
      p.x + (s - w) / 2,
      p.y + s - h - 3,
      w * Math.min(1, level / 3),
      h
    );

    ctx.font = `${Math.max(7, s * 0.18)}px Arial`;
    ctx.fillText(`L${Math.floor(level)}`, p.x + s - 7, p.y + 8);
  }
}


/* =========================================================
   GRID + VEHICLES
========================================================= */

function drawGrid() {
  const rect = canvas.getBoundingClientRect();

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(zoom, zoom);

  const sx = Math.floor((-offsetX / zoom) / TILE) - 1;
  const ex = Math.ceil((rect.width - offsetX) / zoom / TILE) + 1;
  const sy = Math.floor((-offsetY / zoom) / TILE) - 1;
  const ey = Math.ceil((rect.height - offsetY) / zoom / TILE) + 1;

  ctx.strokeStyle = "#6c995b";
  ctx.lineWidth = 1 / zoom;

  for (let x = sx; x <= ex; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE, sy * TILE);
    ctx.lineTo(x * TILE, ey * TILE);
    ctx.stroke();
  }

  for (let y = sy; y <= ey; y++) {
    ctx.beginPath();
    ctx.moveTo(sx * TILE, y * TILE);
    ctx.lineTo(ex * TILE, y * TILE);
    ctx.stroke();
  }

  ctx.restore();
}

function drawVehicles() {
  for (const vehicle of vehicles) {
    if (!vehicle.route?.length) continue;

    const a = vehicle.route[Math.min(vehicle.index, vehicle.route.length - 1)];
    const b = vehicle.route[Math.min(vehicle.index + 1, vehicle.route.length - 1)];

    const ax = a.x * TILE + TILE / 2;
    const ay = a.y * TILE + TILE / 2;
    const bx = b.x * TILE + TILE / 2;
    const by = b.y * TILE + TILE / 2;

    const wx = ax + (bx - ax) * vehicle.progress;
    const wy = ay + (by - ay) * vehicle.progress;

    const sx = wx * zoom + offsetX;
    const sy = wy * zoom + offsetY;

    ctx.fillStyle = vehicle.type === "industrial" ? "#fbbf24" : "#f8fafc";
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(3, 6 * zoom) / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  const rect = canvas.getBoundingClientRect();

  ctx.clearRect(0, 0, rect.width, rect.height);

  ctx.fillStyle = "#78a85a";
  ctx.fillRect(0, 0, rect.width, rect.height);

  drawGrid();

  for (const [rawKey, tile] of Object.entries(grid)) {
    const [x, y] = rawKey.split(",").map(Number);

    if (tile.type === "road") {
      drawRoad(x, y);
    } else if (isZoneType(tile.type)) {
      drawZone(x, y, tile.type);
    } else {
      drawBuilding(x, y, tile);
    }
  }

  drawVehicles();
}


/* =========================================================
   CITY CALCULATIONS
========================================================= */

function getBuildingLevel(tile) {
  return Math.max(0.5, tile.level || 0.5);
}

function infrastructure() {
  const powerCapacity = countType("power") * POWER_PER_PLANT;
  const waterCapacity = countType("water") * WATER_PER_PLANT;

  let powerDemand = 0;
  let waterDemand = 0;

  for (const tile of Object.values(grid)) {
    if (!isBuildingTile(tile)) continue;

    const level = getBuildingLevel(tile);

    if (tile.type === "residential") {
      powerDemand += level;
      waterDemand += level;
    }

    if (tile.type === "commercial") {
      powerDemand += 2 * level;
      waterDemand += 2 * level;
    }

    if (tile.type === "industrial") {
      powerDemand += 4 * level;
      waterDemand += 4 * level;
    }
  }

  return {
    powerCapacity,
    waterCapacity,
    powerDemand,
    waterDemand,
    powerOK: powerDemand <= powerCapacity,
    waterOK: waterDemand <= waterCapacity
  };
}

function isBuildingTile(tile) {
  return [
    "power",
    "water",
    "residential",
    "commercial",
    "industrial",
    "park"
  ].includes(tile.type);
}

function calculatePopulation() {
  const infra = infrastructure();
  let capacity = 0;

  for (const [rawKey, tile] of Object.entries(grid)) {
    if (tile.type !== "residential") continue;

    const [x, y] = rawKey.split(",").map(Number);

    if (hasAdjacentRoad(x, y)) {
      capacity += CAPACITY.residential * getBuildingLevel(tile);
    }
  }

  const infrastructureFactor =
    infra.powerOK && infra.waterOK ? 1 : 0.25;

  population = Math.floor(capacity * infrastructureFactor);
  return population;
}

function calculateJobs() {
  let result = 0;

  for (const tile of Object.values(grid)) {
    if (!JOBS[tile.type]) continue;
    result += JOBS[tile.type] * getBuildingLevel(tile);
  }

  return Math.floor(result);
}

function calculateUnemployed() {
  return Math.max(0, population - calculateJobs());
}


/* =========================================================
   BANK
========================================================= */

function calculateDebt() {
  return loans.reduce(
    (sum, loan) => sum + Math.max(0, loan.remaining),
    0
  );
}

function calculateLoanPayment() {
  return loans.reduce(
    (sum, loan) => sum + Math.max(0, loan.payment),
    0
  );
}

function calculateInterest() {
  return loans.reduce(
    (sum, loan) => sum + loan.remaining * (loan.rate / 12),
    0
  );
}

function getLoanRate(amount) {
  return amount >= 100000 ? 0.06 : 0.05;
}

function getLoanPayment(amount, annualRate, months) {
  const monthlyRate = annualRate / 12;

  if (monthlyRate === 0) {
    return amount / months;
  }

  return (
    amount * monthlyRate * Math.pow(1 + monthlyRate, months)
  ) / (
    Math.pow(1 + monthlyRate, months) - 1
  );
}

function getMaximumDebt() {
  const developedBuildings = Object.values(grid).filter(
    tile => isBuildingTile(tile) && !["power", "water", "park"].includes(tile.type)
  ).length;

  return 100000 + developedBuildings * 5000;
}

function updateLoanPreview(amount) {
  const rate = getLoanRate(amount);
  const months = 24;
  const payment = getLoanPayment(amount, rate, months);
  const currentDebt = calculateDebt();
  const maxDebt = getMaximumDebt();

  selectedLoanAmount = amount;

  els.loanInfo.innerHTML = `
    <strong>${formatEuro(amount)}</strong><br>
    Zinssatz: ${(rate * 100).toFixed(1)} % pro Jahr<br>
    Laufzeit: ${months} Monate<br>
    Monatsrate: ${formatEuro(payment)}<br>
    Aktuelle Schulden: ${formatEuro(currentDebt)}<br>
    Kreditlimit: ${formatEuro(maxDebt)}
  `;

  els.confirmLoan.disabled = currentDebt + amount > maxDebt;
}

function clearLoanSelection() {
  selectedLoanAmount = null;
  els.confirmLoan.disabled = true;
  els.loanInfo.textContent = "Wähle einen Kredit.";

  document.querySelectorAll(".loan-button").forEach(button => {
    button.classList.remove("selected");
  });
}

function openBank() {
  updateBankUI();
  els.bankModal.classList.remove("hidden");
}

function closeBank() {
  els.bankModal.classList.add("hidden");
}

document.getElementById("openBank").addEventListener("click", openBank);
document.getElementById("closeBank").addEventListener("click", closeBank);

els.bankModal.addEventListener("click", event => {
  if (event.target === els.bankModal) closeBank();
});

window.addEventListener("keydown", event => {
  if (event.key === "Escape" && !els.bankModal.classList.contains("hidden")) {
    closeBank();
  }
});

document.querySelector(".loan-grid").addEventListener("click", event => {
  const button = event.target.closest(".loan-button");
  if (!button) return;

  const amount = Number(button.dataset.loan);
  if (!Number.isFinite(amount) || amount <= 0) return;

  document.querySelectorAll(".loan-button").forEach(other => {
    other.classList.remove("selected");
  });

  button.classList.add("selected");
  updateLoanPreview(amount);
});

els.confirmLoan.addEventListener("click", () => {
  if (selectedLoanAmount === null) return;
  takeLoan(selectedLoanAmount);
});

function takeLoan(amount) {
  const rate = getLoanRate(amount);
  const totalDebt = calculateDebt();
  const maximumDebt = getMaximumDebt();

  if (totalDebt + amount > maximumDebt) {
    updateLoanPreview(amount);
    setMessage("Dieser Kredit würde dein Kreditlimit überschreiten.");
    return;
  }

  const months = 24;
  const payment = getLoanPayment(amount, rate, months);

  loans.push({
    id: Date.now() + Math.random(),
    original: amount,
    remaining: amount,
    rate,
    monthsLeft: months,
    payment
  });

  money += amount;

  saveGame();
  updateUI();
  updateBankUI();
  clearLoanSelection();

  setMessage(`${amount.toLocaleString("de-DE")} € Kredit aufgenommen.`);
}

function updateBankUI() {
  els.bankMoney.textContent = formatEuro(money);
  els.bankDebt.textContent = formatEuro(calculateDebt());

  if (!loans.length) {
    els.loanList.innerHTML = `<div class="loan-card">Keine aktiven Kredite.</div>`;
    return;
  }

  els.loanList.innerHTML = "";

  loans.forEach((loan, index) => {
    const div = document.createElement("div");
    div.className = "loan-card";

    div.innerHTML = `
      <strong>Kredit #${index + 1}</strong>
      Kreditbetrag: ${formatEuro(loan.original)}<br>
      Restschuld: ${formatEuro(loan.remaining)}<br>
      Monatsrate: ${formatEuro(loan.payment)}<br>
      Zins: ${(loan.rate * 100).toFixed(1)} %<br>
      Restlaufzeit: ${loan.monthsLeft} Monate
    `;

    els.loanList.appendChild(div);
  });
}


/* =========================================================
   DEMAND + ZONES + BUILDING DEVELOPMENT
========================================================= */

function calculateDemand() {
  const housing = countType("residential");
  const commercial = countType("commercial");
  const industrial = countType("industrial");
  const jobs = calculateJobs();
  const unemployed = Math.max(0, population - jobs);

  const residentialCapacity = Object.values(grid)
    .filter(tile => tile.type === "residential")
    .reduce((sum, tile) => sum + CAPACITY.residential * getBuildingLevel(tile), 0);

  const freeHousing = Math.max(0, residentialCapacity - population);

  const residentialDemand = clamp(
    Math.round(55 + (jobs - population) * 1.5 - housing * 1.5 - freeHousing * 0.4),
    0,
    100
  );

  const commercialDemand = clamp(
    Math.round(35 + population * 0.9 - commercial * 5 - unemployed * 0.15),
    0,
    100
  );

  const industrialDemand = clamp(
    Math.round(30 + population * 0.7 - industrial * 6 + unemployed * 0.25),
    0,
    100
  );

  return {
    residential: residentialDemand,
    commercial: commercialDemand,
    industrial: industrialDemand
  };
}

function getZoneCandidates(zoneType) {
  return Object.entries(grid)
    .filter(([, tile]) => tile.type === zoneType)
    .map(([rawKey]) => {
      const [x, y] = rawKey.split(",").map(Number);
      return { x, y };
    })
    .filter(pos => hasAdjacentRoad(pos.x, pos.y));
}

function tryDevelopZones() {
  const demand = calculateDemand();
  const infrastructureState = infrastructure();
  const zoneTypes = Object.values(ZONE_TYPES);
  const shuffled = [];

  for (const zoneType of zoneTypes) {
    for (const pos of getZoneCandidates(zoneType)) {
      shuffled.push({ ...pos, zoneType });
    }
  }

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let developments = 0;
  const maxDevelopments = 10;

  for (const candidate of shuffled) {
    if (developments >= maxDevelopments) break;

    const zoneDemand = getZoneDemand(candidate.zoneType, demand);
    if (zoneDemand < 15) continue;

    let chance = 0.05 + zoneDemand / 500;

    if (!infrastructureState.powerOK || !infrastructureState.waterOK) {
      chance *= 0.5;
    }

    if (Math.random() > chance) continue;

    const buildingType = buildingTypeForZone(candidate.zoneType);
    if (!buildingType) continue;

    grid[key(candidate.x, candidate.y)] = {
      type: buildingType,
      level: 1,
      zoneType: candidate.zoneType
    };

    developments++;
  }
}

function updateBuildings() {
  const demand = calculateDemand();

  for (const tile of Object.values(grid)) {
    if (![
      "residential",
      "commercial",
      "industrial"
    ].includes(tile.type)) {
      continue;
    }

    const level = getBuildingLevel(tile);
    const buildingDemand = demand[tile.type] || 0;
    const chance = 0.05 + buildingDemand / 2500;

    if (
      level < 3 &&
      Math.random() < chance
    ) {
      tile.level = Math.min(3, level + 0.1);
    }
  }
}


/* =========================================================
   TRAFFIC + CITIZENS
========================================================= */

function getRoads() {
  return Object.entries(grid)
    .filter(([, tile]) => tile.type === "road")
    .map(([rawKey]) => {
      const [x, y] = rawKey.split(",").map(Number);
      return { x, y };
    });
}

function nearestRoad(x, y) {
  const roads = getRoads();
  if (!roads.length) return null;

  let best = roads[0];
  let bestDistance = Infinity;

  for (const road of roads) {
    const distance = Math.abs(road.x - x) + Math.abs(road.y - y);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = road;
    }
  }

  return best;
}

function roadPath(start, goal) {
  if (!start || !goal) return [];

  const queue = [start];
  const came = new Map();
  const startKey = key(start.x, start.y);
  const goalKey = key(goal.x, goal.y);

  came.set(startKey, null);

  while (queue.length) {
    const current = queue.shift();
    const currentKey = key(current.x, current.y);

    if (currentKey === goalKey) {
      const path = [];
      let p = current;

      while (p) {
        path.unshift(p);
        p = came.get(key(p.x, p.y));
      }

      return path;
    }

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    for (const neighbor of neighbors) {
      const neighborKey = key(neighbor.x, neighbor.y);

      if (!isRoad(neighbor.x, neighbor.y) || came.has(neighborKey)) {
        continue;
      }

      came.set(neighborKey, current);
      queue.push(neighbor);
    }
  }

  return [];
}

function randomBuilding(type) {
  const candidates = [];

  for (const [rawKey, tile] of Object.entries(grid)) {
    if (tile.type !== type) continue;

    const [x, y] = rawKey.split(",").map(Number);

    if (!hasAdjacentRoad(x, y)) continue;
    candidates.push({ x, y, tile });
  }

  if (!candidates.length) return null;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function createVehicle() {
  const home = randomBuilding("residential");
  if (!home) return;

  const workTypes = Math.random() < 0.5
    ? "commercial"
    : "industrial";

  const work = randomBuilding(workTypes) || randomBuilding("commercial") || randomBuilding("industrial");
  if (!work) return;

  const homeRoad = nearestRoad(home.x, home.y);
  const workRoad = nearestRoad(work.x, work.y);
  const outbound = roadPath(homeRoad, workRoad);

  if (outbound.length < 2) return;

  const returnRoute = [...outbound].reverse();

  vehicles.push({
    type: workTypes,
    route: outbound,
    returnRoute,
    index: 0,
    progress: 0,
    returning: false,
    speed: 2.4 + Math.random() * 1.2
  });
}

function updateVehicles(deltaSeconds) {
  vehicleSpawnTimer += deltaSeconds;

  const workers = Math.min(population, calculateJobs());
  const desiredVehicles = clamp(Math.floor(workers * 0.55), 0, MAX_VEHICLES);

  // Bei höherer Geschwindigkeit entstehen Fahrzeuge schneller.
  while (
    vehicles.length < desiredVehicles &&
    vehicleSpawnTimer >= 0.12
  ) {
    vehicleSpawnTimer -= 0.12;
    createVehicle();

    if (vehicles.length >= desiredVehicles) break;
    if (vehicleSpawnTimer < 0) vehicleSpawnTimer = 0;
  }

  for (let i = vehicles.length - 1; i >= 0; i--) {
    const vehicle = vehicles[i];
    const traffic = calculateTraffic();
    const speedFactor = traffic > 80 ? 0.45 : traffic > 60 ? 0.7 : 1;

    vehicle.progress += vehicle.speed * speedFactor * deltaSeconds;

    if (vehicle.progress < 1) continue;

    vehicle.progress = 0;
    vehicle.index++;

    if (vehicle.index < vehicle.route.length - 1) continue;

    if (!vehicle.returning) {
      vehicle.returning = true;
      vehicle.route = vehicle.returnRoute;
      vehicle.index = 0;
    } else {
      vehicles.splice(i, 1);
    }
  }
}

function calculateTraffic() {
  const roads = countType("road");
  const trafficCapacity = roads * ROAD_CAPACITY;

  if (trafficCapacity <= 0) {
    return vehicles.length > 0 ? 100 : 0;
  }

  return clamp(
    Math.round((vehicles.length / trafficCapacity) * 100),
    0,
    100
  );
}


/* =========================================================
   SATISFACTION
========================================================= */

function calculateSatisfaction() {
  const parks = countType("park");
  const traffic = calculateTraffic();
  const infra = infrastructure();

  let result = 72;

  result += Math.min(15, parks * 2);
  result += Math.min(10, Math.floor(population / 100));
  result -= Math.max(0, traffic - 40) * 0.3;

  if (!infra.powerOK) result -= 20;
  if (!infra.waterOK) result -= 20;

  const unemployed = calculateUnemployed();
  if (population > 0) {
    result -= Math.min(15, (unemployed / population) * 15);
  }

  return clamp(Math.round(result), 0, 100);
}


/* =========================================================
   FINANCES
========================================================= */

function calculateRoadMaintenance() {
  return countType("road") * ROAD_MAINTENANCE_PER_TILE;
}

function calculateResidentTax() {
  calculatePopulation();
  return population * RESIDENT_TAX_PER_MONTH;
}

function calculateBaseBalance() {
  let income = 0;
  let expense = 0;

  for (const tile of Object.values(grid)) {
    const type = tile.type;
    const level = getBuildingLevel(tile);

    if (BASE_INCOME[type]) {
      income += BASE_INCOME[type] * level;
    }

    if (BASE_EXPENSE[type]) {
      expense += BASE_EXPENSE[type] * level;
    }
  }

  return income - expense;
}

function calculateOperatingBalance() {
  return (
    calculateBaseBalance() +
    calculateResidentTax() -
    calculateRoadMaintenance()
  );
}

function calculateBalance() {
  return calculateOperatingBalance() - calculateLoanPayment();
}


/* =========================================================
   BUILD / ZONING / DEMOLISH
========================================================= */

function buildAt(x, y, type, drag = false) {
  if (x < -100 || x > 100 || y < -100 || y > 100) return;

  if (type === "select") {
    const tile = getTile(x, y);

    if (!tile) {
      if (!drag) setMessage(`${x}/${y} ist leer.`);
      return;
    }

    if (isZoneType(tile.type)) {
      const labels = {
        zoneResidential: "Wohnzone",
        zoneCommercial: "Gewerbezone",
        zoneIndustrial: "Industriezone"
      };

      setMessage(`${labels[tile.type] || "Zone"} auf ${x}/${y}`);
      return;
    }

    setMessage(`${tile.type} auf ${x}/${y}`);
    return;
  }

  if (type === "bulldoze") {
    const existing = getTile(x, y);
    if (!existing) return;

    if (existing.zoneType && isZoneType(existing.zoneType)) {
      grid[key(x, y)] = {
        type: existing.zoneType
      };
    } else {
      delete grid[key(x, y)];
    }

    saveGame();
    updateUI();
    draw();

    if (!drag) setMessage("Objekt entfernt / Zone freigegeben.");
    return;
  }

  const existing = getTile(x, y);
  if (existing) return;

  if (isZoneTool(type)) {
    const zoneType = zoneForTool(type);

    if (!zoneType) return;

    grid[key(x, y)] = {
      type: zoneType
    };

    saveGame();
    updateUI();
    draw();
    return;
  }

  const cost = COSTS[type];
  if (!Number.isFinite(cost)) return;

  if (money < cost) {
    if (!drag) setMessage("Nicht genug Geld.");
    return;
  }

  if (type === "road") {
    grid[key(x, y)] = {
      type: "road"
    };
  } else {
    grid[key(x, y)] = {
      type,
      level: ["residential", "commercial", "industrial"].includes(type)
        ? 0.5
        : undefined
    };
  }

  money -= cost;

  saveGame();
  updateUI();
  draw();
}

function isZoneTool(type) {
  return ["residential", "commercial", "industrial"].includes(type);
}


/* =========================================================
   MONTH
========================================================= */

function advanceMonth() {
  updateBuildings();
  tryDevelopZones();

  const payment = calculateLoanPayment();

  for (let i = loans.length - 1; i >= 0; i--) {
    const loan = loans[i];
    const monthlyInterest = loan.remaining * (loan.rate / 12);

    const principal = Math.max(
      0,
      Math.min(
        loan.remaining,
        loan.payment - monthlyInterest
      )
    );

    loan.remaining -= principal;
    loan.monthsLeft--;

    if (loan.remaining <= 0.01 || loan.monthsLeft <= 0) {
      loan.remaining = 0;
      loans.splice(i, 1);
    }
  }

  const operatingBalance = calculateOperatingBalance();
  const monthlyBalance = operatingBalance - payment;

  money += monthlyBalance;

  month++;

  if (month > 12) {
    month = 1;
    year++;
  }

  updateUI();
  saveGame();
  updateBankUI();

  setMessage(
    `Monat abgeschlossen. Bilanz: ${monthlyBalance >= 0 ? "+" : ""}${monthlyBalance.toLocaleString("de-DE")} €`
  );
}


/* =========================================================
   TIME CONTROL
========================================================= */

function updateTimeButtons() {
  els.speedButtons.forEach(button => {
    const speed = Number(button.dataset.speed);
    button.classList.toggle("active", !isPaused && speed === timeScale);
  });

  els.pauseGame.classList.toggle("paused", isPaused);
  els.pauseGame.textContent = isPaused ? "▶" : "⏸";
  els.pauseGame.setAttribute(
    "aria-label",
    isPaused ? "Spiel fortsetzen" : "Spiel pausieren"
  );
}

function setGameSpeed(speed) {
  const numericSpeed = Number(speed);
  if (![1, 2, 4, 8].includes(numericSpeed)) return;

  timeScale = numericSpeed;
  previousTimeScale = numericSpeed;
  isPaused = false;
  updateTimeButtons();
  setMessage(`Spielgeschwindigkeit: ${numericSpeed}×`);
}

function togglePause() {
  if (isPaused) {
    timeScale = previousTimeScale || 1;
    isPaused = false;
  } else {
    previousTimeScale = timeScale || 1;
    timeScale = 0;
    isPaused = true;
  }

  updateTimeButtons();
  setMessage(isPaused ? "Spiel pausiert." : `Spiel läuft mit ${timeScale}×.`);
}

els.pauseGame.addEventListener("click", togglePause);

els.speedButtons.forEach(button => {
  button.addEventListener("click", () => {
    setGameSpeed(button.dataset.speed);
  });
});


/* =========================================================
   SAVE SYSTEM
========================================================= */

function getSaveKey(slot) {
  return `${SAVE_PREFIX}${slot}`;
}

function getGameState() {
  return {
    version: "0.7",
    money,
    population,
    year,
    month,
    selectedTool,
    roadRotation,
    zoom,
    offsetX,
    offsetY,
    grid,
    loans
  };
}

function saveGame(slot = currentSlot) {
  const state = getGameState();

  localStorage.setItem(
    getSaveKey(slot),
    JSON.stringify(state)
  );

  updateSaveSlots();
}

function normalizeLoadedGrid(rawGrid) {
  const result = rawGrid || {};

  for (const tile of Object.values(result)) {
    if (!tile || !tile.type) continue;

    // Alte v0.6-Zellen bleiben gültig.
    if (["residential", "commercial", "industrial"].includes(tile.type)) {
      if (!tile.level) tile.level = 0.5;
    }
  }

  return result;
}

function loadSlot(slot) {
  const raw = localStorage.getItem(getSaveKey(slot));
  if (!raw) return false;

  try {
    const state = JSON.parse(raw);

    money = Number.isFinite(state.money) ? state.money : START_MONEY;
    population = Number.isFinite(state.population) ? state.population : 0;
    year = Number.isFinite(state.year) ? state.year : 1;
    month = Number.isFinite(state.month) ? state.month : 1;
    selectedTool = state.selectedTool || "select";
    roadRotation = state.roadRotation || 0;
    zoom = Number.isFinite(state.zoom) ? state.zoom : 1;
    offsetX = Number.isFinite(state.offsetX) ? state.offsetX : 0;
    offsetY = Number.isFinite(state.offsetY) ? state.offsetY : 0;
    grid = normalizeLoadedGrid(state.grid);
    loans = Array.isArray(state.loans) ? state.loans : [];

    currentSlot = slot;
    vehicles = [];
    vehicleSpawnTimer = 0;
    gameTimeAccumulator = 0;
    timeScale = 1;
    previousTimeScale = 1;
    isPaused = false;

    updateToolButtons();
    updateTimeButtons();
    updateUI();
    updateBankUI();
    draw();

    setMessage(`Spielstand ${slot} geladen.`);
    return true;
  } catch (error) {
    console.error("Savegame konnte nicht geladen werden:", error);
    setMessage("Spielstand konnte nicht geladen werden.");
    return false;
  }
}

function deleteSlot(slot) {
  localStorage.removeItem(getSaveKey(slot));
  updateSaveSlots();
  setMessage(`Spielstand ${slot} gelöscht.`);
}

function updateSaveSlots() {
  els.saveSlots.innerHTML = "";

  for (let slot = 1; slot <= 3; slot++) {
    const raw = localStorage.getItem(getSaveKey(slot));
    const div = document.createElement("div");
    div.className = "save-slot";

    if (!raw) {
      div.innerHTML = `
        <div class="save-slot-title">Spielstand ${slot}</div>
        <div class="save-slot-info">Leer</div>
        <div class="slot-buttons">
          <button type="button" data-action="save" data-slot="${slot}">Speichern</button>
        </div>
      `;
    } else {
      let state = null;

      try {
        state = JSON.parse(raw);
      } catch {
        state = null;
      }

      const savedMoney =
        state && Number.isFinite(state.money)
          ? formatEuro(state.money)
          : "Unbekannt";

      const savedDate =
        state && Number.isFinite(state.year)
          ? `Jahr ${state.year} – Monat ${state.month || 1}`
          : "Unbekannt";

      div.innerHTML = `
        <div class="save-slot-title">Spielstand ${slot}</div>
        <div class="save-slot-info">
          ${savedMoney}<br>
          ${savedDate}
        </div>
        <div class="slot-buttons">
          <button type="button" data-action="load" data-slot="${slot}">Laden</button>
          <button type="button" data-action="save" data-slot="${slot}">Speichern</button>
          <button type="button" data-action="delete" data-slot="${slot}">Löschen</button>
        </div>
      `;
    }

    els.saveSlots.appendChild(div);
  }
}

els.saveSlots.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  const slot = Number(button.dataset.slot);
  const action = button.dataset.action;

  if (!Number.isInteger(slot) || slot < 1 || slot > 3) return;

  if (action === "save") {
    currentSlot = slot;
    saveGame(slot);
    setMessage(`Spielstand ${slot} gespeichert.`);
  }

  if (action === "load") {
    loadSlot(slot);
  }

  if (action === "delete") {
    deleteSlot(slot);
  }
});


/* =========================================================
   NEW GAME
========================================================= */

document.getElementById("newGame").addEventListener("click", () => {
  const confirmed = confirm("Möchtest du wirklich ein neues Spiel starten?");
  if (!confirmed) return;

  money = START_MONEY;
  population = 0;
  year = 1;
  month = 1;
  selectedTool = "select";
  roadRotation = 0;
  zoom = 1;
  offsetX = 0;
  offsetY = 0;
  vehicles = [];
  vehicleSpawnTimer = 0;
  grid = {};
  loans = [];
  gameTimeAccumulator = 0;
  timeScale = 1;
  previousTimeScale = 1;
  isPaused = false;

  currentSlot = currentSlot || 1;

  saveGame(currentSlot);
  updateToolButtons();
  updateTimeButtons();
  updateUI();
  updateBankUI();
  draw();

  setMessage("Neues Spiel gestartet.");
});


/* =========================================================
   UI
========================================================= */

function updateUI() {
  calculatePopulation();

  const jobs = calculateJobs();
  const unemployed = Math.max(0, population - jobs);
  const infra = infrastructure();
  const traffic = calculateTraffic();
  const satisfaction = calculateSatisfaction();
  const balance = calculateBalance();
  const demand = calculateDemand();

  els.money.textContent = formatEuro(money);
  els.population.textContent = population.toLocaleString("de-DE");
  els.vehicles.textContent = vehicles.length;
  els.satisfaction.textContent = `${satisfaction}%`;
  els.date.textContent = `Jahr ${year} – Monat ${month}`;

  els.housing.textContent = countType("residential");
  els.commercial.textContent = countType("commercial");
  els.industrial.textContent = countType("industrial");
  els.parks.textContent = countType("park");

  els.residentialZones.textContent = countZone("zoneResidential");
  els.commercialZones.textContent = countZone("zoneCommercial");
  els.industrialZones.textContent = countZone("zoneIndustrial");

  els.power.textContent = `${Math.floor(infra.powerDemand)} / ${infra.powerCapacity}`;
  els.water.textContent = `${Math.floor(infra.waterDemand)} / ${infra.waterCapacity}`;
  els.jobs.textContent = jobs;
  els.unemployed.textContent = unemployed;
  els.vehicleCount.textContent = vehicles.length;
  els.traffic.textContent = `${traffic}%`;
  els.satisfactionCity.textContent = `${satisfaction}%`;
  els.balance.textContent = `${balance >= 0 ? "+" : ""}${Math.round(balance).toLocaleString("de-DE")} €`;

  els.debt.textContent = formatEuro(calculateDebt());
  els.loanPayment.textContent = formatEuro(calculateLoanPayment());
  els.interest.textContent = formatEuro(calculateInterest());

  els.demandResidential.style.width = `${demand.residential}%`;
  els.demandCommercial.style.width = `${demand.commercial}%`;
  els.demandIndustrial.style.width = `${demand.industrial}%`;

  if (!infra.powerOK || !infra.waterOK) {
    els.warning.classList.remove("hidden");
    const warnings = [];

    if (!infra.powerOK) warnings.push("Zu wenig Strom");
    if (!infra.waterOK) warnings.push("Zu wenig Wasser");

    els.warning.textContent = warnings.join(" • ");
  } else {
    els.warning.classList.add("hidden");
  }
}


/* =========================================================
   TOOLS
========================================================= */

function updateToolButtons() {
  document.querySelectorAll("[data-tool]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tool === selectedTool
    );
  });
}

document.querySelectorAll("[data-tool]").forEach(button => {
  button.addEventListener("click", () => {
    selectedTool = button.dataset.tool;
    updateToolButtons();

    const messages = {
      select: "Auswählen aktiviert.",
      road: "Straßenbau aktiviert.",
      power: "Kraftwerke bauen.",
      water: "Wasserwerke bauen.",
      residential: "Wohnzone markieren – kostenlos.",
      commercial: "Gewerbezone markieren – kostenlos.",
      industrial: "Industriezone markieren – kostenlos.",
      park: "Parks bauen.",
      bulldoze: "Abriss aktiviert."
    };

    setMessage(messages[selectedTool] || "Werkzeug aktiviert.");
  });
});

document.getElementById("rotateRoad").addEventListener("click", () => {
  roadRotation = roadRotation === 0 ? 1 : 0;
  draw();
  setMessage(
    roadRotation === 0
      ? "Straßenrichtung: horizontal"
      : "Straßenrichtung: vertikal"
  );
});

window.addEventListener("keydown", event => {
  if (event.key.toLowerCase() === "r") {
    roadRotation = roadRotation === 0 ? 1 : 0;
    draw();
  }

  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    togglePause();
  }
});


/* =========================================================
   MOUSE CONTROLS
========================================================= */

canvas.addEventListener("mousedown", event => {
  lastPointer = {
    x: event.clientX,
    y: event.clientY
  };

  movedPointer = false;

  if (event.button === 1) {
    panning = true;
    return;
  }

  if (event.button === 0) {
    building = !["select", "bulldoze"].includes(selectedTool);

    if (building) {
      const p = screenToWorld(event.clientX, event.clientY);
      buildAt(p.x, p.y, selectedTool, true);
    }
  }
});

window.addEventListener("mousemove", event => {
  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;

  if (Math.abs(dx) + Math.abs(dy) > 1) {
    movedPointer = true;
  }

  if (panning) {
    offsetX += dx;
    offsetY += dy;
    draw();
  }

  if (building) {
    const p = screenToWorld(event.clientX, event.clientY);
    buildAt(p.x, p.y, selectedTool, true);
  }

  lastPointer = {
    x: event.clientX,
    y: event.clientY
  };
});

window.addEventListener("mouseup", () => {
  panning = false;
  building = false;
});

canvas.addEventListener("click", event => {
  if (movedPointer) return;

  if (selectedTool === "select" || selectedTool === "bulldoze") {
    const p = screenToWorld(event.clientX, event.clientY);
    buildAt(p.x, p.y, selectedTool);
  }
});

canvas.addEventListener("contextmenu", event => {
  event.preventDefault();

  const p = screenToWorld(event.clientX, event.clientY);
  buildAt(p.x, p.y, "bulldoze");
});


/* =========================================================
   ZOOM
========================================================= */

canvas.addEventListener("wheel", event => {
  event.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const oldZoom = zoom;

  const wx = (mx - offsetX) / oldZoom;
  const wy = (my - offsetY) / oldZoom;

  zoom *= event.deltaY < 0 ? 1.1 : 0.9;
  zoom = clamp(zoom, 0.35, 3);

  offsetX = mx - wx * zoom;
  offsetY = my - wy * zoom;

  draw();
}, { passive: false });


/* =========================================================
   TOUCH CONTROLS
========================================================= */

let touches = new Map();
let touchMoved = false;
let pinchStartDistance = 0;
let pinchStartZoom = 1;

canvas.addEventListener("touchstart", event => {
  for (const touch of event.changedTouches) {
    touches.set(touch.identifier, {
      x: touch.clientX,
      y: touch.clientY,
      startX: touch.clientX,
      startY: touch.clientY
    });
  }

  if (touches.size === 2) {
    pinchStartDistance = getTouchDistance();
    pinchStartZoom = zoom;
  }
}, { passive: false });

canvas.addEventListener("touchmove", event => {
  event.preventDefault();

  for (const touch of event.changedTouches) {
    const data = touches.get(touch.identifier);
    if (!data) continue;

    const dx = touch.clientX - data.startX;
    const dy = touch.clientY - data.startY;

    if (Math.hypot(dx, dy) > 6) {
      touchMoved = true;
    }

    data.x = touch.clientX;
    data.y = touch.clientY;
  }

  if (touches.size === 1) {
    const data = [...touches.values()][0];
    const dx = data.x - data.startX;
    const dy = data.y - data.startY;

    offsetX += dx;
    offsetY += dy;

    data.startX = data.x;
    data.startY = data.y;

    draw();
  }

  if (touches.size === 2 && pinchStartDistance) {
    zoom = pinchStartZoom * (getTouchDistance() / pinchStartDistance);
    zoom = clamp(zoom, 0.35, 3);
    draw();
  }
}, { passive: false });

canvas.addEventListener("touchend", event => {
  event.preventDefault();

  for (const touch of event.changedTouches) {
    const data = touches.get(touch.identifier);

    if (data && touches.size === 1 && !touchMoved) {
      const p = screenToWorld(touch.clientX, touch.clientY);
      buildAt(p.x, p.y, selectedTool);
    }

    touches.delete(touch.identifier);
  }

  if (touches.size < 2) {
    pinchStartDistance = 0;
  }

  touchMoved = false;
}, { passive: false });

function getTouchDistance() {
  const values = [...touches.values()];
  if (values.length < 2) return 0;

  return Math.hypot(
    values[0].x - values[1].x,
    values[0].y - values[1].y
  );
}


/* =========================================================
   START GAME
========================================================= */

if (!localStorage.getItem(getSaveKey(1))) {
  money = START_MONEY;
  saveGame();
} else {
  loadSlot(1);
}

updateSaveSlots();
updateBankUI();
updateUI();
resizeCanvas();
updateTimeButtons();


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(now) {
  const rawDelta = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  if (!isPaused && timeScale > 0) {
    const gameDelta = rawDelta * timeScale;

    updateVehicles(gameDelta);

    gameTimeAccumulator += gameDelta;

    while (gameTimeAccumulator >= MONTH_SECONDS) {
      gameTimeAccumulator -= MONTH_SECONDS;
      advanceMonth();
    }
  }

  updateUI();
  draw();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);