// Smoke test de la lógica de cobros.  Correr con:  node test-cobros.js
// No copia el código: lo extrae de index.html, así el test no se desactualiza.
var fs = require('fs'), assert = require('assert');

var src = fs.readFileSync(__dirname + '/index.html', 'utf8');
var from = src.indexOf('function cobroPaidBy');
var to   = src.indexOf('// ── Navegación ──');
assert.ok(from > 0 && to > from, 'no encontré el bloque de funciones puras en index.html');

var cobros, cobroPagos, members;
function isCurrentlyInactive(m){ return !!m.baja; }   // stub
eval(src.slice(from, to));                            // trae cobroPaidBy, cobroTotal, reservadoEventos, cobroStatus...

// ── Escenario: cena a $25.000 por cabeza, 3 miembros (uno dado de baja) ──
members = [
  {id:'a', apellido:'Alvarez', nombre:'Ana'},
  {id:'b', apellido:'Bravo',   nombre:'Beto'},
  {id:'z', apellido:'Zapata',  nombre:'Zoe', baja:true}
];
cobros = [
  {id:'cena', nombre:'Cena', monto:25000, fechaEvento:'2026-11-12', cerrado:false},
  {id:'rifa', nombre:'Rifa', monto:0,     fechaEvento:'',           cerrado:true}
];
cobroPagos = [
  {id:'p1', cobroId:'cena', memberId:'a', amount:10000, date:'2026-09-01'}, // paga en cuotas
  {id:'p2', cobroId:'cena', memberId:'a', amount:15000, date:'2026-10-05'},
  {id:'p3', cobroId:'cena', memberId:'b', amount: 5000, date:'2026-09-20'}, // seña
  {id:'p4', cobroId:'rifa', memberId:'b', amount: 3000, date:'2026-08-01'}
];

// Suma de aportes por miembro (el que paga en 2 veces queda saldado)
assert.strictEqual(cobroPaidBy('cena','a'), 25000);
assert.strictEqual(cobroPaidBy('cena','b'),  5000);
assert.strictEqual(cobroPaidBy('cena','z'),      0);

// Estados
assert.strictEqual(cobroStatus(cobros[0],'a'), 'paid');
assert.strictEqual(cobroStatus(cobros[0],'b'), 'partial');
assert.strictEqual(cobroStatus(cobros[0],'z'), 'pending');
// Sin monto esperado (colecta libre): cualquier aporte cuenta como pagado
assert.strictEqual(cobroStatus(cobros[1],'b'), 'paid');

// Total recaudado por cobro
assert.strictEqual(cobroTotal('cena'), 30000);
assert.strictEqual(cobroTotal('rifa'),  3000);

// Los dados de baja no participan del objetivo
assert.strictEqual(cobroMembers().length, 2);

// Reservado = sólo lo de cobros ABIERTOS. La rifa está cerrada → no reserva nada.
assert.strictEqual(reservadoEventos(), 30000);

// Al cerrar la cena, esa plata deja de estar reservada (queda disponible para el consejo)
cobros[0].cerrado = true;
assert.strictEqual(reservadoEventos(), 0);

console.log('✅ test-cobros: OK');
