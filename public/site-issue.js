(() => {
  const form = document.getElementById("siteIssueForm");
  const type = document.getElementById("siteIssueType");
  const page = document.getElementById("siteIssuePage");
  const description = document.getElementById("siteIssueDescription");
  const status = document.getElementById("siteIssueStatus");
  const address = "alinasser00001@gmail.com";
  const canonical = new URL(document.querySelector('link[rel="canonical"]').href);
  const sourcePath = new URLSearchParams(location.search).get("from");

  if (sourcePath?.startsWith("/") && !sourcePath.startsWith("//") && !/[\\#\u0000-\u001f\u007f]/.test(sourcePath)) {
    const source = new URL(sourcePath, canonical);
    if (source.origin === canonical.origin && source.href.length <= page.maxLength) page.value = source.href;
  }

  function reportText() {
    return [
      `نوع البلاغ — ${type.value}`,
      page.value ? `الصفحة — ${page.value}` : "",
      `وصف المشكلة — ${description.value.trim()}`,
    ].filter(Boolean).join("\r\n\r\n");
  }

  function validReport() {
    description.setCustomValidity(description.value.trim() ? "" : "اكتب وصفًا مختصرًا للمشكلة.");
    return form.reportValidity();
  }

  description.addEventListener("input", () => description.setCustomValidity(""));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validReport()) return;
    const subject = encodeURIComponent(`بلاغ PC Board Repair — ${type.value}`);
    const body = encodeURIComponent(reportText());
    status.textContent = `راجع الرسالة في تطبيق البريد ثم أرسلها إلى ${address}.`;
    location.href = `mailto:${address}?subject=${subject}&body=${body}`;
  });
  document.getElementById("siteIssueCopy").addEventListener("click", async () => {
    if (!validReport()) return;
    try {
      await navigator.clipboard.writeText(reportText());
      status.textContent = `تم نسخ البلاغ. الصقه في رسالة إلى ${address}.`;
    } catch {
      status.textContent = `تعذّر النسخ. استخدم زر تجهيز بريد البلاغ أو راسل ${address}.`;
    }
  });
  form.hidden = false;
})();
