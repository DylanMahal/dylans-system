import json,os
cfg=json.load(open('../config.json')) if os.path.exists('../config.json') else {'supabaseUrl':'','supabaseKey':''}
xlsx=r'C:\Users\dylan\OneDrive\Documents\Stack Budget.xlsx'
head=f"""param([switch]$Setup,[switch]$Autostart)
# Dylan's System - laptop sync agent. Keeps Stack Budget.xlsx and the app in step through Excel.
$ErrorActionPreference = 'Stop'
$DefaultUrl = '{cfg['supabaseUrl']}'
$DefaultKey = '{cfg['supabaseKey']}'
$DefaultXlsx = '{xlsx}'
"""
s=head+open('_json.ps1').read()+open('agent_body.ps1').read()
os.makedirs('out',exist_ok=True)
open('out/agent.ps1','w',encoding='utf-8-sig').write(s)
open('out/Install sync agent.cmd','w',newline='\r\n').write('@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0agent.ps1" -Setup\r\n')
print('ok')
