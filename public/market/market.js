(() => {
  const $ = id => document.getElementById(id);
  const CATEGORIES = { "desktop-board": "بورد كمبيوتر مكتبي", "laptop-board": "بورد لابتوب", "graphics-board": "بورد كرت شاشة", ic: "آيسي", mosfet: "MOSFET وقطع تغذية", connector: "موصل أو منفذ", "computer-part": "قطعة كمبيوتر", "other-part": "قطعة صيانة أخرى" };
  const CONDITIONS = { working: "مفحوصة وتعمل", faulty: "معطلة", donor: "خردة للقطع", untested: "غير مفحوصة", new: "جديدة", any: "حسب المطلوب" };
  const DELIVERY = { pickup: "استلام باليد", shipping: "يمكن الشحن", agreement: "حسب الاتفاق" };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const boardIcon = '<svg class="marketBoardIcon" viewBox="0 0 100 100" fill="none" aria-hidden="true"><rect x="10" y="10" width="80" height="80" rx="10" stroke="currentColor" stroke-width="3"/><rect x="34" y="30" width="32" height="36" rx="4" stroke="currentColor" stroke-width="3"/><path d="M34 38H19M34 48H19M34 58H19M66 38H81M66 48H81M66 58H81M42 30V19M52 30V19M60 30V19M42 66V81M52 66V81M62 66V81" stroke="currentColor" stroke-width="3"/><circle cx="21" cy="21" r="3" fill="currentColor"/><circle cx="79" cy="79" r="3" fill="currentColor"/></svg>';
  const state = { kind: "", region: "", category: "", q: "", mine: false, page: 1, pages: 0 };
  let user = null, sessionError = false, sessionPromise, listController, detailController, currentListing, detailPage = 1, detailPages = 0;
  let editing = null, photoDraft = [], photoGeneration = 0, processingPhotos = false, saving = false, requestId = "", replyRequestId = "", toastTimer;
  const DRAFT_KEY = "pcbr-market-draft-v1";

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { if (response.status === 401 && !path.startsWith("/api/auth/")) { user = null; sessionPromise = Promise.resolve(null); } const error = new Error(data.error || "تعذّر الاتصال بالسوق. حاول مجددًا."); error.status = response.status; error.code = data.code; throw error; }
    return data;
  }
  const write = (path, body, method = "POST") => api(path, { method, body: JSON.stringify(body) });
  function toast(message) { clearTimeout(toastTimer); $("marketToast").textContent = message; $("marketToast").hidden = false; toastTimer = setTimeout(() => { $("marketToast").hidden = true; }, 4500); }
  async function readSession() {
    sessionError = false;
    try { const data = await api("/api/auth/me"); user = data.authenticated ? data.user : null; }
    catch (error) { user = null; sessionError = error.status !== 401; }
    return user;
  }
  async function requireUser(compose = false) {
    await sessionPromise;
    if (user) return true;
    if (sessionError) { toast("تعذّر التحقق من تسجيل الدخول. حدّث الصفحة وحاول مجددًا."); return false; }
    const next = new URL(location.href); if (compose) next.searchParams.set("compose", "1");
    $("marketLoginLink").href = "/login?next=" + encodeURIComponent(next.pathname + next.search);
    if (!$("marketSignIn").open) $("marketSignIn").showModal();
    return false;
  }
  function price(item) {
    if (item.price === null || item.price === "") return item.kind === "wanted" ? "الميزانية على الاتفاق" : "السعر على الاتفاق";
    if (Number(item.price) === 0 && item.kind === "sale") return "مجاني";
    const amount = Number(item.price).toLocaleString("en-US", { maximumFractionDigits: 2 });
    return `${amount} ${item.currency === "USD" ? "$" : item.currency === "EUR" ? "€" : "ل.ل"}`;
  }
  function when(iso) {
    const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
    const [unit, number] = elapsed >= 86400000 ? ["day", Math.floor(elapsed / 86400000)] : elapsed >= 3600000 ? ["hour", Math.floor(elapsed / 3600000)] : ["minute", Math.floor(elapsed / 60000)];
    return new Intl.RelativeTimeFormat("ar", { numeric: "auto" }).format(-number, unit);
  }
  function badge(item) { return item.moderated ? "مخفي من الإدارة" : item.status === "closed" ? (item.kind === "sale" ? "تم البيع" : "تم العثور عليها") : item.kind === "wanted" ? "مطلوب" : "للبيع"; }
  function detailUrl(id) { const url = new URL("/market/", location.origin); url.searchParams.set("listing", id); return url; }
  function itemCard(item) {
    const url = `/market/?listing=${encodeURIComponent(item.id)}`;
    const cover = item.photos[0] ? `<img src="${esc(item.photos[0].url)}" alt="${esc(item.title)}" loading="lazy" width="480" height="360">` : `<div class="marketPhotoPlaceholder">${boardIcon}<span>صورة غير مضافة</span></div>`;
    return `<article class="marketCard"><a class="marketCardLink" href="${url}" data-market-open="${esc(item.id)}"><div class="marketCardCover">${cover}<span class="marketBadge${item.kind === "wanted" ? " isWanted" : ""}${item.status === "closed" || item.moderated ? " isClosed" : ""}">${badge(item)}</span></div></a><div class="marketCardBody"><p class="marketCardCategory">${esc(CATEGORIES[item.category])} · ${esc(CONDITIONS[item.condition])}</p><h3 class="marketCardTitle" dir="auto"><a href="${url}" data-market-open="${esc(item.id)}">${esc(item.title)}</a></h3><p class="marketPrice">${esc(price(item))}${item.negotiable && item.price !== null ? "<small>قابل للتفاوض</small>" : ""}</p><div class="marketCardMeta"><span>${esc(item.city)}، ${esc(item.country)}</span><span>${esc(DELIVERY[item.delivery])}</span></div></div><div class="marketCardFooter"><span>${esc(when(item.createdAt))} · ${item.replyCount} رد</span><a href="${url}" data-market-open="${esc(item.id)}">${item.isOwner ? "إدارة إعلاني" : "التفاصيل والتواصل"} ←</a></div></article>`;
  }
  function syncFilters() {
    $("marketQuery").value = state.q; $("marketRegion").value = state.region; $("marketCategory").value = state.category;
    $("marketMine").setAttribute("aria-pressed", String(state.mine));
    document.querySelectorAll("[data-kind]").forEach(button => { const selected = button.dataset.kind === state.kind; button.classList.toggle("isActive", selected); button.setAttribute("aria-pressed", String(selected)); });
  }
  function readFilters() {
    const p = new URLSearchParams(location.search);
    state.kind = ["sale", "wanted"].includes(p.get("kind")) ? p.get("kind") : "";
    state.region = ["tripoli", "lebanon", "world"].includes(p.get("region")) ? p.get("region") : "";
    state.category = Object.hasOwn(CATEGORIES, p.get("category")) ? p.get("category") : "";
    state.q = (p.get("q") || "").slice(0, 100); state.mine = p.get("mine") === "1";
    state.page = Math.max(1, Math.min(10000, parseInt(p.get("page"), 10) || 1)); syncFilters();
  }
  function saveFilterUrl() {
    const url = new URL(location.href);
    for (const key of ["kind", "region", "category", "q"]) state[key] ? url.searchParams.set(key, state[key]) : url.searchParams.delete(key);
    state.mine ? url.searchParams.set("mine", "1") : url.searchParams.delete("mine");
    state.page > 1 ? url.searchParams.set("page", state.page) : url.searchParams.delete("page");
    history.replaceState(null, "", url);
  }
  async function loadListings() {
    listController?.abort(); const controller = new AbortController(); listController = controller;
    $("marketBusy").hidden = false; $("marketGrid").setAttribute("aria-busy", "true");
    const p = new URLSearchParams({ page: state.page });
    for (const key of ["kind", "region", "category", "q"]) if (state[key]) p.set(key, state[key]);
    if (state.mine) p.set("mine", "1");
    try {
      const data = await api("/api/market/listings?" + p, { signal: controller.signal });
      if (listController !== controller) return;
      state.pages = data.pages; $("marketResultCount").textContent = `${data.total.toLocaleString("ar")} ${state.mine ? "من إعلاناتك" : "عرض وطلب متاح"}`;
      $("marketGrid").innerHTML = data.items.length ? data.items.map(itemCard).join("") : `<div class="marketEmpty">${boardIcon}<h3>${state.mine ? "ابدأ بإعلانك الأول" : state.q || state.kind || state.region || state.category ? "لا توجد نتائج مطابقة" : "هنا تلتقي البوردات الزائدة بالقطع الناقصة"}</h3><p>${state.q || state.region || state.category ? "جرّب رقم قطعة آخر أو وسّع المنطقة والتصنيف." : "عندك بورد خردة أو قطعة زائدة؟ اعرضها، أو انشر طلبًا للقطعة التي تحتاجها."}</p><button class="btn" type="button" data-market-add>أضف عرضًا أو طلبًا</button></div>`;
      $("marketPagination").hidden = data.pages < 2; $("marketPageLabel").textContent = `صفحة ${data.page} من ${data.pages}`;
      $("marketPrev").disabled = data.page <= 1; $("marketNext").disabled = data.page >= data.pages;
    } catch (error) {
      if (error.name === "AbortError") return;
      $("marketResultCount").textContent = "تعذّر تحميل السوق";
      $("marketGrid").replaceChildren();
      const empty = document.createElement("div"); empty.className = "marketEmpty";
      const message = document.createElement("p"); message.textContent = error.message;
      const retry = document.createElement("button"); retry.className = "marketSoftButton"; retry.type = "button"; retry.textContent = "إعادة المحاولة"; retry.onclick = loadListings;
      empty.append(message, retry); $("marketGrid").append(empty); $("marketPagination").hidden = true;
      if (error.status === 401 && state.mine) requireUser();
    } finally { if (listController === controller) { $("marketBusy").hidden = true; $("marketGrid").setAttribute("aria-busy", "false"); } }
  }
  function filterChange() { state.page = 1; saveFilterUrl(); syncFilters(); loadListings(); }
  function renderPhotos() {
    $("listingPhotoPreviews").innerHTML = photoDraft.map((photo, index) => `<div class="marketPhotoPreview"><img src="${esc(photo.url)}" alt="صورة القطعة ${index + 1}"><button class="marketPhotoRemove" type="button" data-photo-remove="${index}">إزالة</button></div>`).join("");
  }
  function editorKind() {
    const wanted = $("marketListingForm").elements.kind.value === "wanted";
    $("listingConditionField").hidden = wanted; $("listingCondition").required = !wanted;
    $("listingPriceLabel").textContent = wanted ? "الميزانية (اختياري)" : "السعر";
  }
  function contactKind() {
    const telegram = $("listingContactKind").value === "telegram";
    $("listingContactLabel").textContent = telegram ? "اسم مستخدم تلغرام *" : "الرقم مع مفتاح الدولة *";
    $("listingContact").placeholder = telegram ? "@username" : "+96170123456";
    $("listingContact").inputMode = telegram ? "text" : "tel";
  }
  async function openEditor(item = null) {
    await sessionPromise;
    photoGeneration++; processingPhotos = false; editing = item; requestId = crypto.randomUUID(); saving = false;
    $("marketListingForm").reset(); $("marketFormStatus").textContent = ""; $("listingPhotoStatus").textContent = "";
    $("marketEditorTitle").textContent = item ? "تعديل الإعلان" : "أضف عرضًا أو طلبًا"; $("marketSave").textContent = item ? "حفظ التعديل" : user ? "نشر الإعلان" : "تسجيل الدخول للنشر"; $("marketSave").disabled = false; $("listingPhotos").disabled = false;
    const form = $("marketListingForm");
    if (item) {
      for (const key of ["kind", "title", "category", "model", "partNumber", "description", "country", "city", "price", "currency", "delivery", "contactKind", "contact"]) form.elements[key].value = item[key] ?? "";
      form.elements.condition.value = item.condition === "any" ? "untested" : item.condition;
      form.elements.negotiable.checked = item.negotiable; form.elements.displayName.value = item.ownerName;
    } else {
      form.elements.kind.value = state.kind === "wanted" ? "wanted" : "sale";
      form.elements.displayName.value = user?.name || "";
    }
    photoDraft = item ? item.photos.map(photo => ({ id: photo.id, url: photo.url })) : [];
    renderPhotos(); editorKind(); contactKind();
    if ($("marketDetail").open) $("marketDetail").close();
    if (!$("marketEditor").open) $("marketEditor").showModal();
  }
  async function compressPhoto(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error("اختر صورة JPG أو PNG أو WebP أصغر من 12 ميغابايت.");
    const bitmap = await createImageBitmap(file);
    try {
      let scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height)); let blob;
      for (let attempt = 0; attempt < 6; attempt++) {
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d"); context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", Math.max(.55, .84 - attempt * .05)));
        if (blob && blob.size <= 180 * 1024) break;
        scale *= .8;
      }
      if (!blob || blob.size > 180 * 1024) throw new Error("تعذّر تصغير هذه الصورة. اختر صورة أخرى.");
      const url = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("تعذّر قراءة الصورة.")); reader.readAsDataURL(blob); });
      return { mime: "image/jpeg", data: url.slice(url.indexOf(",") + 1), url };
    } finally { bitmap.close(); }
  }
  async function addPhotos(event) {
    const files = Array.from(event.target.files || []); event.target.value = "";
    if (!files.length || processingPhotos || saving) return;
    if (files.length + photoDraft.length > 3) { $("listingPhotoStatus").textContent = "يمكن إضافة ثلاث صور كحد أقصى. أزل صورة قبل إضافة غيرها."; return; }
    const generation = photoGeneration; processingPhotos = true; $("marketSave").disabled = true; $("listingPhotos").disabled = true; $("listingPhotoStatus").textContent = "جاري تجهيز الصور…";
    try {
      const prepared = [];
      for (const file of files) prepared.push(await compressPhoto(file));
      if (generation !== photoGeneration) return;
      photoDraft.push(...prepared); renderPhotos(); $("listingPhotoStatus").textContent = "الصور جاهزة للحفظ.";
    } catch (error) { if (generation === photoGeneration) $("listingPhotoStatus").textContent = error.message; }
    finally { if (generation === photoGeneration) { processingPhotos = false; $("marketSave").disabled = false; $("listingPhotos").disabled = false; } }
  }
  function saveDraft() {
    try {
      const fields = Object.fromEntries(new FormData($("marketListingForm")));
      fields.negotiable = $("listingNegotiable").checked;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ fields, photos: photoDraft, requestId, savedAt: Date.now() }));
      return true;
    } catch { $("marketFormStatus").textContent = "تعذّر حفظ المسودة في المتصفح. سجّل الدخول قبل تعبئة الإعلان."; return false; }
  }
  async function restoreDraft() {
    await openEditor();
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw || raw.length > 900000) return;
      const draft = JSON.parse(raw);
      if (!draft.fields || !Array.isArray(draft.photos) || draft.photos.length > 3 || Date.now() - draft.savedAt > 86400000) { sessionStorage.removeItem(DRAFT_KEY); return; }
      const form = $("marketListingForm");
      for (const key of ["kind", "title", "category", "model", "partNumber", "condition", "description", "country", "city", "price", "currency", "delivery", "contactKind", "contact", "displayName"]) if (typeof draft.fields[key] === "string") form.elements[key].value = draft.fields[key];
      form.elements.negotiable.checked = draft.fields.negotiable === true;
      if (!form.elements.displayName.value) form.elements.displayName.value = user?.name || "";
      photoDraft = draft.photos.filter(p => p.mime === "image/jpeg" && typeof p.data === "string" && p.data.length <= 245760).map(p => ({ mime: p.mime, data: p.data, url: "data:image/jpeg;base64," + p.data }));
      if (/^[a-f0-9-]{36}$/i.test(draft.requestId)) requestId = draft.requestId;
      renderPhotos(); editorKind(); contactKind();
      $("marketFormStatus").textContent = "استعدنا مسودتك. راجعها ثم انشر الإعلان.";
    } catch { sessionStorage.removeItem(DRAFT_KEY); }
  }
  async function saveListing(event) {
    event.preventDefault(); if (saving || processingPhotos) return;
    await sessionPromise;
    if (!user && !editing && !saveDraft()) return;
    if (!await requireUser(!editing)) return;
    saving = true; $("marketSave").disabled = true; $("marketFormStatus").textContent = "جاري حفظ الإعلان…";
    const form = $("marketListingForm"), payload = Object.fromEntries(new FormData(form));
    payload.negotiable = form.elements.negotiable.checked; payload.requestId = requestId;
    payload.retainedPhotos = photoDraft.filter(photo => photo.id).map(photo => photo.id);
    payload.photos = photoDraft.filter(photo => !photo.id).map(({ mime, data }) => ({ mime, data }));
    if (editing) payload.version = editing.version;
    try {
      const result = await write(editing ? `/api/market/listings/${editing.id}` : "/api/market/listings", payload, editing ? "PATCH" : "POST");
      if (!editing) { sessionStorage.removeItem(DRAFT_KEY); const url = new URL(location.href); url.searchParams.delete("compose"); history.replaceState(null, "", url); }
      $("marketEditor").close(); toast(editing ? "تم حفظ التعديل." : "تم نشر إعلانك في السوق.");
      state.page = 1; saveFilterUrl(); await loadListings(); await openDetail(result.listing.id);
    } catch (error) { $("marketFormStatus").textContent = error.message; }
    finally { saving = false; $("marketSave").disabled = false; }
  }
  function renderDetail(data) {
    const item = data.listing; currentListing = item; detailPage = data.replyPage; detailPages = data.replyPages;
    $("marketDetailTitle").textContent = item.title; $("marketDetailTitle").dir = "auto";
    $("marketDetailKind").textContent = badge(item); $("marketDetailKind").className = "marketBadge" + (item.kind === "wanted" ? " isWanted" : "") + (item.status === "closed" || item.moderated ? " isClosed" : "");
    const meta = [["التصنيف", CATEGORIES[item.category]], ["الحالة", CONDITIONS[item.condition]], ["الموديل", item.model || "غير محدد"], ["رقم البورد أو القطعة", item.partNumber || "غير محدد"], ["المكان", `${item.city}، ${item.country}`], ["التسليم", DELIVERY[item.delivery]], ["صاحب الإعلان", item.ownerName], ["نُشر", when(item.createdAt)]];
    const contactLabel = { whatsapp: "تواصل عبر واتساب", telegram: "تواصل عبر تلغرام", phone: "اتصل بصاحب الإعلان" }[item.contactKind];
    const owner = item.isOwner ? `<div class="marketOwnerActions"><button class="marketOwnerButton" type="button" data-owner-action="edit">تعديل الإعلان</button><button class="marketOwnerButton" type="button" data-owner-action="${item.status === "closed" ? "reopen" : "close"}">${item.status === "closed" ? "إعادة فتح الإعلان" : item.kind === "sale" ? "تم بيع القطعة" : "تم العثور على القطعة"}</button><button class="marketOwnerButton isDanger" type="button" data-owner-action="delete">إزالة من السوق</button></div>` : "";
    $("marketDetailContent").innerHTML = `${item.moderated ? '<p class="marketModerated">أخفت الإدارة هذا الإعلان من السوق. يمكنك مراجعة التفاصيل والتواصل مع إدارة الموقع.</p>' : ""}${item.photos.length ? `<div class="marketGallery">${item.photos.map(photo => `<a href="${esc(photo.url)}" target="_blank" rel="noopener"><img src="${esc(photo.url)}" alt="${esc(item.title)}"></a>`).join("")}</div>` : ""}<p class="marketPrice">${esc(price(item))}${item.negotiable && item.price !== null ? "<small>قابل للتفاوض</small>" : ""}</p><p class="marketDescription" dir="auto">${esc(item.description)}</p><dl class="marketDetailMeta">${meta.map(([key, value]) => `<div><dt>${key}</dt><dd dir="auto">${esc(value)}</dd></div>`).join("")}</dl><div class="marketDetailContact"><a class="btn" href="${esc(item.contactUrl)}"${item.contactKind !== "phone" ? ' target="_blank" rel="noopener noreferrer"' : ""}>${contactLabel}</a><button class="marketSoftButton" type="button" data-share-listing>نسخ رابط الإعلان</button>${!item.isOwner ? '<button class="marketSoftButton" type="button" data-report-listing>إبلاغ</button>' : ""}</div>${owner}`;
    $("marketReplyList").innerHTML = data.replies.length ? data.replies.map(reply => `<article class="marketReply"><div><strong>${esc(reply.name)}${reply.isOwner ? " · أنت" : ""}</strong><time datetime="${esc(reply.createdAt)}">${esc(when(reply.createdAt))}</time></div><p dir="auto">${esc(reply.text)}</p></article>`).join("") : '<p class="marketReplyEmpty">لا توجد ردود بعد. ابدأ بسؤال أو عرض واضح.</p>';
    $("marketReplyPages").hidden = data.replyPages < 2; $("marketReplyPageLabel").textContent = `${data.replyPage} / ${data.replyPages}`; $("marketReplyNewer").disabled = data.replyPage <= 1; $("marketReplyOlder").disabled = data.replyPage >= data.replyPages;
    const canReply = !!user && item.status === "active" && !item.moderated;
    $("marketReplyForm").hidden = !canReply;
    $("marketReplyGate").replaceChildren();
    if (!user) {
      const link = document.createElement("a"); link.href = "/login?next=" + encodeURIComponent("/market/?listing=" + item.id); link.textContent = "سجّل الدخول لإضافة رد أو سؤال."; $("marketReplyGate").append(link);
    } else if (item.status !== "active" || item.moderated) $("marketReplyGate").textContent = "هذا الإعلان مغلق حاليًا ولا يستقبل ردودًا جديدة.";
  }
  async function openDetail(id, addHistory = true, page = 1) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) { toast("رابط الإعلان غير صحيح."); return; }
    detailController?.abort(); const controller = new AbortController(); detailController = controller;
    if (addHistory) { const url = new URL(location.href); url.searchParams.set("listing", id); history.pushState(null, "", url); }
    $("marketDetailTitle").textContent = "جاري تحميل الإعلان…"; $("marketDetailContent").replaceChildren(); $("marketDetailStatus").textContent = ""; $("marketReplyList").replaceChildren(); $("marketReplyForm").hidden = true; $("marketReplyPages").hidden = true;
    if (!$("marketDetail").open) $("marketDetail").showModal();
    try {
      await sessionPromise;
      const data = await api(`/api/market/listings/${encodeURIComponent(id)}?replyPage=${page}`, { signal: controller.signal });
      if (detailController !== controller) return;
      renderDetail(data); replyRequestId = crypto.randomUUID(); $("marketReplyText").value = "";
    } catch (error) { if (error.name !== "AbortError") { $("marketDetailTitle").textContent = "الإعلان غير متاح"; $("marketDetailStatus").textContent = error.message; currentListing = null; } }
  }
  async function ownerAction(action) {
    const item = currentListing; if (!item?.isOwner) return;
    if (action === "edit") return openEditor(item);
    if (action === "delete" && !confirm("إزالة هذا الإعلان من السوق؟ لن يظهر للزوار بعد إزالته.")) return;
    $("marketDetailStatus").textContent = "جاري تحديث الإعلان…";
    try {
      await write(`/api/market/listings/${item.id}/status`, { action, version: item.version });
      if (action === "delete") { $("marketDetail").close(); toast("أُزيل الإعلان من السوق."); } else await openDetail(item.id, false);
      await loadListings();
    } catch (error) { $("marketDetailStatus").textContent = error.message; }
  }
  async function sendReply(event) {
    event.preventDefault(); if (!currentListing || !await requireUser()) return;
    $("marketReplySend").disabled = true; $("marketDetailStatus").textContent = "جاري إرسال الرد…";
    try {
      const id = currentListing.id;
      await write(`/api/market/listings/${id}/replies`, { text: $("marketReplyText").value, requestId: replyRequestId });
      await openDetail(id, false); $("marketDetailStatus").textContent = "تم إرسال الرد."; loadListings();
    } catch (error) { $("marketDetailStatus").textContent = error.message; }
    finally { $("marketReplySend").disabled = false; }
  }
  async function reportOpen() {
    if (!currentListing || !await requireUser()) return;
    $("marketReportForm").reset(); $("marketReportStatus").textContent = ""; $("marketReport").showModal();
  }
  async function sendReport(event) {
    event.preventDefault(); if (!currentListing) return;
    $("marketReportSend").disabled = true; $("marketReportStatus").textContent = "جاري إرسال البلاغ…";
    try { await write(`/api/market/listings/${currentListing.id}/report`, { reason: $("marketReportReason").value, details: $("marketReportDetails").value }); $("marketReport").close(); toast("تم إرسال البلاغ للمراجعة."); }
    catch (error) { $("marketReportStatus").textContent = error.message; }
    finally { $("marketReportSend").disabled = false; }
  }

  document.addEventListener("click", async event => {
    const open = event.target.closest("[data-market-open]");
    if (open && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); openDetail(open.dataset.marketOpen); return; }
    const close = event.target.closest("[data-close]");
    if (close) { if (close.dataset.close !== "marketEditor" || !saving) $(close.dataset.close).close(); return; }
    if (event.target.closest("[data-market-add]")) openEditor();
    const remove = event.target.closest("[data-photo-remove]");
    if (remove && !processingPhotos && !saving) { photoDraft.splice(Number(remove.dataset.photoRemove), 1); renderPhotos(); }
    const owner = event.target.closest("[data-owner-action]"); if (owner) ownerAction(owner.dataset.ownerAction);
    if (event.target.closest("[data-report-listing]")) reportOpen();
    if (event.target.closest("[data-share-listing]") && currentListing) {
      try { await navigator.clipboard.writeText(detailUrl(currentListing.id).href); toast("تم نسخ رابط الإعلان."); } catch { toast("تعذّر النسخ. يمكنك نسخ رابط الصفحة من شريط العنوان."); }
    }
  });
  $("marketAdd").addEventListener("click", () => openEditor());
  $("marketMine").addEventListener("click", async () => { if (!await requireUser()) return; state.mine = !state.mine; state.kind = ""; state.region = ""; filterChange(); });
  document.querySelectorAll("[data-kind]").forEach(button => button.addEventListener("click", () => { state.kind = button.dataset.kind; filterChange(); }));
  $("marketFilters").addEventListener("submit", event => event.preventDefault());
  let searchTimer;
  $("marketQuery").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.q = $("marketQuery").value.trim(); filterChange(); }, 250); });
  $("marketRegion").addEventListener("change", () => { state.region = $("marketRegion").value; filterChange(); });
  $("marketCategory").addEventListener("change", () => { state.category = $("marketCategory").value; filterChange(); });
  $("marketReset").addEventListener("click", () => { clearTimeout(searchTimer); Object.assign(state, { kind: "", region: "", category: "", q: "", page: 1, mine: false }); filterChange(); });
  $("marketPrev").addEventListener("click", () => { if (state.page > 1) { state.page--; saveFilterUrl(); loadListings(); } });
  $("marketNext").addEventListener("click", () => { if (state.page < state.pages) { state.page++; saveFilterUrl(); loadListings(); } });
  $("marketListingForm").addEventListener("change", event => { if (event.target.name === "kind") editorKind(); if (event.target.name === "contactKind") contactKind(); });
  $("listingPhotos").addEventListener("change", addPhotos); $("marketListingForm").addEventListener("submit", saveListing); $("marketReplyForm").addEventListener("submit", sendReply); $("marketReportForm").addEventListener("submit", sendReport);
  $("marketReplyNewer").addEventListener("click", () => { if (currentListing && detailPage > 1) openDetail(currentListing.id, false, detailPage - 1); });
  $("marketReplyOlder").addEventListener("click", () => { if (currentListing && detailPage < detailPages) openDetail(currentListing.id, false, detailPage + 1); });
  $("marketEditor").addEventListener("cancel", event => { if (saving) event.preventDefault(); });
  $("marketDetail").addEventListener("close", () => {
    detailController?.abort(); currentListing = null;
    const url = new URL(location.href); if (url.searchParams.has("listing")) { url.searchParams.delete("listing"); history.replaceState(null, "", url); }
  });
  window.addEventListener("popstate", () => { readFilters(); loadListings(); const id = new URLSearchParams(location.search).get("listing"); if (id) openDetail(id, false); else if ($("marketDetail").open) $("marketDetail").close(); });
  window.addEventListener("pageshow", event => { if (event.persisted) { sessionPromise = readSession(); loadListings(); } });
  readFilters(); sessionPromise = readSession(); loadListings();
  const initial = new URLSearchParams(location.search), requested = initial.get("listing");
  if (initial.get("compose") === "1") restoreDraft(); else if (requested) openDetail(requested, false);
})();
