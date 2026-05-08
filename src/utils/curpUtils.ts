/**
 * curpUtils.ts — Utilidades para el cálculo y verificación de la CURP mexicana.
 * Compartido entre TabDatosGenerales y el modal de creación de AlumnosConfig.
 */

/** Tabla de clave CURP para cada estado GES4 → 2 letras RENAPO */
export const ESTADO_CURP: Record<string, string> = {
  'AGS':'AS','BC':'BC','BCS':'BS','CAM':'CC','CHIS':'CS','CHIH':'CH','DF':'DF','CDMX':'DF',
  'COAH':'CL','COL':'CM','DGO':'DG','GTO':'GT','GRO':'GR','HGO':'HG','JAL':'JC','MEX':'MC',
  'MICH':'MN','MOR':'MS','NAY':'NT','NL':'NL','OAX':'OC','PUE':'PL','QRO':'QT','QROO':'QR',
  'SLP':'SP','SIN':'SL','SON':'SR','TAB':'TC','TAMPS':'TS','TLAX':'TL','VER':'VZ','YUC':'YN',
  'ZAC':'ZS','NE':'NE',
};

const INCONVENIENTES = [
  'BACA','BAKA','BUEI','BUEY','CACA','CACO','CAGA','CAGO','CAKA',
  'CAKO','COGE','COGI','COJA','COJE','COJI','COJO','COLA','CULO','FALO','FETO',
  'GETA','GUEI','GUEY','JETA','JOTO','KACA','KACO','KAGA','KAGO','KAKA','KAKO',
  'KOGE','KOGI','KOJA','KOJE','KOJI','KOJO','KOLA','KULO','LELO','LOCA','LOCO',
  'LOKA','LOKO','MAME','MAMO','MEAR','MEAS','MEON','MIAR','MION','MOCO','MOKO',
  'MULA','MULO','NACA','NACO','PEDA','PEDO','PENE','PIPI','PITO','POPO','PUTA',
  'PUTO','QULO','RATA','ROBA','ROBE','ROBO','RUIN','SENO','TETA','VACA','VAGA',
  'VAGO','VAKA','VUEI','VUEY','WUEI','WUEY',
];

/**
 * Calcula los primeros 16 dígitos de la CURP según normas RENAPO.
 * Retorna null si faltan datos.
 */
export function calcularCURP(params: {
  apellido_paterno: string;
  apellido_materno: string;
  nombres: string;
  fecha_nacimiento: string;  // YYYY-MM-DD
  sexo: string;              // 'H' | 'M'
  estado_nacimiento: string; // nombre largo o abreviatura GES4
  estadoAbrev: (nombre: string) => string | null;
}): string | null {
  const { apellido_paterno, apellido_materno, nombres, fecha_nacimiento, sexo, estado_nacimiento, estadoAbrev } = params;
  if (!apellido_paterno || !nombres || !fecha_nacimiento || !sexo || !estado_nacimiento) return null;

  const strip = (s: string) =>
    s.toUpperCase()
      .replace(/Ñ/g, 'X')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, ' ')
      .trim();

  const VOCALES = /[AEIOU]/;
  const CONSONANTES = /[^AEIOU\s]/;

  const ap1 = strip(apellido_paterno).split(' ').filter(Boolean);
  const ap1Str = ap1[0] ?? '';
  const primerVocalInterna = ap1Str.slice(1).split('').find(c => VOCALES.test(c)) ?? 'X';
  const primerConsonante   = ap1Str.slice(1).split('').find(c => CONSONANTES.test(c)) ?? 'X';

  const c1 = ap1Str[0] ?? 'X';
  const c2 = primerVocalInterna;

  const ap2    = strip(apellido_materno || 'X').split(' ').filter(Boolean);
  const ap2Str = ap2[0] ?? 'X';
  const c3     = ap2Str[0] ?? 'X';

  const nombresArr = strip(nombres).split(' ').filter(Boolean);
  const SKIP = ['MARIA','MA','MA.','JOSE','J','J.','DE','DEL','DE LA','LAS','LOS'];
  const nombreUso = (nombresArr.length > 1 && SKIP.includes(nombresArr[0])) ? nombresArr[1] : nombresArr[0];
  const c4 = nombreUso?.[0] ?? 'X';

  const [y, m, d] = fecha_nacimiento.split('-');
  const fecha6  = `${y.slice(2)}${m}${d}`;
  const c_sexo  = sexo === 'H' ? 'H' : 'M';

  const abrev      = estadoAbrev(estado_nacimiento)?.toUpperCase() ?? estado_nacimiento.toUpperCase();
  const claveEstado = ESTADO_CURP[abrev] ?? ESTADO_CURP[estado_nacimiento.toUpperCase()] ?? 'XX';

  const consAp1 = primerConsonante;
  const consAp2 = ap2Str.slice(1).split('').find(c => CONSONANTES.test(c)) ?? 'X';
  const consNom = (nombreUso ?? 'X').slice(1).split('').find(c => CONSONANTES.test(c)) ?? 'X';

  let cuatro = `${c1}${c2}${c3}${c4}`;
  if (INCONVENIENTES.includes(cuatro)) cuatro = `${cuatro[0]}X${cuatro[2]}${cuatro[3]}`;

  return `${cuatro}${fecha6}${c_sexo}${claveEstado}${consAp1}${consAp2}${consNom}`;
}

/**
 * Calcula el dígito verificador (posición 18) de una CURP de 17 caracteres.
 * Algoritmo oficial DOF 2006.
 */
export function calcularDigitoVerificador(curp17: string): string {
  if (curp17.length !== 17) return '0';

  const TABLA: Record<string, number> = {
    '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
    'A':10,'B':11,'C':12,'D':13,'E':14,'F':15,'G':16,'H':17,'I':18,
    'J':19,'K':20,'L':21,'M':22,'N':23,'Ñ':24,'O':25,'P':26,'Q':27,
    'R':28,'S':29,'T':30,'U':31,'V':32,'W':33,'X':34,'Y':35,'Z':36,
  };

  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const val = TABLA[curp17[i].toUpperCase()] ?? 0;
    suma += val * (18 - i);
  }
  const residuo = suma % 10;
  return residuo === 0 ? '0' : String(10 - residuo);
}

/**
 * Infiere el carácter diferenciador de la posición 17 de la CURP según el siglo de nacimiento.
 * Nacidos antes del 2000 → '0'; nacidos desde el 2000 → 'A'.
 */
export function inferirDigito17(fechaNacimiento: string): string {
  const year = parseInt(fechaNacimiento?.slice(0, 4) ?? '0', 10);
  return year >= 2000 ? 'A' : '0';
}

/** Calcula la CURP completa (18 chars) incluyendo dígito 17 inferido y dígito verificador. */
export function calcularCURPCompleta(params: Parameters<typeof calcularCURP>[0]): string | null {
  const base16 = calcularCURP(params);
  if (!base16) return null;
  const dig17 = inferirDigito17(params.fecha_nacimiento);
  const curp17 = base16 + dig17;
  const dig18 = calcularDigitoVerificador(curp17);
  return (curp17 + dig18).toUpperCase();
}

/** Formatea 10 dígitos de teléfono → XX XXXX XXXX */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2)  return d;
  if (d.length <= 6)  return `${d.slice(0,2)} ${d.slice(2)}`;
  return `${d.slice(0,2)} ${d.slice(2,6)} ${d.slice(6)}`;
}
