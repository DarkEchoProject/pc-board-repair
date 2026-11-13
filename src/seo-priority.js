const msi12 = "/boardview/item/1wpm2a0/msi-ms-7860-ms-7860-rev-1-2";
const msi16 = "/boardview/item/mqexo/msi-ms-7860-ms-7860-rev-1-6";
const asrockA04 = "/boardview/item/m2sklj/asrock-h81m-vg4-70-mxgs80-a04-rev-1-00-2-02";
const asrockR3A03 = "/boardview/item/1d4aj55/asrock-asrock-h81m-vg4-r3-r3-01-70-mxb1j0-a03-fz";
const asrockR3A01 = "/boardview/item/1oc1r3f/asrock-asrock-h81m-vg4-r3-r3-01-70-mxb1j0-a01-fz";

export const priorityBoardPages = new Map([
  ["MSI-MS-7860-REV-1.2-BoardView.zip", {
    title: "BoardView MSI MS-7860 — Rev 1.2",
    description: "خرائط BoardView للوحة MSI MS-7860 Rev 1.2 مع مقارنة بالإصدار 1.6 وخطوات مطابقة رقم اللوحة قبل فتح ملف ZIP.",
    sectionTitle: "اقرأ رقم MS-7860 والإصدار 1.2 معًا",
    checks: [
      "طابق MS-7860 وRev 1.2 كما كُتبا على اللوحة. ابحث عن السطر الذي يحمل الإصدار حتى لو كان اسم الجهاز مختلفًا.",
      "صيغة ZIP تخص الأرشيف. افتح محتوياته في قارئ BoardView المناسب وتحقق من موضع الموصل أو المكوّن الذي تبحث عنه.",
      "عند وجود Rev 1.6 على اللوحة، انتقل إلى صفحة ذلك الإصدار قبل استخدام الخريطة لتحديد نقاط القياس.",
    ],
    links: [
      [msi16, "BoardView MSI MS-7860 Rev 1.6"],
      ["/bios/models/hp-prodesk-400-ms-7860", "أرشيف BIOS لـHP ProDesk 400 برقم MS-7860"],
      ["/diagnostics/no-power#s2", "خطوة فحص جهد الاستعداد في جهاز مكتبي"],
    ],
  }],
  ["MSI-MS-7860-REV-1.6-BoardView.zip", {
    title: "BoardView MSI MS-7860 — Rev 1.6",
    description: "ملف ZIP الخاص بلوحة MSI MS-7860 Rev 1.6. تحقق من Revision المطبوع وقارن رابط Rev 1.2 قبل تتبّع نقاط التغذية.",
    sectionTitle: "ابدأ من العلامة Rev 1.6 على اللوحة",
    checks: [
      "رقم MS-7860 مشترك بين هذه الصفحة وصفحة Rev 1.2. صوّر رقم الإصدار قرب معرّف اللوحة قبل اختيار الرابط.",
      "بعد فتح الخريطة، طابق تسمية الموصل وأرقام المكونات حول منطقة العطل مع اللوحة التي أمامك.",
      "إذا كان الهدف ملف BIOS، سجّل موديل الجهاز وأي اختلاف في النسخة الموجودة في اسمي H81 وH87 ثم افتح فهرس BIOS المرتبط.",
    ],
    links: [
      [msi12, "BoardView MSI MS-7860 Rev 1.2"],
      ["/bios/models/hp-prodesk-400-ms-7860", "ملفات BIOS المسجّلة باسم H81 وH87"],
      ["/diagnostics/atx-standby-ps-on-pwr-ok", "تتبّع إشارات بدء تشغيل ATX"],
    ],
  }],
  ["ASROCK-H81M-VG4-REV-1.00-2.02-70-MXGS80-A04-BoardView.zip", {
    title: "BoardView ASRock H81M-VG4 — 70-MXGS80-A04",
    description: "BoardView للوحة ASRock H81M-VG4 ذات الرقم 70-MXGS80-A04. يعرض الفهرس Rev 1.00 و2.02 ويتيح المقارنة مع إصدار R3.",
    sectionTitle: "طابق نهاية A04 عند قراءة رقم القطعة",
    checks: [
      "الرقم المسجّل لهذا الأرشيف هو 70-MXGS80-A04. ابحث عن كامل الرمز المطبوع وسجّل نهايته.",
      "يذكر السجل Rev 1.00 و2.02 للأرشيف نفسه. طابق إصدار لوحتك وراجع الملفات الموجودة داخل ZIP قبل اختيار الخريطة.",
      "تتوفر صفحة منفصلة لعائلة R3 تحمل رقمًا مختلفًا يبدأ بـ70-MXB1J0. استخدم رقم القطعة لتحديد الصفحة الأقرب.",
    ],
    links: [
      [asrockR3A03, "لوحة H81M-VG4 R3 ذات الرقم 70-MXB1J0-A03"],
      ["/bios/models/asrock-h81m-vg4", "ملفات BIOS بحسب المراجعة واسم الجهاز"],
      ["/diagnostics/atx-standby-ps-on-pwr-ok#s1", "فحص 5VSB عند تعطل بدء التشغيل"],
    ],
  }],
  ["ASROCK-H81M-VG4-R3-r3.01-70-MXB1J0-A03-BOARDVIEW-BDV-.FZ.rar", {
    title: "BoardView ASRock H81M-VG4 R3 — 70-MXB1J0-A03",
    description: "ملف BoardView لـASRock H81M-VG4 R3، المراجعة r3.01 ورقم 70-MXB1J0-A03. قارن اللاحقة A03 مع A01 قبل التنزيل.",
    sectionTitle: "ميّز اللاحقة A03 داخل عائلة R3",
    checks: [
      "يظهر في اسم الأرشيف R3 وr3.01 ورقم 70-MXB1J0-A03. يمكن أن يظهر اسم R3 في صفحة أخرى للوحة ذات اللاحقة A01.",
      "إذا قرأت A01 على اللوحة، افتح سجل A01. إذا قرأت 70-MXGS80-A04، انتقل إلى صفحة اللوحة الأخرى في عائلة H81M-VG4.",
      "اسم أرشيف RAR يشير إلى ملف بصيغة FZ. طابق الأجزاء المحيطة بمنطقة العطل بعد فتحه.",
    ],
    links: [
      [asrockR3A01, "BoardView R3 باللاحقة A01"],
      [asrockA04, "BoardView H81M-VG4 بالرقم 70-MXGS80-A04"],
      ["/diagnostics/bios-chip-diagnosis#s1", "تحديد شريحة BIOS ورقمها على اللوحة"],
    ],
  }],
  ["Dell-OptiPlex-780-Arrowhead-BTX.rar", {
    title: "BoardView Dell OptiPlex 780 — Arrowhead BTX",
    description: "ملف BoardView للوحة Dell OptiPlex 780 Arrowhead BTX مع صورة توضّح مكوّنات اللوحة وطريقة التحقق من توزيع الموصلات.",
    sectionTitle: "استخدم صورة Arrowhead BTX للتحقق من التوزيع",
    checks: [
      "الهوية المسجّلة هي Arrowhead BTX. طابق شكل اللوحة وتوزيع موصلات الطاقة والمنافذ مع الصورة المشروحة قبل تتبّع المكوّنات.",
      "سجّل الكتابة المطبوعة على اللوحة عند موصل أو مكوّن قريب من العطل لتحديد مكانه في الخريطة.",
      "يضم فهرس BIOS للموديل سجلًا باسم E93839 وGA0402. طابق هذين الرمزَين عند مراجعة الأرشيف.",
    ],
    links: [
      ["/bios/models/dell-optiplex-780", "أرشيف BIOS المدرج باسم E93839 وGA0402"],
      ["/diagnostics/no-power", "تشخيص Dell OptiPlex عندما لا يبدأ التشغيل"],
    ],
  }],
  ["Dell-Latitude-E5450-ZAM70-LA-A901P-BDV-4805d6961d.rar", {
    title: "BoardView Dell Latitude E5450 — ZAM70 LA-A901P",
    description: "أرشيف BoardView للوحة Dell Latitude E5450 ذات الرمز ZAM70 LA-A901P. اقرأ رمز اللوحة وقارنه بملفات BIOS لـLA-A901P وLA-A961P.",
    sectionTitle: "اقرأ LA-A901P من اللوحة قبل تحديد موضع المكوّن",
    checks: [
      "يذكر اسم الأرشيف ZAM70 وLA-A901P. استخدم رمز LA الكامل لتحديد ملف BoardView قبل الاعتماد على اسم Latitude E5450.",
      "ستجد في فهرس BIOS لهذا الموديل سجلًا يحمل LA-A961P أيضًا. دوّن رمز اللوحة لتحديد الصف الذي تراجعه.",
      "عند عطل الشحن، سجّل أولًا هل يتعرّف الجهاز على المحوّل. بعدها تتبّع مدخل الطاقة باستخدام المواضع التي طابقتها على اللوحة.",
    ],
    links: [
      ["/bios/models/dell-latitude-e5450", "مقارنة أرشيفات LA-A901P وLA-A961P"],
      ["/diagnostics/laptop-not-charging#adapter-info", "قراءة معلومات المحوّل في BIOS"],
    ],
  }],
  ["DELL-OPTIPLEX-7010-Lanikai-MT-DT-BDV-.CAD-ab8eefed21.rar", {
    title: "BoardView Dell OptiPlex 7010 — Lanikai MT/DT",
    description: "أرشيف Dell OptiPlex 7010 BoardView الموسوم Lanikai MT/DT وCAD. طابق معرّف اللوحة وتوزيع الموصلات قبل فتح الملف.",
    sectionTitle: "راجع Lanikai ووسم MT/DT في اسم الملف",
    checks: [
      "يحمل هذا السجل اسم Lanikai MT/DT. ابدأ بمقارنة رقم اللوحة وتوزيع الموصلات، وسجّل شكل الجهاز بجانب اسم OptiPlex 7010.",
      "الأرشيف بصيغة RAR ويذكر اسم الملف CAD. راجع صيغة الملف الداخلي قبل اختيار أداة العرض.",
      "تظهر تسميات 4MB و8MB في أحد أسماء أرشيفات BIOS للموديل. اعتمد على وسم الشريحة وبيانات اللوحة لتحديد الملف الذي تفحصه.",
    ],
    links: [
      ["/bios/models/dell-optiplex-7010", "خيارات BIOS المسجّلة لموديل OptiPlex 7010"],
      ["/diagnostics/bios-chip-diagnosis#s1", "تحديد الشريحة قبل قراءة ملف BIOS"],
    ],
  }],
  ["HP-STREAM-NOTEBOOK-11-DA0Y0HMB6F0-QUANTA-Y0H.rar", {
    title: "ملف صيانة HP Stream 11 — DA0Y0HMB6F0",
    description: "أرشيف صيانة HP Stream Notebook 11 بلوحة Quanta Y0H ورقم DA0Y0HMB6F0، مع رابط سجل BIOS Rev F ومسار تشخيص الشحن.",
    sectionTitle: "استخدم رقم DA0Y0HMB6F0 لتمييز لوحة Stream 11",
    checks: [
      "طابق السطر DA0Y0HMB6F0 على اللوحة. يذكر اسم أرشيف الصيانة أيضًا Quanta Y0H.",
      "نوع السجل في الفهرس أرشيف صيانة بصيغة RAR. راجع محتويات الأرشيف لتحديد ما يمكن فتحه بأداة العرض المتوفرة.",
      "صفحة BIOS المرتبطة تعرض السجل الذي يذكر Rev F. سجّل Revision المطبوع قبل استخدام أي ملف للوحة.",
    ],
    links: [
      ["/bios/models/hp-stream-11-da0y0hmb6f0", "أرشيف BIOS المدرج لرقم DA0Y0HMB6F0"],
      ["/diagnostics/laptop-not-charging", "مسار تشخيص الشحن للابتوب"],
    ],
  }],
]);

export const priorityCompanyPages = new Map([
  ["/boardview/company?brand=MSI", {
    title: "خرائط BoardView MSI حسب رقم اللوحة وRevision",
    description: "ابحث عن BoardView للوحات MSI باستخدام رقم MS المطبوع وإصدار PCB. قارن بين أرشيفي MS-7860 Rev 1.2 وRev 1.6.",
    sectionTitle: "اختيار خريطة MSI من رقم MS والإصدار",
    checks: [
      "ابحث أولًا بالرقم الذي يبدأ بـMS ثم قارن Revision في النتيجة مع الكتابة على اللوحة.",
      "يوضح مثال MS-7860 كيف يظهر رقم اللوحة نفسه في أرشيفين منفصلين. افتح كل صفحة لرؤية الإصدار ورابط الملف.",
    ],
    links: [
      [msi12, "MSI MS-7860 — Rev 1.2"],
      [msi16, "MSI MS-7860 — Rev 1.6"],
    ],
  }],
  ["/boardview/company?brand=ASRock", {
    title: "خرائط BoardView ASRock حسب رقم القطعة وإصدار اللوحة",
    description: "اختر BoardView لـASRock باستخدام رقم القطعة مثل 70-MXGS80-A04 أو 70-MXB1J0-A03. قارن إصدارات H81M-VG4 قبل التحميل.",
    sectionTitle: "استخدم رقم القطعة كاملًا في البحث",
    checks: [
      "انسخ رقم 70-MX من اللوحة مع الأحرف والأرقام التي تأتي في نهايته. هذا يضيّق نتائج الموديلات ذات الاسم التجاري نفسه.",
      "في H81M-VG4 يوجد سجل A04 وسجلان من R3 يختلفان في اللاحقة A03 وA01. افتح الصفحة التي تطابق كتابتك.",
    ],
    links: [
      [asrockA04, "H81M-VG4 — 70-MXGS80-A04"],
      [asrockR3A03, "H81M-VG4 R3 — 70-MXB1J0-A03"],
      [asrockR3A01, "H81M-VG4 R3 — 70-MXB1J0-A01"],
    ],
  }],
  ["/bios/company?brand=Dell", {
    title: "أرشيف BIOS Dell لموديلات OptiPlex وLatitude",
    description: "ابحث في BIOS Dell باسم الموديل ورقم اللوحة. قارن ملفات OptiPlex 780 و7010 وLatitude E5450 حسب الرموز في الفهرس.",
    sectionTitle: "راجع رمز اللوحة في نتائج Dell",
    checks: [
      "ابدأ باسم السلسلة والموديل، ثم اقرأ رمز اللوحة من الجهاز. مثال Latitude E5450 فيه أرشيفات تسجّل LA-A901P وأخرى تسجّل LA-A961P.",
      "لأجهزة OptiPlex، سجّل رقم اللوحة وبيانات الشريحة بجانب رقم الموديل. تعرض صفحات الموديلات التالية الأسماء الفعلية للأرشيفات.",
    ],
    links: [
      ["/bios/models/dell-optiplex-780", "Dell OptiPlex 780 — E93839 / GA0402"],
      ["/bios/models/dell-optiplex-7010", "Dell OptiPlex 7010 — ملفات مسجّلة بالاسم"],
      ["/bios/models/dell-latitude-e5450", "Dell Latitude E5450 — LA-A901P / LA-A961P"],
    ],
  }],
  ["/bios/company?brand=HP", {
    title: "أرشيف BIOS HP حسب موديل الجهاز ورقم اللوحة",
    description: "قارن BIOS لـHP ProDesk 400 MS-7860 بتسميتي H81 وH87، وراجع ملف HP Stream 11 DA0Y0HMB6F0 المسجّل باسم Rev F.",
    sectionTitle: "طابق موديل HP ثم رقم اللوحة",
    checks: [
      "في ProDesk 400 يظهر MS-7860 مع اسمَي H81 وH87 في الأرشيف. سجّل الرمز الموجود في جهازك لاختيار الملف الذي تفحصه.",
      "في Stream 11 اعتمد على رقم DA0Y0HMB6F0 وRevision، لأن اسم سلسلة Stream يظهر على أكثر من موديل.",
    ],
    links: [
      ["/bios/models/hp-prodesk-400-ms-7860", "HP ProDesk 400 — MS-7860"],
      ["/bios/models/hp-stream-11-da0y0hmb6f0", "HP Stream 11 — DA0Y0HMB6F0"],
    ],
  }],
]);
