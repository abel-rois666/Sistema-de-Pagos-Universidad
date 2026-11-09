import { LayoutDashboard, GraduationCap, Wallet, BookOpen, Briefcase, Settings, Users, Calendar, CalendarClock, FileText, BookUser, UserCheck } from 'lucide-react';
import type { IconoNavegacion } from '../../app/menuAplicacion';
const iconos={inicio:LayoutDashboard,escolar:GraduationCap,financiero:Wallet,academico:BookOpen,rh:Briefcase,configuracion:Settings,alumnos:Users,calendario:Calendar,horarios:CalendarClock,documento:FileText,docentes:BookUser,inscripciones:UserCheck};
export default function IconoMenu({icono,size=20}:{icono:IconoNavegacion;size?:number}) {
  const Icono=iconos[icono];
  return <Icono size={size} aria-hidden="true" />;
}
