"""Build static/anidx.json — a compact, offline anime title index for instant typo-tolerant search.
Source: manami-project/anime-offline-database (minified .json.zst release asset).
Usage: python3 anidx.py /path/to/anime-offline-database-minified.json.zst"""
import json,re,sys,zstandard
raw=zstandard.ZstdDecompressor().stream_reader(open(sys.argv[1],'rb')).read()
T={'TV':0,'MOVIE':1,'ONA':2,'OVA':3,'SPECIAL':4}
out=[]
lat=re.compile(r"^[\x20-\x7eÀ-ɏ‘-”–—]+$")
for x in json.loads(raw)['data']:
  if x['type'] not in T or 'hentai' in x.get('tags',[]):continue
  mal=al=0
  for s in x['sources']:
    m=re.search(r'myanimelist\.net/anime/(\d+)',s)
    if m:mal=int(m.group(1))
    m=re.search(r'anilist\.co/anime/(\d+)',s)
    if m:al=int(m.group(1))
  if not(mal or al):continue
  sc=(x.get('score') or {}).get('arithmeticMean') or 0
  if x['type']=='SPECIAL' and sc<7.5:continue
  if not sc and x['type']!='TV':continue
  syn=[s for s in x.get('synonyms',[]) if lat.match(s) and len(s)<70 and s.lower()!=x['title'].lower()]
  FW=re.compile(r"\b(los|las|el|del|dos|das|der|die|und|les|des|du|dei|degli|della|dello|ao|aos|een|het|och|och|ja|ve|ile)\b",re.I)
  syn=[s for s in syn if s.isascii() and not FW.search(s)]
  EN=re.compile(r"\b(the|of|on|and|in|to|my|is|with|a|an)\b",re.I)
  syn.sort(key=lambda s:(0 if EN.search(s) else 1))
  seen=set();syn=[s for s in syn if not(s.lower() in seen or seen.add(s.lower()))][:7]
  p=x.get('picture','');m=re.search(r'cdn\.myanimelist\.net/images/anime/(\d+/\d+)\.jpg',p)
  pic=m.group(1) if m else ''
  out.append([mal,al,x['title'],syn,T[x['type']],x.get('episodes') or 0,(x.get('animeSeason') or {}).get('year') or 0,pic,round(sc,1)])
out.sort(key=lambda r:-(r[8]+(.6 if r[4]==0 else 0)))
json.dump(out,open('static/anidx.json','w'),separators=(',',':'),ensure_ascii=False)
print(len(out))
