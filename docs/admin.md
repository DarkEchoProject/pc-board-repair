# لوحة الإدارة

المسار: /admin. تستخدم كلمة المرور ADMIN_TOKEN الحالية. لا يُنشأ مفتاح جديد.

الأقسام الثلاثة عشر متاحة. سجل الحسابات يبدأ عند تسجيل الدخول والتحقق من جلسة Google بعد التفعيل، ويحفظ الاسم ومعرّف الحساب وأوقات الرصد فقط؛ لا يحفظ البريد. تعليق المشاركة يمنع عمليات الكتابة في السوق وإرسال الرسائل في الغرفة ولا يمحو الحساب أو يمنع تصفح الموقع. البلاغات المباشرة تحتاج جلسة صالحة (5 يوميًا لكل حساب)، ويبقى البريد خيارًا لمن لم يستطع الدخول. التنبيه العام نصي ويُدار دون نشر جديد. الإحصائيات من العدادات الموجودة. فهارس BIOS وBoardView للعرض والبحث والتنزيل، أما التعديل فيبقى عبر GitHub. لقطة الإدارة محدودة بـ300 سجل لكل فئة مقسمة إلى صفحات، ولا تشمل الصور وكامل الردود ولا تصلح لاستعادة Cloudflare كاملة.

تخزن الإعدادات والسجلات في الكائن site-admin ضمن CHAT_ROOM الموجود، دون تغيير ربط التخزين أو مسح البيانات. لا تتضمن واجهات الإدارة قيم الأسرار.

اختبار: node.exe --test tests/*.test.mjs (Node.js 24). المعاينة المحلية: استخدم ADMIN_TOKEN تجريبيًا في متغيرات Wrangler المحلية، لا تشارك قيمة السر الإنتاجي. لا تُنشر النسخة حتى نجاح الاختبارات والمراجعة.


## Login protection
Five incorrect nonempty token attempts from the same Cloudflare client IP within ten minutes block further admin API access from that IP for ten minutes (HTTP 429 with Retry-After). ADMIN_TOKEN is unchanged. Only a keyed hash of the IP is stored in the existing SQLite Durable Object; expired records are removed on later failures. Successful access before a block resets the counter. Public browsing and user login are unaffected.


## Statistics
The old site-stats visitCount and downloadCounts KV values remain untouched; summary and BoardView top totals combine those values with new SQLite counts. The day/7/30-day reports use UTC dates and start with the first recorded event, not reconstructed history. Visits are deduplicated per keyed IP for 30 minutes, BoardView requests per IP/file for 10 seconds, and catalog BIOS link clicks per IP/archive for 60 seconds. BIOS clicks are accepted only for a URL verified against generated lookup shards; they do not prove a completed download and do not count direct GitHub downloads or the separate legacy Intel file. The new period API requires the existing admin token. The original direct download URLs, sign-in requirements and source catalogs remain unchanged.
