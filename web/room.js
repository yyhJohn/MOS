(() => {
  "use strict";

  const canvas = document.querySelector("#room-canvas");
  const ctx = canvas.getContext("2d");
  const room = document.querySelector("#room-view");
  const motionStatus = document.querySelector("#motion-status");
  const residentToggle = document.querySelector("#resident-toggle");
  const residentHint = document.querySelector("#resident-hint");
  const objectName = document.querySelector("#room-object-name");
  const floorWidth = 11.4, floorDepth = 7.9;
  const kitchenCounter = [5.03,6.36,2.62,1.31];
  const bed = [4.61,.34,1.47,2.16];
  const bedsideTable = [4.78,2.57,.62,.58];
  const switchPost = [5.75,2.50,.43,.48];
  const privateDivider = [[6.33,2.17,.72,.16], [7.95,2.17,.56,.16]];
  const obstacles = [
    [.64,4.36,1.58,2.99], [2.86,5.21,1.54,1.17], [.99,.98,3.43,1.25], [2.32,2.65,.86,.80],
    [7.69,4.02,1.39,1.37], [6.27,.05,.14,2.25], [8.42,.11,.13,2.16], ...privateDivider,
    [.83,3.63,.49,.49], [10.53,6.5,.35,.35], kitchenCounter, bed, bedsideTable, switchPost
  ];
  const areaStops = {
    Entryway: { x:9.53, y:4.8, target:"entry" }, Workspace: { x:3.30, y:3.7, target:"park" },
    "Living area": { x:3.1, y:6.74, target:"sofa" }, "Private zone": { x:7.5, y:1.4, target:"private" }
  };
  const fullPath = [
    [1.7, 1.35, 2.94], [3.1, 1.35, 2.94], [4.6, 2.42, 2.94],
    [5.4, 4.04, 2.94], [6.8, 5.44, 2.94], [8.73, 5.55, 2.94],
    [9.76, 4.38, 2.94], [9.76, 2.88, 2.94]
  ];
  const distances = [0];
  for (let index = 1; index < fullPath.length; index += 1) {
    const [x, y] = fullPath[index];
    const [px, py] = fullPath[index - 1];
    distances.push(distances[index - 1] + Math.hypot(x - px, y - py));
  }
  const trackStops = {
    idle: distances[3], park: distances[1], entry: distances[5], door: distances[7],
    sofa: distances[3], kitchen: distances[4], private: distances[2], preview: distances[1]
  };
  const gantry = { left: .95, right: 10.5, near: 2.65, far: 6.7, height: 2.94 };
  const gantryStops = {
    idle: [5.4, 4.04, gantry.height],
    park: [4.25, 3.2, gantry.height],
    entry: [8.16, 4.85, gantry.height],
    door: [9.76, 2.88, gantry.height],
    sofa: [2.44, 5.80, gantry.height],
    kitchen: [6.52, 6.18, gantry.height],
    private: [7.45, 2.65, gantry.height],
    preview: [2.15, 6.14, gantry.height]
  };
  const locations = { entry: [8.38, 4.62, .79], sofa: [2.58, 6.36, .04], kitchen: [6.78, 6.89, .88] };
  const items = {
    glasses: { label: "Glasses", name: "glasses", zh: "眼镜", place: "on the coffee table", placeZh: "客厅茶几上", zone: "living", point: [4.05, 5.48, .46] },
    umbrella: { label: "Umbrella", name: "umbrella", zh: "雨伞", place: "by the entryway cabinet", placeZh: "玄关柜旁", zone: "entry", point: [9.40, 3.60, .68] },
    keys: { label: "Keys", name: "keys", zh: "钥匙", place: "in the entryway tray", placeZh: "玄关托盘里", zone: "entry", point: [8.38, 4.62, .875] },
    backpack: { label: "Backpack", name: "backpack", zh: "书包", place: "beside the desk", placeZh: "书桌旁", zone: "study", point: [4.30, 2.66, .57] }
  };
  const napkin = { label:"Napkin", name:"napkin", point:[7.35,6.96,.96] };
  const itemShapes = {
    glasses: [-.31,-.16,-.015,.62,.27,.09],
    umbrella: [-.23,-.028,-.64,.53,.19,1.10],
    keys: [-.12,-.077,-.02,.44,.25,.055],
    backpack: [-.30,-.18,-.54,.59,.48,.74],
    napkin: [-.22,-.14,-.02,.44,.31,.05]
  };
  const lightSwitch = [5.965,3.025,1.31];
  const roomItems = {...items,napkin};
  const landmarks = {
    computer: { label:"Computer", name:"computer", zh:"电脑", place:"on the desk in the workspace", placeZh:"工作区的书桌上", zone:"study", point:[2.72,1.31,1.42] },
    desk: { label:"Desk", name:"desk", zh:"书桌", place:"along the back wall of the workspace", placeZh:"工作区靠墙的位置", zone:"study", point:[3.79,1.68,.87] },
    couch: { label:"Sofa", name:"sofa", zh:"沙发", place:"on the left side of the living area", placeZh:"客厅左侧", zone:"living", point:[1.46,5.76,.61] },
    coffee_table: { label:"Coffee table", name:"coffee table", zh:"茶几", place:"in front of the sofa", placeZh:"沙发前面", zone:"living", point:[3.34,5.86,.39] },
    front_door: { label:"Front door", name:"front door", zh:"大门", place:"at the back of the entryway", placeZh:"玄关后侧", zone:"entry", point:[9.48,.15,1.12] },
    workspace: { label:"Workspace", name:"workspace", zh:"工作区", place:"around the desk", placeZh:"书桌周围", zone:"study", point:[3.32,3.18,.07], area:true },
    living_area: { label:"Living area", name:"living area", zh:"客厅", place:"around the sofa and coffee table", placeZh:"沙发和茶几周围", zone:"living", point:[3.45,6.52,.07], area:true },
    entryway: { label:"Entryway", name:"entryway", zh:"玄关", place:"by the front door and entry cabinet", placeZh:"大门和玄关柜旁", zone:"entry", point:[9.62,4.76,.07], area:true },
    private_zone: { label:"Private zone", name:"private zone", zh:"私人区", place:"behind the partition", placeZh:"隔断后面", zone:"private", point:[7.42,1.22,.08], area:true },
    resident: { label:"You", name:"you", zh:"你" }
  };
  for (const [id, { point }] of Object.entries({
    ...roomItems, ...landmarks, light_switch:{point:lightSwitch}
  })) {
    if (!point) continue;
    const [x, y] = point;
    gantryStops[id] = [
      Math.min(gantry.right, x + .32),
      Math.max(gantry.near, Math.min(gantry.far, y - .24)),
      gantry.height
    ];
    trackStops[id] = nearestTrackStop(x, y);
  }
  const gripDuration = 1750;
  const gripRelease = 800;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let model = { rail: "gantry", camera: false, zones: [], target: "idle", spotlight: false, doorOpen: false };
  let roomLabels=[];
  const roomObjects = [];
  let hoverPoint = null;
  let tappedObject = null;
  let pressedPointer = "";
  let carrier = gantryStops.idle;
  let motion;
  let pan;
  let yaw = .91;
  let doorTransition;
  let doorAmount = 0;
  let doorPulseAt = -Infinity;
  let curtainAmount = 0;
  let curtainTransition;
  let spotlightAt = -Infinity;
  let gripMotion = null;
  let residentMotion = null;
  let frame = 0;
  let scale = 1;
  let origin = [0, 0];
  let width = 0;
  let height = 0;

  const wood = ["#cfaa7c", "#8e6445", "#a47750"];
  const cabinetry = ["#ede2c9", "#a49e81", "#b8ad8e"];
  const olive = ["#8e9a70", "#556447", "#697b54"];
  const slate = ["#687b71", "#354942", "#435b51"];
  const dark = ["#47554d", "#293a31", "#34423a"];

  function project(x, y, z = 0) {
    return [origin[0] + (x - y) * scale, origin[1] + (.47 * (x + y) - z) * scale];
  }

  function groundPoint(sx, sy) {
    const difference = (sx - origin[0]) / scale;
    const sum = (sy - origin[1]) / (.47 * scale);
    return [(sum + difference) / 2, (sum - difference) / 2];
  }

  function objectFace(id, label, points) {
    const polygon = points.map(point => project(...point));
    const xs = polygon.map(([x]) => x);
    const ys = polygon.map(([,y]) => y);
    roomObjects.push({id,label,polygon,left:Math.min(...xs),right:Math.max(...xs),
      top:Math.min(...ys),bottom:Math.max(...ys)});
  }

  function objectBox(id, label, x, y, z, w, d, h) {
    // These six corners form the outline of a box in the room's projection.
    objectFace(id,label,[[x,y,z+h],[x+w,y,z+h],[x+w,y,z],
      [x+w,y+d,z],[x,y+d,z],[x,y+d,z+h]]);
  }

  function distanceToObject(x, y, polygon) {
    let inside = false;
    let nearest = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const [ax,ay] = polygon[i];
      const [bx,by] = polygon[(i+1) % polygon.length];
      const dx = bx-ax, dy = by-ay;
      if ((ay > y) !== (by > y) && x < ax + dx*(y-ay)/dy) inside = !inside;
      const t = Math.max(0, Math.min(1, ((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
      nearest = Math.min(nearest, Math.hypot(x-ax-t*dx,y-ay-t*dy));
    }
    return inside ? 0 : nearest;
  }

  function roomObjectAt(x, y, padding, portableOnly = false) {
    let nearest;
    let distance = padding;
    for (let i = roomObjects.length - 1; i >= 0; i--) {
      const object = roomObjects[i];
      if (portableOnly && !Object.hasOwn(itemShapes,object.id)) continue;
      if (x < object.left-padding || x > object.right+padding ||
          y < object.top-padding || y > object.bottom+padding) continue;
      const gap = distanceToObject(x,y,object.polygon);
      if (gap === 0) return object;
      if (gap < distance) {
        nearest = object;
        distance = gap;
      }
    }
    return nearest;
  }

  function roomLabelAt(x, y, padding = 3) {
    return roomLabels.find(label => x >= label.x && x <= label.x + label.width &&
      y >= label.y + 3 - padding && y <= label.y + label.height - 3 + padding);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX-rect.left)*width/rect.width,(event.clientY-rect.top)*height/rect.height];
  }

  function isTouchClick(event) {
    const touch = event.pointerType === "touch" || pressedPointer === "touch";
    pressedPointer = "";
    return touch;
  }

  function updateObjectName() {
    if (!objectName) return;
    const tapped = roomObjects.find(object => object.id === tappedObject);
    if (!tapped) tappedObject = null;
    const hovered = hoverPoint && !roomLabelAt(...hoverPoint,0) && roomObjectAt(...hoverPoint,3);
    const object = !model.residentSelected && (hoverPoint ? hovered : tapped);
    objectName.hidden = !object;
    if (!object) return;
    if (objectName.textContent !== object.label) objectName.textContent = object.label;
    const w = objectName.offsetWidth;
    const h = objectName.offsetHeight;
    const left = Math.max(6,Math.min(width-w-6,(object.left+object.right-w)/2));
    const above = object.top-h-6;
    const top = above >= 6 ? above : Math.max(6,Math.min(height-h-6,object.bottom+6));
    objectName.style.left = Math.round(left) + "px";
    objectName.style.top = Math.round(top) + "px";
  }

  function residentZone(x, y) {
    if (x >= 6.27 && x <= 8.55 && y <= 2.33) return "private";
    if (x >= 8.55) return "entry";
    if (x <= 5.68 && y <= 3.81) return "study";
    return "living";
  }

  function walkable(x, y) {
    const margin = .17;
    return x > margin && x < floorWidth - margin && y > margin && y < floorDepth - margin &&
      !obstacles.some(([left,top,w,d]) =>
        x >= left - margin && x <= left + w + margin && y >= top - margin && y <= top + d + margin);
  }

  function clearWalk(a, b) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / .10));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      if (!walkable(blend(a[0], b[0], t), blend(a[1], b[1], t))) return false;
    }
    return true;
  }

  function walkRoute(start, end) {
    if (clearWalk(start,end)) return [start,end];
    const step = .25;
    const cols = Math.floor(floorWidth / step) + 1, rows = Math.floor(floorDepth / step) + 1;
    const position = cell => [(cell % cols) * step, Math.floor(cell / cols) * step];
    const directions = [[1,0],[-1,0],[0,1],[0,-1]];
    function nearestCell(point) {
      const col = Math.round(point[0] / step), row = Math.round(point[1] / step);
      let nearest = -1, distance = Infinity;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const x = col + dx, y = row + dy;
          if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
          const cell = y * cols + x, candidate = position(cell);
          const cost = Math.hypot(point[0]-candidate[0], point[1]-candidate[1]);
          if (cost < distance && clearWalk(point,candidate)) {
            nearest = cell;
            distance = cost;
          }
        }
      }
      return nearest;
    }
    const first = nearestCell(start), last = nearestCell(end);
    if (first < 0 || last < 0) return null;
    const previous = new Map([[first, -1]]);
    const queue = [first];
    for (let index = 0; index < queue.length && !previous.has(last); index++) {
      const cell = queue[index], col = cell % cols, row = Math.floor(cell / cols);
      for (const [dx,dy] of directions) {
        const x = col + dx, y = row + dy, next = y * cols + x;
        if (x < 0 || x >= cols || y < 0 || y >= rows ||
            previous.has(next) || !clearWalk(position(cell),position(next))) continue;
        previous.set(next,cell);
        queue.push(next);
      }
    }
    if (!previous.has(last)) return null;
    const route = [end];
    for (let cell = last; cell >= 0; cell = previous.get(cell)) route.push(position(cell));
    route.push(start);
    route.reverse();
    const result = [start];
    for (let from = 0; from < route.length - 1;) {
      let to = route.length - 1;
      while (to > from + 1 && !clearWalk(route[from],route[to])) to--;
      result.push(route[to]);
      from = to;
    }
    return result;
  }

  function residentPose(now = performance.now()) {
    if (!residentMotion) return model.actor;
    const {path, offsets, started, duration} = residentMotion;
    const distance = offsets.at(-1) * ease((now - started) / duration);
    const end = offsets.findIndex(offset => offset >= distance);
    if (end <= 0) return end === 0 ? {...model.actor, x:path[0][0], y:path[0][1]} : model.actor;
    const from = path[end-1], to = path[end];
    const amount = (distance - offsets[end-1]) / (offsets[end] - offsets[end-1]);
    return {...model.actor, x:blend(from[0],to[0],amount), y:blend(from[1],to[1],amount)};
  }

  function planResidentMove(x, y) {
    const start = residentPose();
    if (!start || !walkable(x,y)) return null;
    const path = walkRoute([start.x,start.y],[x,y]);
    return path && {x,y,pose:"standing",zone:residentZone(x,y),path};
  }

  function currentResidentZone() {
    const actor = residentPose();
    return actor && residentZone(actor.x,actor.y);
  }

  function residentAtDoor() {
    const actor = model.actor;
    return Boolean(actor && !residentMotion && actor.x >= 8.7 && actor.x <= 10.23 && actor.y <= 1.55);
  }

  function dispatchResidentArrival(actor) {
    queueMicrotask(() => {
      if (model.actor === actor) window.dispatchEvent(new CustomEvent("companion-resident-arrived"));
    });
  }

  function startResidentMotion(actor, now) {
    const path = actor?.path;
    if (!path || reduceMotion.matches) return null;
    const offsets = [0];
    for (let i = 1; i < path.length; i++) {
      offsets.push(offsets[i-1] + Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
    }
    const distance = offsets.at(-1);
    return distance > .03 ? {path,offsets,started:now,duration:Math.max(260,distance * 175)} : null;
  }

  function pointPath(points, close = false) {
    ctx.beginPath();
    const first = project(...points[0]);
    ctx.moveTo(...first);
    for (const point of points.slice(1)) ctx.lineTo(...project(...point));
    if (close) ctx.closePath();
  }

  function face(points, color, stroke) {
    pointPath(points, true);
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = .65;
      ctx.stroke();
    }
  }

  function line(points, color, weight = 1, dash = []) {
    pointPath(points);
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function surface(x, y, w, d, z, color, stroke) {
    face([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], color, stroke);
  }

  function box(x, y, z, w, d, h, [top, right, front]) {
    const y2 = y + d;
    const x2 = x + w;
    const topZ = z + h;
    face([[x2, y, z], [x2, y2, z], [x2, y2, topZ], [x2, y, topZ]], right);
    face([[x, y2, z], [x2, y2, z], [x2, y2, topZ], [x, y2, topZ]], front);
    surface(x, y, w, d, topZ, top);
  }

  function cameraHousing(x, y, z, length, breadth, height, angle, [top, right, front]) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const [u, v] = [length / 2, breadth / 2];
    const corners = [[-u,-v],[u,-v],[u,v],[-u,v]]
      .map(([a,b]) => [x + a*cosine - b*sine, y + a*sine + b*cosine]);
    const point = (i, lift) => [...corners[i], z + lift];
    const sideX = cosine + sine > 0 ? [1,2] : [3,0];
    const sideY = cosine - sine > 0 ? [2,3] : [0,1];
    for (const [[a,b],color] of [[sideX,right],[sideY,front]]) {
      face([point(a,0),point(b,0),point(b,height),point(a,height)],color);
    }
    face(corners.map((_, i) => point(i, height)), top);
  }

  function shadow(x, y, w, d, opacity = .15) {
    surface(x + .12, y + .15, w, d, .015, "rgba(46,35,24," + opacity + ")");
  }

  function pill(label, x, y, z, tint = "#ebefe2", background = "#27382df0") {
    const [sx, sy] = project(x, y, z);
    ctx.font = "700 " + (width < 480 ? 10 : 12) + "px 'DM Sans', sans-serif";
    const w = ctx.measureText(label).width + 16;
    if(['Workspace','Living area','Entryway','Private zone'].includes(label))roomLabels.push({label,x:sx-w/2,y:sy-12,width:w,height:25});
    ctx.beginPath();
    ctx.roundRect(sx - w / 2, sy - 9, w, 19, 5);
    ctx.fillStyle = background;
    ctx.fill();
    ctx.fillStyle = tint;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(label, sx, sy + .5);
  }

  function ellipse(x, y, z, rx, ry, color, stroke) {
    const [sx, sy] = project(x, y, z);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * scale, ry * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1, scale * .045);
      ctx.stroke();
    }
  }

  function positionAlongTrack(travelled) {
    const end = distances.findIndex(length => length >= travelled);
    if (end <= 0) return fullPath[end === 0 ? 0 : fullPath.length - 1];
    const fraction = (travelled - distances[end - 1]) / (distances[end] - distances[end - 1]);
    return fullPath[end - 1].map((point, axis) => point + (fullPath[end][axis] - point) * fraction);
  }

  function nearestTrackStop(x, y) {
    let nearest = 0;
    let distance = Infinity;
    for (let i = 1; i < fullPath.length; i++) {
      const [ax, ay] = fullPath[i - 1];
      const [bx, by] = fullPath[i];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      const offset = Math.hypot(x - ax - t * dx, y - ay - t * dy);
      if (offset < distance) {
        nearest = blend(distances[i - 1], distances[i], t);
        distance = offset;
      }
    }
    return nearest;
  }

  function stops() {
    return model.rail === "gantry" ? gantryStops : trackStops;
  }

  function targetStop(target) {
    if (target !== "recipient" || !model.actor) return stops()[target] ?? carrier;
    const [x,y] = recipientHand(model.actor);
    if (model.rail === "track") return nearestTrackStop(x + .40, y - .20);
    return [
      Math.max(gantry.left, Math.min(gantry.right, x + .43)),
      Math.max(gantry.near, Math.min(gantry.far, y - .32)),
      gantry.height
    ];
  }

  function pose() {
    return model.rail === "gantry" ? carrier : positionAlongTrack(carrier);
  }

  function targetPoint(target) {
    if (target === "recipient" || target === "resident") {
      const actor = residentPose();
      return actor && recipientHand(actor);
    }
    if (target === "napkin") return napkin.point;
    return items[target]?.point || landmarks[target]?.point || locations[target];
  }

  function aimPoint(target) {
    if (target === "resident" && !model.zones.includes(currentResidentZone())) return null;
    return targetPoint(target);
  }

  function inspectionTarget(view) {
    return view.aim || (view.camera && (view.target === "recipient" ? "recipient" :
      view.inspect || (view.spotlight && (view.highlightItem || view.spotlightLocation || "entry"))));
  }

  function cameraYaw() {
    const point = aimPoint(inspectionTarget(model));
    if (!point) return .91;
    const [x,y] = pose();
    const [targetX,targetY] = point;
    return Math.atan2(targetY-y,targetX-x);
  }

  function ease(value) {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
  }

  function blend(from, to, amount) {
    return from + (to - from) * amount;
  }

  function backdrop() {
    const gradient = ctx.createRadialGradient(width * .52, height * .44, 18, width * .52, height * .47, width * .63);
    gradient.addColorStop(0, "#37473a");
    gradient.addColorStop(1, "#232e27");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#a1b7a330";
    for (let x = 0; x < width; x += 19) {
      for (let y = 0; y < height; y += 19) ctx.fillRect(x, y, 1, 1);
    }
  }

  function architecture() {
    box(.25, .35, -.48, 11.45, 7.9, .17, ["#243129", "#151d18", "#18221b"]);
    box(0, 0, -.32, floorWidth, floorDepth, .32, ["#cfbfa2", "#6e6656", "#93846b"]);
    const boards = ["#cdbc9e", "#d5c3a5", "#c9b699", "#cfbda0"];
    for (let row = 0; row < 16; row += 1) {
      const y = row * .49;
      surface(.03, y, 11.34, .46, .012, boards[row % boards.length]);
      for (let x = 1.25 + (row % 3) * .63; x < 11.1; x += 2.45) {
        line([[x, y, .017], [x, y + .46, .017]], "#a7977b91", .65);
      }
    }

    const walls = ["#f0eee0", "#b5bdb0", "#d9dfcd"];
    box(-.11, -.12, 0, 8.83, .18, 2.24, walls);
    box(10.22, -.12, 0, 1.18, .18, 2.24, walls);
    box(8.71, -.12, 1.96, 1.52, .18, .28, walls);
    box(-.14, .04, 0, .19, 7.83, 2.24, ["#e5e9db", "#c2cdbd", "#aebdab"]);
    drawDoor();
    surface(6.3, .13, 2.16, 2.08, .027, "#9ca49a");
    box(6.27, .05, 0, .14, 2.25, 1.53, ["#dce0d5", "#a7b1a3", "#9da997"]);
    for (const [x,y,w,d] of privateDivider) box(x,y,0,w,d,1.53,["#d9dfd4", "#819583", "#aab7a7"]);
    box(8.42, .11, 0, .13, 2.16, 1.53, ["#dce2d7", "#809180", "#aab5a8"]);
    surface(8.55, 3.53, 2.59, 2.8, .026, model.zones.includes("entry") && model.camera ? "#a5b586" : "#b7b89b");
    surface(8.85, .62, 1.28, .83, .03, model.doorOpen ? "#a2b776" : "#788471");
    surface(.63, 4.12, 4.54, 3.3, .029, "#91a696");
    for (let y = 4.29; y < 7.36; y += .16) line([[.68, y, .031], [5.13, y, .031]], "#d0dcbd45", .8);
  }

  function drawDoor() {
    const angle = doorAmount * Math.PI * .47;
    const hinge = [10.16, .036];
    const direction = [-Math.cos(angle), Math.sin(angle)];
    const tip = hinge.map((axis, i) => axis + direction[i] * 1.36);
    const side = [Math.sin(angle) * .095, Math.cos(angle) * .095];
    const pivot = hinge.map((axis, i) => axis + side[i]);
    const edge = tip.map((axis, i) => axis + side[i]);
    const front = [[...pivot,.03],[...edge,.03],[...edge,1.94],[...pivot,1.94]];
    face(front, "#79896a", "#68785a");
    objectFace("front_door", landmarks.front_door.label, front);
    face([[...tip,.03],[...edge,.03],[...edge,1.94],[...tip,1.94]], "#52604b");
    face([[...hinge,1.94],[...tip,1.94],[...edge,1.94],[...pivot,1.94]], "#acb68e");
    const handle = edge.map((axis, i) => axis - direction[i] * .16);
    ellipse(...handle, 1, .052, .044, "#f1db93");
  }

  function drawWindow() {
    const windowY = .079;
    const panel = (left, right, low, high, color, outline) =>
      face([[left,windowY,low],[right,windowY,low],[right,windowY,high],[left,windowY,high]], color, outline);
    panel(2.92,6.12,.99,2.13,"#657970","#3d534b");
    panel(3.01,6.03,1.08,2.04,model.night ? "#334957" : "#a6c9c8");
    panel(3.01,6.03,1.08,1.44,model.night ? "#283946" : "#7daca6");
    if (model.night) {
      for (const [x,z] of [[3.29,1.82],[4.22,1.68],[4.90,1.89],[5.73,1.57]]) {
        ellipse(x,windowY+.012,z,.018,.017,"#ede5bb");
      }
    } else {
      line([[3.45,.091,1.70],[4.13,.091,1.70]],"#e1efe6",1.5);
      line([[5.14,.091,1.81],[5.69,.091,1.81]],"#e1efe6",1.5);
    }
    panel(4.49,4.56,1.025,2.08,"#7e918b");
    objectFace("window","Window",[[2.92,windowY,.99],[6.12,windowY,.99],[6.12,windowY,2.13],[2.92,windowY,2.13]]);
    line([[2.78,.18,2.17],[6.26,.18,2.17]],"#a27f62",Math.max(2,scale*.055));
    const half = blend(.37,1.73,curtainAmount);
    const cloth = (id, left, right) => {
      const bands = ["#846b77","#ad8790","#c8a3a3","#987b85"];
      for (let i=0;i<8;i++) {
        const a = blend(left,right,i/8), b = blend(left,right,(i+1)/8);
        const y = i % 2 ? .17 : .25;
        face([[a,y,.89],[b,y,.87],[b,y,2.145],[a,y,2.145]],bands[i % bands.length]);
      }
      objectFace(id,"Smart curtains",[[left,.20,.88],[right,.20,.88],[right,.20,2.145],[left,.20,2.145]]);
    };
    cloth("curtain_left",2.80,2.80+half);
    cloth("curtain_right",6.24-half,6.24);
  }

  function drawBedside() {
    const [x,y,w,d] = bed;
    shadow(x,y,w,d);
    box(x,y,.055,w,d,.33,wood);
    box(x,y,.37,w,.145,.57,wood);
    box(x+.075,y+.15,.385,w-.15,d-.23,.20,["#e6d9c9","#938171","#bda998"]);
    box(x+.23,y+.25,.585,w-.46,.39,.115,["#ede6d9","#ab9a86","#d8c5b3"]);
    box(x+.075,y+.78,.56,w-.15,d-.86,.115,["#8fa6a3","#596d73","#6b8586"]);
    for (const seam of [1.61,1.73,1.85]) {
      line([[x+.10,y+seam,.679],[x+w-.10,y+seam,.679]],"#b2c2b5",1);
    }
    objectBox("bed","Bed",x,y,.055,w,d,.635);
    const [tx,ty,tw,td] = bedsideTable;
    box(tx,ty,.03,tw,td,.56,wood);
    line([[tx+.31,ty+.28,.59],[tx+.31,ty+.28,.88]],"#7f7759",Math.max(2,scale*.047));
    box(tx+.14,ty+.10,.86,.34,.35,.28,model.lightsOn === false ?
      ["#9c8f78","#6b6457","#7c6e5f"] : ["#f6e3ae","#ae8964","#e0be84"]);
    const [px,py,pw,pd] = switchPost;
    box(px,py,.02,pw,pd,1.94,["#e4e7d9","#7d9487","#b2c1ab"]);
    const [sx,sy,sz] = lightSwitch;
    box(sx-.126,sy-.026,sz-.15,.25,.05,.30,["#f5ebd7","#958f7d","#d7cdb5"]);
    objectBox("light_switch","Wall switch",sx-.126,sy-.026,sz-.15,.25,.05,.30);
    const isOff = model.lightsOn === false;
    line([[sx-.048,sy+.03,sz+(isOff ? -.059 : .05)],[sx+.048,sy+.03,sz+(isOff ? -.059 : .05)]],
      isOff ? "#756b64" : "#779264",Math.max(2,scale*.055));
  }

  function plant(x, y, size = 1) {
    box(x, y, 0, .41 * size, .41 * size, .31 * size, ["#d3a785", "#8d634e", "#ab775e"]);
    line([[x + .20 * size, y + .17 * size, .27 * size], [x + .21 * size, y + .19 * size, .91 * size]], "#416140", 1.1 * size);
    ellipse(x + .06 * size, y + .23 * size, .59 * size, .18 * size, .091 * size, "#657e50");
    ellipse(x + .32 * size, y + .12 * size, .74 * size, .188 * size, .10 * size, "#718d5c");
    ellipse(x + .17 * size, y + .22 * size, .92 * size, .14 * size, .10 * size, "#9ba876");
  }

  function furnishings() {
    shadow(.68, 4.39, 1.8, 2.64);
    box(.67, 4.46, .06, 1.53, 2.69, .38, olive);
    box(.64, 4.36, .37, .35, 2.87, .66, olive);
    for (const y of [4.62, 5.64, 6.61]) {
      box(.99, y, .43, 1.12, .84, .12, ["#c3c49a", "#8d946e", "#a5ac80"]);
    }
    box(.79, 4.41, .39, 1.42, .23, .42, olive);
    box(.78, 7.12, .35, 1.39, .23, .42, olive);
    box(1.01, 5.04, .5, .45, .48, .28, ["#e2c49b", "#9a7758", "#b78e69"]);
    box(1.02, 6.25, .5, .39, .43, .27, slate);
    objectBox("couch", landmarks.couch.label, .64,4.36,.06,1.56,2.99,.77);

    shadow(2.9, 5.24, 1.59, 1.1, .12);
    box(2.94, 5.27, .03, 1.34, 1.02, .27, wood);
    box(2.86, 5.21, .28, 1.54, 1.17, .1, wood);
    box(3.09, 5.49, .38, .39, .50, .045, cabinetry);
    ellipse(3.7, 5.77, .42, .11, .059, "#f1d9ab", "#9f8258");
    objectBox("coffee_table", landmarks.coffee_table.label, 2.86,5.21,.03,1.54,1.17,.37);

    drawWindow();
    drawWorkspace();
    drawBedside();

    plant(.83, 3.63, 1.19);

    drawEntryFurniture();
    if (model.zones.includes("entry") && model.camera) {
      line([[8.58,3.59,.04],[11.06,3.59,.04],[11.06,6.3,.04],[8.58,6.3,.04],[8.58,3.59,.04]], "#e2f39f", 1.5, [4,4]);
    }
    if (model.zones.includes("study") && model.camera) {
      line([[.35,.45,.04],[5.68,.45,.04],[5.68,3.81,.04],[.35,3.81,.04],[.35,.45,.04]], "#e2f39f", 1.5, [4,4]);
    }
  }

  function drawWorkspace() {
    shadow(1.04, 1.03, 3.43, 1.25);
    for (const x of [1.06, 4.23]) {
      for (const y of [1.05, 2.04]) box(x, y, .02, .10, .10, .73, dark);
    }
    box(.99, .98, .74, 3.43, 1.25, .13, wood);
    objectBox("desk", landmarks.desk.label, .99,.98,.74,3.43,1.25,.13);
    box(2.42, 1.12, .87, .6, .33, .05, slate);
    box(2.68, 1.20, .92, .09, .11, .26, dark);
    box(2.13, 1.19, 1.07, 1.18, .10, .69, ["#5f7768", "#293c33", "#354a40"]);
    objectBox("computer", landmarks.computer.label, 2.13,1.19,1.07,1.18,.10,.69);
    face([[2.21,1.30,1.15],[3.23,1.30,1.15],[3.23,1.30,1.67],[2.21,1.30,1.67]], "#7a9a83");
    line([[2.35,1.31,1.47],[2.95,1.31,1.47]], "#dfeaae", 1.3);
    line([[2.35,1.31,1.33],[2.81,1.31,1.33]], "#bac99c", .9);
    box(2.2, 1.73, .87, .95, .31, .033, dark);
    box(3.52, 1.32, .87, .51, .47, .06, cabinetry);
    box(2.39, 2.72, .03, .71, .63, .42, slate);
    box(2.32, 2.65, .45, .86, .8, .13, slate);
    box(2.32, 3.22, .56, .86, .16, .57, slate);
  }

  function drawEntryFurniture() {
    shadow(7.75, 4.12, 1.24, 1.22);
    box(7.74, 4.09, .03, 1.28, 1.25, .68, wood);
    box(7.69, 4.02, .71, 1.39, 1.37, .08, cabinetry);
    line([[7.8, 5.346, .45], [8.92, 5.346, .45]], "#644b37", 1.2);
    line([[8.15, 5.348, .56], [8.51, 5.348, .56]], "#ded5b1", 1.3);
    box(8.11, 4.36, .79, .69, .5, .065, dark);
    objectBox("key_tray","Key tray",8.11,4.36,.79,.69,.5,.065);
    box(8.76, 4.84, .795, .17, .22, .031, ["#d5ba8a", "#7a6646", "#8c7652"]);
    plant(10.53, 6.5, .86);
  }

  function drawKeys(x, y, z) {
    ellipse(x, y, z, .12, .077, "#687052", "#f9e5a0");
    line([[x,y,z],[x+.24,y+.15,z],[x+.29,y+.06,z]], "#fff2b0", Math.max(1.5, scale * .065));
    line([[x+.20,y+.12,z],[x+.25,y+.01,z]], "#e6b66d", Math.max(1, scale * .045));
  }

  function drawGlasses(x, y, z) {
    for (const offset of [-.16, .15]) {
      ellipse(x + offset, y, z, .127, .079, "#a3e5dd77", "#24373a");
      line([[x+offset,y-.035,z],[x+offset+.04,y-.16,z+.015]], "#27373b", 1.5);
    }
    line([[x-.05,y,z],[x+.045,y,z]], "#324d50", 1.7);
  }

  function drawUmbrella(x, y, z) {
    line([[x-.19,y+.04,z-.64],[x+.13,y-.02,z+.37]], "#5e425c", Math.max(2, scale * .075));
    face([
      [x-.20,y+.05,z-.61], [x-.13,y+.15,z+.17], [x+.14,y-.02,z+.31], [x+.24,y+.09,z+.20]
    ], "#bd706b", "#713c47");
    line([[x-.19,y+.05,z-.60],[x+.05,y+.08,z+.19]], "#f2aaa0", 1.1);
    line([[x+.125,y-.02,z+.31],[x+.15,y-.015,z+.43],[x+.29,y-.01,z+.46],[x+.35,y,z+.37]], "#563e55", 2.2);
  }

  function drawBackpack(x, y, z) {
    const bottom = z - .54;
    box(x-.30,y-.18,bottom,.58,.41,.51,["#a4bcc4","#4b657d","#63859d"]);
    box(x-.23,y-.15,z-.10,.45,.34,.18,["#adc6c9","#536e84","#7495ac"]);
    box(x-.20,y+.23,bottom+.08,.37,.065,.23,["#b9cec9","#576f7b","#819fa9"]);
    line([[x-.13,y+.04,z+.06],[x-.11,y+.035,z+.20],[x+.095,y+.035,z+.20],[x+.13,y+.04,z+.06]], "#354c61", 2);
    line([[x-.14,y+.30,z-.25],[x+.11,y+.30,z-.25]], "#dfe9d7", 1);
  }

  function drawItem(id, point) {
    const draw = { glasses: drawGlasses, umbrella: drawUmbrella, keys: drawKeys, backpack: drawBackpack, napkin: drawNapkin };
    draw[id](...point);
    const [x,y,z] = point;
    const [dx,dy,dz,w,d,h] = itemShapes[id];
    objectBox(id,(items[id] || napkin).label,x+dx,y+dy,z+dz,w,d,h);
  }

  function drawNapkin(x,y,z) {
    face([[x-.22,y-.14,z-.015],[x+.20,y-.14,z-.015],[x+.18,y+.17,z-.015],[x-.20,y+.17,z-.015]],
      "#e4dfcb","#988e7b");
    face([[x-.22,y-.14,z],[x+.20,y-.14,z],[x+.18,y+.17,z],[x-.20,y+.17,z]],"#fff6df","#c2b9a6");
    line([[x-.11,y+.13,z+.012],[x+.085,y+.13,z+.012],[x+.15,y-.075,z+.012]],"#a5b9a9",.9);
  }

  function drawKitchen() {
    const [x,y,w,d] = kitchenCounter;
    shadow(5.10, 6.42, 2.45, 1.13, .19);
    box(5.10,6.42,.025,2.48,1.18,.73,["#d2d7c2","#6d8274","#829d8b"]);
    for (const x of [5.19,6.00,6.80]) {
      box(x,7.61,.18,.68,.055,.48,["#a9bca7","#577165","#9bb29c"]);
      line([[x+.39,7.672,.58],[x+.59,7.672,.58]],"#e1d4b4",1.1);
    }
    box(x,y,.75,w,d,.115,["#e8e4d1","#899589","#aab1a1"]);
    box(6.29,6.76,.865,.91,.62,.043,wood);
    ellipse(6.61,6.91,.97,.145,.091,"#d47d63","#a55343");
    ellipse(6.85,7.06,.98,.14,.086,"#e28f6e","#a55343");
    ellipse(7.01,6.88,.96,.13,.076,"#c66c52");
    ellipse(5.65,6.92,.88,.31,.18,"#536b62","#becbc1");
    line([[5.38,6.58,.88],[5.38,6.58,1.17],[5.61,6.72,1.2]], "#667f75", 2.1);
    box(7.12,6.77,.87,.45,.38,.075,["#cbbfa7","#8d7d69","#a99b82"]);
    objectBox("kitchen_counter","Kitchen counter",x,y,.025,w,d,.84);
  }

  function recipientHand({ x, y }) {
    return [x + .17, y + .51, .98];
  }

  function drawResident(arm, actor) {
    if (!actor) return;
    const { x, y, pose } = actor;
    const seated = pose === "phone";
    const height = seated ? 1.00 : 1.44;
    const coat = pose === "cook" ? ["#7b9a92","#375e56","#547a6b"] : ["#b2bd97","#566c58","#7a9270"];
    ellipse(x+.07,y+.08,.045,.33,.17,"#293e2a35");
    if (model.residentSelected) ellipse(x+.07,y+.08,.05,.45,.24,"#adf5b53b","#def9b9");
    box(x-.12,y-.04,.06,.13,.16,seated ? .33 : .56,dark);
    box(x+.055,y-.04,.06,.13,.16,seated ? .33 : .56,dark);
    box(x-.20,y-.11,seated ? .36 : .61,.43,.29,seated ? .39 : .56,coat);
    ellipse(x+.015,y+.035,height,.15,.19,"#d4a784");
    ellipse(x+.02,y+.028,height+.135,.149,.086,"#544c3d");
    const handZ = seated ? .65 : .87;
    line([[x-.18,y+.09,handZ+.16],[x-.07,y+.35,handZ]], "#d4a784", Math.max(2,scale*.09));
    const reach = arm.received ? 1 : arm.atResident ? arm.lowered : 0;
    const outstretched = recipientHand(actor);
    const hand = [x+.14,y+.34,handZ].map((value, axis) => blend(value, outstretched[axis], reach));
    line([[x+.22,y+.09,handZ+.16],hand], "#d4a784", Math.max(2,scale*.09));
    if (reach > .4) ellipse(...hand,.08,.053,"#dfb38e");
    if (arm.received) drawItem(arm.received, hand);
    if (seated) box(x-.05,y+.32,handZ,.18,.11,.042,["#a4d4c9","#556d64","#405d52"]);
  }

  function drawTrack() {
    const supports = [fullPath[0], fullPath[3], fullPath[5], fullPath[7]];
    for (const [x,y,z] of supports) {
      line([[x,y,z-.13],[x,y,z+.28]], "#8f9f8c", 1.8);
      ellipse(x,y,z+.29,.079,.032,"#9aac95");
    }
    line(fullPath, "#222f29", Math.max(6, scale * .18));
    line(fullPath, "#8da88d", Math.max(3, scale * .097));
    line(fullPath.map(([x,y,z]) => [x,y,z+.045]), "#bad1ad81", Math.max(1, scale * .026));
    if (motion) line(fullPath, "#e6f6bd", Math.max(1, scale * .037), [5, 7]);
  }

  function drawGantry(y) {
    const { left, right, near, far, height: z } = gantry;
    const movingY = motion?.phase === "y" || motion?.phase === "both";
    const movingX = motion?.phase === "x" || motion?.phase === "both";
    for (const x of [left, right]) {
      box(x - .093, near -.08, z - .05, .186, far - near + .16, .13, ["#91aeb0", "#435b61", "#607c80"]);
      line([[x, near,z+.093],[x,far,z+.093]], movingY ? "#a1f5f2" : "#537378", movingY ? 2.8 : 1.4);
      for (const end of [near, far]) {
        line([[x,end,z+.06],[x,end,z+.34]], "#a4b6ac", 1.4);
        box(x - .17,end - .17,z + .015,.34,.34,.15,["#647e7d","#385357","#4a6868"]);
      }
    }

    box(left-.13,y-.14,z-.09,right-left+.26,.28,.13,["#aabd9e","#5c755f","#6f8e70"]);
    line([[left+.17,y,z+.048],[right-.17,y,z+.048]], movingX ? "#dafaac" : "#5a795e", movingX ? 2.8 : 1.4);
    for (const x of [left,right]) {
      box(x-.21,y-.24,z-.10,.42,.48,.23,["#c1d8c2","#536e63","#789486"]);
      if (movingY) ellipse(x,y+.26,z+.035,.05,.039,"#bcfff6");
    }
    if (movingY) pill("Y", left, y + .48, z+.08, "#dcf9f0", "#294b49f5");
    if (movingX) pill("X", right - .78, y, z+.31, "#ebf8cf", "#334e35f5");
  }

  function lightStrength(now) {
    if (!model.spotlight || !model.camera || motion) return 0;
    return reduceMotion.matches ? 1 : ease((now - spotlightAt) / 220);
  }

  function spotlightPoint() {
    return targetPoint(model.highlightItem || model.spotlightLocation) || locations.entry;
  }

  function drawSpotlight(emitter, strength, now) {
    const [tx,ty,z] = spotlightPoint();
    const upper = project(...emitter);
    const base = project(tx,ty,z + .05);
    const beam = ctx.createLinearGradient(...upper, base[0], base[1] + 1);
    beam.addColorStop(0, "#fbffd9dd");
    beam.addColorStop(.55, "#efff9b50");
    beam.addColorStop(1, "#d9fa507b");
    ctx.save();
    ctx.globalAlpha = strength;
    face([emitter,[tx+.92,ty-.33,z],[tx+.76,ty+.58,z],[tx-.51,ty+.59,z],[tx-.48,ty-.33,z]], beam);
    ellipse(tx,ty,z+.08,.58,.29,"#f4fca96e","#f4ffb0");
    ctx.shadowColor = "#e2ff84";
    ctx.shadowBlur = 14;
    ellipse(tx,ty,z+.09,.23,.12,"#f0ffaf44","#f2ff9b");
    ctx.shadowBlur = 0;
    if (!reduceMotion.matches) {
      const elapsed = now - spotlightAt;
      for (let i = 0; i < 2; i += 1) {
        const phase = (elapsed - i * 230) / 680;
        if (phase < 0 || phase > 1) continue;
        ctx.globalAlpha = strength * (1 - phase) * .75;
        ellipse(tx,ty,z+.1,.46+.5*phase,.22+.25*phase,"#00000000","#f4ffb3");
      }
    }
    ctx.restore();
  }

  function doorSignal(now) {
    if (!model.doorOpen) return;
    ellipse(9.54,1.08,.048,.51,.25,"#a8efd236","#b2ffe4");
    if (reduceMotion.matches) return;
    for (let i = 0; i < 2; i += 1) {
      const phase = (now - doorPulseAt - 120 - i * 250) / 700;
      if (phase < 0 || phase > 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - phase;
      ellipse(9.54,1.08,.051,.48+.65*phase,.23+.30*phase,"#00000000","#b6ffe0");
      ctx.restore();
    }
  }

  function gripperFrame(now, light) {
    const [x, y, z] = pose();
    const folded = [x-.11, y+.64, z-.86];
    const job = gripMotion?.job;
    const elapsed = gripMotion?.started == null ? 0 : now - gripMotion.started;
    const time = reduceMotion.matches && gripMotion?.started != null ? gripDuration : elapsed;
    const pointing = !job && !model.heldItem && Object.hasOwn(items, model.highlightItem) && model.highlightItem;
    const lowered = job ? ease(time / 680) * (1 - ease((time - 880) / 870)) : pointing ? light : 0;
    const giving = job?.action === "handover";
    const takingBack = job?.action === "take_back";
    const atResident = giving || takingBack;
    const point = job?.action === "press_switch" ? lightSwitch :
      atResident ? recipientHand(model.actor) : (job?.item === "napkin" ? napkin : items[job?.item || pointing])?.point;
    const hand = point ? folded.map((v, axis) => blend(v, point[axis] + (pointing && axis === 2 ? .28 : 0), lowered)) : folded;
    let held = model.heldItem;
    const transferred = job && time >= gripRelease;
    if (transferred && job.action !== "press_switch") held = job.action === "pick_up" || takingBack ? job.item : null;
    let received = model.receivedItems?.at(-1);
    if (giving && transferred) received = job.item;
    if (takingBack) received = transferred ? null : job.item;
    return { hand, held, lowered, pointing, job, received, atResident };
  }

  function drawGripper(x, y, z, arm) {
    const socket = [x-.19, y+.24, z-.49];
    const elbow = [blend(socket[0],arm.hand[0],.46)-.16, blend(socket[1],arm.hand[1],.55)+.10,
      blend(socket[2],arm.hand[2],.48)];
    const [a,b,c] = arm.hand;
    const wrist = [a,b,c+.145];
    const span = arm.held ? .10 : .17;
    const weight = Math.max(2.6, scale * .125);
    line([socket,elbow,wrist], "#304944", weight + 2);
    line([socket,elbow,wrist], "#9fbeb0", weight);
    ellipse(...elbow,.10,.083,"#536c67","#dbebd6");
    ellipse(...wrist,.12,.083,"#7b968e","#c9ded2");
    for (const side of [-1,1]) {
      line([wrist,[a + span * side,b,c+.08],[a + .73 * span * side,b,c-.015]],
        arm.lowered > .25 ? "#d9f6c1" : "#aac9bd", Math.max(1.7, scale * .065));
    }
    if (arm.held) drawItem(arm.held, arm.hand);
  }

  function ceiling(now, light, arm) {
    const [x,y,z] = pose();
    const axis = [Math.cos(yaw),Math.sin(yaw)];
    const lens = [x + axis[0]*.33, y + axis[1]*.33, z - .43];
    const emitter = [lens[0]+.14, lens[1]-.02, z-.32];
    if (model.rail === "gantry") drawGantry(y);
    else drawTrack();
    if (light > 0) drawSpotlight(emitter, light, now);
    const aim = model.camera && !motion && aimPoint(model.aim || model.inspect);
    if (aim) {
      const [tx,ty,tz] = aim;
      face([lens,[tx-.53,ty+.29,tz],[tx+.62,ty+.29,tz]], "#a8e2cd31");
      line([lens,[tx,ty,tz]], "#c2f5e68d", 1.35, [4,5]);
      ellipse(tx,ty,tz+.04,.36,.18,"#93ebce32","#a9efda");
    }

    box(x-.19,y-.19,z-.11,.44,.38,.16,["#d6e2c5","#7d9683","#9cb29a"]);
    box(x-.37,y-.25,z-.37,.79,.64,.32,["#eff0d9","#9da996","#c6cfb9"]);
    cameraHousing(x,y,z-.53,.63,.46,.17,yaw,dark);
    ellipse(...lens,.107,.105,"#1a2924","#aac5a7");
    if (!model.camera) {
      const cover = ["#9dad9b","#546958","#829481"];
      cameraHousing(lens[0],lens[1],z-.54,.12,.34,.22,yaw,cover);
    }
    if (light > 0) ellipse(...emitter,.072,.058,"#f1ffd0");
    ellipse(x-.16,y+.417,z-.17,.045,.035,model.camera ? "#e4fc92" : "#76917f");
    drawGripper(x,y,z,arm);
  }

  function curtainStatus() {
    if (curtainTransition) return curtainTransition.to === 1 ? "closing" : "opening";
    return curtainAmount === 1 ? "closed" : "open";
  }

  function paint(now = performance.now()) {
    if (!ctx || width === 0 || height === 0) return;
    roomLabels=[];
    roomObjects.length = 0;
    const light = lightStrength(now);
    const arm = gripperFrame(now, light);
    room.dataset.spotlight = light > .4 ? "on" : "off";
    room.dataset.gripper = arm.job ? arm.job.action : arm.held ? "holding" : arm.pointing && light > .4 ? "pointing" : "folded";
    room.dataset.held = arm.held || "";
    room.dataset.received = arm.received || "";
    room.dataset.highlight = light > .4 ? model.highlightItem || "" : "";
    room.dataset.aim = model.aim || "";
    room.dataset.marked = model.marker || "";
    room.dataset.target = model.target;
    room.dataset.lights = model.lightsOn === false ? "off" : "on";
    room.dataset.curtains = curtainStatus();
    backdrop();
    architecture();
    doorSignal(now);
    furnishings();
    drawKitchen();
    const available = Object.entries(roomItems).filter(([id]) => id !== arm.held && id !== arm.received &&
      !model.receivedItems?.includes(id) && !(id === "keys" && model.keysCollected));
    for (const [id, item] of available) drawItem(id, item.point);
    const actor = residentPose(now);
    drawResident(arm, actor);
    if (residentToggle && model.residentControls && actor) {
      const [x,y] = project(actor.x,actor.y,.76);
      residentToggle.style.left = x + "px";
      residentToggle.style.top = y + "px";
      residentToggle.style.height = Math.max(44,1.6 * scale + 6) + "px";
    }
    if (model.night || model.lightsOn === false) {
      ctx.fillStyle = model.lightsOn === false ? "#13162dbd" : "#181d341e";
      ctx.fillRect(0, 0, width, height);
    }
    ceiling(now, light, arm);
    if (width < 480) {
      areaLabel("workspace", 3.70, 2.25, 1.65);
    } else {
      areaLabel("workspace", 3.33, 3.73, .05);
    }
    areaLabel("living_area", 3.55, 7.25, .07);
    areaLabel("entryway", 10.3, 5.55, .04);
    areaLabel("private_zone", 7.45, 1.25, 1.62);
    const marker = model.marker === "resident" && actor ? [actor.x,actor.y,.05] : targetPoint(model.marker);
    if (marker && light <= .4 && !motion) {
      const [x,y,z] = marker;
      ellipse(x,y,z+.02,.41,.21,"#a2e4cf45","#c4f4df");
    }
    updateObjectName();
  }

  function areaLabel(id, x, y, z) {
    const {label} = landmarks[id];
    if (id === model.marker) return pill(label,x,y,z,"#e8ffef","#285340");
    if (id === "private_zone") return pill(label,x,y,z,"#e4e8dc","#4b5a4df2");
    return pill(label,x,y,z);
  }

  function resize() {
    const rect = room.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    scale = Math.min(width / 21.4, height / 12.95);
    origin = [width / 2 - 1.75 * scale, (height - 11.56 * scale) / 2 + 2.67 * scale];
    paint();
  }

  function guideStatus() {
    let label = "";
    const job = gripMotion?.job;
    const item = job && (job.item === "napkin" ? napkin : items[job.item])?.name;
    if (motion?.preview && reduceMotion.matches) label = "Preview position";
    else if (motion && job?.action === "handover") label = `Carrying the ${item} to you`;
    else if (motion && job?.action === "take_back") label = `Coming to take back the ${item}`;
    else if (motion && job?.action === "put_back") label = `Carrying the ${item} back`;
    else if (motion) {
      const labels = { y: "Y · Moving crossbeam", x: "X · Sliding carriage", both: "XY · Moving into position", track: "Following the rail" };
      label = labels[motion.phase] || "At the preview point";
    } else if (job) {
      if (job.action === "press_switch") label = "Pressing the wall switch";
      else if (job.action === "handover") label = `Handing you the ${item}`;
      else if (job.action === "take_back") label = `Taking the ${item} from you`;
      else label = job.action === "pick_up" ? "Picking up item" : `Putting back the ${item}`;
    }
    else if (curtainTransition) label = "Smart curtains " + curtainStatus();
    else if (model.spotlight) label = "Spotlight aligned";
    if (motionStatus.textContent !== label) motionStatus.textContent = label;
    motionStatus.hidden = !label;
    room.dataset.motion = motion ? motion.phase || "hold" : "idle";
  }

  function advanceCarrier(now) {
    if (!motion) return;
    const [leg] = motion.route;
    const t = Math.min(1, (now - motion.since) / leg.duration);
    if (t === 1) {
      carrier = leg.target;
      motion.route.shift();
      if (motion.route.length) {
        motion.from = carrier;
        motion.since = now;
      } else {
        motion = null;
        spotlightAt = now;
      }
      return;
    }
    if (leg.target === motion.from) {
      motion.phase = "hold";
      return;
    }
    if (model.rail === "track") {
      motion.phase = "track";
      carrier = blend(motion.from, leg.target, ease(t));
      return;
    }
    const [startX,startY,z] = motion.from;
    const [endX,endY] = leg.target;
    const x = ease((t - .25) / .75);
    const y = ease(t / .69);
    carrier = [blend(startX,endX,x), blend(startY,endY,y), z];
    const moveX = startX !== endX && t >= .25;
    const moveY = startY !== endY && t < .69;
    motion.phase = moveX && moveY ? "both" : moveY ? "y" : "x";
  }

  function tick(now) {
    frame = 0;
    advanceCarrier(now);
    if (residentMotion && now >= residentMotion.started + residentMotion.duration) {
      residentMotion = null;
      dispatchResidentArrival(model.actor);
    }
    if (gripMotion && !motion && gripMotion.started === null &&
        (model.target !== "recipient" || !residentMotion)) gripMotion.started = now;
    const facing = cameraYaw();
    if (pan) {
      const progress = Math.min(1, (now - pan.started) / 540);
      const difference = facing - pan.from;
      yaw = pan.from + Math.atan2(Math.sin(difference),Math.cos(difference)) * ease(progress);
      if (progress === 1) pan = null;
    } else yaw = facing;
    if (doorTransition) {
      const time = Math.min(1, (now - doorTransition.started) / 430);
      doorAmount = blend(doorTransition.from, doorTransition.to, ease(time));
      if (time >= 1) doorTransition = null;
    }
    if (curtainTransition) {
      const { from, to, started, job } = curtainTransition;
      const progress = ease((now - started) / 1150);
      curtainAmount = blend(from,to,progress);
      if (progress >= 1) {
        curtainTransition = null;
        dispatchCurtainFinished(job);
      }
    }
    guideStatus();
    paint(now);
    if (gripMotion?.started != null && !gripMotion.done) {
      const { job, started } = gripMotion;
      const elapsed = reduceMotion.matches ? gripDuration : now - started;
      if (elapsed >= gripRelease && !gripMotion.transferred) {
        gripMotion.transferred = true;
        dispatchGripEvent("companion-grip-transferred", job);
      }
      if (elapsed >= gripDuration) {
        gripMotion.done = true;
        dispatchGripEvent("companion-grip-finished", job);
      }
    }
    const lightAnimating = model.spotlight && now - spotlightAt < 930;
    const doorAnimating = model.doorOpen && now - doorPulseAt < 1100;
    if (motion || residentMotion || pan || doorTransition || curtainTransition || (gripMotion && !gripMotion.done) ||
        (!reduceMotion.matches && (lightAnimating || doorAnimating))) schedule();
  }

  function dispatchGripEvent(type, job) {
    queueMicrotask(() => {
      if (model.gripJob === job) window.dispatchEvent(new CustomEvent(type, { detail: job }));
    });
  }

  function dispatchCurtainFinished(job) {
    queueMicrotask(() => {
      if (model.curtainJob === job) window.dispatchEvent(new CustomEvent("companion-curtain-finished", {detail:job}));
    });
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function show(next) {
    const before = model;
    model = next;
    const now = performance.now();
    const newRail = before.rail !== next.rail;
    const movedResident = before.actor !== next.actor;
    if (movedResident) {
      residentMotion = startResidentMotion(next.actor,now);
      if (next.actor?.path && !residentMotion) dispatchResidentArrival(next.actor);
    }
    if (residentToggle) {
      const controls = Boolean(next.residentControls && next.actor);
      residentToggle.hidden = residentHint.hidden = !controls;
      residentToggle.disabled = Boolean(next.gripJob);
      residentToggle.setAttribute("aria-pressed", String(Boolean(next.residentSelected)));
      room.dataset.residentSelected = String(Boolean(next.residentSelected));
      const hint = next.gripJob ? "Move your character after the gripper stops." : next.residentSelected ?
        "Choose an open floor spot or use the arrow keys." : "Select the person, then choose a place to move.";
      if (controls && residentHint.textContent !== hint) residentHint.textContent = hint;
    }
    if (next.gripJob !== before.gripJob) {
      gripMotion = next.gripJob ? { job: next.gripJob, started: null, done: false } : null;
    }
    if (newRail) {
      carrier = stops().idle;
      motion = null;
    }
    room.dataset.rail = next.rail;
    if (next.doorOpen !== before.doorOpen) {
      const goal = next.doorOpen ? 1 : 0;
      doorPulseAt = next.doorOpen ? now : -Infinity;
      if (reduceMotion.matches) doorAmount = goal;
      else doorTransition = { from: doorAmount, to: goal, started: now };
    }
    const curtainGoal = next.curtainsClosed ? 1 : 0;
    if (next.curtainJob && next.curtainJob !== before.curtainJob) {
      if (reduceMotion.matches) {
        curtainAmount = curtainGoal;
        curtainTransition = null;
        dispatchCurtainFinished(next.curtainJob);
      } else {
        curtainTransition = {from:curtainAmount,to:curtainGoal,started:now,job:next.curtainJob};
      }
    } else if (!next.curtainJob) {
      curtainAmount = curtainGoal;
      curtainTransition = null;
    }

    if (before.target !== next.target || newRail || (movedResident && next.target === "recipient") ||
        (motion?.preview && before.camera !== next.camera)) {
      const goal = targetStop(next.target);
      if (reduceMotion.matches || newRail || next.target === "hold") {
        carrier = goal;
        motion = null;
      } else {
        const duration = next.rail === "gantry" ? 950 : 730;
        motion = { from: carrier, since: now, route: [{ target: goal, duration }] };
      }
    }
    if (next.spotlight && (!before.spotlight || newRail || next.highlightItem !== before.highlightItem)) spotlightAt = now;
    if (inspectionTarget(before) !== inspectionTarget(next) && !reduceMotion.matches) {
      pan = { from: yaw, started: now };
    }
    if (!next.spotlight) room.dataset.spotlight = "off";
    if (reduceMotion.matches) {
      cancelAnimationFrame(frame);
      tick(now);
    } else schedule();
  }

  function preview() {
    const points = stops();
    const goal = targetStop(model.target);
    if (reduceMotion.matches) carrier = points.preview;
    const duration = model.rail === "gantry" ? 1120 : 900;
    motion = {
      from: carrier,
      since: performance.now(),
      preview: true,
      route: reduceMotion.matches ? [{ target: points.preview, duration: 800 }, { target: goal, duration: 1 }] : [
        { target: points.preview, duration },
        { target: points.preview, duration: 380 },
        { target: goal, duration }
      ]
    };
    schedule();
  }

  function resetMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    carrier = gantryStops.idle;
    model = { rail: "gantry", camera: false, zones: [], target: "idle", spotlight: false, doorOpen: false };
    motion = null;
    pan = null;
    yaw = .91;
    doorTransition = null;
    doorAmount = 0;
    doorPulseAt = -Infinity;
    curtainAmount = 0;
    curtainTransition = null;
    spotlightAt = -Infinity;
    gripMotion = null;
    residentMotion = null;
    hoverPoint = null;
    tappedObject = null;
    pressedPointer = "";
    if (objectName) objectName.hidden = true;
  }

  function chooseResidentSpot(x, y, keepSelected = false) {
    const actor = planResidentMove(x,y);
    if (!actor) {
      residentHint.textContent = "Choose an open spot on the floor.";
      return;
    }
    window.dispatchEvent(new CustomEvent("companion-resident-move", {detail:{actor,keepSelected}}));
  }

  residentToggle?.addEventListener("click", event => {
    // The avatar's larger touch target can overlap a small prop on the canvas.
    if (isTouchClick(event) && !model.residentSelected) {
      const item = roomObjectAt(...pointerPosition(event),2,true);
      if (item) {
        hoverPoint = null;
        tappedObject = item.id;
        updateObjectName();
        return;
      }
    }
    window.dispatchEvent(new CustomEvent("companion-resident-select"));
  });
  residentToggle?.addEventListener("keydown", event => {
    if (!model.residentSelected || model.gripJob) return;
    if (event.key === "Escape") {
      window.dispatchEvent(new CustomEvent("companion-resident-select"));
      return;
    }
    const step = {ArrowLeft:[-.32,.32],ArrowRight:[.32,-.32],ArrowUp:[-.32,-.32],ArrowDown:[.32,.32]}[event.key];
    if (!step) return;
    event.preventDefault();
    const actor = residentPose();
    chooseResidentSpot(actor.x + step[0], actor.y + step[1], true);
  });

  new ResizeObserver(resize).observe(room);
  room.addEventListener("pointermove", event => {
    if (event.pointerType === "touch" || event.buttons) return;
    hoverPoint = event.target === canvas || event.target === residentToggle ? pointerPosition(event) : null;
    tappedObject = null;
    updateObjectName();
  });
  room.addEventListener("pointerleave", event => {
    if (event.pointerType === "touch") return;
    hoverPoint = null;
    updateObjectName();
  });
  room.addEventListener("pointerdown", event => {
    pressedPointer = event.pointerType;
  });
  room.addEventListener("pointercancel", () => { pressedPointer = ""; });
  document.addEventListener("pointerdown", event => {
    if (event.target === canvas || !tappedObject) return;
    tappedObject = null;
    updateObjectName();
  });
  canvas.addEventListener("click", event => {
    const [x,y] = pointerPosition(event);
    const hit = roomLabelAt(x,y);
    if (isTouchClick(event)) {
      hoverPoint = null;
      tappedObject = !model.residentSelected && !roomLabelAt(x,y,0) ? roomObjectAt(x,y,11)?.id ?? null : null;
      updateObjectName();
      if (tappedObject) return;
    }
    if (model.residentSelected && !model.gripJob) {
      const area = hit && areaStops[hit.label];
      if (area) chooseResidentSpot(area.x,area.y);
      else chooseResidentSpot(...groundPoint(x,y));
    } else if (hit) window.dispatchEvent(new CustomEvent('companion-area',{detail:hit.label}));
  });
  resize();
  window.companionRoom = { show, preview, resetMotion, items, landmarks, areaStops, planResidentMove, currentResidentZone, residentAtDoor };
})();
