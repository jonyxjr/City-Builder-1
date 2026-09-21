const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE = 32;

const START_MONEY = 100000;

const SAVE_PREFIX = "cityBuilder1_slot_";

const COSTS = {
  road: 50,
  power: 5000,
  water: 4000,
  residential: 500,
  commercial: 800,
  industrial: 1000,
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

const ROAD_CAPACITY = 8;
const MAX_VEHICLES = 100;

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

  power: document.getElementById("power"),
  water: document.getElementById("water"),

  jobs: document.getElementById("jobs"),
  unemployed: document.getElementById("unemployed"),

  vehicleCount: document.getElementById("vehicleCount"),
  traffic: document.getElementById("traffic"),

  satisfactionCity:
    document.getElementById(
      "satisfactionCity"
    ),

  balance:
    document.getElementById(
      "balance"
    ),

  demandResidential:
    document.getElementById(
      "demandResidential"
    ),

  demandCommercial:
    document.getElementById(
      "demandCommercial"
    ),

  demandIndustrial:
    document.getElementById(
      "demandIndustrial"
    ),

  debt:
    document.getElementById(
      "debt"
    ),

  loanPayment:
    document.getElementById(
      "loanPayment"
    ),

  interest:
    document.getElementById(
      "interest"
    ),

  warning:
    document.getElementById(
      "warning"
    ),

  message:
    document.getElementById(
      "message"
    ),

  saveSlots:
    document.getElementById(
      "saveSlots"
    ),

  bankModal:
    document.getElementById(
      "bankModal"
    ),

  bankMoney:
    document.getElementById(
      "bankMoney"
    ),

  bankDebt:
    document.getElementById(
      "bankDebt"
    ),

  loanInfo:
    document.getElementById(
      "loanInfo"
    ),

  loanList:
    document.getElementById(
      "loanList"
    )
};

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
  let amount = 0;

  for (const tile of Object.values(grid)) {
    if (tile.type === type) {
      amount++;
    }
  }

  return amount;
}

function setMessage(text) {
  els.message.textContent = text;

  clearTimeout(
    setMessage.timer
  );

  setMessage.timer = setTimeout(() => {
    els.message.textContent = "";
  }, 2800);
}

function resizeCanvas() {
  const r =
    canvas.getBoundingClientRect();

  const d =
    window.devicePixelRatio || 1;

  canvas.width =
    Math.max(
      1,
      Math.floor(
        r.width * d
      )
    );

  canvas.height =
    Math.max(
      1,
      Math.floor(
        r.height * d
      )
    );

  ctx.setTransform(
    d,
    0,
    0,
    d,
    0,
    0
  );

  draw();
}

window.addEventListener(
  "resize",
  resizeCanvas
);

function screenToWorld(
  clientX,
  clientY
) {
  const r =
    canvas.getBoundingClientRect();

  return {
    x: Math.floor(
      (
        clientX -
        r.left -
        offsetX
      ) /
      zoom /
      TILE
    ),

    y: Math.floor(
      (
        clientY -
        r.top -
        offsetY
      ) /
      zoom /
      TILE
    )
  };
}

function worldToScreen(x, y) {
  return {
    x:
      x *
      TILE *
      zoom +
      offsetX,

    y:
      y *
      TILE *
      zoom +
      offsetY
  };
}

function roadMask(x, y) {
  let mask = 0;

  if (isRoad(x, y - 1)) {
    mask |= 1;
  }

  if (isRoad(x + 1, y)) {
    mask |= 2;
  }

  if (isRoad(x, y + 1)) {
    mask |= 4;
  }

  if (isRoad(x - 1, y)) {
    mask |= 8;
  }

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
  const p =
    worldToScreen(x, y);

  const s =
    TILE * zoom;

  const mask =
    roadMask(x, y);

  const width =
    Math.max(
      8,
      s * 0.56
    );

  const cx =
    p.x + s / 2;

  const cy =
    p.y + s / 2;

  ctx.fillStyle = "#454545";

  ctx.fillRect(
    p.x,
    p.y,
    s,
    s
  );

  if (mask === 0) {

    if (roadRotation === 0) {

      ctx.fillRect(
        p.x,
        cy - width / 2,
        s,
        width
      );

    } else {

      ctx.fillRect(
        cx - width / 2,
        p.y,
        width,
        s
      );
    }

  } else {

    ctx.fillRect(
      cx - width / 2,
      cy - width / 2,
      width,
      width
    );

    if (mask & 1) {
      ctx.fillRect(
        cx - width / 2,
        p.y,
        width,
        s / 2
      );
    }

    if (mask & 2) {
      ctx.fillRect(
        cx,
        cy - width / 2,
        s / 2,
        width
      );
    }

    if (mask & 4) {
      ctx.fillRect(
        cx - width / 2,
        cy,
        width,
        s / 2
      );
    }

    if (mask & 8) {
      ctx.fillRect(
        p.x,
        cy - width / 2,
        s / 2,
        width
      );
    }
  }

  ctx.strokeStyle =
    "#e5e7a6";

  ctx.lineWidth =
    Math.max(
      1,
      1.5 * zoom
    );

  ctx.setLineDash([
    6 * zoom,
    6 * zoom
  ]);

  ctx.beginPath();

  if (
    mask === 10 ||
    mask === 3 ||
    mask === 6 ||
    mask === 12 ||
    (
      mask === 0 &&
      roadRotation === 0
    )
  ) {

    ctx.moveTo(
      p.x,
      cy
    );

    ctx.lineTo(
      p.x + s,
      cy
    );

  } else {

    ctx.moveTo(
      cx,
      p.y
    );

    ctx.lineTo(
      cx,
      p.y + s
    );
  }

  ctx.stroke();

  ctx.setLineDash([]);
}

function drawBuilding(
  x,
  y,
  tile
) {
  const p =
    worldToScreen(x, y);

  const s =
    TILE * zoom;

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

  ctx.fillStyle =
    colors[tile.type] ||
    "#6b7280";

  ctx.fillRect(
    p.x + 2,
    p.y + 2,
    s - 4,
    s - 4
  );

  ctx.fillStyle = "#fff";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font =
    `${Math.max(
      10,
      s * 0.48
    )}px Arial`;

  ctx.fillText(
    icons[tile.type] || "",
    p.x + s / 2,
    p.y + s / 2
  );

  if (
    [
      "residential",
      "commercial",
      "industrial"
    ].includes(tile.type)
  ) {

    const level =
      tile.level || 0.5;

    const w =
      s * 0.74;

    const h =
      Math.max(
        2,
        s * 0.07
      );

    ctx.fillStyle =
      "#111827";

    ctx.fillRect(
      p.x +
        (s - w) / 2,
      p.y +
        s -
        h -
        3,
      w,
      h
    );

    ctx.fillStyle =
      "#fff";

    ctx.fillRect(
      p.x +
        (s - w) / 2,
      p.y +
        s -
        h -
        3,
      w *
        Math.min(
          1,
          level / 3
        ),
      h
    );

    ctx.font =
      `${Math.max(
        7,
        s * 0.18
      )}px Arial`;

    ctx.fillText(
      `L${Math.floor(level)}`,
      p.x +
        s -
        7,
      p.y + 8
    );
  }
}

function drawGrid() {
  const r =
    canvas.getBoundingClientRect();

  ctx.save();

  ctx.translate(
    offsetX,
    offsetY
  );

  ctx.scale(
    zoom,
    zoom
  );

  const sx =
    Math.floor(
      (-offsetX / zoom) /
      TILE
    ) - 1;

  const ex =
    Math.ceil(
      (r.width - offsetX) /
      zoom /
      TILE
    ) + 1;

  const sy =
    Math.floor(
      (-offsetY / zoom) /
      TILE
    ) - 1;

  const ey =
    Math.ceil(
      (r.height - offsetY) /
      zoom /
      TILE
    ) + 1;

  ctx.strokeStyle =
    "#6c995b";

  ctx.lineWidth =
    1 / zoom;

  for (
    let x = sx;
    x <= ex;
    x++
  ) {

    ctx.beginPath();

    ctx.moveTo(
      x * TILE,
      sy * TILE
    );

    ctx.lineTo(
      x * TILE,
      ey * TILE
    );

    ctx.stroke();
  }

  for (
    let y = sy;
    y <= ey;
    y++
  ) {

    ctx.beginPath();

    ctx.moveTo(
      sx * TILE,
      y * TILE
    );

    ctx.lineTo(
      ex * TILE,
      y * TILE
    );

    ctx.stroke();
  }

  ctx.restore();
}

function drawVehicles() {

  for (
    const vehicle of vehicles
  ) {

    const a =
      vehicle.route[
        Math.min(
          vehicle.index,
          vehicle.route.length - 1
        )
      ];

    const b =
      vehicle.route[
        Math.min(
          vehicle.index + 1,
          vehicle.route.length - 1
        )
      ];

    const ax =
      a.x * TILE +
      TILE / 2;

    const ay =
      a.y * TILE +
      TILE / 2;

    const bx =
      b.x * TILE +
      TILE / 2;

    const by =
      b.y * TILE +
      TILE / 2;

    const wx =
      ax +
      (bx - ax) *
      vehicle.progress;

    const wy =
      ay +
      (by - ay) *
      vehicle.progress;

    const sx =
      wx * zoom +
      offsetX;

    const sy =
      wy * zoom +
      offsetY;

    ctx.fillStyle =
      "#f8fafc";

    ctx.beginPath();

    ctx.arc(
      sx,
      sy,
      Math.max(
        3,
        6 * zoom
      ) / 2,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }
}

function draw() {
  const r =
    canvas.getBoundingClientRect();

  ctx.clearRect(
    0,
    0,
    r.width,
    r.height
  );

  ctx.fillStyle =
    "#78a85a";

  ctx.fillRect(
    0,
    0,
    r.width,
    r.height
  );

  drawGrid();

  for (
    const [k, tile]
    of Object.entries(grid)
  ) {

    const [x, y] =
      k.split(",")
        .map(Number);

    if (
      tile.type === "road"
    ) {

      drawRoad(
        x,
        y
      );

    } else {

      drawBuilding(
        x,
        y,
        tile
      );
    }
  }

  drawVehicles();
}

function infrastructure() {

  const powerCapacity =
    countType("power") *
    POWER_PER_PLANT;

  const waterCapacity =
    countType("water") *
    WATER_PER_PLANT;

  let powerDemand = 0;
  let waterDemand = 0;

  for (
    const tile
    of Object.values(grid)
  ) {

    if (
      tile.type ===
      "residential"
    ) {

      powerDemand +=
        1 *
        getBuildingLevel(
          tile
        );

      waterDemand +=
        1 *
        getBuildingLevel(
          tile
        );
    }

    if (
      tile.type ===
      "commercial"
    ) {

      powerDemand +=
        2 *
        getBuildingLevel(
          tile
        );

      waterDemand +=
        2 *
        getBuildingLevel(
          tile
        );
    }

    if (
      tile.type ===
      "industrial"
    ) {

      powerDemand +=
        4 *
        getBuildingLevel(
          tile
        );

      waterDemand +=
        4 *
        getBuildingLevel(
          tile
        );
    }
  }

  return {
    powerCapacity,
    waterCapacity,
    powerDemand,
    waterDemand,

    powerOK:
      powerDemand <=
      powerCapacity,

    waterOK:
      waterDemand <=
      waterCapacity
  };
}

function getBuildingLevel(tile) {
  return Math.max(
    0.5,
    tile.level || 0.5
  );
}

function calculatePopulation() {

  const i =
    infrastructure();

  let capacity = 0;

  for (
    const [k, tile]
    of Object.entries(grid)
  ) {

    if (
      tile.type !==
      "residential"
    ) {
      continue;
    }

    const [x, y] =
      k.split(",")
        .map(Number);

    if (
      hasAdjacentRoad(
        x,
        y
      )
    ) {

      capacity +=
        CAPACITY.residential *
        getBuildingLevel(
          tile
        );
    }
  }

  population =
    Math.floor(
      capacity *
      (
        i.powerOK &&
        i.waterOK
          ? 1
          : 0.25
      )
    );
}

function calculateJobs() {

  let result = 0;

  for (
    const tile
    of Object.values(grid)
  ) {

    if (
      JOBS[tile.type]
    ) {

      result +=
        JOBS[tile.type] *
        getBuildingLevel(
          tile
        );
    }
  }

  return Math.floor(
    result
  );
}

function calculateDebt() {

  return loans.reduce(
    (
      total,
      loan
    ) =>
      total +
      loan.remaining,
    0
  );
}

function calculateLoanPayment() {

  return loans.reduce(
    (
      total,
      loan
    ) =>
      total +
      loan.payment,
    0
  );
}

function calculateInterest() {

  return loans.reduce(
    (
      total,
      loan
    ) =>
      total +
      loan.remaining *
      (
        loan.rate /
        12
      ),
    0
  );
}

function calculateBaseBalance() {

  let result = 0;

  for (
    const tile
    of Object.values(grid)
  ) {

    const level =
      getBuildingLevel(
        tile
      );

    if (
      BASE_INCOME[tile.type]
    ) {

      result +=
        BASE_INCOME[
          tile.type
        ] *
        level;
    }

    if (
      BASE_EXPENSE[tile.type]
    ) {

      result -=
        BASE_EXPENSE[
          tile.type
        ] *
        level;
    }

    if (
      tile.type ===
      "power"
    ) {

      result -= 40;
    }

    if (
      tile.type ===
      "water"
    ) {

      result -= 30;
    }

    if (
      tile.type ===
      "road"
    ) {

      result -= 1;
    }
  }

  result +=
    population * 3;

  return Math.floor(
    result
  );
}

function calculateBalance() {

  return Math.floor(
    calculateBaseBalance() -
    calculateLoanPayment()
  );
}

function calculateTraffic() {

  const roads =
    Object.entries(grid)
      .filter(
        ([, tile]) =>
          tile.type === "road"
      );

  if (!roads.length) {
    return 0;
  }

  let total =
    vehicles.length;

  const capacity =
    roads.length *
    ROAD_CAPACITY;

  return Math.min(
    100,
    Math.round(
      (
        total /
        Math.max(
          1,
          capacity
        )
      ) *
      100
    )
  );
}

function calculateSatisfaction() {

  const i =
    infrastructure();

  const traffic =
    calculateTraffic();

  const jobs =
    calculateJobs();

  let value = 100;

  if (!i.powerOK) {
    value -= 25;
  }

  if (!i.waterOK) {
    value -= 25;
  }

  if (traffic > 50) {
    value -=
      Math.floor(
        (
          traffic - 50
        ) *
        0.3
      );
  }

  const unemployed =
    Math.max(
      0,
      population - jobs
    );

  if (
    population > 0
  ) {

    value -=
      Math.floor(
        (
          unemployed /
          population
        ) *
        25
      );
  }

  value +=
    Math.min(
      10,
      countType("park") *
      2
    );

  return Math.max(
    0,
    Math.min(
      100,
      Math.floor(value)
    )
  );
}

function calculateDemand() {

  const residential =
    Math.max(
      0,
      Math.min(
        100,
        60 -
        countType(
          "residential"
        ) *
        4 +
        population *
        0.1
      )
    );

  const commercial =
    Math.max(
      0,
      Math.min(
        100,
        40 +
        population *
        0.45 -
        countType(
          "commercial"
        ) *
        7
      )
    );

  const industrial =
    Math.max(
      0,
      Math.min(
        100,
        40 +
        population *
        0.3 -
        countType(
          "industrial"
        ) *
        7
      )
    );

  return {
    residential,
    commercial,
    industrial
  };
}

function updateBuildings() {

  const demand =
    calculateDemand();

  const satisfaction =
    calculateSatisfaction();

  const i =
    infrastructure();

  for (
    const tile
    of Object.values(grid)
  ) {

    if (
      ![
        "residential",
        "commercial",
        "industrial"
      ].includes(
        tile.type
      )
    ) {
      continue;
    }

    if (
      tile.level >= 3
    ) {
      continue;
    }

    const demandValue =
      demand[
        tile.type ===
        "residential"
          ? "residential"
          : tile.type ===
            "commercial"
            ? "commercial"
            : "industrial"
      ];

    if (
      i.powerOK &&
      i.waterOK &&
      satisfaction >= 60 &&
      demandValue >= 45
    ) {

      tile.level =
        Math.min(
          3,
          (
            tile.level ||
            0.5
          ) +
          0.5
        );
    }
  }
}

function updateWarnings() {

  const i =
    infrastructure();

  const traffic =
    calculateTraffic();

  const warnings = [];

  if (!i.powerOK) {
    warnings.push(
      "⚡ Zu wenig Strom"
    );
  }

  if (!i.waterOK) {
    warnings.push(
      "💧 Zu wenig Wasser"
    );
  }

  if (
    traffic >= 70
  ) {

    warnings.push(
      "🚗 Hohe Verkehrsbelastung"
    );
  }

  if (
    money < 0
  ) {

    warnings.push(
      "💸 Stadt ist verschuldet"
    );
  }

  els.warning.textContent =
    warnings.join(
      " · "
    );

  els.warning.classList.toggle(
    "hidden",
    warnings.length === 0
  );
}

function updateUI() {

  calculatePopulation();

  const i =
    infrastructure();

  const jobs =
    calculateJobs();

  const unemployed =
    Math.max(
      0,
      population - jobs
    );

  const traffic =
    calculateTraffic();

  const satisfaction =
    calculateSatisfaction();

  const demand =
    calculateDemand();

  const balance =
    calculateBalance();

  const debt =
    calculateDebt();

  const payment =
    calculateLoanPayment();

  const interest =
    calculateInterest();

  els.money.textContent =
    `${Math.floor(
      money
    ).toLocaleString(
      "de-DE"
    )} €`;

  els.population.textContent =
    population.toLocaleString(
      "de-DE"
    );

  els.vehicles.textContent =
    vehicles.length;

  els.satisfaction.textContent =
    `${satisfaction}%`;

  els.date.textContent =
    `Jahr ${year} – Monat ${month}`;

  els.housing.textContent =
    countType(
      "residential"
    );

  els.commercial.textContent =
    countType(
      "commercial"
    );

  els.industrial.textContent =
    countType(
      "industrial"
    );

  els.parks.textContent =
    countType(
      "park"
    );

  els.power.textContent =
    `${Math.floor(
      i.powerDemand
    )} / ${
      i.powerCapacity
    }`;

  els.water.textContent =
    `${Math.floor(
      i.waterDemand
    )} / ${
      i.waterCapacity
    }`;

  els.jobs.textContent =
    jobs;

  els.unemployed.textContent =
    unemployed;

  els.vehicleCount.textContent =
    vehicles.length;

  els.traffic.textContent =
    `${traffic}%`;

  els.satisfactionCity.textContent =
    `${satisfaction}%`;

  els.balance.textContent =
    `${
      balance >= 0
        ? "+"
        : ""
    }${balance.toLocaleString(
      "de-DE"
    )} €`;

  els.debt.textContent =
    `${Math.floor(
      debt
    ).toLocaleString(
      "de-DE"
    )} €`;

  els.loanPayment.textContent =
    `${Math.floor(
      payment
    ).toLocaleString(
      "de-DE"
    )} €`;

  els.interest.textContent =
    `${Math.floor(
      interest
    ).toLocaleString(
      "de-DE"
    )} €`;

  els.demandResidential.style.width =
    `${demand.residential}%`;

  els.demandCommercial.style.width =
    `${demand.commercial}%`;

  els.demandIndustrial.style.width =
    `${demand.industrial}%`;

  updateWarnings();

  updateSaveSlots();

  updateBankUI();
}

function setTool(tool) {

  selectedTool = tool;

  document
    .querySelectorAll(
      ".tool[data-tool]"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.tool ===
          tool
        );
      }
    );

  if (
    tool === "road"
  ) {

    setMessage(
      `Straße: ${
        roadRotation === 0
          ? "horizontal"
          : "vertikal"
      } · R zum Drehen`
    );
  }
}

document
  .querySelectorAll(
    ".tool[data-tool]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () =>
          setTool(
            button.dataset.tool
          )
      );
    }
  );

document
  .getElementById(
    "rotateRoad"
  )
  .addEventListener(
    "click",
    rotateRoad
  );

function rotateRoad() {

  roadRotation =
    (
      roadRotation + 1
    ) % 2;

  setMessage(
    `Straßenrichtung: ${
      roadRotation === 0
        ? "horizontal"
        : "vertikal"
    }`
  );

  draw();
}

window.addEventListener(
  "keydown",
  e => {

    if (
      e.key.toLowerCase() ===
      "r" &&
      selectedTool ===
      "road"
    ) {

      e.preventDefault();

      rotateRoad();
    }
  }
);

function buildAt(
  x,
  y,
  tool,
  silent = false
) {

  const existing =
    getTile(x, y);

  if (
    tool === "select"
  ) {

    if (!silent) {

      setMessage(
        existing
          ? `${existing.type} — Feld ${x}, ${y}`
          : "Dieses Feld ist leer."
      );
    }

    return;
  }

  if (
    tool === "bulldoze"
  ) {

    if (!existing) {
      return;
    }

    delete grid[
      key(x, y)
    ];

    vehicles =
      vehicles.filter(
        vehicle =>
          !vehicle.route.some(
            p =>
              p.x === x &&
              p.y === y
          )
      );

    money += 100;

    saveGame();

    updateUI();

    draw();

    if (!silent) {
      setMessage(
        "Objekt entfernt. +100 €"
      );
    }

    return;
  }

  if (existing) {

    if (!silent) {

      setMessage(
        "Dieses Feld ist bereits belegt."
      );
    }

    return;
  }

  const zone =
    [
      "residential",
      "commercial",
      "industrial"
    ].includes(
      tool
    );

  if (
    zone &&
    !hasAdjacentRoad(
      x,
      y
    )
  ) {

    if (!silent) {

      setMessage(
        "Gebiete müssen direkt an einer Straße liegen!"
      );
    }

    return;
  }

  if (
    money <
    COSTS[tool]
  ) {

    if (!silent) {

      setMessage(
        "Nicht genug Geld!"
      );
    }

    return;
  }

  money -=
    COSTS[tool];

  grid[
    key(x, y)
  ] = {
    type: tool,

    level:
      zone
        ? 0.5
        : 1
  };

  saveGame();

  updateUI();

  draw();
}

function getSaveKey(slot) {
  return `${SAVE_PREFIX}${slot}`;
}

function getSaveData() {

  return {
    version: "0.6",

    money,
    population,

    year,
    month,

    grid,
    vehicles,
    loans
  };
}

function saveGame() {

  localStorage.setItem(
    getSaveKey(
      currentSlot
    ),
    JSON.stringify(
      getSaveData()
    )
  );

  updateSaveSlots();
}

function loadSlot(slot) {

  const raw =
    localStorage.getItem(
      getSaveKey(slot)
    );

  if (!raw) {

    setMessage(
      "Dieser Speicherplatz ist leer."
    );

    return;
  }

  try {

    const data =
      JSON.parse(raw);

    money =
      data.money ??
      START_MONEY;

    population =
      data.population ??
      0;

    year =
      data.year ??
      1;

    month =
      data.month ??
      1;

    grid =
      data.grid || {};

    vehicles =
      Array.isArray(
        data.vehicles
      )
        ? data.vehicles
        : [];

    loans =
      Array.isArray(
        data.loans
      )
        ? data.loans
        : [];

    currentSlot =
      slot;

    updateUI();

    draw();

    setMessage(
      `Spielstand ${slot} geladen.`
    );

  } catch {

    setMessage(
      "Spielstand konnte nicht geladen werden."
    );
  }
}

function newGame() {

  const confirmed =
    confirm(
      "Möchtest du wirklich eine neue Stadt starten?\n\n" +
      "Der aktuelle Spielstand wird nicht automatisch gelöscht. " +
      "Du kannst ihn vorher in einem Speicherplatz sichern."
    );

  if (!confirmed) {
    return;
  }

  money =
    START_MONEY;

  population = 0;

  year = 1;
  month = 1;

  grid = {};

  vehicles = [];

  loans = [];

  zoom = 1;

  offsetX = 0;
  offsetY = 0;

  saveGame();

  updateUI();

  draw();

  setMessage(
    "Neue Stadt gestartet. 100.000 € Startkapital."
  );
}

document
  .getElementById(
    "newGame"
  )
  .addEventListener(
    "click",
    newGame
  );

function updateSaveSlots() {

  els.saveSlots.innerHTML =
    "";

  for (
    let slot = 1;
    slot <= 3;
    slot++
  ) {

    const raw =
      localStorage.getItem(
        getSaveKey(slot)
      );

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "save-slot";

    if (raw) {

      try {

        const data =
          JSON.parse(raw);

        const cityPopulation =
          data.population || 0;

        const cityMoney =
          data.money || 0;

        div.innerHTML = `
          <div class="save-slot-title">
            💾 Speicherplatz ${slot}
          </div>

          <div class="save-slot-info">
            Jahr ${data.year || 1} – Monat ${data.month || 1}
            · 👥 ${cityPopulation}
            · 💰 ${cityMoney.toLocaleString("de-DE")} €
          </div>

          <div class="slot-buttons">
            <button data-load="${slot}">
              Laden
            </button>

            <button data-save="${slot}">
              Überschreiben
            </button>

            <button data-delete="${slot}">
              Löschen
            </button>
          </div>
        `;

      } catch {

        div.innerHTML =
          `Speicherplatz ${slot} beschädigt.`;
      }

    } else {

      div.innerHTML = `
        <div class="save-slot-title">
          💾 Speicherplatz ${slot}
        </div>

        <div class="save-slot-info">
          Leer
        </div>

        <div class="slot-buttons">
          <button data-save="${slot}">
            Speichern
          </button>
        </div>
      `;
    }

    els.saveSlots.appendChild(
      div
    );
  }

  document
    .querySelectorAll(
      "[data-load]"
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            loadSlot(
              Number(
                button.dataset.load
              )
            );
      }
    );

  document
    .querySelectorAll(
      "[data-save]"
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            const slot =
              Number(
                button.dataset.save
              );

            currentSlot =
              slot;

            saveGame();

            setMessage(
              `Spiel in Speicherplatz ${slot} gespeichert.`
            );
          };
      }
    );

  document
    .querySelectorAll(
      "[data-delete]"
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            const slot =
              Number(
                button.dataset.delete
              );

            const confirmed =
              confirm(
                `Speicherplatz ${slot} wirklich löschen?`
              );

            if (!confirmed) {
              return;
            }

            localStorage.removeItem(
              getSaveKey(slot)
            );

            updateSaveSlots();

            setMessage(
              `Speicherplatz ${slot} gelöscht.`
            );
          };
      }
    );
}

function openBank() {

  updateBankUI();

  els.bankModal.classList.remove(
    "hidden"
  );
}

function closeBank() {

  els.bankModal.classList.add(
    "hidden"
  );
}

document
  .getElementById(
    "openBank"
  )
  .addEventListener(
    "click",
    openBank
  );

const closeBankButton = document.getElementById("closeBank");

closeBankButton.addEventListener("click", function (event) {
  event.preventDefault();
  event.stopPropagation();

  else.bankModal.classList.add("hidden");
});

els.bankModal.addEventListener("click", function (event){
  if (event.target === els.bankModel) {
    els.bankModal.classList.add("hidden");
  }
});

function getLoanRate(amount) {

  if (
    amount >= 100000
  ) {
    return 0.06;
  }

  return 0.05;
}

function getLoanPayment(
  amount,
  rate,
  months
) {

  const monthlyRate =
    rate / 12;

  if (
    monthlyRate === 0
  ) {
    return amount / months;
  }

  return (
    amount *
    monthlyRate *
    Math.pow(
      1 +
      monthlyRate,
      months
    )
  ) /
  (
    Math.pow(
      1 +
      monthlyRate,
      months
    ) -
    1
  );
}

function takeLoan(amount) {

  const rate =
    getLoanRate(
      amount
    );

  const totalDebt =
    calculateDebt();

  const maximumDebt =
    Math.max(
      100000,
      (
        countType(
          "residential"
        ) *
        5000
      ) +
      (
        countType(
          "commercial"
        ) *
        10000
      ) +
      (
        countType(
          "industrial"
        ) *
        15000
      )
    );

  if (
    totalDebt +
    amount >
    maximumDebt
  ) {

    setMessage(
      "Dieser Kredit würde dein Kreditlimit überschreiten."
    );

    return;
  }

  const months =
    24;

  const payment =
    getLoanPayment(
      amount,
      rate,
      months
    );

  loans.push({
    id:
      Date.now() +
      Math.random(),

    original:
      amount,

    remaining:
      amount,

    rate,

    monthsLeft:
      months,

    payment
  });

  money +=
    amount;

  saveGame();

  updateUI();

  updateBankUI();

  setMessage(
    `${amount.toLocaleString("de-DE")} € Kredit aufgenommen.`
  );
}

document
  .querySelectorAll(
    ".loan-button"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          takeLoan(
            Number(
              button.dataset.loan
            )
          );
        }
      );
    }
  );

function updateBankUI() {

  const debt =
    calculateDebt();

  els.bankMoney.textContent =
    `${Math.floor(
      money
    ).toLocaleString(
      "de-DE"
    )} €`;

  els.bankDebt.textContent =
    `${Math.floor(
      debt
    ).toLocaleString(
      "de-DE"
    )} €`;

  if (
    !loans.length
  ) {

    els.loanList.innerHTML =
      `<div class="loan-card">
        Keine aktiven Kredite.
      </div>`;

    return;
  }

  els.loanList.innerHTML =
    "";

  loans.forEach(
    (loan, index) => {

      const div =
        document.createElement(
          "div"
        );

      div.className =
        "loan-card";

      div.innerHTML = `
        <strong>
          Kredit #${index + 1}
        </strong>

        Restschuld:
        ${Math.floor(
          loan.remaining
        ).toLocaleString("de-DE")} €

        <br>

        Monatsrate:
        ${Math.floor(
          loan.payment
        ).toLocaleString("de-DE")} €

        <br>

        Zins:
        ${(loan.rate * 100).toFixed(1)} %

        <br>

        Restlaufzeit:
        ${loan.monthsLeft} Monate
      `;

      els.loanList.appendChild(
        div
      );
    }
  );
}

function advanceMonth() {

  updateBuildings();

  const payment =
    calculateLoanPayment();

  for (
    let i =
      loans.length - 1;
    i >= 0;
    i--
  ) {

    const loan =
      loans[i];

    const monthlyInterest =
      loan.remaining *
      (
        loan.rate / 12
      );

    const principal =
      Math.max(
        0,
        Math.min(
          loan.remaining,
          loan.payment -
          monthlyInterest
        )
      );

    loan.remaining -=
      principal;

    loan.monthsLeft--;

    if (
      loan.remaining <=
        0.01 ||
      loan.monthsLeft <= 0
    ) {

      loan.remaining = 0;

      loans.splice(
        i,
        1
      );
    }
  }

  money +=
    calculateBaseBalance();

  money -=
    payment;

  month++;

  if (
    month > 12
  ) {

    month = 1;
    year++;
  }

  updateUI();

  saveGame();

  setMessage(
    `Monat abgeschlossen. Monatsbilanz: ${
      calculateBalance() >= 0
        ? "+"
        : ""
    }${calculateBalance().toLocaleString("de-DE")} €`
  );
}

function getRoads() {

  return Object.entries(
    grid
  )
    .filter(
      ([, tile]) =>
        tile.type === "road"
    )
    .map(
      ([k]) => {

        const [x, y] =
          k.split(",")
            .map(Number);

        return {
          x,
          y
        };
      }
    );
}

function nearestRoad(
  x,
  y
) {

  const roads =
    getRoads();

  if (
    !roads.length
  ) {
    return null;
  }

  let best =
    roads[0];

  let bestDistance =
    Infinity;

  for (
    const road
    of roads
  ) {

    const distance =
      Math.abs(
        road.x - x
      ) +
      Math.abs(
        road.y - y
      );

    if (
      distance <
      bestDistance
    ) {

      bestDistance =
        distance;

      best =
        road;
    }
  }

  return best;
}

function roadPath(
  start,
  goal
) {

  if (
    !start ||
    !goal
  ) {
    return [];
  }

  const queue =
    [start];

  const came =
    new Map();

  came.set(
    key(
      start.x,
      start.y
    ),
    null
  );

  const goalKey =
    key(
      goal.x,
      goal.y
    );

  while (
    queue.length
  ) {

    const current =
      queue.shift();

    if (
      key(
        current.x,
        current.y
      ) ===
      goalKey
    ) {

      const path =
        [];

      let p =
        current;

      while (p) {

        path.unshift(
          p
        );

        p =
          came.get(
            key(
              p.x,
              p.y
            )
          );
      }

      return path;
    }

    const neighbors = [
      {
        x:
          current.x + 1,
        y:
          current.y
      },

      {
        x:
          current.x - 1,
        y:
          current.y
      },

      {
        x:
          current.x,
        y:
          current.y + 1
      },

      {
        x:
          current.x,
        y:
          current.y - 1
      }
    ];

    for (
      const neighbor
      of neighbors
    ) {

      const neighborKey =
        key(
          neighbor.x,
          neighbor.y
        );

      if (
        !isRoad(
          neighbor.x,
          neighbor.y
        ) ||
        came.has(
          neighborKey
        )
      ) {
        continue;
      }

      came.set(
        neighborKey,
        current
      );

      queue.push(
        neighbor
      );
    }
  }

  return [];
}

function randomZone(
  type
) {

  const candidates =
    [];

  for (
    const [k, tile]
    of Object.entries(
      grid
    )
  ) {

    if (
      tile.type !==
      type
    ) {
      continue;
    }

    const [x, y] =
      k.split(",")
        .map(Number);

    if (
      hasAdjacentRoad(
        x,
        y
      )
    ) {

      candidates.push({
        x,
        y
      });
    }
  }

  if (
    !candidates.length
  ) {
    return null;
  }

  return candidates[
    Math.floor(
      Math.random() *
      candidates.length
    )
  ];
}

function spawnVehicle() {

  if (
    vehicles.length >=
    MAX_VEHICLES
  ) {
    return;
  }

  const start =
    randomZone(
      "residential"
    );

  const target =
    randomZone(
      Math.random() < 0.5
        ? "commercial"
        : "industrial"
    );

  if (
    !start ||
    !target
  ) {
    return;
  }

  const startRoad =
    nearestRoad(
      start.x,
      start.y
    );

  const endRoad =
    nearestRoad(
      target.x,
      target.y
    );

  const route =
    roadPath(
      startRoad,
      endRoad
    );

  if (
    route.length < 2
  ) {
    return;
  }

  vehicles.push({
    route,

    index: 0,

    progress: 0,

    speed:
      1.8 +
      Math.random() *
      0.9
  });
}

function updateVehicles(
  delta
) {

  vehicleSpawnTimer +=
    delta;

  const desired =
    Math.min(
      MAX_VEHICLES,
      Math.floor(
        population / 8
      ) +
      Math.floor(
        calculateJobs() /
        10
      )
    );

  if (
    vehicleSpawnTimer >=
    1.2 &&
    vehicles.length <
    desired
  ) {

    vehicleSpawnTimer = 0;

    spawnVehicle();
  }

  for (
    let i =
      vehicles.length - 1;
    i >= 0;
    i--
  ) {

    const vehicle =
      vehicles[i];

    const traffic =
      calculateTraffic();

    const speedFactor =
      traffic > 70
        ? 0.45
        : traffic > 50
          ? 0.7
          : 1;

    vehicle.progress +=
      vehicle.speed *
      speedFactor *
      delta;

    if (
      vehicle.progress >=
      1
    ) {

      vehicle.progress = 0;

      vehicle.index++;

      if (
        vehicle.index >=
        vehicle.route.length
      ) {

        vehicles.splice(
          i,
          1
        );
      }
    }
  }
}

canvas.addEventListener(
  "mousedown",
  e => {

    lastPointer = {
      x: e.clientX,
      y: e.clientY
    };

    movedPointer = false;

    if (
      e.button === 1
    ) {

      panning = true;

      return;
    }

    if (
      e.button === 0
    ) {

      building =
        ![
          "select",
          "bulldoze"
        ].includes(
          selectedTool
        );

      if (
        building
      ) {

        const p =
          screenToWorld(
            e.clientX,
            e.clientY
          );

        buildAt(
          p.x,
          p.y,
          selectedTool,
          true
        );
      }
    }
  }
);

window.addEventListener(
  "mousemove",
  e => {

    const dx =
      e.clientX -
      lastPointer.x;

    const dy =
      e.clientY -
      lastPointer.y;

    if (
      Math.abs(dx) +
      Math.abs(dy) > 1
    ) {

      movedPointer =
        true;
    }

    if (
      panning
    ) {

      offsetX += dx;
      offsetY += dy;

      draw();
    }

    if (
      building
    ) {

      const p =
        screenToWorld(
          e.clientX,
          e.clientY
        );

      buildAt(
        p.x,
        p.y,
        selectedTool,
        true
      );
    }

    lastPointer = {
      x: e.clientX,
      y: e.clientY
    };
  }
);

window.addEventListener(
  "mouseup",
  () => {

    panning = false;
    building = false;
  }
);

canvas.addEventListener(
  "click",
  e => {

    if (
      movedPointer
    ) {
      return;
    }

    if (
      selectedTool ===
        "select" ||
      selectedTool ===
        "bulldoze"
    ) {

      const p =
        screenToWorld(
          e.clientX,
          e.clientY
        );

      buildAt(
        p.x,
        p.y,
        selectedTool
      );
    }
  }
);

canvas.addEventListener(
  "contextmenu",
  e => {

    e.preventDefault();

    const p =
      screenToWorld(
        e.clientX,
        e.clientY
      );

    buildAt(
      p.x,
      p.y,
      "bulldoze"
    );
  }
);

canvas.addEventListener(
  "wheel",
  e => {

    e.preventDefault();

    const r =
      canvas.getBoundingClientRect();

    const mx =
      e.clientX -
      r.left;

    const my =
      e.clientY -
      r.top;

    const oldZoom =
      zoom;

    const wx =
      (
        mx -
        offsetX
      ) /
      oldZoom;

    const wy =
      (
        my -
        offsetY
      ) /
      oldZoom;

    zoom *=
      e.deltaY < 0
        ? 1.1
        : 0.9;

    zoom =
      Math.max(
        0.35,
        Math.min(
          3,
          zoom
        )
      );

    offsetX =
      mx -
      wx * zoom;

    offsetY =
      my -
      wy * zoom;

    draw();
  },
  {
    passive: false
  }
);

let touches =
  new Map();

let touchMoved = false;

let pinchStartDistance = 0;

let pinchStartZoom = 1;

canvas.addEventListener(
  "touchstart",
  e => {

    for (
      const touch
      of e.changedTouches
    ) {

      touches.set(
        touch.identifier,
        {
          x:
            touch.clientX,

          y:
            touch.clientY,

          startX:
            touch.clientX,

          startY:
            touch.clientY
        }
      );
    }

    if (
      touches.size === 2
    ) {

      pinchStartDistance =
        getTouchDistance();

      pinchStartZoom =
        zoom;
    }
  },
  {
    passive: false
  }
);

canvas.addEventListener(
  "touchmove",
  e => {

    e.preventDefault();

    for (
      const touch
      of e.changedTouches
    ) {

      const data =
        touches.get(
          touch.identifier
        );

      if (data) {

        const dx =
          touch.clientX -
          data.startX;

        const dy =
          touch.clientY -
          data.startY;

        if (
          Math.hypot(
            dx,
            dy
          ) > 6
        ) {

          touchMoved = true;
        }

        data.x =
          touch.clientX;

        data.y =
          touch.clientY;
      }
    }

    if (
      touches.size === 1
    ) {

      const data =
        [
          ...touches.values()
        ][0];

      const dx =
        data.x -
        data.startX;

      const dy =
        data.y -
        data.startY;

      offsetX += dx;
      offsetY += dy;

      data.startX =
        data.x;

      data.startY =
        data.y;

      draw();
    }

    if (
      touches.size === 2 &&
      pinchStartDistance
    ) {

      zoom =
        pinchStartZoom *
        (
          getTouchDistance() /
          pinchStartDistance
        );

      zoom =
        Math.max(
          0.35,
          Math.min(
            3,
            zoom
          )
        );

      draw();
    }
  },
  {
    passive: false
  }
);

canvas.addEventListener(
  "touchend",
  e => {

    e.preventDefault();

    for (
      const touch
      of e.changedTouches
    ) {

      const data =
        touches.get(
          touch.identifier
        );

      if (
        data &&
        touches.size === 1 &&
        !touchMoved
      ) {

        const p =
          screenToWorld(
            touch.clientX,
            touch.clientY
          );

        buildAt(
          p.x,
          p.y,
          selectedTool
        );
      }

      touches.delete(
        touch.identifier
      );
    }

    if (
      touches.size < 2
    ) {

      pinchStartDistance = 0;
    }

    touchMoved = false;
  },
  {
    passive: false
  }
);

function getTouchDistance() {

  const values =
    [
      ...touches.values()
    ];

  if (
    values.length < 2
  ) {
    return 0;
  }

  return Math.hypot(
    values[0].x -
      values[1].x,

    values[0].y -
      values[1].y
  );
}

loadSlot(1);

if (
  !localStorage.getItem(
    getSaveKey(1)
  )
) {

  money =
    START_MONEY;

  saveGame();
}

updateUI();

resizeCanvas();

setInterval(
  advanceMonth,
  20000
);

function gameLoop(
  now
) {

  const delta =
    Math.min(
      0.1,
      (
        now -
        lastFrame
      ) /
      1000
    );

  lastFrame =
    now;

  updateVehicles(
    delta
  );

  updateUI();

  draw();

  requestAnimationFrame(
    gameLoop
  );
}

requestAnimationFrame(
  gameLoop
);