import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { Buffer } from 'buffer';

// Vite does not polyfill Buffer, which is required by @react-pdf/renderer
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

// Register font using TTF (WOFF2 is not fully supported by fontkit in the browser)
Font.register({
  family: 'Poppins',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-500-normal.ttf', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-600-normal.ttf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-700-normal.ttf', fontWeight: 700 }
  ]
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Poppins',
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#ffffff'
  },
  boletaContainer: {
    padding: 10,
    paddingHorizontal: 20,
    height: '49%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  
  // --- Encabezado ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoBox: { width: 75, height: 75, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  logoImage: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  instDetails: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: 700, color: '#000000' }, 
  subtitle: { fontSize: 11, marginTop: 3, fontWeight: 500, color: '#000000' },
  
  // --- Separadores y Contenedores ---
  thickLine: {
    backgroundColor: '#000',
    height: 3, 
    marginTop: 4,
    marginBottom: 6,
  },
  studentInfoBox: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 4,
    padding: 4,
    marginBottom: 6,
  },
  studentInfoCol: {
    flex: 1,
    flexDirection: 'column',
    gap: 2, 
  },
  infoText: { fontSize: 8, fontFamily: 'Poppins' },
  bold: { fontWeight: 700 },
  
  // --- Tabla de Calificaciones ---
  table: {
    width: '100%',
    borderTopWidth: 2,
    borderLeftWidth: 1,
    borderColor: '#000',
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 11
  },
  tableTitleCell: {
    width: '100%',
    padding: 3,
    fontSize: 9,
    fontWeight: 700,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  tableHeader: {
    fontWeight: 700
  },
  tableHeaderCell: {
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#000',
  },
  tableHeaderCellFirst: {
    borderLeftWidth: 2,
  },
  tableCell: {
    padding: 2,
    fontSize: 6.5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    textAlign: 'center'
  },
  tableCellLeft: {
    padding: 2,
    fontSize: 6.5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    textAlign: 'left'
  },
  tableCellLast: {
    padding: 2,
    fontSize: 6.5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    textAlign: 'center'
  },
  
  // --- Notas y Footer ---
  englishNote: { fontSize: 6.5, textAlign: 'left', marginBottom: 8 },
  
  footerArea: {
    width: '100%',
    position: 'relative',
  },
  averageText: {
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'left',
    marginBottom: 6,
  },
  
  // --- Firma (Centrada en la hoja) ---
  signatureSection: {
    alignSelf: 'center', 
    alignItems: 'center',
    width: 160,
    marginTop: 0,
    position: 'relative',
  },
  signatureLabel: { fontSize: 8 },
  signatureLine: {
    width: '100%',
    borderTopWidth: 1,
    borderColor: '#000',
    marginTop: 20, 
    marginBottom: 4,
  },
  signatureName: { fontSize: 7, fontWeight: 700, marginBottom: 3 },
  signatureTitle: { fontSize: 7, fontWeight: 700 },
  firmaImage: {
    position: 'absolute',
    bottom: 15,
    width: 80,
    height: 40,
    objectFit: 'contain'
  },
  
  // --- Notas inferiores y Sello ---
  footerNotesSection: {
    marginTop: 2, 
    alignItems: 'flex-start',
  },
  footerNoteText: { fontSize: 6.5, fontWeight: 700, marginBottom: 1 },
  
  stampBox: {
    position: 'absolute',
    right: 5, 
    bottom: -7,  
    width: 155,
    height: 155,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1
  },
  stampImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    opacity: 0.85
  },
  
  // --- Dirección y Corte ---
  footerDivider: {
    borderTopWidth: 1,
    borderColor: '#000',
    width: '100%',
    marginTop: 3,
    marginBottom: 4,
  },
  cutLine: {
    borderTopWidth: 1,
    borderTopStyle: 'dashed',
    borderTopColor: '#ccc', 
    width: '100%'
  },
  addressLine: {
    fontSize: 6.5,
    textAlign: 'center',
    color: '#333',
    marginTop: 6
  }
});

export interface BoletaPDFProps {
  alumno: any;
  materias: any[];
  ciclo: any;
  config: any;
  firmante: any;
  opciones: {
    copias: number;
    incluirSello: boolean;
    incluirFirma: boolean;
  };
  base64Logo: string;
  base64Sello: string;
  base64Firma: string;
  promedio: string;
  promedioLetra: string;
  tipoPeriodoLargo: string;
  periodoTexto: string;
  firmanteNombre: string;
  cargoFirmante: string;
}

const toTitleCase = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const BoletaContent = ({ props }: { props: BoletaPDFProps }) => (
<View style={styles.boletaContainer}> 
  <View>
    {/* ENCABEZADO */}
    <View style={styles.header}>
      <View style={styles.logoBox}>
        {props.base64Logo ? (
          <Image src={props.base64Logo} style={styles.logoImage} />
        ) : (
          <Text style={{ fontSize: 8 }}>Escudo CUOM</Text>
        )}
      </View>
      <View style={styles.instDetails}>
        <Text style={styles.title}>CENTRO UNIVERSITARIO ORIENTE DE MÉXICO</Text>
        <Text style={styles.subtitle}>BOLETA {props.tipoPeriodoLargo}</Text>
      </View>
    </View>
    
    {/* LÍNEA GRUESA SEPARADORA */}
    <View style={styles.thickLine}/>
    
    {/* DATOS DEL ALUMNO (Caja con borde grueso) */}
    <View style={styles.studentInfoBox}>
      <View style={styles.studentInfoCol}>
        <Text style={styles.infoText}><Text style={styles.bold}>Nombre:</Text> {toTitleCase(props.alumno.nombres)} {toTitleCase(props.alumno.apellido_paterno)} {toTitleCase(props.alumno.apellido_materno || '')}</Text>
        <Text style={styles.infoText}><Text style={styles.bold}>Licenciatura:</Text> {toTitleCase(props.alumno.licenciatura || '')}</Text>
        <Text style={styles.infoText}><Text style={styles.bold}>Grupo:</Text> {props.alumno.grupo || 'S/A'}</Text>
      </View>
      <View style={styles.studentInfoCol}>
        <Text style={styles.infoText}><Text style={styles.bold}>Matrícula:</Text> {props.alumno.matricula || ''}</Text>
        <Text style={styles.infoText}><Text style={styles.bold}>RVOE:</Text> {props.alumno.rvoe || ''}</Text>
        <Text style={styles.infoText}><Text style={styles.bold}>Fecha de Expedición:</Text> {new Date().toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric'})}</Text>
      </View>
    </View>
    
    {/* TABLA DE CALIFICACIONES (Equivalente a border-collapse: collapse) */}
    <View style={styles.table}>
      {/* TÍTULO DEL PERIODO INTEGRADO EN LA TABLA */}
      <View style={styles.tableRow}>
        <Text style={styles.tableTitleCell}>{props.periodoTexto}</Text>
      </View>
      
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.tableCell, styles.tableHeaderCell, styles.tableHeaderCellFirst, { width: '12%' }]}>Clave</Text>
        <Text style={[styles.tableCellLeft, styles.tableHeaderCell, { width: '43%' }]}>Asignatura</Text>
        <Text style={[styles.tableCell, styles.tableHeaderCell, { width: '15%' }]}>Ciclo</Text>
        <Text style={[styles.tableCell, styles.tableHeaderCell, { width: '15%' }]}>Calificación Final</Text>
        <Text style={[styles.tableCell, styles.tableHeaderCell, { width: '15%' }]}>Calificación (Letra)</Text>
      </View>
      
      {props.materias.map((m: any, i: number) => (
        <View style={styles.tableRow} key={i}>
          <Text style={[styles.tableCell, { width: '12%' }]}>{m.clave}</Text>
          <Text style={[styles.tableCellLeft, { width: '43%' }]}>{m.nombre}</Text>
          <Text style={[styles.tableCell, { width: '15%' }]}>{props.ciclo.nombre}</Text>
          <Text style={[styles.tableCell, { width: '15%' }]}>{m.calif}</Text>
          <Text style={[styles.tableCellLast, { width: '15%' }]}>{m.letra}</Text>
        </View>
      ))}
      
      {Array.from({ length: Math.max(0, 5 - props.materias.length) }).map((_, i) => (
        <View style={styles.tableRow} key={`empty-${i}`}>
          <Text style={[styles.tableCell, { width: '12%' }]}> </Text>
          <Text style={[styles.tableCellLeft, { width: '43%' }]}> </Text>
          <Text style={[styles.tableCell, { width: '15%' }]}> </Text>
          <Text style={[styles.tableCell, { width: '15%' }]}> </Text>
          <Text style={[styles.tableCellLast, { width: '15%' }]}> </Text>
        </View>
      ))}
    </View>
    
    {/* NOTA DE INGLÉS */}
    <Text style={styles.englishNote}>
      * INGLÉS (ASIGNATURA EXTRAOFICIAL NO PROMEDIA CON EL RESTO DE LAS MATERIAS)
    </Text>
  </View>
  
  {/* ÁREA DE FIRMAS Y FOOTER */}
  <View style={styles.footerArea}>
    <Text style={styles.averageText}>PROMEDIO DEL CICLO ESCOLAR: {props.promedio} ({props.promedioLetra})</Text>
    
    <View style={styles.signatureSection}>
      <Text style={styles.signatureLabel}>Atentamente:</Text>
      {props.opciones.incluirFirma && props.base64Firma && (
        <Image src={props.base64Firma} style={styles.firmaImage} />
      )}
      <View style={styles.signatureLine}/>
      <Text style={styles.signatureName}>{toTitleCase(props.firmanteNombre)}</Text>
      <Text style={styles.signatureTitle}>{toTitleCase(props.cargoFirmante)}</Text>
    </View>
    
    <View style={styles.footerNotesSection}>
      <Text style={styles.footerNoteText}>SE EXPIDE LA PRESENTE PARA LOS FINES QUE AL INTERESADO CONVENGAN.</Text>
      <Text style={styles.footerNoteText}>TOTAL DE ASIGNATURAS: {props.materias.length}</Text>
    </View>
    
    {/* SELLO (Absoluto) */}
    <View style={styles.stampBox}>
      {props.opciones.incluirSello && props.base64Sello && (
        <Image src={props.base64Sello} style={styles.stampImage} />
      )}
    </View>

    {/* LÍNEA DIVISORIA Y DIRECCIÓN */}
    <View style={styles.footerDivider} />
    <Text style={styles.addressLine}>
      AV. JAVIER ROJO GOMEZ NO. 375 COL AGRICOLA ORIENTAL C.P. 08500 ALCALDÍA IZTACALCO, CIUDAD DE MÉXICO - TELÉFONO: 5646846747
    </Text>
  </View>
</View>
);

export const BoletaPDFDocument = ({ props }: { props: BoletaPDFProps }) => {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <BoletaContent props={props} />
        {props.opciones.copias === 2 && (
          <>
            <View style={{ height: '2%', justifyContent: 'center' }}>
              <View style={styles.cutLine} />
            </View>
            <BoletaContent props={props} />
          </>
        )}
      </Page>
    </Document>
  );
};
