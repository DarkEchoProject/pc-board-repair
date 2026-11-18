(() => {
  const root = document.getElementById("marketAdminList"); if (!root) return;
  const $ = id => document.getElementById(id);
  let page = 1, pages = 0, loading = false, imageUrls = [];
  function clearImages() { imageUrls.forEach(url => URL.revokeObjectURL(url)); imageUrls = []; }
  const status = message => { $("marketAdminStatus").textContent = message; };
  async function api(path, options = {}) {
    const token = sessionStorage.getItem("pcbr-admin-token") || "";
    const response = await fetch(path, { cache: "no-store", ...options, headers: { authorization: "Bearer " + token, ...(options.body ? { "content-type": "application/json" } : {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "تعذّر تحميل السوق.");
    return data;
  }
  function card(item) {
    const article = document.createElement("article"); article.className = "adminCard" + (item.reports.length ? " reported" : "");
    const top = document.createElement("div"); top.className = "adminTop";
    const title = document.createElement("strong"); title.textContent = item.title;
    const kind = document.createElement("span"); kind.className = "brandTag"; kind.textContent = item.kind === "wanted" ? "مطلوب" : "للبيع";
    const badge = document.createElement("span"); badge.className = "reportBadge"; badge.textContent = item.moderated ? "مخفي" : item.reports.length + " بلاغ";
    top.append(title, kind, badge);
    const details = document.createElement("p"); details.className = "adminText"; details.textContent = `${item.ownerName} · ${item.city}، ${item.country}\n${item.description}`;
    const actions = document.createElement("div"); actions.className = "adminActions";
    const gallery = document.createElement("div"); gallery.className = "adminRow";
    if (item.photos.length) {
      const images = document.createElement("button"); images.type = "button"; images.className = "softBtn"; images.textContent = "عرض الصور";
      images.onclick = async () => {
        images.disabled = true;
        try {
          for (const photo of item.photos) {
            const response = await fetch("/api/admin/market/images/" + photo.id, { cache: "no-store", headers: { authorization: "Bearer " + (sessionStorage.getItem("pcbr-admin-token") || "") } });
            if (!response.ok) throw new Error("تعذّر عرض صورة الإعلان.");
            const url = URL.createObjectURL(await response.blob()); imageUrls.push(url);
            const img = document.createElement("img"); img.src = url; img.alt = item.title; img.style.cssText = "max-width:200px;max-height:150px;object-fit:contain;border-radius:10px;margin-top:12px"; gallery.append(img);
          }
          images.remove();
        } catch (error) { images.disabled = false; status(error.message); }
      };
      actions.append(images);
    }
    const link = document.createElement("a"); link.className = "softBtn"; link.href = "/market/?listing=" + encodeURIComponent(item.id); link.target = "_blank"; link.rel = "noopener"; link.textContent = "فتح الإعلان"; actions.append(link);
    for (const [action, label] of [[item.moderated ? "restore" : "hide", item.moderated ? "إعادة للسوق" : "إخفاء الإعلان"], ...(item.reports.length ? [["dismiss", "تجاهل البلاغات"]] : [])]) {
      const button = document.createElement("button"); button.type = "button"; button.className = action === "hide" ? "dangerBtn" : "softBtn"; button.textContent = label;
      button.onclick = async () => {
        button.disabled = true;
        try { await api("/api/admin/market/action", { method: "POST", body: JSON.stringify({ id: item.id, action }) }); await load(); }
        catch (error) { status(error.message); }
        finally { button.disabled = false; }
      };
      actions.append(button);
    }
    const reports = document.createElement("div");
    for (const report of item.reports) { const p = document.createElement("p"); p.className = "adminText muted"; p.textContent = `⚑ ${report.reason}${report.details ? " — " + report.details : ""}`; reports.append(p); }
    article.append(top, details, reports, actions, gallery); return article;
  }
  async function load() {
    if (loading || $("dashboard").classList.contains("hidden")) return;
    loading = true; const session=sessionStorage.getItem("pcbr-admin-token"); status("جاري تحميل إعلانات السوق…");
    try {
      const data = await api(`/api/admin/market/overview?filter=${encodeURIComponent($("marketAdminFilter").value)}&page=${page}`);
      if(session!==sessionStorage.getItem("pcbr-admin-token")||$("dashboard").classList.contains("hidden"))return;
      pages = data.pages;
      clearImages(); root.replaceChildren(...data.items.map(card));
      if (!data.items.length) { const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "لا توجد إعلانات ضمن هذا الاختيار."; root.append(empty); }
      $("marketAdminPage").textContent = data.total ? `صفحة ${data.page} من ${data.pages} · ${data.total} إعلان` : "";
      $("marketAdminPrev").disabled = page <= 1; $("marketAdminNext").disabled = page >= pages; status("تم تحديث السوق.");
    } catch (error) { status(error.message); }
    finally { loading = false; }
  }
  $("marketAdminRefresh").addEventListener("click", load);
  $("marketAdminFilter").addEventListener("change", () => { page = 1; load(); });
  $("marketAdminPrev").addEventListener("click", () => { if (page > 1) { page--; load(); } });
  $("marketAdminNext").addEventListener("click", () => { if (page < pages) { page++; load(); } });
  // Refresh is handled by the active dashboard section.
  new MutationObserver(() => { if (!$("dashboard").classList.contains("hidden")) load(); else { clearImages(); root.replaceChildren(); status(""); } }).observe($("dashboard"), { attributes: true, attributeFilter: ["class"] });
  load();
})();
