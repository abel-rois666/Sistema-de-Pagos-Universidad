import type { Valor911, Regla911, Instancia911 } from './types';
import { valorRespuesta } from './types';
import { instanciaAplica911 } from './guia';

// Analizador cerrado: no eval, Function, SQL dinámico ni llamadas a código importado.
type Valor = number | string | boolean | null;
export function evaluar911(expresion: string, valores: Record<string, Valor911>): Valor {
  const matches = [...expresion.matchAll(/\d+(?:\.\d+)?|[A-Z_][A-Z_0-9]*|'[^']*'|"[^"]*"|<=|>=|<>|!=|[=<>+*/()\-]/gi)];
  let last = 0;
  for (const m of matches) {
    if (expresion.slice(last, m.index).trim()) throw new Error('Sintaxis no homologada');
    last = m.index! + m[0].length;
  }
  const tokens = matches.map(m => m[0]);
  if (expresion.slice(last).trim() || tokens.length > 3000) throw new Error('Sintaxis no homologada');
  let at = 0;
  const peek = () => tokens[at]?.toUpperCase();
  const take = () => tokens[at++];
  const numeric = (v: Valor) => {
    if (v === null) return null;
    if (v === '' || typeof v === 'boolean' || !Number.isFinite(Number(v))) throw new Error('Operando no numérico');
    return Number(v);
  };
  function atom(): Valor {
    const t = take();
    if (!t) throw new Error('Expresión incompleta');
    if (t === '(') {
      const v = or();
      if (take() !== ')') throw new Error('Paréntesis incompletos');
      return v;
    }
    if (t === '-') {
      const v = numeric(atom());
      return v === null ? null : -v;
    }
    if (/^\d/.test(t)) return Number(t);
    if (/^['"]/.test(t)) return t.slice(1, -1);
    if (t.toUpperCase() === 'LEN') {
      if (take() !== '(') throw new Error('LEN requiere paréntesis');
      const v = or();
      if (take() !== ')') throw new Error('LEN incompleto');
      return v === null ? null : String(v).length;
    }
    if (!/^(?:[VE]\d+|CV_[A-Z_0-9]+|DURACION|OFICIALIZADO)$/.test(t.toUpperCase())) throw new Error(`Referencia no permitida: ${t}`);
    return valores[t.toUpperCase()] ?? null;
  }
  function product(): Valor {
    let v = atom();
    while (peek() === '*' || peek() === '/') {
      const op = take(),
        b = numeric(atom()),
        a = numeric(v);
      if (op === '/' && b === 0) throw new Error('División entre cero');
      v = a === null || b === null ? null : op === '*' ? a * b : a / b;
    }
    return v;
  }
  function sum(): Valor {
    let v = product();
    while (peek() === '+' || peek() === '-') {
      const op = take(),
        b = numeric(product()),
        a = numeric(v);
      v = a === null || b === null ? null : op === '+' ? a + b : a - b;
    }
    return v;
  }
  function compare(): Valor {
    const a = sum(),
      op = peek();
    if (!['=', '<>', '!=', '>', '<', '>=', '<='].includes(op)) return a;
    take();
    const b = sum();
    if (a === null || b === null) return null;
    return op === '=' ? a == b : op === '<>' || op === '!=' ? a != b : op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : a <= b;
  }
  function and(): Valor {
    let v = compare();
    while (peek() === 'AND') {
      take();
      const b = compare();
      v = v === false || b === false ? false : v === null || b === null ? null : Boolean(v && b);
    }
    return v;
  }
  function or(): Valor {
    let v = and();
    while (peek() === 'OR') {
      take();
      const b = and();
      v = v === true || b === true ? true : v === null || b === null ? null : Boolean(v || b);
    }
    return v;
  }
  const result = or();
  if (at !== tokens.length) throw new Error('Tokens restantes no homologados');
  if (typeof result === 'number' && !Number.isFinite(result)) throw new Error('Resultado fuera de rango');
  return result;
}
export function aplicarReglas911(instancia: Instancia911, reglas: Regla911[]) {
  const salida = structuredClone(instancia);
  const incidencias: string[] = [];
  const propias = reglas.filter(r => r.cuestionario === instancia.cuestionario);
  const valores = () => Object.fromEntries([...Object.entries(salida.identidad), ...Object.entries(salida.respuestas).map(([k, r]) => [k, valorRespuesta(r)])]);
  // Pasadas acotadas resuelven totales dependientes sin convertir faltantes en cero.
  for (let paso = 0; paso < 12; paso++) {
    let cambio = false;
    for (const r of propias.filter(x => x.tipo === 'OPERACION')) {
      const m = r.expresion.match(/^\s*([VE]\d+)\s*=([^=]+)$/);
      if (!m) continue;
      if (new RegExp(`\\b${m[1]}\\b`).test(m[2])) {
        incidencias.push(`R${r.linea}: operación autorreferente pendiente de homologación`);
        continue;
      }
      try {
        const v = evaluar911(m[2], valores());
        if (typeof v !== 'number' && typeof v !== 'string' && v !== null) continue;
        if (JSON.stringify(salida.respuestas[m[1]]?.calculado) !== JSON.stringify(v)) {
          salida.respuestas[m[1]] = {
            calculado: v as Valor911,
            origen: `Regla oficial, línea ${r.linea}`
          };
          cambio = true;
        }
      } catch {/* Se registra en el diagnóstico, nunca se ejecuta por otro mecanismo. */}
    }
    if (!cambio) break;
  }
  for (const r of propias) {
    try {
      const v = evaluar911(r.expresion, valores());
      if (v === false) incidencias.push(`R${r.linea} ${r.variable}: ${r.mensaje || r.expresion}`);else if (v === null) incidencias.push(`R${r.linea} ${r.variable}: referencias pendientes para verificar la regla`);
    } catch (e) {
      incidencias.push(`R${r.linea}: pendiente de homologación: ${(e as Error).message}`);
    }
  }
  return {
    instancia: salida,
    incidencias: [...new Set(incidencias)]
  };
}
export function pendientesReglas911(exp: import('./types').Expediente911, reglas: Regla911[]) {
  return exp.instancias.filter(instanciaAplica911).flatMap(i => aplicarReglas911(i, reglas).incidencias.map(mensaje => ({
    clave: `${i.id}:${mensaje.match(/^R\d+/)?.[0] || 'SIN_CLAVE'}`,
    instancia: i.id,
    mensaje
  }))).filter((r, n, a) => a.findIndex(x => x.clave === r.clave) === n);
}
export function excepcionAcreditada911(e?: {
  justificacion: string;
  evidencia: string;
}) {
  return Boolean(e && e.justificacion.trim().length >= 20 && e.evidencia.trim().length >= 5);
}
