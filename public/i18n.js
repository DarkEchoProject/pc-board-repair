(()=>{
  const STORAGE_KEY='pcbr-language';
  const supported=new Set(['ar','en']);
  let lang=localStorage.getItem(STORAGE_KEY)||'ar';
  if(!supported.has(lang))lang='ar';

  const en={
    'الرئيسية':'Home',
    'التشخيص':'Diagnostics',
    'غرفة الصيانة':'Repair Room',
    'غرفة الصيانة والطلبات':'Repair Room & Requests',
    'من نحن':'About',
    'اتصل بنا':'Contact',
    'سياسة الخصوصية':'Privacy Policy',
    'شروط الاستخدام':'Terms of Use',
    'إخلاء المسؤولية':'Disclaimer',
    'حقوق النشر':'Copyright',
    'فحص القطع':'Component Testing',
    'فحص القطع بالأفوميتر':'Component Testing',
    'ملفات BIOS':'BIOS Files',
    'تسجيل الدخول':'Sign in',
    'خروج':'Sign out',
    'حسابي':'My account',
    'تحميل':'Download',
    'التفاصيل':'Details',
    'تحميل مباشر':'Direct download',
    '📄 تفاصيل الملف':'📄 File details',
    '⬇️ تحميل مباشر':'⬇️ Direct download',
    'فتح صفحة الملف':'Open file page',
    'السابق':'Previous',
    'التالي':'Next',
    'مسح الفلاتر':'Clear filters',
    'نتائج البحث':'Search results',
    'الشركات':'Brands',
    'كل الشركات':'All brands',
    'كل أنواع الملفات':'All file types',
    'كل الملفات':'All files',
    'لديه رقم بورد':'Has board number',
    'لديه Revision':'Has revision',
    'لديه صورة':'Has image',
    'إجمالي الملفات':'Total files',
    'ملفات لها صور':'Files with images',
    'ملفات الشركة':'Brand files',
    'لديها رقم بورد':'With board number',
    'لديها Revision':'With revision',
    'اختر شركة أو ابدأ البحث':'Choose a brand or start searching',
    'جاري التحميل...':'Loading...',
    'لا توجد نتائج مطابقة.':'No matching results.',
    'لا توجد نتائج مطابقة للفلاتر الحالية.':'No results match the current filters.',
    'تعذر تحميل قاعدة البيانات.':'Could not load the database.',
    'تعذر تحميل ملفات هذه الشركة.':'Could not load this brand’s files.',
    'اختر الملف المطابق للموديل ورقم اللوحة وRevision.':'Choose the file that matches the model, board number and revision.',
    'ترتيب حسب الموديل':'Sort by model',
    'ترتيب حسب رقم البورد':'Sort by board number',
    'ترتيب حسب النوع':'Sort by type',
    'نوع الملف':'File type',
    'توفر البيانات':'Available data',
    'ترتيب النتائج':'Sort results',

    'مرجع صيانة الكمبيوتر واللوحات الأم':'Desktop PC & Motherboard Repair Reference',
    'خرائط BoardView وملفات BIOS ومراجع الصيانة ومناقشات الفنيين مرتبة لتسهيل الوصول إليها.':'BoardView files, BIOS files, repair references and technician discussions organized for quick access.',
    'استعرض خرائط BoardView':'Browse BoardView Files',
    '🔧 دليل التشخيص':'🔧 Diagnostics Guide',
    '💬 غرفة الصيانة والطلبات':'💬 Repair Room & Requests',
    'تحميل FlexBV':'Download FlexBV',
    '🔎 بحث سريع في ملفات BoardView':'🔎 Quick BoardView Search',
    'اكتب الشركة أو الموديل أو رقم البورد وسيظهر لك الملف مباشرة.':'Enter the brand, model or board number to find the file directly.',
    'البحث المتقدم':'Advanced search',
    'ملف BoardView وصيانة':'BoardView & repair files',
    'شركة مصنّعة':'Manufacturers',
    'ملفًا مع صورة لوحة':'Files with board images',
    'أنواع ملفات مختلفة':'Different file types',
    'زيارة مسجلة للموقع':'Recorded site visits',
    '🆕 أحدث الملفات':'🆕 Latest Files',
    'آخر الملفات الموجودة في قاعدة BoardView. يتحدّث هذا القسم تلقائيًا عند إضافة ملفات جديدة.':'The newest files in the BoardView database. This section updates automatically when new files are added.',
    'عرض كل الملفات':'View all files',
    'جاري تحميل أحدث الملفات...':'Loading latest files...',
    '🔥 الأكثر تحميلًا':'🔥 Most Downloaded',
    'ترتيب تلقائي حسب عدد التنزيلات التي تتم من الموقع ابتداءً من تفعيل العداد.':'Automatically ranked by downloads recorded on the site since the counter was enabled.',
    'سيظهر ترتيب الملفات هنا بعد بدء التنزيلات.':'The ranking will appear here after downloads begin.',
    'سيظهر ترتيب الملفات هنا تلقائيًا بعد بدء التنزيلات من الموقع.':'The ranking will appear here automatically after site downloads begin.',
    'الأقسام':'Sections',
    'خرائط BoardView':'BoardView Files',
    'بحث متقدم حسب الشركة والموديل ورقم البورد ونوع الملف.':'Advanced search by brand, model, board number and file type.',
    'ملفات BIOS مرتبة حسب الشركة والموديل.':'BIOS files organized by brand and model.',
    'اطلب مخططًا أو BoardView أو BIOS وناقش أعطال اللوحات مع الزوار والفنيين.':'Request schematics, BoardView or BIOS files and discuss motherboard faults with visitors and technicians.',
    'خطوات قياس عملية لأعطال No Power والشورت والإقلاع ودوائر التغذية.':'Practical measurement steps for No Power, shorts, boot faults and power circuits.',
    '🔬 فحص القطع بالأفوميتر':'🔬 Component Testing with a Multimeter',
    'طريقة فحص الديود والمقاومة والترانزستور وMOSFET والمكثف والملف والفيوز والقراءات المتوقعة.':'How to test diodes, resistors, transistors, MOSFETs, capacitors, coils and fuses, with expected readings.',
    'ما الذي ستجده هنا؟':'What will you find here?',
    'الموقع مخصص لفنيي صيانة الكمبيوتر واللوحات الأم، ويهدف إلى تنظيم ملفات الصيانة التي يصعب الوصول إليها بسرعة. يمكنك البحث في قاعدة BoardView بحسب الشركة أو الموديل أو رقم البورد ثم فتح صفحة مستقلة لكل ملف، أو الدخول إلى دليل التشخيص ودليل فحص القطع وغرفة الصيانة لمتابعة الأعطال والقياسات.':'This site is built for PC and motherboard repair technicians. It organizes repair files that are often difficult to find quickly. Search the BoardView database by brand, model or board number, open a dedicated file page, or use the diagnostics, component testing and repair-room sections.',
    'يتم توسيع المحتوى تدريجيًا وإضافة ملفات ومراجع جديدة مع الحفاظ على سهولة البحث والتنزيل.':'Content is expanded gradually with new files and references while keeping search and downloads simple.',
    'تنبيه:':'Warning:',
    'تأكد دائمًا من تطابق موديل اللوحة وRevision قبل استخدام أي ملف BIOS أو BoardView.':'Always verify the motherboard model and revision before using any BIOS or BoardView file.',
    'ملف صيانة':'Repair file',
    'لا توجد ملفات مطابقة.':'No matching files.',
    'لا توجد ملفات بعد.':'No files yet.',

    '🗺️ خرائط وملفات BoardView':'🗺️ BoardView Maps & Files',
    'ابحث باسم الشركة أو الموديل أو رقم البورد، أو استخدم الفلاتر للوصول إلى الملف المطلوب بسرعة.':'Search by brand, model or board number, or use filters to quickly find the required file.',
    'البحث في ملفات BoardView':'Search BoardView files',
    'تصفية حسب الشركة':'Filter by brand',
    'تصفية حسب نوع الملف':'Filter by file type',
    'تصفية حسب البيانات':'Filter by available data',
    'فلاتر البحث':'Search filters',
    'إحصاءات قاعدة BoardView':'BoardView database statistics',

    'دليل فني عملي':'Practical technical guide',
    '🔧 تشخيص أعطال الكمبيوتر واللوحات الأم':'🔧 PC & Motherboard Diagnostics',
    'ابدأ من العَرَض الظاهر ثم اتبع القياسات بالترتيب. الهدف هو تحديد الدائرة المتوقفة قبل فك القطع أو تغييرها عشوائيًا.':'Start from the visible symptom, then follow the measurements in order. The goal is to identify the failed circuit before removing or replacing parts at random.',
    'متاح الآن':'Available now',
    'الجهاز لا يعمل نهائيًا — No Power':'PC completely dead — No Power',
    'فحص 5VSB، زر التشغيل، PS_ON، مخارج الباور، الشورت وخطوط الاستعداد.':'Check 5VSB, the power button, PS_ON, PSU outputs, shorts and standby rails.',
    'يعمل ولا توجد صورة — No Display / No POST':'Powers on but no image — No Display / No POST',
    'RAM، VDIMM، CPU، Vcore، BIOS، Reset، Clock وكرت الشاشة.':'RAM, VDIMM, CPU, Vcore, BIOS, Reset, Clock and graphics.',
    'يعمل ويفصل أو يعيد التشغيل':'Starts then shuts down or restarts',
    'PSU، PWR_OK، الحرارة، VRM، Vcore، RAM وتسلسل Power Good.':'PSU, PWR_OK, thermals, VRM, Vcore, RAM and the Power Good sequence.',
    'شورت على اللوحة':'Motherboard short circuit',
    'تمييز المقاومة الطبيعية المنخفضة عن الشورت الحقيقي، تحديد الخط، عزل المراحل وفحص MOSFET والمكثفات.':'Distinguish normal low resistance from a true short, identify the rail, isolate stages, and test MOSFETs and capacitors.',
    'POST متوقف أو صفارات':'POST freeze or beep codes',
    'RAM، CPU، BIOS، VGA، POST Card، Reset وClock مع تفسير السلوك بدل الاعتماد على عدد الصفارات وحده.':'RAM, CPU, BIOS, VGA, POST card, Reset and Clock, interpreting behavior instead of relying only on beep count.',
    'VRM وخطوط المعالج والرام':'VRM, CPU & RAM power rails',
    '12V CPU، MOSFET وPower Stage، PWM، الملفات، Vcore، VDIMM ونقاط القياس الأساسية.':'12V CPU, MOSFETs/Power Stages, PWM, inductors, Vcore, VDIMM and key test points.',
    'قاعدة البداية:':'Starting rule:',
    'قبل أي قياس على اللوحة افصل الكهرباء، افحص بصريًا، ثم استخدم مزود طاقة معروف السلامة. لا تعمل على الجانب الابتدائي لمزود الطاقة المتصل بالتيار إذا لم تكن مؤهلًا لذلك.':'Before measuring the board, disconnect power, inspect visually, then use a known-good safe power supply. Do not work on the live primary side of a PSU unless you are qualified.',

    '💬 غرفة الصيانة والطلبات':'💬 Repair Room & Requests',
    'للطلبات والمناقشات المتعلقة بصيانة الكمبيوتر واللوحات الأم. يمكنك طلب مخطط أو BoardView أو BIOS أو مناقشة عطل مع الزوار والفنيين.':'For PC and motherboard repair requests and discussions. Ask for a schematic, BoardView or BIOS file, or discuss a fault with visitors and technicians.',
    'قواعد مختصرة:':'Quick rules:',
    'اكتب موديل الجهاز ورقم البورد بوضوح، لا تنشر بيانات شخصية، وتجنب الرسائل المكررة أو الروابط المزعجة.':'Clearly state the device model and board number, do not post personal data, and avoid duplicate messages or spam links.',
    'كل الأنواع':'All categories',
    'مناقشة عطل':'Fault discussion',
    'طلب مخطط':'Schematic request',
    'عام':'General',
    'الغرفة العامة':'Public room',
    'تحديث تلقائي كل 5 ثوانٍ — يمكنك الرد ونسخ رابط أي رسالة والإبلاغ عنها.':'Auto-refresh every 5 seconds — you can reply, copy a message link, and report messages.',
    '↻ تحديث':'↻ Refresh',
    'جاري تحميل الرسائل...':'Loading messages...',
    'الاسم أو اللقب':'Name or nickname',
    'نوع المشاركة':'Post category',
    'الرسالة':'Message',
    'إرسال الرسالة':'Send message',
    'الحد الأقصى 500 حرف.':'Maximum 500 characters.',
    'إلغاء الرد':'Cancel reply',
    'كل الرسائل':'All messages',
    '↩ رد':'↩ Reply',
    '🔗 رابط':'🔗 Link',
    '⚑ إبلاغ':'⚑ Report',
    '✓ تم الإبلاغ':'✓ Reported',
    'تم نسخ الرابط':'Link copied',
    'تعذر الإبلاغ':'Could not report',
    'لا توجد رسائل مطابقة.':'No matching messages.',
    'تعذر تحميل الرسائل. أعد المحاولة بعد قليل.':'Could not load messages. Please try again shortly.',
    'جاري الإرسال...':'Sending...',
    'تم إرسال الرسالة.':'Message sent.',
    'المشاركة متاحة للمسجلين فقط.':'Posting is available to signed-in users only.',
    'يمكنك قراءة الرسائل بدون حساب.':'You can read messages without an account.',
    'تسجيل الدخول للمشاركة':'Sign in to post',

    'استخدم حساب Google للدخول بسرعة. لا تحتاج إلى إنشاء كلمة مرور جديدة للموقع.':'Use your Google account for quick sign-in. You do not need to create a separate password for this site.',
    'المتابعة باستخدام Google':'Continue with Google',
    'التصفح والبحث متاحان بدون حساب. تسجيل الدخول مطلوب فقط للمشاركة في غرفة الصيانة وتحميل الملفات.':'Browsing and search are available without an account. Sign-in is required only to post in the repair room and download files.',

    '💾 ملفات BIOS':'💾 BIOS Files',
    'اختر الشركة للوصول إلى ملفات BIOS الخاصة بالموديلات. تحقق دائمًا من رقم اللوحة والإصدار قبل البرمجة أو التحديث.':'Choose a brand to access model-specific BIOS files. Always verify the board number and revision before programming or updating.',
    'قريبًا':'Coming soon',
    'استخدام BIOS غير مطابق قد يمنع اللوحة من الإقلاع. تحقق من الموديل ورقم البورد وRevision قبل أي عملية برمجة.':'Using an incompatible BIOS can prevent the board from booting. Verify the model, board number and revision before programming.',

    'دليل قياس سريع':'Quick measurement guide',
    '🔬 كيفية فحص القطع الإلكترونية بالأفوميتر':'🔬 How to Test Electronic Components with a Multimeter',
    'مرجع عملي للقراءات العامة المتوقعة عند فحص القطع الشائعة. القيم قد تختلف حسب نوع القطعة والدائرة، لذلك استعمل هذه القراءات لتحديد الاتجاه وليس كحكم وحيد.':'A practical reference for typical readings when testing common components. Values vary by component and circuit, so use these readings as guidance rather than a single final verdict.',
    'قبل القياس:':'Before measuring:',
    'افصل الكهرباء وفرّغ المكثفات. القياس داخل البورد قد يتأثر بمكونات موصولة على التوازي؛ عند الشك ارفع رجلًا من القطعة أو افصلها ثم أعد القياس.':'Disconnect power and discharge capacitors. In-circuit readings can be affected by parallel components; when in doubt, lift one leg or remove the component and test again.',
    'الديود Diode':'Diode',
    'المقاومة Resistor':'Resistor',
    'ترانزستور BJT — NPN / PNP':'BJT Transistor — NPN / PNP',
    'المكثف Capacitor':'Capacitor',
    'الملف Coil / Inductor':'Coil / Inductor',
    'الفيوز Fuse':'Fuse',
    'Bridge Rectifier / جسر التوحيد':'Bridge Rectifier',
    'الاتجاه':'Direction',
    'القراءة العامة':'Typical reading',
    'الحالة':'Condition',
    'القراءة':'Reading',
    'القياس':'Measurement',
    'السليم غالبًا':'Typical good reading',
    'بين الأرجل':'Between pins',
    'المتوقع عمومًا':'Generally expected',
    'الاختبار':'Test',
    'المتوقع':'Expected',
    'التفسير':'Interpretation',
    'قواعد مهمة أثناء الفحص':'Important testing rules'
  };

  const titles={
    'PC Board Repair | خرائط BoardView وملفات BIOS لصيانة الكمبيوتر':'PC Board Repair | BoardView Maps & BIOS Files',
    'خرائط BoardView للكمبيوتر واللوحات الأم | PC Board Repair':'BoardView Maps for Motherboards | PC Board Repair',
    'تشخيص أعطال اللوحات الأم والكمبيوتر | PC Board Repair':'PC & Motherboard Diagnostics | PC Board Repair',
    'غرفة الصيانة والطلبات | PC Board Repair':'Repair Room & Requests | PC Board Repair',
    'تسجيل الدخول | PC Board Repair':'Sign In | PC Board Repair',
    'ملفات BIOS للوحات الأم | PC Board Repair':'Motherboard BIOS Files | PC Board Repair',
    'كيفية فحص القطع الإلكترونية بالأفوميتر | PC Board Repair':'How to Test Electronic Components with a Multimeter | PC Board Repair'
  };

  const originalText=new WeakMap();
  const originalAttrs=new WeakMap();
  const originalTitle=document.title;
  let observer=null;

  function normalize(v){return String(v??'').replace(/\s+/g,' ').trim();}

  function patternTranslate(s){
    let m;
    if((m=s.match(/^تم العثور على ([\d٠-٩٬,]+) نتيجة$/)))return `Found ${m[1]} results`;
    if((m=s.match(/^([\d٠-٩٬,]+) ملف ضمن ([\d٠-٩٬,]+) شركة$/)))return `${m[1]} files across ${m[2]} brands`;
    if((m=s.match(/^([\d٠-٩٬,]+) ملف$/)))return `${m[1]} files`;
    if((m=s.match(/^([\d٠-٩٬,]+) تحميل$/)))return `${m[1]} downloads`;
    if((m=s.match(/^([\d٠-٩٬,]+) رسالة$/)))return `${m[1]} messages`;
    if((m=s.match(/^يوجد ([\d٠-٩٬,]+) ملفًا ضمن (.+)\. استخدم البحث والفلاتر ثم افتح صفحة الملف للتحقق من التفاصيل قبل التحميل\.$/)))return `There are ${m[1]} files for ${m[2]}. Use search and filters, then open the file page to verify details before downloading.`;
    return '';
  }

  function translated(s){
    const key=normalize(s);
    return en[key]||patternTranslate(key)||'';
  }

  function translateTextNode(node){
    if(!node||node.nodeType!==Node.TEXT_NODE)return;
    const parent=node.parentElement;
    if(!parent||['SCRIPT','STYLE','CODE','PRE','NOSCRIPT'].includes(parent.tagName))return;
    if(!originalText.has(node))originalText.set(node,node.nodeValue);
    const original=originalText.get(node);
    if(lang==='ar'){node.nodeValue=original;return;}
    const key=normalize(original);
    if(!key)return;
    const value=translated(key);
    if(!value)return;
    const lead=(original.match(/^\s*/)||[''])[0];
    const tail=(original.match(/\s*$/)||[''])[0];
    node.nodeValue=lead+value+tail;
  }

  function translateAttrs(el){
    if(!(el instanceof Element))return;
    if(!originalAttrs.has(el))originalAttrs.set(el,{});
    const saved=originalAttrs.get(el);
    for(const attr of ['placeholder','aria-label','title']){
      if(!el.hasAttribute(attr))continue;
      if(!(attr in saved))saved[attr]=el.getAttribute(attr);
      const original=saved[attr];
      if(lang==='ar'){el.setAttribute(attr,original);continue;}
      const value=translated(original);
      if(value)el.setAttribute(attr,value);
    }
  }

  function walk(root){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){translateTextNode(root);return;}
    if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
    if(root.nodeType===Node.ELEMENT_NODE)translateAttrs(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
    let node;
    while((node=walker.nextNode())){
      if(node.nodeType===Node.TEXT_NODE)translateTextNode(node);
      else translateAttrs(node);
    }
  }

  function renderLanguageBox(){
    const header=document.querySelector('header');
    if(!header||header.querySelector('.languageBox'))return;
    const box=document.createElement('div');
    box.className='languageBox';
    const label=document.createElement('span');
    label.className='languageIcon';
    label.textContent='🌐';
    label.setAttribute('aria-hidden','true');
    const select=document.createElement('select');
    select.className='languageSelect';
    select.setAttribute('aria-label','اللغة / Language');
    select.innerHTML='<option value="ar">العربية</option><option value="en">English</option>';
    select.value=lang;
    select.addEventListener('change',()=>setLanguage(select.value));
    box.append(label,select);
    const account=header.querySelector('.accountBox');
    if(account)header.insertBefore(box,account);else header.append(box);
  }

  function apply(){
    const html=document.documentElement;
    html.lang=lang;
    html.dir=lang==='ar'?'rtl':'ltr';
    if(document.body){document.body.dir=html.dir;document.body.style.direction=html.dir;}
    document.title=lang==='en'?(titles[originalTitle]||originalTitle):originalTitle;
    walk(document.body);
    renderLanguageBox();
    const select=document.querySelector('.languageSelect');
    if(select)select.value=lang;
  }

  function setLanguage(next){
    if(!supported.has(next))return;
    lang=next;
    localStorage.setItem(STORAGE_KEY,lang);
    apply();
  }

  function start(){
    apply();
    observer=new MutationObserver(mutations=>{
      if(lang!=='en'){
        renderLanguageBox();
        return;
      }
      for(const mutation of mutations){
        for(const node of mutation.addedNodes)walk(node);
        if(mutation.type==='attributes')translateAttrs(mutation.target);
      }
      renderLanguageBox();
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
    window.PCBRLanguage={get:()=>lang,set:setLanguage};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
