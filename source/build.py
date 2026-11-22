import os,glob,json,time,sys
V=str(int(time.time()))
src='src';dist='dist'
os.makedirs(dist,exist_ok=True)
css=open(f'{src}/style.css').read()+'\n'+open(f'{src}/style2.css').read()
open(f'{dist}/app.css','w').write(css)
parts=sorted(p for p in glob.glob(f'{src}/*.js') if not p.endswith('sw.js'))
js='(function(){\n"use strict";\n'+'\n'.join(open(p).read() for p in parts)+'\n})();\n'
open(f'{dist}/app.js','w').write(js)
body=open(f'{src}/body.html').read()
body=body.replace('<body class="fx">','<body class="fx">\n'+open(f'{src}/bootfx.html').read(),1)
html=(open(f'{src}/head.html').read()+body+open(f'{src}/tail.html').read()).replace('__V__',V)
open(f'{dist}/index.html','w').write(html)
cfg=json.load(open('config.json')) if os.path.exists('config.json') else {"supabaseUrl":"","supabaseKey":""}
open(f'{dist}/config.js','w').write('window.APP_CONFIG='+json.dumps(cfg)+';\n')
man={"name":"Dylan's System","short_name":"System","description":"Daily plan, gym, journal and money.","start_url":"./#today","scope":"./","display":"standalone","display_override":["fullscreen","standalone"],"orientation":"any","background_color":"#050505","theme_color":"#050505",
 "icons":[{"src":"icons/icon-192.png?v=2","sizes":"192x192","type":"image/png"},{"src":"icons/icon-512.png?v=2","sizes":"512x512","type":"image/png"},{"src":"icons/maskable-512.png?v=2","sizes":"512x512","type":"image/png","purpose":"maskable"}],
 "shortcuts":[{"name":"Today","url":"./#today"},{"name":"Start workout","url":"./#gym"},{"name":"Journal","url":"./#journal"}]}
open(f'{dist}/manifest.webmanifest','w').write(json.dumps(man,indent=1))
sw=open(f'{src}/sw.js').read().replace('__V__',V)
open(f'{dist}/sw.js','w').write(sw)
import subprocess
T='/tmp/tools/node_modules/.bin/'
if os.path.exists(T+'esbuild') and '--dev' not in sys.argv:
    # strip unused CSS (classes built at runtime are safelisted), then minify both bundles
    subprocess.run([T+'purgecss','--css',f'{dist}/app.css','--content',f'{dist}/index.html',f'{dist}/app.js','--output',f'{dist}/',
      '--safelist','on','open','hidden','fx','poweron','edit-on','done','ok','bad','warn','pink','dim','num','p','active','sel','live','playing',
      '--safelist','-pattern','/^(lcd-|st-|xl-|m[0-9]|t-|h[0-9]|is-|has-|lv|tier|cat-|ty-|fx-|sk-)/'],check=True)
    for f in ['app.js','app.css']:
        subprocess.run([T+'esbuild',f'{dist}/{f}','--minify','--allow-overwrite','--log-level=warning','--outfile='+f'{dist}/{f}']+(['--target=es2020'] if f.endswith('js') else []),check=True)
print('built',V,os.path.getsize(f'{dist}/app.js'),'js',os.path.getsize(f'{dist}/app.css'),'css')
import shutil,os
for f in os.listdir('static'):shutil.copy(os.path.join('static',f),os.path.join(dist,f))
os.makedirs(os.path.join(dist,'vendor'),exist_ok=True)
_z=os.path.join(os.path.dirname(os.path.abspath(__file__)),'vendor_keep','zxing.min.js')
shutil.copy(_z,os.path.join(dist,'vendor','zxing.min.js')) if os.path.exists(_z) else None
# home-screen widgets (Scriptable): the code the loader fetches, and the loader itself
_app='https://dylanmahal.github.io/dylans-system/'
for _src,_out in (('widget/system-widget.js','widget.js'),('widget/loader.js','widget-loader.js')):
    _w=open(_src).read().replace('__URL__',cfg.get('supabaseUrl','')).replace('__KEY__',cfg.get('supabaseKey','')).replace('__APP__',_app)
    open(os.path.join(dist,_out),'w').write(_w)
