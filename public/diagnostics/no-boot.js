const flow = document.querySelector("[data-boot-flow]");
const steps = new Map(
  Array.from(flow.querySelectorAll("[data-boot-step]"), (step) => [step.id, step]),
);
const controls = flow.querySelector("[data-boot-controls]");
const stage = flow.querySelector("[data-boot-stage]");
const handoff = flow.querySelector("[data-boot-handoff]");
const svgNamespace = "http://www.w3.org/2000/svg";
const sprite = "/diagnostics/images/no-boot-mini.svg";

function createDemo(scene, sizeClass) {
  const picture = document.createElementNS(svgNamespace, "svg");
  picture.setAttribute("viewBox", "0 0 120 84");
  picture.setAttribute("aria-hidden", "true");
  picture.setAttribute("focusable", "false");
  picture.classList.add("bootDemo", sizeClass);
  picture.dataset.scene = scene;

  const layers = [
    ["monitor", "bootDemoFrame"],
    [scene === "blank" ? "logo" : "trace", "bootDemoTrace"],
    [scene, "bootDemoScene"],
  ];
  for (const [id, className] of layers) {
    const layer = document.createElementNS(svgNamespace, "use");
    layer.setAttribute("href", sprite + "#" + id);
    layer.classList.add(className);
    picture.append(layer);
  }
  return picture;
}

for (const step of steps.values()) {
  const title = step.querySelector("h2");
  const row = document.createElement("div");
  row.className = "bootStepHeading";
  title.before(row);
  row.append(createDemo(step.dataset.bootDemo, "bootDemoHeading"), title);

  for (const choice of step.querySelectorAll(".bootChoice")) {
    const next = steps.get(choice.hash.slice(1));
    const scene = choice.dataset.bootDemo ?? next?.dataset.bootDemo ?? "inspect";
    choice.classList.add("bootChoiceAnimated");
    choice.prepend(createDemo(scene, "bootDemoThumb"));
  }
}

function showStep(focusStep) {
  const current = steps.get(window.location.hash.slice(1)) ?? steps.get("start");

  for (const step of steps.values()) {
    step.hidden = step !== current;
  }
  stage.textContent = current.dataset.bootStep;
  handoff.hidden = current.id === "report";
  controls.hidden = false;

  if (focusStep) {
    current.querySelector("h2").focus({ preventScroll: true });
    flow.scrollIntoView({ block: "start", behavior: "instant" });
  }
}

showStep(steps.has(window.location.hash.slice(1)));
window.addEventListener("hashchange", () => showStep(true));
