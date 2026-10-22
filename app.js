/* CEO FRESH v71.0.0: consolidated navigation, baseline stabilization, retained existing business modules */
const cfg=window.CEO_FRES_CONFIG||{}; const hasCloud=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY); const sb=hasCloud?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
let session=null, profile=null, business=null, userPermissions=new Set(), db={products:[],sales:[],expenses:[],stock:[],recipeItems:[],suppliers:[],purchases:[],purchaseItems:[],supplierPayments:[],receivablePayments:[],customers:[],resellerPrices:[],cashClosings:[],salesReturns:[],salesRefunds:[],stockAdjustments:[],users:[],onlineCatalog:[],onlineOrders:[],onlineOrderItems:[],cashOpenings:[],cashWithdrawals:[],cashOperationalStatus:null,auditLogs:[],assets:[],purchaseAssets:[]}, currentPage='dashboard';
function can(code){return userPermissions.has(String(code||''))}
function canAny(...codes){return codes.some(code=>can(code))}
function canPrefix(prefix){for(const code of userPermissions){if(String(code).startsWith(prefix))return true}return false}
function requirePermission(code,label='tindakan ini'){if(can(code))return true;alert(`Anda tidak memiliki izin untuk ${label}.`);return false}
function requireAnyPermission(codes,label='tindakan ini'){if(canAny(...codes))return true;alert(`Anda tidak memiliki izin untuk ${label}.`);return false}
function requirePrefixPermission(prefix,label='tindakan ini'){if(canPrefix(prefix))return true;alert(`Anda tidak memiliki izin untuk ${label}.`);return false}
async function loadPermissions(){
  userPermissions=new Set();
  // Pemilik selalu memiliki kendali penuh; untuk akun lain, gunakan pengaturan per akun
  // jika sudah disesuaikan. Jika belum, gunakan hak akses bawaan role.
  if(profile?.role==='pemilik'){
    const {data:all,error}=await sb.from('permissions').select('id,code');
    if(error)throw new Error(`Gagal memuat daftar permission: ${error.message}`);
    (all||[]).forEach(x=>userPermissions.add(x.code)); return;
  }
  const custom=await sb.from('user_permission_profiles').select('customized').eq('user_id',profile.id).eq('business_id',profile.business_id).maybeSingle();
  if(custom.error)throw new Error(`Gagal memuat pengaturan hak akses akun. Periksa proyek Supabase dan schema cache: ${custom.error.message}`);
  if(custom.data?.customized){
    const {data:up,error}=await sb.from('user_permissions').select('permission_id').eq('user_id',profile.id).eq('business_id',profile.business_id).eq('enabled',true);
    if(error)throw new Error(`Gagal memuat hak akses akun: ${error.message}`);
    const ids=(up||[]).map(x=>x.permission_id).filter(Boolean);
    if(ids.length){const {data:perms,error:pe}=await sb.from('permissions').select('id,code').in('id',ids);if(pe)throw new Error(pe.message);(perms||[]).forEach(x=>userPermissions.add(x.code));}
    return;
  }
  const {data:rp,error:rpError}=await sb.from('role_permissions').select('permission_id').eq('role',profile.role);
  if(rpError)throw new Error(`Gagal memuat hak akses: ${rpError.message}`);
  const ids=(rp||[]).map(x=>x.permission_id).filter(Boolean); if(!ids.length)return;
  const {data:perms,error:pError}=await sb.from('permissions').select('id,code').in('id',ids);
  if(pError)throw new Error(`Gagal memuat daftar permission: ${pError.message}`);
  (perms||[]).forEach(x=>userPermissions.add(x.code));
}
const $=id=>document.getElementById(id), rup=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0), fmtNum=n=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:6,useGrouping:true}).format(Number(n)||0), parseNum=v=>{const s=String(v??'').trim().replace(/\s/g,'');if(!s)return 0;if(s.includes(','))return Number(s.replace(/\./g,'').replace(',','.'))||0;return Number(s.replace(/\./g,''))||0}, today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}, esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const roleDisplay={pemilik:'Pemilik',kasir:'Kasir',finance:'Finance',gudang:'Gudang',purchasing:'Purchasing',supervisor:'Supervisor',online_admin:'Online Admin'};
function updateUserIdentity(){const el=$('userIdentity');if(!el||!profile)return;const label=(profile.account_label||'').trim()||roleDisplay[profile.role]||profile.role||'Pengguna';const role=roleDisplay[profile.role]||profile.role||'';el.innerHTML=`<div class="user-identity-name">👤 ${esc(label)}</div><div class="user-identity-role">${esc(role)}</div>`;}
function msg(t){if($('cloudMsg'))$('cloudMsg').textContent=t;if($('signupMsg'))$('signupMsg').textContent=t}
async function signIn(){if(!hasCloud)return msg('Cloud belum dikonfigurasi. Isi config.js terlebih dahulu.');const login=$('email').value.trim(),password=$('password').value;if(!login||!password)return msg('No. HP/email dan password wajib diisi.');const isPhone=/^\+?[0-9][0-9\s-]{7,}$/.test(login);const credentials=isPhone?{phone:login.replace(/[\s-]/g,''),password}:{email:login,password};const {data,error}=await sb.auth.signInWithPassword(credentials);if(error)return msg(error.message);await start(data.session)}
function showSignup(){
  $('login')?.classList.add('hidden'); $('signup')?.classList.remove('hidden');
  $('signupEmail')?.focus(); toggleSignupMode();
}
function toggleSignupMode(){const mode=$('signupMode')?.value||'join';const joining=mode==='join';$('joinFields')?.classList.toggle('hidden',!joining);$('ownerFields')?.classList.toggle('hidden',joining);$('requestedRole')?.toggleAttribute('disabled',!joining);$('accountLabel')?.toggleAttribute('disabled',!joining);}
async function signUp(){
  if(!hasCloud)return msg('Cloud belum dikonfigurasi.');
  const phone=($('signupPhone')?.value.trim()||'').replace(/[\s-]/g,'');
  const password=$('signupPassword')?.value||''; const fullName=$('signupName')?.value.trim()||'';
  const mode=$('signupMode')?.value||'join'; const joinCode=($('signupJoinCode')?.value.trim()||'').toUpperCase();
  const requestedRole=$('requestedRole')?.value||'kasir'; const accountLabel=$('accountLabel')?.value.trim()||'';
  if(!fullName)return msg('Nama pengguna wajib diisi.');
  if(!/^\+?[0-9]{9,15}$/.test(phone))return msg('No. HP tidak valid. Gunakan format 08xxxxxxxxxx atau +62xxxxxxxxxx.');
  if(password.length<6)return msg('Password minimal 6 karakter.');
  if(mode==='join'&&!joinCode)return msg('Kode usaha wajib diisi untuk bergabung ke usaha.');
  const metadata=mode==='join'?{full_name:fullName,join_code:joinCode,requested_role:requestedRole,account_label:accountLabel}:{full_name:fullName,join_code:'',requested_role:'pemilik',account_label:''};
  const {data,error}=await sb.auth.signUp({phone,password,options:{data:metadata}});
  if(error)return msg(error.message);
  if(data?.session) await start(data.session); else {showLogin();msg(mode==='join'?'Pendaftaran berhasil. Menunggu persetujuan Pemilik.':'Usaha baru berhasil didaftarkan. Silakan masuk untuk melanjutkan.');}
}

function showLogin(){
  $('signup')?.classList.add('hidden'); $('login')?.classList.remove('hidden');
  const e=$('signupPhone')?.value.trim(); if(e&&$('email'))$('email').value=e;
}
async function signOut(){await sb?.auth.signOut();session=null;profile=null;business=null;location.reload()}
function togglePassword(id,btn){const input=$(id);if(!input)return;const show=input.type==='password';input.type=show?'text':'password';if(btn){btn.textContent=show?'🙈':'👁';btn.setAttribute('aria-label',show?'Sembunyikan password':'Tampilkan password')}}
async function start(s){
  session=s;
  const p=await sb.from('profiles').select('*').eq('id',s.user.id).single();
  if(p.error){await sb.auth.signOut();session=null;$('login').classList.remove('hidden');$('app').classList.add('hidden');msg('Profil belum dibuat di database. Jalankan SQL setup.');return;}
  profile=p.data;
  updateUserIdentity();
  if(profile.account_status&&profile.account_status!=='active'){
    await sb.auth.signOut();session=null;$('login').classList.remove('hidden');$('app').classList.add('hidden');$('signup')?.classList.add('hidden');
    const status=profile.account_status==='pending'?'menunggu persetujuan Pemilik':profile.account_status==='rejected'?'ditolak oleh Pemilik':'tidak aktif';msg(`Akun Anda ${status}. Silakan hubungi Pemilik usaha.`);return;
  }
  $('login').classList.add('hidden');$('signup')?.classList.add('hidden');$('app').classList.remove('hidden');$('syncStatus').textContent='☁ Sinkron';
  const b=await sb.from('businesses').select('*').eq('id',profile.business_id).single();if(b.error){msg(`Gagal memuat usaha: ${b.error.message}`);return}business=b.data;
  try{await loadPermissions()}catch(err){$('syncStatus').textContent='⚠ Hak akses gagal';msg(err.message);return}await loadAll();buildNav();render();
}
async function loadAll(){
  const auditQuery=profile?.role==='pemilik' ? sb.from('audit_logs').select('*').eq('business_id',profile.business_id).eq('action','BUKA_KEMBALI').order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null});
  const ownerHistory=profile?.role==='pemilik';
  const cashClosingsQuery=ownerHistory ? sb.from('cash_closings').select('*').eq('business_id',profile.business_id).order('closing_date',{ascending:false}) : Promise.resolve({data:[],error:null});
  const cashOpeningsQuery=ownerHistory ? sb.from('cash_openings').select('*').eq('business_id',profile.business_id).order('opening_date',{ascending:false}) : Promise.resolve({data:[],error:null});
  const cashStatusQuery=sb.rpc('get_cash_operational_status',{p_business_id:profile.business_id,p_cash_date:today()});
  const cashWithdrawalsQuery=ownerHistory ? sb.from('cash_withdrawals').select('*').eq('business_id',profile.business_id).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null});
  const [p,s,e,st,r,su,pu,pi,sp,rp,cu,rr,cc,sr,sf,us,oc,oo,oi,co,cw,as,pa,cashStatus,pb]=await Promise.all([sb.from('products').select('*').order('created_at'),sb.from('sales').select('*').order('created_at',{ascending:false}),sb.from('expenses').select('*').order('created_at',{ascending:false}),sb.from('stock').select('*').order('created_at'),sb.from('recipe_items').select('id,product_id,stock_id,qty').eq('business_id',profile.business_id),sb.from('suppliers').select('*').order('name'),sb.from('purchases').select('*').order('purchase_date',{ascending:false}),sb.from('purchase_items').select('*').order('created_at',{ascending:false}),sb.from('supplier_payments').select('*').order('payment_date',{ascending:false}),sb.from('receivable_payments').select('*').order('payment_date',{ascending:false}),sb.from('customers').select('*').order('name'),sb.from('reseller_prices').select('*').eq('business_id',profile.business_id),cashClosingsQuery,sb.from('sales_returns').select('*').eq('business_id',profile.business_id).order('created_at',{ascending:false}),sb.from('sales_refunds').select('*').eq('business_id',profile.business_id).order('created_at',{ascending:false}),sb.from('profiles').select('id,business_id,full_name,email,phone,role,account_status,requested_role,account_label,created_at').eq('business_id',profile.business_id).order('created_at'),sb.from('online_catalog').select('*').eq('business_id',profile.business_id).order('sort_order').order('online_name'),sb.from('online_orders').select('*').eq('business_id',profile.business_id).order('created_at',{ascending:false}),sb.from('online_order_items').select('*').order('created_at',{ascending:false}),cashOpeningsQuery,cashWithdrawalsQuery,sb.from('assets').select('*').eq('business_id',profile.business_id).order('name'),sb.from('purchase_assets').select('*').eq('business_id',profile.business_id).order('created_at',{ascending:false}),cashStatusQuery,sb.from('production_batches').select('*').order('produced_at',{ascending:false})]);
  const sa=await sb.rpc('get_stock_adjustments',{p_business_id:profile.business_id});
  const cloudFailures=[
    ['products',p],['sales',s],['expenses',e],['stock',st],['recipe_items',r],['suppliers',su],['purchases',pu],['purchase_items',pi],['supplier_payments',sp],['receivable_payments',rp],['customers',cu],['reseller_prices',rr],['cash_closings',cc],['sales_returns',sr],['sales_refunds',sf],['profiles',us],['online_catalog',oc],['online_orders',oo],['online_order_items',oi],['cash_openings',co],['cash_withdrawals',cw],['assets',as],['purchase_assets',pa],['get_cash_operational_status()',cashStatus],['production_batches',pb],['get_stock_adjustments()',sa]
  ].filter(([,result])=>result&&result.error);
  if(cloudFailures.length){
    const [source,failed]=cloudFailures[0]; const detail=failed.error?.message||String(failed.error||'Kesalahan tidak diketahui');
    $('syncStatus').textContent=`⚠ Cloud: ${source}`;
    $('syncStatus').title=`Sumber: ${source} — ${detail}`;
    console.error('[CEO FRESH Cloud error]',source,failed.error,cloudFailures);
    alert(`Data CEO FRESH gagal dimuat.

Sumber: ${source}
Detail: ${detail}

Kirimkan pesan ini kepada pendamping agar perbaikannya tepat. Jangan jalankan SQL tambahan dulu.`);
    return;
  }
  db.products=p.data;db.sales=s.data;db.expenses=e.data;db.stock=st.data;db.recipeItems=r.data||[];db.suppliers=su.data||[];db.purchases=pu.data||[];db.purchaseItems=pi.data||[];db.supplierPayments=sp.data||[];db.receivablePayments=rp.data||[];db.customers=cu.data||[];db.resellerPrices=rr.data||[];db.cashClosings=ownerHistory?(cc.data||[]):[];db.salesReturns=sr.data||[];db.salesRefunds=sf.data||[];db.users=us.data||[];db.onlineCatalog=oc.data||[];db.onlineOrders=oo.data||[];db.onlineOrderItems=oi.data||[];db.cashOpenings=ownerHistory?(co.data||[]):[];db.cashWithdrawals=ownerHistory?(cw.data||[]):[];db.cashOperationalStatus=cashStatus.data||null;db.productionBatches=pb.data||[];db.assets=as.data||[];db.purchaseAssets=pa.data||[];db.stockAdjustments=sa.data||[];
  const al=await auditQuery;if(al.error){$('syncStatus').textContent='⚠ Audit gagal dimuat';return}db.auditLogs=al.data||[]
}
function pageAllowed(page){
  const access={
    dashboard:can('dashboard.view'),
    sales:canAny('sales.create','sales.view'),
    products:canAny('products.manage','materials.manage','recipes.manage','hpp.manage'),
    purchases:canAny('purchases.create','purchases.view','suppliers.manage','supplier_payments.create'),
    expenses:canAny('expenses.create','expenses.view'),
    stock:canAny('stock.view','stock.adjust','stock.opname','stock.mutations.view'),
    reports:canPrefix('reports.'),
    customers:can('customers.manage'),
    cashClosing:can('cash.closing'),
    cashWithdrawal:can('cash.withdrawal'),
    returns:canAny('returns.view','returns.create','refunds.create','sales.cancel'),
    users:canAny('users.manage','roles.manage'),
    settings:can('business.settings'),permissionSettings:profile?.role==='pemilik',marketplace:canAny('online_catalog.manage','online_customers.manage','online_orders.view','online_orders.process','online_orders.status'), audit:profile?.role==='pemilik'
  };
  return access[page]===true;
}
function buildNav(){
  const groups=[
    ['OPERASIONAL',[['dashboard','📊','Dashboard'],['sales','🧾','Penjualan'],['products','🍹','Produk & HPP'],['purchases','🛒','Pembelian'],['stock','📦','Stok Bahan'],['returns','↩️','Retur']]],
    ['KEUANGAN',[['expenses','💸','Pengeluaran'],['cashWithdrawal','💵','Penarikan/Setoran Kas'],['cashClosing','💰','Tutup Kas'],['reports','📈','Laporan']]],
    ['PELANGGAN & ONLINE',[['customers','👥','Pelanggan/Reseller'],['marketplace','🛍️','Marketplace']]],
    ['PENGELOLAAN',[['users','👤','Pengguna & Hak Akses'],['audit','🔐','Audit Buka Kembali Kas'],['settings','⚙️','Pengaturan'],['permissionSettings','🛡️','Perizinan & Hak Akses']]]
  ];
  if(!pageAllowed(currentPage))currentPage='dashboard';
  $('nav').innerHTML=groups.map(([label,items])=>{const allowed=items.filter(i=>pageAllowed(i[0]));return allowed.length?`<div class="nav-group"><div class="nav-group-label">${label}</div>${allowed.map(i=>`<button data-page="${i[0]}" class="${currentPage===i[0]?'active':''}">${i[1]} ${i[2]}</button>`).join('')}</div>`:''}).join('');
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{currentPage=b.dataset.page;buildNav();render();document.querySelector('.sidebar').classList.remove('open')})
}
function render(){const names={dashboard:'Dashboard',sales:'Penjualan',products:'Produk & HPP',expenses:'Pengeluaran',stock:'Stok Bahan',reports:'Laporan',customers:'Pelanggan/Reseller',cashWithdrawal:'Penarikan/Setoran Kas',settings:'Pengaturan',purchases:'Pembelian',cashClosing:'Tutup Kas',returns:'Retur',users:'Pengguna & Hak Akses',marketplace:'Marketplace',audit:'Audit Buka Kembali Kas',permissionSettings:'Perizinan & Hak Akses'};if(!pageAllowed(currentPage))currentPage='dashboard';$('title').textContent=names[currentPage];$('date').textContent=new Intl.DateTimeFormat('id-ID',{dateStyle:'full'}).format(new Date());({dashboard,sales,products,expenses,stock,reports,customers,cashWithdrawal,settings,purchases,cashClosing,returns,users,marketplace,audit,permissionSettings}[currentPage])($('content'))}
function isActiveSale(x){return String(x?.status||'Selesai').trim()!=='Dibatalkan'}
function activeSales(a){return (a||[]).filter(isActiveSale)}
function isActivePurchase(x){return String(x?.status||'Lunas').trim()!=='Dibatalkan'}
function activePurchases(a){return (a||[]).filter(isActivePurchase)}
function salePaidQty(x){const v=Number(x?.paid_qty);return Number.isFinite(v)&&v>=0?v:Number(x?.qty||0)}
function saleFreeQty(x){const v=Number(x?.free_qty);return Number.isFinite(v)&&v>=0?v:0}
function saleRevenue(x){return salePaidQty(x)*Number(x?.price||0)}
function saleHpp(x){
  const qty=Number(x?.qty||0);
  if(qty<=0)return 0;
  const stored=Number(x?.cost);
  if(Number.isFinite(stored)&&stored>0)return qty*stored;
  const product=db.products.find(p=>String(p.id)===String(x?.product_id||''));
  const fallback=product?productHpp(product):0;
  return qty*Math.max(0,Number(fallback)||0);
}
function saleGross(x){const g=Number(x?.gross_amount);return Number.isFinite(g)&&g>0?g:salePaidQty(x)*Number(x?.price||0)+Number(x?.discount_amount||0)}
function saleReturnedPaidQty(id){return (db.salesReturns||[]).filter(r=>r.sale_id===id).reduce((a,r)=>a+Number(r.paid_qty||0),0)}
function saleReturnedFreeQty(id){return (db.salesReturns||[]).filter(r=>r.sale_id===id).reduce((a,r)=>a+Number(r.free_qty||0),0)}
function saleReturnedQty(id){return saleReturnedPaidQty(id)+saleReturnedFreeQty(id)}
function saleNetRevenue(x){return Math.max(0,saleRevenue(x)-saleReturnedPaidQty(x.id)*Number(x?.price||0))}
function saleNetHpp(x){return Math.max(0,saleHpp(x)-saleReturnedQty(x.id)*Number(x?.cost||0))}
function returnValueInPeriod(from,to){return (db.salesReturns||[]).filter(r=>String(r.return_date||'')>=String(from||'')&&String(r.return_date||'')<=String(to||'')).reduce((a,r)=>a+Number(r.return_value||0),0)}
function returnHppInPeriod(from,to){return (db.salesReturns||[]).filter(r=>String(r.return_date||'')>=String(from||'')&&String(r.return_date||'')<=String(to||'')).reduce((a,r)=>a+Number(r.hpp_value||0),0)}
function totals(a,from,to){const rows=activeSales(a);const f=from||rows.map(x=>x.sale_date).sort()[0]||today(),t=to||rows.map(x=>x.sale_date).sort().slice(-1)[0]||f;return {omzet:rows.reduce((s,x)=>s+saleRevenue(x),0)-returnValueInPeriod(f,t),hpp:rows.reduce((s,x)=>s+saleHpp(x),0)-returnHppInPeriod(f,t)}}
function dashboard(c){const d=today(),s=activeSales(db.sales.filter(x=>x.sale_date===d)),e=db.expenses.filter(x=>x.expense_date===d),t=totals(s,d,d),out=e.reduce((s,x)=>s+Number(x.amount),0),programCost=fridayProgramCostForSales(s),outWithProgram=out+programCost;c.innerHTML=`<div class="grid"><div class="card metric"><small>Omzet Hari Ini</small><strong class="green">${rup(t.omzet)}</strong><span>${s.reduce((a,x)=>a+Number(x.qty),0)} item</span></div><div class="card metric"><small>HPP Terjual</small><strong>${rup(t.hpp)}</strong></div><div class="card metric"><small>Pengeluaran</small><strong class="red">${rup(out)}</strong></div><div class="card metric"><small>Laba Bersih</small><strong class="blue">${rup(t.omzet-t.hpp-outWithProgram)}</strong></div></div><div class="section grid2"><div class="card"><div class="cardhead"><h2>Penjualan Terbaru</h2><button class="btn small" onclick="currentPage='sales';buildNav();render()">Lihat</button></div>${salesTable(s.slice(0,8))}</div><div class="card"><h2>${esc(business.name)}</h2><p>${esc(business.address||'')}</p><p>WhatsApp: ${esc(business.wa||'-')}</p><p>Kode kasir: <b>${esc(business.join_code||'-')}</b></p><div class="quick"><div><b>${db.products.filter(x=>x.active).length}</b><span>Produk aktif</span></div><div><b>${db.stock.length}</b><span>Bahan</span></div><div><b>${db.sales.length}</b><span>Transaksi</span></div></div></div></div>`}
function saleDefaultDate(){
  const todayDate=today();
  if(profile?.role==='pemilik'){
    try{
      const testDate=sessionStorage.getItem('ceof_future_cash_test_date')||'';
      if(testDate>todayDate){
        const opened=(db.cashOpenings||[]).find(x=>String(x.opening_date)===testDate);
        const closed=(db.cashClosings||[]).some(x=>String(x.closing_date)===testDate);
        if(opened&&!closed)return testDate;
      }
    }catch(e){}
  }
  return todayDate;
}
function productImageUrl(p, catalogRow=null){
  const linkedCatalog=catalogRow||(db.onlineCatalog||[]).find(x=>String(x.product_id)===String(p?.id)&&x.active!==false);
  const raw=String(linkedCatalog?.image_url||p?.image_url||p?.photo_url||p?.image||p?.photo||'').trim();
  if(/^https:\/\//i.test(raw)||/^http:\/\//i.test(raw)||/^data:image\//i.test(raw)) return raw;
  return '';
}
function productAvailableStock(p){
  if(!p)return null;
  for(const key of ['available_stock','stock_qty','current_stock','finished_stock','qty_stock']){
    const v=p[key]; if(v!==undefined&&v!==null&&v!=='')return Math.max(0,Number(v)||0);
  }
  const batches=(db.productionBatches||[]).filter(x=>String(x.product_id)===String(p.id));
  const sales=(db.sales||[]).filter(x=>String(x.product_id||'')===String(p.id));
  if(batches.length && sales.every(x=>x.product_id)){
    const produced=batches.reduce((n,x)=>n+Number(x.good_qty||0),0);
    const sold=sales.filter(x=>!['dibatalkan','cancelled','batal'].includes(String(x.status||'').toLowerCase())).reduce((n,x)=>n+Number(x.qty||x.quantity||0),0);
    return Math.max(0,produced-sold);
  }
  return null;
}
function productCardImage(p,catalogRow=null){
  const src=productImageUrl(p,catalogRow);
  return src?`<img class="product-card-image" src="${esc(src)}" alt="${esc(catalogRow?.online_name||p?.name||'Produk')}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">` : '';
}
function productStockLabel(p){const n=productAvailableStock(p);return n===null?'<span class="stock-unknown">Stok perlu dikonfirmasi</span>':n>0?`<span class="stock-available">Tersedia ${fmtNum(n)} unit</span>`:'<span class="stock-empty">Stok habis</span>'}
function chooseSaleCardProduct(id){const sel=$('sProd');if(!sel)return;sel.value=String(id);updateSalePrice();$('sQty')?.focus();document.getElementById('saleProductCards')?.querySelectorAll('[data-product-card]').forEach(el=>el.classList.toggle('selected',el.dataset.productCard===String(id)));}
function addSaleCardToCart(id){chooseSaleCardProduct(id);const qtyEl=$(`saleCardQty_${id}`);const qty=Math.max(1,Math.floor(Number(qtyEl?.value)||1));if($('sQty'))$('sQty').value=qty;updateSalePricing();addToCartAdvanced();}
function renderSaleProductCards(){
  const host=$('saleProductCards');if(!host)return;
  const q=String($('sSearch')?.value||'').trim().toLowerCase();
  const mode=$('sMode')?.value||'Normal';
  const list=db.products.filter(p=>p.active&&(!q||String(p.name||'').toLowerCase().includes(q)||String(p.sku||'').toLowerCase().includes(q))&&(mode!=='Reseller'||!!resellerRule(p.id))&&(mode!=='Promo'||!!fridayPromoConfig(p.name))).sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
  host.innerHTML=list.map(p=>{const stock=productAvailableStock(p),src=productImageUrl(p);return `<article class="product-card" data-product-card="${p.id}" onclick="chooseSaleCardProduct('${p.id}')"><div class="product-image-wrap">${src?productCardImage(p):''}<div class="product-image-placeholder" ${src?'style="display:none"':''}>🥤<small>Foto produk</small></div></div><div class="product-card-body"><b>${esc(p.name)}</b><div class="product-card-price">${rup(p.price)}</div><div class="product-card-stock">${productStockLabel(p)}</div><div class="product-card-controls" onclick="event.stopPropagation()"><label class="qty-label">Jumlah<input id="saleCardQty_${p.id}" type="number" min="1" step="1" value="1" aria-label="Jumlah ${esc(p.name)}"></label><button type="button" class="btn small" onclick="addSaleCardToCart('${p.id}')">＋ Keranjang</button></div></div></article>`}).join('')||'<div class="empty">Produk tidak ditemukan.</div>';
}
function sales(c){
  const active=[...db.products.filter(x=>x.active)].sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
  const opts=active.map(p=>`<option value="${p.id}">${esc(p.name)} — ${rup(p.price)}</option>`).join('');
  const first=active[0]?.price||0;
  window.saleCart=[];window.saleSaveInProgress=false;
  const custOpts=[`<option value="">Umum / tanpa pelanggan</option>`,...db.customers.filter(x=>x.is_active!==false).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'id',{sensitivity:'base'})).map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.customer_type||'Umum')}</option>`)].join('');
  c.innerHTML=`<div class="card form">
    <div><label>Tanggal<input id="sDate" type="date" value="${saleDefaultDate()}" onchange="updateSalePricing();updateFridayPromoUI()" ${['pemilik','supervisor'].includes(profile.role)?'':'readonly'}></label><small class="hint">${['pemilik','supervisor'].includes(profile.role)?'Pemilik/Supervisor dapat memilih tanggal sesuai kewenangan.':'Tanggal mengikuti hari berjalan dan tidak dapat diubah Kasir.'}</small></div>
    <div><label>Pelanggan / Reseller<select id="sCustomer" onchange="customerChanged()">${custOpts}</select></label><small id="customerHint" class="hint">Pilih pelanggan/reseller jika transaksi ingin dicatat atas nama pelanggan.</small></div>
    <div><label>Cari produk<input id="sSearch" type="search" placeholder="🔍 Ketik nama produk..." oninput="filterSaleProducts()" autocomplete="off"></label></div>
    <div><label>Produk<select id="sProd" size="1" onchange="updateSalePrice()">${opts}</select></label><small class="hint">Daftar otomatis urut A–Z.</small></div>
    <div><label>Jenis penjualan<select id="sMode" onchange="saleModeChanged()"><option value="Normal">Normal</option><option value="Reseller">Reseller</option><option value="Diskon">Diskon / Potongan</option><option value="Promo">Jumat Berkah</option></select></label></div>
    <div><label>Jumlah dibayar<input id="sQty" type="number" min="1" value="1" oninput="updateSalePricing()"></label></div>
    <div><label>Harga normal / unit<input id="sBasePrice" type="number" min="0" value="${first}" readonly></label></div>
    <div><label>Harga jual / unit setelah potongan<input id="sPrice" type="number" min="0" value="${first}" oninput="updateSalePricing()"></label></div>
    <div id="discountFields" class="hidden"><label>Jenis potongan<select id="sDiscountType" onchange="updateSalePricing()"><option value="Rp">Rupiah</option><option value="%">Persen (%)</option></select></label><label>Potongan<input id="sDiscount" type="number" min="0" value="0" oninput="updateSalePricing()"></label><small id="discountHint" class="hint">Potongan akan dihitung dari harga normal.</small></div>
    <div id="freeFields" class="hidden"><label>Jumlah sedekah<input id="sFreeQty" type="number" min="0" value="0" readonly></label><div id="fridayPromoInfo"></div></div>
    <div id="promoNameField" class="hidden"><label>Program<input id="sPromoName" value="Jumat Berkah" readonly></label></div>
    <div id="saleSummary" class="full"></div>
    <div class="full"><button class="btn secondary" onclick="addToCartAdvanced()">＋ Tambah ke Keranjang</button></div>
  </div>
  <div class="section card"><div class="cardhead"><h2>Katalog Produk</h2><small class="muted">Pilih produk, lihat harga dan ketersediaan, lalu tentukan jumlah.</small></div><div id="saleProductCards" class="product-card-grid"></div></div>
  <div class="section card"><div class="cardhead"><h2>Keranjang Penjualan</h2><button class="btn small secondary" onclick="clearSaleCart()">Kosongkan</button></div><div id="saleCart"></div></div>
  <div class="section card form">
    <div><label>Pembayaran<select id="sPay" onchange="toggleCashPayment()"><option>Tunai</option><option>QRIS</option><option>Transfer</option><option>Piutang</option></select></label></div>
    <div id="cashFields"><label>Uang diterima<input id="sCash" type="number" min="0" placeholder="Contoh: 20000" oninput="updateChange()"></label><small id="sChange" class="changeBox">Kembalian: Rp0</small></div>
    <div class="full"><button class="btn" onclick="checkoutSaleCart()">💾 Simpan Transaksi</button></div>
  </div>
  <div class="section card"><div class="cardhead"><h2>Riwayat Penjualan</h2></div>${salesTable(db.sales)}</div><div id="returnBox"></div><div id="receivablePaymentBox"></div><div class="section card"><div class="cardhead"><h2>Piutang Penjualan</h2></div>${receivableTable()}</div><div class="section card"><div class="cardhead"><h2>Riwayat Pembayaran Piutang</h2></div>${receivablePaymentHistory()}</div>`;
  updateSaleTotal(); toggleCashPayment(); renderSaleCart(); saleModeChanged(); renderSaleProductCards();
}
function selectedCustomer(){return db.customers.find(x=>String(x.id)==String($('sCustomer')?.value||''))||null}
function resellerRule(productId){
  const pid=String(productId||'');
  return db.resellerPrices.find(x=>String(x.product_id||'')===pid && x.active!==false)||null;
}
function refreshSaleProductOptions(){
  const sel=$('sProd');
  if(!sel)return;
  const mode=$('sMode')?.value||'Normal';
  const current=String(sel.value||'');
  const selectedDate=$('sDate')?.value||today();
  const fridayMode=isFriday(selectedDate);
  const products=[...db.products.filter(x=>x.active && (mode!=='Reseller' || !!resellerRule(x.id) || (fridayMode && !!fridayPromoConfig(x.name))) && (mode!=='Promo' || !!fridayPromoConfig(x.name)))]
    .sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
  sel.innerHTML=products.map(p=>`<option value="${p.id}">${esc(p.name)} — ${rup(p.price)}</option>`).join('');
  if(products.some(p=>String(p.id)===current)) sel.value=current;
  else if(products[0]) sel.value=products[0].id;
  else sel.value='';
  updateSalePrice();
  if(mode==='Reseller' && !products.length && $('customerHint')){
    $('customerHint').textContent='Belum ada produk dengan harga reseller yang diatur untuk dijual kepada reseller.';
  }
}
function resellerEligible(customer,productId,qty){
  if(!customer)return false;
  const type=String(customer.customer_type||'').trim().toLowerCase();
  if(!['reseller','reseller tetap'].includes(type))return false;
  const r=resellerRule(productId);
  if(!r)return false;
  if(type==='reseller tetap')return true;
  return Number(qty||0)>=Number(r.min_qty||100);
}
function customerChanged(){
  const customer=selectedCustomer(), mode=$('sMode')?.value||'Normal';
  const type=String(customer?.customer_type||'').trim().toLowerCase();
  if($('customerHint')){
    if(!customer){$('customerHint').textContent='Umum / tanpa pelanggan menggunakan harga normal.'}
    else if(type==='reseller tetap')$('customerHint').textContent='Reseller Tetap: harga reseller berlaku walaupun pembelian di bawah 100 pcs.';
    else if(type==='reseller')$('customerHint').textContent='Reseller: harga reseller berlaku jika jumlah pembelian produk mencapai minimal sesuai pengaturan (default 100 pcs).';
    else $('customerHint').textContent='Pelanggan umum menggunakan harga normal.';
  }
  if(mode==='Reseller' || !['Diskon','Promo'].includes(mode)){
    if(customer && ['reseller','reseller tetap'].includes(type)) $('sMode').value='Reseller';
    else $('sMode').value='Normal';
  }
  refreshSaleProductOptions();
}
function filterSaleProducts(){const q=($('sSearch')?.value||'').trim().toLowerCase();const sel=$('sProd');if(sel){const current=sel.value;[...sel.options].forEach(o=>o.hidden=!!q&&!o.textContent.toLowerCase().includes(q));const visible=[...sel.options].find(o=>!o.hidden);if(visible){if(![...sel.options].some(o=>o.value===current&&!o.hidden))sel.value=visible.value;updateSalePrice()}}renderSaleProductCards()}
function removeFromCart(i){window.saleCart.splice(i,1);renderSaleCart()}
function clearSaleCart(){window.saleCart=[];renderSaleCart()}
function cartTotal(){return window.saleCart.reduce((a,x)=>a+Number(x.paid_qty||x.qty)*Number(x.price),0)}
function renderSaleCart(){const wrap=$('saleCart');if(!wrap)return;if(!window.saleCart.length){wrap.innerHTML='<div class="empty">Keranjang masih kosong. Tambahkan produk terlebih dahulu.</div>';updateChange();updateFridayPromoUI();return}wrap.innerHTML=`<div class="tablewrap"><table class="table"><thead><tr><th>Produk</th><th>Pelanggan</th><th>Dibayar</th><th>Sedekah</th><th>Harga</th><th>Potongan</th><th>Subtotal</th><th></th></tr></thead><tbody>${window.saleCart.map((x,i)=>`<tr><td>${esc(x.product_name)}${x.promo_name?`<br><small class="muted">${esc(x.promo_name)}</small>`:''}</td><td>${esc(x.customer_name||'Umum')}</td><td>${x.paid_qty}</td><td>${x.free_qty||0}</td><td>${rup(x.price)}</td><td>${rup(x.discount_amount)}</td><td>${rup(x.paid_qty*x.price)}</td><td><button class="link danger" onclick="removeFromCart(${i})">Hapus</button></td></tr>`).join('')}</tbody></table></div><div class="cartTotal"><b>TOTAL DIBAYAR</b><strong>${rup(cartTotal())}</strong><br><small class="muted">Total unit keluar: ${window.saleCart.reduce((a,x)=>a+x.qty,0)}</small></div>`;updateChange();updateFridayPromoUI()}
function updateSaleTotal(){updateChange()}
function toggleCashPayment(){const cash=$('sPay')?.value==='Tunai';const wrap=$('cashFields');if(wrap)wrap.classList.toggle('hidden',!cash);if(!cash&&$('sChange'))$('sChange').textContent='Kembalian: Rp0';if(cash)updateChange()}
function updateChange(){if(!$('sPay')||!$('sChange'))return;const total=cartTotal();if($('sPay').value!=='Tunai'){$('sChange').textContent='Kembalian: Rp0';$('sChange').classList.remove('short');return}const cash=Math.max(0,Number($('sCash')?.value)||0),diff=cash-total;if(diff>=0){$('sChange').textContent=`Kembalian: ${rup(diff)}`;$('sChange').classList.remove('short')}else{$('sChange').textContent=`Uang kurang: ${rup(Math.abs(diff))}`;$('sChange').classList.add('short')}}
async function checkoutSaleCart(){if(!requirePermission('sales.create','membuat transaksi penjualan'))return;
  if(window.saleSaveInProgress)return;
  if(!window.saleCart.length)return alert('Keranjang masih kosong.');
  const date=$('sDate').value,payment=$('sPay').value,total=cartTotal();
  if(!['pemilik','supervisor'].includes(profile.role) && date!==today())return alert('Kasir hanya dapat mencatat transaksi pada hari berjalan.');
  if(profile?.role==='pemilik'){
    try{
      const testDate=sessionStorage.getItem('ceof_future_cash_test_date')||'';
      if(testDate>today() && date!==testDate)return alert(`Tanggal transaksi ${date} tidak sesuai dengan kas pengujian aktif ${testDate}. Pilih tanggal ${testDate} sebelum menyimpan.`);
    }catch(e){}
  }
  if(!assertCashOpen(date))return;
  let cashReceived=null,changeAmount=0;
  if(payment==='Tunai'){
    cashReceived=Math.max(0,Number($('sCash').value)||0);
    if(cashReceived<total)return alert(`Uang diterima kurang ${rup(total-cashReceived)}.`);
    changeAmount=cashReceived-total;
  }
  window.saleSaveInProgress=true;
  const buttons=[...document.querySelectorAll('button[onclick="checkoutSaleCart()"]')];
  buttons.forEach(b=>{b.disabled=true;b.dataset.oldText=b.textContent;b.textContent='⏳ Menyimpan...'});
  try{
    const items=[...window.saleCart];
    for(let i=0;i<items.length;i++){
      const item=items[i];
      const {error}=await sb.rpc('record_sale_with_stock_v3',{
        p_business_id:profile.business_id,
        p_product_id:item.product_id,
        p_product_name:item.product_name,
        p_sale_date:date,
        p_qty:item.qty,
        p_paid_qty:item.paid_qty,
        p_free_qty:item.free_qty,
        p_price:item.price,
        p_cost:item.cost,
        p_gross_amount:item.gross_amount,
        p_discount_amount:item.discount_amount,
        p_sale_mode:item.sale_mode,
        p_promo_name:item.promo_name||'',
        p_payment:payment,
        p_user_id:session.user.id,
        p_cash_received:i===0?cashReceived:null,
        p_change_amount:i===0?changeAmount:0,
        p_customer_id:item.customer_id||null
      });
      if(error)throw new Error(`Gagal menyimpan ${item.product_name}: ${error.message}`);
    }
    window.saleCart=[];
    await loadAll();
    render();
    alert('Transaksi berhasil disimpan.');
  }catch(error){
    alert(error?.message||'Gagal menyimpan transaksi.');
    await loadAll();
    render();
  }finally{
    window.saleSaveInProgress=false;
    buttons.forEach(b=>{b.disabled=false;if(b.dataset.oldText)b.textContent=b.dataset.oldText;});
  }
}

function receivablePaymentHistory(){
  const rows=[...db.receivablePayments].sort((a,b)=>String(b.payment_date||'').localeCompare(String(a.payment_date||'')));
  if(!rows.length)return '<div class="empty">Belum ada pembayaran piutang.</div>';
  return `<div class="tablewrap"><table class="table"><thead><tr><th>Tanggal & Jam</th><th>Produk</th><th>Nominal</th><th>Metode</th><th>Keterangan</th></tr></thead><tbody>${rows.map(p=>{const sale=db.sales.find(s=>s.id===p.sale_id);return `<tr><td><b>${esc(dateTimeWib(p.created_at,p.payment_date))}</b></td><td>${esc(sale?.product_name||'-')}</td><td>${rup(p.amount)}</td><td>${esc(p.payment_method||'-')}</td><td>${esc(p.note||'-')}</td></tr>`}).join('')}</tbody></table></div>`;
}
function receivableTable(){
  const rows=receivableRows();
  if(!rows.length)return '<div class="empty">Tidak ada piutang penjualan yang belum lunas.</div>';
  return `<div class="tablewrap"><table class="table"><thead><tr><th>Tanggal</th><th>Produk</th><th>Total</th><th>Sudah Dibayar</th><th>Sisa</th><th>Aksi</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.sale_date)}</td><td>${esc(x.product_name)}</td><td>${rup(x.total)}</td><td>${rup(x.paid)}</td><td><b>${rup(x.remaining)}</b></td><td>${can('receivables.payment')?`<button class="link" onclick="openReceivablePayment('${x.id}')">Bayar</button>`:'-'}</td></tr>`).join('')}</tbody></table></div>`;
}
function receivableRows(){
  return activeSales(db.sales).map(x=>{
    if(String(x.payment||'').trim()!=='Piutang') return null;
    const total=saleRevenue(x);
    const paid=db.receivablePayments.filter(p=>p.sale_id===x.id).reduce((a,p)=>a+Number(p.amount||0),0);
    const remaining=Math.max(0,total-paid);
    return {...x,total,paid,remaining};
  }).filter(x=>x&&x.remaining>0);
}
function openReceivablePayment(id){
  if(!requirePermission('receivables.payment','membayar piutang penjualan'))return;
  window.receivablePaymentId=id;
  const sale=db.sales.find(x=>x.id===id);
  if(!sale)return;
  const total=saleRevenue(sale);
  const paid=db.receivablePayments.filter(x=>x.sale_id===id).reduce((a,x)=>a+Number(x.amount||0),0);
  const remaining=Math.max(0,total-paid);
  const el=document.getElementById('receivablePaymentBox');
  if(!el)return;
  el.innerHTML=`<div class="card"><h2>Bayar Piutang Penjualan</h2><p class="muted">${esc(sale.product_name)} — Total ${rup(total)} — Sisa ${rup(remaining)}</p><div class="form"><div><label>Nominal pembayaran<input id="rpAmount" type="number" min="1" step="1" value="${remaining}"></label><small class="hint">Sisa piutang: ${rup(remaining)}</small></div><div><label>Tanggal<input id="rpDate" type="date" value="${today()}"></label></div><div><label>Metode<select id="rpMethod"><option>Tunai</option><option>Transfer</option><option>QRIS</option></select></label></div><div><label>Keterangan<input id="rpNote" placeholder="Contoh: pembayaran piutang ${esc(sale.product_name)}"></label></div><div class="full"><button class="btn" onclick="paySalesReceivable()">💳 Simpan Pembayaran Piutang</button> <button class="btn secondary" onclick="cancelReceivablePayment()">Batal</button></div></div></div>`;
  el.scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelReceivablePayment(){const el=document.getElementById('receivablePaymentBox');if(el)el.innerHTML='';window.receivablePaymentId=null}
async function paySalesReceivable(){
  const id=window.receivablePaymentId;if(!id)return;
  const amount=Number(document.getElementById('rpAmount')?.value)||0;
  const date=document.getElementById('rpDate')?.value;
  const method=document.getElementById('rpMethod')?.value;
  const note=document.getElementById('rpNote')?.value.trim()||'';
  if(amount<=0)return alert('Nominal pembayaran harus lebih dari 0.');
  if(!assertCashOpen(date))return;
  const {data,error}=await sb.rpc('pay_sales_receivable',{p_business_id:profile.business_id,p_sale_id:id,p_payment_date:date,p_amount:amount,p_payment_method:method,p_note:note});
  if(error)return alert(error.message);
  alert(`Pembayaran piutang tersimpan. Sisa piutang ${rup(data?.remaining||0)}.`);
  window.receivablePaymentId=null;await loadAll();render();
}
function saleDateTime(x){const saleDate=String(x?.sale_date||'').trim();let dateLabel=saleDate;if(/^\d{4}-\d{2}-\d{2}$/.test(saleDate)){const [y,m,d]=saleDate.split('-');dateLabel=`${d}/${m}/${y}`;}if(x?.created_at){const d=new Date(x.created_at);if(!Number.isNaN(d.getTime())){const timeLabel=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);return `${dateLabel||new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric'}).format(d)} ${timeLabel}`;}}return dateLabel||'-'}
function dateTimeWib(value,fallback='-'){if(value){const d=new Date(value);if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(',', '');}return fallback||'-'}
function salesTable(a){if(!a.length)return '<div class="empty">Belum ada penjualan.</div>';return `<div class="tablewrap"><table class="table"><thead><tr><th>Tanggal & Jam</th><th>Produk</th><th>Pelanggan</th><th>Qty</th><th>Sedekah</th><th>Total</th><th>Bayar</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${a.map(x=>{const cancelled=!isActiveSale(x),customer=x.customer_id?db.customers.find(c=>c.id===x.customer_id):null;const promoNote=String(x.promo_name||'').trim();const modeNote=!promoNote&&String(x.sale_mode||'')==='Reseller'?'Harga Reseller':!promoNote&&String(x.sale_mode||'')==='Diskon'?'Diskon / Potongan':'';return `<tr class="${cancelled?'muted':''}"><td><b>${esc(saleDateTime(x))}</b></td><td>${esc(x.product_name)}</td><td>${esc(customer?.name||'Umum')}</td><td>${salePaidQty(x)}</td><td>${saleFreeQty(x)}</td><td>${rup(saleRevenue(x))}${promoNote?`<br><small class="muted">${esc(promoNote)}</small>`:''}${modeNote?`<br><small class="muted">${esc(modeNote)}</small>`:''}${saleReturnedQty(x.id)>0?`<br><small class="warn">Retur ${fmtNum(saleReturnedQty(x.id))} · -${rup(saleReturnedPaidQty(x.id)*Number(x.price||0))}</small>`:''}${Number(x.discount_amount||0)>0?`<br><small class="muted">Diskon ${rup(x.discount_amount)}</small>`:''}</td><td>${esc(x.payment)}</td><td>${cancelled?'<span class="warn">Dibatalkan</span>':'<span class="ok">Selesai</span>'}</td><td>${cancelled?'-':`${can('sales.receipt')?`<button class="link" onclick="printSaleReceipt('${x.id}')">🖨️ Struk</button>`:''} ${canAny('returns.create','sales.cancel')?`<button class="link" onclick="openReturn('${x.id}')">Retur</button>`:''} ${can('sales.cancel')?`<button class="link danger" onclick="cancelSale('${x.id}')">Batalkan</button>`:''}`}</td></tr>`}).join('')}</tbody></table></div>`}
async function cancelSale(id){
  if(!requirePermission('sales.cancel','membatalkan transaksi'))return;
  const sale=db.sales.find(x=>x.id===id);
  if(!sale)return alert('Transaksi tidak ditemukan.');
  if(!isActiveSale(sale))return alert('Transaksi ini sudah dibatalkan.');
  const reason=prompt(`Batalkan penjualan ${sale.product_name} x ${sale.qty}?\n\nAlasan pembatalan (boleh dikosongkan):`,'');
  if(reason===null)return;
  if(!confirm(`Yakin membatalkan transaksi ${sale.product_name} sebesar ${rup(saleRevenue(sale))}?\n\nStok akan dikembalikan otomatis dan transaksi tetap tersimpan sebagai Dibatalkan.`))return;
  const {data,error}=await sb.rpc('cancel_sale',{p_business_id:profile.business_id,p_sale_id:id,p_reason:reason.trim()});
  if(error)return alert(error.message);
  alert('Penjualan dibatalkan. Stok dikembalikan otomatis.');
  await loadAll();render();
}
function openReturn(id){
  if(!requireAnyPermission(['returns.create','sales.cancel'],'memproses retur'))return;
  const sale=db.sales.find(x=>x.id===id);if(!sale)return alert('Transaksi tidak ditemukan.');
  if(!isActiveSale(sale))return alert('Transaksi yang sudah dibatalkan tidak dapat diretur.');
  const paidLeft=Math.max(0,salePaidQty(sale)-saleReturnedPaidQty(id)),freeLeft=Math.max(0,saleFreeQty(sale)-saleReturnedFreeQty(id));
  const el=document.getElementById('returnBox');if(!el)return;
  el.innerHTML=`<div class="card"><h2>Retur Penjualan</h2><p><b>${esc(sale.product_name)}</b> · Transaksi ${esc(saleDateTime(sale))}</p><p class="muted">Sisa dapat diretur: ${fmtNum(paidLeft)} pcs berbayar + ${fmtNum(freeLeft)} pcs gratis/sedekah.</p><div class="form"><div><label>Tanggal Retur<input id="retDate" type="date" value="${today()}"></label></div><div><label>Qty berbayar<input id="retPaidQty" type="number" min="0" max="${paidLeft}" value="${paidLeft}"></label></div><div><label>Qty gratis/sedekah<input id="retFreeQty" type="number" min="0" max="${freeLeft}" value="0"></label></div><div><label>Alasan retur<input id="retReason" placeholder="Contoh: barang rusak / salah pesanan"></label></div><div class="full"><div class="hint">Nilai penjualan yang dikurangi: <b id="retValuePreview">${rup(paidLeft*Number(sale.price||0))}</b>. Uang belum dikembalikan pada tahap ini.</div><button class="btn" onclick="saveReturn('${id}')">↩️ Simpan Retur</button> <button class="btn secondary" onclick="closeReturn()">Batal</button></div></div></div>`;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  ['retPaidQty','retFreeQty'].forEach(k=>$(k)?.addEventListener('input',()=>{$('retValuePreview').textContent=rup((Number($('retPaidQty').value)||0)*Number(sale.price||0))}));
}
function closeReturn(){const el=document.getElementById('returnBox');if(el)el.innerHTML=''}
async function saveReturn(id){
  const paid=Math.max(0,Number($('retPaidQty')?.value)||0),free=Math.max(0,Number($('retFreeQty')?.value)||0),date=$('retDate')?.value||today(),reason=$('retReason')?.value.trim()||'';
  if(paid+free<=0)return alert('Jumlah retur harus lebih dari 0.');
  if(!reason)return alert('Alasan retur wajib diisi.');
  if(!assertCashOpen(date))return;
  const {data,error}=await sb.rpc('record_sales_return',{p_business_id:profile.business_id,p_sale_id:id,p_return_date:date,p_paid_qty:paid,p_free_qty:free,p_reason:reason});
  if(error)return alert(`Retur gagal disimpan: ${error.message}`);
  alert(`Retur berhasil. Stok dikembalikan ${fmtNum(paid+free)} pcs. Nilai penjualan berkurang ${rup(data?.return_value||0)}. Pengembalian uang belum diproses.`);
  closeReturn();await loadAll();render();
}
function returnRefundedAmount(returnId){return (db.salesRefunds||[]).filter(x=>x.sales_return_id===returnId).reduce((a,x)=>a+Number(x.amount||0),0)}
function returnRefundRemaining(r){return Math.max(0,Number(r.return_value||0)-returnRefundedAmount(r.id))}
function originalSaleReceivedForRefund(sale){
  if(!sale)return 0;
  if(String(sale.payment||'').trim()==='Piutang')return db.receivablePayments.filter(x=>x.sale_id===sale.id).reduce((a,x)=>a+Number(x.amount||0),0);
  return saleRevenue(sale);
}
function openRefund(returnId){
  if(!requireAnyPermission(['refunds.create','sales.cancel'],'memproses pengembalian uang'))return;
  const r=(db.salesReturns||[]).find(x=>x.id===returnId);if(!r)return alert('Data retur tidak ditemukan.');
  const sale=db.sales.find(x=>x.id===r.sale_id);if(!sale)return alert('Transaksi asal tidak ditemukan.');
  const remaining=returnRefundRemaining(r), received=originalSaleReceivedForRefund(sale);
  const alreadyRefundedForSale=(db.salesRefunds||[]).filter(x=>x.sale_id===sale.id).reduce((a,x)=>a+Number(x.amount||0),0);
  const availableReceived=Math.max(0,received-alreadyRefundedForSale);
  const max=Math.min(remaining,availableReceived);
  if(max<=0)return alert('Tidak ada uang yang dapat dikembalikan. Pastikan transaksi sudah dibayar/lunas dan belum pernah dikembalikan.');
  const el=document.getElementById('returnBox');if(!el)return;
  const defaultMethod=['Tunai','QRIS','Transfer'].includes(String(sale.payment||''))?sale.payment:'Tunai';
  el.innerHTML=`<div class="card"><h2>Pengembalian Uang Pelanggan</h2><p><b>${esc(sale.product_name)}</b> · Retur ${esc(r.return_date)}</p><p class="muted">Nilai retur: <b>${rup(r.return_value)}</b> · Sudah dikembalikan: <b>${rup(returnRefundedAmount(r.id))}</b> · Sisa: <b>${rup(remaining)}</b></p><p class="muted">Uang yang benar-benar sudah diterima dari transaksi ini tersedia sampai <b>${rup(availableReceived)}</b>.</p><div class="form"><div><label>Tanggal Pengembalian<input id="refundDate" type="date" value="${today()}"></label></div><div><label>Nominal Pengembalian<input id="refundAmount" type="number" min="1" max="${max}" value="${max}"></label></div><div><label>Metode Pengembalian<select id="refundMethod"><option value="Tunai" ${defaultMethod==='Tunai'?'selected':''}>Tunai</option><option value="QRIS" ${defaultMethod==='QRIS'?'selected':''}>QRIS</option><option value="Transfer" ${defaultMethod==='Transfer'?'selected':''}>Transfer</option></select></label></div><div><label>Keterangan<input id="refundNote" placeholder="Contoh: pengembalian uang retur"></label></div><div class="full"><div class="hint">Pengembalian uang akan dicatat sebagai <b>kas keluar</b> sesuai metode. Jika Tunai, akan memengaruhi Tutup Kas.</div><button class="btn" onclick="saveRefund('${returnId}')">💸 Proses Pengembalian</button> <button class="btn secondary" onclick="closeReturn()">Batal</button></div></div></div>`;
  el.scrollIntoView({behavior:'smooth',block:'center'});
}
async function saveRefund(returnId){
  if(!requireAnyPermission(['refunds.create','sales.cancel'],'memproses pengembalian uang'))return;
  const date=$('refundDate')?.value||today(),amount=Math.max(0,Number($('refundAmount')?.value)||0),method=$('refundMethod')?.value||'Tunai',note=$('refundNote')?.value.trim()||'';
  if(amount<=0)return alert('Nominal pengembalian harus lebih dari 0.');
  if(!assertCashOpen(date))return;
  const {data,error}=await sb.rpc('record_sales_refund',{p_business_id:profile.business_id,p_sales_return_id:returnId,p_refund_date:date,p_amount:amount,p_payment_method:method,p_note:note});
  if(error)return alert(`Pengembalian uang gagal: ${error.message}`);
  alert(`Pengembalian uang berhasil ${rup(data?.amount||amount)} melalui ${method}.`);
  closeReturn();await loadAll();render();
}
function returns(c){
  const rows=[...(db.salesReturns||[])].sort((a,b)=>String(b.return_date||'').localeCompare(String(a.return_date||'')));
  c.innerHTML=`<div class="section card"><h2>Retur Penjualan</h2><p class="muted">Retur mengembalikan barang ke stok dan mengurangi omzet/HPP. Pengembalian uang pelanggan diproses dari tombol pada kolom Status Uang.</p><div class="tablewrap"><table class="table"><thead><tr><th>Tanggal & Jam</th><th>Produk</th><th>Qty Berbayar</th><th>Qty Gratis</th><th>Nilai Retur</th><th>HPP</th><th>Alasan</th><th>Status Uang</th><th>Aksi</th></tr></thead><tbody>${rows.map(r=>{const sale=db.sales.find(s=>s.id===r.sale_id),remaining=returnRefundRemaining(r),status=r.refund_status||'Belum Dikembalikan';return `<tr><td><b>${esc(dateTimeWib(r.created_at,r.return_date))}</b></td><td>${esc(sale?.product_name||'-')}</td><td>${fmtNum(r.paid_qty)}</td><td>${fmtNum(r.free_qty)}</td><td>${rup(r.return_value)}</td><td>${rup(r.hpp_value)}</td><td>${esc(r.reason||'-')}</td><td>${esc(status)}${returnRefundedAmount(r.id)>0?`<br><small class="muted">Dikembalikan ${rup(returnRefundedAmount(r.id))}</small>`:''}</td><td>${remaining>0&&canAny('refunds.create','sales.cancel')?`<button class="link" onclick="openRefund('${r.id}')">💸 Kembalikan Uang</button>`:'-'}</td></tr>`}).join('')||'<tr><td colspan="9" class="empty">Belum ada retur.</td></tr>'}</tbody></table></div></div>`;
  const refunds=[...(db.salesRefunds||[])].sort((a,b)=>String(b.refund_date||'').localeCompare(String(a.refund_date||'')));
  c.innerHTML+=`<div id="returnBox"></div><div class="section card"><h2>Riwayat Pengembalian Uang</h2><div class="tablewrap"><table class="table"><thead><tr><th>Tanggal & Jam</th><th>Produk</th><th>Nominal</th><th>Metode</th><th>Keterangan</th></tr></thead><tbody>${refunds.map(x=>{const sale=db.sales.find(s=>s.id===x.sale_id);return `<tr><td><b>${esc(dateTimeWib(x.created_at,x.refund_date))}</b></td><td>${esc(sale?.product_name||'-')}</td><td>${rup(x.amount)}</td><td>${esc(x.payment_method||'-')}</td><td>${esc(x.note||'-')}</td></tr>`}).join('')||'<tr><td colspan="5" class="empty">Belum ada pengembalian uang.</td></tr>'}</tbody></table></div></div>`;
}
function printSaleReceipt(id){
  if(!requirePermission('sales.receipt','mencetak/membagikan struk'))return;
  const x=db.sales.find(s=>s.id===id); if(!x)return alert('Transaksi tidak ditemukan.');
  const total=saleRevenue(x);
  const cash=x.cash_received==null?'':rup(x.cash_received);
  const change=x.change_amount==null?'':rup(x.change_amount);
  const paidNote=String(x.payment||'')==='Piutang'?'BELUM LUNAS':'LUNAS';
  const customer=db.customers.find(c=>c.id===x.customer_id);
  const customerName=(customer?.name||'Umum');
  const customerType=customer?.customer_type&&customer.customer_type!=='Umum'?customer.customer_type:'';
  const txSuffix=String(x.id||'').replace(/-/g,'').slice(-6).toUpperCase() || '000000';
  const txNo=`TRX-${String(x.sale_date||'').replace(/-/g,'')}-${txSuffix}`;
  const txDate=x.created_at?new Date(x.created_at):null;
  const txTime=txDate&&!Number.isNaN(txDate.getTime())?txDate.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'';
  const promo=x.promo_name||'';
  const paidQty=salePaidQty(x);
  const freeQty=saleFreeQty(x);
  const receiptText=[
    'CEO FRESH',
    `No. Transaksi: ${txNo}`,
    `Tanggal: ${x.sale_date}${txTime?` ${txTime}`:''}`,
    `Pembayaran: ${x.payment}`,
    `Pelanggan: ${customerName}${customerType?` (${customerType})`:''}`,
    `${x.product_name} — ${paidQty} dibayar${freeQty?` + ${freeQty} sedekah`:''} × ${rup(x.price)} = ${rup(total)}`,
    freeQty?`Sedekah: ${freeQty} pcs`:'',
    Number(x.discount_amount||0)>0?`Diskon: ${rup(x.discount_amount)}`:'',
    promo?`Promo: ${promo}`:'',
    `TOTAL: ${rup(total)}`,
    String(x.payment)==='Tunai'?`Uang diterima: ${cash}`:'',
    String(x.payment)==='Tunai'?`Kembalian: ${change}`:'',
    `Status: ${paidNote}`,
    '',
    'Terima kasih atas kunjungan Anda',
    business?.address||'Jl. Cilauteureun Kampung Cikuda - Pameungpeuk',
    `WA: ${business?.wa||'085111351983'}`
  ].filter(Boolean).join('\n');
  const waText=encodeURIComponent(receiptText);
  const html=`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pratinjau Struk CEO FRESH - ${esc(x.product_name)}</title><style>
  *{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f3f6f5;margin:0;padding:18px;color:#172b2b}.wrap{max-width:430px;margin:0 auto}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.btn{border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;background:#0d8178;color:#fff}.btn.secondary{background:#e2f1ef;color:#08756e}.btn.wa{background:#128c7e;color:#fff}.receipt{background:#fff;padding:18px;box-shadow:0 2px 10px rgba(0,0,0,.08);font-size:13px}.receipt h1{font-size:20px;text-align:center;margin:0 0 4px}.center{text-align:center}.line{border-top:1px dashed #777;margin:10px 0}.row{display:flex;justify-content:space-between;gap:12px;margin:5px 0}.total{font-size:17px;font-weight:700}.muted{font-size:11px;color:#555}.hint{text-align:center;color:#607979;font-size:12px;margin:10px 0 0}@media print{body{background:#fff;padding:0}.toolbar,.hint{display:none}.wrap{max-width:none}.receipt{box-shadow:none;padding:8mm}}
</style></head><body><div class="wrap"><div class="toolbar"><button class="btn" onclick="window.print()">🖨️ Cetak</button><button class="btn secondary" onclick="shareReceipt()">📤 Bagikan</button><button class="btn wa" onclick="shareWhatsApp()">💬 WhatsApp</button><button class="btn secondary" onclick="copyReceiptImage()">📋 Salin Gambar</button><button class="btn secondary" onclick="downloadReceiptImage()">⬇️ Simpan Gambar</button><button class="btn secondary" onclick="window.close()">Tutup</button></div><div class="receipt"><h1>CEO FRESH</h1><div class="line"></div><div class="row"><span>No. Transaksi</span><span>${esc(txNo)}</span></div><div class="row"><span>Tanggal</span><span>${esc(x.sale_date)}${txTime?` ${esc(txTime)}`:''}</span></div><div class="row"><span>Pembayaran</span><span>${esc(x.payment)}</span></div><div class="row"><span>Pelanggan</span><span>${esc(customerName)}${customerType?` (${esc(customerType)})`:''}</span></div><div class="line"></div><div><b>${esc(x.product_name)}</b></div><div class="row"><span>${paidQty} dibayar${freeQty?` + ${freeQty} sedekah`:''} × ${rup(x.price)}</span><span>${rup(total)}</span></div>${freeQty?`<div class="row"><span>Sedekah</span><span>${freeQty} pcs</span></div>`:''}${Number(x.discount_amount||0)>0?`<div class="row"><span>Diskon</span><span>-${rup(x.discount_amount)}</span></div>`:''}${promo?`<div class="row"><span>Promo</span><span>${esc(promo)}</span></div>`:''}<div class="line"></div><div class="row total"><span>TOTAL</span><span>${rup(total)}</span></div>${String(x.payment)==='Tunai'?`<div class="row"><span>Uang diterima</span><span>${cash}</span></div><div class="row"><span>Kembalian</span><span>${change}</span></div>`:''}<div class="row"><span>Status</span><span>${paidNote}</span></div><div class="line"></div><div class="center muted">Terima kasih atas kunjungan Anda</div><div class="center muted" style="margin-top:6px">${esc(business?.address||'Jl. Cilauteureun Kampung Cikuda - Pameungpeuk')}</div><div class="center muted">WA: ${esc(business?.wa||'085111351983')}</div></div><div class="hint">Periksa struk terlebih dahulu, lalu pilih Cetak, Bagikan, atau WhatsApp. Pada HP, tombol WhatsApp akan menggunakan menu berbagi perangkat untuk memilih WhatsApp. Pada laptop, gambar dapat ditempel ke WhatsApp Web dengan Ctrl+V tanpa membuka jendela baru.</div></div><script>
const receiptData={text:${JSON.stringify(receiptText)},wa:${JSON.stringify(waText)},title:${JSON.stringify('Struk CEO FRESH - '+x.product_name)}};
const freeQty = ${Number(freeQty||0)};
const promo = ${JSON.stringify(promo)};
function receiptImageBlob(){
  return new Promise((resolve,reject)=>{
    const c=document.createElement('canvas'),ctx=c.getContext('2d');
    const W=720,P=46,lh=32;
    const lines=[
      receiptData.title,
      '',
      'CEO FRESH',
      '----------------------------------------',
      'No. Transaksi'.padEnd(25)+'${esc(txNo)}',
      'Tanggal'.padEnd(25)+'${esc(x.sale_date)}${txTime?` ${esc(txTime)}`:''}',
      'Pembayaran'.padEnd(25)+'${esc(x.payment)}',
      'Pelanggan'.padEnd(25)+'${esc(customerName)}',
      '----------------------------------------',
      '${esc(x.product_name)}',
      '${paidQty} dibayar${freeQty?` + ${freeQty} sedekah`:''} x ${rup(x.price)}'.padEnd(25)+'${rup(total)}',
      freeQty?'Sedekah'.padEnd(25)+'${freeQty} pcs':'',
      promo?'Promo'.padEnd(25)+'${esc(promo)}':'',
      '----------------------------------------',
      'TOTAL'.padEnd(25)+'${rup(total)}',
      String('${esc(x.payment)}')==='Tunai'?'Uang diterima'.padEnd(25)+'${cash}':'',
      String('${esc(x.payment)}')==='Tunai'?'Kembalian'.padEnd(25)+'${change}':'',
      'Status'.padEnd(25)+'${paidNote}',
      '----------------------------------------',
      'Terima kasih atas kunjungan Anda',
      '${esc(business?.address||'Jl. Cilauteureun Kampung Cikuda - Pameungpeuk')}',
      'WA: ${esc(business?.wa||'085111351983')}'
    ];
    const clean=lines.filter(Boolean);
    c.width=W;c.height=80+clean.length*lh;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,c.height);
    ctx.fillStyle='#111';ctx.textAlign='center';ctx.font='bold 30px Arial';
    ctx.fillText(clean[0],W/2,42);
    ctx.textAlign='left';ctx.font='20px Arial';
    let y=82;
    clean.slice(1).forEach((line,i)=>{
      if(i===1){ctx.font='bold 28px Arial';ctx.textAlign='center';ctx.fillText(line,W/2,y);ctx.textAlign='left';ctx.font='20px Arial';}
      else ctx.fillText(line,P,y);
      y+=lh;
    });
    c.toBlob(b=>b?resolve(b):reject(new Error('Gagal membuat gambar struk')),'image/png');
  });
}
async function downloadReceiptImage(){
  try{
    const blob=await receiptImageBlob();
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='struk-ceo-fresh.png';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    alert('Gambar struk sudah disimpan. Buka WhatsApp lalu lampirkan gambar struk tersebut.');
  }catch(e){alert('Gagal menyimpan gambar struk: '+e.message)}
}
async function copyReceiptImage(){
  try{
    const blob=await receiptImageBlob();
    if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Browser tidak mendukung salin gambar');
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
    alert('Gambar struk sudah disalin. Buka chat WhatsApp yang sudah terbuka lalu tempelkan dengan Ctrl+V (laptop) atau tekan lama pada kolom pesan (HP jika didukung).');
  }catch(e){alert('Browser ini tidak mendukung salin gambar langsung. Gunakan tombol Simpan Gambar, lalu lampirkan file PNG di WhatsApp.')}
}
async function shareReceipt(){
  try{
    const blob=await receiptImageBlob();
    const file=new File([blob], 'struk-ceo-fresh.png',{type:'image/png'});
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({title:receiptData.title,files:[file]});
      return;
    }
    await downloadReceiptImage();
  }catch(e){if(e.name!=='AbortError')alert('Gagal membagikan gambar struk. Silakan gunakan Simpan Gambar.');}
}
async function shareWhatsApp(){
  try{
    const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const blob=await receiptImageBlob();
    const file=new File([blob], 'struk-ceo-fres.png',{type:'image/png'});

    // HP: gunakan menu berbagi sistem. Jika WhatsApp mendukung file,
    // gambar akan ikut sebagai lampiran. Jangan kirim teks-only ke WhatsApp,
    // karena itu membuat WhatsApp terbuka tanpa file.
    if(isMobile){
      if(navigator.share){
        try{
          const shareFilesOk=!navigator.canShare || navigator.canShare({files:[file]});
          if(shareFilesOk){
            await navigator.share({title:receiptData.title,files:[file]});
            return;
          }
        }catch(e){
          if(e.name==='AbortError') return;
        }
      }
      // Fallback yang jujur: simpan file lalu pengguna melampirkannya di WhatsApp.
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download='struk-ceo-fresh.png';document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
      alert('HP ini tidak mendukung pengiriman gambar langsung ke WhatsApp. Gambar struk sudah disimpan. Buka WhatsApp lalu lampirkan struk-ceo-fresh.png.');
      return;
    }

    // Laptop/desktop: browser tidak mengizinkan website memasukkan file
    // langsung ke kolom lampiran WhatsApp Web. Cara paling praktis adalah
    // menyalin PNG ke clipboard, lalu pengguna menempelkan dengan Ctrl+V.
    if(navigator.clipboard && window.ClipboardItem){
      try{
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
        window.open('https://web.whatsapp.com/','_blank');
        alert('Gambar struk sudah disalin ke clipboard. Di WhatsApp Web, pilih chat pelanggan lalu tekan Ctrl+V dan Kirim.');
        return;
      }catch(e){
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;a.download='struk-ceo-fresh.png';document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),2000);
        alert('Browser tidak mengizinkan penyalinan gambar otomatis. Gambar struk sudah disimpan; lampirkan file tersebut di WhatsApp Web.');
        return;
      }
    }

    await downloadReceiptImage();
  }catch(e){
    if(e.name!=='AbortError') alert('Gagal menyiapkan gambar WhatsApp: '+e.message);
  }
}
</script></body></html>`;
  const w=window.open('','_blank','width=480,height=760');
  if(!w)return alert('Jendela pratinjau diblokir browser. Izinkan pop-up untuk CEO Fres.');
  w.document.write(html);w.document.close();
}
function productHpp(p){
  const rows=db.recipeItems.filter(r=>r.product_id===p.id);
  if(!rows.length){
    const finished=db.stock.find(x=>String(x.name||'').trim().toLowerCase()===String(p.name||'').trim().toLowerCase());
    return Number(finished?.cost ?? p.cost ?? 0);
  }
  return rows.reduce((sum,r)=>{const st=db.stock.find(x=>x.id===r.stock_id);return sum+(st?Number(st.cost||0)*Number(r.qty||0):0)},0);
}
function filterProductTable(){const q=(window.productSearch||'').trim().toLowerCase();document.querySelectorAll('#content .product-row').forEach(row=>{row.style.display=(!q||row.dataset.search.includes(q))?'':'none'});}
function isResellerFinishedProduct(p){
  if(!p||p.active===false)return false;
  if(db.recipeItems.some(r=>r.product_id===p.id))return false;
  const name=String(p.name||'').trim().toLowerCase();
  const cat=String(p.category||'').trim().toLowerCase();
  // Produk yang secara bisnis merupakan produk resep tetap dikeluarkan
  // walaupun baris recipe_items-nya belum tersedia/terbaca.
  if(name.includes('jus')||cat.includes('jus'))return false;
  if(name==='es teh'||name.startsWith('es teh ')||cat==='es teh')return false;
  return true;
}
function products(c){
  const active=[...db.products].sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
  const q=(window.productSearch||'').toLowerCase();
  const list=active.filter(p=>!q||p.name.toLowerCase().includes(q)||String(p.category||'').toLowerCase().includes(q));
  const noRecipe=active.filter(isResellerFinishedProduct).sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
  const resellerRows=[...db.resellerPrices].filter(r=>isResellerFinishedProduct(db.products.find(p=>p.id===r.product_id))).sort((a,b)=>{const pa=db.products.find(p=>p.id===a.product_id)?.name||'';const pb=db.products.find(p=>p.id===b.product_id)?.name||'';return pa.localeCompare(pb,'id',{sensitivity:'base'})});
  const canReseller=profile?.role==='pemilik' && can('reseller_prices.manage');
  const resellerOptions=noRecipe.map(p=>`<option value="${p.id}">${esc(p.name)} — Harga normal ${rup(p.price)}</option>`).join('');
  c.innerHTML=`<div class="card form"><div><label>Nama produk<input id="pName" placeholder="Contoh: Jus Jeruk"></label></div><div><label>Kategori<input id="pCat" value="Jus Buah"></label></div><div><label>Harga jual<input id="pPrice" type="number" value="8000"></label></div><div><label>HPP / unit<input id="pCost" type="number" value="4000"></label></div><div><label>Satuan<input id="pUnit" value="gelas"></label></div><div class="full"><button class="btn" onclick="addProduct()">＋ Tambah Produk</button></div></div>
  <div class="section card"><div class="cardhead"><div><h2>Produk & HPP</h2><small class="muted">HPP resep dihitung otomatis dari harga rata-rata bahan terbaru.</small></div><input class="tableSearch" id="productSearch" value="${esc(window.productSearch||'')}" placeholder="🔍 Cari produk..." oninput="window.productSearch=this.value;filterProductTable()"></div>
  <div class="tablewrap"><table class="table"><tr><th>Produk</th><th>Kategori</th><th>Harga Jual</th><th>HPP</th><th>Margin</th><th>Resep</th><th>Status</th><th></th></tr>${list.map(p=>{const h=productHpp(p),n=db.recipeItems.filter(r=>r.product_id===p.id).length;const searchText=esc((p.name+' '+(p.category||'')).toLowerCase());return `<tr class="product-row" data-search="${searchText}"><td><b>${esc(p.name)}</b></td><td><span class="pill">${esc(p.category)}</span></td><td>${rup(p.price)}</td><td><b>${rup(h)}</b></td><td class="green">${rup(p.price-h)}</td><td>${n?`${n} bahan`:'Tanpa resep'}</td><td>${p.active?'<span class="ok">Aktif</span>':'Nonaktif'}</td><td><button class="link" onclick="openRecipe('${p.id}')">${n?'Lihat resep':'Buat resep'}</button> · <button class="link" onclick="toggleProduct('${p.id}',${!p.active})">${p.active?'Nonaktifkan':'Aktifkan'}</button></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Produk tidak ditemukan.</td></tr>'}</table></div></div>
  ${canReseller?`<div class="section card"><div class="cardhead"><div><h2>Harga Reseller</h2><small class="muted">Khusus produk tanpa resep, seperti Es Mambo, Es Cream, Es Gabus, dan produk jadi sejenis.</small></div></div><div class="form"><div><label>Produk siap jual tanpa resep<select id="rpProduct"><option value="">＋ Pilih produk</option>${resellerOptions}</select></label></div><div><label>Harga reseller<input id="rpPrice" type="number" min="0" step="1" placeholder="Contoh: 800"></label></div><div><label>Minimal qty<input id="rpMinQty" type="number" min="1" step="1" value="100"></label></div><div class="full"><button class="btn" onclick="saveResellerPrice()">＋ Simpan Harga Reseller</button><small class="hint">Reseller biasa mengikuti minimal qty. Reseller Tetap tetap boleh mendapat harga reseller di bawah minimal qty.</small></div></div><div class="tablewrap" style="margin-top:12px"><table class="table"><tr><th>Produk</th><th>Harga Normal</th><th>Harga Reseller</th><th>Minimal Qty</th><th>Status</th><th>Aksi</th></tr>${resellerRows.map(r=>{const p=db.products.find(x=>x.id===r.product_id);return `<tr><td><b>${esc(p?.name||'-')}</b></td><td>${rup(p?.price||0)}</td><td>${rup(r.reseller_price)}</td><td>${fmtNum(r.min_qty||100)}</td><td>${r.active===false?'<span class="warn">Nonaktif</span>':'<span class="ok">Aktif</span>'}</td><td><button class="link" onclick="editResellerPrice('${r.id}')">Edit</button> · <button class="link" onclick="toggleResellerPrice('${r.id}',${r.active===false})">${r.active===false?'Aktifkan':'Nonaktifkan'}</button></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">Belum ada harga reseller.</td></tr>'}</table></div></div>`:''}
  <div id="recipePanel"></div>`;
}
async function saveResellerPrice(){if(profile?.role!=='pemilik'){alert('Hanya Pemilik yang dapat mengelola harga reseller.');return;}
  if(!requirePermission('reseller_prices.manage','mengelola harga reseller'))return;
  const productId=$('rpProduct')?.value;
  const price=Number($('rpPrice')?.value);
  const minQty=Number($('rpMinQty')?.value)||100;
  if(!productId)return alert('Pilih produk terlebih dahulu.');
  if(!Number.isFinite(price)||price<0)return alert('Harga reseller tidak valid.');
  if(!Number.isFinite(minQty)||minQty<=0)return alert('Minimal qty harus lebih dari 0.');
  const p=db.products.find(x=>x.id===productId);
  if(!p)return alert('Produk tidak ditemukan.');
  if(!isResellerFinishedProduct(p))return alert('Produk ini termasuk produk resep/olahan dan tidak dapat diberi harga reseller dari menu ini.');
  if(price>Number(p.price||0))return alert('Harga reseller tidak boleh lebih tinggi dari harga normal.');
  const existing=db.resellerPrices.find(x=>x.product_id===productId);
  let result;
  if(existing){result=await sb.from('reseller_prices').update({reseller_price:price,min_qty:minQty,active:true}).eq('id',existing.id).eq('business_id',profile.business_id)}
  else{result=await sb.from('reseller_prices').insert({business_id:profile.business_id,product_id:productId,reseller_price:price,min_qty:minQty,active:true})}
  if(result.error)return alert(result.error.message);
  await loadAll();render();
}
function editResellerPrice(id){if(profile?.role!=='pemilik'){alert('Hanya Pemilik yang dapat mengelola harga reseller.');return;}
  const r=db.resellerPrices.find(x=>x.id===id);
  if(!r)return;
  const p=db.products.find(x=>x.id===r.product_id);
  const prod=$('rpProduct');
  if(prod)prod.value=r.product_id;
  if($('rpPrice'))$('rpPrice').value=Number(r.reseller_price)||0;
  if($('rpMinQty'))$('rpMinQty').value=Number(r.min_qty)||100;
  window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
}
async function toggleResellerPrice(id,active){if(profile?.role!=='pemilik'){alert('Hanya Pemilik yang dapat mengelola harga reseller.');return;}
  if(!requirePermission('reseller_prices.manage','mengelola harga reseller'))return;
  const {error}=await sb.from('reseller_prices').update({active}).eq('id',id).eq('business_id',profile.business_id);
  if(error)alert(error.message);else await loadAll(),render();
}

function recipeDisplayMeta(q,unit){
  const n=Number(q)||0, u=String(unit||'').toLowerCase();
  if(u==='kg') return {value:n*1000, unit:'g', step:'1'};
  if(u==='l') return {value:n*1000, unit:'ml', step:'1'};
  return {value:n, unit:String(unit||''), step:'0.0001'};
}
function recipeQtyDisplay(q,unit){
  const m=recipeDisplayMeta(q,unit);
  return `${fmtNum(m.value)} ${esc(m.unit)}`.trim();
}
function openRecipe(productId){
  const p=db.products.find(x=>x.id===productId); if(!p)return;
  const rows=db.recipeItems.filter(r=>r.product_id===productId).sort((a,b)=>{
    const sa=db.stock.find(x=>x.id===a.stock_id)?.name||'', sb=db.stock.find(x=>x.id===b.stock_id)?.name||'';
    return sa.localeCompare(sb,'id',{sensitivity:'base'});
  });
  const stockOpts=db.stock.slice().sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'})).map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.unit)} — ${rup(x.cost)}/${esc(x.unit)}</option>`).join('');
  const total=rows.reduce((sum,r)=>{const st=db.stock.find(x=>x.id===r.stock_id);return sum+(st?Number(st.cost||0)*Number(r.qty||0):0)},0);
  const html=`<div class="section card recipe-panel"><div class="cardhead"><div><h2>Resep: ${esc(p.name)}</h2><small class="muted">${rows.length} bahan · HPP saat ini: <b>${rup(total)}</b></small></div><button class="btn small secondary" onclick="$('recipePanel').innerHTML=''">Tutup</button></div>
  <div class="tablewrap"><table class="table"><thead><tr><th>No.</th><th>Bahan</th><th>Takaran</th><th>Harga rata-rata</th><th>Biaya</th><th>Aksi</th></tr></thead><tbody>${rows.map((r,i)=>{const st=db.stock.find(x=>x.id===r.stock_id);const cost=Number(r.qty||0)*Number(st?.cost||0);const meta=recipeDisplayMeta(r.qty,st?.unit);return `<tr><td>${i+1}</td><td><b>${esc(st?.name||'Bahan tidak ditemukan')}</b><br><small class="muted">Stok: ${esc(st?.unit||'-')}</small></td><td><input class="recipeQtyInput" id="rq_${r.id}" type="number" min="0.0001" step="${meta.step}" value="${meta.value}" style="width:110px"> <b>${esc(meta.unit)}</b><br><small class="muted">Untuk stok, akan dikonversi otomatis ke ${esc(st?.unit||'unit')}</small></td><td>${rup(st?.cost||0)} / ${esc(st?.unit||'unit')}</td><td><b>${rup(cost)}</b></td><td><button class="link" onclick="saveRecipeQty('${r.id}','${productId}')">Simpan</button> · <button class="link danger" onclick="removeRecipe('${r.id}','${productId}')">Hapus</button></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">Belum ada bahan.</td></tr>'}</tbody><tfoot><tr><th colspan="4" style="text-align:right">Total HPP resep</th><th>${rup(total)}</th><th></th></tr></tfoot></table></div>
  <div class="card" style="margin-top:14px;padding:14px;background:#f7fbfa"><h3 style="margin:0 0 10px">＋ Tambah bahan ke resep</h3><div class="form"><div><label>Bahan<select id="rcStock" onchange="recipeAddUnitChanged()">${stockOpts}</select></label></div><div><label>Takaran <span id="rcUnit" style="font-weight:700"></span><input id="rcQty" type="number" step="1" min="0.0001" value="1"></label><small id="rcHint" class="hint">Pilih bahan untuk melihat satuan takaran.</small></div><div class="full"><button class="btn" onclick="addRecipe('${productId}')">＋ Tambah ke Resep</button></div></div></div></div>`;
  $('recipePanel').innerHTML=html; recipeAddUnitChanged(); $('recipePanel').scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveRecipeQty(id,productId){
  if(!requireAnyPermission(['recipes.manage','hpp.manage'],'mengubah resep'))return;
  const row=db.recipeItems.find(r=>r.id===id);
  const st=row?db.stock.find(x=>x.id===row.stock_id):null;
  const entered=Number($(`rq_${id}`)?.value)||0;
  if(entered<=0)return alert('Takaran harus lebih dari 0.');
  const u=String(st?.unit||'').toLowerCase();
  const qty=(u==='kg'||u==='l')?entered/1000:entered;
  const {error}=await sb.from('recipe_items').update({qty}).eq('id',id).eq('business_id',profile.business_id);
  if(error)return alert(error.message);
  await loadAll(); products($('content')); openRecipe(productId);
}
function recipeAddMeta(unit){
  const u=String(unit||'').toLowerCase();
  if(u==='kg') return {unit:'g', factor:1000, step:'1', placeholder:'contoh: 150'};
  if(u==='l'||u==='liter') return {unit:'ml', factor:1000, step:'1', placeholder:'contoh: 100'};
  return {unit:String(unit||''), factor:1, step:(u==='pcs'||u==='botol'||u==='gelas'||u==='cup')?'1':'0.01', placeholder:'masukkan takaran'};
}
function recipeAddUnitChanged(){
  const id=$('rcStock')?.value;
  const st=db.stock.find(x=>x.id===id);
  const meta=recipeAddMeta(st?.unit);
  if($('rcUnit')) $('rcUnit').textContent=meta.unit?`(${meta.unit})`:'';
  if($('rcQty')) { $('rcQty').step=meta.step; $('rcQty').value=''; $('rcQty').placeholder=meta.placeholder; }
  if($('rcHint')) $('rcHint').textContent=st?`Masukkan takaran dalam ${meta.unit}. Sistem akan mengonversi otomatis ke stok ${st.unit}.`: 'Pilih bahan untuk melihat satuan takaran.';
}
async function addRecipe(productId){
  if(!requireAnyPermission(['recipes.manage','hpp.manage'],'mengubah resep'))return;
  const stockId=$('rcStock')?.value, entered=Number($('rcQty')?.value)||0;
  const st=db.stock.find(x=>x.id===stockId);
  if(!stockId||entered<=0)return alert('Pilih bahan dan isi takaran.');
  if(!st)return alert('Bahan stok tidak ditemukan.');
  const meta=recipeAddMeta(st.unit);
  const qty=entered/meta.factor;
  const existing=db.recipeItems.find(r=>r.product_id===productId&&r.stock_id===stockId);
  let res=existing?await sb.from('recipe_items').update({qty}).eq('id',existing.id).eq('business_id',profile.business_id):await sb.from('recipe_items').insert({business_id:profile.business_id,product_id:productId,stock_id:stockId,qty});
  if(res.error)alert(res.error.message);else{await loadAll();products($('content'));openRecipe(productId)}
}
async function removeRecipe(id,productId){if(!requireAnyPermission(['recipes.manage','hpp.manage'],'mengubah resep'))return;if(!confirm('Hapus bahan ini dari resep?'))return;const {error}=await sb.from('recipe_items').delete().eq('id',id).eq('business_id',profile.business_id);if(error)alert(error.message);else{await loadAll();products($('content'));openRecipe(productId)}}
async function addProduct(){if(!requirePermission('products.manage','mengelola produk'))return;const name=$('pName').value.trim();if(!name)return alert('Nama produk wajib diisi.');const {error}=await sb.from('products').insert({business_id:profile.business_id,name,category:$('pCat').value||'Lainnya',price:Number($('pPrice').value)||0,cost:Number($('pCost').value)||0,unit:$('pUnit').value||'pcs',active:true});if(error)alert(error.message);else await loadAll(),render()}
async function toggleProduct(id,active){if(!requirePermission('products.manage','mengelola produk'))return;const {error}=await sb.from('products').update({active}).eq('id',id);if(error)alert(error.message);else await loadAll(),render()}
function purchases(c){
  const suppliers=[...db.suppliers].sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
  const stock=[...db.stock].sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
  const assets=[...db.assets].filter(x=>x.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
  const supOpts=suppliers.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
  const finishedProductStockIds=new Set(stock.filter(st=>{
    const p=db.products.find(x=>x.active!==false&&String(x.name||'').trim().toLowerCase()===String(st.name||'').trim().toLowerCase());
    return !!p && !db.recipeItems.some(r=>r.product_id===p.id);
  }).map(st=>st.id));
  const bahanStock=stock.filter(st=>!finishedProductStockIds.has(st.id));
  const produkJadiStock=stock.filter(st=>finishedProductStockIds.has(st.id));
  const stockOption=(x)=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.unit)} — stok ${fmtNum(x.qty)}</option>`;
  const bahanOpts=bahanStock.map(stockOption).join('');
  const produkJadiOpts=produkJadiStock.map(stockOption).join('');
  const assetOpts=assets.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.unit)}</option>`).join('');
  window.purchaseCart=[];
  c.innerHTML=`
  <div class="card form">
    <div><label>Supplier<select id="puSupplier"><option value="">＋ Pilih supplier</option>${supOpts}</select></label></div>
    <div><label>Tanggal<input id="puDate" type="date" value="${today()}"></label></div>
    <div><label>No. Nota<input id="puInvoice" placeholder="Opsional"></label></div>
    <div><label>Pembayaran<select id="puPay" onchange="togglePurchaseDue()"><option>Tunai</option><option>Transfer</option><option>Utang</option></select></label></div>
    <div id="puDueWrap" style="display:none"><label>Jatuh tempo<input id="puDue" type="date"></label></div>
    <div><label>Keterangan<input id="puNote" placeholder="Contoh: belanja buah ke supplier"></label></div>
  </div>
  <div class="section card">
    <h2>Item Pembelian</h2>
    <div class="form">
      <div><label>Jenis Pembelian<select id="puType" onchange="purchaseTypeChanged()">
        <option value="bahan">Bahan / Kemasan Habis Pakai</option>
        <option value="produk_jadi">Produk Jadi</option>
        ${can('assets.manage')?'<option value="asset">Alat / Aset</option>':''}
      </select></label></div>
      <div id="puStockWrap"><label id="puStockLabel">Bahan / Kemasan Habis Pakai<select id="puStock">${bahanOpts}</select></label>
        ${can('products.manage')?'<button class="btn secondary" type="button" id="puNewProductBtn" style="margin-top:8px" onclick="togglePurchaseProductForm()">＋ Tambah Produk Jadi Baru</button>':''}
      </div>
      <div id="puNewProductForm" class="card" style="display:none;margin-top:10px;padding:12px">
        <div class="form">
          <div><label>Nama Produk Baru<input id="puNewProductName" placeholder="Contoh: Es Teh Botol"></label></div>
          <div><label>Satuan<input id="puNewProductUnit" value="pcs" placeholder="pcs"></label></div>
          <div><label>Kategori<input id="puNewProductCategory" value="Produk Jadi" placeholder="Kategori produk"></label></div>
          <div><label>Harga Jual<input id="puNewProductPrice" type="number" min="0" step="1" value="0"></label></div>
          <div class="full"><button class="btn" type="button" onclick="addFinishedProductForPurchase()">💾 Simpan Produk Jadi Baru</button></div>
        </div>
        <small class="hint">Produk baru dibuat sebagai produk jadi tanpa resep dan dibuatkan stok awal 0. Stok baru bertambah setelah pembelian disimpan.</small>
      </div>
      <div id="puAssetWrap" class="hidden"><label>Alat / Aset<select id="puAsset"><option value="">＋ Pilih aset</option>${assetOpts}</select></label></div>
      <div><label>Jumlah<input id="puQty" type="number" min="0.0001" step="0.01" value="1" oninput="updatePurchaseItemValue()"></label></div>
      <div><label>Harga beli / satuan<input id="puPrice" type="number" min="0" step="0.01" value="0" oninput="updatePurchaseItemValue()"></label></div>
      <div><label>Nilai Pembelian<input id="puValue" type="text" value="Rp0" readonly></label><small class="hint">Nilai dihitung otomatis: jumlah × harga beli / satuan.</small></div>
      <div class="full"><button class="btn secondary" onclick="addPurchaseItem()">＋ Tambah ke Pembelian</button></div>
    </div>
    <small class="hint">Bahan/Kemasan dan Produk Jadi masuk stok. Alat/Aset tidak masuk stok dan tidak memengaruhi HPP bahan.</small>
    <div id="purchaseCart" style="margin-top:14px"></div>
  </div>
  ${can('assets.manage')?`
  <div class="section card">
    <div class="cardhead" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">Master Alat / Aset</h2><button class="btn secondary" type="button" onclick="toggleAssetForm()">＋ Tambah Alat/Aset Baru</button></div>
    <div id="assetFormBox" style="display:none;margin-top:14px">
      <div class="form">
        <div><label>Nama alat/aset<input id="asName" placeholder="Contoh: Blender, Juicer, Freezer"></label></div>
        <div><label>Satuan<input id="asUnit" value="unit" placeholder="unit"></label></div>
        <div><label>Catatan<input id="asNote" placeholder="Opsional"></label></div>
        <div class="full"><button class="btn" type="button" onclick="addAsset()">💾 Simpan Alat/Aset</button></div>
      </div>
    </div>
    <div class="tablewrap" style="margin-top:14px"><table class="table"><tr><th>Nama Alat/Aset</th><th>Satuan</th><th>Status</th><th>Catatan</th></tr>${assets.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.unit)}</td><td>${x.active?'Aktif':'Nonaktif'}</td><td>${esc(x.note||'-')}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Belum ada alat/aset.</td></tr>'}</table></div>
  </div>`:''}
  <div class="section card form">
    <div class="full"><button class="btn" onclick="savePurchase()">💾 Simpan Pembelian</button></div>
    <small class="hint">Pembelian tunai/transfer berstatus Lunas. Pembelian Utang masuk daftar utang dan tidak dicatat sebagai Pengeluaran operasional.</small>
  </div>
  <div id="purchasePaymentBox"></div>
  <div class="section card">
    <div class="cardhead"><h2>Supplier</h2></div>
    <div class="form">
      <div><label>Nama supplier<input id="suName" placeholder="Nama supplier"></label></div>
      <div><label>WhatsApp / Telepon<input id="suPhone" placeholder="08xxxxxxxxxx"></label></div>
      <div><label>Alamat<input id="suAddr" placeholder="Alamat supplier"></label></div>
      <div><label>Catatan<input id="suNote" placeholder="Catatan"></label></div>
      <div class="full"><button class="btn secondary" onclick="addSupplier()">＋ Simpan Supplier</button></div>
    </div>
    <div class="tablewrap" style="margin-top:14px"><table class="table"><tr><th>Supplier</th><th>Kontak</th><th>Alamat</th><th></th></tr>${suppliers.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.phone||'-')}</td><td>${esc(x.address||'-')}</td><td></td></tr>`).join('')||'<tr><td colspan="4" class="empty">Belum ada supplier.</td></tr>'}</table></div>
  </div>
  <div class="section card">
    <div class="cardhead"><h2>Riwayat Pembelian</h2></div>
    <div class="tablewrap"><table class="table"><tr><th>Tanggal & Jam</th><th>Supplier</th><th>Nota</th><th>Pembayaran</th><th>Total</th><th>Status</th><th>Aksi</th></tr>${db.purchases.map(x=>{const su=db.suppliers.find(s=>s.id===x.supplier_id);const paid=db.supplierPayments.filter(p=>p.purchase_id===x.id).reduce((a,p)=>a+Number(p.amount||0),0);const remaining=Math.max(0,Number(x.total||0)-paid);const actions=[];if(x.status==='Belum Lunas'&&can('supplier_payments.create'))actions.push(`<button class="link" onclick="openPurchasePayment('${x.id}')">Bayar</button>`);if(x.status!=='Dibatalkan'&&can('purchases.cancel'))actions.push(`<button class="link danger" onclick="cancelPurchase('${x.id}')">Batalkan</button>`);const action=actions.length?actions.join(' '):'-';return `<tr class="${x.status==='Dibatalkan'?'muted':''}"><td><b>${esc(dateTimeWib(x.created_at,x.purchase_date))}</b></td><td>${esc(su?.name||'-')}</td><td>${esc(x.invoice_no||'-')}</td><td>${esc(x.payment_method)}</td><td>${rup(x.total)}</td><td>${esc(x.status)}${x.due_date?`<br><small class="muted">Jatuh tempo ${esc(x.due_date)}</small>`:''}${x.status==='Belum Lunas'?`<br><small class="muted">Sisa ${rup(remaining)}</small>`:''}</td><td>${action}</td></tr>`}).join('')||'<tr><td colspan="7" class="empty">Belum ada pembelian.</td></tr>'}</table></div>
  </div>`;
  togglePurchaseDue(); purchaseTypeChanged(); updatePurchaseItemValue(); renderPurchaseCart();
}
function updatePurchaseItemValue(){
  const qty=Number($('puQty')?.value)||0;
  const price=Number($('puPrice')?.value)||0;
  const el=$('puValue');
  if(el)el.value=rup(Math.max(0,qty*price));
}
function togglePurchaseDue(){const pay=$('puPay')?.value,wrap=$('puDueWrap');if(!wrap)return;wrap.style.display=pay==='Utang'?'block':'none';if(pay==='Utang'&&!$('puDue').value){const d=new Date();d.setDate(d.getDate()+7);$('puDue').value=localISO(d)}}
function togglePurchaseProductForm(){
  const box=$('puNewProductForm');
  if(!box)return;
  const show=box.style.display==='none'||!box.style.display;
  box.style.display=show?'block':'none';
  if(!show){
    if($('puNewProductName'))$('puNewProductName').value='';
    if($('puNewProductUnit'))$('puNewProductUnit').value='pcs';
    if($('puNewProductCategory'))$('puNewProductCategory').value='Produk Jadi';
    if($('puNewProductPrice'))$('puNewProductPrice').value='0';
  }
}
async function addFinishedProductForPurchase(){
  if(!requirePermission('products.manage','menambah produk jadi baru'))return;
  const name=$('puNewProductName')?.value.trim()||'';
  const unit=$('puNewProductUnit')?.value.trim()||'pcs';
  const category=$('puNewProductCategory')?.value.trim()||'Produk Jadi';
  const price=Number($('puNewProductPrice')?.value)||0;
  if(!name)return alert('Nama produk wajib diisi.');
  if(!unit)return alert('Satuan wajib diisi.');
  if(price<0)return alert('Harga jual tidak valid.');
  const norm=name.toLowerCase();
  const dupProduct=db.products.find(p=>String(p.name||'').trim().toLowerCase()===norm);
  const dupStock=db.stock.find(st=>String(st.name||'').trim().toLowerCase()===norm);
  if(dupProduct||dupStock)return alert(`Produk/stok dengan nama "${name}" sudah ada. Silakan pilih dari daftar yang tersedia.`);
  const {data:product,error:productError}=await sb.from('products').insert({
    business_id:profile.business_id,
    name,
    category,
    price,
    cost:0,
    unit,
    active:true
  }).select().single();
  if(productError)return alert(productError.message);
  const {error:stockError}=await sb.from('stock').insert({
    business_id:profile.business_id,
    name,
    unit,
    qty:0,
    min_qty:0,
    cost:0
  });
  if(stockError){
    await sb.from('products').delete().eq('id',product.id).eq('business_id',profile.business_id);
    return alert(stockError.message);
  }
  await loadAll();
  render();
  setTimeout(()=>{
    if($('puType'))$('puType').value='produk_jadi';
    purchaseTypeChanged();
    const target=db.stock.find(st=>String(st.name||'').trim().toLowerCase()===norm);
    if(target&&$('puStock'))$('puStock').value=target.id;
  },0);
  alert(`Produk jadi "${name}" berhasil ditambahkan ke master dan siap dibeli.`);
}
function purchaseTypeChanged(){
  const type=$('puType')?.value||'bahan';
  $('puStockWrap')?.classList.toggle('hidden',type==='asset');
  $('puAssetWrap')?.classList.toggle('hidden',type!=='asset');
  const label=$('puStockLabel');
  const select=$('puStock');
  if(label&&select&&type!=='asset'){
    const stock=[...db.stock].sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
    const finishedIds=new Set(stock.filter(st=>{
      const p=db.products.find(x=>x.active!==false&&String(x.name||'').trim().toLowerCase()===String(st.name||'').trim().toLowerCase());
      return !!p && !db.recipeItems.some(r=>r.product_id===p.id);
    }).map(st=>st.id));
    const filtered=type==='produk_jadi'?stock.filter(st=>finishedIds.has(st.id)):stock.filter(st=>!finishedIds.has(st.id));
    select.innerHTML='<option value="">＋ Pilih '+(type==='produk_jadi'?'produk jadi':'bahan/kemasan')+'</option>'+filtered.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.unit)} — stok ${fmtNum(x.qty)}</option>`).join('');
    label.childNodes[0].textContent=type==='produk_jadi'?'Produk Jadi':'Bahan / Kemasan Habis Pakai';
  }
  if(type==='asset'&&$('puAsset')) $('puAsset').value='';
  if(type!=='asset'&&select&&!select.value&&select.options.length>1) select.selectedIndex=1;
}
function addPurchaseItem(){
  const type=$('puType')?.value||'bahan';
  const qty=Number($('puQty')?.value)||0,price=Number($('puPrice')?.value)||0;
  if(qty<=0||price<=0)return alert('Isi jumlah dan harga beli dengan benar.');
  if(type==='asset'){
    const aid=$('puAsset')?.value,asset=db.assets.find(x=>x.id===aid);
    if(!aid||!asset)return alert('Pilih alat/aset terlebih dahulu.');
    const ex=window.purchaseCart.find(x=>x.type==='asset'&&x.asset_id===aid&&Number(x.price)===price);
    if(ex)ex.qty+=qty;else window.purchaseCart.push({type:'asset',classification:'asset',asset_id:aid,name:asset.name,unit:asset.unit,qty,price});
  }else{
    const sid=$('puStock')?.value,st=db.stock.find(x=>x.id===sid);
    if(!sid||!st)return alert('Pilih bahan/produk terlebih dahulu.');
    const ex=window.purchaseCart.find(x=>x.type==='stock'&&x.classification===type&&x.stock_id===sid&&Number(x.price)===price);
    if(ex)ex.qty+=qty;else window.purchaseCart.push({type:'stock',classification:type,stock_id:sid,name:st.name,unit:st.unit,qty,price});
  }
  renderPurchaseCart();
}
function renderPurchaseCart(){const w=$('purchaseCart');if(!w)return;if(!window.purchaseCart.length){w.innerHTML='<div class="empty">Belum ada item pembelian.</div>';return}w.innerHTML=`<div class="tablewrap"><table class="table"><tr><th>Jenis</th><th>Item</th><th>Qty</th><th>Harga</th><th>Subtotal</th><th></th></tr>${window.purchaseCart.map((x,i)=>`<tr><td>${x.type==='asset'?'Alat / Aset':(x.classification==='produk_jadi'?'Produk Jadi':'Bahan / Kemasan Habis Pakai')}</td><td>${esc(x.name)}<br><small class="muted">${esc(x.unit)}</small></td><td>${fmtNum(x.qty)}</td><td>${rup(x.price)}</td><td>${rup(x.qty*x.price)}</td><td><button class="link danger" onclick="removePurchaseItem(${i})">Hapus</button></td></tr>`).join('')}</table></div><div class="cartTotal"><b>TOTAL</b><strong>${rup(window.purchaseCart.reduce((a,x)=>a+x.qty*x.price,0))}</strong></div>`}
function removePurchaseItem(i){window.purchaseCart.splice(i,1);renderPurchaseCart()}
function toggleAssetForm(){
  const box=$('assetFormBox');
  if(!box)return;
  const open=box.style.display!=='none';
  box.style.display=open?'none':'block';
  if(!open){$('asName')?.focus();}
}
async function addAsset(){
  if(!requirePermission('assets.manage','mengelola alat/aset'))return;
  const name=$('asName')?.value.trim()||'',unit=$('asUnit')?.value.trim()||'unit',note=$('asNote')?.value.trim()||'';
  if(!name)return alert('Nama alat/aset wajib diisi.');
  const {error}=await sb.from('assets').insert({business_id:profile.business_id,name,unit,active:true,note});
  if(error)return alert(error.message);
  alert('Alat/aset berhasil disimpan.');
  await loadAll();render();
}
async function addSupplier(){const name=$('suName')?.value.trim();if(!name)return alert('Nama supplier wajib diisi.');const {error}=await sb.from('suppliers').insert({business_id:profile.business_id,name,phone:$('suPhone').value.trim(),address:$('suAddr').value.trim(),note:$('suNote').value.trim(),active:true});if(error)alert(error.message);else{alert('Supplier berhasil disimpan.');await loadAll();render()}}
async function savePurchase(){if(!requirePermission('purchases.create','mencatat pembelian'))return;const supplierId=$('puSupplier')?.value,pay=$('puPay')?.value,date=$('puDate')?.value,due=$('puDue')?.value||null;if(!assertCashOpen(date))return;if(!supplierId)return alert('Pilih supplier terlebih dahulu.');if(!date)return alert('Tanggal pembelian wajib diisi.');if(pay==='Utang'&&!due)return alert('Jatuh tempo wajib diisi untuk pembelian utang.');if(!window.purchaseCart?.length)return alert('Tambahkan minimal satu item pembelian.');const items=window.purchaseCart.map(x=>({type:x.type,classification:x.classification||null,stock_id:x.stock_id,asset_id:x.asset_id,qty:x.qty,price:x.price}));const {data,error}=await sb.rpc('record_purchase_with_stock',{p_business_id:profile.business_id,p_supplier_id:supplierId,p_purchase_date:date,p_invoice_no:$('puInvoice').value.trim(),p_payment_method:pay,p_due_date:pay==='Utang'?due:null,p_note:$('puNote').value.trim(),p_items:items});if(error)return alert(error.message);alert(`Pembelian tersimpan. Total ${rup(data?.total||0)}.`);await loadAll();render()}


async function cancelPurchase(id){
  if(!requirePermission('purchases.cancel','membatalkan pembelian'))return;
  const purchase=db.purchases.find(x=>x.id===id);
  if(!purchase)return alert('Pembelian tidak ditemukan.');
  if(String(purchase.status||'').trim()==='Dibatalkan')return alert('Pembelian ini sudah dibatalkan.');
  const supplier=db.suppliers.find(s=>s.id===purchase.supplier_id);
  const reason=prompt(`Batalkan pembelian ${purchase.invoice_no||'-'} dari ${supplier?.name||'supplier'}?\n\nAlasan pembatalan (boleh dikosongkan):`,'');
  if(reason===null)return;
  if(!confirm(`Yakin membatalkan pembelian sebesar ${rup(purchase.total)}?\n\nStok dari pembelian akan dibalik otomatis jika memenuhi aturan pembatalan.`))return;
  const {data,error}=await sb.rpc('cancel_purchase',{p_business_id:profile.business_id,p_purchase_id:id,p_reason:reason.trim()});
  if(error)return alert(error.message);
  alert(data?.message||'Pembelian berhasil dibatalkan. Stok yang terkait dikembalikan otomatis.');
  await loadAll();render();
}


function openPurchasePayment(id){if(!requirePermission('supplier_payments.create','membayar utang supplier'))return;window.purchasePaymentId=id;const p=db.purchases.find(x=>x.id===id);if(!p)return;const paid=db.supplierPayments.filter(x=>x.purchase_id===id).reduce((a,x)=>a+Number(x.amount||0),0);const remaining=Math.max(0,Number(p.total||0)-paid);const el=document.getElementById('purchasePaymentBox');if(!el)return;el.innerHTML=`<div class="card"><h2>Bayar Utang Supplier</h2><div class="form"><div><label>Nominal pembayaran<input id="ppAmount" type="number" min="1" step="1" value="${remaining}"></label><small class="hint">Sisa utang: ${rup(remaining)}</small></div><div><label>Tanggal<input id="ppDate" type="date" value="${today()}"></label></div><div><label>Metode<select id="ppMethod"><option>Tunai</option><option>Transfer</option><option>QRIS</option></select></label></div><div><label>Keterangan<input id="ppNote" placeholder="Contoh: bayar utang nota ${esc(p.invoice_no||'-')}"></label></div><div class="full"><button class="btn" onclick="payPurchaseDebt()">💳 Simpan Pembayaran Utang</button> <button class="btn secondary" onclick="cancelPurchasePayment()">Batal</button></div></div></div>`;el.scrollIntoView({behavior:'smooth',block:'center'})}
function cancelPurchasePayment(){const el=document.getElementById('purchasePaymentBox');if(el)el.innerHTML='';window.purchasePaymentId=null}
async function payPurchaseDebt(){if(!requirePermission('supplier_payments.create','membayar utang supplier'))return;const id=window.purchasePaymentId;if(!id)return;const amount=Number(document.getElementById('ppAmount')?.value)||0;const date=document.getElementById('ppDate')?.value;const method=document.getElementById('ppMethod')?.value;const note=document.getElementById('ppNote')?.value.trim()||'';if(amount<=0)return alert('Nominal pembayaran harus lebih dari 0.');if(!assertCashOpen(date))return;const {data,error}=await sb.rpc('pay_supplier_debt',{p_business_id:profile.business_id,p_purchase_id:id,p_payment_date:date,p_amount:amount,p_payment_method:method,p_note:note});if(error)return alert(error.message);alert(`Pembayaran utang tersimpan. Sisa utang ${rup(data?.remaining||0)}.`);window.purchasePaymentId=null;await loadAll();render()}

function expenses(c){c.innerHTML=`<div class="card form"><div><label>Tanggal<input id="eDate" type="date" value="${today()}"></label></div><div><label>Kategori<input id="eCat" value="Bahan Baku"></label></div><div><label>Keterangan<input id="eNote" placeholder="Belanja buah, listrik, dll."></label></div><div><label>Metode Pembayaran<select id="ePay"><option value="">Pilih metode pembayaran</option><option value="Tunai">Tunai</option><option value="Transfer">Transfer</option><option value="QRIS">QRIS</option></select></label></div><div><label>Jumlah (Rp)<input id="eAmt" type="number" value="0"></label></div><div class="full"><button class="btn" onclick="addExpense()">＋ Simpan Pengeluaran</button></div></div><div class="section card"><h2>Riwayat Pengeluaran</h2><div class="tablewrap"><table class="table"><tr><th>Tanggal & Jam</th><th>Kategori</th><th>Keterangan</th><th>Metode</th><th>Jumlah</th><th></th></tr>${db.expenses.map(x=>`<tr><td><b>${esc(dateTimeWib(x.created_at,x.expense_date))}</b></td><td>${esc(x.category)}</td><td>${esc(x.note)}</td><td>${esc(x.payment_method||'Belum diisi')}</td><td class="red">${rup(x.amount)}</td><td>${can('expenses.delete')?`<button class="link danger" onclick="del('expenses','${x.id}')">Hapus</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Belum ada pengeluaran.</td></tr>'}</table></div></div>`}
async function addExpense(){if(!requirePermission('expenses.create','mencatat pengeluaran'))return;const amount=Number($('eAmt').value)||0;const paymentMethod=$('ePay').value;const date=$('eDate').value;if(!paymentMethod)return alert('Silakan pilih metode pembayaran.');if(amount<=0)return alert('Jumlah harus lebih dari 0.');if(!assertCashOpen(date))return;const {error}=await sb.from('expenses').insert({business_id:profile.business_id,expense_date:date,category:$('eCat').value,note:$('eNote').value,amount,payment_method:paymentMethod,user_id:session.user.id});if(error)alert(error.message);else await loadAll(),render()}
function stockMovementRows(stockFilter=''){
  const rows=[];
  const add=(date,name,unit,delta,type,ref,note,order=0)=>{
    if(stockFilter && !ref.stock_id===stockFilter) return;
    rows.push({date,name,unit,delta,type,ref,note,order});
  };
  db.purchaseItems.forEach(pi=>{
    const p=db.purchases.find(x=>x.id===pi.purchase_id); if(!p) return;
    const st=db.stock.find(x=>x.id===pi.stock_id); if(!st) return;
    const cancelled=String(p.status||'').trim()==='Dibatalkan';
    const delta=(cancelled?-1:1)*Number(pi.qty||0);
    if(stockFilter && pi.stock_id!==stockFilter)return;
    rows.push({date:p.purchase_date||pi.created_at?.slice(0,10)||'',name:st.name,unit:st.unit,delta,type:cancelled?'Pembatalan Pembelian':'Pembelian',ref:{stock_id:pi.stock_id,id:p.id},note:`Nota ${p.invoice_no||'-'}${cancelled&&p.cancellation_reason?` — ${p.cancellation_reason}`:''}`,order:new Date(pi.created_at||p.created_at||0).getTime()});
  });
  (db.salesReturns||[]).forEach(ret=>{
    const sale=db.sales.find(x=>String(x.id)===String(ret.sale_id));
    if(!sale)return;
    const total=Number(ret.total_qty ?? (Number(ret.paid_qty||0)+Number(ret.free_qty||0)))||0;
    if(total<=0)return;
    const recipes=db.recipeItems.filter(r=>r.product_id===sale.product_id);
    const reason=String(ret.reason||'').trim();
    if(recipes.length){
      recipes.forEach(ri=>{
        const st=db.stock.find(x=>x.id===ri.stock_id); if(!st)return;
        if(stockFilter && ri.stock_id!==stockFilter)return;
        const qty=Number(ri.qty||0)*total;
        rows.push({date:ret.return_date||ret.created_at?.slice(0,10)||'',name:st.name,unit:st.unit,delta:qty,type:'Retur Penjualan',ref:{stock_id:ri.stock_id,id:ret.id},note:`${sale.product_name} × ${fmtNum(total)}${reason?` — ${reason}`:''}`,order:new Date(ret.created_at||ret.return_date||0).getTime()});
      });
    }else{
      const st=db.stock.find(x=>x.business_id===profile.business_id&&String(x.name||'').trim().toLowerCase()===String(sale.product_name||'').trim().toLowerCase());
      if(!st)return;
      if(stockFilter && st.id!==stockFilter)return;
      rows.push({date:ret.return_date||ret.created_at?.slice(0,10)||'',name:st.name,unit:st.unit,delta:total,type:'Retur Penjualan',ref:{stock_id:st.id,id:ret.id},note:`${sale.product_name} × ${fmtNum(total)}${reason?` — ${reason}`:''}`,order:new Date(ret.created_at||ret.return_date||0).getTime()});
    }
  });
  db.sales.forEach(sale=>{
    const cancelled=String(sale.status||'').trim()==='Dibatalkan';
    const sign=cancelled?1:-1;
    const recipes=db.recipeItems.filter(r=>r.product_id===sale.product_id);
    if(recipes.length){
      recipes.forEach(ri=>{
        const st=db.stock.find(x=>x.id===ri.stock_id); if(!st)return;
        if(stockFilter && ri.stock_id!==stockFilter)return;
        const qty=Number(ri.qty||0)*Number(sale.qty||0);
        rows.push({date:sale.sale_date||'',name:st.name,unit:st.unit,delta:sign*qty,type:cancelled?'Pembatalan Penjualan':'Penjualan',ref:{stock_id:ri.stock_id,id:sale.id},note:`${sale.product_name} × ${fmtNum(sale.qty)}${cancelled&&sale.cancellation_reason?` — ${sale.cancellation_reason}`:''}`,order:new Date(sale.created_at||sale.sale_date||0).getTime()});
      });
    }else{
      const st=db.stock.find(x=>x.business_id===profile.business_id&&String(x.name||'').trim().toLowerCase()===String(sale.product_name||'').trim().toLowerCase());
      if(!st)return;
      if(stockFilter && st.id!==stockFilter)return;
      const qty=Number(sale.qty||0);
      rows.push({date:sale.sale_date||'',name:st.name,unit:st.unit,delta:sign*qty,type:cancelled?'Pembatalan Penjualan':'Penjualan',ref:{stock_id:st.id,id:sale.id},note:`${sale.product_name} × ${fmtNum(sale.qty)}${cancelled&&sale.cancellation_reason?` — ${sale.cancellation_reason}`:''}`,order:new Date(sale.created_at||sale.sale_date||0).getTime()});
    }
  });
  (db.stockAdjustments||[]).forEach(adj=>{
    const st=db.stock.find(x=>String(x.id)===String(adj.stock_id)); if(!st)return;
    if(stockFilter && st.id!==stockFilter)return;
    const delta=Number(adj.delta||0);
    if(delta===0)return;
    rows.push({date:adj.adjustment_date||adj.created_at?.slice(0,10)||'',name:st.name,unit:st.unit,delta,type:'Penyesuaian Stok',ref:{stock_id:st.id,id:adj.id},note:`Stok opname: ${adj.old_qty} → ${adj.actual_qty}${adj.reason?` — ${adj.reason}`:''}`,order:new Date(adj.created_at||adj.adjustment_date||0).getTime()});
  });
  return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))||b.order-a.order);
}
function stockMovementHistoryHtml(){
  const sorted=[...db.stock].sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));
  const opts=sorted.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.unit)}</option>`).join('');
  const rows=stockMovementRows(window.stockMovementFilter||'').slice(0,200);
  const body=rows.length?rows.map(r=>`<tr><td>${esc(r.date||'-')}</td><td>${esc(r.name)}</td><td>${esc(r.type)}</td><td class="${r.delta>0?'green':'red'}"><b>${r.delta>0?'+':''}${fmtNum(r.delta)} ${esc(r.unit)}</b></td><td>${esc(r.note||'-')}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">Belum ada mutasi stok dari transaksi.</td></tr>';
  return `<div class="section card"><div class="cardhead"><h2>Riwayat Mutasi Stok</h2></div><div class="form"><div><label>Filter bahan / produk<select id="stockMovementFilter" onchange="window.stockMovementFilter=this.value;stock(document.getElementById('content'))"><option value="">Semua bahan / produk</option>${opts}</select></label></div></div><small class="hint">Riwayat ini menelusuri perubahan stok dari pembelian, penjualan, retur, pembatalan, dan penyesuaian stok opname. Tanda <b>+</b> berarti stok masuk dan <b>−</b> berarti stok keluar.</small><div class="tablewrap" style="margin-top:12px"><table class="table"><thead><tr><th>Tanggal</th><th>Bahan / Produk</th><th>Jenis</th><th>Perubahan</th><th>Keterangan</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
}
function stock(c){const canAdjust=canAny('stock.adjust','stock.opname');const canDelete=can('stock.adjust');const units=['pcs','botol','gelas','cup','gram','kg','ml','liter','dus','box','pack','sachet','buah'];const sortedStock=[...db.stock].sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'}));const unitOpts=units.map(u=>`<option value="${u}">${u}</option>`).join('');const stockOpts=sortedStock.map(x=>`<option value="${x.id}">${esc(x.name)} — ${x.qty} ${esc(x.unit)}</option>`).join('');c.innerHTML=`${canAdjust?`<div class="card form"><div><label>Pilih bahan / produk<select id="stPick" onchange="stockPickChanged()"><option value="">＋ Pilih bahan yang sudah ada</option>${stockOpts}</select></label><div style="margin-top:8px"><button type="button" class="btn small" onclick="newStockMode()">＋ Buat bahan / produk baru</button></div><small class="hint">Selalu pilih bahan yang sudah ada agar nama, resep, stok, dan HPP tetap terhubung.</small></div><div><label>Nama bahan / produk<input id="stName" placeholder="Pilih bahan dari daftar terlebih dahulu"></label></div><div><label>Satuan<select id="stUnit">${unitOpts}</select></label></div><div><label>Jumlah stok masuk<input id="stQty" type="number" step="0.01" value="0"></label></div><div><label>Batas minimum<input id="stMin" type="number" step="0.01" value="1"></label></div><div><label>Harga beli / satuan<input id="stCost" type="text" inputmode="decimal" value="0" oninput="formatCostInput(this)"><small class="hint">Masukkan harga pembelian baru. Jika stok lama masih ada, sistem menghitung rata-rata tertimbang.</small></label></div><div class="full"><button class="btn" onclick="addStock()">＋ Tambah Stok Masuk</button><small class="hint">Stok lama tidak dihapus. Harga rata-rata digunakan untuk HPP bahan.</small></div></div><div class="section card"><h2>Penyesuaian Stok</h2><div class="form"><div><label>Pilih bahan / produk<select id="adjStock">${stockOpts}</select></label></div><div><label>Jumlah fisik sebenarnya<input id="adjQty" type="number" step="0.01" value="0"></label></div><div><label>Alasan penyesuaian<input id="adjReason" placeholder="Contoh: hasil stok opname"></label></div><div class="full"><button class="btn" onclick="adjustStock()">✎ Simpan Penyesuaian</button><small class="hint">Gunakan jika stok fisik berbeda dengan stok di sistem.</small></div></div></div>`:''}<div class="section card"><h2>Stok Bahan</h2><div class="tablewrap"><table class="table"><tr><th>Bahan</th><th>Stok</th><th>Min.</th><th>Harga Rata-rata</th><th>Status</th><th></th></tr>${sortedStock.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.qty} ${esc(x.unit)}</td><td>${x.min_qty}</td><td>${rup(x.cost)}</td><td>${x.qty<=x.min_qty?'<span class="warn">Menipis</span>':'<span class="ok">Aman</span>'}</td><td>${canDelete?`<button class="link danger" onclick="del('stock','${x.id}')">Hapus</button>`:'-'}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Belum ada bahan.</td></tr>'}</table></div></div>${stockMovementHistoryHtml()}`;if(canAdjust)stockPickChanged()}

function newStockMode(){const pick=$('stPick');if(!pick)return;pick.value='__new__';stockPickChanged()}
function stockPickChanged(){const pick=$('stPick');if(!pick)return;const id=pick.value;const name=$('stName'),unit=$('stUnit'),min=$('stMin'),cost=$('stCost');if(id==='__new__'){name.value='';name.readOnly=false;unit.disabled=false;min.value='1';cost.value='0';name.focus();return}if(!id){name.value='';name.readOnly=false;unit.disabled=false;min.value='1';cost.value='0';return}const item=db.stock.find(x=>x.id===id);if(!item)return;name.value=item.name;name.readOnly=true;unit.value=item.unit;unit.disabled=true;min.value=item.min_qty;cost.value=fmtNum(item.cost)}
function formatCostInput(el){const raw=String(el.value??'');if(!raw)return;if(raw.includes(',')||/\d+\.\d{3}(\.|$)/.test(raw)){const n=parseNum(raw);if(Number.isFinite(n)&&n>0)el.value=fmtNum(n)}}
async function addStock(){if(!requireAnyPermission(['stock.adjust','stock.opname'],'menambah/menyesuaikan stok'))return;const pick=$('stPick').value;let name=$('stName').value.trim();const incoming=Number($('stQty').value)||0;const incomingCost=parseNum($('stCost').value);if(incoming<=0)return alert('Jumlah stok masuk harus lebih dari 0.');if(!pick)return alert('Pilih bahan / produk terlebih dahulu.');const old=pick==='__new__'?null:db.stock.find(x=>x.id===pick);if(pick==='__new__'){if(!name)return alert('Nama bahan / produk wajib diisi.');const dup=db.stock.find(x=>x.name.trim().toLowerCase()===name.toLowerCase());if(dup)return alert(`Bahan/produk "${dup.name}" sudah ada. Silakan pilih dari daftar, jangan membuat nama baru.`);if(!Number.isFinite(incomingCost)||incomingCost<=0)return alert('Harga beli / satuan harus lebih dari 0 untuk bahan baru.')}const unit=$('stUnit').value;const min=Number($('stMin').value)||0;let newQty=incoming;let newCost=incomingCost;if(old){const oldQty=Number(old.qty)||0;const oldCost=Number(old.cost)||0;newQty=oldQty+incoming;if(incomingCost>0){newCost=oldQty>0?((oldQty*oldCost)+(incoming*incomingCost))/newQty:incomingCost}else{newCost=oldCost}name=old.name}const obj={business_id:profile.business_id,name,unit,qty:newQty,min_qty:min,cost:Number(newCost.toFixed(6))};let q=old?sb.from('stock').update(obj).eq('id',old.id).eq('business_id',profile.business_id):sb.from('stock').insert(obj);const {error}=await q;if(error)alert(error.message);else{alert(old?`Stok ${name} menjadi ${newQty} ${unit}. Harga rata-rata ${rup(newCost)}.`:`Bahan ${name} ditambahkan ke stok.`);await loadAll();render()}}
async function adjustStock(){if(!requireAnyPermission(['stock.adjust','stock.opname'],'menyesuaikan stok'))return;const id=$('adjStock').value;const actual=Number($('adjQty').value);const reason=$('adjReason').value.trim();if(!id)return alert('Pilih bahan / produk terlebih dahulu.');if(!Number.isFinite(actual)||actual<0)return alert('Jumlah fisik tidak valid.');if(!reason)return alert('Alasan penyesuaian wajib diisi.');const item=db.stock.find(x=>x.id===id);if(!item)return alert('Data stok tidak ditemukan.');const oldQty=Number(item.qty||0);if(actual===oldQty)return alert('Jumlah fisik sama dengan stok sistem. Tidak ada penyesuaian yang perlu disimpan.');const {data,error}=await sb.rpc('adjust_stock_with_log',{p_business_id:profile.business_id,p_stock_id:id,p_actual_qty:actual,p_reason:reason,p_adjustment_date:localISO(new Date())});if(error){alert(error.message);return}alert(`Stok ${item.name} disesuaikan menjadi ${actual} ${item.unit}. Riwayat stok opname tersimpan.`);await loadAll();render()}
function localISO(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function setReportPreset(preset){const d=new Date();let from,to=localISO(d);if(preset==='today'){from=to}else if(preset==='yesterday'){const x=new Date(d);x.setDate(x.getDate()-1);from=to=localISO(x)}else if(preset==='7days'){const x=new Date(d);x.setDate(x.getDate()-6);from=localISO(x)}else if(preset==='month'){from=localISO(new Date(d.getFullYear(),d.getMonth(),1))}else if(preset==='lastmonth'){from=localISO(new Date(d.getFullYear(),d.getMonth()-1,1));to=localISO(new Date(d.getFullYear(),d.getMonth(),0))}else{window.reportPreset='custom';render();return}window.reportFrom=from;window.reportTo=to;window.reportPreset=preset;render()}
function cashClosingCalc(date,opening){
  const s=activeSales(db.sales.filter(x=>x.sale_date===date && String(x.payment||'').trim()==='Tunai'));
  const rp=db.receivablePayments.filter(x=>x.payment_date===date && String(x.payment_method||'').trim()==='Tunai');
  const e=db.expenses.filter(x=>x.expense_date===date && String(x.payment_method||'').trim()==='Tunai');
  const p=activePurchases(db.purchases.filter(x=>x.purchase_date===date && String(x.payment_method||'').trim()==='Tunai'));
  const sp=db.supplierPayments.filter(x=>x.payment_date===date && String(x.payment_method||'').trim()==='Tunai');
  const refunds=db.salesRefunds.filter(x=>x.refund_date===date && String(x.payment_method||'').trim()==='Tunai');
  const withdrawals=(db.cashWithdrawals||[]).filter(x=>x.withdrawal_date===date);
  const salesCash=s.reduce((a,x)=>a+saleRevenue(x),0), receivableCash=rp.reduce((a,x)=>a+Number(x.amount||0),0), expenseCash=e.reduce((a,x)=>a+Number(x.amount||0),0), purchaseCash=p.reduce((a,x)=>a+Number(x.total||0),0), supplierCash=sp.reduce((a,x)=>a+Number(x.amount||0),0), refundCash=refunds.reduce((a,x)=>a+Number(x.amount||0),0);
  const withdrawalCash=withdrawals.reduce((a,x)=>a+(String(x.flow_type||'PENARIKAN')==='PENARIKAN'?Number(x.amount||0):0),0);
  const depositCash=withdrawals.reduce((a,x)=>a+(String(x.flow_type||'PENARIKAN')==='SETORAN'?Number(x.amount||0):0),0);
  const cashIn=salesCash+receivableCash+depositCash, cashOut=expenseCash+purchaseCash+supplierCash+refundCash+withdrawalCash, expected=Number(opening||0)+cashIn-cashOut;
  return {salesCash,receivableCash,expenseCash,purchaseCash,supplierCash,refundCash,withdrawalCash,depositCash,cashIn,cashOut,expected};
}
function cashClosingTargetTime(){return String(business?.cash_closing_time||'22:00').slice(0,5)}
function cashClosingTargetReached(date){if(String(date||'')!==today())return false;const now=new Date();const [h,m]=cashClosingTargetTime().split(':').map(Number);return now.getHours()*60+now.getMinutes() >= (h*60+m)}
function previousClosing(date){
  return [...(db.cashClosings||[])].filter(x=>String(x.closing_date||'')<date).sort((a,b)=>String(b.closing_date).localeCompare(String(a.closing_date)))[0]||null;
}
function isCashClosed(date){
  return !!date && (db.cashClosings||[]).some(x=>String(x.closing_date||'')===String(date));
}
function cashOpenMessage(date){
  return `Kas tanggal ${date} sudah ditutup. Transaksi baru pada tanggal tersebut tidak dapat dicatat. Buka/revisi tutup kas terlebih dahulu.`;
}
function assertCashOpen(date){
  if(isCashClosed(date)){alert(cashOpenMessage(date));return false}
  return true
}
async function openCashPeriod(){
  if(!requirePermission('cash.open','membuka kas'))return;
  const date=window.cashClosingDate||document.getElementById('ccDate')?.value||today();
  if(!date)return alert('Tanggal kas wajib diisi.');
  if(!['pemilik','supervisor'].includes(profile.role)){
    const now=new Date(), hh=now.getHours(), mm=now.getMinutes();
    const openTime=String(business?.cash_open_time||'07:00').slice(0,5).split(':').map(Number);
    if(hh*60+mm < openTime[0]*60+openTime[1])return alert(`Kas baru dapat dibuka mulai pukul ${String(openTime[0]).padStart(2,'0')}:${String(openTime[1]).padStart(2,'0')} WIB.`);
  }
  const status=await getCashOperationalStatus(date);if(status?.opened)return alert(`Kas ${date} sudah dibuka pada ${status.opened_at?new Date(status.opened_at).toLocaleString('id-ID'):'waktu yang tercatat'}.`);
  const prev=previousClosing(date), opening=prev?Number(prev.actual_cash||0):Number(status?.previous_closing_actual||0);
  const {data,error}=await sb.rpc('open_cash_period',{p_business_id:profile.business_id,p_opening_date:date,p_opening_cash:opening});
  if(error)return alert(`Gagal membuka kas: ${error.message}`);
  alert(`Kas ${date} berhasil dibuka. Saldo awal ${rup(opening)}.`);await loadAll();render();
}

async function getCashOperationalStatus(date){
  const {data,error}=await sb.rpc('get_cash_operational_status',{p_business_id:profile.business_id,p_cash_date:date});
  if(error){alert(`Gagal memeriksa status kas: ${error.message}`);return null}
  return data||null;
}
function cashWithdrawal(c){
  if(profile?.role!=='pemilik'){c.innerHTML='<div class="card"><h2>💸 Penarikan/Setoran Kas</h2><p class="muted">Menu ini hanya dapat digunakan oleh Pemilik.</p></div>';return;}
  const date=today();
  const openingRec=(db.cashOpenings||[]).find(x=>String(x.opening_date)===date)||null;
  const opening=Number(openingRec?.opening_cash||0);
  const calc=cashClosingCalc(date,opening);
  const balance=Number(calc.expected||0);
  const status=db.cashOperationalStatus||{};
  const closed=!!status.closed;
  const rows=(db.cashWithdrawals||[]).filter(x=>String(x.withdrawal_date)===date).map(x=>{const flow=String(x.flow_type||'PENARIKAN');const flowLabel=flow==='SETORAN'?'SETORAN':'PENARIKAN';const amountClass=flow==='SETORAN'?'green':'red';const amountPrefix=flow==='SETORAN'?'+':'-';return `<tr><td><b>${esc(dateTimeWib(x.created_at,x.withdrawal_date))}</b></td><td class="${amountClass}"><b>${flowLabel}</b></td><td>${esc(x.withdrawal_type)}</td><td class="${amountClass}"><b>${amountPrefix}${rup(x.amount)}</b></td><td>${esc(x.purpose)}</td><td>${esc(x.recipient_name)}</td><td>${esc(x.note||'-')}</td></tr>`}).join('');
  c.innerHTML=`
  <div class="card form">
    <div><label>Tanggal<input type="date" value="${date}" readonly></label></div>
    <div><label>Saldo Kas Saat Ini<input type="text" value="${rup(balance)}" readonly></label></div>
    <div><label>Arah Kas<select id="cwFlow" onchange="cashFlowChanged()"><option value="PENARIKAN">Penarikan Kas</option><option value="SETORAN">Setoran Kas</option></select></label></div>
    <div><label>Jenis<select id="cwType"></select></label></div>
    <div><label>Jumlah (Rp)<input id="cwAmount" type="number" min="1" step="1" value="0"></label></div>
    <div><label>Tujuan/Keterangan<input id="cwPurpose" placeholder="Contoh: transfer hasil penjualan ke rekening usaha"></label></div>
    <div><label>Penerima/Penyetor<input id="cwRecipient" placeholder="Nama penerima / penyetor"></label></div>
    <div class="full"><label>Keterangan Tambahan<input id="cwNote" placeholder="Opsional"></label></div>
    <div class="full"><button class="btn" onclick="saveCashWithdrawal()" ${!openingRec||closed?'disabled':''}>💸 Simpan Penarikan/Setoran Kas</button></div>
    ${!openingRec?'<small class="hint">Kas hari ini belum dibuka.</small>':closed?'<small class="hint">Kas hari ini sudah ditutup. Penarikan/setoran tidak dapat dilakukan.</small>':'<small class="hint">Penarikan mengurangi saldo kas. Setoran menambah saldo kas. Semua transaksi tercatat di audit.</small>'}
  </div>
  <div class="section card"><h2>Riwayat Penarikan/Setoran Kas</h2><div class="tablewrap"><table class="table"><thead><tr><th>Tanggal & Jam</th><th>Arah</th><th>Jenis</th><th>Jumlah</th><th>Tujuan/Keterangan</th><th>Penerima/Penyetor</th><th>Keterangan Tambahan</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="empty">Belum ada penarikan/setoran kas hari ini.</td></tr>'}</tbody></table></div></div>`;
  cashFlowChanged();
}
function cashFlowChanged(){
  const flow=$('cwFlow')?.value||'PENARIKAN';
  const type=$('cwType');
  if(!type)return;
  const options=flow==='SETORAN'
    ? [['SETORAN DARI PEMILIK','Setoran dari Pemilik'],['TRANSFER DARI BANK','Transfer dari Bank'],['PENGEMBALIAN KE KAS','Pengembalian ke Kas'],['LAINNYA','Lainnya']]
    : [['TRANSFER KE BANK','Transfer ke Bank'],['PENGAMBILAN PRIBADI PEMILIK','Pengambilan Pribadi Pemilik'],['PENYERAHAN KE PEMILIK','Penyerahan ke Pemilik'],['LAINNYA','Lainnya']];
  type.innerHTML=options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
}
async function saveCashWithdrawal(){
  if(!requirePermission('cash.withdrawal','melakukan penarikan/setoran kas'))return;
  const amount=Number($('cwAmount')?.value)||0;
  const flow=$('cwFlow')?.value||'PENARIKAN';
  const type=$('cwType')?.value||'';
  const purpose=$('cwPurpose')?.value.trim()||'';
  const recipient=$('cwRecipient')?.value.trim()||'';
  const note=$('cwNote')?.value.trim()||'';
  if(amount<=0)return alert('Jumlah harus lebih dari 0.');
  if(!purpose)return alert('Tujuan/Keterangan wajib diisi.');
  if(!recipient)return alert('Nama penerima/penyetor wajib diisi.');
  const {data,error}=await sb.rpc('record_cash_withdrawal',{p_business_id:profile.business_id,p_amount:amount,p_withdrawal_type:type,p_purpose:purpose,p_recipient_name:recipient,p_note:note,p_flow_type:flow});
  if(error)return alert(`Gagal menyimpan penarikan/setoran kas: ${error.message}`);
  alert(`Penarikan/setoran kas berhasil. Saldo kas sekarang ${rup(data?.balance_after||0)}.`);
  await loadAll();render();
}
async function cashClosing(c){
  if(!requirePermission('cash.closing','menutup kas')){c.innerHTML='<div class="card"><h2>💰 Tutup Kas Harian</h2><p class="muted">Anda tidak memiliki izin untuk menutup kas.</p></div>';return;}
  const isOwnerLike=['pemilik','supervisor'].includes(profile.role);
  const date=window.cashClosingDate||today();
  const operationalStatus=db.cashOperationalStatus?.cash_date===date?db.cashOperationalStatus:null;
  const openingRec=(db.cashOpenings||[]).find(x=>String(x.opening_date)===String(date))||(operationalStatus?.opened?{opening_date:date,opening_cash:operationalStatus.opening_cash||0,opened_at:operationalStatus.opened_at}:null);
  const cashStatusDebug=JSON.stringify({role:profile?.role||null,date,raw:db.cashOperationalStatus||null,matched:!!operationalStatus,opened:operationalStatus?.opened??null});
  const existing=(db.cashClosings||[]).find(x=>x.closing_date===date)||(!isOwnerLike&&operationalStatus?.closed?{closing_date:date,actual_cash:operationalStatus.closing_actual_cash,expected_cash:operationalStatus.closing_expected_cash,difference:operationalStatus.closing_difference,opening_cash:operationalStatus.closing_opening_cash,notes:operationalStatus.closing_notes,closed_at:operationalStatus.closing_at}:null), prev=previousClosing(date);
  const suggested=existing?Number(existing.opening_cash||0):(openingRec?Number(openingRec.opening_cash||0):(prev?Number(prev.actual_cash||0):Number(operationalStatus?.previous_closing_actual||0)));
  const calc=cashClosingCalc(date,suggested), targetTime=cashClosingTargetTime(), targetReached=cashClosingTargetReached(date);
  const balanceResult=await sb.rpc('get_current_cash_balance',{p_business_id:profile.business_id,p_cash_date:date});
  if(balanceResult.error){c.innerHTML=`<div class="card"><h2>💰 Tutup Kas Harian</h2><p class="red">Gagal menghitung saldo kas: ${esc(balanceResult.error.message)}</p></div>`;return;}
  const serverBalance=Number(balanceResult.data?.current_cash_balance ?? balanceResult.data?.[0]?.current_cash_balance);
  window.cashClosingExpected=Number.isFinite(serverBalance)?serverBalance:calc.expected;
  const actual=existing?Number(existing.actual_cash||0):Number(window.cashClosingActual||0), diff=actual-window.cashClosingExpected;
  const history=[...(db.cashClosings||[])].sort((a,b)=>String(b.closing_date).localeCompare(String(a.closing_date)));
  const reopenButtons=isOwnerLike?history.map(x=>`<button class="link" onclick="reopenCashClosing('${x.closing_date}')">Buka/Revisi</button>`):history.map(x=>'-');
  c.innerHTML=`<div class="card form">
  <div><label>Tanggal Kas<input id="ccDate" type="date" value="${date}" ${isOwnerLike?'':'readonly'} onchange="window.cashClosingDate=this.value;window.cashClosingActual='';render()"></label><small class="hint">${isOwnerLike?'Pemilik/Supervisor dapat memilih tanggal.':'Kasir mengikuti hari berjalan.'}</small></div>
  <div><label>Saldo Awal Kas (Rp)<input id="ccOpening" type="number" min="0" value="${suggested}" readonly><small class="hint">${openingRec?`Kas dibuka ${esc(new Date(openingRec.opened_at).toLocaleString('id-ID'))}`:prev?`Mengikuti saldo fisik penutupan ${esc(prev.closing_date)}: ${rup(prev.actual_cash)}`:'Belum ada pembukaan kas.'}</small></label></div>
  <div><label>Uang Fisik Akhir (Rp)<input id="ccActual" type="number" min="0" value="${actual}" ${existing?'readonly':''} oninput="window.cashClosingActual=this.value;ccRefresh()"></label></div>
  <div class="full"><div class="hint">🕘 Jam kerja kas: <b>07:00–${targetTime} WIB</b>${targetReached&&!existing&&!isOwnerLike?' · <b style="color:#b00020">Batas tutup kas manual Kasir telah berakhir.</b>':targetReached&&!existing?' · <b>Waktu tutup kas hari ini telah tercapai.</b>':''}</div>
  ${!openingRec&&!existing&&isOwnerLike&&date>today()?`<div class="full" style="padding:10px;border:1px solid #e7c86b;background:#fff8df;border-radius:8px"><b>⚠️ Tanggal masa depan</b><div class="hint">Tanggal ini belum berjalan. Untuk pengujian, hanya Pemilik dapat membuka kas melalui mode khusus. Kasir tetap tidak dapat melakukan transaksi masa depan.</div><button class="btn" onclick="openCashPeriodOwnerTest()">🧪 Buka Kas PENGUJIAN — Pemilik</button></div>`:!openingRec&&!existing?`<button class="btn" onclick="openCashPeriod()">🟢 Buka Kas Tanggal Ini</button>`:''}
  <button class="btn" onclick="saveCashClosing()" ${existing||(!openingRec&&!isOwnerLike)||(!isOwnerLike&&targetReached)?'disabled':''}>${existing?'🔒 Kas Sudah Ditutup':(!isOwnerLike&&targetReached?'🔒 Batas Tutup Kas Terlewati':'🔒 Simpan Tutup Kas')}</button></div></div>
  <div class="section grid2"><div class="card"><h2>Perhitungan Kas ${esc(date)}</h2><div class="barrow"><span>Saldo awal</span><b>${rup(suggested)}</b></div><div class="barrow"><span>Penjualan Tunai</span><b class="green">+${rup(calc.salesCash)}</b></div><div class="barrow"><span>Pembayaran Piutang Tunai</span><b class="green">+${rup(calc.receivableCash)}</b></div><div class="barrow"><span>Pengeluaran Tunai</span><b class="red">-${rup(calc.expenseCash)}</b></div>${isOwnerLike?`<div class="barrow"><span>Pembelian Tunai</span><b class="red">-${rup(calc.purchaseCash)}</b></div><div class="barrow"><span>Pembayaran Utang Supplier Tunai</span><b class="red">-${rup(calc.supplierCash)}</b></div><div class="barrow"><span>Penarikan Kas</span><b class="red">-${rup(calc.withdrawalCash)}</b></div><div class="barrow"><span>Setoran Kas</span><b class="green">+${rup(calc.depositCash)}</b></div>`:''}<div class="line" style="border-top:1px solid #d9e4e2;margin:10px 0"></div><div class="barrow"><span><b>Saldo Kas Seharusnya</b></span><b class="blue" id="ccExpected">${rup(window.cashClosingExpected)}</b></div><div class="barrow"><span><b>Selisih</b></span><b id="ccDiff" class="${diff===0?'green':'red'}">${rup(diff)}</b></div></div>
  <div class="card"><h2>Status</h2>${existing?`<p class="ok"><b>Kas tanggal ${esc(date)} sudah ditutup.</b></p>${profile.role==='pemilik'?`<p>Uang fisik akhir: <b>${rup(existing.actual_cash)}</b></p><p>Selisih: <b>${rup(existing.difference)}</b></p><p class="muted">Ditutup ${esc(existing.closed_at||existing.created_at||'')}</p>`:'<p class="muted">Status penutupan tersimpan. Rincian riwayat kas hanya dapat dilihat oleh Pemilik.</p>'}`:openingRec?`<p class="ok"><b>Kas aktif.</b></p><p>Kas dibuka: <b>${esc(new Date(openingRec.opened_at).toLocaleString('id-ID'))}</b></p><p class="muted">Setelah ditutup, Kasir tidak dapat mencatat transaksi lagi untuk tanggal tersebut.</p>`:`<p class="muted">Kas belum dibuka untuk tanggal ini.</p>`}</div></div>
  <div class="section card"><h2>Riwayat Tutup Kas</h2><div class="tablewrap"><table class="table"><tr><th>Tanggal & Jam</th><th>Saldo Awal</th><th>Kas Seharusnya</th><th>Fisik Akhir</th><th>Selisih</th><th>Catatan</th><th>Aksi</th></tr>${history.map((x,i)=>`<tr><td><b>${esc(dateTimeWib(x.closed_at||x.created_at,x.closing_date))}</b></td><td>${rup(x.opening_cash)}</td><td>${rup(x.expected_cash)}</td><td>${rup(x.actual_cash)}</td><td class="${Number(x.difference||0)===0?'green':'red'}"><b>${rup(x.difference)}</b></td><td>${esc(x.notes||'-')}</td><td>${reopenButtons[i]}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">Belum ada riwayat tutup kas.</td></tr>'}</table></div></div>`;
}
function ccRefresh(){const date=$('ccDate')?.value||today(), opening=Number($('ccOpening')?.value)||0, actual=Number($('ccActual')?.value)||0, calc=cashClosingCalc(date,opening), expected=Number.isFinite(Number(window.cashClosingExpected))?Number(window.cashClosingExpected):calc.expected;if($('ccExpected'))$('ccExpected').textContent=rup(expected);if($('ccDiff')){$('ccDiff').textContent=rup(actual-expected);$('ccDiff').className=actual===expected?'green':'red'}}
async function reopenCashClosing(date){if(!requirePermission('cash.closing','membuka kembali tutup kas'))return;if(!confirm(`Buka kembali tutup kas ${date}? Setelah dibuka, transaksi pada tanggal tersebut dapat dicatat kembali.`))return;const {data,error}=await sb.rpc('reopen_cash_closing',{p_business_id:profile.business_id,p_closing_date:date});if(error)return alert(`Gagal membuka kembali: ${error.message}`);alert(`Tutup kas ${date} dibuka kembali.`);window.cashClosingDate=date;await loadAll();render()}
async function openCashPeriodOwnerTest(){
  if(profile?.role!=='pemilik')return alert('Mode pengujian kas tanggal masa depan hanya dapat digunakan oleh Pemilik.');
  const date=$('ccDate')?.value||today();
  if(date<=today())return alert('Mode pengujian hanya untuk tanggal masa depan.');
  const opening=Number($('ccOpening')?.value)||0;
  if(!confirm(`BUKA KAS PENGUJIAN\n\nTanggal: ${date}\nSaldo awal: ${rup(opening)}\n\nFitur ini khusus Pemilik untuk pengujian dan bukan untuk operasional bisnis nyata. Lanjutkan?`))return;
  const {data,error}=await sb.rpc('open_cash_period_owner_test',{p_business_id:profile.business_id,p_opening_date:date,p_opening_cash:opening});
  if(error)return alert(`Gagal membuka kas pengujian: ${error.message}`);
  try{sessionStorage.setItem('ceof_future_cash_test_date',date)}catch(e){}
  alert(`Kas PENGUJIAN ${date} berhasil dibuka. Saldo awal ${rup(opening)}.`);
  window.cashClosingDate=date;
  await loadAll();render();
}

async function saveCashClosing(){if(!requirePermission('cash.closing','menutup kas'))return;const date=$('ccDate')?.value||today(),opening=Number($('ccOpening')?.value)||0,actual=Number($('ccActual')?.value)||0;if(!date)return alert('Tanggal kas wajib diisi.');const status=await getCashOperationalStatus(date);if(!status)return;if(status.closed)return alert(`Kas tanggal ${date} sudah ditutup.`);if(!status.opened)return alert(`Kas tanggal ${date} belum dibuka. Buka kas terlebih dahulu.`);const exists=(db.cashClosings||[]).find(x=>x.closing_date===date);if(exists)return alert('Kas pada tanggal tersebut sudah ditutup.');const balanceResult=await sb.rpc('get_current_cash_balance',{p_business_id:profile.business_id,p_cash_date:date});if(balanceResult.error)return alert(`Gagal menghitung saldo kas: ${balanceResult.error.message}`);const expected=Number(balanceResult.data?.current_cash_balance ?? balanceResult.data?.[0]?.current_cash_balance);if(!Number.isFinite(expected))return alert('Saldo kas dari server tidak valid.');const difference=actual-expected;const notes=difference===0?'Seimbang':`Selisih kas ${difference>0?'lebih':'kurang'} ${rup(Math.abs(difference))}`;const {error}=await sb.from('cash_closings').insert({business_id:profile.business_id,closing_date:date,opening_cash:opening,expected_cash:expected,actual_cash:actual,difference,notes,closed_by:session.user.id});if(error)return alert(`Gagal menyimpan tutup kas: ${error.message}`);window.cashClosingActual='';window.cashClosingOpening='';window.cashClosingExpected='';alert(`Tutup kas ${date} berhasil disimpan. Selisih: ${rup(difference)}.`);await loadAll();render()}

function cashierReports(c){
  const from=window.reportFrom||today(),to=window.reportTo||today();
  const sales=activeSales(db.sales.filter(x=>x.sale_date>=from&&x.sale_date<=to));
  const expenses=(db.expenses||[]).filter(x=>x.expense_date>=from&&x.expense_date<=to&&String(x.user_id||'')===String(session.user.id));
  const methods=['Tunai','QRIS','Transfer'];
  const methodRows=methods.map(m=>{const salesIn=sales.filter(x=>String(x.payment||'')===m).reduce((a,x)=>a+saleRevenue(x),0);const recv=(db.receivablePayments||[]).filter(x=>x.payment_date>=from&&x.payment_date<=to&&String(x.payment_method||'')===m).reduce((a,x)=>a+Number(x.amount||0),0);return `<tr><td>${m}</td><td>${rup(salesIn)}</td><td>${rup(recv)}</td><td>${rup(salesIn+recv)}</td></tr>`}).join('');
  const prod={};sales.forEach(x=>{prod[x.product_name]=(prod[x.product_name]||0)+salePaidQty(x);});
  const prodRows=Object.entries(prod).sort((a,b)=>b[1]-a[1]).map(([n,q])=>`<tr><td>${esc(n)}</td><td>${fmtNum(q)}</td></tr>`).join('');
  const cashIn=sales.filter(x=>['Tunai','QRIS','Transfer'].includes(String(x.payment||''))).reduce((a,x)=>a+saleRevenue(x),0)+(db.receivablePayments||[]).filter(x=>x.payment_date>=from&&x.payment_date<=to).reduce((a,x)=>a+Number(x.amount||0),0);
  const cashOut=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
  c.innerHTML=`<div class="card"><h2>📈 Laporan Operasional Kasir</h2><div class="form"><label>Dari<input type="date" id="crFrom" value="${from}"></label><label>Sampai<input type="date" id="crTo" value="${to}"></label><div><button class="btn" onclick="window.reportFrom=$('crFrom').value;window.reportTo=$('crTo').value;render()">Tampilkan</button></div></div></div><div class="section card"><h3>Ringkasan Uang per Metode</h3><div class="tablewrap"><table class="table"><tr><th>Metode</th><th>Penjualan</th><th>Piutang Dibayar</th><th>Total Masuk</th></tr>${methodRows}</table></div></div><div class="section card"><h3>Produk Terjual</h3><div class="tablewrap"><table class="table"><tr><th>Produk</th><th>Qty</th></tr>${prodRows||'<tr><td colspan="2" class="empty">Belum ada data.</td></tr>'}</table></div></div><div class="section grid2"><div class="card"><h3>Kas Masuk Periode</h3><b class="green">${rup(cashIn)}</b></div><div class="card"><h3>Arus Kas Keluar Periode</h3><b class="red">${rup(cashOut)}</b><p class="muted small">Hanya pengeluaran operasional yang dicatat oleh akun Kasir ini.</p></div></div><div class="section card"><h3>Pengeluaran Operasional Kasir</h3>${expenses.length?`<div class="tablewrap"><table class="table"><tr><th>Tanggal & Jam</th><th>Keterangan</th><th>Nominal</th><th>Metode</th></tr>${expenses.map(x=>`<tr><td><b>${esc(dateTimeWib(x.created_at,x.expense_date))}</b></td><td>${esc(x.note||x.category||'-')}</td><td>${rup(x.amount)}</td><td>${esc(x.payment_method||'-')}</td></tr>`).join('')}</table></div>`:'<div class="empty">Belum ada pengeluaran operasional yang dicatat akun ini.</div>'}</div>`;
}

function reports(c){
  if(profile.role==='kasir'){cashierReports(c);return;}
  const from=window.reportFrom||today(),
        to=window.reportTo||today(),
        preset=window.reportPreset||'today',
        s=activeSales(db.sales.filter(x=>x.sale_date>=from&&x.sale_date<=to)),
        e=db.expenses.filter(x=>x.expense_date>=from&&x.expense_date<=to),
        p=activePurchases(db.purchases.filter(x=>x.purchase_date>=from&&x.purchase_date<=to)),
        sp=db.supplierPayments.filter(x=>x.payment_date>=from&&x.payment_date<=to),
        rp=db.receivablePayments.filter(x=>x.payment_date>=from&&x.payment_date<=to),
        t=totals(s,from,to),
        programCost=fridayProgramCostForSales(s),
        grossSales=s.reduce((a,x)=>a+saleGross(x),0),
        discountTotal=s.reduce((a,x)=>a+Number(x.discount_amount||0),0),
        out=e.reduce((a,x)=>a+Number(x.amount),0),
        outWithProgram=out+programCost,
        purchaseCash=p.filter(x=>['Tunai','Transfer','Transfer Bank','QRIS'].includes(String(x.payment_method||'').trim()))
          .reduce((a,x)=>a+Number(x.total||0),0),
        supplierPaid=sp.reduce((a,x)=>a+Number(x.amount||0),0),
        refundPaid= (db.salesRefunds||[]).filter(x=>x.refund_date>=from&&x.refund_date<=to).reduce((a,x)=>a+Number(x.amount||0),0),
        receivablePaidPeriod=rp.reduce((a,x)=>a+Number(x.amount||0),0),
        cashIn=s.filter(x=>['Tunai','QRIS','Transfer','Transfer Bank'].includes(String(x.payment||'').trim()))
          .reduce((a,x)=>a+saleRevenue(x),0)+receivablePaidPeriod,
        cashOut=out+purchaseCash+supplierPaid+refundPaid,
        allCashIn=activeSales(db.sales).filter(x=>String(x.payment||'').trim()==='Tunai')
          .reduce((a,x)=>a+saleRevenue(x),0),
        allPurchaseCash=activePurchases(db.purchases).filter(x=>String(x.payment_method||'').trim()==='Tunai')
          .reduce((a,x)=>a+Number(x.total||0),0),
        allExpenses=db.expenses.reduce((a,x)=>a+Number(x.amount||0),0),
        allSupplierPaid=db.supplierPayments.filter(x=>String(x.payment_method||'').trim()==='Tunai')
          .reduce((a,x)=>a+Number(x.amount||0),0),
        allRefundCash=(db.salesRefunds||[]).filter(x=>String(x.payment_method||'').trim()==='Tunai').reduce((a,x)=>a+Number(x.amount||0),0),
        allReceivablePaid=db.receivablePayments.filter(x=>String(x.payment_method||'').trim()==='Tunai')
          .reduce((a,x)=>a+Number(x.amount||0),0),
        recordedCash=allCashIn+allReceivablePaid-allPurchaseCash-allExpenses-allSupplierPaid-allRefundCash,
        debtBought=activePurchases(db.purchases).filter(x=>String(x.payment_method||'').trim()==='Utang')
          .reduce((a,x)=>a+Number(x.total||0),0),
        debtPaid=db.supplierPayments.reduce((a,x)=>a+Number(x.amount||0),0),
        debtOutstanding=Math.max(0,debtBought-debtPaid),
        receivable=Math.max(0,activeSales(db.sales).filter(x=>String(x.payment||'').trim()==='Piutang').reduce((a,x)=>a+saleRevenue(x),0)-allReceivablePaid),
        by={};
  s.forEach(x=>by[x.product_name]=(by[x.product_name]||0)+Number(x.qty));
  const normPay=v=>{const m=String(v||'').trim();return m==='Transfer Bank'?'Transfer':m};
  const methods=['Tunai','QRIS','Transfer'];
  const flowByMethod={};
  methods.forEach(m=>{
    const salesIn=s.filter(x=>normPay(x.payment)===m).reduce((a,x)=>a+saleRevenue(x),0);
    const receivableIn=rp.filter(x=>normPay(x.payment_method)===m).reduce((a,x)=>a+Number(x.amount||0),0);
    const expenseOut=e.filter(x=>normPay(x.payment_method)===m).reduce((a,x)=>a+Number(x.amount||0),0);
    const purchaseOut=p.filter(x=>normPay(x.payment_method)===m).reduce((a,x)=>a+Number(x.total||0),0);
    const supplierOut=sp.filter(x=>normPay(x.payment_method)===m).reduce((a,x)=>a+Number(x.amount||0),0);
    const refundOut=(db.salesRefunds||[]).filter(x=>x.refund_date>=from&&x.refund_date<=to&&normPay(x.payment_method)===m).reduce((a,x)=>a+Number(x.amount||0),0);
    flowByMethod[m]={salesIn,receivableIn,expenseOut,purchaseOut,supplierOut,refundOut,totalIn:salesIn+receivableIn,totalOut:expenseOut+purchaseOut+supplierOut+refundOut,net:salesIn+receivableIn-expenseOut-purchaseOut-supplierOut-refundOut};
  });
  const cashNet=cashIn-cashOut;
  c.innerHTML=`<div class="card form">
    <div><label>Periode cepat<select id="rPreset" onchange="setReportPreset(this.value)">
      <option value="today" ${preset==='today'?'selected':''}>Hari Ini</option>
      <option value="yesterday" ${preset==='yesterday'?'selected':''}>Kemarin</option>
      <option value="7days" ${preset==='7days'?'selected':''}>7 Hari Terakhir</option>
      <option value="month" ${preset==='month'?'selected':''}>Bulan Ini</option>
      <option value="lastmonth" ${preset==='lastmonth'?'selected':''}>Bulan Lalu</option>
      <option value="custom" ${preset==='custom'?'selected':''}>Tanggal Custom</option>
    </select></label></div>
    <div><label>Dari<input id="rFrom" type="date" value="${from}"></label></div>
    <div><label>Sampai<input id="rTo" type="date" value="${to}"></label></div>
    <div class="full"><button class="btn" onclick="window.reportFrom=$('rFrom').value;window.reportTo=$('rTo').value;window.reportPreset='custom';render()">Tampilkan</button>
    <button class="btn secondary" onclick="printReport()">Cetak</button></div>
  </div>
  <div class="section card">
    <div class="cardhead"><div><h2>Laporan Laba Rugi</h2><small class="muted">Periode ${from} s.d. ${to}</small></div><strong class="blue">${rup(t.omzet-t.hpp-out)}</strong></div>
    <div class="barrow"><span>Penjualan Kotor</span><b>${rup(grossSales)}</b></div>
    <div class="barrow"><span>Potongan/Diskon</span><b class="red">-${rup(discountTotal)}</b></div>
    <div class="barrow"><span>Penjualan Bersih</span><b>${rup(t.omzet)}</b></div>
    <div class="barrow"><span>HPP Penjualan</span><b>${rup(t.hpp)}</b></div>
    <div class="barrow"><span><b>Laba Kotor</b></span><b class="green">${rup(t.omzet-t.hpp)}</b></div>
    <div class="barrow"><span>Beban Operasional</span><b class="red">${rup(out)}</b></div><div class="barrow"><span>Beban Program Jumat Berkah</span><b class="red">${rup(programCost)}</b></div>
    <div class="line" style="border-top:1px solid #d9e4e2;margin:10px 0"></div>
    <div class="barrow"><span><b>Laba Bersih</b></span><b class="blue">${rup(t.omzet-t.hpp-outWithProgram)}</b></div>
    <p class="muted small" style="margin-top:10px">Catatan: pembelian bahan/stok tidak langsung menjadi beban laba rugi. Pembelian dicatat sebagai persediaan, sedangkan biaya yang masuk laba rugi adalah HPP dari barang yang terjual. Pengeluaran yang dicatat di menu Pengeluaran masuk sebagai beban operasional.</p>
  </div>
  <div class="grid section">
    <div class="card metric"><small>Omzet</small><strong class="green">${rup(t.omzet)}</strong></div>
    <div class="card metric"><small>HPP</small><strong>${rup(t.hpp)}</strong></div>
    <div class="card metric"><small>Pengeluaran</small><strong class="red">${rup(out)}</strong></div>
    <div class="card metric"><small>Laba Bersih</small><strong class="blue">${rup(t.omzet-t.hpp-out)}</strong></div>
    <div class="card metric"><small>Kas Masuk Periode</small><strong class="green">${rup(cashIn)}</strong></div>
    <div class="card metric"><small>Kas Keluar Periode</small><strong class="red">${rup(cashOut)}</strong></div>
    <div class="card metric"><small>Arus Kas Periode</small><strong class="${cashNet>=0?'blue':'red'}">${rup(cashNet)}</strong></div>
    <div class="card metric"><small>Saldo Kas Tunai Saat Ini</small><strong class="blue">${rup(recordedCash)}</strong><small class="muted">Posisi kas dari seluruh transaksi aktif sampai saat ini. Tidak mengikuti filter periode.</small></div>
    <div class="card metric"><small>Utang Supplier</small><strong>${rup(debtOutstanding)}</strong></div>
    <div class="card metric"><small>Piutang Penjualan</small><strong>${rup(receivable)}</strong></div>
  </div>
  <div class="section card report-method-card">
    <h2>Ringkasan Uang per Metode</h2>
    <p class="muted small">Memisahkan uang fisik, QRIS, dan Transfer. Penjualan Piutang tidak dianggap uang masuk sampai pelanggan melakukan pembayaran.</p>
    <div class="tablewrap report-method-tablewrap"><table class="table report-method-table"><thead><tr><th>Metode</th><th>Penjualan Masuk</th><th>Piutang Dibayar</th><th>Total Masuk</th><th>Pengeluaran</th><th>Pembelian</th><th>Bayar Utang</th><th>Refund</th><th>Total Keluar</th><th>Saldo Bersih</th></tr></thead><tbody>
      ${methods.map(m=>{const z=flowByMethod[m];return `<tr><td><b>${m}</b></td><td>${rup(z.salesIn)}</td><td>${rup(z.receivableIn)}</td><td><b>${rup(z.totalIn)}</b></td><td class="red">${rup(z.expenseOut)}</td><td class="red">${rup(z.purchaseOut)}</td><td class="red">${rup(z.supplierOut)}</td><td class="red">${rup(z.refundOut)}</td><td class="red"><b>${rup(z.totalOut)}</b></td><td class="blue"><b>${rup(z.net)}</b></td></tr>`}).join('')}
      <tr><td><b>TOTAL</b></td><td><b>${rup(methods.reduce((a,m)=>a+flowByMethod[m].salesIn,0))}</b></td><td><b>${rup(methods.reduce((a,m)=>a+flowByMethod[m].receivableIn,0))}</b></td><td><b>${rup(methods.reduce((a,m)=>a+flowByMethod[m].totalIn,0))}</b></td><td class="red"><b>${rup(methods.reduce((a,m)=>a+flowByMethod[m].expenseOut,0))}</b></td><td class="red"><b>${rup(methods.reduce((a,m)=>a+flowByMethod[m].purchaseOut,0))}</b></td><td class="red"><b>${rup(methods.reduce((a,m)=>a+flowByMethod[m].supplierOut,0))}</b></td><td class="red"><b>${rup(methods.reduce((a,m)=>a+flowByMethod[m].refundOut,0))}</b></td><td class="red"><b>${rup(methods.reduce((a,m)=>a+flowByMethod[m].totalOut,0))}</b></td><td class="blue"><b>${rup(methods.reduce((a,m)=>a+flowByMethod[m].net,0))}</b></td></tr>
    </tbody></table></div>
  </div>

  <div class="section grid2">
    <div class="card"><h2>Produk Terjual</h2>
      ${Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([n,q])=>`<div class="barrow"><span>${esc(n)}</span><b>${q}</b></div>`).join('')||'<div class="empty">Belum ada data.</div>'}
    </div>
    <div class="card"><h2>Arus Kas Keluar Periode</h2>
      <div class="barrow"><span>Pengeluaran operasional</span><b>${rup(out)}</b></div>
      <div class="barrow"><span>Pembelian tunai</span><b>${rup(purchaseCash)}</b></div>
      <div class="barrow"><span>Pembayaran utang supplier</span><b>${rup(supplierPaid)}</b></div>
      <div class="barrow"><span>Pengembalian uang pelanggan</span><b>${rup(refundPaid)}</b></div>
      <div class="barrow"><span><b>Total kas keluar</b></span><b>${rup(cashOut)}</b></div>
    </div>
  </div>
  <div class="section grid2">
    <div class="card"><h2>Kas Masuk Periode</h2>
      <div class="barrow"><span>Penjualan tunai/QRIS/transfer</span><b>${rup(cashIn-receivablePaidPeriod)}</b></div><div class="barrow"><span>Pembayaran piutang</span><b>${rup(receivablePaidPeriod)}</b></div>
      <div class="barrow"><span><b>Total kas masuk</b></span><b>${rup(cashIn)}</b></div>
      <p class="muted small">Penjualan Piutang masuk Kas Masuk saat pelanggan melakukan pembayaran.</p>
    </div>
    <div class="card"><h2>Pengeluaran Operasional</h2>
      ${e.map(x=>`<div class="barrow"><span>${esc(x.category)} — ${esc(x.note)} <small class="muted">(${esc(x.payment_method||'-')})</small></span><b>${rup(x.amount)}</b></div>`).join('')||'<div class="empty">Belum ada data.</div>'}
    </div>
  </div>`;
}
function printReport(){if(!requirePrefixPermission('reports.','mencetak laporan'))return;window.print()}

function customers(c){
  const rows=[...db.customers].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'id',{sensitivity:'base'}));
  const activeCount=rows.filter(x=>x.is_active!==false).length;
  c.innerHTML=`<div class="card form">
    <div><label>Nama pelanggan / reseller<input id="cuName" placeholder="Contoh: Toko Berkah"></label></div>
    <div><label>WhatsApp / Telepon<input id="cuPhone" placeholder="08xxxxxxxxxx"></label></div>
    <div><label>Status pelanggan<select id="cuType"><option value="Umum">Umum</option><option value="Reseller">Reseller</option><option value="Reseller Tetap">Reseller Tetap</option></select></label><small class="hint">Reseller tetap dapat memperoleh harga reseller meskipun jumlah pembelian di bawah 100 pcs.</small></div>
    <div><label>Catatan<input id="cuNotes" placeholder="Contoh: reseller tetap / lokasi toko"></label></div>
    <div class="full"><button class="btn" onclick="saveCustomer()">＋ Simpan Pelanggan</button></div>
  </div>
  <div class="section card">
    <div class="cardhead"><div><h2>Daftar Pelanggan / Reseller</h2><small class="muted">${activeCount} pelanggan aktif</small></div></div>
    <div class="tablewrap"><table class="table"><thead><tr><th>Nama</th><th>WhatsApp / Telepon</th><th>Status</th><th>Catatan</th><th>Status Akun</th><th>Aksi</th></tr></thead><tbody>
    ${rows.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.phone||'-')}</td><td>${x.customer_type==='Reseller Tetap'?'<span class="ok">Reseller Tetap</span>':x.customer_type==='Reseller'?'<span class="ok">Reseller</span>':'Umum'}</td><td>${esc(x.notes||'-')}</td><td>${x.is_active===false?'<span class="warn">Nonaktif</span>':'<span class="ok">Aktif</span>'}</td><td><button class="link" onclick="toggleCustomer('${x.id}',${x.is_active!==false})">${x.is_active===false?'Aktifkan':'Nonaktifkan'}</button> <button class="link danger" onclick="deleteCustomer('${x.id}')">Hapus</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Belum ada pelanggan / reseller.</td></tr>'}
    </tbody></table></div>
  </div>`;
}
async function saveCustomer(){
  if(!requirePermission('customers.manage','mengelola pelanggan/reseller'))return;
  const name=$('cuName')?.value.trim(),phone=$('cuPhone')?.value.trim()||'',customer_type=$('cuType')?.value||'Umum',notes=$('cuNotes')?.value.trim()||'';
  if(!name)return alert('Nama pelanggan/reseller wajib diisi.');
  const duplicate=db.customers.find(x=>x.is_active!==false&&String(x.name||'').trim().toLowerCase()===name.toLowerCase());
  if(duplicate)return alert(`Pelanggan/reseller "${duplicate.name}" sudah ada.`);
  const {error}=await sb.from('customers').insert({business_id:profile.business_id,name,phone,customer_type,notes,is_active:true});
  if(error)return alert(error.message);
  alert('Pelanggan/reseller berhasil disimpan.');await loadAll();render();
}
async function toggleCustomer(id,current){
  if(!requirePermission('customers.manage','mengubah status pelanggan'))return;
  const next=!current;
  const {error}=await sb.from('customers').update({is_active:next}).eq('id',id).eq('business_id',profile.business_id);
  if(error)return alert(error.message);await loadAll();render();
}
async function deleteCustomer(id){
  if(!requirePermission('customers.manage','menghapus pelanggan'))return;
  if(!confirm('Hapus data pelanggan/reseller ini?'))return;
  const {error}=await sb.from('customers').delete().eq('id',id).eq('business_id',profile.business_id);
  if(error)return alert(error.message);await loadAll();render();
}

async function saveUserRole(id){
  if(!requireAnyPermission(['users.manage','roles.manage'],'mengubah peran pengguna'))return;
  const role=$(`userRole_${id}`)?.value;
  const allowed=['kasir','finance','gudang','purchasing','supervisor','online_admin'];
  if(!allowed.includes(role))return alert('Peran tidak valid.');
  if(id===session.user.id&&role!=='pemilik')return alert('Akun yang sedang digunakan tidak dapat diturunkan perannya dari halaman ini.');
  const target=db.users.find(x=>x.id===id);
  if(!target)return alert('Pengguna tidak ditemukan.');
  const {error}=await sb.from('profiles').update({role}).eq('id',id).eq('business_id',profile.business_id);
  if(error)return alert(`Gagal mengubah peran: ${error.message}`);
  alert(`Peran ${target.full_name||'pengguna'} berhasil diubah menjadi ${role}.`);
  await loadAll();
  render();
}
function marketplace(c){
  const canCatalog=can('online_catalog.manage'), canView=canAny('online_orders.view','online_orders.process','online_orders.status');
  if(!canAny('online_catalog.manage','online_customers.manage','online_orders.view','online_orders.process','online_orders.status')){c.innerHTML='<div class="card"><h2>🛒 Marketplace</h2><p class="muted">Anda tidak memiliki izin untuk Marketplace.</p></div>';return;}
  const catalog=[...(db.onlineCatalog||[])], orders=[...(db.onlineOrders||[])];
  const productOpts=db.products.filter(p=>p.active).sort((a,b)=>a.name.localeCompare(b.name,'id',{sensitivity:'base'})).map(p=>`<option value="${p.id}">${esc(p.name)} — ${rup(p.price)}</option>`).join('');
  const catRows=catalog.map(x=>{const p=db.products.find(p=>String(p.id)===String(x.product_id))||{name:x.product_name,price:x.price};const src=productImageUrl(p,x);return `<tr><td><div class="catalog-row-product">${src?`<img src="${esc(src)}" alt="${esc(x.online_name)}" loading="lazy">`:'<span class="catalog-row-placeholder">🥤</span>'}<div><b>${esc(x.online_name||p.name)}</b><small>${esc(p.sku||'')}</small></div></div></td><td>${rup(x.price)}</td><td>${productStockLabel(p)}</td><td>${x.active?'<span class="ok">Aktif</span>':'<span class="muted">Nonaktif</span>'}</td><td>${canCatalog?`<button class="link" onclick="toggleOnlineCatalog('${x.id}',${!x.active})">${x.active?'Nonaktifkan':'Aktifkan'}</button>`:'-'}</td></tr>`}).join('');
  const cards=catalog.filter(x=>x.active).map(x=>{const p=db.products.find(p=>String(p.id)===String(x.product_id))||{id:x.product_id,name:x.product_name,price:x.price,active:true};const src=productImageUrl(p,x);const stock=productAvailableStock(p);return `<article class="product-card marketplace-product-card"><div class="product-image-wrap">${src?productCardImage(p,x):''}<div class="product-image-placeholder" ${src?'style="display:none"':''}>🛍️<small>Foto produk</small></div></div><div class="product-card-body"><b>${esc(x.online_name||p.name)}</b><div class="product-card-price">${rup(x.price)}</div><div class="product-card-stock">${productStockLabel(p)}</div><p class="muted small">${esc(p.category||'Produk pilihan CEO FRESH')}</p>${can('online_orders.process')?`<div class="product-card-controls"><label class="qty-label">Jumlah<input id="marketQty_${x.id}" type="number" min="1" step="1" value="1" aria-label="Jumlah ${esc(x.online_name||p.name)}"></label><button type="button" class="btn small" onclick="prepareMarketplaceOrder('${x.id}')">Pilih</button></div>`:''}</div></article>`}).join('');
  const orderRows=orders.map(o=>`<tr><td><b>${esc(o.order_no)}</b><br><small>${esc(o.order_date||'-')}</small></td><td>${esc(o.customer_name||'-')}<br><small>${esc(o.customer_phone||'')}</small></td><td>${rup(o.total)}</td><td>${esc(o.payment_method||'-')}</td><td><span class="pill">${esc(o.status||'baru')}</span></td><td>${can('online_orders.process')&&o.status==='baru'?`<button class="link" onclick="processOnlineOrder('${o.id}')">Proses</button>`:''} ${can('online_orders.status')?`<button class="link" onclick="setOnlineOrderStatus('${o.id}')">Status</button>`:''}</td></tr>`).join('');
  c.innerHTML=`<div class="card"><h2>🛒 Marketplace</h2><p class="muted">Katalog visual produk dengan foto, harga, ketersediaan stok, dan jumlah pesanan.</p></div>${cards?`<div class="section card"><div class="cardhead"><h3>Katalog Online</h3><span class="muted">${cards.length} produk aktif</span></div><div class="product-card-grid marketplace-grid">${cards}</div></div>`:''}${canCatalog?`<div class="section card form"><h3>Kelola Katalog Online</h3><div><label>Produk<select id="omProduct">${productOpts}</select></label></div><div><label>Nama Online<input id="omName" placeholder="Nama tampil di Marketplace"></label></div><div><label>Harga Online<input id="omPrice" type="number" min="0" placeholder="Kosongkan untuk memakai harga produk"></label></div><div class="full"><label>URL Foto Produk<input id="omImage" type="url" placeholder="https://.../foto-produk.jpg"><small class="hint">Gunakan tautan gambar langsung (HTTPS). Jika kosong, sistem menampilkan ilustrasi produk.</small></label></div><div class="full"><button class="btn" onclick="addOnlineCatalog()">＋ Tambah / Perbarui Katalog</button></div></div>`:''}${catalog.length?`<div class="section card"><h3>Daftar Katalog Online</h3><div class="tablewrap"><table class="table"><thead><tr><th>Produk</th><th>Harga</th><th>Ketersediaan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${catRows}</tbody></table></div></div>`:''}${can('online_orders.process')?`<div id="marketOrderForm" class="section card form"><h3>Input Pesanan Online</h3><div><label>No. Pesanan<input id="ooNo" value="MP-${Date.now().toString().slice(-8)}"></label></div><div><label>Nama Pelanggan<input id="ooCustomer"></label></div><div><label>No. HP<input id="ooPhone"></label></div><div><label>Pembayaran<select id="ooPayment"><option>Transfer</option><option>QRIS</option><option>Tunai</option></select></label></div><div><label>Produk<select id="ooProduct">${productOpts}</select></label></div><div><label>Jumlah<input id="ooQty" type="number" min="1" step="1" value="1"></label></div><div class="full" id="marketOrderSummary"></div><div class="full"><button class="btn" onclick="createOnlineOrder()">＋ Simpan Pesanan Online</button></div></div>`:''}${canView?`<div class="section card"><h3>Pesanan Online</h3><div class="tablewrap"><table class="table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Total</th><th>Pembayaran</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${orderRows||'<tr><td colspan="6" class="empty">Belum ada pesanan online.</td></tr>'}</tbody></table></div></div>`:''}`;
}
function prepareMarketplaceOrder(catalogId){
  const row=(db.onlineCatalog||[]).find(x=>String(x.id)===String(catalogId));if(!row)return;
  const p=db.products.find(x=>String(x.id)===String(row.product_id));if(!p)return alert('Data produk tidak ditemukan.');
  const stock=productAvailableStock(p),qty=Math.max(1,Math.floor(Number($(`marketQty_${catalogId}`)?.value)||1));
  if(stock!==null&&qty>stock)return alert(`Stok ${row.online_name||p.name} hanya ${fmtNum(stock)} unit.`);
  if($('ooProduct'))$('ooProduct').value=String(p.id);if($('ooQty'))$('ooQty').value=qty;
  if($('marketOrderSummary'))$('marketOrderSummary').innerHTML=`<div class="card"><b>${esc(row.online_name||p.name)}</b> · ${qty} unit × ${rup(row.price)} = <b>${rup(Number(row.price||0)*qty)}</b></div>`;
  $('ooCustomer')?.focus();$('marketOrderForm')?.scrollIntoView({behavior:'smooth',block:'center'});
}
async function addOnlineCatalog(){if(!requirePermission('online_catalog.manage','mengelola katalog online'))return;const pid=$('omProduct')?.value;if(!pid)return;const p=db.products.find(x=>String(x.id)===String(pid));if(!p)return;const onlineName=$('omName')?.value.trim()||p.name;const price=Math.max(0,Number($('omPrice')?.value)||Number(p.price)||0);const imageUrl=String($('omImage')?.value||'').trim();if(imageUrl&&!/^https:\/\//i.test(imageUrl))return alert('URL foto harus diawali https://');const {error}=await sb.from('online_catalog').upsert({business_id:profile.business_id,product_id:p.id,product_name:p.name,online_name:onlineName,price,image_url:imageUrl||null,active:true},{onConflict:'business_id,product_id'});if(error)return alert(error.message);await loadAll();render();}
async function toggleOnlineCatalog(id,active){if(!requirePermission('online_catalog.manage','mengelola katalog online'))return;const {error}=await sb.from('online_catalog').update({active}).eq('id',id).eq('business_id',profile.business_id);if(error)return alert(error.message);await loadAll();render();}
async function createOnlineOrder(){if(!requirePermission('online_orders.process','membuat pesanan online'))return;const pid=$('ooProduct')?.value;const p=db.products.find(x=>String(x.id)===String(pid));const qty=Math.max(1,Math.floor(Number($('ooQty')?.value)||1));if(!p)return alert('Produk tidak ditemukan.');const catalog=db.onlineCatalog.find(x=>String(x.product_id)===String(pid)&&x.active);const available=productAvailableStock(p);if(available!==null&&qty>available)return alert(`Stok ${p.name} hanya ${fmtNum(available)} unit; pesanan tidak disimpan.`);const price=Number(catalog?.price??p.price??0);const orderNo=$('ooNo')?.value.trim()||`MP-${Date.now()}`;const {data:o,error}=await sb.from('online_orders').insert({business_id:profile.business_id,order_no:orderNo,order_date:today(),customer_name:$('ooCustomer')?.value.trim()||null,customer_phone:$('ooPhone')?.value.trim()||null,payment_method:$('ooPayment')?.value||'Transfer',payment_status:'belum_dibayar',status:'baru',total:price*qty,created_by:session.user.id}).select().single();if(error)return alert(error.message);const {error:ie}=await sb.from('online_order_items').insert({order_id:o.id,product_id:p.id,product_name:p.name,qty,unit_price:price,subtotal:price*qty});if(ie){await sb.from('online_orders').delete().eq('id',o.id);return alert(ie.message)}alert('Pesanan online tersimpan.');await loadAll();render();}
async function processOnlineOrder(id){if(!requirePermission('online_orders.process','memproses pesanan online'))return;const {data,error}=await sb.rpc('process_online_order',{p_business_id:profile.business_id,p_order_id:id});if(error)return alert(`Pesanan gagal diproses: ${error.message}`);alert(`Pesanan ${data?.order_no||''} berhasil diproses.`);await loadAll();render();}
async function setOnlineOrderStatus(id){if(!requirePermission('online_orders.status','mengubah status pesanan online'))return;const o=db.onlineOrders.find(x=>x.id===id);if(!o)return;const status=prompt('Status baru (baru/diproses/siap/dikirim/selesai/dibatalkan):',o.status||'baru');if(!status)return;const allowed=['baru','diproses','siap','dikirim','selesai','dibatalkan'];if(!allowed.includes(status))return alert('Status tidak valid.');const {error}=await sb.from('online_orders').update({status}).eq('id',id).eq('business_id',profile.business_id);if(error)return alert(error.message);await loadAll();render();}

function auditWibDateTime(iso){return new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'short',timeStyle:'medium'}).format(new Date(iso))}
function auditWibTime(iso){return new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso))}
function isOutsideCashHours(iso){const open=String(business?.cash_open_time||'08:00').slice(0,5),close=String(business?.cash_closing_time||'22:00').slice(0,5),t=auditWibTime(iso);const n=x=>Number(x.slice(0,2))*60+Number(x.slice(3,5));const tm=n(t),op=n(open),cl=n(close);const inside=op<=cl?tm>=op&&tm<=cl:tm>=op||tm<=cl;return !inside}
function audit(c){if(profile?.role!=='pemilik'){c.innerHTML='<div class="card"><h2>🔐 Audit Buka Kembali Kas</h2><p class="muted">Laporan ini hanya dapat dilihat oleh Pemilik.</p></div>';return;}const rows=(db.auditLogs||[]).map(log=>{const u=(db.users||[]).find(x=>String(x.id)===String(log.user_id));const old=log.old_data||{};const outside=isOutsideCashHours(log.created_at);return `<tr><td>${esc(old.closing_date||'-')}</td><td>${esc(auditWibDateTime(log.created_at))}</td><td><b>${esc(u?.full_name||'-')}</b><div class="muted small">${esc(u?.phone||u?.email||log.user_id||'-')}</div></td><td>${esc(u?.role||'-')}</td><td>${outside?'<span class="pill" style="background:#fff1f0;color:#b42318">Di luar jam</span>':'<span class="pill">Dalam jam</span>'}</td><td>${esc((business?.cash_open_time||'08:00')+' - '+(business?.cash_closing_time||'22:00')+' WIB')}</td><td>${esc(old.notes||log.description||'-')}</td></tr>`;}).join('');c.innerHTML=`<div class="card"><h2>🔐 Audit Buka Kembali Kas</h2><p class="muted">Khusus Pemilik. Menampilkan setiap tindakan membuka kembali tutup kas, termasuk siapa yang melakukan dan waktunya.</p><div class="tablewrap"><table class="table"><thead><tr><th>Tanggal Kas</th><th>Waktu Buka Kembali</th><th>Pengguna</th><th>Role</th><th>Waktu</th><th>Jam Operasional</th><th>Catatan</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="empty">Belum ada aktivitas Buka Kembali Kas.</td></tr>'}</tbody></table></div></div>`}

function users(c){
  if(!requireAnyPermission(['users.manage','roles.manage'],'mengelola pengguna')){c.innerHTML='<div class="card"><h2>Pengguna & Hak Akses</h2><p class="muted">Anda tidak memiliki izin untuk mengelola pengguna.</p></div>';return;}
  const roles=['kasir','finance','gudang','purchasing','supervisor','online_admin'];
  const roleLabels={kasir:'Kasir',finance:'Finance',gudang:'Gudang',purchasing:'Purchasing',supervisor:'Supervisor',online_admin:'Online Admin'};
  const permissionList=[...userPermissions].sort(); const pending=(db.users||[]).filter(u=>u.account_status==='pending'); const active=(db.users||[]).filter(u=>u.account_status!=='pending');
  c.innerHTML=`<div class="card"><h2>👤 Pengguna & Hak Akses</h2><p class="muted">Semua akun baru wajib mendapat persetujuan Pemilik. Jabatan saat pendaftaran adalah permintaan; hak akses aktif setelah disetujui.</p></div>
  ${pending.length?`<div class="section card"><h3>🟡 Menunggu Persetujuan (${pending.length})</h3><div class="tablewrap"><table class="table"><thead><tr><th>Nama</th><th>No. HP</th><th>Jabatan Diminta</th><th>Label</th><th>Aksi</th></tr></thead><tbody>${pending.map(u=>`<tr><td><b>${esc(u.full_name||'Pengguna')}</b></td><td>${esc(u.phone||u.email||'-')}</td><td><select id="pendingRole_${u.id}">${roles.map(r=>`<option value="${r}" ${u.role===r||u.requested_role===r?'selected':''}>${roleLabels[r]}</option>`).join('')}</select></td><td><input id="pendingLabel_${u.id}" value="${esc(u.account_label||'')}" placeholder="Opsional, mis. Kasir 1"></td><td><button class="btn small" onclick="approveUser('${u.id}')">Terima</button> <button class="btn small secondary" onclick="rejectUser('${u.id}')">Tolak</button></td></tr>`).join('')}</tbody></table></div></div>`:''}
  <div class="section card"><h3>🟢 Pengguna Aktif</h3><div class="tablewrap"><table class="table"><thead><tr><th>Nama</th><th>Label</th><th>Peran</th><th>Status</th><th>Bergabung</th><th>Aksi</th></tr></thead><tbody>${active.map(u=>`<tr><td><b>${esc(u.full_name||'Pengguna')}</b>${u.id===session.user.id?' <span class="pill">Anda</span>':''}<div class="muted small">${esc(u.phone||u.email||'-')}</div></td><td>${esc(u.account_label||'-')}</td><td>${u.role==='pemilik'?'<span class="pill">Pemilik</span>':`<select id="userRole_${u.id}" ${u.id===session.user.id?'disabled':''}>${roles.map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${roleLabels[r]}</option>`).join('')}</select>`}</td><td><span class="pill">${esc(u.account_status||'active')}</span></td><td>${esc(u.created_at?new Date(u.created_at).toLocaleDateString('id-ID'):'-')}</td><td>${u.id===session.user.id?'-':`<button class="btn small" onclick="saveUserRole('${u.id}')">Simpan Peran</button>`}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Belum ada pengguna.</td></tr>'}</tbody></table></div></div>
  <div class="section card"><h3>Permission yang dimiliki role Anda</h3><p class="muted small">Role saat ini: <b>${esc(profile.role)}</b>. Daftar berikut dibaca langsung dari <code>role_permissions</code>.</p><div class="quick">${permissionList.map(x=>`<span class="pill">${esc(x)}</span>`).join('')||'<span class="muted">Belum ada permission.</span>'}</div></div>`;
}
async function approveUser(id){
  if(!requireAnyPermission(['users.manage','roles.manage'],'menyetujui pengguna'))return;
  const role=$(`pendingRole_${id}`)?.value||'kasir'; const label=$(`pendingLabel_${id}`)?.value.trim()||'';
  const {error}=await sb.rpc('approve_user',{p_user_id:id,p_role:role,p_label:label}); if(error)return alert(`Gagal menyetujui pengguna: ${error.message}`);
  alert('Pengguna berhasil disetujui dan sekarang aktif.');await loadAll();render();
}
async function rejectUser(id){
  if(!requireAnyPermission(['users.manage','roles.manage'],'menolak pengguna'))return;
  const reason=prompt('Alasan penolakan (opsional):','')||''; const {error}=await sb.rpc('reject_user',{p_user_id:id,p_reason:reason}); if(error)return alert(`Gagal menolak pengguna: ${error.message}`);
  alert('Pengguna ditolak.');await loadAll();render();
}
function settings(c){
  const settingCard=(icon,title,desc,page,button='Buka pengaturan')=>`<div class="card setting-tile"><div class="setting-tile-icon">${icon}</div><h3>${title}</h3><p class="muted">${desc}</p><button class="btn small secondary" onclick="openSettingsPage('${page}')">${button} →</button></div>`;
  c.innerHTML=`<div class="card"><h2>⚙️ Pusat Pengaturan CEO FRESH</h2><p class="muted">Kelola identitas usaha, akun pengguna, perizinan, dan preferensi sistem dari satu tempat.</p></div>
  <div class="section grid2">${settingCard('🏢','Profil Usaha','Nama usaha, alamat, WhatsApp, kode bergabung, dan target tutup kas.','settingsProfile','Buka profil usaha')}${settingCard('👥','Pengguna & Akun','Tinjau akun yang mendaftar, status persetujuan, dan peran pengguna.','users')}${profile?.role==='pemilik'?settingCard('🛡️','Perizinan & Hak Akses','Pilih akun satu per satu, lalu aktifkan hanya menu dan tindakan yang boleh dipakai akun tersebut.','permissionSettings','Kelola izin akun'):''}${settingCard('💾','Backup Data','Ekspor salinan data usaha untuk penyimpanan cadangan.','backup','Buka backup')}${settingCard('💰','Aturan Kas','Atur jam target tutup kas dan kebijakan operasional kas.','settingsProfile','Atur aturan kas')}${settingCard('🔐','Audit Aktivitas','Periksa aktivitas administrasi yang tersedia pada sistem.','audit','Buka audit')}</div>
  <div id="settingsDetail" class="section"></div>`;
}
function openSettingsPage(page){
  if(page==='settingsProfile'){renderSettingsProfile($('settingsDetail'));return;}
  if(page==='backup'){const box=$('settingsDetail');box.innerHTML=`<div class="card"><h2>💾 Backup Data</h2><p class="muted">Simpan seluruh data usaha sebagai file cadangan. File backup tidak menyimpan password atau token login.</p><button class="btn" onclick="backupAllData()">📥 Backup Seluruh Data</button></div>`;return;}
  if(page==='permissionSettings'&&profile?.role!=='pemilik'){alert('Hanya Pemilik yang dapat mengatur perizinan.');return;}
  if(!pageAllowed(page)){alert('Akun ini tidak memiliki izin untuk membuka bagian tersebut.');return;}
  currentPage=page;buildNav();render();
}
function renderSettingsProfile(c){
  if(!c)return;
  c.innerHTML=`<div class="card"><h2>🏢 Profil Usaha & Aturan Kas</h2><div class="grid2"><label>Nama usaha<input id="biz" value="${esc(business.name)}"></label><label>Alamat<input id="addr" value="${esc(business.address||'')}"></label><label>WhatsApp<input id="wa" value="${esc(business.wa||'')}"></label><label>Kode usaha untuk karyawan<input id="joinCode" value="${esc(business.join_code||'')}" maxlength="8"></label><label>Jam target tutup kas<input id="cashCloseTime" type="time" value="${esc(business.cash_closing_time||'22:00')}"></label></div><p class="hint">Jam ini menjadi pengingat tutup kas. Kas tidak ditutup otomatis.</p><button class="btn" onclick="saveSettings()">Simpan Pengaturan Usaha</button><hr><h3>Akun yang sedang digunakan</h3><p>Nama: <b>${esc(profile.full_name||profile.account_label||'Pengguna')}</b></p><p>Login: <b>${esc(session.user.phone||session.user.email||'-')}</b></p><p>Peran: <b>${esc(roleDisplay[profile.role]||profile.role)}</b></p><p class="muted">Database: Supabase Cloud. Data bersama mengikuti usaha yang sama setelah login.</p></div>`;
}
const permissionGroups={
  'Dashboard & Penjualan':['dashboard.view','sales.create','sales.view','sales.cancel','sales.receipt','sales.discount','sales.price.override'],
  'Produk, Stok & Produksi':['products.manage','materials.manage','recipes.manage','hpp.manage','stock.view','stock.adjust','stock.opname','stock.mutations.view'],
  'Pembelian & Pemasok':['purchases.create','purchases.view','purchases.cancel','suppliers.manage','supplier_payments.create'],
  'Keuangan & Kas':['expenses.create','expenses.view','cash.open','cash.closing','cash.withdrawal','receivables.payment','reports.sales.view','reports.profit.view','reports.cash.view','reports.finance.view'],
  'Pelanggan & Retur':['customers.manage','returns.view','returns.create','refunds.create'],
  'Online & Marketplace':['online_catalog.manage','online_customers.manage','online_orders.view','online_orders.process','online_orders.status'],
  'Administrasi & Sistem':['users.manage','roles.manage','business.settings','backup.create','audit.view']
};
function permissionSettings(c){
  if(profile?.role!=='pemilik'){c.innerHTML='<div class="card"><h2>🛡️ Perizinan & Hak Akses</h2><p class="muted">Hanya Pemilik yang dapat mengatur perizinan akun.</p></div>';return;}
  const targets=(db.users||[]).filter(u=>u.id!==session.user.id&&u.account_status==='active');
  c.innerHTML=`<div class="card"><h2>🛡️ Perizinan & Hak Akses</h2><p class="muted">Semua akun memakai aplikasi dan halaman dasar yang sama. Pemilik mengaktifkan hanya tombol dan tindakan yang dibutuhkan setiap akun. Perubahan ini khusus untuk akun yang dipilih dan tidak mengubah hak akun lain.</p><label>Pilih akun<select id="permTarget" onchange="loadPermissionEditor()"><option value="">— Pilih pengguna —</option>${targets.map(u=>`<option value="${u.id}">${esc(u.account_label||u.full_name||u.phone||u.email||u.id)} · ${esc(roleDisplay[u.role]||u.role)}</option>`).join('')}</select></label><div id="permissionEditor"><p class="muted">Pilih akun untuk mengatur tombol dan tindakan.</p></div></div>`;
}
async function loadPermissionEditor(){
  if(profile?.role!=='pemilik')return;
  const id=$('permTarget')?.value, box=$('permissionEditor');if(!id||!box){if(box)box.innerHTML='<p class="muted">Pilih akun untuk mengatur tombol dan tindakan.</p>';return;}
  box.innerHTML='<p class="muted">Memuat daftar hak akses…</p>';
  const [all,custom,assigned]=await Promise.all([
    sb.from('permissions').select('id,code,name,module,description').order('module').order('name'),
    sb.from('user_permission_profiles').select('customized').eq('user_id',id).eq('business_id',profile.business_id).maybeSingle(),
    sb.from('user_permissions').select('permission_id').eq('user_id',id).eq('business_id',profile.business_id).eq('enabled',true)
  ]);
  if(all.error||custom.error||assigned.error){const e=all.error||custom.error||assigned.error;box.innerHTML=`<p class="error"><b>Gagal memuat hak akses.</b><br>${esc(e.message||'Kesalahan tidak diketahui')}<br><small>Jika tabel sudah ada di SQL Editor, jalankan migrasi penyegaran schema pada paket ini, lalu muat ulang aplikasi. Pastikan URL Supabase aplikasi sama dengan proyek yang diperiksa.</small></p>`;return;}
  const isCustom=!!custom.data?.customized;let selected=new Set((assigned.data||[]).map(x=>x.permission_id));
  if(!isCustom){const role=$('permTarget').selectedOptions[0]?.textContent;const target=db.users.find(x=>x.id===id);const {data:rp}=await sb.from('role_permissions').select('permission_id').eq('role',target?.role||'kasir');selected=new Set((rp||[]).map(x=>x.permission_id));}
  const list=all.data||[];const groups={};for(const p of list){const key=Object.keys(permissionGroups).find(k=>permissionGroups[k].includes(p.code))||'Lainnya';(groups[key] ||= []).push(p)}
  box.innerHTML=`<div class="card" style="margin-top:14px;background:#f7fbfa"><b>${isCustom?'Mode: Hak akses khusus per akun':'Mode: Hak akses bawaan dari peran'}</b><p class="muted small">Centang hanya tindakan yang boleh dilakukan. Untuk Kasir, biasanya cukup Penjualan, Riwayat Transaksi, dan Cetak Struk. Menu sensitif seperti HPP, pengeluaran, laporan laba, dan pengaturan sebaiknya tidak diaktifkan.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><button class="btn small secondary" onclick="presetCashierPermissions()">Preset Kasir</button><button class="btn small secondary" onclick="selectAllPermissions(true)">Pilih semua</button><button class="btn small secondary" onclick="selectAllPermissions(false)">Kosongkan semua</button></div></div>${Object.entries(groups).map(([group,items])=>`<div class="section card"><h3>${esc(group)}</h3><div class="grid2">${items.map(p=>`<label class="permission-option" style="display:flex;gap:9px;align-items:flex-start;padding:8px;border:1px solid #e2e8e5;border-radius:8px"><input type="checkbox" class="permission-check" value="${p.id}" data-code="${esc(p.code)}" ${selected.has(p.id)?'checked':''} style="width:auto;margin-top:3px"><span><b>${esc(p.name||p.code)}</b><br><small class="muted">${esc(p.description||p.code)} <code>${esc(p.code)}</code></small></span></label>`).join('')}</div></div>`).join('')}<div class="card"><button class="btn" onclick="saveAccountPermissions('${id}')">💾 Simpan Hak Akses Akun</button> <button class="btn secondary" onclick="resetAccountPermissions('${id}')">Kembali ke Hak Akses Peran</button><p class="muted small">Pengaturan khusus disimpan ke database cloud. Hak akses pada layar bukan pengganti kebijakan keamanan database (RLS); kebijakan server juga harus membatasi operasi sensitif.</p></div>`;
}
function selectAllPermissions(on){document.querySelectorAll('.permission-check').forEach(x=>x.checked=!!on)}
function presetCashierPermissions(){const allow=new Set(['dashboard.view','sales.create','sales.view','sales.receipt']);document.querySelectorAll('.permission-check').forEach(x=>x.checked=allow.has(x.dataset.code));}
async function saveAccountPermissions(id){
  if(profile?.role!=='pemilik')return alert('Hanya Pemilik yang dapat mengatur hak akses.');
  const ids=[...document.querySelectorAll('.permission-check:checked')].map(x=>x.value);
  const {error:markError}=await sb.from('user_permission_profiles').upsert({user_id:id,business_id:profile.business_id,customized:true,updated_by:session.user.id,updated_at:new Date().toISOString()},{onConflict:'user_id,business_id'});
  if(markError)return alert(`Gagal menyimpan pengaturan: ${markError.message}`);
  const {error:delError}=await sb.from('user_permissions').delete().eq('user_id',id).eq('business_id',profile.business_id);if(delError)return alert(`Gagal memperbarui daftar hak akses: ${delError.message}`);
  if(ids.length){const rows=ids.map(permission_id=>({user_id:id,business_id:profile.business_id,permission_id,enabled:true,updated_by:session.user.id}));const {error}=await sb.from('user_permissions').insert(rows);if(error)return alert(`Gagal menyimpan hak akses: ${error.message}`)}
  alert(`Hak akses akun berhasil disimpan (${ids.length} izin aktif). Pengguna perlu memuat ulang aplikasi atau masuk kembali agar perubahan berlaku.`);
  await loadPermissions();buildNav();render();
}
async function resetAccountPermissions(id){
  if(profile?.role!=='pemilik')return alert('Hanya Pemilik yang dapat mengatur hak akses.');
  if(!confirm('Kembalikan akun ini ke hak akses bawaan berdasarkan perannya?'))return;
  const {error}=await sb.from('user_permission_profiles').upsert({user_id:id,business_id:profile.business_id,customized:false,updated_by:session.user.id,updated_at:new Date().toISOString()},{onConflict:'user_id,business_id'});if(error)return alert(error.message);
  const {error:delError}=await sb.from('user_permissions').delete().eq('user_id',id).eq('business_id',profile.business_id);if(delError)return alert(delError.message);
  alert('Hak akses kembali mengikuti peran akun.');await loadPermissionEditor();
}

async function fetchBackupRows(table, businessId){
  const pageSize=1000;
  let from=0;
  const rows=[];
  while(true){
    let q=sb.from(table).select('*').eq('business_id',businessId).range(from,from+pageSize-1);
    if(table==='profiles') q=q.eq('business_id',businessId);
    const {data,error}=await q;
    if(error)throw new Error(`Backup ${table}: ${error.message}`);
    rows.push(...(data||[]));
    if(!data||data.length<pageSize)break;
    from+=pageSize;
  }
  return rows;
}
async function backupAllData(){
  if(!requirePermission('backup.create','membuat backup data'))return;
  if(!business?.id)return alert('Data usaha belum siap.');
  const btn=document.querySelector('button[onclick="backupAllData()"]');
  if(btn){btn.disabled=true;btn.textContent='⏳ Menyiapkan backup...';}
  try{
    const businessResult=await sb.from('businesses').select('*').eq('id',business.id).single();
    if(businessResult.error)throw new Error(`Backup businesses: ${businessResult.error.message}`);
    const tables=['profiles','products','sales','expenses','stock','recipe_items','suppliers','purchases','purchase_items','supplier_payments','receivable_payments','customers','reseller_prices','cash_closings','sales_returns','sales_refunds','stock_adjustments'];
    const backup={
      format:'CEO-FRESH-BACKUP',
      format_version:1,
      app_version:'v70.4',
      exported_at:new Date().toISOString(),
      business_id:business.id,
      warning:'File ini berisi data usaha. Simpan di tempat yang aman. Tidak termasuk password atau token login Supabase.',
      data:{business:businessResult.data}
    };
    for(const table of tables) backup.data[table]=await fetchBackupRows(table,business.id);
    const counts={};
    Object.keys(backup.data).forEach(k=>{counts[k]=Array.isArray(backup.data[k])?backup.data[k].length:1});
    backup.row_counts=counts;
    const json=JSON.stringify(backup,null,2);
    const hashBuf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json));
    const hash=Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    backup.sha256=hash;
    const finalJson=JSON.stringify(backup,null,2);
    const blob=new Blob([finalJson],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const d=new Date();
    const stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
    const a=document.createElement('a');a.href=url;a.download=`CEO-FRESH-BACKUP-${stamp}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    alert(`Backup berhasil dibuat.\n\n${Object.entries(counts).map(([k,v])=>`${k}: ${v}`).join('\n')}\n\nSHA-256: ${hash}`);
  }catch(err){alert(`Backup gagal: ${err.message||err}`)}
  finally{if(btn){btn.disabled=false;btn.textContent='📥 Backup Seluruh Data';}}
}

async function saveSettings(){if(!requirePermission('business.settings','mengubah pengaturan usaha'))return;const cashClosingTime=$('cashCloseTime')?.value||'22:00';const {error}=await sb.from('businesses').update({name:$('biz').value,address:$('addr').value,wa:$('wa').value,join_code:$('joinCode').value.toUpperCase(),cash_closing_time:cashClosingTime}).eq('id',profile.business_id);if(error)alert(error.message);else {business={...business,name:$('biz').value,address:$('addr').value,wa:$('wa').value,join_code:$('joinCode').value.toUpperCase(),cash_closing_time:cashClosingTime};alert(`Pengaturan tersimpan. Target tutup kas: ${cashClosingTime} WIB.`);render()}}
async function del(table,id){const permissionMap={products:'products.manage',stock:'stock.adjust',expenses:'expenses.manage'};const code=permissionMap[table];if(code&&!requirePermission(code,'menghapus data'))return;if(!code&&profile.role!=='pemilik')return alert('Anda tidak memiliki izin untuk menghapus data ini.');if(!confirm('Hapus data ini?'))return;const {error}=await sb.from(table).delete().eq('id',id);if(error)alert(error.message);else await loadAll(),render()}
$('menu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');
(async()=>{if(!hasCloud){$('syncStatus').textContent='Mode setup';return}const {data}=await sb.auth.getSession();if(data.session)await start(data.session);sb.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT')location.reload()})})();



/* v40: Jumat Berkah hanya aktif pada hari Jumat; kuota reset setiap Jumat. */
const FRIDAY_PROGRAM={budget:200000,costPerBlock:300,products:{'es mambo':{blocks:30,freePerBlock:3},'es gabus':{blocks:30,freePerBlock:3},'es cream':{blocks:60,freePerBlock:2}}};
function normName(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,' ')}
function isFriday(dateStr){const d=new Date((dateStr||today())+'T00:00:00');return d.getDay()===5}
function fridayProgramSales(){const selected=$('sDate')?.value||today();if(!isFriday(selected))return [];return activeSales(db.sales).filter(x=>String(x.sale_date||'')===String(selected)&&normName(x.promo_name).startsWith('jumat berkah'))}
function fridayProgramUsage(productName){const cfg=FRIDAY_PROGRAM.products[normName(productName)];if(!cfg)return{blocks:0,free:0,usedBudget:0,limit:0};const blocks=fridayProgramSales().filter(x=>normName(x.product_name)===normName(productName)).reduce((a,x)=>a+Math.floor(Number(x.paid_qty||0)/10),0);return{blocks,free:blocks*cfg.freePerBlock,usedBudget:blocks*FRIDAY_PROGRAM.costPerBlock,limit:cfg.blocks}}
function fridayProgramTotalBlocks(){return fridayProgramSales().reduce((a,x)=>a+Math.floor(Number(x.paid_qty||0)/10),0)}
function fridayProgramBudgetLeft(){return Math.max(0,FRIDAY_PROGRAM.budget-fridayProgramTotalBlocks()*FRIDAY_PROGRAM.costPerBlock)}
function fridayPromoConfig(productName){return FRIDAY_PROGRAM.products[normName(productName)]||null}
function fridayPendingBlocks(productName){return (window.saleCart||[]).filter(x=>normName(x.product_name)===normName(productName)&&normName(x.promo_name).startsWith('jumat berkah')).reduce((a,x)=>a+Math.floor(Number(x.paid_qty||0)/10),0)}
function fridayPendingTotalBlocks(){return (window.saleCart||[]).filter(x=>normName(x.promo_name).startsWith('jumat berkah')).reduce((a,x)=>a+Math.floor(Number(x.paid_qty||0)/10),0)}
function fridayPromoValues(product,paid){const selected=$('sDate')?.value||today();const cfg=fridayPromoConfig(product?.name);if(!cfg)return{free:0,blocks:0,error:'Produk ini tidak termasuk program Jumat Berkah.'};if(!isFriday(selected))return{free:0,blocks:0,error:'Jumat Berkah hanya dapat digunakan pada hari Jumat. Kuota akan kembali 30/30 pada Jumat berikutnya.'};if(paid<10||paid%10!==0)return{free:0,blocks:0,error:'Jumlah Jumat Berkah harus kelipatan 10 pcs. Contoh: 10, 20, 30.'};const blocks=paid/10,u=fridayProgramUsage(product.name),pending=fridayPendingBlocks(product.name),left=Math.max(0,cfg.blocks-u.blocks-pending);if(blocks>left)return{free:0,blocks:0,error:`Kuota Jumat Berkah ${product.name} tersisa ${left} kelipatan pada Jumat ini setelah memperhitungkan keranjang. Maksimal ${left*10} pcs dibayar.`};const budgetBlocks=Math.floor(Math.max(0,fridayProgramBudgetLeft()-pending*FRIDAY_PROGRAM.costPerBlock)/FRIDAY_PROGRAM.costPerBlock);if(blocks>budgetBlocks)return{free:0,blocks:0,error:`Dana program Jumat Berkah tersisa ${rup(Math.max(0,fridayProgramBudgetLeft()-pending*FRIDAY_PROGRAM.costPerBlock))} pada Jumat ini, hanya cukup untuk ${budgetBlocks*10} pcs dibayar.`};return{free:blocks*cfg.freePerBlock,blocks}}
function fridaySplitPlan(product,paid){const selected=$('sDate')?.value||today();const cfg=fridayPromoConfig(product?.name);if(!cfg||!isFriday(selected)||paid<10)return{active:false,promoPaid:0,promoFree:0,promoBlocks:0,fallbackPaid:paid};const u=fridayProgramUsage(product.name),pending=fridayPendingBlocks(product.name),pendingTotal=fridayPendingTotalBlocks(),productLeft=Math.max(0,cfg.blocks-u.blocks-pending);const budgetLeft=Math.max(0,fridayProgramBudgetLeft()-pendingTotal*FRIDAY_PROGRAM.costPerBlock);const budgetBlocks=Math.floor(budgetLeft/FRIDAY_PROGRAM.costPerBlock);const promoBlocks=Math.min(Math.floor(paid/10),productLeft,budgetBlocks);const promoPaid=promoBlocks*10;return{active:promoBlocks>0,promoPaid,promoFree:promoBlocks*cfg.freePerBlock,promoBlocks,fallbackPaid:paid-promoPaid,productLeft,budgetBlocks}}
function fridayAutoPromo(product,paid,customer){const selected=$('sDate')?.value||today();const cfg=fridayPromoConfig(product?.name);const type=String(customer?.customer_type||'').trim().toLowerCase();if(!cfg||!isFriday(selected)||paid<10)return{active:false};const plan=fridaySplitPlan(product,paid);if(plan.promoBlocks>0)return{active:true,split:plan.fallbackPaid>0,mode:'Promo',free:plan.promoFree,blocks:plan.promoBlocks,fallbackPaid:plan.fallbackPaid,text:`Jumat Berkah otomatis · ${plan.promoBlocks} kelipatan · sedekah ${plan.promoFree} pcs${plan.fallbackPaid?` · sisa ${plan.fallbackPaid} pcs mengikuti harga pelanggan`:''}`};const reseller=['reseller','reseller tetap'].includes(type);return{active:false,quotaExhausted:reseller,mode:reseller?'Reseller':'Normal',error:'Kuota atau dana program Jumat Berkah sudah tidak tersedia untuk blok berikutnya.',text:reseller?`Kuota/dana Jumat Berkah tidak tersedia. Hak harga ${type==='reseller tetap'?'Reseller Tetap':'Reseller'} berlaku untuk sisa pembelian.`:`Kuota/dana Jumat Berkah tidak tersedia. Harga normal berlaku.`}}
function fridayProgramCostForSales(rows){return (rows||[]).filter(x=>{const d=String(x.sale_date||'');if(!d)return false;const dt=new Date(d+'T00:00:00');return dt.getDay()===5&&normName(x.promo_name).startsWith('jumat berkah')}).reduce((a,x)=>a+Math.floor(Number(x.paid_qty||0)/10)*FRIDAY_PROGRAM.costPerBlock,0)}
function updateFridayPromoUI(){const p=db.products.find(x=>String(x.id)===String($('sProd')?.value||''));const box=$('fridayPromoInfo');if(!box)return;const selected=$('sDate')?.value||today();const cfg=fridayPromoConfig(p?.name);if(!cfg){box.innerHTML='<div class="hint">Jumat Berkah hanya tersedia untuk Es Mambo, Es Gabus, dan Es Cream.</div>';return}if(!isFriday(selected)){box.innerHTML='<div class="hint"><b>Jumat Berkah</b> hanya aktif pada hari Jumat. Kuota Jumat sebelumnya tidak dibawa ke hari berikutnya. Pada Jumat berikutnya kuota dimulai kembali dari batas program.</div>';return}const u=fridayProgramUsage(p.name),pending=fridayPendingBlocks(p.name),remaining=Math.max(0,cfg.blocks-u.blocks),afterPending=Math.max(0,remaining-pending),pendingBudget=Math.min(fridayProgramBudgetLeft(),pending*FRIDAY_PROGRAM.costPerBlock);box.innerHTML=`<div class="hint"><b>Jumat Berkah</b> · Kuota terpakai <b>${fmtNum(u.blocks)}/${fmtNum(cfg.blocks)}</b> kelipatan · Tersisa <b>${fmtNum(remaining)}</b> kelipatan (maks. ${fmtNum(remaining*10)} pcs dibayar) · Sedekah ${cfg.freePerBlock} pcs/10 dibayar · Dana program tersisa ${rup(fridayProgramBudgetLeft())}${pending?` · <b>Dalam keranjang: ${fmtNum(pending)} kelipatan</b> · Setelah disimpan: kuota menjadi <b>${fmtNum(u.blocks+pending)}/${fmtNum(cfg.blocks)}</b> · Tersisa <b>${fmtNum(afterPending)}</b> kelipatan · Biaya program keranjang ${rup(pendingBudget)}.`:''}</div>`}

/* v38.2 FINAL FIX: reseller pricing must override duplicate legacy sale functions. */
function updateSalePrice(){const p=db.products.find(x=>String(x.id)===String($('sProd')?.value||''));if(p){if($('sBasePrice'))$('sBasePrice').value=p.price;if($('sPrice'))$('sPrice').value=p.price}updateSalePricing()}
function saleModeChanged(){const m=$('sMode')?.value||'Normal';$('discountFields')?.classList.toggle('hidden',!(m==='Diskon'));$('freeFields')?.classList.toggle('hidden',m!=='Promo');$('promoNameField')?.classList.toggle('hidden',m!=='Promo');if(m==='Normal'){$('sPrice').value=$('sBasePrice').value;$('sDiscount').value=0;$('sFreeQty').value=0}else if(m==='Promo'){ $('sPrice').value=$('sBasePrice').value;if($('sFreeQty'))$('sFreeQty').readOnly=true;if($('sPromoName'))$('sPromoName').value='Jumat Berkah'}else if($('sFreeQty'))$('sFreeQty').readOnly=false;refreshSaleProductOptions();updateSalePricing();updateFridayPromoUI();renderSaleProductCards()}
function updateSalePricing(){if(!$('sBasePrice')||!$('sPrice'))return;const selectedMode=$('sMode')?.value||'Normal';const base=Math.max(0,Number($('sBasePrice').value)||0);const qty=Math.max(1,Number($('sQty').value)||1);const customer=selectedCustomer();const p=db.products.find(x=>String(x.id)===String($('sProd')?.value||''));const auto=fridayAutoPromo(p,qty,customer);const m=auto.active?'Promo':(auto.quotaExhausted?auto.mode:selectedMode);$('freeFields')?.classList.toggle('hidden',!(auto.active||m==='Promo'));$('promoNameField')?.classList.toggle('hidden',!(auto.active||m==='Promo'));let price=base,free=0,promoText='';if(auto.active){if($('sFreeQty'))$('sFreeQty').readOnly=true;if($('sPromoName'))$('sPromoName').value='Jumat Berkah';price=base;free=auto.free;if($('sFreeQty'))$('sFreeQty').value=free;promoText=auto.text;if($('customerHint'))$('customerHint').textContent='Jumat Berkah berlaku otomatis untuk semua konsumen selama kuota/dana masih tersedia; sisa pembelian mengikuti hak harga pelanggan.'}else if(m==='Reseller'){const rule=p?resellerRule(p.id):null;const eligible=p?resellerEligible(customer,p.id,qty):false;const ctype=String(customer?.customer_type||'').trim().toLowerCase();if(rule&&eligible){price=Number(rule.reseller_price)||base;if($('customerHint'))$('customerHint').textContent=ctype==='reseller tetap'?`Reseller Tetap: harga reseller ${rup(price)} berlaku.`:`Reseller: harga reseller ${rup(price)} berlaku mulai ${fmtNum(rule.min_qty||100)} pcs.`}else{price=base;if(rule&&customer&&ctype==='reseller'&&qty<Number(rule.min_qty||100)&&$('customerHint'))$('customerHint').textContent=`Reseller: minimal ${fmtNum(rule.min_qty||100)} pcs untuk harga reseller ${rup(rule.reseller_price)}.`}}else if(m==='Diskon'){const disc=Math.max(0,Number($('sDiscount').value)||0),type=$('sDiscountType')?.value||'Rp';price=type==='%'?Math.max(0,base-(base*disc/100)):Math.max(0,base-disc)}else if(m==='Promo'){price=base;const pv=fridayPromoValues(p,qty);if(pv.error){free=0;promoText=`⚠ ${pv.error}`}else{free=pv.free;promoText=`Jumat Berkah · ${pv.blocks} kelipatan · sedekah ${free} pcs`}$('sFreeQty').value=free}else{$('sFreeQty').value=0}if(auto.error&&!auto.active){promoText=auto.text;if($('sFreeQty'))$('sFreeQty').value=0}$('sPrice').value=price;const discountTotal=Math.max(0,(base-price)*qty),net=price*qty,totalQty=qty+free;const promo=auto.active?'Jumat Berkah':(auto.quotaExhausted&&m==='Reseller'?'Harga Reseller':m==='Promo'?'Jumat Berkah':m==='Reseller'?'Harga Reseller':m==='Diskon'?'Diskon / Potongan':'');if($('saleSummary'))$('saleSummary').innerHTML=`<div class="card" style="padding:10px;background:#f7fbfa"><b>Ringkasan:</b> ${qty} dibayar${free?` + ${free} sedekah`:''} = <b>${totalQty} pcs/unit keluar</b> · Harga normal ${rup(base)} · Penjualan bersih <b>${rup(net)}</b>${discountTotal?` · Potongan <b>${rup(discountTotal)}</b>`:''}${promo?` · ${esc(promo)}`:''}${promoText?`<br><small>${esc(promoText)}</small>`:''}</div>`;updateFridayPromoUI();updateChange()}
function addToCartAdvanced(){const p=db.products.find(x=>String(x.id)===String($('sProd')?.value||''));if(!p)return alert('Pilih produk terlebih dahulu.');const selectedMode=$('sMode').value,paid=Math.max(1,Number($('sQty').value)||1),base=Math.max(0,Number($('sBasePrice').value)||0);const customer=selectedCustomer();const auto=fridayAutoPromo(p,paid,customer);const plan=fridaySplitPlan(p,paid);const mode=auto.active?'Promo':(auto.quotaExhausted?auto.mode:selectedMode);const addItem=(itemMode,itemPaid,itemFree,itemPrice,itemPromoName,itemDiscount=0)=>{if(itemPaid<=0)return;const gross=itemPrice*itemPaid,key=`${p.id}|${itemPrice}|${itemFree}|${itemMode}|${itemPromoName||''}|${customer?.id||''}`;const existing=window.saleCart.find(x=>x.key===key);const item={key,customer_id:customer?.id||null,customer_name:customer?.name||'',product_id:p.id,product_name:p.name,paid_qty:itemPaid,free_qty:itemFree,qty:itemPaid+itemFree,price:itemPrice,cost:productHpp(p),base_price:base,discount_amount:itemDiscount,gross_amount:gross,sale_mode:itemMode,promo_name:itemPromoName||''};if(existing){existing.paid_qty+=itemPaid;existing.free_qty+=itemFree;existing.qty+=item.qty;existing.gross_amount+=gross;existing.discount_amount+=itemDiscount}else window.saleCart.push(item)};if(auto.active){const promoPaid=plan.promoPaid,promoFree=plan.promoFree;addItem('Promo',promoPaid,promoFree,base,'Jumat Berkah',0);const fallback=plan.fallbackPaid;if(fallback>0){const type=String(customer?.customer_type||'').trim().toLowerCase();const rule=resellerRule(p.id);let fallbackMode='Normal',fallbackPrice=base;if(['reseller','reseller tetap'].includes(type)){if(!rule)return alert(`Harga reseller untuk ${p.name} belum diatur.`);if(type==='reseller tetap'||fallback>=Number(rule.min_qty||100)){fallbackMode='Reseller';fallbackPrice=Number(rule.reseller_price)||base}else if(selectedMode==='Diskon'){fallbackMode='Diskon';fallbackPrice=Math.max(0,Number($('sPrice').value)||base)}}else if(selectedMode==='Diskon'){fallbackMode='Diskon';fallbackPrice=Math.max(0,Number($('sPrice').value)||base)}const fallbackDiscount=Math.max(0,(base-fallbackPrice)*fallback);addItem(fallbackMode,fallback,0,fallbackPrice,fallbackMode==='Reseller'?'Harga Reseller':fallbackMode==='Diskon'?'Diskon / Potongan':'',fallbackDiscount);if($('sPromoName'))$('sPromoName').value='Jumat Berkah';if($('customerHint'))$('customerHint').textContent=`Jumat Berkah ${promoPaid} pcs + ${fallback} pcs mengikuti harga pelanggan dalam satu checkout.`}}else if(mode==='Reseller'){const rule=resellerRule(p.id),ctype=String(customer?.customer_type||'').trim().toLowerCase();if(!customer||!['reseller','reseller tetap'].includes(ctype))return alert('Pilih pelanggan/reseller terlebih dahulu untuk penjualan reseller.');if(!rule)return alert(`Harga reseller untuk ${p.name} belum diatur.`);if(!resellerEligible(customer,p.id,paid))return alert(`Minimal ${fmtNum(rule.min_qty||100)} pcs untuk reseller ini. Reseller Tetap boleh di bawah minimal.`);const price=Number(rule.reseller_price)||base;addItem('Reseller',paid,0,price,'Harga Reseller',Math.max(0,(base-price)*paid))}else if(mode==='Promo'){const pv=fridayPromoValues(p,paid);if(pv.error)return alert(pv.error);addItem('Promo',paid,pv.free,base,'Jumat Berkah',0)}else if(mode==='Normal'){addItem('Normal',paid,0,base,'',0)}else if(mode==='Diskon'){const price=Math.max(0,Number($('sPrice').value)||0);if(price>base)return alert('Harga jual setelah potongan tidak boleh lebih tinggi dari harga normal.');addItem('Diskon',paid,0,price,'Diskon / Potongan',Math.max(0,(base-price)*paid))}if(!window.saleCart.length)return alert('Tidak ada item yang dapat dimasukkan ke keranjang.');renderSaleCart();$('sQty').value=1;$('sFreeQty').value=0;updateSalePricing()}