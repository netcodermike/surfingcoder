export function planCurb(total, segments) {
  if (!Number.isFinite(total) || total <= 0 || total > 5000) throw new Error("Frontage must be between 0 and 5,000 feet.");
  if (!segments.length || segments.length > 20) throw new Error("Enter between one and twenty segments.");
  let used = 0;
  const blocks = segments.map(({name, feet}) => {
    if (!name || name.length > 50 || !Number.isFinite(feet) || feet <= 0 || feet > 5000) {
      throw new Error("Each segment needs a name and a positive length up to 5,000 feet.");
    }
    const from = used;
    used += feet;
    return {name, feet, from, to: used};
  });
  return {blocks, used, remaining: total - used};
}

export function readSegments(text) {
  return text.trim().split(/\r?\n/).filter(line => line.trim()).map(line => {
    const parts = line.split(",");
    if (parts.length !== 2 || !parts[1].trim()) throw new Error("Use a name and length on each line, separated by a comma.");
    return {name: parts[0].trim(), feet: Number(parts[1])};
  });
}

if (typeof document !== "undefined") {
  const form = document.querySelector("#curb-form");
  const strip = document.querySelector("#curb-strip");
  const rows = document.querySelector("#curb-rows");
  const reading = document.querySelector("#reading");
  const format = new Intl.NumberFormat(undefined, {maximumFractionDigits: 2});
  const colors = ["#c096f0", "#74d5cd", "#f6bd83", "#8aa9ff", "#f09aba"];
  const svg = (tag, options) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(options)) node.setAttribute(name, value);
    return node;
  };
  form.addEventListener("submit", event => {
    event.preventDefault();
    try {
      const frontage = Number(form.elements.frontage.value);
      const result = planCurb(frontage, readSegments(form.elements.segments.value));
      const scale = 700 / Math.max(frontage, result.used);
      const x = length => 30 + length * scale;
      strip.replaceChildren(svg("rect", {x: 30, y: 45, width: 700, height: 54, rx: 8, fill: "#2c2638"}));
      rows.replaceChildren();
      result.blocks.forEach(({name, feet, from, to}, index) => {
        const color = colors[index % colors.length];
        const rect = svg("rect", {x: x(from), y: 45, width: feet * scale, height: 54, fill: color});
        const title = svg("title", {});
        title.textContent = name + " · " + format.format(feet) + " ft";
        rect.append(title);
        strip.append(rect);
        const row = document.createElement("tr");
        for (const value of [name, format.format(from), format.format(to), format.format(feet)]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        }
        row.firstElementChild.style.borderInlineStart = "4px solid " + color;
        rows.append(row);
      });
      strip.append(svg("line", {x1: x(frontage), x2: x(frontage), y1: 30, y2: 116, stroke: "#fff2dc", "stroke-width": 3}));
      const end = svg("text", {x: Math.max(140, x(frontage)), y: 141, fill: "#f1e6ff", "text-anchor": "end"});
      end.textContent = "Frontage " + format.format(frontage) + " ft";
      strip.append(end);
      reading.textContent = format.format(result.used) + " ft assigned · " +
        format.format(Math.abs(result.remaining)) + (result.remaining < 0 ? " ft over frontage" : " ft available");
    } catch (error) {
      strip.replaceChildren();
      rows.replaceChildren();
      reading.textContent = error.message;
    }
  });
  form.requestSubmit();
}
