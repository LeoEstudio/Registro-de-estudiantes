let db = null, estudiantes = [], materias = [], notas = [];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function aviso(texto, error = false) {
  const m = $('msg');
  m.textContent = texto;
  m.className = error ? 'err' : '';
}

// Pestañas
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.setAttribute('aria-selected', x === b));
  ['est','mat','not'].forEach(id => $(id).hidden = id !== b.dataset.tab);
});

// Conexión
function conectar(url, key) {
  db = supabase.createClient(url, key);
  localStorage.setItem('sb', JSON.stringify({ url, key }));
  $('cfg').open = false;
  cargar();
}
$('conectar').onclick = () => {
  const url = $('url').value.trim(), key = $('key').value.trim();
  if (!url || !key) return aviso('Escribe la URL y la clave anon del proyecto.', true);
  conectar(url, key);
};
try {
  const g = JSON.parse(localStorage.getItem('sb') || 'null');
  if (g) { $('url').value = g.url; $('key').value = g.key; conectar(g.url, g.key); }
  else { $('cfg').open = true; aviso('Pega los datos de tu proyecto Supabase para empezar.'); }
} catch { $('cfg').open = true; }

// Cargar datos
async function cargar() {
  const [e, m, n] = await Promise.all([
    db.from('estudiantes').select('*').order('nombre'),
    db.from('materias').select('*').order('nombre'),
    db.from('notas').select('*')
  ]);
  const fallo = e.error || m.error || n.error;
  if (fallo) return aviso('No se pudo cargar: ' + fallo.message, true);
  estudiantes = e.data; materias = m.data; notas = n.data;
  aviso('');
  pintar();
}

// Mostrar tablas
function pintar() {
  const vacio = (cols, t) => `<tr><td colspan="${cols}" class="vacio">${t}</td></tr>`;
  const prom = id => {
    const v = notas.filter(n => n.estudiante_id === id);
    return v.length ? (v.reduce((a, n) => a + Number(n.nota), 0) / v.length).toFixed(1) : '-';
  };

  $('e-list').innerHTML = estudiantes.length ? estudiantes.map(x =>
    `<tr><td>${esc(x.codigo)}</td><td>${esc(x.nombre)}</td><td>${esc(x.correo)}</td><td>${prom(x.id)}</td>
     <td><button class="sec" onclick="borrar('estudiantes','${x.id}')">Eliminar</button></td></tr>`).join('')
    : vacio(5, 'Aún no hay estudiantes. Agrega el primero arriba.');

  $('m-list').innerHTML = materias.length ? materias.map(x =>
    `<tr><td>${esc(x.nombre)}</td><td><button class="sec" onclick="borrar('materias','${x.id}')">Eliminar</button></td></tr>`).join('')
    : vacio(2, 'Aún no hay materias. Agrega la primera arriba.');

  $('n-est').innerHTML = estudiantes.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
  $('n-mat').innerHTML = materias.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('');

  const nom = (lista, id) => esc((lista.find(x => x.id === id) || {}).nombre);
  $('n-list').innerHTML = notas.length ? notas.map(x =>
    `<tr><td>${nom(estudiantes, x.estudiante_id)}</td><td>${nom(materias, x.materia_id)}</td><td>${Number(x.nota).toFixed(1)}</td>
     <td><button class="sec" onclick="borrar('notas','${x.id}')">Eliminar</button></td></tr>`).join('')
    : vacio(4, 'Aún no hay notas registradas.');
}

// Guardar y eliminar
async function insertar(tabla, fila, opciones) {
  const { error } = await db.from(tabla).upsert(fila, opciones);
  if (error) return aviso('No se pudo guardar: ' + error.message, true);
  cargar();
  return true;
}
async function borrar(tabla, id) {
  if (!confirm('¿Eliminar este registro?')) return;
  const { error } = await db.from(tabla).delete().eq('id', id);
  if (error) return aviso('No se pudo eliminar: ' + error.message, true);
  cargar();
}

// Botones de guardar
$('e-add').onclick = async () => {
  const codigo = $('e-cod').value.trim(), nombre = $('e-nom').value.trim(), correo = $('e-cor').value.trim() || null;
  if (!codigo || !nombre) return aviso('El código y el nombre son obligatorios.', true);
  if (await insertar('estudiantes', { codigo, nombre, correo }, { onConflict: 'codigo' }))
    ['e-cod','e-nom','e-cor'].forEach(i => $(i).value = '');
};
$('m-add').onclick = async () => {
  const nombre = $('m-nom').value.trim();
  if (!nombre) return aviso('Escribe el nombre de la materia.', true);
  if (await insertar('materias', { nombre }, { onConflict: 'nombre' })) $('m-nom').value = '';
};
$('n-add').onclick = async () => {
  const nota = parseFloat($('n-val').value);
  if (!$('n-est').value || !$('n-mat').value) return aviso('Primero crea al menos un estudiante y una materia.', true);
  if (isNaN(nota) || nota < 0 || nota > 5) return aviso('La nota debe estar entre 0.0 y 5.0.', true);
  if (await insertar('notas', { estudiante_id: $('n-est').value, materia_id: $('n-mat').value, nota }, { onConflict: 'estudiante_id,materia_id' }))
    $('n-val').value = '';
};