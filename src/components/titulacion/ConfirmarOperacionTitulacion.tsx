import ModalConfirmacion from '../ui/ModalConfirmacion';
export type AccionTitulacion='GUARDAR'|'COMPLETAR'|'REABRIR'|'ARCHIVAR';
const textos:Record<AccionTitulacion,{titulo:string;boton:string;detalle:string}>={
 GUARDAR:{titulo:'Guardar cambios de titulación',boton:'Guardar cambios',detalle:'Se guardarán los datos del programa que estás consultando.'},
 COMPLETAR:{titulo:'Completar trámite de titulación',boton:'Asentar acta y completar',detalle:'Se registrará el acta y se actualizará el estatus de este programa. Revisa los datos antes de confirmar.'},
 REABRIR:{titulo:'Reabrir trámite de titulación',boton:'Reabrir trámite',detalle:'El trámite volverá a estar en curso y se conservarán los datos del acta.'},
 ARCHIVAR:{titulo:'Archivar ficha de titulación',boton:'Archivar ficha',detalle:'La ficha saldrá de la consulta activa. Sus datos y auditoría se conservan. El acta y los datos guardados se conservan. No se revierten estatus académicos ni pagos.'}
};
export default function ConfirmarOperacionTitulacion({accion,motivo,busy,onMotivo,onCancelar,onConfirmar}:{accion:AccionTitulacion|null;motivo:string;busy:boolean;onMotivo:(valor:string)=>void;onCancelar:()=>void;onConfirmar:()=>Promise<void>}){
 const t=accion?textos[accion]:textos.GUARDAR;
 return <ModalConfirmacion isOpen={Boolean(accion)} title={t.titulo} type={accion==='ARCHIVAR'?'warning':'info'} busy={busy} confirmText={t.boton} confirmDisabled={motivo.trim().length<5} onCancel={onCancelar} onConfirm={onConfirmar} message={<div className="space-y-4"><p>{t.detalle}</p><div><label htmlFor="motivo-titulacion" className="block text-sm font-semibold mb-2">Motivo de este cambio</label><textarea id="motivo-titulacion" rows={3} maxLength={1000} disabled={busy} value={motivo} onChange={e=>onMotivo(e.target.value)} aria-describedby="ayuda-motivo-titulacion" placeholder="Por ejemplo: actualización documental revisada." className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-[#1c2228] dark:text-gray-100"/><p id="ayuda-motivo-titulacion" className="mt-1 text-xs text-gray-600 dark:text-gray-300">Escribe al menos 5 caracteres. El motivo quedará en la bitácora de este trámite.</p></div></div>}/>;
}
