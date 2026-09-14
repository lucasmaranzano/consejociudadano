// Smoke test de la lógica de plata.  Correr con:  node test-cobros.js
// No copia el código: lo extrae de index.html, así el test no se desactualiza.
var fs = require('fs'), assert = require('assert');

var src = fs.readFileSync(__dirname + '/index.html', 'utf8');

function extraer(desde, hasta){
  var a = src.indexOf(desde), b = src.indexOf(hasta);
  assert.ok(a > 0 && b > a, 'no encontré el bloque ' + desde + ' en index.html');
  return src.slice(a, b);
}

var cobros, cobroPagos, members, expenses, cuotas;
function isCurrentlyInactive(m){ return !!m.baja; }   // stub
eval(extraer('function cobroPaidBy', '// ── Navegación ──'));
eval(extraer('function cuotaDe', '// Cuota de hoy'));

// ═══ Escenario: cena a $25.000 por cabeza, 3 miembros (uno dado de baja) ═══
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
expenses = [
  {id:'g1', concept:'Alquiler', amount:80000, date:'2026-09-03', cobroId:''}   // gasto normal
];

// ── Aportes ──
assert.strictEqual(cobroPaidBy('cena','a'), 25000);   // dos pagos parciales suman
assert.strictEqual(cobroPaidBy('cena','b'),  5000);
assert.strictEqual(cobroPaidBy('cena','z'),      0);
assert.strictEqual(cobroTotal('cena'), 30000);
assert.strictEqual(cobroTotal('rifa'),  3000);

// ── Estados ──
assert.strictEqual(cobroStatus(cobros[0],'a'), 'paid');
assert.strictEqual(cobroStatus(cobros[0],'b'), 'partial');
assert.strictEqual(cobroStatus(cobros[0],'z'), 'pending');
assert.strictEqual(cobroStatus(cobros[1],'b'), 'paid');  // sin monto esperado, cualquier aporte cuenta
assert.strictEqual(cobroMembers().length, 2);            // los de baja no participan

// ── Reservado ──
// Un gasto sin evento no descuenta nada del reservado.
assert.strictEqual(gastadoEnCobro('cena'), 0);
assert.strictEqual(reservadoEventos(), 30000);           // la rifa está cerrada, no reserva

// Pago una seña del salón e imputo el gasto a la cena.
expenses.push({id:'g2', concept:'Seña salón', amount:18000, date:'2026-10-10', cobroId:'cena'});
assert.strictEqual(gastadoEnCobro('cena'), 18000);
assert.strictEqual(reservadoEventos(), 12000);           // 30.000 juntados - 18.000 ya pagados

// Si se gasta más de lo juntado, el reservado toca fondo en 0 (no queda negativo:
// la diferencia la puso la caja del consejo, y eso ya está reflejado como egreso).
expenses.push({id:'g3', concept:'Catering', amount:50000, date:'2026-11-01', cobroId:'cena'});
assert.strictEqual(gastadoEnCobro('cena'), 68000);
assert.strictEqual(reservadoEventos(), 0);

// Cerrar el evento libera lo que quedara reservado.
expenses.pop(); expenses.pop();
assert.strictEqual(reservadoEventos(), 30000);
cobros[0].cerrado = true;
assert.strictEqual(reservadoEventos(), 0);

// ═══ Cuota vigente por mes ═══
cuotas = [
  {desde:'2026-03', monto:10000},
  {desde:'2026-07', monto:15000},
  {desde:'2027-01', monto:22000}
];
assert.strictEqual(cuotaDe('2026-03'), 10000);  // el mes exacto en que empieza a regir
assert.strictEqual(cuotaDe('2026-06'), 10000);  // último mes de la vieja
assert.strictEqual(cuotaDe('2026-07'), 15000);  // primer mes de la nueva
assert.strictEqual(cuotaDe('2026-12'), 15000);
assert.strictEqual(cuotaDe('2027-05'), 22000);  // más allá de la última fila, rige la última
assert.strictEqual(cuotaDe('2026-01'), 0);      // antes de la primera, no hay cuota definida

cuotas = [];
assert.strictEqual(cuotaDe('2026-09'), 0);      // sin filas no revienta

console.log('✅ test-cobros: OK');
