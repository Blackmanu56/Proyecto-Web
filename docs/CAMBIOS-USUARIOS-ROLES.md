# Chopper Repuestos — Cambios realizados en el módulo Usuarios / Roles

**Proyecto:** `sgi-repuestos`  
**Stack:** Next.js 16, React 19, TypeScript 5.7, Prisma 7, Tailwind CSS 4, shadcn/ui (Radix), PostgreSQL  
**Fecha:** Julio 2026  

---

## Resumen general

Se implementaron mejoras sustanciales en el módulo de **Gestión de Usuarios y Roles** (`/empleados`), abarcando tres grandes áreas:

1. **Protección del rol ADMINISTRADOR** — permisos fijos e inmutables.
2. **Rediseño del modal de Roles** — optimizado para escritorio 1920×1080.
3. **Protección del administrador principal** — el primer admin del sistema no puede darse de baja.

---

## 1. Protección del rol ADMINISTRADOR

### Archivos modificados
- `src/actions/roles.ts`
- `src/components/tables/RolesTable.tsx`

### Cambios

| Qué | Dónde | Detalle |
|-----|-------|---------|
| Permisos fijos | `roles.ts` → `updateRole` | Rechaza cualquier cambio de permisos para ADMINISTRADOR. Compara permisos actuales vs. nuevos. |
| Nombre fijo | `roles.ts` → `updateRole` | Impide renombrar el rol ADMINISTRADOR. |
| Desactivar bloqueado | `roles.ts` → `toggleRoleEstado` | Devuelve error si se intenta desactivar el rol ADMINISTRADOR. |
| UI sin acciones | `RolesTable.tsx` | Los botones de Editar y Desactivar no se renderizan para ADMINISTRADOR. |
| Checkboxes deshabilitados | `RolesTable.tsx` | Al editar ADMINISTRADOR, todos los checkboxes de permisos quedan bloqueados con aviso informativo. |

### Mensajes de error
- *"El rol Administrador tiene permisos fijos que no pueden modificarse."*
- *"El nombre del rol Administrador no puede modificarse."*
- *"El rol Administrador no puede ser desactivado."*

---

## 2. Rediseño del modal de Crear / Editar Rol

### Archivos modificados
- `src/components/tables/RolesTable.tsx`

### Problema anterior
- Modal angosto (`max-w-5xl`), obligaba a scrollear.
- Permisos en grid plano de 2 columnas, siempre visibles.
- Header y footer se scrolleaban con el contenido.
- No aprovechaba el ancho de un monitor 24".

### Solución implementada

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Ancho | `max-w-5xl` (~64rem) | `w-[90vw] max-w-[1400px]` (~88vw en 1920px) |
| Layout | Grid 2 columnas iguales | Sidebar 30% + contenido 70% |
| Permisos | Grid plano, 2 cols, todos visibles | **Acordeón** por módulo, grid **4 columnas** al expandir |
| Scroll | Global en todo el modal | Solo zona de permisos; header y footer **fijos** |
| Sidebar | Nombre + Descripción | Nombre + Descripción + Estado + Copiar permisos + **Resumen de permisos** |
| Font sizes | xs (10-11px) | sm (12-13px) — más cómodo en 24" |
| Controles | "Todos \| Ninguno \| Expandir" sueltos | Barra alineada con contador `X / 41` |

### Estructura del modal

```
┌─────────────────────────────────────────────────────────┐
│ HEADER FIJO: Título + Descripción                       │
├──────────────┬──────────────────────────────────────────┤
│  SIDEBAR 30% │  CONTENIDO 70%                          │
│              │                                          │
│  Nombre      │  Barra de controles:                     │
│  Descripción │  Todos | Ninguno | Expandir/Contraer     │
│  Estado      │  Permisos: X / 41                        │
│  Copiar de   │                                          │
│  Resumen     │  ▸ Dashboard          1/1               │
│   24/41      │  ▸ Productos          8/8               │
│   63%        │    [✓] Ver productos                     │
│              │    [ ] Crear productos                   │
│              │    [✓] Editar productos                  │
│              │    ... (grid 4 columnas)                 │
│              │  ▸ Ventas             5/5               │
│              │  ▸ Caja               6/6               │
│              │  ...                                     │
├──────────────┴──────────────────────────────────────────┤
│ FOOTER FIJO:                          [Cancelar] [Guardar] │
└─────────────────────────────────────────────────────────┘
```

### Comportamiento del acordeón
- Al **crear** un rol: todos los módulos colapsados.
- Al **editar** un rol: se expanden automáticamente los módulos que tienen permisos seleccionados.
- Click en el header del módulo → expande/colapsa.
- Click en el checkbox del módulo → selecciona/deselecciona todos los permisos del módulo.

### Funciones eliminadas
- `toggleModule` y `toggleAllModules` se conservaron (fueron restauradas con el acordeón).

---

## 3. Estándarización de stat cards

### Archivos modificados
- `src/components/tables/UsuariosTable.tsx`
- `src/components/tables/RolesTable.tsx`

### Cambio
Todos los stat cards del sistema ahora usan la misma escala:

| Propiedad | Valor unificado |
|-----------|-----------------|
| Texto del número | `text-2xl font-extrabold` |
| Padding | `p-4` |
| Icono | `size={20}` |

Módulos afectados: Productos, Ventas, Clientes, Usuarios, Roles, Proveedores.

---

## 4. Protección del administrador principal

### Archivos modificados
- `src/actions/usuarios.ts`
- `src/components/tables/UsuariosTable.tsx`
- `src/components/ui/employee-panel.tsx`

### Concepto

El **administrador principal** es el usuario con rol `ADMINISTRADOR` y **ID más bajo** en la base de datos (el primero creado). Esta identificación es determinística y sobrevive a la creación de nuevos administradores.

### Protección en servidor (`usuarios.ts`)

#### `toggleEstadoUsuario`

```
1. Buscar el rol ADMINISTRADOR en la DB
2. Encontrar el usuario con ID más bajo con ese rol → primaryAdmin
3. Si el usuario a modificar es el primaryAdmin y está activo → RECHAZAR
4. Si el usuario tiene rol ADMINISTRADOR y está activo:
   - Contar admins activos restantes (excluyendo al usuario)
   - Si queda 0 → RECHAZAR
5. Si pasa las validaciones → cambiar estado
```

#### `actualizarUsuario`

```
1. Buscar el rol ADMINISTRADOR y el primaryAdmin
2. Si el usuario es el primaryAdmin y el nuevo rolId ≠ ADMINISTRADOR → RECHAZAR
3. Si el usuario tiene rol ADMINISTRADOR y el nuevo rolId ≠ ADMINISTRADOR:
   - Contar admins activos restantes
   - Si queda 0 → RECHAZAR
4. Si pasa las validaciones → actualizar
```

### Mensajes de error del servidor
- *"El administrador principal no puede darse de baja."*
- *"Debe existir al menos un administrador activo."*
- *"El administrador principal no puede cambiar su rol."*

### Protección en UI (`UsuariosTable.tsx`)

| Elemento | Comportamiento |
|----------|----------------|
| Badge de rol | Se muestra normalmente |
| Icono de corona 👑 | A la derecha del badge, color `var(--warning)`, opacidad 80% |
| Tooltip | *"Este es el administrador principal y no puede darse de baja"* |
| Botón toggle (tabla) | Reemplazado por icono deshabilitado con `cursor-not-allowed` y tooltip |
| Selector de rol (editar) | Deshabilitado con aviso: *"El administrador principal no puede cambiar su rol"* |
| Diálogo de confirmación | Muestra errores del servidor cuando la acción es bloqueada |

### Protección en EmployeePanel (`employee-panel.tsx`)

- Se agrega prop `isPrimaryAdmin`.
- Cuando es `true`, el botón "Desactivar" se reemplaza por un aviso: *"Administrador principal — protegido"*.

### Otros administradores

Los usuarios con rol ADMINISTRADOR que **no** son el principal **sí pueden**:
- Cambiar entre Activo / Inactivo (siempre que quede al menos uno activo).
- Cambiar de rol (siempre que quede al menos un admin activo).

---

## 5. Notificaciones toast

### Archivo modificado
- `src/components/ui/employee-panel.tsx`

### Cambio
Se reemplazaron 3 llamadas a `window.alert()` por `toast.error()` de sonner, integrado con el sistema de notificaciones del proyecto.

---

## 6. Botón "Nuevo Rol"

### Archivo modificado
- `src/components/tables/RolesTable.tsx`

### Cambio
Se restauró el botón "Nuevo Rol" en la barra de herramientas de la tabla de roles, que había sido eliminado accidentalmente.

---

## Archivos modificados (resumen)

| Archivo | Cambios principales |
|---------|-------------------|
| `src/actions/roles.ts` | Protección ADMINISTRADOR en `updateRole` y `toggleRoleEstado` |
| `src/actions/usuarios.ts` | Protección admin principal en `toggleEstadoUsuario` y `actualizarUsuario` |
| `src/components/tables/RolesTable.tsx` | Modal rediseñado (90vw, accordion, 4-col grid, fixed header/footer) |
| `src/components/tables/UsuariosTable.tsx` | Crown icon, primary admin ID, role protection, stat cards, sort |
| `src/components/ui/employee-panel.tsx` | Toast notifications, `isPrimaryAdmin` prop, protected toggle |

---

## Restricciones respetadas

- ✅ Prisma no fue modificado
- ✅ No se crearon migraciones
- ✅ No se eliminaron usuarios
- ✅ No se eliminaron roles
- ✅ No se modificaron otros módulos (Productos, Ventas, Caja, Clientes, Proveedores, Informes)
- ✅ No se cambiaron IDs ni contraseñas
- ✅ No se alteraron datos existentes
- ✅ La base de datos permanece intacta

---

## Verificaciones

- ✅ `npx tsc --noEmit` — pass limpio
- ✅ `npx next build` — build exitoso
- ✅ Todos los cambios son de interfaz y validaciones puntuales
