import csv, random
random.seed(42)
# ---- Elo ratings (my judgement, anchored to outright odds) ----
R={'FRA':2090,'ESP':2085,'ARG':2080,'ENG':2040,'BRA':2030,'POR':2010,'GER':2000,'NED':1980,
'BEL':1950,'CRO':1930,'MAR':1900,'COL':1870,'SUI':1860,'SEN':1850,'JPN':1840,'NOR':1825,
'MEX':1820,'ECU':1810,'USA':1800,'SWE':1800,'CIV':1785,'AUT':1765,'CAN':1760,'EGY':1745,
'PAR':1740,'ALG':1730,'AUS':1730,'GHA':1720,'BIH':1715,'COD':1700,'RSA':1680,'CPV':1650}
R32={73:('RSA','CAN'),74:('GER','PAR'),75:('NED','MAR'),76:('BRA','JPN'),77:('FRA','SWE'),
78:('CIV','NOR'),79:('MEX','ECU'),80:('ENG','COD'),81:('USA','BIH'),82:('BEL','SEN'),
83:('POR','CRO'),84:('ESP','AUT'),85:('SUI','ALG'),86:('ARG','CPV'),87:('COL','GHA'),88:('AUS','EGY')}
R16={89:(74,77),90:(73,75),91:(76,78),92:(79,80),93:(83,84),94:(81,82),95:(86,88),96:(85,87)}
QF={97:(89,90),98:(93,94),99:(91,92),100:(95,96)}
SF={101:(97,98),102:(99,100)}
def pwin(a,b): return 1/(1+10**((R[b]-R[a])/400))
def play(a,b): return a if random.random()<pwin(a,b) else b
N=40000
reach={t:{'R16':0,'QF':0,'SF':0,'F':0,'W':0} for t in R}
for _ in range(N):
    w={}
    for m,(a,b) in R32.items(): w[m]=play(a,b)
    for m,(x,y) in R16.items(): w[m]=play(w[x],w[y]); reach[w[m]]['R16']+=1
    for m,(x,y) in QF.items(): w[m]=play(w[x],w[y]); reach[w[m]]['QF']+=1
    for m,(x,y) in SF.items(): w[m]=play(w[x],w[y]); reach[w[m]]['SF']+=1
    champ=play(w[101],w[102]); reach[w[101]]['F']+=1; reach[w[102]]['F']+=1; reach[champ]['W']+=1
for t in reach:
    for k in reach[t]: reach[t][k]/=N
# expected matches remaining from R32 onward (incl final-or-3rd for SF reachers)
Em={t: 1 + reach[t]['R16'] + reach[t]['QF'] + 2*reach[t]['SF'] for t in R}
print("=== Expected knockout matches remaining | title% (by Em) ===")
for t in sorted(R,key=lambda t:-Em[t]):
    print(f"{t}: {Em[t]:.2f} matches | win {reach[t]['W']*100:4.1f}% | R16 {reach[t]['R16']*100:4.0f}% QF {reach[t]['QF']*100:4.0f}% SF {reach[t]['SF']*100:4.0f}%")

# ---- players ----
DK2C={'Spanien':'ESP','Frankrig':'FRA','Argentina':'ARG','Brasilien':'BRA','England':'ENG','Portugal':'POR',
'Tyskland':'GER','Holland':'NED','Belgien':'BEL','Kroatien':'CRO','Marokko':'MAR','Colombia':'COL','Schweiz':'SUI',
'Senegal':'SEN','Japan':'JPN','Mexico':'MEX','Ecuador':'ECU','USA':'USA','Sverige':'SWE','Norge':'NOR',
'Australien':'AUS','Egypten':'EGY','Østrig':'AUT','Algeriet':'ALG','Elfenbenskysten':'CIV','Paraguay':'PAR',
'Ghana':'GHA','Canada':'CAN','Bosnien-Hercegovina':'BIH','Sydafrika':'RSA','Kap Verde':'CPV','Congo DR':'COD'}
rows=list(csv.DictReader(open('/tmp/stats.csv',encoding='utf-8-sig'),delimiter=';'))
def gi(s):
    s=(s or '').strip(); return int(s) if s.lstrip('-').isdigit() else 0
P=[]
for r in rows:
    c=DK2C.get(r['Hold']); 
    if not c: continue
    ix=gi(r['Index']); ppg=ix/3.0
    r['c']=c; r['ppg']=ppg; r['EFP']=ppg*Em[c]; r['P']=gi(r['Pris']); r['POP']=float((r['Popularitet %'] or '0').replace(',','.'))
    P.append(r)
def efp(name,team,sp=1.0):
    for r in P:
        if r['Hold']==team and name.lower() in r['Navn'].lower(): return r,r['EFP']*sp
    return None,0
print("\n=== MY SQUAD — expected future points (EFP = Index/3 × matches) ===")
squad=[('Unai Sim','Spanien',1),('Riad','Marokko',1),('De Fougerolles','Canada',1),('Douglas Santos','Brasilien',1),
('Ounahi','Marokko',0.5),('Saibari','Marokko',1),('Tchouameni','Frankrig',1),('Jhon Arias','Colombia',1),
('Oyarzabal','Spanien',1),('Mbappe','Frankrig',1),('Haaland','Norge',0.9)]
tot=0
for nm,hold,sp in squad:
    r,e=efp(nm,hold,sp); tot+=e
    print(f"EFP {e:5.1f} | Em {Em[r['c']]:.2f} | idx {gi(r['Index']):>3} | {r['Navn']} ({r['c']})")
print(f"SQUAD EFP total (outfield/keeper, no captain): {tot:.0f}")
print("\n=== TOP 18 players by EFP (transfer targets) ===")
for r in sorted(P,key=lambda r:-r['EFP'])[:18]:
    print(f"EFP {r['EFP']:5.1f} | Em {Em[r['c']]:.2f} | idx {gi(r['Index']):>3} |{r['P']/1e6:5.1f}M |{r['POP']:5.1f}% | {r['Navn']} ({r['c']},{r['Position'][:3]})")
print("\n=== TRANSFER deltas (EFP gained) ===")
def delta(outn,outh,outsp,inn,inh):
    ro,eo=efp(outn,outh,outsp); ri,ei=efp(inn,inh)
    print(f"{outn}->{inn}: ΔEFP {ei-eo:+5.1f} (out {eo:.1f} idx{gi(ro['Index'])} -> in {ei:.1f} idx{gi(ri['Index'])}, price {ro['P']/1e6:.1f}->{ri['P']/1e6:.1f}M)")
delta('Haaland','Norge',0.9,'Messi','Argentina')
delta('Ounahi','Marokko',0.5,'Manzambi','Schweiz')
delta('Ounahi','Marokko',0.5,'Quinones','Mexico')
delta('Riad','Marokko',1,'Medina','Argentina')
delta('Riad','Marokko',1,'Lisandro Martinez','Argentina')
delta('Oyarzabal','Spanien',1,'Messi','Argentina')
delta('Tchouameni','Frankrig',1,'Dembele','Frankrig')
delta('Jhon Arias','Colombia',1,'Manzambi','Schweiz')
delta('Douglas Santos','Brasilien',1,'Medina','Argentina')
