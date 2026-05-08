/**
 * geoUtils.ts
 * Utilidades de geolocalización para compatibilidad con el sistema legado GES 4.
 *
 * Las abreviaturas siguen la nomenclatura utilizada por GES 4 / SEPOMEX:
 *  - Ciudad de México conserva la clave histórica "DF" (Distrito Federal)
 *  - El resto sigue las claves INEGI de 2 o 3 letras que GES 4 utilizaba
 */

// ── Mapeo nombre largo → abreviatura GES 4 ────────────────────────────────────

export const STATE_MAPPING: Record<string, string> = {
  // Nombre normalizado (como lo retorna zippopotam.us) → abreviatura GES 4
  'Aguascalientes':              'AGS',
  'Baja California':             'BC',
  'Baja California Sur':         'BCS',
  'Campeche':                    'CAM',
  'Chiapas':                     'CHIS',
  'Chihuahua':                   'CHIH',
  'Ciudad de México':            'DF',
  'Coahuila':                    'COAH',
  'Coahuila de Zaragoza':        'COAH',
  'Colima':                      'COL',
  'Durango':                     'DGO',
  'Estado de México':            'MEX',
  'Guanajuato':                  'GTO',
  'Guerrero':                    'GRO',
  'Hidalgo':                     'HGO',
  'Jalisco':                     'JAL',
  'Michoacán':                   'MICH',
  'Michoacán de Ocampo':         'MICH',
  'Morelos':                     'MOR',
  'Nayarit':                     'NAY',
  'Nuevo León':                  'NL',
  'Oaxaca':                      'OAX',
  'Puebla':                      'PUE',
  'Querétaro':                   'QRO',
  'Querétaro de Arteaga':        'QRO',
  'Quintana Roo':                'QROO',
  'San Luis Potosí':             'SLP',
  'Sinaloa':                     'SIN',
  'Sonora':                      'SON',
  'Tabasco':                     'TAB',
  'Tamaulipas':                  'TAMPS',
  'Tlaxcala':                    'TLAX',
  'Veracruz':                    'VER',
  'Veracruz de Ignacio de la Llave': 'VER',
  'Yucatán':                     'YUC',
  'Zacatecas':                   'ZAC',

  // Variantes que puede regresar la API (con/sin acentos, minúsculas, etc.)
  'Mexico City':                 'DF',
  'Mexico':                      'MEX',   // fallback genérico si viene inglés
  'Distrito Federal':            'DF',
};

// ── Lookup robusto ────────────────────────────────────────────────────────────

/**
 * Convierte el nombre de un estado (en cualquier capitalización) a su
 * abreviatura GES 4.  Retorna la abreviatura si la encuentra o null si no.
 *
 * @param nombre  Nombre del estado tal como llega de la API o del sistema legado
 * @returns       Abreviatura GES 4 (ej. 'DF', 'MEX') o null
 */
export function getStateAbbr(nombre: string | null | undefined): string | null {
  if (!nombre) return null;

  // Intento 1: match exacto
  if (STATE_MAPPING[nombre]) return STATE_MAPPING[nombre];

  // Intento 2: match normalizado (sin acentos, trim, title-case)
  const normalizado = nombre.trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar diacríticos
    .toLowerCase();

  for (const [key, val] of Object.entries(STATE_MAPPING)) {
    const keyNorm = key
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (keyNorm === normalizado) return val;
  }

  // Intento 3: si ya viene una abreviatura válida (ej. datos legados)
  const upper = nombre.trim().toUpperCase();
  const values = Object.values(STATE_MAPPING);
  if (values.includes(upper)) return upper;

  return null;
}

/**
 * Dado un código postal mexicano de 5 dígitos, consulta la API de Zippopotam
 * y retorna el primer lugar encontrado con municipio y estado (nombre completo).
 *
 * @param cp  Código postal de 5 dígitos
 * @returns   { municipio, estadoNombre, estadoAbrev } o null si falla
 */
export async function lookupCP(cp: string): Promise<{
  municipio:    string;
  estadoNombre: string;
  estadoAbrev:  string | null;
} | null> {
  if (!/^\d{5}$/.test(cp)) return null;

  try {
    const res = await fetch(`https://api.zippopotam.us/mx/${cp}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json() as {
      country:      string;
      'post code':  string;
      places: Array<{
        'place name':     string;
        state:            string;
        'state abbreviation': string;
      }>;
    };

    if (!data.places?.length) return null;

    const place = data.places[0];
    const estadoNombre = place.state ?? '';
    const estadoAbrev  = getStateAbbr(estadoNombre);

    return {
      municipio:    place['place name'] ?? '',
      estadoNombre,
      estadoAbrev,
    };
  } catch {
    return null;
  }
}

// ── Lista canónica de estados (para selectores UI) ────────────────────────────

/**
 * Lista de estados mexicanos ordenada alfabéticamente, sin alias duplicados.
 * Usar para poblar dropdowns de "Estado de Nacimiento", etc.
 */
export const ESTADOS_LIST: { abbr: string; nombre: string }[] = [
  { abbr: 'AGS',   nombre: 'Aguascalientes'        },
  { abbr: 'BC',    nombre: 'Baja California'        },
  { abbr: 'BCS',   nombre: 'Baja California Sur'    },
  { abbr: 'CAM',   nombre: 'Campeche'               },
  { abbr: 'CHIS',  nombre: 'Chiapas'                },
  { abbr: 'CHIH',  nombre: 'Chihuahua'              },
  { abbr: 'DF',    nombre: 'Ciudad de México'        },
  { abbr: 'COAH',  nombre: 'Coahuila'               },
  { abbr: 'COL',   nombre: 'Colima'                 },
  { abbr: 'DGO',   nombre: 'Durango'                },
  { abbr: 'GTO',   nombre: 'Guanajuato'             },
  { abbr: 'GRO',   nombre: 'Guerrero'               },
  { abbr: 'HGO',   nombre: 'Hidalgo'                },
  { abbr: 'JAL',   nombre: 'Jalisco'                },
  { abbr: 'MEX',   nombre: 'Estado de México'       },
  { abbr: 'MICH',  nombre: 'Michoacán'              },
  { abbr: 'MOR',   nombre: 'Morelos'                },
  { abbr: 'NAY',   nombre: 'Nayarit'                },
  { abbr: 'NL',    nombre: 'Nuevo León'             },
  { abbr: 'OAX',   nombre: 'Oaxaca'                 },
  { abbr: 'PUE',   nombre: 'Puebla'                 },
  { abbr: 'QRO',   nombre: 'Querétaro'              },
  { abbr: 'QROO',  nombre: 'Quintana Roo'           },
  { abbr: 'SLP',   nombre: 'San Luis Potosí'        },
  { abbr: 'SIN',   nombre: 'Sinaloa'                },
  { abbr: 'SON',   nombre: 'Sonora'                 },
  { abbr: 'TAB',   nombre: 'Tabasco'                },
  { abbr: 'TAMPS', nombre: 'Tamaulipas'             },
  { abbr: 'TLAX',  nombre: 'Tlaxcala'               },
  { abbr: 'VER',   nombre: 'Veracruz'               },
  { abbr: 'YUC',   nombre: 'Yucatán'                },
  { abbr: 'ZAC',   nombre: 'Zacatecas'              },
];
