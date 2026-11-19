# دليل السكربتات

## الفحص والنشر
- `SEO-CHECK.ps1`: يبني ويفحص Sitemap و BoardView directory.
- `BUILD-SITEMAP.ps1`: غلاف PowerShell لبناء Sitemap وملخص الصفحة الرئيسية.
- `PREDEPLOY-CHECK.ps1`: فحص الملفات والفهارس وصياغة JavaScript واختبارات Node.
- `DEPLOY-SITE.cmd`: فحوص ثم Wrangler dry-run ثم موافقة DEPLOY الصريحة قبل النشر؛ التنبيه عبر IndexNow بعد النجاح.
- `SUBMIT-INDEXNOW.ps1`: إرسال URLs لمحرك الفهرسة؛ لا يشغّل أثناء المعاينة إلا بقصد صريح.

## الاستيراد والرفع والاسترجاع — أدوات صيانة مشروطة
هذه أدوات تشغيل يدوي محفوظة، لا تشارك في تحميل الموقع أثناء التصفح. لا تُشغّل كجزء من الاختبارات.
- `ADD-BOARD.cmd` / `add-board.ps1`: إضافة BoardView يدويًا.
- `IMPORT-CLEANED-BOARDS.cmd` / `import-cleaned-boards.ps1`: استيراد V2، ثم إعادة تصنيف الشركات. يمكن أن يدفع الاستيراد إلى main.
- `import-cleaned-boards-v3.ps1`: استرجاع استيراد V2 المتوقف؛ ليس اسمًا بديلًا لنفس السكربت.
- `UPLOAD-CLEANED-250MB-FIXED.cmd` يستدعي `PREPARE-CLEANED-RELEASE.ps1` لتحضير دفعة؛ لا يعادل `UPLOAD-CLEANED-250MB.cmd` الذي يستدعي أداة الرفع.
- `AUDIT-CLEANED-BOARDS.*` و`FIX-BOARDVIEW-VERIFICATION.*`: تدقيق/إصلاح بيانات التحقق.
- `RECOVER-BOARDVIEW-UPLOADS.*` و`UPLOAD-FINAL-BOARDVIEW.*`: استرجاع ورفع دفعات.
- `PUBLISH-RELEASE-BOARDS.*` و`PUBLISH-RECOVERY-BOARDS.*` و`PUBLISH-FINAL-BOARDVIEW.*`: تحديث الفهرس؛ أغلفة CMD تستدعي النشر بعده.
- `REBUILD-BOARD-INDEX.ps1` و`RECLASSIFY-BOARD-BRANDS.ps1` وأغلفة RUN: كتابة/إعادة تصنيف بيانات BoardView.
- `DOWNLOAD-OPENBOARDVIEW.cmd`: أداة تنزيل برنامج القراءة.

## BIOS
`DOWNLOAD-BIOS-TELEGRAM.cmd` و`DOWNLOAD-BIOS-TELEGRAM.py` محفوظان دون تعديل. أدوات التنظيف والرفع المحلية وملفات الحالة الموجودة خارج Git ليست جزءًا من هذا التدقيق؛ لا نحذفها ولا نوقفها.

## قرار التنظيف
لم تُحذف أدوات الاسترجاع أو الاستيراد لأن عدم وجود استدعاء آلي لا يثبت عدم الاستخدام اليدوي. لا تُنقل أو تُحذف من جهاز العمل حتى تأكيد المالك. لا تتضمن هذه المراجعة تنفيذ أدوات تكتب بيانات أو تنشر الموقع.
