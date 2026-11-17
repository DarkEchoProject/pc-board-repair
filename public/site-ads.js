(() => {
  const main = document.querySelector("main");
  if (!main || !document.querySelector('[data-ad-slot="top-square-1"]')) return;

  const sectionSelector = [
    "section:not(.chatShell)", "article", "h2", "details",
    ".downloadBox", ".boardStats", ".biosStats", ".diagGrid",
    ".bootFlow", ".policyBox", ".contactHero", ".chatRules", ".chatIntroBar",
  ].join(",");
  let scheduled = false;

  function updateSpaces() {
    scheduled = false;
    const sections = Array.from(main.children).filter(element =>
      element.matches(sectionSelector) && !element.hidden &&
      getComputedStyle(element).display !== "none"
    );
    const existing = new Map(Array.from(main.children)
      .filter(element => element.matches(".pcbrAdSpaces--between"))
      .map(element => [element.dataset.adBefore, element]));

    sections.slice(1).forEach((section, index) => {
      const key = section.id || `section-${index + 2}`;
      let space = existing.get(key);
      if (!space) {
        const english = document.documentElement.lang === "en";
        space = document.createElement("aside");
        space.className = "pcbrAdSpaces pcbrAdSpaces--between";
        space.dataset.adBefore = key;
        space.setAttribute("aria-label", english ? "Advertising spaces" : "مساحات إعلانية");
        const slot = document.createElement("div");
        slot.className = "pcbrAdSlot pcbrAdSlot--banner";
        slot.dataset.adSlot = `content-inline-${key}`;
        const label = document.createElement("span");
        label.textContent = english ? "Advertise here" : "أعلن هنا";
        slot.append(label);
        space.append(slot);
      }
      if (space.nextElementSibling !== section) main.insertBefore(space, section);
      existing.delete(key);
    });
    for (const space of existing.values()) space.remove();
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateSpaces);
  }

  updateSpaces();
  new MutationObserver(records => {
    if (records.some(record => record.target === main ||
      (record.type === "attributes" && record.target.parentElement === main))) {
      scheduleUpdate();
    }
  }).observe(main, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "style", "class"],
  });
})();
