const app=document.getElementById('app');
const toastBox=document.getElementById('toast');
const webApp=window.Bale&&window.Bale.WebApp?window.Bale.WebApp:null;
const state={mode:location.pathname.startsWith('/admin')?'admin':'borrower',page:'home',config:null,data:null,admin:null,memberChoices:[],session:false,officeId:null,modal:null,selectedInstallment:null,paymentMode:'manual',receipt:null,busy:false,search:'',filter:'all',error:'',toastTimer:null};
const fa=(v)=>new Intl.NumberFormat('fa-IR').format(Number(v||0));
const toman=(v)=>fa(v)+' تومان';
const esc=(s)=>String(s??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name)=>'<i class="ph '+name+'"></i>';
const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));
async function request(url,options={}){
  const opts={credentials:'same-origin',...options,headers:{...(options.headers||{})}};
  if(options.body&&typeof options.body!=='string'){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(options.body);}
  const apiUrl=url.startsWith('/api/')?'/sandoq'+url:url;const r=await fetch(apiUrl,opts);const data=await r.json().catch(()=>({error:'پاسخ سرور قابل خواندن نیست.'}));
  if(!r.ok)throw new Error(data.error||'درخواست ناموفق بود.');
  return data;
}
function showToast(text){
  toastBox.textContent=text;toastBox.className='toast show'+(state.mode==='admin'?' admin-toast':'');
  clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>toastBox.className='toast',2800);
}
function iconBrand(){return '<span class="brand-mark"><i class="ph-fill ph-hand-coins"></i></span>';}
function currentMember(){return state.data&&state.data.member;}
function officeById(id){return (state.data?.offices||[]).find((o)=>o.id===id);}
function loanById(id){return (state.data?.loans||[]).find((l)=>l.id===id);}
function installmentsForLoan(loanId){return (state.data?.installments||[]).filter((i)=>i.loanId===loanId);}
function officeLoans(){return (state.data?.loans||[]).filter((l)=>l.officeId===state.officeId);}
function officeCurrentInstallment(){
  const loans=officeLoans().filter((l)=>l.status==='active');
  const due=loans.flatMap((l)=>installmentsForLoan(l.id).filter((i)=>['due','pending_review','rejected'].includes(i.status)).map((i)=>({...i,loan:l})));
  due.sort((a,b)=>a.dueSort-b.dueSort||a.installmentNo-b.installmentNo);
  return due[0]||null;
}
function paymentForInstallment(id){return (state.data?.payments||[]).find((p)=>p.installmentId===id&&['pending_review','approved','rejected','paid'].includes(p.status));}
function statusChip(status){
  const map={due:['سررسید شده','amber'],pending_review:['در انتظار بررسی','blue'],pending:['در حال پرداخت','blue'],upcoming:['آینده',''],paid:['پرداخت شده','green'],approved:['تایید شده','green'],rejected:['نیازمند اصلاح','red'],failed:['لغو شده',''],active:['فعال','green'],settled:['تسویه شده','green'],archived:['بایگانی','']};
  const x=map[status]||[status,''];return '<span class="chip '+x[1]+'">'+esc(x[0])+'</span>';
}
function titleForPage(page){
  return ({dashboard:'داشبورد صندوق',members:'اعضا و تخصیص دفتر',offices:'دفترها',loans:'وام‌ها و اقساط',payments:'بررسی پرداخت‌ها',transactions:'تراکنش‌های بانکی',settings:'تنظیمات'})[page]||'داشبورد صندوق';
}
async function loadConfig(){
  state.config=await request('/api/config');
  if(webApp){
    try{webApp.ready();webApp.expand();webApp.setHeaderColor&&webApp.setHeaderColor('#F6F8FC');}catch{}
  }
}
async function loadBorrower(){
  state.data=await request('/api/borrower/home');state.session=true;
  if(!state.officeId||!state.data.offices.some((o)=>o.id===state.officeId))state.officeId=state.data.offices[0]?.id||null;
  state.page=state.page||'home';
}
async function loadAdmin(){
  state.admin=await request('/api/admin/overview');state.session=true;
}
async function boot(){
  try{
    await loadConfig();
    if(state.mode==='admin'){
      try{await loadAdmin();}catch{state.session=false;renderAdminLogin();return;}
      if(!['dashboard','members','offices','loans','payments','transactions','settings'].includes(state.page))state.page='dashboard';
      render();return;
    }
    if(webApp&&webApp.initData){
      try{await request('/api/auth/bale',{method:'POST',body:{initData:webApp.initData}});await loadBorrower();render();return;}
      catch(e){state.error=e.message;renderLogin();return;}
    }
    try{await loadBorrower();render();return;}catch{}
    renderLogin();
  }catch(e){state.error=e.message;renderFatal();}
}
function renderFatal(){
  app.innerHTML='<div class="login-wrap"><section class="login-card">'+iconBrand()+'<h1>اتصال برقرار نشد</h1><p class="muted">'+esc(state.error||'سرور در دسترس نیست.')+'</p><button class="btn btn-primary btn-block" data-action="retry">تلاش دوباره</button></section></div>';
}
async function loadDemoMembers(){
  try{const r=await request('/api/demo/members');state.memberChoices=r.members||[];}catch{
    state.memberChoices=[{id:'p1',name:'رضا احمدی'},{id:'p7',name:'حسن جعفری'}];
  }
}
async function renderLogin(){
  if(!state.config)await loadConfig();
  if(state.config.demoMode)await loadDemoMembers();
  if(state.mode==='admin'){renderAdminLogin();return;}
  const demo=state.config.demoMode;
  const options=state.memberChoices.map((m)=>'<option value="'+esc(m.id)+'">'+esc(m.name)+(m.officeCount>1?' · '+fa(m.officeCount)+' دفتر':'')+'</option>').join('');
  app.innerHTML='<main class="login-wrap"><section class="login-card"><div class="brand-line">'+iconBrand()+'<div><div class="brand-title">صندوق قرض‌الحسنه</div><div class="brand-sub">پیگیری اقساط در بله</div></div></div><div><h1>'+(demo?'ورود به حساب نمونه':'ورود به صندوق')+'</h1><p class="muted" style="margin:8px 0 0;line-height:1.8">'+(demo?'برای دیدن جریان عضو، یک حساب نمونه انتخاب کنید.':'این مینی‌اپ فقط از داخل بله و پس از اتصال حساب عضو قابل استفاده است.')+'</p></div>'+
    (demo?'<div class="field"><label for="demo-member">حساب نمونه</label><select id="demo-member">'+options+'</select></div><div class="demo-hint"><b>حالت نمونه</b><br>تغییرات این پیش‌نمایش فقط تا زمان اجرای سرور باقی می‌ماند. برای نمایش چند دفتر، حساب حسن جعفری را انتخاب کنید.</div><button class="btn btn-primary btn-block" data-action="demo-login">ورود به اپ</button>':
      '<div class="notice blue"><i class="ph-fill ph-info"></i><span>شناسه بله شما باید در پنل صندوق به عضویتتان متصل شده باشد. برای اتصال با مدیر صندوق تماس بگیرید.</span></div>')+
    '<div class="login-links"><span class="muted small">'+(demo?'پشتیبانی: ۰۲۱-۸۸۴۴۱۲۰۰':'ورود خودکار با اطلاعات امن بله')+'</span>'+(demo?'<button class="btn btn-plain" data-action="go-admin">پنل مدیریت</button>':'')+'</div>'+
    (state.error?'<div class="login-error">'+esc(state.error)+'</div>':'')+'</section></main>';
}
function renderAdminLogin(){
  app.innerHTML='<main class="login-wrap"><section class="login-card"><div class="brand-line">'+iconBrand()+'<div><div class="brand-title">صندوق قرض‌الحسنه</div><div class="brand-sub">پنل مدیریت</div></div></div><div><h1>ورود مدیر</h1><p class="muted" style="font-size:14px;margin:7px 0 0">مدیریت اعضا، دفترها، اقساط و پرداخت‌ها</p></div><form id="admin-login" class="modal-stack"><div class="field"><label for="admin-user">نام کاربری</label><input class="input ltr" id="admin-user" name="username" autocomplete="username" required value="'+(state.config?.demoMode?'admin':'')+'"></div><div class="field"><label for="admin-pass">رمز عبور</label><input class="input ltr" id="admin-pass" name="password" type="password" autocomplete="current-password" required placeholder="رمز مدیر"></div>'+
    (state.config?.demoMode?'<div class="demo-hint">ورود نمونه: نام کاربری <b>admin</b> و رمز <b>demo1234</b></div>':'')+(state.error?'<div class="login-error">'+esc(state.error)+'</div>':'')+'<button class="btn btn-primary btn-block" type="submit">ورود به پنل</button></form><div class="login-links"><button class="btn btn-plain" data-action="go-borrower">بازگشت به اپ وام‌گیرنده</button><span class="chip">'+(state.config?.demoMode?'نمونه':'سامانه')+'</span></div></section></main>';
}
function render(){
  if(state.mode==='admin')return renderAdmin();
  return renderBorrower();
}
function navItem(page,ico,label){
  return '<button class="nav-item '+(state.page===page?'active':'')+'" data-action="borrower-page" data-page="'+page+'"><i class="ph '+ico+'"></i><span>'+label+'</span></button>';
}
function renderBorrower(){
  const member=currentMember();if(!member){renderLogin();return;}
  const offices=state.data.offices||[],loans=officeLoans(),activeLoans=loans.filter((l)=>l.status==='active');
  const current=officeCurrentInstallment(), office=officeById(state.officeId);
  const allIns=activeLoans.flatMap((l)=>installmentsForLoan(l.id));
  const paid=allIns.filter((i)=>i.status==='paid').length, totalCount=allIns.length;
  const remaining=allIns.filter((i)=>i.status!=='paid').reduce((sum,i)=>sum+i.amountToman,0);
  const pending=current&&paymentForInstallment(current.id);
  let body='';
  if(state.page==='home'){
    body='<div class="greeting"><div><h1>سلام، '+esc(member.name.split(' ')[0])+'</h1><p>شماره عضویت '+fa(member.memberNo)+' · '+esc(member.name)+'</p></div><span class="chip green"><span class="network-dot"></span>متصل</span></div>';
    if(offices.length>1)body+='<div class="office-row">'+offices.map((o)=>'<button class="office-pill '+(state.officeId===o.id?'active':'')+'" data-action="select-office" data-id="'+esc(o.id)+'">دفتر '+fa(o.officeNo)+' · '+esc(o.name)+'</button>').join('')+'</div>';
    else if(office)body+='<div class="eyebrow">دفتر '+fa(office.officeNo)+' · '+esc(office.name)+'</div>';
    const dueSum=allIns.filter((i)=>['due','pending_review','rejected'].includes(i.status)).reduce((a,i)=>a+i.amountToman,0);
    body+='<section class="hero-card"><div class="hero-head"><div><div class="eyebrow">مانده اقساط این دفتر</div><div class="hero-total">'+toman(dueSum)+'</div><div class="hero-unit">'+(current?'قسط بعدی: '+esc(current.dueLabel):'هیچ قسط معوقی برای این دفتر ثبت نشده است.')+'</div></div><span class="chip" style="background:rgba(255,255,255,.18);color:#fff">'+(activeLoans.length?fa(activeLoans.length)+' وام فعال':'بدون وام فعال')+'</span></div><div class="hero-foot"><span>'+(current?(pending&&pending.status==='pending_review'?'اعلام پرداخت شما در انتظار بررسی است.':'قسط و پس‌انداز ماهانه'):'می‌توانید دفتر دیگری را انتخاب کنید.')+'</span>'+(current?'<button class="btn" data-action="open-payment" data-id="'+esc(current.id)+'"><i class="ph ph-wallet"></i>'+(pending&&pending.status==='pending_review'?'مشاهده اعلام پرداخت':'ثبت پرداخت قسط')+'</button>':'')+'</div></section>';
    body+='<section class="surface progress-card"><div class="card-title-row"><h2 class="card-title">پیشرفت بازپرداخت</h2><span class="progress-label">'+fa(paid)+' از '+fa(totalCount)+' قسط</span></div><div class="progress-track"><div class="progress-fill" style="width:'+(totalCount?Math.round(paid/totalCount*100):0)+'%"></div></div><div class="card-title-row"><span class="eyebrow">باقی‌ماندهٔ قراردادهای این دفتر</span><b>'+toman(remaining)+'</b></div></section>';
    if(activeLoans.length){
      body+='<div class="section-heading"><h2>وام‌های این دفتر</h2><button class="btn btn-plain" data-action="borrower-page" data-page="installments">همه اقساط</button></div>';
      body+=activeLoans.map((l)=>{
        const arr=installmentsForLoan(l.id),p=arr.filter((x)=>x.status==='paid').length,next=arr.find((x)=>x.status!=='paid'),o=officeById(l.officeId);
        return '<article class="surface loan-card"><div class="loan-top"><div><div class="loan-name">وام شماره '+fa(l.loanNo)+' · دفتر '+fa(o?.officeNo||'')+'</div><div class="loan-meta">'+esc(o?.name||'')+' · شروع '+esc(l.startLabel)+'</div></div>'+statusChip(l.status)+'</div><div class="loan-info"><div class="info-pair">مبلغ وام<b>'+toman(l.principalToman)+'</b></div><div class="info-pair">قسط ماهانه<b>'+toman(l.installmentToman+l.savingToman)+'</b></div><div class="info-pair">پیشرفت<b>'+fa(p)+' از '+fa(l.months)+' قسط</b></div><div class="info-pair">سررسید بعدی<b>'+(next?esc(next.dueLabel):'تسویه شده')+'</b></div></div></article>';
      }).join('');
    }else body+='<div class="surface empty"><i class="ph ph-bank"></i>برای این دفتر وام فعالی ثبت نشده است.</div>';
    if(office)body+='<section class="surface account-card"><div class="account-head"><span class="account-icon"><i class="ph ph-bank"></i></span><div class="account-lines"><b>حساب مقصد اقساط</b><span>'+esc(office.bankName)+' · به نام '+esc(office.accountHolder)+'</span></div></div><div class="account-data"><span class="eyebrow">شماره حساب</span><b class="account-number">'+esc(office.bankAccount)+'</b></div></section>';
  }else if(state.page==='installments'){
    body='<div class="greeting"><div><h1>برنامه اقساط</h1><p>وضعیت و سررسید وام‌های شما</p></div></div>';
    if(offices.length>1)body+='<div class="office-row">'+offices.map((o)=>'<button class="office-pill '+(state.officeId===o.id?'active':'')+'" data-action="select-office" data-id="'+esc(o.id)+'">دفتر '+fa(o.officeNo)+' · '+esc(o.name)+'</button>').join('')+'</div>';
    body+=activeLoans.map((l)=>{
      const o=officeById(l.officeId),ins=installmentsForLoan(l.id);
      return '<section class="surface" style="overflow:hidden"><div class="panel-title" style="padding:16px 16px 0"><div><h2 class="card-title">وام '+fa(l.loanNo)+' · '+esc(o?.name||'')+'</h2><div class="eyebrow" style="margin-top:4px">'+toman(l.installmentToman+l.savingToman)+' در ماه</div></div><span class="chip blue">'+fa(ins.filter((i)=>i.status==='paid').length)+' / '+fa(l.months)+'</span></div><div class="history-list">'+ins.map((i)=>{
        const payment=paymentForInstallment(i.id),disabled=i.status==='paid'||i.status==='upcoming';
        return '<div class="history-row"><span class="history-icon"><i class="ph '+(i.status==='paid'?'ph-check':'ph-calendar-blank')+'"></i></span><div class="history-main"><b>قسط '+fa(i.installmentNo)+' · '+esc(i.dueLabel)+'</b><span>'+ (payment?.trackingCode?'پیگیری '+esc(payment.trackingCode):payment?.status==='pending_review'?'منتظر بررسی صندوق':i.status==='rejected'?'اعلام قبلی رد شد':'')+'</span></div><div class="history-amount">'+toman(i.amountToman)+'<br>'+statusChip(payment?.status==='rejected'?'rejected':i.status)+'</div>'+(disabled?'':'<button class="icon-btn" data-action="open-payment" data-id="'+esc(i.id)+'" title="ثبت پرداخت"><i class="ph ph-arrow-left"></i></button>')+'</div>';
      }).join('')+'</div></section>';
    }).join('')||'<div class="surface empty"><i class="ph ph-list-bullets"></i>برای این دفتر برنامه قسطی ثبت نشده است.</div>';
  }else if(state.page==='history'){
    const payments=(state.data.payments||[]).filter((p)=>{const l=loanById((state.data.installments.find((i)=>i.id===p.installmentId)||{}).loanId);return l&&l.officeId===state.officeId;});
    body='<div class="greeting"><div><h1>سابقه پرداخت</h1><p>اعلام‌های دستی و پرداخت‌های ثبت‌شده</p></div></div>';
    if(offices.length>1)body+='<div class="office-row">'+offices.map((o)=>'<button class="office-pill '+(state.officeId===o.id?'active':'')+'" data-action="select-office" data-id="'+esc(o.id)+'">دفتر '+fa(o.officeNo)+' · '+esc(o.name)+'</button>').join('')+'</div>';
    body+=payments.length?'<section class="surface history-list">'+payments.map((p)=>{
      const i=state.data.installments.find((x)=>x.id===p.installmentId),l=i&&loanById(i.loanId);
      return '<div class="history-row"><span class="history-icon"><i class="ph '+(p.kind==='native'?'ph-wallet':'ph-receipt')+'"></i></span><div class="history-main"><b>قسط '+fa(i?.installmentNo)+' · وام '+fa(l?.loanNo)+'</b><span>'+esc(p.submittedAt||p.createdAt||'')+(p.trackingCode?' · پیگیری '+esc(p.trackingCode):'')+(p.referenceCode?' · مرجع '+esc(p.referenceCode):'')+'</span>'+(p.rejectionReason?'<span class="red-text">علت رد: '+esc(p.rejectionReason)+'</span>':'')+'</div><div class="history-amount">'+toman(p.amountToman)+'<br>'+statusChip(p.status)+'</div></div>';
    }).join('')+'</section>':'<div class="surface empty"><i class="ph ph-receipt"></i>هنوز پرداختی برای این دفتر ثبت نکرده‌اید.</div>';
  }else{
    body='<div class="greeting"><div><h1>حساب من</h1><p>اطلاعات عضویت و پشتیبانی</p></div></div><section class="surface panel"><div class="detail-grid"><div class="detail-box"><span>نام و نام خانوادگی</span><b>'+esc(member.name)+'</b></div><div class="detail-box"><span>شماره موبایل</span><b class="fa-num">'+esc(member.phone)+'</b></div><div class="detail-box"><span>شماره عضویت</span><b>'+fa(member.memberNo)+'</b></div><div class="detail-box"><span>عضو از</span><b>'+esc(member.joinedLabel)+'</b></div><div class="detail-box"><span>دفترهای تخصیص‌یافته</span><b>'+offices.map((o)=>fa(o.officeNo)+' · '+esc(o.name)).join('<br>')+'</b></div></div></section><div class="notice blue"><i class="ph-fill ph-info"></i><span>شنبه تا چهارشنبه، ساعت ۹ تا ۱۶ پاسخگوی شما هستیم. <a href="tel:02188441200">تماس با صندوق '+esc(state.config.phoneSupport)+'</a></span></div><button class="btn btn-outline btn-block" data-action="logout">خروج از حساب</button>';
  }
  app.innerHTML='<div class="borrower-shell"><header class="app-top">'+iconBrand()+'<div><div class="top-name">صندوق قرض‌الحسنه</div><div class="top-meta">'+esc(member.name)+' · عضو '+fa(member.memberNo)+'</div></div><span class="top-spacer"></span><span class="network-dot" aria-label="متصل"></span></header><main class="app-main">'+body+'</main><nav class="bottom-nav"><div class="nav-inner">'+navItem('home','ph-house','خانه')+navItem('installments','ph-list-bullets','اقساط')+navItem('history','ph-clock-counter-clockwise','سابقه')+navItem('profile','ph-user-circle','حساب من')+'</div></nav></div>'+(state.modal?renderBorrowerModal(): '');
}
function renderBorrowerModal(){
  const inst=(state.data.installments||[]).find((i)=>i.id===state.selectedInstallment),loan=inst&&loanById(inst.loanId),office=loan&&officeById(loan.officeId),p=inst&&paymentForInstallment(inst.id);
  if(!inst||!loan)return '';
  const manual=state.paymentMode==='manual';
  const uploadName=state.receipt?.name||'عکس رسید یا PDF را انتخاب کنید';
  const nativeAvailable=state.config.nativePaymentAvailable&&webApp&&typeof webApp.openInvoice==='function';
  let content='<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="pay-title" data-stop><div class="modal-head"><div><h2 id="pay-title">'+(p?.status==='pending_review'?'اعلام پرداخت قسط '+fa(inst.installmentNo):'پرداخت قسط '+fa(inst.installmentNo))+'</h2><p>وام '+fa(loan.loanNo)+' · دفتر '+fa(office?.officeNo)+' · سررسید '+esc(inst.dueLabel)+'</p></div><button class="icon-btn" data-action="close-modal"><i class="ph ph-x"></i></button></div>';
  if(p?.status==='pending_review'){
    content+='<div class="notice blue"><i class="ph-fill ph-hourglass-medium"></i><span>اعلام پرداخت شما ثبت شده و منتظر بررسی صندوق است. نتیجه در همین صفحه و سابقه پرداخت نمایش داده می‌شود.</span></div><div class="detail-grid" style="margin-top:14px"><div class="detail-box"><span>مبلغ اعلام‌شده</span><b>'+toman(p.amountToman)+'</b></div><div class="detail-box"><span>شماره پیگیری بانک</span><b>'+(p.trackingCode?esc(p.trackingCode):'ثبت نشده')+'</b></div><div class="detail-box"><span>مرجع صندوق</span><b>'+esc(p.referenceCode||'ثبت نشده')+'</b></div><div class="detail-box"><span>رسید</span><b>'+(p.receiptName?esc(p.receiptName):'ثبت نشده')+'</b></div></div>';
  }else{
    content+='<div class="stat-grid"><div class="stat-box"><div class="stat-label">قسط وام</div><div class="stat-value">'+toman(loan.installmentToman)+'</div></div><div class="stat-box"><div class="stat-label">پس‌انداز ماهانه</div><div class="stat-value">'+toman(loan.savingToman)+'</div></div></div><div class="account-card surface" style="margin-top:12px"><div class="account-head"><span class="account-icon"><i class="ph ph-bank"></i></span><div class="account-lines"><b>'+esc(office.bankName)+'</b><span>به نام '+esc(office.accountHolder)+'</span></div></div><div class="account-data"><span class="eyebrow">شماره حساب</span><b class="account-number">'+esc(office.bankAccount)+'</b></div><div class="account-data"><span class="eyebrow">شماره شبا</span><b class="account-number" style="font-size:12px">'+esc(office.iban)+'</b></div></div>';
    content+='<div class="notice" style="margin-top:12px"><i class="ph-fill ph-info"></i><span>برای پرداخت دستی، واریز را از برنامه بانک انجام دهید و رسید یا شماره پیگیری را ثبت کنید. پرداخت دستی پس از بررسی مدیر به قسط شما اضافه می‌شود.</span></div>';
    if(nativeAvailable)content+='<div class="bale-badge" style="margin-top:12px"><i class="ph-fill ph-wallet"></i>پرداخت کیف‌پولی بله فعال است</div>';
    else if(state.config.nativePaymentAvailable)content+='<div class="notice" style="margin-top:12px"><i class="ph-fill ph-warning-circle"></i><span>این نسخهٔ بله قابلیت باز کردن صفحه پرداخت را ارائه نمی‌دهد. پرداخت دستی همچنان در دسترس است.</span></div>';
    content+='<div class="modal-stack" style="margin-top:14px"><div class="field"><label>شماره پیگیری واریز</label><input class="input ltr" id="tracking-code" inputmode="numeric" placeholder="اختیاری، حداقل ۶ رقم" maxlength="40"></div><label class="upload-box"><input id="receipt-file" type="file" accept="image/jpeg,image/png,application/pdf"><i class="ph ph-upload-simple" style="font-size:24px"></i><b>'+esc(uploadName)+'</b><span class="small muted">JPG، PNG یا PDF · حداکثر ۴ مگابایت</span></label>';
    if(state.receipt)content+='<button class="btn btn-plain" data-action="clear-receipt">حذف فایل انتخاب‌شده</button>';
    if(nativeAvailable)content+='<button class="btn btn-secondary btn-block" data-action="native-pay" data-id="'+esc(inst.id)+'" '+(state.busy?'disabled':'')+'><i class="ph ph-wallet"></i>پرداخت مستقیم با کیف‌پول بله</button>';
    content+='<button class="btn btn-primary btn-block" data-action="submit-manual" data-id="'+esc(inst.id)+'" '+(state.busy?'disabled':'')+'><i class="ph ph-paper-plane-tilt"></i>'+(state.busy?'در حال ثبت…':'ثبت رسید / شماره پیگیری')+'</button></div>';
  }
  content+='<div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">بستن</button></div></section></div>';
  return content;
}
function assignmentsFor(mid){return (state.admin?.assignments||[]).filter((a)=>a.memberId===mid).map((a)=>state.admin.offices.find((o)=>o.id===a.officeId)).filter(Boolean);}
function adminMember(id){return (state.admin?.members||[]).find((m)=>m.id===id);}
function adminInst(id){return (state.admin?.installments||[]).find((i)=>i.id===id);}
function adminLoanForInstallment(id){const i=adminInst(id);return i&&(state.admin?.loans||[]).find((l)=>l.id===i.loanId);}
function adminPaymentRows(){return (state.admin?.payments||[]).map((p)=>{
  const inst=adminInst(p.installmentId),loan=adminLoanForInstallment(p.installmentId),member=adminMember(p.memberId);
  return {...p,inst,loan,member,office:loan&&state.admin.offices.find((o)=>o.id===loan.officeId)};
});}
function adminNav(page,ico,label){
  return '<button class="side-link '+(state.page===page?'active':'')+'" data-action="admin-page" data-page="'+page+'"><i class="ph '+ico+'"></i><span>'+label+'</span></button>';
}
function renderAdmin(){
  if(!state.admin){renderAdminLogin();return;}
  const pending=state.admin.payments.filter((p)=>p.kind==='manual'&&p.status==='pending_review').length;
  const menu='<div class="side-label">مدیریت صندوق</div><div class="side-nav">'+adminNav('dashboard','ph-squares-four','داشبورد')+adminNav('members','ph-users-three','اعضا و تخصیص')+adminNav('offices','ph-buildings','دفترها')+adminNav('loans','ph-hand-coins','وام‌ها و اقساط')+adminNav('payments','ph-receipt','بررسی پرداخت‌ها')+adminNav('transactions','ph-arrows-left-right','تراکنش‌های بانکی')+'</div>';
  const side='<aside class="admin-side"><div class="admin-brand">'+iconBrand()+'<div><div class="brand-title">صندوق قرض‌الحسنه</div><div class="brand-sub">پنل مدیریت</div></div></div>'+menu+'<div class="side-bottom">'+adminNav('settings','ph-gear-six','تنظیمات')+(state.config?.demoMode?'<button class="side-link" data-action="go-borrower"><i class="ph ph-device-mobile"></i><span>اپ وام‌گیرنده</span></button>':'')+'<button class="side-link" data-action="logout"><i class="ph ph-sign-out"></i><span>خروج از پنل</span></button></div></aside>';
  app.innerHTML='<div class="admin-shell">'+side+'<div class="admin-main"><header class="admin-top"><span class="admin-top-title">'+esc(titleForPage(state.page))+'</span><span class="chip '+(state.config?.demoMode?'amber':'green')+'">'+(state.config?.demoMode?'حالت نمونه':'سامانه زنده')+'</span><div class="admin-user"><span class="avatar">م‌ک</span><span><b>مدیر صندوق</b><small>دسترسی مدیریت</small></span></div></header><main class="admin-content">'+renderAdminPage()+'</main></div></div>'+(state.modal?renderAdminModal():'');
  const memberFilter=app.querySelector('[data-input="member-filter"]');if(memberFilter)memberFilter.value=state.filter;
  const paymentFilter=app.querySelector('[data-input="payment-filter"]');if(paymentFilter)paymentFilter.value=state.filter;
}
function renderAdminPage(){
  const rows=adminPaymentRows(),pending=rows.filter((p)=>p.kind==='manual'&&p.status==='pending_review');
  if(state.page==='dashboard'){
    const activeLoans=state.admin.loans.filter((l)=>l.status==='active'),principal=activeLoans.reduce((sum,l)=>sum+l.principalToman,0);
    const due=state.admin.installments.filter((i)=>i.status==='due'||i.status==='pending_review').length;
    const members=state.admin.members.filter((m)=>m.status==='active').length;
    return '<div class="page-head"><div><h1>داشبورد صندوق</h1><p>خلاصه وضعیت اعضا، وام‌ها و پرداخت‌های امروز</p></div><button class="btn btn-primary" data-action="admin-page" data-page="payments"><i class="ph ph-magnifying-glass"></i>بررسی پرداخت‌ها '+(pending?'<span class="chip" style="background:rgba(255,255,255,.2);color:#fff">'+fa(pending)+'</span>':'')+'</button></div>'+
      '<div class="kpi-grid"><div class="surface kpi"><div class="kpi-head">اعضای فعال<span class="kpi-icon"><i class="ph ph-users-three"></i></span></div><div class="kpi-value">'+fa(members)+'</div><div class="kpi-sub">در '+fa(state.admin.offices.length)+' دفتر</div></div><div class="surface kpi"><div class="kpi-head">وام‌های فعال<span class="kpi-icon"><i class="ph ph-hand-coins"></i></span></div><div class="kpi-value">'+fa(activeLoans.length)+'</div><div class="kpi-sub">اصل وام: '+toman(principal)+'</div></div><div class="surface kpi"><div class="kpi-head">اقساط سررسیدشده<span class="kpi-icon"><i class="ph ph-calendar-check"></i></span></div><div class="kpi-value">'+fa(due)+'</div><div class="kpi-sub">شامل اعلام‌های در حال بررسی</div></div><div class="surface kpi"><div class="kpi-head">پرداخت‌های منتظر بررسی<span class="kpi-icon"><i class="ph ph-hourglass-medium"></i></span></div><div class="kpi-value">'+fa(pending)+'</div><div class="kpi-sub">رسید و کد پیگیری دستی</div></div></div>'+
      '<div class="admin-grid"><section class="surface panel"><div class="panel-title"><h2>پرداخت‌های نیازمند بررسی</h2><button class="btn btn-plain" data-action="admin-page" data-page="payments">مشاهده همه</button></div>'+
      (pending.length?'<div class="table-wrap"><table><thead><tr><th>عضو</th><th>وام / دفتر</th><th>مبلغ</th><th>کد پیگیری</th><th></th></tr></thead><tbody>'+rows.filter((p)=>p.kind==='manual'&&p.status==='pending_review').slice(0,5).map((p)=>'<tr><td><b>'+esc(p.member?.name||'')+'</b><br><span class="muted small">'+esc(p.submittedAt||'')+'</span></td><td>وام '+fa(p.loan?.loanNo)+'<br><span class="muted small">دفتر '+fa(p.office?.officeNo)+' · قسط '+fa(p.inst?.installmentNo)+'</span></td><td><b>'+toman(p.amountToman)+'</b></td><td>'+(p.trackingCode?'<span class="fa-num">'+esc(p.trackingCode)+'</span>':'—')+'</td><td><button class="btn btn-secondary btn-sm" data-action="open-review" data-id="'+esc(p.id)+'">بررسی</button></td></tr>').join('')+'</tbody></table></div>':'<div class="empty"><i class="ph ph-check-circle"></i>پرداختی برای بررسی باقی نمانده است.</div>')+'</section>'+
      '<section class="surface panel"><div class="panel-title"><h2>دفترهای صندوق</h2><button class="btn btn-plain" data-action="admin-page" data-page="offices">همه دفترها</button></div>'+state.admin.offices.filter((o)=>o.status==='active').map((o)=>'<div class="history-row"><span class="history-icon"><i class="ph ph-buildings"></i></span><div class="history-main"><b>دفتر '+fa(o.officeNo)+' · '+esc(o.name)+'</b><span>'+esc(o.bankName)+' · '+fa(state.admin.assignments.filter((a)=>a.officeId===o.id).length)+' عضو تخصیص‌یافته</span></div><i class="ph ph-caret-left muted"></i></div>').join('')+'</section></div>';
  }
  if(state.page==='members'){
    const q=state.search.toLowerCase();
    const list=state.admin.members.filter((m)=>(m.name+' '+m.phone+' '+m.memberNo).toLowerCase().includes(q));
    return '<div class="page-head"><div><h1>اعضا و تخصیص دفتر</h1><p>هر عضو می‌تواند به بیش از یک دفتر دسترسی داشته باشد.</p></div><div class="row-actions"><span class="chip blue">'+fa(list.length)+' عضو</span><button class="btn btn-primary" data-action="new-member"><i class="ph ph-user-plus"></i>عضو جدید</button></div></div><div class="search-row"><div class="search-box"><i class="ph ph-magnifying-glass"></i><input class="input" data-input="search" value="'+esc(state.search)+'" placeholder="جستجوی نام، موبایل یا شماره عضویت"></div><select class="input select-sm" data-input="member-filter"><option value="all">همه اعضا</option><option value="active">فعال</option><option value="archived">بایگانی</option></select></div><section class="surface panel"><div class="table-wrap"><table><thead><tr><th>عضو</th><th>شماره عضویت</th><th>دفترهای تخصیص‌یافته</th><th>شناسه بله</th><th>وضعیت</th><th></th></tr></thead><tbody>'+list.filter((m)=>state.filter==='all'||m.status===state.filter).map((m)=>{
      const offices=assignmentsFor(m.id);
      return '<tr><td><b>'+esc(m.name)+'</b><br><span class="muted small">'+esc(m.phone)+'</span></td><td>'+fa(m.memberNo)+'</td><td><div class="tag-list">'+(offices.length?offices.map((o)=>'<span class="office-tag">دفتر '+fa(o.officeNo)+' · '+esc(o.name)+'</span>').join(''):'<span class="muted small">تخصیص ندارد</span>')+'</div></td><td>'+(m.baleUserId?'<span class="fa-num">'+esc(m.baleUserId)+'</span>':'<span class="muted small">اتصال نشده</span>')+'</td><td>'+statusChip(m.status)+'</td><td><button class="btn btn-secondary btn-sm" data-action="assign" data-id="'+esc(m.id)+'">تخصیص دفتر</button></td></tr>';
    }).join('')+'</tbody></table></div></section>';
  }
  if(state.page==='offices'){
    return '<div class="page-head"><div><h1>دفترها</h1><p>حساب مقصد و اعضای تخصیص‌یافته به هر دفتر</p></div><button class="btn btn-primary" data-action="new-office"><i class="ph ph-plus"></i>دفتر جدید</button></div><div class="kpi-grid">'+state.admin.offices.map((o)=>'<div class="surface kpi"><div class="kpi-head">دفتر '+fa(o.officeNo)+'<span class="kpi-icon"><i class="ph ph-buildings"></i></span></div><div class="kpi-value" style="font-size:19px">'+esc(o.name)+'</div><div class="kpi-sub">'+fa(state.admin.assignments.filter((a)=>a.officeId===o.id).length)+' عضو · '+esc(o.bankName)+'</div></div>').join('')+'</div><section class="surface panel"><div class="panel-title"><h2>اطلاعات حساب مقصد</h2></div><div class="table-wrap"><table><thead><tr><th>دفتر</th><th>بانک</th><th>شماره حساب</th><th>شماره شبا</th><th>دارنده حساب</th><th>اعضای تخصیص‌یافته</th></tr></thead><tbody>'+state.admin.offices.map((o)=>'<tr><td><b>'+fa(o.officeNo)+' · '+esc(o.name)+'</b></td><td>'+esc(o.bankName)+'</td><td class="fa-num">'+esc(o.bankAccount)+'</td><td class="fa-num">'+esc(o.iban)+'</td><td>'+esc(o.accountHolder)+'</td><td><div class="tag-list">'+state.admin.assignments.filter((a)=>a.officeId===o.id).map((a)=>adminMember(a.memberId)).filter(Boolean).map((m)=>'<span class="office-tag">'+esc(m.name)+'</span>').join('')+'</div></td></tr>').join('')+'</tbody></table></div></section>';
  }
  if(state.page==='loans'){
    return '<div class="page-head"><div><h1>وام‌ها و اقساط</h1><p>مانده قراردادها و برنامه پرداخت اعضا</p></div><div class="row-actions"><span class="chip blue">'+fa(state.admin.loans.length)+' قرارداد</span><button class="btn btn-primary" data-action="new-loan"><i class="ph ph-plus"></i>ثبت وام</button></div></div><section class="surface panel"><div class="table-wrap"><table><thead><tr><th>شماره وام</th><th>عضو</th><th>دفتر</th><th>اصل وام</th><th>قسط ماهانه</th><th>پیشرفت</th><th>مانده قسط‌ها</th><th>وضعیت</th></tr></thead><tbody>'+state.admin.loans.map((l)=>{
      const m=adminMember(l.memberId),o=state.admin.offices.find((x)=>x.id===l.officeId),ins=state.admin.installments.filter((i)=>i.loanId===l.id),paid=ins.filter((i)=>i.status==='paid').length,remaining=ins.filter((i)=>i.status!=='paid').reduce((a,i)=>a+i.amountToman,0);
      return '<tr><td><b>'+fa(l.loanNo)+'</b></td><td>'+esc(m?.name||'')+'</td><td>'+fa(o?.officeNo)+' · '+esc(o?.name||'')+'</td><td>'+toman(l.principalToman)+'</td><td>'+toman(l.installmentToman+l.savingToman)+'</td><td>'+fa(paid)+' / '+fa(l.months)+'</td><td><b>'+toman(remaining)+'</b></td><td>'+statusChip(l.status)+'</td></tr>';
    }).join('')+'</tbody></table></div></section>';
  }
  if(state.page==='payments'){
    const shown=rows.filter((p)=>state.filter==='all'||(state.filter==='manual'&&p.kind==='manual')||(state.filter==='pending'&&p.status==='pending_review')||(state.filter==='approved'&&(p.status==='approved'||p.status==='paid'))||(state.filter==='rejected'&&p.status==='rejected'));
    return '<div class="page-head"><div><h1>بررسی پرداخت‌ها</h1><p>ثبت‌های دستی تا زمان تایید مدیر روی اقساط اعمال نمی‌شوند؛ پرداخت بله پس از بررسی سرور ثبت می‌شود.</p></div><span class="chip amber">'+fa(pending.length)+' منتظر بررسی</span></div><div class="search-row"><div class="search-box"><i class="ph ph-magnifying-glass"></i><input class="input" data-input="search" value="'+esc(state.search)+'" placeholder="نام عضو، کد پیگیری یا شماره وام"></div><select class="input select-sm" data-input="payment-filter"><option value="all">همه پرداخت‌ها</option><option value="pending">منتظر بررسی</option><option value="approved">تایید شده</option><option value="rejected">رد شده</option><option value="manual">پرداخت دستی</option></select></div><section class="surface panel"><div class="table-wrap"><table><thead><tr><th>عضو و زمان</th><th>وام / قسط / دفتر</th><th>مبلغ</th><th>شماره پیگیری</th><th>رسید</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>'+shown.filter((p)=>(p.member?.name+' '+p.trackingCode+' '+p.loan?.loanNo).toLowerCase().includes(state.search.toLowerCase())).map((p)=>{
      const file=p.receiptKey?'<a href="/sandoq/api/admin/receipts/'+encodeURIComponent(p.receiptKey)+'" target="_blank" rel="noopener">مشاهده</a>':(p.receiptName?'<span class="muted small">'+esc(p.receiptName)+'</span>':'—');
      const stat=p.status==='pending_review'?'pending_review':p.status==='paid'?'paid':p.status;
      return '<tr><td><b>'+esc(p.member?.name||'')+'</b><br><span class="muted small">'+esc(p.submittedAt||p.createdAt||'')+'</span></td><td>وام '+fa(p.loan?.loanNo)+' · قسط '+fa(p.inst?.installmentNo)+'<br><span class="muted small">دفتر '+fa(p.office?.officeNo)+'</span></td><td><b>'+toman(p.amountToman)+'</b></td><td>'+(p.trackingCode?'<span class="fa-num">'+esc(p.trackingCode)+'</span>':'—')+'</td><td>'+file+'</td><td>'+statusChip(stat)+'</td><td>'+(p.kind==='manual'&&p.status==='pending_review'?'<div class="row-actions"><button class="btn btn-success btn-sm" data-action="approve" data-id="'+esc(p.id)+'">تایید</button><button class="btn btn-danger btn-sm" data-action="reject" data-id="'+esc(p.id)+'">رد</button></div>':p.kind==='native'?'<span class="bale-badge"><i class="ph ph-wallet"></i>بله</span>':'—')+'</td></tr>';
    }).join('')+'</tbody></table></div></section>';
  }
  if(state.page==='transactions'){
    const linked=(tx)=>tx.matchedPaymentId||rows.find((p)=>p.trackingCode&&p.trackingCode===tx.trackingCode);
    return '<div class="page-head"><div><h1>تراکنش‌های بانکی</h1><p>ردیابی دستی با کد اعلام‌شده توسط عضو و مشاهده تطبیق اولیه</p></div></div><div class="notice blue" style="margin-bottom:14px"><i class="ph-fill ph-info"></i><span>اطلاعات حساب بانکی در نسخه نمونه‌ داده است. اتصال خودکار به بانک و دریافت صورت‌حساب، به API بانک یا ورود فایل صورت‌حساب نیاز دارد.</span></div><section class="surface panel"><div class="table-wrap"><table><thead><tr><th>تاریخ</th><th>دفتر</th><th>شرح</th><th>شماره پیگیری</th><th>مبلغ</th><th>تطبیق با اعلام عضو</th></tr></thead><tbody>'+state.admin.transactions.map((tx)=>{
      const o=state.admin.offices.find((x)=>x.id===tx.officeId),p=linked(tx),pr=typeof p==='string'?rows.find((x)=>x.id===p):p;
      return '<tr><td>'+esc(tx.date||'')+'</td><td>'+fa(o?.officeNo)+' · '+esc(o?.name||'')+'</td><td>'+esc(tx.description||'')+'</td><td class="fa-num">'+esc(tx.trackingCode||'—')+'</td><td><b>'+toman(tx.amountToman)+'</b></td><td>'+(pr?'<span class="chip green">'+esc(pr.member?.name||'اعلام پرداخت')+' · '+statusChip(pr.status)+'</span>':'<span class="chip amber">تطبیق نشده</span>')+'</td></tr>';
    }).join('')+'</tbody></table></div></section>';
  }
  return '<div class="page-head"><div><h1>تنظیمات و اتصال‌ها</h1><p>وضعیت اجرای Mini App و پرداخت‌ها</p></div></div><div class="admin-grid"><section class="surface panel"><div class="panel-title"><h2>اتصال بله</h2></div><div class="detail-grid"><div class="detail-box"><span>اعتبارسنجی Mini App</span><b>'+(state.config.demoMode?'حالت نمونه':'توکن بازو در سرور')+'</b></div><div class="detail-box"><span>پرداخت کیف‌پولی بله</span><b>'+ (state.config.nativePaymentAvailable?'پیکربندی شده':'نیازمند توکن و راز وب‌هوک')+'</b></div><div class="detail-box"><span>بانک</span><b>اتصال صورت‌حساب ندارد</b></div></div><p class="muted small" style="margin-top:14px;line-height:1.9">'+esc(state.config.nativePaymentNote)+' مسیر webhook باید با HTTPS در تنظیمات بازو ثبت شود. جزئیات راه‌اندازی در README پروژه آمده است.</p></section><section class="surface panel"><div class="panel-title"><h2>دسترسی مدیر</h2></div><p class="muted" style="line-height:1.9">برای استفاده زنده رمز مدیر را در متغیرهای محیطی امن قرار دهید. در محیط نمونه، ورود آزمایشی فعال است و داده‌ها پس از توقف سرور پاک می‌شوند.</p><span class="chip '+(state.config.demoMode?'amber':'green')+'">'+(state.config.demoMode?'حالت نمونه':'داده‌های PostgreSQL')+'</span></section></div>';
}
function renderAdminModal(){
  const parts=(state.modal||'').split(':');
  if(parts[0]==='new-member'){
    return '<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true" data-stop><div class="modal-head"><div><h2>ثبت عضو جدید</h2><p>دفترهای انتخاب‌شده بلافاصله به این عضو تخصیص داده می‌شوند.</p></div><button class="icon-btn" data-action="close-modal"><i class="ph ph-x"></i></button></div><div class="modal-stack"><div class="detail-grid"><div class="field"><label for="new-member-name">نام و نام خانوادگی</label><input class="input" id="new-member-name" maxlength="100" required></div><div class="field"><label for="new-member-phone">شماره موبایل</label><input class="input ltr" id="new-member-phone" inputmode="numeric" placeholder="0912…" required></div><div class="field"><label for="new-member-no">شماره عضویت</label><input class="input ltr" id="new-member-no" inputmode="numeric" required></div><div class="field"><label for="new-member-national">کد ملی</label><input class="input ltr" id="new-member-national" inputmode="numeric"></div></div><div class="field"><span class="field-label">دفترهای تخصیص‌یافته</span><div class="check-grid">'+state.admin.offices.filter((o)=>o.status==='active').map((o)=>'<label class="check-option"><input type="checkbox" data-new-member-office="'+esc(o.id)+'"><span>دفتر '+fa(o.officeNo)+' · '+esc(o.name)+'</span></label>').join('')+'</div></div><div class="field"><label for="new-member-bale">شناسه کاربر بله (اختیاری)</label><input class="input ltr" id="new-member-bale" placeholder="user.id از داده معتبر بله"></div></div><div class="modal-actions"><button class="btn btn-primary" data-action="create-member">ثبت عضو</button><button class="btn btn-outline" data-action="close-modal">انصراف</button></div></section></div>';
  }
  if(parts[0]==='new-office'){
    return '<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true" data-stop><div class="modal-head"><div><h2>افزودن دفتر</h2><p>حساب مقصد این دفتر برای پرداخت دستی اعضا نمایش داده می‌شود.</p></div><button class="icon-btn" data-action="close-modal"><i class="ph ph-x"></i></button></div><div class="modal-stack"><div class="detail-grid"><div class="field"><label for="new-office-no">شناسه دفتر</label><input class="input ltr" id="new-office-no" inputmode="numeric" required></div><div class="field"><label for="new-office-name">نام دفتر</label><input class="input" id="new-office-name" required></div><div class="field"><label for="new-office-bank">نام بانک</label><input class="input" id="new-office-bank" required></div><div class="field"><label for="new-office-account">شماره حساب</label><input class="input ltr" id="new-office-account" required></div><div class="field"><label for="new-office-iban">شماره شبا</label><input class="input ltr" id="new-office-iban" placeholder="IR…"></div><div class="field"><label for="new-office-holder">دارنده حساب</label><input class="input" id="new-office-holder"></div></div></div><div class="modal-actions"><button class="btn btn-primary" data-action="create-office">ذخیره دفتر</button><button class="btn btn-outline" data-action="close-modal">انصراف</button></div></section></div>';
  }
  if(parts[0]==='new-loan'){
    const memberOptions=state.admin.members.filter((m)=>m.status==='active').map((m)=>'<option value="'+esc(m.id)+'">'+esc(m.name)+' · عضویت '+fa(m.memberNo)+'</option>').join('');
    const officeOptions=state.admin.offices.filter((o)=>o.status==='active').map((o)=>'<option value="'+esc(o.id)+'">دفتر '+fa(o.officeNo)+' · '+esc(o.name)+'</option>').join('');
    return '<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true" data-stop><div class="modal-head"><div><h2>ثبت قرارداد وام</h2><p>برنامه ماهانه اقساط بر اساس تاریخ شروع ساخته می‌شود.</p></div><button class="icon-btn" data-action="close-modal"><i class="ph ph-x"></i></button></div><div class="modal-stack"><div class="detail-grid"><div class="field"><label for="loan-new-no">شماره وام</label><input class="input ltr" id="loan-new-no" inputmode="numeric" required></div><div class="field"><label for="loan-new-member">عضو</label><select id="loan-new-member">'+memberOptions+'</select></div><div class="field"><label for="loan-new-office">دفتر</label><select id="loan-new-office">'+officeOptions+'</select></div><div class="field"><label for="loan-new-principal">مبلغ اصل وام · تومان</label><input class="input ltr" id="loan-new-principal" type="number" min="1" required></div><div class="field"><label for="loan-new-installment">قسط وام ماهانه · تومان</label><input class="input ltr" id="loan-new-installment" type="number" min="1" required></div><div class="field"><label for="loan-new-saving">پس‌انداز ماهانه · تومان</label><input class="input ltr" id="loan-new-saving" type="number" min="0" value="0"></div><div class="field"><label for="loan-new-months">تعداد اقساط</label><input class="input ltr" id="loan-new-months" type="number" min="1" max="120" value="20" required></div><div class="field"><label for="loan-new-day">روز سررسید</label><input class="input ltr" id="loan-new-day" type="number" min="1" max="31" value="5"></div><div class="field"><label for="loan-new-year">سال شروع شمسی</label><input class="input ltr" id="loan-new-year" type="number" min="1300" max="1499" value="1405"></div><div class="field"><label for="loan-new-month">ماه شروع</label><select id="loan-new-month">'+['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map((m,i)=>'<option value="'+(i+1)+'" '+(i===7?'selected':'')+'>'+m+'</option>').join('')+'</select></div></div><span class="small muted">عضو باید پیش از ثبت وام به دفتر انتخاب‌شده تخصیص داشته باشد.</span></div><div class="modal-actions"><button class="btn btn-primary" data-action="create-loan">ساخت برنامه اقساط</button><button class="btn btn-outline" data-action="close-modal">انصراف</button></div></section></div>';
  }
  if(parts[0]==='assign'){
    const m=adminMember(parts[1]);if(!m)return '';
    const assigned=new Set(assignmentsFor(m.id).map((o)=>o.id));
    return '<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true" data-stop><div class="modal-head"><div><h2>تخصیص دفتر به عضو</h2><p>'+esc(m.name)+' · می‌توانید چند دفتر را هم‌زمان انتخاب کنید.</p></div><button class="icon-btn" data-action="close-modal"><i class="ph ph-x"></i></button></div><div class="modal-stack"><div class="check-grid">'+state.admin.offices.map((o)=>'<label class="check-option"><input type="checkbox" data-office="'+esc(o.id)+'" '+(assigned.has(o.id)?'checked':'')+'><span>دفتر '+fa(o.officeNo)+' · '+esc(o.name)+(o.status==='archived'?' (بایگانی)':'')+'</span></label>').join('')+'</div><div class="field"><label for="member-bale-id">شناسه کاربر بله</label><input class="input ltr" id="member-bale-id" value="'+esc(m.baleUserId||'')+'" placeholder="شناسه user.id در داده معتبر بله"><span class="small muted">این شناسه فقط پس از دریافت و اعتبارسنجی initData از سمت سرور برای اتصال حساب استفاده می‌شود.</span></div></div><div class="modal-actions"><button class="btn btn-primary" data-action="save-assignment" data-id="'+esc(m.id)+'">ذخیره تخصیص</button><button class="btn btn-outline" data-action="close-modal">انصراف</button></div></section></div>';
  }
  if(parts[0]==='review'||parts[0]==='reject'){
    const p=adminPaymentRows().find((x)=>x.id===parts[1]);if(!p)return '';
    const rejecting=parts[0]==='reject';
    return '<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" data-stop><div class="modal-head"><div><h2>'+(rejecting?'رد اعلام پرداخت':'بررسی اعلام پرداخت')+'</h2><p>'+esc(p.member?.name||'')+' · وام '+fa(p.loan?.loanNo)+' · قسط '+fa(p.inst?.installmentNo)+'</p></div><button class="icon-btn" data-action="close-modal"><i class="ph ph-x"></i></button></div><div class="modal-stack"><div class="detail-grid"><div class="detail-box"><span>مبلغ اعلامی</span><b>'+toman(p.amountToman)+'</b></div><div class="detail-box"><span>مبلغ قسط</span><b>'+toman(p.inst?.amountToman)+'</b></div><div class="detail-box"><span>کد پیگیری</span><b class="fa-num">'+(p.trackingCode?esc(p.trackingCode):'ثبت نشده')+'</b></div><div class="detail-box"><span>بانک مقصد</span><b>'+esc(p.office?.bankName||'')+'</b></div><div class="detail-box"><span>ثبت شده در</span><b>'+esc(p.submittedAt||'')+'</b></div><div class="detail-box"><span>رسید</span><b>'+(p.receiptKey?'<a href="/sandoq/api/admin/receipts/'+encodeURIComponent(p.receiptKey)+'" target="_blank" rel="noopener">مشاهده فایل رسید</a>':esc(p.receiptName||'فایلی ثبت نشده'))+'</b></div></div>'+(p.trackingCode?'<div class="notice blue"><i class="ph-fill ph-magnifying-glass"></i><span>کد پیگیری را با گردش حساب '+esc(p.office?.bankName||'')+' و مبلغ واریزی تطبیق دهید. سامانه اتصال مستقیم بانکی ندارد.</span></div>':'')+(rejecting?'<div class="field"><label for="reject-reason">علت رد پرداخت</label><textarea id="reject-reason" placeholder="مثلاً کد پیگیری در گردش حساب پیدا نشد"></textarea></div>':'')+'</div><div class="modal-actions">'+(rejecting?'<button class="btn btn-danger" data-action="confirm-reject" data-id="'+esc(p.id)+'">ثبت رد پرداخت</button>':'<button class="btn btn-success" data-action="approve" data-id="'+esc(p.id)+'">تایید پرداخت</button><button class="btn btn-danger" data-action="reject" data-id="'+esc(p.id)+'">رد</button>')+'<button class="btn btn-outline" data-action="close-modal">بستن</button></div></section></div>';
  }
  return '';
}
async function actionError(fn){
  try{await fn();}catch(e){state.busy=false;showToast(e.message);render();}
}
async function clickAction(action,el){
  const idv=el.dataset.id;
  if(action==='retry'){state.error='';return boot();}
  if(action==='go-admin'){state.mode='admin';state.page='dashboard';state.error='';state.admin=null;try{await loadAdmin();render();}catch{state.session=false;renderAdminLogin();}return;}
  if(action==='go-borrower'){state.mode='borrower';state.page='home';state.admin=null;try{await loadBorrower();render();}catch{state.session=false;renderLogin();}return;}
  if(action==='demo-login'){
    const chosen=document.getElementById('demo-member')?.value||'p1';
    try{await request('/api/auth/demo',{method:'POST',body:{memberId:chosen}});state.mode='borrower';state.page='home';state.error='';state.data=null;state.officeId=null;await loadBorrower();render();}catch(e){state.error=e.message;renderLogin();}return;
  }
  if(action==='admin-page'){state.page=el.dataset.page;state.search='';state.filter='all';render();return;}
  if(action==='borrower-page'){state.page=el.dataset.page;render();return;}
  if(action==='select-office'){state.officeId=idv;state.page='home';render();return;}
  if(action==='logout'){
    await request('/api/auth/logout',{method:'POST',body:{role:state.mode}}).catch(()=>{});state.data=null;state.admin=null;state.session=false;state.error='';state.modal=null;
    if(state.mode==='admin'){state.mode='admin';renderAdminLogin();}else renderLogin();return;
  }
  if(action==='close-modal'){state.modal=null;state.receipt=null;render();return;}
  if(action==='open-payment'){state.selectedInstallment=idv;state.modal='pay';state.paymentMode='manual';state.receipt=null;state.busy=false;render();return;}
  if(action==='clear-receipt'){state.receipt=null;render();return;}
  if(action==='submit-manual'){
    const tracking=document.getElementById('tracking-code')?.value||'';
    state.busy=true;renderBorrower();
    try{
      const submitted=await request('/api/payments/manual',{method:'POST',body:{installmentId:idv,trackingCode:tracking,receipt:state.receipt?{name:state.receipt.name,mime:state.receipt.mime,base64:state.receipt.base64}:null}});
      await loadBorrower();state.modal=null;state.receipt=null;state.busy=false;showToast('اعلام پرداخت ثبت شد · مرجع صندوق '+submitted.referenceCode);render();
    }catch(e){state.busy=false;showToast(e.message);render();}
    return;
  }
  if(action==='native-pay'){
    state.busy=true;renderBorrower();
    try{
      const result=await request('/api/payments/native',{method:'POST',body:{installmentId:idv}});
      if(!webApp||typeof webApp.openInvoice!=='function')throw new Error('این نسخه بله امکان باز کردن صفحه پرداخت را ندارد.');
      webApp.openInvoice(result.invoiceLink,async(res)=>{
        state.busy=false;
        if(res&&res.status==='paid'){
          showToast('بله پرداخت را دریافت کرد؛ سرور صندوق در حال راستی‌آزمایی است.');
          await sleep(1200);await loadBorrower().catch(()=>{});
          state.modal='pay';render();
        }else if(res&&res.status==='pending'){showToast('پرداخت در حال پردازش است؛ وضعیت نهایی از سرور بله بررسی می‌شود.');render();}
        else {
          if(res&&['cancelled','failed'].includes(res.status)){
            try{await request('/api/payments/native/'+encodeURIComponent(result.paymentId)+'/cancel',{method:'POST',body:{}});await loadBorrower();}catch{}
          }
          showToast(res&&res.status==='cancelled'?'پرداخت لغو شد؛ می‌توانید دوباره تلاش کنید.':'پرداخت تکمیل نشد.');render();
        }
      });
    }catch(e){state.busy=false;showToast(e.message);render();}
    return;
  }
  if(action==='new-member'){state.modal='new-member';render();return;}
  if(action==='new-office'){state.modal='new-office';render();return;}
  if(action==='new-loan'){state.modal='new-loan';render();return;}
  if(action==='create-member'){
    const officeIds=[...document.querySelectorAll('[data-new-member-office]:checked')].map((x)=>x.dataset.newMemberOffice);
    const data={name:document.getElementById('new-member-name')?.value||'',phone:document.getElementById('new-member-phone')?.value||'',memberNo:document.getElementById('new-member-no')?.value||'',nationalId:document.getElementById('new-member-national')?.value||'',baleUserId:document.getElementById('new-member-bale')?.value||'',officeIds};
    try{await request('/api/admin/members',{method:'POST',body:data});await loadAdmin();state.modal=null;state.page='members';showToast('عضو و تخصیص دفتر ثبت شد.');render();}catch(e){showToast(e.message);}return;
  }
  if(action==='create-office'){
    const data={officeNo:document.getElementById('new-office-no')?.value||'',name:document.getElementById('new-office-name')?.value||'',bankName:document.getElementById('new-office-bank')?.value||'',bankAccount:document.getElementById('new-office-account')?.value||'',iban:document.getElementById('new-office-iban')?.value||'',accountHolder:document.getElementById('new-office-holder')?.value||''};
    try{await request('/api/admin/offices',{method:'POST',body:data});await loadAdmin();state.modal=null;state.page='offices';showToast('دفتر جدید ثبت شد.');render();}catch(e){showToast(e.message);}return;
  }
  if(action==='create-loan'){
    const data={loanNo:document.getElementById('loan-new-no')?.value||'',memberId:document.getElementById('loan-new-member')?.value||'',officeId:document.getElementById('loan-new-office')?.value||'',principalToman:document.getElementById('loan-new-principal')?.value||'',installmentToman:document.getElementById('loan-new-installment')?.value||'',savingToman:document.getElementById('loan-new-saving')?.value||'0',months:document.getElementById('loan-new-months')?.value||'',dueDay:document.getElementById('loan-new-day')?.value||'5',startYear:document.getElementById('loan-new-year')?.value||'',startMonth:document.getElementById('loan-new-month')?.value||''};
    try{await request('/api/admin/loans',{method:'POST',body:data});await loadAdmin();state.modal=null;state.page='loans';showToast('وام ثبت شد و برنامه اقساط ساخته شد.');render();}catch(e){showToast(e.message);}return;
  }
  if(action==='assign'){state.modal='assign:'+idv;render();return;}
  if(action==='save-assignment'){
    const officeIds=[...document.querySelectorAll('[data-office]:checked')].map((x)=>x.dataset.office);
    const baleUserId=document.getElementById('member-bale-id')?.value||'';
    try{
      await request('/api/admin/members/'+encodeURIComponent(idv)+'/assignments',{method:'PUT',body:{officeIds}});
      await request('/api/admin/members/'+encodeURIComponent(idv),{method:'PATCH',body:{baleUserId}});
      await loadAdmin();state.modal=null;showToast('تخصیص و شناسه بله ذخیره شد.');render();
    }catch(e){showToast(e.message);await loadAdmin().catch(()=>{});render();}
    return;
  }
  if(action==='open-review'){state.modal='review:'+idv;render();return;}
  if(action==='approve'){
    try{await request('/api/admin/payments/'+encodeURIComponent(idv)+'/review',{method:'POST',body:{action:'approve'}});await loadAdmin();state.modal=null;showToast('پرداخت تایید شد و قسط در سابقه اعمال شد.');render();}
    catch(e){showToast(e.message);await loadAdmin().catch(()=>{});render();}
    return;
  }
  if(action==='reject'){state.modal='reject:'+idv;render();return;}
  if(action==='confirm-reject'){
    const reason=document.getElementById('reject-reason')?.value||'';
    try{await request('/api/admin/payments/'+encodeURIComponent(idv)+'/review',{method:'POST',body:{action:'reject',reason}});await loadAdmin();state.modal=null;showToast('رد پرداخت ثبت شد.');render();}
    catch(e){showToast(e.message);render();}
    return;
  }
}
app.addEventListener('click',(event)=>{
  const inside=event.target.closest('[data-stop]');
  if(inside){
    const nested=event.target.closest('[data-action]');
    if(nested&&inside.contains(nested))clickAction(nested.dataset.action,nested);
    event.stopPropagation();
    return;
  }
  const el=event.target.closest('[data-action]');if(!el)return;
  clickAction(el.dataset.action,el);
});
app.addEventListener('input',(event)=>{
  const el=event.target;
  if(el.dataset.input==='search'){state.search=el.value;const pos=el.selectionStart;render();const next=app.querySelector('[data-input="search"]');if(next){next.focus();next.setSelectionRange(pos,pos);}}
});
app.addEventListener('change',async(event)=>{
  const el=event.target;
  if(el.id==='receipt-file'){
    const f=el.files&&el.files[0];if(!f)return;
    if(f.size>4*1024*1024){showToast('حجم فایل باید حداکثر ۴ مگابایت باشد.');return;}
    if(!['image/jpeg','image/png','application/pdf'].includes(f.type)){showToast('فقط JPG، PNG یا PDF پذیرفته می‌شود.');return;}
    const reader=new FileReader();
    reader.onload=()=>{const data=String(reader.result||'');state.receipt={name:f.name,mime:f.type,base64:data.split(',')[1]||''};render();};
    reader.readAsDataURL(f);
  }
  if(el.dataset.input==='member-filter'){state.filter=el.value;render();}
  if(el.dataset.input==='payment-filter'){state.filter=el.value;render();}
});
document.addEventListener('submit',async(event)=>{
  if(event.target.id==='admin-login'){
    event.preventDefault();const fd=new FormData(event.target);state.error='';
    try{await request('/api/auth/admin',{method:'POST',body:{username:fd.get('username'),password:fd.get('password')}});state.mode='admin';state.page='dashboard';await loadAdmin();render();}
    catch(e){state.error=e.message;renderAdminLogin();}
  }
});
if(webApp&&webApp.BackButton&&typeof webApp.BackButton.onClick==='function'){
  try{
    webApp.BackButton.onClick(()=>{
      if(state.modal){state.modal=null;render();}
      else if(state.page!=='home'){state.page='home';render();}
    });
  }catch{}
}
boot();
