const canvas = document.getElementById("gameCanvas");

const ctx = canvas.getContext("2d");

const TILE = 32;

const SAVE_KEY = "cityBuilder1";

const COSTS = {

  road: 50,

  power: 5000,

  water: 4000,

  residential: 500,

  commercial: 800,

  industrial: 1000

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

let money = 50000;

let population = 0;

let year = 1;

let month = 1;

let selectedTool = "select";

let roadRotation = 0; // 0 = horizontal, 1 = vertical

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

let touches = new Map();

let pinchStartDistance = 0;

let pinchStartZoom = 1;

let touchMoved = false;

let vehicles = [];

let vehicleSpawnTimer = 0;

let lastFrame = performance.now();

let grid = {};

const els = {

  money: document.getElementById("money"),

  population: document.getElementById("population"),

  vehicles: document.getElementById("vehicles"),

  date: document.getElementById("date"),

  housing: document.getElementById("housing"),

  commercial: document.getElementById("commercial"),

  industrial: document.getElementById("industrial"),

  power: document.getElementById("power"),

  water: document.getElementById("water"),

  jobs: document.getElementById("jobs"),

  vehicleCount: document.getElementById("vehicleCount"),

  traffic: document.getElementById("traffic"),

  balance: document.getElementById("balance"),

  demandResidential: document.getElementById("demandResidential"),

  demandCommercial: document.getElementById("demandCommercial"),

  demandIndustrial: document.getElementById("demandIndustrial"),

  warning: document.getElementById("warning"),

  message: document.getElementById("message"),

  rotateRoad: document.getElementById("rotateRoad")

};

function resizeCanvas() {

  const r = canvas.getBoundingClientRect();

  const d = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.floor(r.width * d));

  canvas.height = Math.max(1, Math.floor(r.height * d));

  ctx.setTransform(d, 0, 0, d, 0, 0);

  draw();

}

window.addEventListener("resize", resizeCanvas);

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

  let n = 0;

  for (const tile of Object.values(grid)) {

    if (tile.type === type) {

      n++;

    }

  }

  return n;

}

function setMessage(text) {

  els.message.textContent = text;

  clearTimeout(setMessage.timer);

  setMessage.timer = setTimeout(() => {

    els.message.textContent = "";

  }, 2600);

}

function screenToWorld(clientX, clientY) {

  const r = canvas.getBoundingClientRect();

  return {

    x: Math.floor(

      (clientX - r.left - offsetX) / zoom / TILE

    ),

    y: Math.floor(

      (clientY - r.top - offsetY) / zoom / TILE

    )

  };

}

function worldToScreen(x, y) {

  return {

    x: x * TILE * zoom + offsetX,

    y: y * TILE * zoom + offsetY

  };

}

/*

  Straßen-Verbindungen:

  N = 1

  E = 2

  S = 4

  W = 8

*/

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

function connectedRoadDirection(x, y) {

  const mask = roadMask(x, y);

  if (mask === 10) {

    return "horizontal";

  }

  if (mask === 5) {

    return "vertical";

  }

  if (

    mask === 3 ||

    mask === 6 ||

    mask === 12 ||

    mask === 9

  ) {

    return "corner";

  }

  return roadRotation === 0

    ? "horizontal"

    : "vertical";

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

    if (connectedRoadDirection(x, y) === "horizontal") {

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

  const horizontal =

    mask === 10 ||

    mask === 3 ||

    mask === 6 ||

    mask === 12 ||

    (mask === 0 && roadRotation === 0);

  ctx.strokeStyle = "#e5e7a6";

  ctx.lineWidth = Math.max(1, 1.5 * zoom);

  ctx.setLineDash([

    6 * zoom,

    6 * zoom

  ]);

  ctx.beginPath();

  if (horizontal) {

    ctx.moveTo(p.x, cy);

    ctx.lineTo(p.x + s, cy);

  } else {

    ctx.moveTo(cx, p.y);

    ctx.lineTo(cx, p.y + s);

  }

  ctx.stroke();

  ctx.setLineDash([]);

}

function drawBuilding(x, y, tile) {

  const p = worldToScreen(x, y);

  const s = TILE * zoom;

  const colors = {

    power: "#f59e0b",

    water: "#3b82f6",

    residential: "#22c55e",

    commercial: "#a855f7",

    industrial: "#f97316"

  };

  const icons = {

    power: "⚡",

    water: "💧",

    residential: "🏠",

    commercial: "🏪",

    industrial: "🏭"

  };

  ctx.fillStyle =

    colors[tile.type] || "#6b7280";

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

    `${Math.max(10, s * 0.48)}px Arial`;

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

    const w = s * 0.74;

    const h = Math.max(2, s * 0.07);

    ctx.fillStyle = "#111827";

    ctx.fillRect(

      p.x + (s - w) / 2,

      p.y + s - h - 3,

      w,

      h

    );

    ctx.fillStyle = "#fff";

    ctx.fillRect(

      p.x + (s - w) / 2,

      p.y + s - h - 3,

      w * (tile.level || 0.5),

      h

    );

  }

}

function drawGrid() {

  const r = canvas.getBoundingClientRect();

  ctx.save();

  ctx.translate(offsetX, offsetY);

  ctx.scale(zoom, zoom);

  const sx =

    Math.floor(

      (-offsetX / zoom) / TILE

    ) - 1;

  const ex =

    Math.ceil(

      (r.width - offsetX) / zoom / TILE

    ) + 1;

  const sy =

    Math.floor(

      (-offsetY / zoom) / TILE

    ) - 1;

  const ey =

    Math.ceil(

      (r.height - offsetY) / zoom / TILE

    ) + 1;

  ctx.strokeStyle = "#6c995b";

  ctx.lineWidth = 1 / zoom;

  for (let x = sx; x <= ex; x++) {

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

  for (let y = sy; y <= ey; y++) {

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

  for (const vehicle of vehicles) {

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

      a.x * TILE + TILE / 2;

    const ay =

      a.y * TILE + TILE / 2;

    const bx =

      b.x * TILE + TILE / 2;

    const by =

      b.y * TILE + TILE / 2;

    const wx =

      ax +

      (bx - ax) * vehicle.progress;

    const wy =

      ay +

      (by - ay) * vehicle.progress;

    const sx =

      wx * zoom + offsetX;

    const sy =

      wy * zoom + offsetY;

    const radius =

      Math.max(3, 6 * zoom);

    ctx.fillStyle = "#f8fafc";

    ctx.beginPath();

    ctx.arc(

      sx,

      sy,

      radius / 2,

      0,

      Math.PI * 2

    );

    ctx.fill();

  }

}

function draw() {

  const r = canvas.getBoundingClientRect();

  ctx.clearRect(

    0,

    0,

    r.width,

    r.height

  );

  ctx.fillStyle = "#78a85a";

  ctx.fillRect(

    0,

    0,

    r.width,

    r.height

  );

  drawGrid();

  for (const [k, tile] of Object.entries(grid)) {

    const [x, y] =

      k.split(",").map(Number);

    if (tile.type === "road") {

      drawRoad(x, y);

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

  for (const tile of Object.values(grid)) {

    if (tile.type === "residential") {

      powerDemand += 1;

      waterDemand += 1;

    }

    if (tile.type === "commercial") {

      powerDemand += 2;

      waterDemand += 2;

    }

    if (tile.type === "industrial") {

      powerDemand += 4;

      waterDemand += 4;

    }

  }

  return {

    powerCapacity,

    waterCapacity,

    powerDemand,

    waterDemand,

    powerOK:

      powerDemand <= powerCapacity,

    waterOK:

      waterDemand <= waterCapacity

  };

}

function calculatePopulation() {

  const i = infrastructure();

  let capacity = 0;

  for (const [k, tile] of Object.entries(grid)) {

    if (tile.type !== "residential") {

      continue;

    }

    const [x, y] =

      k.split(",").map(Number);

    if (hasAdjacentRoad(x, y)) {

      capacity += CAPACITY.residential;

    }

  }

  population = Math.floor(

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

  for (const tile of Object.values(grid)) {

    result += JOBS[tile.type] || 0;

  }

  return result;

}

function calculateBalance() {

  let result = 0;

  for (const tile of Object.values(grid)) {

    result += BASE_INCOME[tile.type] || 0;

    result -= BASE_EXPENSE[tile.type] || 0;

    if (tile.type === "power") {

      result -= 40;

    }

    if (tile.type === "water") {

      result -= 30;

    }

    if (tile.type === "road") {

      result -= 1;

    }

  }

  result += Math.floor(

    population * 3

  );

  return result;

}

function calculateDemand() {

  const residential =

    Math.max(

      0,

      Math.min(

        100,

        60 -

        countType("residential") * 4 +

        population * 0.1

      )

    );

  const commercial =

    Math.max(

      0,

      Math.min(

        100,

        40 +

        population * 0.45 -

        countType("commercial") * 7

      )

    );

  const industrial =

    Math.max(

      0,

      Math.min(

        100,

        40 +

        population * 0.3 -

        countType("industrial") * 7 +

        (

          population >

          calculateJobs() * 2

            ? 15

            : 0

        )

      )

    );

  return {

    residential,

    commercial,

    industrial

  };

}

function trafficLoadMap() {

  const loads = new Map();

  for (const vehicle of vehicles) {

    const p =

      vehicle.route[

        Math.min(

          vehicle.index,

          vehicle.route.length - 1

        )

      ];

    const k = key(p.x, p.y);

    loads.set(

      k,

      (loads.get(k) || 0) + 1

    );

  }

  return loads;

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

  const loads =

    trafficLoadMap();

  let total = 0;

  for (const [k] of roads) {

    total += Math.min(

      100,

      (

        (loads.get(k) || 0) /

        ROAD_CAPACITY

      ) * 100

    );

  }

  return Math.round(

    total / roads.length

  );

}

function updateWarnings(i, traffic) {

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

  if (traffic >= 70) {

    warnings.push(

      "🚗 Hohe Verkehrsbelastung"

    );

  }

  els.warning.textContent =

    warnings.join(" · ");

  els.warning.classList.toggle(

    "hidden",

    warnings.length === 0

  );

}

function updateUI() {

  calculatePopulation();

  const i =

    infrastructure();

  const demand =

    calculateDemand();

  const traffic =

    calculateTraffic();

  const balance =

    calculateBalance();

  const jobs =

    calculateJobs();

  els.money.textContent =

    `${Math.floor(money).toLocaleString("de-DE")} €`;

  els.population.textContent =

    population.toLocaleString("de-DE");

  els.vehicles.textContent =

    vehicles.length.toLocaleString("de-DE");

  els.vehicleCount.textContent =

    vehicles.length.toLocaleString("de-DE");

  els.date.textContent =

    `Jahr ${year} – Monat ${month}`;

  els.housing.textContent =

    countType("residential");

  els.commercial.textContent =

    countType("commercial");

  els.industrial.textContent =

    countType("industrial");

  els.power.textContent =

    `${i.powerDemand} / ${i.powerCapacity}`;

  els.water.textContent =

    `${i.waterDemand} / ${i.waterCapacity}`;

  els.jobs.textContent =

    jobs.toLocaleString("de-DE");

  els.traffic.textContent =

    `${traffic}%`;

  els.balance.textContent =

    `${balance >= 0 ? "+" : ""}${balance.toLocaleString("de-DE")} €`;

  els.demandResidential.style.width =

    `${demand.residential}%`;

  els.demandCommercial.style.width =

    `${demand.commercial}%`;

  els.demandIndustrial.style.width =

    `${demand.industrial}%`;

  updateWarnings(

    i,

    traffic

  );

}

function setTool(tool) {

  selectedTool = tool;

  document

    .querySelectorAll(".tool[data-tool]")

    .forEach(button => {

      button.classList.toggle(

        "active",

        button.dataset.tool === tool

      );

    });

  if (tool === "road") {

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

  .querySelectorAll(".tool[data-tool]")

  .forEach(button => {

    button.addEventListener(

      "click",

      () => setTool(button.dataset.tool)

    );

  });

els.rotateRoad.addEventListener(

  "click",

  rotateRoad

);

function rotateRoad() {

  roadRotation =

    (roadRotation + 1) % 2;

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

      e.key.toLowerCase() === "r" &&

      selectedTool === "road" &&

      !e.ctrlKey &&

      !e.altKey &&

      !e.metaKey

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

  if (tool === "select") {

    if (!silent) {

      setMessage(

        existing

          ? `${existing.type} — Feld ${x}, ${y}`

          : "Dieses Feld ist leer."

      );

    }

    return false;

  }

  if (tool === "bulldoze") {

    if (!existing) {

      return false;

    }

    delete grid[key(x, y)];

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

    updateUI();

    saveGame();

    draw();

    if (!silent) {

      setMessage(

        "Objekt entfernt. +100 €"

      );

    }

    return true;

  }

  if (existing) {

    if (!silent) {

      setMessage(

        "Dieses Feld ist bereits belegt."

      );

    }

    return false;

  }

  const zone =

    tool === "residential" ||

    tool === "commercial" ||

    tool === "industrial";

  if (

    zone &&

    !hasAdjacentRoad(x, y)

  ) {

    if (!silent) {

      setMessage(

        "Gebiete müssen direkt an einer Straße liegen!"

      );

    }

    return false;

  }

  if (money < COSTS[tool]) {

    if (!silent) {

      setMessage(

        "Nicht genug Geld!"

      );

    }

    return false;

  }

  money -= COSTS[tool];

  grid[key(x, y)] = {

    type: tool,

    level: zone ? 0.5 : 1

  };

  updateUI();

  saveGame();

  draw();

  return true;

}

function saveGame() {

  localStorage.setItem(

    SAVE_KEY,

    JSON.stringify({

      version: "0.5",

      money,

      population,

      year,

      month,

      grid,

      vehicles

    })

  );

}

function loadGame() {

  const raw =

    localStorage.getItem(SAVE_KEY) ||

    localStorage.getItem("cityBuilder3");

  if (!raw) {

    return;

  }

  try {

    const data =

      JSON.parse(raw);

    money =

      data.money ?? money;

    population =

      data.population ?? population;

    year =

      data.year ?? year;

    month =

      data.month ?? month;

    grid =

      data.grid &&

      typeof data.grid === "object"

        ? data.grid

        : {};

    vehicles =

      Array.isArray(data.vehicles)

        ? data.vehicles

        : [];

  } catch {

    setMessage(

      "Spielstand konnte nicht geladen werden."

    );

  }

}

function getRoads() {

  return Object.entries(grid)

    .filter(

      ([, tile]) =>

        tile.type === "road"

    )

    .map(([k]) => {

      const [x, y] =

        k.split(",").map(Number);

      return {

        x,

        y

      };

    });

}

function nearestRoad(x, y) {

  const roads =

    getRoads();

  if (!roads.length) {

    return null;

  }

  let best =

    roads[0];

  let bestD =

    Infinity;

  for (const road of roads) {

    const d =

      Math.abs(

        road.x - x

      ) +

      Math.abs(

        road.y - y

      );

    if (d < bestD) {

      bestD = d;

      best = road;

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

    !goal ||

    !isRoad(start.x, start.y) ||

    !isRoad(goal.x, goal.y)

  ) {

    return [];

  }

  const queue = [start];

  const came =

    new Map([

      [

        key(start.x, start.y),

        null

      ]

    ]);

  const goalKey =

    key(goal.x, goal.y);

  while (queue.length) {

    const current =

      queue.shift();

    const neighbors = [

      {

        x: current.x + 1,

        y: current.y

      },

      {

        x: current.x - 1,

        y: current.y

      },

      {

        x: current.x,

        y: current.y + 1

      },

      {

        x: current.x,

        y: current.y - 1

      }

    ];

    for (const neighbor of neighbors) {

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

        came.has(neighborKey)

      ) {

        continue;

      }

      came.set(

        neighborKey,

        current

      );

      if (

        neighborKey === goalKey

      ) {

        const path = [];

        let p =

          neighbor;

        while (p) {

          path.unshift(p);

          p =

            came.get(

              key(p.x, p.y)

            );

        }

        return path;

      }

      queue.push(

        neighbor

      );

    }

  }

  return [];

}

function randomZone(type) {

  const candidates = [];

  for (

    const [k, tile]

    of Object.entries(grid)

  ) {

    if (

      tile.type !== type

    ) {

      continue;

    }

    const [x, y] =

      k.split(",").map(Number);

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

  return candidates.length

    ? candidates[

        Math.floor(

          Math.random() *

          candidates.length

        )

      ]

    : null;

}

function spawnVehicle() {

  if (

    vehicles.length >=

    MAX_VEHICLES

  ) {

    return;

  }

  const startZone =

    randomZone(

      "residential"

    );

  const targetZone =

    Math.random() < 0.6

      ? (

          randomZone(

            "commercial"

          ) ||

          randomZone(

            "industrial"

          )

        )

      : (

          randomZone(

            "industrial"

          ) ||

          randomZone(

            "commercial"

          )

        );

  if (

    !startZone ||

    !targetZone

  ) {

    return;

  }

  const startRoad =

    nearestRoad(

      startZone.x,

      startZone.y

    );

  const endRoad =

    nearestRoad(

      targetZone.x,

      targetZone.y

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

      Math.random() * 0.9

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

        calculateJobs() / 10

      )

    );

  if (

    vehicleSpawnTimer >= 1.2 &&

    vehicles.length < desired

  ) {

    vehicleSpawnTimer = 0;

    spawnVehicle();

  }

  const loads =

    trafficLoadMap();

  for (

    let i =

      vehicles.length - 1;

    i >= 0;

    i--

  ) {

    const vehicle =

      vehicles[i];

    const p =

      vehicle.route[

        Math.min(

          vehicle.index,

          vehicle.route.length - 1

        )

      ];

    const load =

      loads.get(

        key(p.x, p.y)

      ) || 0;

    const factor =

      load > ROAD_CAPACITY

        ? 0.45

        : load >

          ROAD_CAPACITY * 0.7

          ? 0.7

          : 1;

    vehicle.progress +=

      vehicle.speed *

      factor *

      delta;

    if (

      vehicle.progress >= 1

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

function advanceMonth() {

  money +=

    calculateBalance();

  month++;

  if (month > 12) {

    month = 1;

    year++;

  }

  updateUI();

  saveGame();

  const balance =

    calculateBalance();

  setMessage(

    `Monat abgeschlossen: ${

      balance >= 0 ? "+" : ""

    }${balance.toLocaleString("de-DE")} €`

  );

}

canvas.addEventListener(

  "mousedown",

  e => {

    lastPointer = {

      x: e.clientX,

      y: e.clientY

    };

    movedPointer = false;

    if (e.button === 1) {

      panning = true;

      return;

    }

    if (e.button === 0) {

      building =

        ![

          "select",

          "bulldoze"

        ].includes(selectedTool);

      if (

        selectedTool !== "select" &&

        selectedTool !== "bulldoze"

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

      movedPointer = true;

    }

    if (panning) {

      offsetX += dx;

      offsetY += dy;

      draw();

    }

    if (building) {

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

    if (movedPointer) {

      return;

    }

    if (

      selectedTool === "select" ||

      selectedTool === "bulldoze"

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

    const old =

      zoom;

    const wx =

      (mx - offsetX) /

      old;

    const wy =

      (my - offsetY) /

      old;

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

      mx - wx * zoom;

    offsetY =

      my - wy * zoom;

    draw();

  },

  {

    passive: false

  }

);

canvas.addEventListener(

  "touchstart",

  e => {

    for (

      const t

      of e.changedTouches

    ) {

      touches.set(

        t.identifier,

        {

          x: t.clientX,

          y: t.clientY,

          startX: t.clientX,

          startY: t.clientY

        }

      );

    }

    touchMoved = false;

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

      const t

      of e.changedTouches

    ) {

      const old =

        touches.get(

          t.identifier

        );

      if (old) {

        old.x =

          t.clientX;

        old.y =

          t.clientY;

      }

    }

    if (

      touches.size === 1

    ) {

      const t =

        [

          ...touches.values()

        ][0];

      const dx =

        t.x - t.startX;

      const dy =

        t.y - t.startY;

      if (

        Math.hypot(

          dx,

          dy

        ) > 6

      ) {

        touchMoved = true;

        offsetX += dx;

        offsetY += dy;

        t.startX = t.x;

        t.startY = t.y;

        draw();

      }

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

      touchMoved = true;

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

      const t

      of e.changedTouches

    ) {

      const data =

        touches.get(

          t.identifier

        );

      if (

        data &&

        touches.size === 1 &&

        !touchMoved

      ) {

        const p =

          screenToWorld(

            t.clientX,

            t.clientY

          );

        buildAt(

          p.x,

          p.y,

          selectedTool

        );

      }

      touches.delete(

        t.identifier

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

canvas.addEventListener(

  "touchcancel",

  e => {

    for (

      const t

      of e.changedTouches

    ) {

      touches.delete(

        t.identifier

      );

    }

    pinchStartDistance = 0;

    touchMoved = false;

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

loadGame();

updateUI();

resizeCanvas();

setInterval(

  advanceMonth,

  20000

);

function gameLoop(now) {

  const delta =

    Math.min(

      0.1,

      (now - lastFrame) / 1000

    );

  lastFrame = now;

  updateVehicles(

    delta

  );

  if (

    Math.floor(now / 500) !==

    Math.floor(

      (now - delta * 1000) / 500

    )

  ) {

    updateUI();

    draw();

  }

  requestAnimationFrame(

    gameLoop

  );

}

requestAnimationFrame(

  gameLoop

);