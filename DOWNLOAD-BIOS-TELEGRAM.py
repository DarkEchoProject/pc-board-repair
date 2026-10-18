#!/usr/bin/env python3
import argparse, asyncio, csv, hashlib, json, os, re, shutil, sqlite3, sys, time
from datetime import datetime, timezone
from pathlib import Path
from telethon import TelegramClient, errors

DEFAULT_CHANNEL='biosarchive'
DEFAULT_ROOT=r'C:\Users\ALFA\Downloads\Telegram Desktop\_BIOS_RAW'
ALLOWED_EXTENSIONS={'.bin','.rom','.fd','.cap','.bio','.wph','.fl1','.fl2','.hdr','.hex','.img','.efi','.dec','.bin.gz','.zip','.rar','.7z','.tar','.gz','.tgz'}
PAID_PATTERNS=[re.compile(r'\bVIP\b',re.I),re.compile(r'\bNOT[\s_-]*FREE\b',re.I),re.compile(r'\bPAID\b',re.I),re.compile(r'\bPREMIUM\b',re.I),re.compile(r'غير\s*مجاني',re.I),re.compile(r'مدفوع',re.I)]
BRAND_PATTERNS=[
('ASUS',[r'\basus\b',r'\b60nb']),('Acer',[r'\bacer\b',r'\baspire\b',r'\btravelmate\b']),('Dell',[r'\bdell\b',r'\boptiplex\b',r'\blatitude\b',r'\binspiron\b',r'\bvostro\b',r'\bprecision\b']),('HP',[r'\bhewlett\b',r'\bhp\b',r'\bcompaq\b',r'\bprobook\b',r'\belitebook\b',r'\bpavilion\b',r'\bprodesk\b',r'\belitedesk\b',r'\bzbook\b']),('Lenovo',[r'\blenovo\b',r'\bthinkpad\b',r'\bideapad\b',r'\bthinkcentre\b',r'\blegion\b']),('MSI',[r'\bmsi\b',r'\bmicro[- ]?star\b']),('Gigabyte',[r'\bgigabyte\b']),('ASRock',[r'\basrock\b']),('Apple',[r'\bapple\b',r'\bmacbook\b',r'\bimac\b',r'\b820[-_ ]\d+']),('Samsung',[r'\bsamsung\b']),('Toshiba',[r'\btoshiba\b',r'\bdynabook\b']),('Sony',[r'\bsony\b',r'\bvaio\b']),('Fujitsu',[r'\bfujitsu\b']),('Clevo',[r'\bclevo\b']),('Huawei',[r'\bhuawei\b']),('Xiaomi',[r'\bxiaomi\b',r'\bmi notebook\b']),('Razer',[r'\brazer\b']),('Microsoft',[r'\bmicrosoft\b',r'\bsurface\b']),('Intel',[r'\bintel\b']),('ECS',[r'\belitegroup\b',r'\becs\b']),('Biostar',[r'\bbiostar\b']),('Foxconn',[r'\bfoxconn\b']),('Pegatron',[r'\bpegatron\b']),('Quanta',[r'\bquanta\b']),('Compal',[r'\bcompal\b']),('Wistron',[r'\bwistron\b']),('Inventec',[r'\binventec\b']),('LCFC',[r'\blcfc\b'])]
BRAND_REGEX=[(b,[re.compile(p,re.I) for p in ps]) for b,ps in BRAND_PATTERNS]
INVALID_WIN=re.compile(r'[<>:"/\\|?*\x00-\x1f]')

def utcnow(): return datetime.now(timezone.utc).isoformat()
def human_bytes(n):
    n=int(n or 0); v=float(n)
    for u in ['B','KB','MB','GB','TB']:
        if v<1024 or u=='TB': return f'{v:.2f} {u}' if u!='B' else f'{int(v)} B'
        v/=1024

def safe_filename(name):
    name=INVALID_WIN.sub('_',name or '').strip().rstrip('. ')
    if not name: name='bios-file'
    if len(name)>180:
        stem,ext=os.path.splitext(name); name=stem[:max(1,180-len(ext))].rstrip()+ext
    return name

def file_extension(name):
    low=(name or '').lower()
    return '.bin.gz' if low.endswith('.bin.gz') else Path(low).suffix

def is_paid(text): return any(p.search(text or '') for p in PAID_PATTERNS)
def classify_brand(text):
    for brand,pats in BRAND_REGEX:
        if any(p.search(text or '') for p in pats): return brand
    return 'Other'

def sha256_file(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(4*1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def load_or_create_config(config_dir):
    config_dir.mkdir(parents=True,exist_ok=True); p=config_dir/'config.json'
    if p.exists():
        try:
            cfg=json.loads(p.read_text(encoding='utf-8'))
            if cfg.get('api_id') and cfg.get('api_hash'): return cfg
        except Exception: pass
    print('\nTelegram API setup - first run only.')
    print('Get API ID and API Hash from https://my.telegram.org -> API development tools.')
    print('Do NOT send these values in chat; enter them only here on your PC.\n')
    api_id=input('Telegram API ID: ').strip(); api_hash=input('Telegram API Hash: ').strip()
    if not api_id.isdigit() or not api_hash: raise SystemExit('Invalid API ID/API Hash.')
    cfg={'api_id':int(api_id),'api_hash':api_hash}; p.write_text(json.dumps(cfg,indent=2),encoding='utf-8'); return cfg

def db_connect(path):
    con=sqlite3.connect(path)
    con.execute('''CREATE TABLE IF NOT EXISTS messages(channel TEXT NOT NULL,message_id INTEGER NOT NULL,message_date TEXT,brand TEXT,original_name TEXT,saved_path TEXT,size_bytes INTEGER,sha256 TEXT,status TEXT NOT NULL,caption TEXT,link TEXT,error TEXT,updated_at TEXT NOT NULL,PRIMARY KEY(channel,message_id))''')
    con.execute('CREATE INDEX IF NOT EXISTS idx_messages_sha ON messages(sha256)'); con.execute('CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)'); con.commit(); return con

def upsert(con,row):
    con.execute('''INSERT INTO messages(channel,message_id,message_date,brand,original_name,saved_path,size_bytes,sha256,status,caption,link,error,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(channel,message_id) DO UPDATE SET message_date=excluded.message_date,brand=excluded.brand,original_name=excluded.original_name,saved_path=excluded.saved_path,size_bytes=excluded.size_bytes,sha256=excluded.sha256,status=excluded.status,caption=excluded.caption,link=excluded.link,error=excluded.error,updated_at=excluded.updated_at''',(row['channel'],row['message_id'],row.get('message_date'),row.get('brand'),row.get('original_name'),row.get('saved_path'),row.get('size_bytes'),row.get('sha256'),row['status'],row.get('caption'),row.get('link'),row.get('error'),utcnow())); con.commit()

def export_csv(con,out_path,channel):
    cols=['channel','message_id','message_date','brand','original_name','saved_path','size_bytes','sha256','status','caption','link','error','updated_at']
    rows=con.execute('SELECT '+','.join(cols)+' FROM messages WHERE channel=? ORDER BY message_id',(channel,)).fetchall()
    with open(out_path,'w',newline='',encoding='utf-8-sig') as f: w=csv.writer(f); w.writerow(cols); w.writerows(rows)

def final_destination(root,brand,original_name,message_id):
    folder=root/brand; folder.mkdir(parents=True,exist_ok=True); name=safe_filename(original_name); dest=folder/name
    if not dest.exists(): return dest
    stem,ext=os.path.splitext(name); return folder/f'{stem}__msg{message_id}{ext}'

class Progress:
    def __init__(self,label): self.label=label; self.last_t=0
    def __call__(self,current,total):
        now=time.time()
        if now-self.last_t<0.5 and current<total:return
        self.last_t=now; pct=(current/total*100) if total else 0
        sys.stdout.write(f'\r  {self.label[:55]:55} {pct:6.2f}%  {human_bytes(current)}/{human_bytes(total)}'); sys.stdout.flush()
        if total and current>=total: sys.stdout.write('\n')

async def process_message(client,msg,channel,root,tmp_dir,con,min_free_bytes,allow_all_documents=False):
    caption=msg.message or ''; link=f'https://t.me/{channel}/{msg.id}'
    base={'channel':channel,'message_id':msg.id,'message_date':msg.date.isoformat() if msg.date else '','caption':caption[:4000],'link':link,'brand':'','original_name':'','saved_path':'','size_bytes':0,'sha256':'','error':''}
    if is_paid(caption): base['status']='SKIPPED_PAID_OR_VIP'; upsert(con,base); return 'skipped'
    if not msg.document or not msg.file: base['status']='SKIPPED_NO_DOCUMENT'; upsert(con,base); return 'skipped'
    original_name=msg.file.name or f'telegram_{msg.id}{msg.file.ext or ""}'; ext=file_extension(original_name); mime=(getattr(msg.file,'mime_type','') or '').lower()
    if not allow_all_documents:
        allowed_mimes={'application/octet-stream','application/zip','application/x-rar-compressed','application/vnd.rar','application/x-7z-compressed','application/gzip'}
        if ext not in ALLOWED_EXTENSIONS and mime not in allowed_mimes:
            base.update({'original_name':original_name,'size_bytes':int(getattr(msg.file,'size',0) or 0),'status':'SKIPPED_EXTENSION'}); upsert(con,base); return 'skipped'
    brand=classify_brand(f'{original_name}\n{caption}'); size=int(getattr(msg.file,'size',0) or 0); base.update({'brand':brand,'original_name':original_name,'size_bytes':size})
    free=shutil.disk_usage(root).free
    if free-size < min_free_bytes:
        print(f'\nSTOP: not enough free disk space. Free={human_bytes(free)}, next file={human_bytes(size)}. Keeping at least {human_bytes(min_free_bytes)} free.')
        raise SystemExit(3)
    tmp_dir.mkdir(parents=True,exist_ok=True); tmp_path=tmp_dir/f'{channel}-{msg.id}.part'
    try:
        if tmp_path.exists(): tmp_path.unlink()
    except OSError: pass
    print(f'[{msg.id}] {brand} | {original_name} | {human_bytes(size)}')
    try:
        await client.download_media(msg,file=str(tmp_path),progress_callback=Progress(original_name))
        if not tmp_path.exists() or tmp_path.stat().st_size==0: raise RuntimeError('Telegram returned no downloaded file.')
        digest=sha256_file(tmp_path); dup=con.execute("SELECT saved_path,message_id FROM messages WHERE sha256=? AND status='DOWNLOADED' LIMIT 1",(digest,)).fetchone()
        if dup:
            try: tmp_path.unlink()
            except OSError: pass
            base.update({'sha256':digest,'status':'DUPLICATE_SHA256','saved_path':dup[0] or '','error':f'Same content as message {dup[1]}'}); upsert(con,base); print(f'  duplicate SHA256 -> message {dup[1]}'); return 'duplicate'
        dest=final_destination(root,brand,original_name,msg.id); os.replace(tmp_path,dest); base.update({'sha256':digest,'status':'DOWNLOADED','saved_path':str(dest.resolve()),'size_bytes':dest.stat().st_size}); upsert(con,base); print(f'  saved -> {dest}'); return 'downloaded'
    except errors.FloodWaitError as e:
        wait_s=int(e.seconds)+5; print(f'\n  Telegram flood wait: sleeping {wait_s} seconds...'); await asyncio.sleep(wait_s); base.update({'status':'FAILED_RETRY','error':f'FloodWait {e.seconds}s'}); upsert(con,base); return 'failed'
    except Exception as e:
        try:
            if tmp_path.exists(): tmp_path.unlink()
        except OSError: pass
        base.update({'status':'FAILED_RETRY','error':repr(e)}); upsert(con,base); print(f'\n  FAILED: {e}'); return 'failed'

async def main_async(args):
    root=Path(args.output).expanduser(); root.mkdir(parents=True,exist_ok=True); meta=root/'_META'; tmp=root/'_TMP'; meta.mkdir(parents=True,exist_ok=True); tmp.mkdir(parents=True,exist_ok=True)
    localapp=Path(os.environ.get('LOCALAPPDATA',str(Path.home()))); cfgdir=localapp/'PCBoardRepair'/'TelegramBIOS'; cfg=load_or_create_config(cfgdir); session_path=cfgdir/'telegram-bios'
    channel=args.channel.lstrip('@').strip(); con=db_connect(meta/'bios-download.db'); csv_path=meta/'bios-download-log.csv'; client=TelegramClient(str(session_path),cfg['api_id'],cfg['api_hash']); await client.start(); entity=await client.get_entity(channel); min_free_bytes=int(args.min_free_gb*1024**3)
    print('\n========================================================\n PC Board Repair - Telegram BIOS downloader\n========================================================'); print(f'Channel:  @{channel}\nOutput:   {root}\nMode:     FREE/PUBLIC documents only; VIP/NOT_FREE skipped\nResume:   enabled\nDedupe:   SHA-256\nDisk:     stop before free space falls below {args.min_free_gb:g} GB\nStop:     Ctrl+C; run again later to resume\n========================================================\n')
    processed=0
    failed=[r[0] for r in con.execute("SELECT message_id FROM messages WHERE channel=? AND status='FAILED_RETRY' ORDER BY message_id",(channel,)).fetchall()]
    for mid in failed:
        msg=await client.get_messages(entity,ids=mid)
        if msg: await process_message(client,msg,channel,root,tmp,con,min_free_bytes,args.all_documents); processed+=1
        if args.max_messages and processed>=args.max_messages: break
    if not args.max_messages or processed<args.max_messages:
        min_id=int(con.execute("SELECT COALESCE(MAX(message_id),0) FROM messages WHERE channel=? AND status!='FAILED_RETRY'",(channel,)).fetchone()[0] or 0)
        print(f'Resuming after Telegram message ID {min_id}...\n' if min_id else 'Starting from the oldest available message...\n')
        async for msg in client.iter_messages(entity,reverse=True,min_id=min_id):
            result=await process_message(client,msg,channel,root,tmp,con,min_free_bytes,args.all_documents); processed+=1
            if processed%25==0: export_csv(con,csv_path,channel)
            if args.max_messages and processed>=args.max_messages: break
            if result=='downloaded': await asyncio.sleep(args.delay)
    export_csv(con,csv_path,channel); stats=dict(con.execute('SELECT status,COUNT(*) FROM messages WHERE channel=? GROUP BY status',(channel,)).fetchall()); bytes_dl=con.execute("SELECT COALESCE(SUM(size_bytes),0) FROM messages WHERE channel=? AND status='DOWNLOADED'",(channel,)).fetchone()[0]
    print('\n---------------- SUMMARY ----------------'); print(f"DOWNLOADED:           {stats.get('DOWNLOADED',0)}\nDUPLICATE_SHA256:     {stats.get('DUPLICATE_SHA256',0)}\nSKIPPED_PAID_OR_VIP:  {stats.get('SKIPPED_PAID_OR_VIP',0)}\nSKIPPED_EXTENSION:    {stats.get('SKIPPED_EXTENSION',0)}\nFAILED_RETRY:         {stats.get('FAILED_RETRY',0)}\nDownloaded size:      {human_bytes(bytes_dl)}\nLog:                  {csv_path}\nRun the same command again any time to resume.\n-----------------------------------------")
    await client.disconnect(); con.close()

def parse_args():
    p=argparse.ArgumentParser(description='Download free/public BIOS files from Telegram.'); p.add_argument('--channel',default=DEFAULT_CHANNEL); p.add_argument('--output',default=DEFAULT_ROOT); p.add_argument('--max-messages',type=int,default=0,help='Process at most N Telegram messages this run; 0 = all.'); p.add_argument('--delay',type=float,default=.4); p.add_argument('--min-free-gb',type=float,default=10.0); p.add_argument('--all-documents',action='store_true'); return p.parse_args()
if __name__=='__main__':
    try: asyncio.run(main_async(parse_args()))
    except KeyboardInterrupt: print('\nStopped by user. Progress already saved; run again to resume.')
