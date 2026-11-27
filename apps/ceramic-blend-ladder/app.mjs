export function blendLadder(grams, steps) {
  if (!Number.isFinite(grams) || grams < .01 || grams > 100000) throw Error("Enter 0.01 to 100,000 grams per sample.");
  if (!Number.isInteger(steps) || steps < 3 || steps > 21) throw Error("Enter a whole number of samples from 3 to 21.");
  const total = Math.round(grams * 100);
  return Array.from({ length: steps }, (_, index) => {
    const fraction = index / (steps - 1);
    const b = Math.round(total * fraction);
    return { number: index + 1, ratioB: fraction, a: total - b, b };
  });
}

export function blendCsv(samples) {
  const output = ["sample,percent_b,blend_a_g,blend_b_g"];
  for (const { number, ratioB, a, b } of samples) {
    output.push([number, (ratioB * 100).toFixed(2), (a / 100).toFixed(2), (b / 100).toFixed(2)].join(","));
  }
  return output.join("\r\n") + "\r\n";
}

if (typeof document !== "undefined") {
  const grams = document.querySelector("#grams");
  const steps = document.querySelector("#steps");
  const rows = document.querySelector("#blend-rows");
  const status = document.querySelector("#reading");
  const exportButton = document.querySelector("#export-scale");
  let samples;
  function draw() {
    rows.replaceChildren();
    try {
      samples = blendLadder(grams.valueAsNumber, steps.valueAsNumber);
      for (const { number, ratioB, a, b } of samples) {
        const row = rows.insertRow();
        const starting = [207, 158, 120], ending = [106, 187, 184];
        const color = starting.map((channel, index) => Math.round(channel + ratioB * (ending[index] - channel)));
        for (const [index, value] of [number, (ratioB * 100).toFixed(1) + "%", (a / 100).toFixed(2), (b / 100).toFixed(2)].entries()) {
          const cell = row.insertCell();
          cell.textContent = value;
          if (index === 0) cell.style.borderInlineStart = "5px solid rgb(" + color.join(" ") + ")";
        }
      }
      status.textContent = samples.length + " samples · " +
        (samples.reduce((sum, item) => sum + item.a + item.b, 0) / 100).toFixed(2) + " g total";
      exportButton.disabled = false;
    } catch (error) {
      samples = undefined;
      status.textContent = error.message;
      exportButton.disabled = true;
    }
  }
  for (const input of [grams, steps]) input.addEventListener("input", draw);
  exportButton.addEventListener("click", () => {
    if (!samples) return;
    const href = URL.createObjectURL(new Blob([blendCsv(samples)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = "ceramic-blend-ladder.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
  draw();
}
