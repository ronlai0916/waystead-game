import sys
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+0.05)/(lb+0.05)
P={
 'A light':[('text','#1B1A20','#FFF8E6'),('muted','#5C5444','#FFF8E6'),('muted/surface','#5C5444','#FFFFFF'),('btn white/leaf','#FFFFFF','#2E7D32'),('link leaf/bg','#256B29','#FFF8E6'),
   ('pink text','#B02D63','#FFF8E6'),('sq ink/spark','#1B1A20','#E2F2CB'),('sq ink/glow','#1B1A20','#93CF6E'),('sq ink/shine','#1B1A20','#FDD3E1'),('sq ink/star','#1B1A20','#FBB437'),
   ('tile ink/honey','#1B1A20','#FFD95E'),('pending white/pink','#FFFFFF','#C2346E'),('+5 ink/sun','#1B1A20','#FFC93C'),('tile vs plain sq (3:1 not needed)','#FFD95E','#FFFDF7')],
 'A dark':[('text','#F6F1E3','#14201A'),('muted','#BDC7B4','#14201A'),('muted/surface','#BDC7B4','#1C2B22'),('btn ink/leaf','#14201A','#8FD175'),('link','#A6DD8F','#14201A'),('pink text','#F49CBF','#1C2B22'),
   ('tile ink/honey','#1B1A20','#FFD95E'),('pending ink/pink','#1B1A20','#F48FB6'),('sq plain vs bg','#22322A','#14201A')],
 'B light':[('text','#1B1A20','#FFFAF0'),('muted','#5A5249','#FFFAF0'),('btn white/cobalt','#FFFFFF','#2250D0'),('link cobalt','#2250D0','#FFFAF0'),('red text','#C4321F','#FFFAF0'),
   ('sq ink/spark','#1B1A20','#FFE9A3'),('sq ink/glow','#1B1A20','#FFC21A'),('sq ink/shine','#1B1A20','#FFCABD'),('sq ink/star','#1B1A20','#FF7A5E'),
   ('tile ink/cream','#1B1A20','#FFFDF6'),('pending white/cobalt','#FFFFFF','#2250D0'),('+5 white/red','#FFFFFF','#D63A24'),('green ink','#1B1A20','#3DBA5C'),('ink border vs bg (3:1)','#1B1A20','#FFFAF0')],
 'B dark':[('text','#F7F2E8','#191613'),('muted','#C2B8AA','#191613'),('muted/surface','#C2B8AA','#24201B'),('btn ink/cobalt-l','#1B1A20','#8DAAFF'),('link','#9DB6FF','#191613'),('red text','#FF8E7A','#24201B'),
   ('tile ink/cream','#1B1A20','#FFFDF6'),('pending ink/cobalt-l','#1B1A20','#8DAAFF'),('border cream vs bg','#F7F2E8','#191613')],
 'C dark':[('text','#F3F1FF','#11133A'),('muted','#BAB9E2','#11133A'),('muted/surface','#BAB9E2','#1B1E52'),('btn ink/gold','#1B1A20','#FFD45C'),('link gold','#FFD45C','#11133A'),('nebula pink','#FF9ACB','#1B1E52'),
   ('sq light/spark','#F3F1FF','#2D3A8E'),('sq light/glow','#FFFFFF','#4A55C8'),('sq light/shine','#FFFFFF','#8A3E78'),('sq ink/star','#1B1A20','#FFC94A'),
   ('tile ink/moon','#1B1A20','#FFF4D2'),('pending ink/gold','#1B1A20','#FFD45C'),('plain sq','#1E2258','#11133A')],
 'C light':[('text','#1B1A20','#F4F2FF'),('muted','#55537A','#F4F2FF'),('btn white/indigo','#FFFFFF','#3A3FB0'),('link','#3A3FB0','#F4F2FF'),('pink','#A83273','#FFFFFF'),
   ('sq ink/spark','#1B1A20','#D9DEFF'),('sq ink/glow','#1B1A20','#9DA8F5'),('sq ink/shine','#1B1A20','#F2C9E6'),('sq ink/star','#1B1A20','#FFC94A'),('tile white/indigo','#FFFFFF','#2B2F86'),('pending ink/gold','#1B1A20','#FFD45C')],
}
for k,v in P.items():
    print('==',k)
    for n,a,b in v:
        c=cr(a,b); print(f'  {n:34s} {a} on {b}: {c:5.2f}', 'AA' if c>=4.5 else ('AA-large/UI' if c>=3 else 'FAIL'))
