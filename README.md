# 🏢 Sistema de Control de Pagos 

Sistema web avanzado diseñado para la gestión integral de cobranza académica, planes de pago de estudiantes universitarios, emisión y seguimiento de recibos financieros e importaciones masivas. 

Desarrollado con altos estándares de **UI/UX (Premium Glassmorphism)**, animaciones dinámicas y optimización completa en la nube.

---

## 🚀 Tecnologías y Herramientas (Tech Stack)

### **Frontend**
* **React 18** + **Vite** para desarrollo ultra-rápido y empaquetado optimizado.
* **TypeScript** asegurando integridad y tipado estricto en la lógica de cobros.
* **Tailwind CSS** para los estilos modulares y responsivos.
* **Framer Motion** para transiciones suaves, cuadros de diálogo y la estética general dinámica.
* **Lucide React** para iconografía moderna y ligera.
* *html2pdf.js* para la generación de tickets y recibos en formato PDF.

### **Backend y Base de Datos**
* **Supabase** (PostgreSQL) como Base de Datos Serverless en tiempo real.
* **Supabase Edge Functions** escritas en Deno para la gestión administrativa de cuentas de usuario protegidas, saltándose el RLS público sin exponer credenciales administrativas.

### **Despliegue y CI/CD**
* Action configurado a través de **GitHub Actions** hacia servidores de **Hostinger**.

---

## ✨ Características Principales

1. **Gestión de Planes de Pago**: Construcción semi-automática de planes financieros (Cuatrimestrales y Semestrales) mediante plantillas dinámicas y autogeneración de folios consecutivos inteligentes.
2. **Control de Ingresos**: Generación de Recibos y tickets, permitiendo la reducción *inteligente* en los planes de pagos a través de pagos completos y **pagos parciales** de conceptos, re-calculando en tiempo real lo acumulado y la deuda restante.
3. **Navegación Fluida (Bidireccional)**: Conexión transparente para administradores que permite "saltar" instantáneamente entre el plan de pagos de un estudiante a su recibo particular, y viceversa, retornando a las listas de origen sin perder su estado.
4. **Importación Inteligente Masiva**: Interfaz Drop/Upload de CSV que incorpora algoritmos `UPSERT` capaces de contrastar discrepancias y actualizar solo los datos relevantes (sin borrar registros y controlando folios o información omitida como el estatus o los detalles).
5. **Autenticación Basada en Roles**: Acceso restrictivo escalonado para administradores totales y coordinadores, controlando la inyección SQL de operaciones destructivas sobre el catálogo o importador.
6. **Dark Mode y Accesibilidad**: Ajustes globales almacenados persistentemente por usuario y ciclos.

---

## 🛠️ Instalación y Configuración para Desarrollo Local

Requisito indispensable: Tener [Node.js](https://nodejs.org/en/) (versión 18+ recomendada) y npm/yarn.

### 1. Clonar e Instalar dependencias
```bash
git clone <URL_DEL_REPOSITORIO>
cd Sistema-de-Pagos-Universidad
npm install
```

### 2. Variables de Entorno
Crea un archivo local `.env.local` o `.env` en la raíz del proyecto. El sistema requiere conectividad con Supabase. Deberás inyectar tus claves oficiales obtenidas del "Dashboard" de tu base de datos Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto-id.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```

### 3. Levantar Entorno Local
```bash
npm run dev
```
La aplicación será servida en `http://localhost:5173`.

---

## 🗄️ Esquema de Base de Datos y Supabase Edge Functions

### Configuración SQL
Para que el front-end tenga una superficie completa de trabajo, toda la estructura transaccional se inyecta desde el archivo central de provisionamiento.

1. Dirígete a tu Dashboard de Supabase -> **SQL Editor**.
2. Copia todo el contenido del archivo `db_schema.sql` (en la raíz de este proyecto).
3. Pégalo y ejecútalo. Esto construirá las tablas `usuarios`, `alumnos`, `ciclos_escolares`, `planes_pago`, `recibos`, las _Policies_ (RLS).

### Edge Function (Control Central de Usuarios)
Para editar usuarios desde el Frontend de una forma segura y blindada que no exponga bases o tokens:
1. Instala el CLI de Supabase si no lo tienes u opera desde su Dashboard.
2. Crea una función llamada exactamente `manage-users`.
3. Sube el código fuente en `.env`: _Asegúrate de inyectar las variables de entorno de `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL` a los secretos del Function Vault o en el dashboard._

---

## 📂 Arquitectura de Archivos Importantes

*   `src/App.tsx`: Enrutamiento modular, control de navegación dinámica entre vistas, persistencia de estado global en caché.
*   `src/components/`: Sub-módulos centrales de la aplicación (`PlanPagos.tsx`, `ControlIngresos.tsx`, `ConsultarRegistros.tsx`, modal unificado `AlumnosConfig.tsx`, importador con UPSERT `ImportarCSV.tsx`).
*   `src/lib/supabase.ts`: El puente de APIs y consultas DML. Concentra cada macro-acción (ej. `bulkSaveAlumnos`) minimizando llamadas de red a través de transacciones en lote.
*   `db_schema.sql`: Declaración de estado ideal de base de datos estructural, índices y Foreign Keys para el motor PGSQL.

---

<div align="center">
  <sub>Desarrollado y optimizado siguiendo los más finos estándares de Ingeniería de Software, modernización y experiencia fluida continua. ✨</sub>
</div>
