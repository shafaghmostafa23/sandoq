import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
try{
  const envText=await fs.readFile(path.join(ROOT,'.env'),'utf8');
  for(const line of envText.split(/\r?\n/)){
    const match=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^(["'])(.*)\1$/,'$2');
  }
}catch{}
const PORT=Number(process.env.PORT||3000);
const DEMO=process.env.DEMO_MODE==='true'||(process.env.DEMO_MODE!=='false'&&!process.env.DATABASE_URL);
const ADMIN_USER=process.env.ADMIN_USERNAME||'admin';
const ADMIN_PASS=process.env.ADMIN_PASSWORD||(DEMO?'demo1234':'');
const BOT_TOKEN=process.env.BALE_BOT_TOKEN||'';
const PROVIDER_TOKEN=process.env.BALE_PROVIDER_TOKEN||'';
const WEBHOOK_SECRET=process.env.BALE_WEBHOOK_SECRET||'';
const sessions=new Map();
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const n=(v)=>Number(v||0), id=()=>crypto.randomUUID();
const eq=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
const fmt=(v)=>new Intl.NumberFormat('fa-IR').format(Number(v||0));
const fmtPlain=(v)=>new Intl.NumberFormat('fa-IR',{useGrouping:false}).format(Number(v||0));
const monthLabel=(year,month,day=1)=>`${fmtPlain(day)} ${months[month-1]} ${fmtPlain(year)}`;
function jalaliNow(){const parts=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{year:'numeric',month:'numeric',day:'numeric',timeZone:'Asia/Tehran'}).formatToParts(new Date());return Object.fromEntries(parts.filter((x)=>['year','month','day'].includes(x.type)).map((x)=>[x.type,Number(x.value)]));}
const jcopy=(x)=>JSON.parse(JSON.stringify(x));
function scheduleFor(l){
  const arr=[],now=jalaliNow(),nowSort=now.year*100+now.month;
  for(let k=1;k<=l.months;k++){
    const m=l.startMonth-1+k-1, y=l.startYear+Math.floor(m/12), mo=(m%12)+1;
    const dueSort=y*100+mo,dueDay=Math.min(l.dueDay||5,mo<=6?31:mo<=11?30:29);
    let status=k<=l.paid?'paid':(dueSort<nowSort||(dueSort===nowSort&&dueDay<=now.day)?'due':'upcoming');
    arr.push({id:l.id+'-i'+k,loanId:l.id,installmentNo:k,dueLabel:monthLabel(y,mo,dueDay),dueSort,amountToman:l.installmentToman+l.savingToman,status,paidAt:status==='paid'?'ثبت‌شده':null});
  }
  return arr;
}
function demoSeed(){
  const members=[
    {id:'p1',name:'رضا احمدی',phone:'09123456789',nationalId:'0012345678',memberNo:'2418',baleUserId:'',status:'active',joinedLabel:'بهمن ۱۴۰۲'},
    {id:'p2',name:'زهرا موسوی',phone:'09351234567',nationalId:'0022458819',memberNo:'2360',baleUserId:'',status:'active',joinedLabel:'خرداد ۱۴۰۳'},
    {id:'p3',name:'علی رضایی',phone:'09198765432',nationalId:'0061239970',memberNo:'2381',baleUserId:'',status:'active',joinedLabel:'مهر ۱۴۰۳'},
    {id:'p4',name:'فاطمه حسینی',phone:'09125554433',nationalId:'0044120087',memberNo:'2190',baleUserId:'',status:'active',joinedLabel:'فروردین ۱۴۰۲'},
    {id:'p5',name:'محمد کاظمی',phone:'09301112233',nationalId:'0088771234',memberNo:'2440',baleUserId:'',status:'active',joinedLabel:'آذر ۱۴۰۳'},
    {id:'p6',name:'سارا نوری',phone:'09106667788',nationalId:'0033901245',memberNo:'2108',baleUserId:'',status:'active',joinedLabel:'دی ۱۴۰۱'},
    {id:'p7',name:'حسن جعفری',phone:'09121002003',nationalId:'0010998876',memberNo:'2052',baleUserId:'',status:'active',joinedLabel:'۱۴۰۰'},
    {id:'p8',name:'مهدی صادقی',phone:'09154443322',nationalId:'0077665544',memberNo:'1884',baleUserId:'',status:'archived',joinedLabel:'۱۳۹۹'},
  ];
  const offices=[
    {id:'o12',officeNo:12,name:'نیک‌اندیشان',bankName:'بانک ملی',bankAccount:'۰۱۰۲۳۴۵۶۷۸۰۰۱',iban:'IR06 0170 0000 0010 2345 6780 01',accountHolder:'صندوق قرض‌الحسنه نیک‌اندیشان',status:'active'},
    {id:'o14',officeNo:14,name:'همدلی',bankName:'بانک ملی',bankAccount:'۰۱۰۲۳۴۵۶۷۸۰۰۱',iban:'IR06 0170 0000 0010 2345 6780 01',accountHolder:'صندوق قرض‌الحسنه نیک‌اندیشان',status:'active'},
    {id:'o7',officeNo:7,name:'امید',bankName:'بانک ملت',bankAccount:'۵۸۲۰۱۱۴۴۷۰',iban:'IR52 0120 0000 0005 8201 1447 00',accountHolder:'صندوق قرض‌الحسنه امید',status:'active'},
    {id:'o9',officeNo:9,name:'بهار',bankName:'بانک ملت',bankAccount:'۵۸۲۰۱۱۴۴۷۰',iban:'IR52 0120 0000 0005 8201 1447 00',accountHolder:'صندوق قرض‌الحسنه امید',status:'active'},
    {id:'o21',officeNo:21,name:'روشنا',bankName:'بانک تجارت',bankAccount:'۴۴۱۰۸۸۲۹۱۶',iban:'IR18 0180 0000 0044 1088 2916 00',accountHolder:'صندوق قرض‌الحسنه روشنا',status:'active'},
    {id:'o3',officeNo:3,name:'قدیم',bankName:'بانک تجارت',bankAccount:'۴۴۱۰۸۸۲۹۱۶',iban:'IR18 0180 0000 0044 1088 2916 00',accountHolder:'صندوق قرض‌الحسنه روشنا',status:'archived'},
  ];
  const assignments=[['p1','o12'],['p2','o7'],['p3','o12'],['p4','o9'],['p5','o21'],['p6','o14'],['p7','o12'],['p7','o14'],['p8','o3']].map(([memberId,officeId])=>({memberId,officeId}));
  const loans=[
    {id:'l1042',loanNo:1042,memberId:'p1',officeId:'o12',principalToman:50000000,installmentToman:2500000,savingToman:500000,months:20,paid:7,status:'active',startYear:1404,startMonth:12,startLabel:'۱ اسفند ۱۴۰۴',dueDay:5},
    {id:'l1037',loanNo:1037,memberId:'p2',officeId:'o7',principalToman:30000000,installmentToman:1500000,savingToman:300000,months:20,paid:2,status:'active',startYear:1405,startMonth:3,startLabel:'۱ خرداد ۱۴۰۵',dueDay:5},
    {id:'l1051',loanNo:1051,memberId:'p3',officeId:'o12',principalToman:40000000,installmentToman:2000000,savingToman:400000,months:20,paid:4,status:'active',startYear:1405,startMonth:3,startLabel:'۱ خرداد ۱۴۰۵',dueDay:5},
    {id:'l1029',loanNo:1029,memberId:'p4',officeId:'o9',principalToman:25000000,installmentToman:1250000,savingToman:250000,months:20,paid:12,status:'active',startYear:1404,startMonth:6,startLabel:'۱ شهریور ۱۴۰۴',dueDay:5},
    {id:'l1060',loanNo:1060,memberId:'p5',officeId:'o21',principalToman:60000000,installmentToman:3000000,savingToman:500000,months:20,paid:1,status:'active',startYear:1405,startMonth:5,startLabel:'۱ مرداد ۱۴۰۵',dueDay:5},
    {id:'l1011',loanNo:1011,memberId:'p6',officeId:'o14',principalToman:20000000,installmentToman:1000000,savingToman:200000,months:20,paid:20,status:'settled',startYear:1403,startMonth:10,startLabel:'۱ دی ۱۴۰۳',dueDay:5},
    {id:'l1081',loanNo:1081,memberId:'p7',officeId:'o12',principalToman:30000000,installmentToman:1500000,savingToman:300000,months:20,paid:8,status:'active',startYear:1404,startMonth:11,startLabel:'۱ بهمن ۱۴۰۴',dueDay:5},
    {id:'l1082',loanNo:1082,memberId:'p7',officeId:'o14',principalToman:20000000,installmentToman:1000000,savingToman:200000,months:20,paid:9,status:'active',startYear:1404,startMonth:10,startLabel:'۱ دی ۱۴۰۴',dueDay:5},
  ];
  const installments=loans.flatMap(scheduleFor);
  const findInst=(loanNo,no)=>{const l=loans.find((x)=>x.loanNo===loanNo);return installments.find((x)=>x.loanId===l.id&&x.installmentNo===no);};
  const manualPayments=[
    {id:'d1',memberId:'p1',installmentId:findInst(1042,8).id,amountToman:3000000,trackingCode:'845219',receiptName:'فیش-مهر.jpg',receiptKey:'',status:'pending_review',submittedAt:'۲ مهر ۱۴۰۵ · ۹:۴۱'},
    {id:'d2',memberId:'p3',installmentId:findInst(1051,5).id,amountToman:2400000,trackingCode:'733104',receiptName:'',receiptKey:'',status:'pending_review',submittedAt:'۲ مهر ۱۴۰۵ · ۸:۱۰'},
    {id:'d3',memberId:'p2',installmentId:findInst(1037,3).id,amountToman:1800000,trackingCode:'690552',receiptName:'IMG_2041.jpg',receiptKey:'',status:'pending_review',submittedAt:'۱ مهر ۱۴۰۵ · ۲۱:۰۵'},
    {id:'d4',memberId:'p4',installmentId:findInst(1029,13).id,amountToman:1500000,trackingCode:'581220',receiptName:'receipt.pdf',receiptKey:'',status:'pending_review',submittedAt:'۱ مهر ۱۴۰۵ · ۱۱:۲۲'},
    {id:'d5',memberId:'p5',installmentId:findInst(1060,2).id,amountToman:3500000,trackingCode:'610327',receiptName:'',receiptKey:'',status:'pending_review',submittedAt:'۳۱ شهریور ۱۴۰۵ · ۱۸:۴۰'},
    {id:'d6',memberId:'p6',installmentId:findInst(1011,20).id,amountToman:1200000,trackingCode:'498801',receiptName:'fish.jpg',receiptKey:'',status:'approved',submittedAt:'۵ شهریور ۱۴۰۵ · ۱۰:۰۲'},
    {id:'d7',memberId:'p1',installmentId:findInst(1042,6).id,amountToman:3000000,trackingCode:'600012',receiptName:'',receiptKey:'',status:'rejected',submittedAt:'۴ شهریور ۱۴۰۵ · ۱۲:۳۰',rejectionReason:'شماره پیگیری در حساب پیدا نشد'},
  ];
  findInst(1011,20).status='paid';
  const transactions=[
    {id:'t1',officeId:'o12',date:'۲ مهر ۱۴۰۵',amountToman:3000000,trackingCode:'845219',description:'واریز قسط',matchedPaymentId:'d1'},
    {id:'t2',officeId:'o12',date:'۲ مهر ۱۴۰۵',amountToman:2400000,trackingCode:'733104',description:'واریز قسط',matchedPaymentId:'d2'},
    {id:'t3',officeId:'o7',date:'۱ مهر ۱۴۰۵',amountToman:1500000,trackingCode:'690552',description:'واریز قسط',matchedPaymentId:'d3'},
    {id:'t4',officeId:'o9',date:'۱ مهر ۱۴۰۵',amountToman:1500000,trackingCode:'581220',description:'واریز قسط',matchedPaymentId:'d4'},
    {id:'t5',officeId:'o12',date:'۲۸ شهریور ۱۴۰۵',amountToman:2500000,trackingCode:'552001',description:'واریز بدون شرح',matchedPaymentId:null},
  ];
  return {members,offices,assignments,loans,installments,manualPayments,nativePayments:[],transactions,audit:[],updates:new Set()};
}
class DemoStore{
  constructor(data){this.d=data;}
  async getMember(x){return this.d.members.find((m)=>m.id===x)||null;}
  async getMemberByBaleId(x){return this.d.members.find((m)=>m.baleUserId&&m.baleUserId===String(x))||null;}
  async hasAssignment(memberId,officeId){return this.d.assignments.some((a)=>a.memberId===memberId&&a.officeId===officeId);}
  async getInstallment(x){return this.d.installments.find((i)=>i.id===x)||null;}
  async getLoan(x){return this.d.loans.find((l)=>l.id===x)||null;}
  async getBundle(memberId){
    const member=await this.getMember(memberId); if(!member)return null;
    const officeIds=this.d.assignments.filter((a)=>a.memberId===memberId).map((a)=>a.officeId);
    const loans=this.d.loans.filter((l)=>l.memberId===memberId&&officeIds.includes(l.officeId));
    const loanIds=loans.map((l)=>l.id),inst=this.d.installments.filter((i)=>loanIds.includes(i.loanId)).sort((a,b)=>a.dueSort-b.dueSort);
    const ids=inst.map((i)=>i.id);
    const payments=[...this.d.manualPayments.filter((p)=>ids.includes(p.installmentId)).map((p)=>({...p,kind:'manual'})),...this.d.nativePayments.filter((p)=>ids.includes(p.installmentId)).map((p)=>({...p,kind:'native'}))];
    return {member,offices:this.d.offices.filter((o)=>officeIds.includes(o.id)),loans,installments:inst,payments};
  }
  async overview(){return {members:this.d.members,offices:this.d.offices,assignments:this.d.assignments,loans:this.d.loans,installments:this.d.installments,payments:[...this.d.manualPayments.map((x)=>({...x,kind:'manual'})),...this.d.nativePayments.map((x)=>({...x,kind:'native'}))],transactions:this.d.transactions,audit:this.d.audit};}
  async openPayment(instId){return this.d.manualPayments.some((p)=>p.installmentId===instId&&p.status==='pending_review')||this.d.nativePayments.some((p)=>p.installmentId===instId&&['created','pending'].includes(p.status));}
  async createManualPayment(p){
    if(this.d.manualPayments.some((x)=>x.installmentId===p.installmentId&&x.status==='pending_review')||this.d.nativePayments.some((x)=>x.installmentId===p.installmentId&&['created','pending'].includes(x.status)))throw Object.assign(new Error('برای این قسط یک پرداخت در انتظار بررسی یا تکمیل ثبت شده است.'),{status:409});
    this.d.manualPayments.unshift(p);const inst=this.d.installments.find((x)=>x.id===p.installmentId);if(inst&&inst.status!=='paid')inst.status='pending_review';return p;
  }
  async createMember(m){const member={status:'active',...m};this.d.members.push(member);return member;}
  async createOffice(o){this.d.offices.push(o);return o;}
  async createLoan(l,installments){this.d.loans.unshift(l);this.d.installments.push(...installments);return l;}
  async createNativePayment(p){
    if(this.d.manualPayments.some((x)=>x.installmentId===p.installmentId&&x.status==='pending_review')||this.d.nativePayments.some((x)=>x.installmentId===p.installmentId&&['created','pending'].includes(x.status)))throw Object.assign(new Error('برای این قسط یک پرداخت در انتظار بررسی یا تکمیل ثبت شده است.'),{status:409});
    this.d.nativePayments.unshift(p);return p;
  }
  async bindPreCheckout(payload,transactionId){
    const p=await this.nativeByPayload(payload);if(!p||!['created','pending'].includes(p.status))return false;
    if(p.transactionId)return p.transactionId===String(transactionId);
    if(this.d.nativePayments.some((x)=>x!==p&&x.transactionId===String(transactionId)))return false;
    p.transactionId=String(transactionId);return true;
  }
  async setInvoiceLink(pid,link){const p=this.d.nativePayments.find((x)=>x.id===pid);if(p){p.invoiceLink=link;p.status='pending';}}
  async markNativeFailed(pid){const p=this.d.nativePayments.find((x)=>x.id===pid);if(p)p.status='failed';}
  async cancelNativePayment(pid,memberId){const p=this.d.nativePayments.find((x)=>x.id===pid&&x.memberId===memberId);if(!p)return {error:'not_found'};if(p.status!=='paid'&&['created','pending'].includes(p.status))p.status='failed';return {ok:true,paid:p.status==='paid'};}
  async nativeByPayload(payload){return this.d.nativePayments.find((p)=>p.payload===payload)||null;}
  async review(pid,body){
    const p=this.d.manualPayments.find((x)=>x.id===pid);if(!p)return {error:'not_found'};
    if(p.status!=='pending_review')return {error:'already_reviewed'};
    if(body.approve&&p.trackingCode&&await this.duplicateTrack(p.trackingCode,pid))return {error:'duplicate_tracking'};
    const inst=await this.getInstallment(p.installmentId);if(!inst||inst.status==='paid')return {error:'already_paid'};
    p.status=body.approve?'approved':'rejected';p.reviewedBy=body.actor;p.reviewedAt=new Date().toISOString();p.rejectionReason=body.approve?'':body.reason;
    if(body.approve){inst.status='paid';inst.paidAt=p.reviewedAt;}else if(inst.status==='pending_review')inst.status='due';
    this.d.audit.unshift({actor:body.actor,action:body.approve?'تایید پرداخت':'رد پرداخت',entityType:'payment',entityId:pid,details:{reason:body.reason||''},createdAt:p.reviewedAt});
    return {payment:p};
  }
  async assignments(memberId,ids){
    if(!await this.getMember(memberId))return {error:'not_found'};
    if(ids.some((x)=>!this.d.offices.some((o)=>o.id===x)))return {error:'invalid_office'};
    this.d.assignments=this.d.assignments.filter((x)=>x.memberId!==memberId);
    for(const officeId of [...new Set(ids)])this.d.assignments.push({memberId,officeId});
    this.d.audit.unshift({actor:'مدیر صندوق',action:'ویرایش تخصیص دفتر',entityType:'member',entityId:memberId,details:{officeIds:ids},createdAt:new Date().toISOString()});
    return {ok:true};
  }
  async updateMember(memberId,baleId){
    const m=await this.getMember(memberId);if(!m)return {error:'not_found'};
    const v=String(baleId||'').trim();
    if(v&&this.d.members.some((x)=>x.id!==memberId&&x.baleUserId===v))return {error:'bale_id_in_use'};
    m.baleUserId=v;return {member:m};
  }
  async duplicateTrack(code,id){return Boolean(code&&this.d.manualPayments.some((p)=>p.id!==id&&p.trackingCode===code&&p.status==='approved'));}
  async recordUpdate(x){if(this.d.updates.has(String(x)))return false;this.d.updates.add(String(x));return true;}
  async claimReceipt(payload){const p=await this.nativeByPayload(payload);if(!p||p.notificationClaimedAt)return false;p.notificationClaimedAt=new Date().toISOString();return true;}
  async finalize(info){
    const p=await this.nativeByPayload(info.payload);if(!p)return {error:'not_found'};if(p.status==='paid')return {duplicate:true};
    const inst=await this.getInstallment(p.installmentId);
    if(String(p.baleUserId)!==String(info.baleUserId)||p.amountToman*10!==info.amountRial||String(p.transactionId||'')!==String(info.transactionId)||!inst||inst.status==='paid')return {error:'mismatch'};
    p.status='paid';p.providerChargeId=info.providerChargeId;p.trackingCode=info.providerChargeId;p.paidAt=new Date().toISOString();inst.status='paid';inst.paidAt=p.paidAt;
    return {payment:p};
  }
}
const memberMap=(r)=>r&&({id:r.id,name:r.name,phone:r.phone,nationalId:r.national_id,memberNo:r.member_no,baleUserId:r.bale_user_id||'',status:r.status,joinedLabel:r.joined_label});
const officeMap=(r)=>({id:r.id,officeNo:n(r.office_no),name:r.name,bankName:r.bank_name,bankAccount:r.bank_account,iban:r.iban,accountHolder:r.account_holder,status:r.status});
const loanMap=(r)=>({id:r.id,loanNo:n(r.loan_no),memberId:r.member_id,officeId:r.office_id,principalToman:n(r.principal_toman),installmentToman:n(r.installment_toman),savingToman:n(r.monthly_saving_toman),months:n(r.installment_count),dueDay:n(r.due_day),startLabel:r.start_label,status:r.status});
const instMap=(r)=>({id:r.id,loanId:r.loan_id,installmentNo:n(r.installment_no),dueLabel:r.due_label,dueSort:n(r.due_sort),amountToman:n(r.amount_toman),status:r.status,paidAt:r.paid_at});
const paymentMap=(r,kind)=>({id:r.id,memberId:r.member_id,installmentId:r.installment_id,amountToman:n(r.amount_toman),trackingCode:r.provider_charge_id||r.tracking_code||'',referenceCode:r.reference_code||'',receiptName:r.receipt_name||'',receiptKey:r.receipt_key||'',status:r.status,submittedAt:r.submitted_at,reviewedBy:r.reviewed_by||null,rejectionReason:r.rejection_reason||'',kind,providerChargeId:r.provider_charge_id||null});
class PgStore{
  constructor(pool){this.pool=pool;}
  async initialize(){await this.pool.query(await fs.readFile(path.join(ROOT,'db','schema.sql'),'utf8'));}
  async getMember(id){const r=await this.pool.query('SELECT * FROM members WHERE id=$1',[id]);return memberMap(r.rows[0]);}
  async getMemberByBaleId(id){const r=await this.pool.query('SELECT * FROM members WHERE bale_user_id=$1',[String(id)]);return memberMap(r.rows[0]);}
  async hasAssignment(memberId,officeId){const r=await this.pool.query('SELECT EXISTS(SELECT 1 FROM member_offices WHERE member_id=$1 AND office_id=$2) AS assigned',[memberId,officeId]);return r.rows[0].assigned;}
  async getInstallment(id){const r=await this.pool.query('SELECT * FROM installments WHERE id=$1',[id]);return instMap(r.rows[0]);}
  async getLoan(id){const r=await this.pool.query('SELECT * FROM loans WHERE id=$1',[id]);return loanMap(r.rows[0]);}
  async getBundle(mid){
    const mr=await this.pool.query('SELECT * FROM members WHERE id=$1',[mid]);if(!mr.rowCount)return null;
    const [or,lr]=await Promise.all([
      this.pool.query('SELECT o.* FROM offices o JOIN member_offices mo ON mo.office_id=o.id WHERE mo.member_id=$1 ORDER BY o.office_no',[mid]),
      this.pool.query('SELECT l.* FROM loans l WHERE l.member_id=$1 AND EXISTS(SELECT 1 FROM member_offices mo WHERE mo.member_id=l.member_id AND mo.office_id=l.office_id) ORDER BY l.loan_no DESC',[mid]),
    ]);
    const ids=lr.rows.map((x)=>x.id);
    const [ir,pr,nr]=ids.length?await Promise.all([
      this.pool.query('SELECT * FROM installments WHERE loan_id=ANY($1::uuid[]) ORDER BY due_sort,installment_no',[ids]),
      this.pool.query('SELECT p.* FROM manual_payments p JOIN installments i ON i.id=p.installment_id WHERE p.member_id=$1 AND i.loan_id=ANY($2::uuid[]) ORDER BY p.submitted_at DESC',[mid,ids]),
      this.pool.query('SELECT p.* FROM native_payments p WHERE p.member_id=$1 AND p.installment_id IN (SELECT i.id FROM installments i WHERE i.loan_id=ANY($2::uuid[])) ORDER BY p.created_at DESC',[mid,ids]),
    ]):[{rows:[]},{rows:[]},{rows:[]}];
    return {member:memberMap(mr.rows[0]),offices:or.rows.map(officeMap),loans:lr.rows.map(loanMap),installments:ir.rows.map(instMap),payments:[...pr.rows.map((x)=>paymentMap(x,'manual')),...nr.rows.map((x)=>paymentMap(x,'native'))]};
  }
  async overview(){
    const [mr,or,ar,lr,ir,pr,nr,tr,au]=await Promise.all([
      this.pool.query('SELECT * FROM members ORDER BY member_no'),this.pool.query('SELECT * FROM offices ORDER BY office_no'),
      this.pool.query('SELECT member_id,office_id FROM member_offices'),this.pool.query('SELECT * FROM loans ORDER BY loan_no DESC'),
      this.pool.query('SELECT * FROM installments ORDER BY due_sort,installment_no'),this.pool.query('SELECT * FROM manual_payments ORDER BY submitted_at DESC'),
      this.pool.query('SELECT * FROM native_payments ORDER BY created_at DESC'),this.pool.query('SELECT * FROM bank_transactions ORDER BY created_at DESC'),
      this.pool.query('SELECT actor,action,entity_type,entity_id,details,created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 100'),
    ]);
    return {members:mr.rows.map(memberMap),offices:or.rows.map(officeMap),assignments:ar.rows.map((x)=>({memberId:x.member_id,officeId:x.office_id})),loans:lr.rows.map(loanMap),installments:ir.rows.map(instMap),payments:[...pr.rows.map((x)=>paymentMap(x,'manual')),...nr.rows.map((x)=>paymentMap(x,'native'))],transactions:tr.rows.map((x)=>({id:x.id,officeId:x.office_id,date:x.transaction_date,amountToman:n(x.amount_toman),trackingCode:x.tracking_code,description:x.description,matchedPaymentId:x.matched_manual_payment_id})),audit:au.rows};
  }
  async openPayment(iid){const r=await this.pool.query("SELECT EXISTS(SELECT 1 FROM manual_payments WHERE installment_id=$1 AND status='pending_review') OR EXISTS(SELECT 1 FROM native_payments WHERE installment_id=$1 AND status IN ('created','pending')) AS open",[iid]);return r.rows[0].open;}
  async createManualPayment(p){
    const c=await this.pool.connect();try{await c.query('BEGIN');
      const ir=await c.query('SELECT status FROM installments WHERE id=$1 FOR UPDATE',[p.installmentId]);
      if(!ir.rowCount||ir.rows[0].status==='paid')throw Object.assign(new Error('این قسط قبلاً پرداخت شده است.'),{status:409});
      const open=await c.query("SELECT EXISTS(SELECT 1 FROM manual_payments WHERE installment_id=$1 AND status='pending_review') OR EXISTS(SELECT 1 FROM native_payments WHERE installment_id=$1 AND status IN ('created','pending')) AS open",[p.installmentId]);
      if(open.rows[0].open)throw Object.assign(new Error('برای این قسط یک پرداخت در انتظار بررسی یا تکمیل ثبت شده است.'),{status:409});
      const r=await c.query("INSERT INTO manual_payments(id,member_id,installment_id,amount_toman,tracking_code,reference_code,receipt_name,receipt_key,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending_review') RETURNING *",[p.id,p.memberId,p.installmentId,p.amountToman,p.trackingCode||null,p.referenceCode,p.receiptName||null,p.receiptKey||null]);
      await c.query("UPDATE installments SET status='pending_review' WHERE id=$1 AND status<>'paid'",[p.installmentId]);await c.query('COMMIT');return paymentMap(r.rows[0],'manual');
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async createMember(m){const r=await this.pool.query('INSERT INTO members(id,name,phone,national_id,member_no,bale_user_id,status,joined_label) VALUES($1,$2,$3,$4,$5,NULLIF($6,\'\'),\'active\',$7) RETURNING *',[m.id,m.name,m.phone,m.nationalId,m.memberNo,m.baleUserId||'',m.joinedLabel]);return memberMap(r.rows[0]);}
  async createOffice(o){const r=await this.pool.query('INSERT INTO offices(id,office_no,name,bank_name,bank_account,iban,account_holder,status) VALUES($1,$2,$3,$4,$5,$6,$7,\'active\') RETURNING *',[o.id,o.officeNo,o.name,o.bankName,o.bankAccount,o.iban,o.accountHolder]);return officeMap(r.rows[0]);}
  async createLoan(l,installments){
    const c=await this.pool.connect();try{await c.query('BEGIN');
      await c.query("INSERT INTO loans(id,loan_no,member_id,office_id,principal_toman,installment_toman,monthly_saving_toman,installment_count,due_day,start_label,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')",[l.id,l.loanNo,l.memberId,l.officeId,l.principalToman,l.installmentToman,l.savingToman,l.months,l.dueDay,l.startLabel]);
      for(const i of installments)await c.query('INSERT INTO installments(id,loan_id,installment_no,due_label,due_sort,amount_toman,status) VALUES($1,$2,$3,$4,$5,$6,$7)',[i.id,l.id,i.installmentNo,i.dueLabel,i.dueSort,i.amountToman,i.status]);
      await c.query('COMMIT');return l;
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async createNativePayment(p){
    const c=await this.pool.connect();try{await c.query('BEGIN');
      const ir=await c.query('SELECT status FROM installments WHERE id=$1 FOR UPDATE',[p.installmentId]);
      if(!ir.rowCount||ir.rows[0].status==='paid')throw Object.assign(new Error('این قسط قبلاً پرداخت شده است.'),{status:409});
      const open=await c.query("SELECT EXISTS(SELECT 1 FROM manual_payments WHERE installment_id=$1 AND status='pending_review') OR EXISTS(SELECT 1 FROM native_payments WHERE installment_id=$1 AND status IN ('created','pending')) AS open",[p.installmentId]);
      if(open.rows[0].open)throw Object.assign(new Error('برای این قسط یک پرداخت در انتظار بررسی یا تکمیل ثبت شده است.'),{status:409});
      await c.query("INSERT INTO native_payments(id,member_id,bale_user_id,installment_id,amount_toman,payload,status) VALUES($1,$2,$3,$4,$5,$6,'created')",[p.id,p.memberId,p.baleUserId,p.installmentId,p.amountToman,p.payload]);await c.query('COMMIT');return p;
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async bindPreCheckout(payload,transactionId){try{const r=await this.pool.query("UPDATE native_payments SET transaction_id=$2 WHERE payload=$1 AND status IN ('created','pending') AND (transaction_id IS NULL OR transaction_id=$2) RETURNING id",[payload,String(transactionId)]);return r.rowCount===1;}catch(e){if(e.code==='23505')return false;throw e;}}
  async setInvoiceLink(pid,link){await this.pool.query("UPDATE native_payments SET invoice_link=$2,status='pending' WHERE id=$1",[pid,link]);}
  async markNativeFailed(pid){await this.pool.query("UPDATE native_payments SET status='failed' WHERE id=$1 AND status='created'",[pid]);}
  async cancelNativePayment(pid,memberId){
    const r=await this.pool.query("UPDATE native_payments SET status='failed' WHERE id=$1 AND member_id=$2 AND status IN ('created','pending') RETURNING status",[pid,memberId]);
    if(r.rowCount)return {ok:true,paid:false};
    const current=await this.pool.query('SELECT status FROM native_payments WHERE id=$1 AND member_id=$2',[pid,memberId]);
    if(!current.rowCount)return {error:'not_found'};return {ok:true,paid:current.rows[0].status==='paid'};
  }
  async nativeByPayload(payload){const r=await this.pool.query('SELECT * FROM native_payments WHERE payload=$1',[payload]);if(!r.rowCount)return null;return {...paymentMap(r.rows[0],'native'),baleUserId:r.rows[0].bale_user_id,invoiceLink:r.rows[0].invoice_link,transactionId:r.rows[0].transaction_id||''};}
  async review(pid,x){
    const c=await this.pool.connect();try{await c.query('BEGIN');const r=await c.query('SELECT * FROM manual_payments WHERE id=$1 FOR UPDATE',[pid]);
      if(!r.rowCount){await c.query('ROLLBACK');return {error:'not_found'};}const p=r.rows[0];
      if(p.status!=='pending_review'){await c.query('ROLLBACK');return {error:'already_reviewed'};}
      if(x.approve&&p.tracking_code){const duplicate=await c.query("SELECT EXISTS(SELECT 1 FROM manual_payments WHERE tracking_code=$1 AND id<>$2 AND status='approved') AS used",[p.tracking_code,pid]);if(duplicate.rows[0].used){await c.query('ROLLBACK');return {error:'duplicate_tracking'};}}
      const ir=await c.query('SELECT * FROM installments WHERE id=$1 FOR UPDATE',[p.installment_id]);
      if(!ir.rowCount||ir.rows[0].status==='paid'){await c.query('ROLLBACK');return {error:'already_paid'};}
      const st=x.approve?'approved':'rejected';
      const up=await c.query('UPDATE manual_payments SET status=$2,reviewed_at=now(),reviewed_by=$3,rejection_reason=$4 WHERE id=$1 RETURNING *',[pid,st,x.actor,x.approve?null:x.reason]);
      if(x.approve)await c.query("UPDATE installments SET status='paid',paid_at=now() WHERE id=$1",[p.installment_id]);
      else await c.query("UPDATE installments SET status='due' WHERE id=$1 AND status='pending_review'",[p.installment_id]);
      await c.query('INSERT INTO admin_audit_log(actor,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)',[x.actor,x.approve?'تایید پرداخت':'رد پرداخت','payment',pid,JSON.stringify({reason:x.reason||''})]);
      await c.query('COMMIT');return {payment:paymentMap(up.rows[0],'manual')};
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async assignments(mid,ids){
    const c=await this.pool.connect();try{await c.query('BEGIN');const m=await c.query('SELECT id FROM members WHERE id=$1 FOR UPDATE',[mid]);if(!m.rowCount){await c.query('ROLLBACK');return {error:'not_found'};}
      const unique=[...new Set(ids)];if(unique.length){const o=await c.query('SELECT id FROM offices WHERE id=ANY($1::uuid[])',[unique]);if(o.rowCount!==unique.length){await c.query('ROLLBACK');return {error:'invalid_office'};}}
      await c.query('DELETE FROM member_offices WHERE member_id=$1',[mid]);for(const oid of unique)await c.query('INSERT INTO member_offices(member_id,office_id) VALUES($1,$2)',[mid,oid]);
      await c.query('INSERT INTO admin_audit_log(actor,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)',[ADMIN_USER,'ویرایش تخصیص دفتر','member',mid,JSON.stringify({officeIds:unique})]);
      await c.query('COMMIT');return {ok:true};
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async updateMember(mid,bid){try{const r=await this.pool.query("UPDATE members SET bale_user_id=NULLIF($2,'') WHERE id=$1 RETURNING *",[mid,String(bid||'').trim()]);return r.rowCount?{member:memberMap(r.rows[0])}:{error:'not_found'};}catch(e){if(e.code==='23505')return {error:'bale_id_in_use'};throw e;}}
  async duplicateTrack(code,pid){if(!code)return false;const r=await this.pool.query("SELECT EXISTS(SELECT 1 FROM manual_payments WHERE tracking_code=$1 AND id<>$2 AND status='approved') AS used",[code,pid]);return r.rows[0].used;}
  async recordUpdate(uid){const r=await this.pool.query('INSERT INTO bale_updates(update_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING update_id',[uid]);return r.rowCount>0;}
  async claimReceipt(payload){const r=await this.pool.query('UPDATE native_payments SET notification_claimed_at=now() WHERE payload=$1 AND notification_claimed_at IS NULL RETURNING id',[payload]);return r.rowCount>0;}
  async finalize(x){
    const c=await this.pool.connect();try{await c.query('BEGIN');const r=await c.query('SELECT * FROM native_payments WHERE payload=$1 FOR UPDATE',[x.payload]);
      if(!r.rowCount){await c.query('ROLLBACK');return {error:'not_found'};}const p=r.rows[0];if(p.status==='paid'){await c.query('COMMIT');return {duplicate:true};}
      if(String(p.bale_user_id)!==String(x.baleUserId)||n(p.amount_toman)*10!==n(x.amountRial)||String(p.transaction_id||'')!==String(x.transactionId)){await c.query('ROLLBACK');return {error:'mismatch'};}
      const ir=await c.query('SELECT * FROM installments WHERE id=$1 FOR UPDATE',[p.installment_id]);if(!ir.rowCount||ir.rows[0].status==='paid'){await c.query('ROLLBACK');return {error:'already_paid'};}
      await c.query("UPDATE native_payments SET status='paid',provider_charge_id=$2,paid_at=now() WHERE id=$1",[p.id,x.providerChargeId]);
      await c.query("UPDATE installments SET status='paid',paid_at=now() WHERE id=$1",[p.installment_id]);
      await c.query('COMMIT');return {ok:true};
    }catch(e){await c.query('ROLLBACK');if(e.code==='23505')return {duplicate:true};throw e;}finally{c.release();}
  }
}
let store;
if(DEMO)store=new DemoStore(demoSeed());
else{if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required when DEMO_MODE=false');const {Pool}=await import('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});store=new PgStore(pool);await store.initialize();}
const config={demoMode:DEMO,nativePaymentAvailable:Boolean(BOT_TOKEN&&PROVIDER_TOKEN&&WEBHOOK_SECRET),phoneSupport:'۰۲۱-۸۸۴۴۱۲۰۰',nativePaymentNote:'پرداخت کیف‌پولی بله به کیف‌پول توسعه‌دهندهٔ بازو واریز می‌شود.'};
function cookie(req,key){for(const p of (req.headers.cookie||'').split(';')){const z=p.indexOf('=');if(z>0&&p.slice(0,z).trim()===key)return decodeURIComponent(p.slice(z+1).trim());}return '';}
const sessionCookie=(role)=>role==='admin'?'mosi_admin_session':'mosi_borrower_session';
function session(req,role){const token=cookie(req,sessionCookie(role)),s=sessions.get(token);if(!s||s.expires<Date.now()){sessions.delete(token);return null;}return s.role===role?s:null;}
function setSession(res,data){const token=crypto.randomBytes(32).toString('base64url'),sec=process.env.NODE_ENV==='production'?'; Secure':'';sessions.set(token,{...data,expires:Date.now()+43200000});res.setHeader('Set-Cookie',sessionCookie(data.role)+'='+encodeURIComponent(token)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200'+sec);}
function clearSession(res,role){const sec=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie',sessionCookie(role)+'=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+sec);}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function error(res,status,message){json(res,status,{error:message});}
async function body(req,max=7*1024*1024){const parts=[];let total=0;for await(const c of req){total+=c.length;if(total>max)throw Object.assign(new Error('حجم درخواست بیش از حد مجاز است.'),{status:413});parts.push(c);}if(!parts.length)return {};try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Object.assign(new Error('درخواست نامعتبر است.'),{status:400});}}
function sameOrigin(req){if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
function authData(raw){
  if(!BOT_TOKEN)throw Error('ورود مینی‌اپ روی سرور پیکربندی نشده است.');
  const params=new URLSearchParams(raw),map=new Map();for(const [k,v] of params){if(map.has(k))throw Error('دادهٔ شروع بله تکراری است.');map.set(k,v);}
  const hash=map.get('hash'),authDate=Number(map.get('auth_date')||0);if(!hash||!/^[a-f0-9]{64}$/i.test(hash)||!authDate)throw Error('دادهٔ شروع بله ناقص است.');
  const age=Math.floor(Date.now()/1000)-authDate;if(age < -120||age>86400)throw Error('دادهٔ شروع بله منقضی شده است.');
  map.delete('hash');const check=[...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
  const calculated=crypto.createHmac('sha256',secret).update(check).digest('hex');
  if(!eq(calculated.toLowerCase(),hash.toLowerCase()))throw Error('امضای دادهٔ بله معتبر نیست.');
  let user;try{user=JSON.parse(map.get('user')||'{}');}catch{throw Error('اطلاعات کاربر بله نامعتبر است.');}
  if(!user.id)throw Error('شناسهٔ کاربر بله وجود ندارد.');return user;
}
async function bale(method,data){
  if(!BOT_TOKEN)throw Error('BALE_BOT_TOKEN تنظیم نشده است.');
  const r=await fetch('https://tapi.bale.ai/bot'+BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(7000)});
  const x=await r.json().catch(()=>null);if(!r.ok||!x||x.ok!==true)throw Error(x&&x.description||'پاسخ ناموفق از API بله.');return x.result;
}
async function webhook(req,res,url){
  if(!WEBHOOK_SECRET||url.pathname!=='/api/webhooks/bale/'+WEBHOOK_SECRET)return error(res,404,'یافت نشد.');
  const update=await body(req,1024*1024),uid=Number(update.update_id);if(!Number.isSafeInteger(uid))return error(res,400,'شناسهٔ آپدیت نامعتبر است.');
  if(update.pre_checkout_query){
    const q=update.pre_checkout_query,p=await store.nativeByPayload(q.invoice_payload);
    const matches=Boolean(q.id&&p&&['created','pending'].includes(p.status)&&String(p.baleUserId)===String(q.from&&q.from.id)&&q.currency==='IRR'&&n(p.amountToman)*10===n(q.total_amount));
    const ok=matches&&await store.bindPreCheckout(q.invoice_payload,q.id);
    await bale('answerPreCheckoutQuery',{pre_checkout_query_id:q.id,ok,...(ok?{}:{error_message:'مبلغ یا اطلاعات پرداخت با درخواست صندوق هم‌خوانی ندارد.'})});
    await store.recordUpdate(uid);return json(res,200,{ok:true});
  }
  const msg=update.message||null,pay=msg&&msg.successful_payment;
  if(pay){
    const transactionId=String(pay.telegram_payment_charge_id||''),tx=await bale('inquireTransaction',{transaction_id:transactionId}),userId=String(msg.from&&msg.from.id||''),p=await store.nativeByPayload(pay.invoice_payload);
    const txUser=tx&&(tx.userID??tx.userId??tx.user_id),charge=String(pay.provider_payment_charge_id||pay.telegram_payment_charge_id||'');
    if(!p||!tx||String(tx.id)!==transactionId||String(p.transactionId)!==transactionId||tx.status!=='paid'||String(txUser)!==userId||String(p.baleUserId)!==userId||pay.currency!=='IRR'||n(tx.amount)!==n(pay.total_amount)||n(pay.total_amount)!==n(p.amountToman)*10)return error(res,409,'پرداخت با اطلاعات سفارش تطبیق ندارد.');
    const result=await store.finalize({payload:pay.invoice_payload,baleUserId:userId,amountRial:n(pay.total_amount),transactionId,providerChargeId:charge});
    if(result.error)return error(res,409,'پرداخت ثبت نشد: '+result.error);
    if(await store.claimReceipt(pay.invoice_payload)){
      const match=await store.nativeByPayload(pay.invoice_payload);
      try{await bale('sendMessage',{chat_id:userId,text:'پرداخت قسط شما با موفقیت تایید شد.\nمبلغ: '+fmt(pay.total_amount/10)+' تومان\nشماره پیگیری بله: '+charge+'\nشماره مرجع صندوق: '+String(match?.id||'').slice(0,8).toUpperCase()});}
      catch(e){console.error('Bale payment confirmation could not be sent:',e.message);}
    }
    await store.recordUpdate(uid);return json(res,200,{ok:true});
  }
  await store.recordUpdate(uid);return json(res,200,{ok:true});
}
async function api(req,res,url){
  const p=url.pathname,m=req.method||'GET';
  if(m==='GET'&&p==='/api/config')return json(res,200,config);
  if(m==='GET'&&p==='/api/demo/members'){
    if(!DEMO)return error(res,404,'حالت نمونه فعال نیست.');
    const data=await store.overview();
    return json(res,200,{members:data.members.filter((x)=>x.status==='active').map((member)=>({...member,officeCount:data.assignments.filter((a)=>a.memberId===member.id).length}))});
  }
  if(m==='POST'&&p==='/api/auth/demo'){
    if(!DEMO)return error(res,404,'حالت نمونه فعال نیست.');const b=await body(req,20000),member=await store.getMember(String(b.memberId||''));
    if(!member||member.status!=='active')return error(res,400,'حساب نمونه پیدا نشد.');
    setSession(res,{role:'borrower',memberId:member.id,displayName:member.name,baleUserId:member.baleUserId||''});return json(res,200,{ok:true,member});
  }
  if(m==='POST'&&p==='/api/auth/bale'){
    try{const b=await body(req,30000),u=authData(String(b.initData||'')),member=await store.getMemberByBaleId(u.id);
      if(!member||member.status!=='active')return error(res,403,'حساب بله شما به عضویت صندوق متصل نشده است. شناسهٔ تاییدشدهٔ شما: '+String(u.id)+' · آن را برای اتصال به مدیر صندوق بدهید.');
      setSession(res,{role:'borrower',memberId:member.id,displayName:member.name,baleUserId:String(u.id)});return json(res,200,{ok:true,member});
    }catch(e){return error(res,401,e.message);}
  }
  if(m==='POST'&&p==='/api/auth/admin'){
    if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');const b=await body(req,20000);
    if(!ADMIN_PASS||!eq(b.username,ADMIN_USER)||!eq(b.password,ADMIN_PASS))return error(res,401,'نام کاربری یا رمز عبور درست نیست.');
    setSession(res,{role:'admin',adminName:'مدیر صندوق'});return json(res,200,{ok:true});
  }
  if(m==='POST'&&p==='/api/auth/logout'){
    if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');const b=await body(req,2000),role=b.role==='admin'?'admin':'borrower',name=sessionCookie(role);sessions.delete(cookie(req,name));clearSession(res,role);return json(res,200,{ok:true});
  }
  if(m==='GET'&&p==='/api/borrower/home'){
    const s=session(req,'borrower');if(!s)return error(res,401,'نشست کاربر معتبر نیست.');const data=await store.getBundle(s.memberId);
    return data?json(res,200,{...data,config}):error(res,404,'حساب پیدا نشد.');
  }
  if(m==='POST'&&p==='/api/payments/manual'){
    const s=session(req,'borrower');if(!s)return error(res,401,'نشست کاربر معتبر نیست.');if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');
    const b=await body(req),inst=await store.getInstallment(String(b.installmentId||''));if(!inst)return error(res,404,'قسط پیدا نشد.');
    const loan=await store.getLoan(inst.loanId);if(!loan||loan.memberId!==s.memberId||!await store.hasAssignment(s.memberId,loan.officeId))return error(res,403,'دسترسی به این قسط ندارید.');
    if(inst.status==='paid')return error(res,409,'این قسط قبلاً پرداخت شده است.');
    if(await store.openPayment(inst.id))return error(res,409,'برای این قسط یک پرداخت در انتظار بررسی یا تکمیل ثبت شده است.');
    const track=String(b.trackingCode||'').replace(/\s/g,'');if(track&&!/^[A-Za-z0-9۰-۹_-]{6,40}$/.test(track))return error(res,400,'شمارهٔ پیگیری باید دست‌کم ۶ نویسهٔ معتبر باشد.');
    let receiptName='',receiptKey='';
    if(b.receipt&&b.receipt.base64){
      const allowed={'image/jpeg':'.jpg','image/png':'.png','application/pdf':'.pdf'};
      if(!allowed[b.receipt.mime])return error(res,400,'فقط تصویر JPG/PNG یا فایل PDF پذیرفته می‌شود.');
      const buf=Buffer.from(String(b.receipt.base64),'base64');if(!buf.length||buf.length>4*1024*1024)return error(res,413,'حجم رسید باید حداکثر ۴ مگابایت باشد.');
      const validFile=b.receipt.mime==='image/jpeg'?buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff:b.receipt.mime==='image/png'?buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):buf.subarray(0,4).toString('ascii')==='%PDF';
      if(!validFile)return error(res,400,'محتوای فایل با نوع انتخاب‌شده هم‌خوانی ندارد.');
      receiptName=String(b.receipt.name||'رسید').replace(/[^\p{L}\p{N}._ -]/gu,'').slice(0,100)||'رسید';receiptKey=id()+allowed[b.receipt.mime];
      await fs.writeFile(path.join(ROOT,'uploads',receiptKey),buf,{flag:'wx'});
    }
    if(!track&&!receiptKey)return error(res,400,'عکس رسید یا شمارهٔ پیگیری را وارد کنید.');
    const referenceCode='MOS-'+crypto.randomBytes(4).toString('hex').toUpperCase();
    let saved;
    try{saved=await store.createManualPayment({id:id(),memberId:s.memberId,installmentId:inst.id,amountToman:inst.amountToman,trackingCode:track,referenceCode,receiptName,receiptKey,status:'pending_review',submittedAt:new Date().toISOString(),kind:'manual'});}
    catch(e){if(receiptKey)await fs.unlink(path.join(ROOT,'uploads',receiptKey)).catch(()=>{});if(e.status===409||e.code==='23505')return error(res,409,e.message||'برای این قسط پرداخت دیگری ثبت شده است.');throw e;}
    if(BOT_TOKEN&&s.baleUserId){try{await bale('sendMessage',{chat_id:s.baleUserId,text:'اعلام پرداخت شما ثبت شد و در انتظار بررسی صندوق است.\nشماره پیگیری صندوق: '+referenceCode+'\nمبلغ: '+fmt(inst.amountToman)+' تومان'});}catch(e){console.error('Bale submission receipt could not be sent:',e.message);}}
    return json(res,201,{ok:true,payment:saved,referenceCode});
  }
  if(m==='POST'&&p==='/api/payments/native'){
    const s=session(req,'borrower');if(!s)return error(res,401,'نشست کاربر معتبر نیست.');if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');
    if(!config.nativePaymentAvailable)return error(res,503,'پرداخت مستقیم بله فعال نشده است؛ رسید یا شمارهٔ پیگیری را ثبت کنید.');
    if(!s.baleUserId)return error(res,403,'حساب بله به این عضو متصل نیست.');
    const b=await body(req,20000),inst=await store.getInstallment(String(b.installmentId||''));if(!inst)return error(res,404,'قسط پیدا نشد.');
    if(!Number.isSafeInteger(inst.amountToman*10)||inst.amountToman*10>2147483647)return error(res,400,'مبلغ این قسط از سقف قابل پردازش بله بیشتر است.');
    const loan=await store.getLoan(inst.loanId);if(!loan||loan.memberId!==s.memberId||!await store.hasAssignment(s.memberId,loan.officeId))return error(res,403,'دسترسی به این قسط ندارید.');
    if(inst.status==='paid')return error(res,409,'این قسط قبلاً پرداخت شده است.');if(await store.openPayment(inst.id))return error(res,409,'برای این قسط قبلاً پرداختی ثبت شده است.');
    const pid=id(),payload='mosi_'+pid.replaceAll('-','');
    try{await store.createNativePayment({id:pid,memberId:s.memberId,baleUserId:String(s.baleUserId),installmentId:inst.id,amountToman:inst.amountToman,payload,status:'created'});}
    catch(e){if(e.status===409||e.code==='23505')return error(res,409,e.message||'برای این قسط قبلاً پرداختی ثبت شده است.');throw e;}
    try{
      const link=await bale('createInvoiceLink',{title:'قسط وام '+loan.loanNo,description:'قسط '+inst.installmentNo+' · صندوق قرض‌الحسنه',payload,provider_token:PROVIDER_TOKEN,prices:[{label:'قسط وام',amount:inst.amountToman*10}]});
      if(typeof link!=='string'||!link)throw Error('شناسهٔ پرداخت از بله دریافت نشد.');await store.setInvoiceLink(pid,link);return json(res,201,{ok:true,invoiceLink:link,paymentId:pid});
    }catch(e){await store.markNativeFailed(pid);return error(res,502,'ساخت درخواست پرداخت بله ناموفق بود: '+e.message);}
  }
  if(m==='POST'&&p.startsWith('/api/payments/native/')&&p.endsWith('/cancel')){
    const s=session(req,'borrower');if(!s)return error(res,401,'نشست کاربر معتبر نیست.');if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');
    const pid=p.split('/')[4],result=await store.cancelNativePayment(pid,s.memberId);if(result.error)return error(res,404,'درخواست پرداخت پیدا نشد.');return json(res,200,{ok:true,paid:Boolean(result.paid)});
  }
  if(m==='GET'&&p==='/api/admin/overview'){
    if(!session(req,'admin'))return error(res,401,'ابتدا وارد پنل مدیریت شوید.');return json(res,200,await store.overview());
  }
  if(m==='POST'&&p==='/api/admin/members'){
    if(!session(req,'admin'))return error(res,401,'ابتدا وارد پنل مدیریت شوید.');if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');
    const b=await body(req,30000),overview=await store.overview(),officeIds=[...new Set(Array.isArray(b.officeIds)?b.officeIds.map(String):[])];
    const name=String(b.name||'').trim(),phone=String(b.phone||'').replace(/[۰-۹]/g,(d)=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))),memberNo=String(b.memberNo||'').replace(/[۰-۹]/g,(d)=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
    if(name.length<3||name.length>100||!/^\d{8,15}$/.test(phone)||!/^\d{2,12}$/.test(memberNo))return error(res,400,'نام، شماره موبایل یا شماره عضویت معتبر نیست.');
    if(!officeIds.length||officeIds.some((x)=>!overview.offices.some((o)=>o.id===x)))return error(res,400,'حداقل یک دفتر معتبر انتخاب کنید.');
    try{const member=await store.createMember({id:id(),name,phone,nationalId:String(b.nationalId||'').trim(),memberNo,baleUserId:String(b.baleUserId||'').trim(),joinedLabel:'عضویت جدید'});const assigned=await store.assignments(member.id,officeIds);if(assigned.error)throw Error('ذخیره تخصیص دفتر ناموفق بود.');return json(res,201,{ok:true,member});}
    catch(e){if(e.code==='23505')return error(res,409,'شماره عضویت یا شناسه بله تکراری است.');throw e;}
  }
  if(m==='POST'&&p==='/api/admin/offices'){
    if(!session(req,'admin'))return error(res,401,'ابتدا وارد پنل مدیریت شوید.');if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');
    const b=await body(req,20000),officeNo=Number(String(b.officeNo||'').replace(/[۰-۹]/g,(d)=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
    const name=String(b.name||'').trim(),bankName=String(b.bankName||'').trim(),bankAccount=String(b.bankAccount||'').trim();
    if(!Number.isInteger(officeNo)||officeNo<1||officeNo>999999||name.length<2||bankName.length<2||bankAccount.length<4)return error(res,400,'شماره و نام دفتر و اطلاعات حساب بانکی را کامل کنید.');
    const office={id:id(),officeNo,name,bankName,bankAccount,iban:String(b.iban||'').trim(),accountHolder:String(b.accountHolder||'').trim(),status:'active'};
    try{await store.createOffice(office);return json(res,201,{ok:true,office});}catch(e){if(e.code==='23505')return error(res,409,'این شماره دفتر قبلاً ثبت شده است.');throw e;}
  }
  if(m==='POST'&&p==='/api/admin/loans'){
    if(!session(req,'admin'))return error(res,401,'ابتدا وارد پنل مدیریت شوید.');if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');
    const b=await body(req,30000),overview=await store.overview();
    const loanNo=Number(b.loanNo),principalToman=Number(b.principalToman),installmentToman=Number(b.installmentToman),savingToman=Number(b.savingToman||0),months=Number(b.months),dueDay=Number(b.dueDay||5),startYear=Number(b.startYear),startMonth=Number(b.startMonth);
    const member=await store.getMember(String(b.memberId||'')),office=overview.offices.find((o)=>o.id===String(b.officeId||''));
    if(!Number.isInteger(loanNo)||loanNo<1||!Number.isSafeInteger(principalToman)||principalToman<1||!Number.isSafeInteger(installmentToman)||installmentToman<1||!Number.isSafeInteger(savingToman)||savingToman<0||!Number.isInteger(months)||months<1||months>120||!Number.isInteger(dueDay)||dueDay<1||dueDay>31||!Number.isInteger(startYear)||startYear<1300||startYear>1499||!Number.isInteger(startMonth)||startMonth<1||startMonth>12)return error(res,400,'اطلاعات وام یا برنامه اقساط معتبر نیست.');
    if(!member||!office||!await store.hasAssignment(member.id,office.id))return error(res,400,'عضو باید به دفتر انتخاب‌شده تخصیص داشته باشد.');
    const loan={id:id(),loanNo,memberId:member.id,officeId:office.id,principalToman,installmentToman,savingToman,months,dueDay,status:'active',startYear,startMonth,startLabel:monthLabel(startYear,startMonth,1)};
    const installments=scheduleFor(loan).map((i)=>({...i,id:id()}));
    try{await store.createLoan(loan,installments);return json(res,201,{ok:true,loan});}catch(e){if(e.code==='23505')return error(res,409,'شماره وام قبلاً ثبت شده است.');throw e;}
  }
  if(m==='PUT'&&p.startsWith('/api/admin/members/')&&p.endsWith('/assignments')){
    if(!session(req,'admin'))return error(res,401,'ابتدا وارد پنل مدیریت شوید.');if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');
    const mid=p.split('/')[4],b=await body(req,30000),r=await store.assignments(mid,Array.isArray(b.officeIds)?b.officeIds.map(String):[]);
    if(r.error==='not_found')return error(res,404,'عضو پیدا نشد.');if(r.error)return error(res,400,'یکی از دفترهای انتخاب‌شده معتبر نیست.');return json(res,200,{ok:true});
  }
  if(m==='PATCH'&&p.startsWith('/api/admin/members/')){
    if(!session(req,'admin'))return error(res,401,'ابتدا وارد پنل مدیریت شوید.');if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');
    const mid=p.split('/').pop(),b=await body(req,20000),r=await store.updateMember(mid,String(b.baleUserId||''));
    if(r.error==='not_found')return error(res,404,'عضو پیدا نشد.');if(r.error==='bale_id_in_use')return error(res,409,'این شناسهٔ بله برای عضو دیگری ثبت شده است.');return json(res,200,{ok:true,member:r.member});
  }
  if(m==='POST'&&p.startsWith('/api/admin/payments/')&&p.endsWith('/review')){
    const s=session(req,'admin');if(!s)return error(res,401,'ابتدا وارد پنل مدیریت شوید.');if(!sameOrigin(req))return error(res,403,'درخواست نامعتبر است.');
    const pid=p.split('/')[4],b=await body(req,20000),approve=b.action==='approve',reason=String(b.reason||'').trim();
    if(!approve&&!reason)return error(res,400,'برای رد پرداخت، علت را وارد کنید.');
    if(approve){
      const overview=await store.overview(),payment=overview.payments.find((x)=>x.id===pid);
      if(payment&&payment.trackingCode&&await store.duplicateTrack(payment.trackingCode,pid))return error(res,409,'این شمارهٔ پیگیری پیش‌تر برای پرداخت دیگری تایید شده است.');
    }
    let r;try{r=await store.review(pid,{approve,reason,actor:s.adminName});}catch(e){if(e.code==='23505')return error(res,409,'این شمارهٔ پیگیری پیش‌تر برای پرداخت دیگری تایید شده است.');throw e;}
    if(r.error==='not_found')return error(res,404,'پرداخت پیدا نشد.');if(r.error==='duplicate_tracking')return error(res,409,'این شمارهٔ پیگیری پیش‌تر برای پرداخت دیگری تایید شده است.');if(r.error)return error(res,409,'وضعیت پرداخت تغییر کرده است؛ فهرست را تازه‌سازی کنید.');
    if(approve&&BOT_TOKEN){const member=await store.getMember(r.payment.memberId);if(member?.baleUserId){try{await bale('sendMessage',{chat_id:member.baleUserId,text:'پرداخت قسط شما توسط صندوق تایید شد.\nمبلغ: '+fmt(r.payment.amountToman)+' تومان\nشماره پیگیری صندوق: '+(r.payment.referenceCode||r.payment.trackingCode||r.payment.id.slice(0,8))});}catch(e){console.error('Bale approval message could not be sent:',e.message);}}}
    return json(res,200,{ok:true,payment:r.payment});
  }
  if(m==='GET'&&p.startsWith('/api/admin/receipts/')){
    if(!session(req,'admin'))return error(res,401,'ابتدا وارد پنل مدیریت شوید.');
    const name=path.basename(decodeURIComponent(p.split('/').pop()||''));if(!name||name!==decodeURIComponent(p.split('/').pop()||''))return error(res,400,'نام فایل نامعتبر است.');
    const fp=path.join(ROOT,'uploads',name);try{const st=await fs.stat(fp);const type=name.endsWith('.pdf')?'application/pdf':name.endsWith('.png')?'image/png':'image/jpeg';res.writeHead(200,{'Content-Length':st.size,'Content-Type':type,'Content-Disposition':'inline; filename="'+name+'"','X-Content-Type-Options':'nosniff'});createReadStream(fp).pipe(res);return;}catch{return error(res,404,'فایل پیدا نشد.');}
  }
  return error(res,404,'مسیر پیدا نشد.');
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const server=createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||'/', 'http://localhost');
    if(u.pathname.startsWith('/api/webhooks/bale/'))return await webhook(req,res,u);
    if(u.pathname.startsWith('/api/'))return await api(req,res,u);
    if(req.method!=='GET'&&req.method!=='HEAD')return error(res,405,'روش درخواست پشتیبانی نمی‌شود.');
    let pathname=decodeURIComponent(u.pathname);if(pathname==='/'||pathname==='/admin'||pathname==='/admin/')pathname='/index.html';
    const base=path.resolve(ROOT,'public'),fp=path.resolve(base,'.'+pathname);if(!fp.startsWith(base+path.sep))return error(res,403,'دسترسی مجاز نیست.');
    let st;try{st=await fs.stat(fp);}catch{return error(res,404,'فایل پیدا نشد.');}if(!st.isFile())return error(res,404,'فایل پیدا نشد.');
    const ext=path.extname(fp).toLowerCase();
    res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Content-Length':st.size,'Cache-Control':['.html','.js','.css'].includes(ext)?'no-cache':'public, max-age=300','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')return res.end();createReadStream(fp).pipe(res);
  }catch(e){console.error(e);if(!res.headersSent)error(res,e.status||500,e.message||'خطای داخلی سرور.');else res.end();}
});
server.listen(PORT,'127.0.0.1',()=>console.log('Mosi loan fund listening on http://localhost:'+PORT+' · '+(DEMO?'demo':'postgres')));
