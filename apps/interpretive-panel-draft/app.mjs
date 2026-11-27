const words = new Intl.Segmenter("en", { granularity: "word" });

export function draftPanel({ title, body, caption }, target) {
  if (!Number.isInteger(target) || target < 20 || target > 500) throw Error("Enter a word budget from 20 to 500.");
  const paragraphs = body.trim().split(/\r?\n\s*\r?\n/).filter(Boolean);
  const text = [title.trim(), ...paragraphs, caption.trim()].filter(Boolean);
  const count = [...words.segment(text.join(" "))].filter(item => item.isWordLike).length;
  return { title: title.trim(), paragraphs, caption: caption.trim(), count, remaining: target - count,
    readingSeconds: Math.ceil(count / 2.5), plainText: text.join("\n\n") };
}

if (typeof document !== "undefined") {
  const form = document.querySelector("#panel-form");
  const panel = document.querySelector("#draft-panel");
  const caption = document.querySelector("#preview-caption");
  const reading = document.querySelector("#reading");
  const manuscript = document.querySelector("#preview-body");
  function update() {
    const { headline, body, note, budget, layout } = form.elements;
    panel.dataset.layout = layout.value;
    try {
      const result = draftPanel({ title: headline.value, body: body.value, caption: note.value }, budget.valueAsNumber);
      document.querySelector("#preview-title").textContent = result.title;
      manuscript.replaceChildren(...result.paragraphs.map(text => {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        return paragraph;
      }));
      caption.textContent = result.caption;
      caption.hidden = !result.caption;
      reading.textContent = result.count + " words · " + Math.abs(result.remaining) +
        (result.remaining < 0 ? " over budget" : " remaining") + " · ~" + result.readingSeconds + " sec at 150 words/min";
    } catch (error) {
      reading.textContent = error.message;
    }
  }
  form.addEventListener("input", update);
  update();
}
