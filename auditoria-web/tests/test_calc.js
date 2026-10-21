const {calcular}=require('../calc.js'), M=require('../mapping.js');
console.log(M.subelementos.length,'SE');
const rows=[
 {norma:'ISO 9001',punto:'5.2',valor:100,fila:2},
 {norma:'ISO 9001',punto:'4.3',valor:30,fila:3},
 {norma:'ISO 9001',punto:'5.1',valor:50,fila:4},     // SE2
 {norma:'ISO 9001',punto:'10.2',valor:80,fila:5},
 {norma:'ISO 9001',punto:'10.2.1',valor:40,fila:6},
 {norma:'ISO 9001',punto:'10.2.2',valor:60,fila:7},
 {norma:'ISO 14001',punto:'10.2',valor:20,fila:8},
 {norma:'ISO 9001',punto:'9.9',valor:20,fila:9},
 {norma:'ISO 9001',punto:'4.1',valor:null,fila:10},
 {norma:'9001:2015',punto:'5.2.1',valor:0,fila:11},
];
const r=calcular(rows,M);
for(const e of r.elementos)console.log(e.elemento,e.valor,e.seEvaluados+'/'+e.seTotal);
for(const s of r.subelementos.filter(s=>s.valor!=null))console.log(s.se,s.valor,JSON.stringify(s.porNorma));
for(const d of r.detalle)console.log(d.fila,d.norma,d.punto,'->',d.subelementos,'|',d.estado);
