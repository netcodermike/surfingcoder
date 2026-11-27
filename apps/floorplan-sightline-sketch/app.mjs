export const rooms = {
  gallery: [[2.75, 1, 2.75, 7], [5, 3.5, 8.75, 3.5], [6.25, 6.25, 6.25, 9], [7.75, 7.5, 9, 7.5]],
  atrium: [[2.5, 5, 4.75, 5], [4.75, 2, 4.75, 5], [7, 1, 7, 3], [7, 6, 7, 9]],
};
const size = 10;
const boundary = [[0, 0, size, 0], [size, 0, size, size], [size, size, 0, size], [0, size, 0, 0]];
const cross = (ax, ay, bx, by) => ax * by - ay * bx;
const epsilon = 1e-7;

export function visibleFloor(x, y, partitions) {
  if (![x, y].every(value => Number.isFinite(value) && value > 0 && value < size)) {
    throw Error("Choose a viewpoint inside the floor plan.");
  }
  for (const [ax, ay, bx, by] of partitions) {
    const onLine = Math.abs(cross(x - ax, y - ay, bx - ax, by - ay)) < epsilon;
    if (onLine && (x - ax) * (x - bx) + (y - ay) * (y - by) <= 0) {
      throw Error("Move the viewpoint off the partition.");
    }
  }
  const walls = [...boundary, ...partitions];
  const angles = walls.flatMap(([ax, ay, bx, by]) =>
    [Math.atan2(ay - y, ax - x), Math.atan2(by - y, bx - x)]);
  const rays = angles.flatMap(angle => [angle - epsilon, angle, angle + epsilon]).sort((a, b) => a - b);
  return rays.map(angle => {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let distance = Infinity;
    for (const [ax, ay, bx, by] of walls) {
      const sx = bx - ax, sy = by - ay;
      const determinant = cross(dx, dy, sx, sy);
      if (Math.abs(determinant) < 1e-12) continue;
      const t = cross(ax - x, ay - y, sx, sy) / determinant;
      const u = cross(ax - x, ay - y, dx, dy) / determinant;
      if (t > 0 && u >= -1e-10 && u <= 1 + 1e-10) distance = Math.min(distance, t);
    }
    return [x + distance * dx, y + distance * dy];
  });
}

export function polygonArea(points) {
  return Math.abs(points.reduce((sum, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return sum + cross(x, y, nextX, nextY);
  }, 0)) / 2;
}

if (typeof document !== "undefined") {
  const plot = document.querySelector("#floorplan");
  const room = document.querySelector("#room");
  const east = document.querySelector("#east");
  const south = document.querySelector("#south");
  const walls = document.querySelector("#walls");
  const view = document.querySelector("#visibility");
  const point = document.querySelector("#viewpoint");
  const status = document.querySelector("#reading");
  function render() {
    const x = east.valueAsNumber, y = south.valueAsNumber;
    const partitions = rooms[room.value];
    document.querySelector("#east-value").value = east.value;
    document.querySelector("#south-value").value = south.value;
    point.setAttribute("cx", x);
    point.setAttribute("cy", y);
    walls.setAttribute("d", partitions.map(([ax, ay, bx, by]) =>
      "M" + ax + " " + ay + "L" + bx + " " + by).join(" "));
    try {
      const polygon = visibleFloor(x, y, partitions);
      view.setAttribute("points", polygon.map(pair => pair.join(",")).join(" "));
      status.textContent = polygonArea(polygon).toFixed(1) + "% of the model floor is visible.";
    } catch (error) {
      view.removeAttribute("points");
      status.textContent = error.message;
    }
  }
  plot.addEventListener("click", event => {
    const transform = plot.getScreenCTM();
    if (!transform) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
    if (p.x < 0 || p.x > size || p.y < 0 || p.y > size) return;
    east.value = Math.max(.25, Math.min(9.75, p.x));
    south.value = Math.max(.25, Math.min(9.75, p.y));
    render();
  });
  for (const input of [room, east, south]) input.addEventListener("input", render);
  render();
}
