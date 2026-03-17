import React, { useState } from 'react';
import { ArrowLeft, Plus, Edit2, Save, X, GraduationCap, CheckCircle } from 'lucide-react';
import { Alumno, CicloEscolar, PaymentPlan, Catalogos } from '../types';

interface AlumnosConfigProps {
  alumnos: Alumno[];
  ciclos: CicloEscolar[];
  activeCicloId: string;
  activeCyclePlans: PaymentPlan[];
  catalogos?: Catalogos;
  onBack: () => void;
  onSave: (alumnos: Alumno[]) => void;
  onCreatePlan: (plan: PaymentPlan) => void;
}

export default function AlumnosConfig({ alumnos: initialAlumnos, ciclos, activeCicloId, activeCyclePlans, catalogos, onBack, onSave, onCreatePlan }: AlumnosConfigProps) {
  const [alumnos, setAlumnos] = useState<Alumno[]>(initialAlumnos);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Alumno>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: ''
  });

  const showAlert = (title: string, message: string) => {
    setModalState({ isOpen: true, type: 'alert', title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalState({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  const handleEdit = (alumno: Alumno) => {
    setEditingId(alumno.id);
    setEditForm(alumno);
  };

  const handleSave = () => {
    if (!editForm.nombre_completo || !editForm.licenciatura || !editForm.grado_actual) return;

    let updatedAlumnos;
    if (editingId === 'new') {
      const newAlumno: Alumno = {
        id: `a_${Date.now()}`,
        nombre_completo: editForm.nombre_completo,
        licenciatura: editForm.licenciatura,
        grado_actual: editForm.grado_actual,
        turno: editForm.turno || 'MIXTO'
      };
      updatedAlumnos = [...alumnos, newAlumno];

      // Auto-generate default plan
      const activeCiclo = ciclos.find(c => c.id === activeCicloId);
      if (activeCiclo) {
        const newPlan: PaymentPlan = {
          id: `p_${Date.now()}`,
          alumno_id: newAlumno.id,
          ciclo_id: activeCiclo.id,
          nombre_alumno: newAlumno.nombre_completo,
          no_plan_pagos: `PP-${newAlumno.id.slice(-4)}`,
          fecha_plan: new Date().toLocaleDateString('es-MX'),
          beca_porcentaje: '0%',
          beca_tipo: 'NINGUNA',
          ciclo_escolar: activeCiclo.nombre,
          tipo_plan: 'Cuatrimestral',
          licenciatura: newAlumno.licenciatura,
          grado_turno: `${newAlumno.grado_actual} / ${newAlumno.turno}`
        };
        onCreatePlan(newPlan);
      }
    } else {
      updatedAlumnos = alumnos.map(a => a.id === editingId ? { ...a, ...editForm } as Alumno : a);
    }

    setAlumnos(updatedAlumnos);
    onSave(updatedAlumnos);
    setEditingId(null);
  };

  const handleAddNew = () => {
    setEditingId('new');
    setEditForm({
      nombre_completo: '',
      licenciatura: '',
      grado_actual: '1ER',
      turno: 'MIXTO'
    });
  };

  const handlePromote = (alumno: Alumno) => {
    // Simple logic to increment grade (e.g., "1ER" -> "2DO", "7MO" -> "8VO")
    const gradeMap: Record<string, string> = {
      '1ER': '2DO', '2DO': '3ER', '3ER': '4TO', '4TO': '5TO',
      '5TO': '6TO', '6TO': '7MO', '7MO': '8VO', '8VO': '9NO', '9NO': 'EGRESADO'
    };

    const currentGradeNum = alumno.grado_actual.replace(/[^0-9]/g, '');
    let nextGrade = gradeMap[alumno.grado_actual];

    if (!nextGrade && currentGradeNum) {
      nextGrade = `${Number(currentGradeNum) + 1}VO`; // Fallback approximation
    }

    if (nextGrade) {
      showConfirm(
        "Confirmar Promoción",
        `¿Promover a ${alumno.nombre_completo} de ${alumno.grado_actual} a ${nextGrade}? Esto simulará su inscripción al nuevo ciclo.`,
        () => {
          const updated = alumnos.map(a => a.id === alumno.id ? { ...a, grado_actual: nextGrade! } : a);
          setAlumnos(updated);
          onSave(updated);

          // Auto-generate default plan for the new cycle
          const activeCiclo = ciclos.find(c => c.id === activeCicloId);
          if (activeCiclo) {
            const newPlan: PaymentPlan = {
              id: `p_${Date.now()}`,
              alumno_id: alumno.id,
              ciclo_id: activeCiclo.id,
              nombre_alumno: alumno.nombre_completo,
              no_plan_pagos: `PP-${alumno.id.slice(-4)}`,
              fecha_plan: new Date().toLocaleDateString('es-MX'),
              beca_porcentaje: '0%',
              beca_tipo: 'NINGUNA',
              ciclo_escolar: activeCiclo.nombre,
              tipo_plan: 'Cuatrimestral',
              licenciatura: alumno.licenciatura,
              grado_turno: `${nextGrade} / ${alumno.turno}`
            };
            onCreatePlan(newPlan);
          }

          showAlert("Éxito", `Alumno promovido a ${nextGrade} y plan de pagos generado para el ciclo activo.`);
        }
      );
    } else {
      showAlert("Error", "No se pudo determinar el siguiente grado automáticamente. Por favor, edítalo manualmente.");
    }
  };

  const filteredAlumnos = alumnos.filter(a =>
    a.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.licenciatura.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-black font-bold transition-colors"
          >
            <ArrowLeft size={20} /> Volver al Inicio
          </button>

          <button
            onClick={handleAddNew}
            disabled={editingId !== null}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            <Plus size={18} /> Nuevo Alumno
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Gestión de Alumnos</h1>
              <p className="text-gray-500 text-sm mt-1">Administra el padrón de alumnos y promuévelos de grado.</p>
            </div>
            <div className="w-full md:w-72">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Buscar alumno..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                  <th className="py-3 px-6 font-semibold">Nombre Completo</th>
                  <th className="py-3 px-6 font-semibold">Licenciatura</th>
                  <th className="py-3 px-6 font-semibold">Grado Actual</th>
                  <th className="py-3 px-6 font-semibold">Turno</th>
                  <th className="py-3 px-6 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editingId === 'new' && (
                  <tr className="bg-indigo-50/50">
                    <td className="py-3 px-6">
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="Nombre completo"
                        value={editForm.nombre_completo}
                        onChange={e => setEditForm({ ...editForm, nombre_completo: e.target.value })}
                      />
                    </td>
                    <td className="py-3 px-6">
                      {catalogos?.licenciaturas?.length ? (
                        <select
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                          value={editForm.licenciatura || ''}
                          onChange={e => setEditForm({ ...editForm, licenciatura: e.target.value })}
                        >
                          <option value="">-- Seleccionar --</option>
                          {catalogos.licenciaturas.map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="Licenciatura"
                          value={editForm.licenciatura}
                          onChange={e => setEditForm({ ...editForm, licenciatura: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="py-3 px-6">
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm w-20"
                        placeholder="Ej. 1ER"
                        value={editForm.grado_actual}
                        onChange={e => setEditForm({ ...editForm, grado_actual: e.target.value })}
                      />
                    </td>
                    <td className="py-3 px-6">
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm w-24"
                        placeholder="Ej. MIXTO"
                        value={editForm.turno}
                        onChange={e => setEditForm({ ...editForm, turno: e.target.value })}
                      />
                    </td>
                    <td className="py-3 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleSave} className="text-green-600 hover:bg-green-100 p-1 rounded"><Save size={18} /></button>
                        <button onClick={() => setEditingId(null)} className="text-red-600 hover:bg-red-100 p-1 rounded"><X size={18} /></button>
                      </div>
                    </td>
                  </tr>
                )}
                {filteredAlumnos.map(alumno => (
                  <tr key={alumno.id} className="hover:bg-gray-50 transition-colors">
                    {editingId === alumno.id ? (
                      <>
                        <td className="py-3 px-6">
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            value={editForm.nombre_completo}
                            onChange={e => setEditForm({ ...editForm, nombre_completo: e.target.value })}
                          />
                        </td>
                        <td className="py-3 px-6">
                          {catalogos?.licenciaturas?.length ? (
                            <select
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                              value={editForm.licenciatura || ''}
                              onChange={e => setEditForm({ ...editForm, licenciatura: e.target.value })}
                            >
                              <option value="">-- Seleccionar --</option>
                              {catalogos.licenciaturas.map(l => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              value={editForm.licenciatura}
                              onChange={e => setEditForm({ ...editForm, licenciatura: e.target.value })}
                            />
                          )}
                        </td>
                        <td className="py-3 px-6">
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm w-20"
                            value={editForm.grado_actual}
                            onChange={e => setEditForm({ ...editForm, grado_actual: e.target.value })}
                          />
                        </td>
                        <td className="py-3 px-6">
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm w-24"
                            value={editForm.turno}
                            onChange={e => setEditForm({ ...editForm, turno: e.target.value })}
                          />
                        </td>
                        <td className="py-3 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={handleSave} className="text-green-600 hover:bg-green-100 p-1 rounded"><Save size={18} /></button>
                            <button onClick={() => setEditingId(null)} className="text-red-600 hover:bg-red-100 p-1 rounded"><X size={18} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-4 px-6 font-bold text-gray-800">{alumno.nombre_completo}</td>
                        <td className="py-4 px-6 text-gray-600">{alumno.licenciatura}</td>
                        <td className="py-4 px-6 font-semibold text-indigo-600">{alumno.grado_actual}</td>
                        <td className="py-4 px-6 text-gray-600">{alumno.turno}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-3">
                            {activeCyclePlans.some(p => p.alumno_id === alumno.id || p.nombre_alumno === alumno.nombre_completo) ? (
                              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100" title="Ya está inscrito en el ciclo activo">
                                <CheckCircle size={14} /> Inscrito
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    const activeCiclo = ciclos.find(c => c.id === activeCicloId);
                                    if (activeCiclo) {
                                      showConfirm(
                                        "Confirmar Inscripción",
                                        `¿Inscribir a ${alumno.nombre_completo} en el ciclo ${activeCiclo.nombre}? Esto generará su plan de pagos.`,
                                        () => {
                                          const newPlan: PaymentPlan = {
                                            id: `p_${Date.now()}`,
                                            alumno_id: alumno.id,
                                            ciclo_id: activeCiclo.id,
                                            nombre_alumno: alumno.nombre_completo,
                                            no_plan_pagos: `PP-${alumno.id.slice(-4)}`,
                                            fecha_plan: new Date().toLocaleDateString('es-MX'),
                                            beca_porcentaje: '0%',
                                            beca_tipo: 'NINGUNA',
                                            ciclo_escolar: activeCiclo.nombre,
                                            tipo_plan: 'Cuatrimestral',
                                            licenciatura: alumno.licenciatura,
                                            grado_turno: `${alumno.grado_actual} / ${alumno.turno}`
                                          };
                                          onCreatePlan(newPlan);
                                          showAlert("Éxito", `Alumno inscrito y plan de pagos generado para el ciclo activo.`);
                                        }
                                      );
                                    }
                                  }}
                                  className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1 text-xs font-bold bg-emerald-50 px-2 py-1 rounded transition-colors border border-emerald-100"
                                  title="Inscribir al ciclo actual (Generar Plan)"
                                >
                                  <CheckCircle size={14} /> Inscribir
                                </button>
                                <button
                                  onClick={() => handlePromote(alumno)}
                                  className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-bold bg-indigo-50 px-2 py-1 rounded transition-colors border border-indigo-100"
                                  title="Promover de grado e inscribir a nuevo ciclo"
                                >
                                  <GraduationCap size={14} /> Promover
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleEdit(alumno)}
                              className="text-gray-500 hover:text-blue-600 p-1 rounded transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{modalState.title}</h3>
              <p className="text-gray-600">{modalState.message}</p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              {modalState.type === 'confirm' && (
                <button
                  onClick={() => setModalState({ ...modalState, isOpen: false })}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => {
                  if (modalState.type === 'confirm' && modalState.onConfirm) {
                    modalState.onConfirm();
                  }
                  setModalState({ ...modalState, isOpen: false });
                }}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                {modalState.type === 'confirm' ? 'Confirmar' : 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
