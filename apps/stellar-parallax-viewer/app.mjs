export function observe(distancePc) {
  if (!Number.isFinite(distancePc) || distancePc <= 0) throw new Error("Enter a positive distance in parsecs.");
  const angle = 1 / distancePc;
  return {angle, separation: 2 * angle, lightYears: 3.262 * distancePc, first: -angle, second: angle};
}

export function inferDistance(separation) {
  if (!Number.isFinite(separation) || separation <= 0) throw new Error("Enter a positive apparent separation.");
  return 2 / separation;
}

if (typeof document !== "undefined") {
  const distance = document.querySelector("#distance");
  const reading = document.querySelector("#reading");
  const distanceOutput = document.querySelector("#distance-label");
  const shift = document.querySelector("#shift");
  const result = document.querySelector("#inference");
  function draw() {
    const pc = Number(distance.value);
    const {angle, separation, lightYears, first, second} = observe(pc);
    distanceOutput.value = pc + " pc";
    for (const [id, position] of [["first", first], ["second", second]]) {
      document.querySelector("#" + id).setAttribute("transform", "translate(" + (400 + position * 160) + " 152)");
    }
    reading.textContent = angle.toFixed(3) + " arcsec parallax · " + separation.toFixed(3) +
      " arcsec across the two dates · " + lightYears.toFixed(2) + " light-years";
  }
  function estimate() {
    try {
      result.textContent = inferDistance(shift.valueAsNumber).toFixed(2) + " pc from the apparent shift";
    } catch (error) {
      result.textContent = error.message;
    }
  }
  distance.addEventListener("input", draw);
  shift.addEventListener("input", estimate);
  draw();
  estimate();
}
