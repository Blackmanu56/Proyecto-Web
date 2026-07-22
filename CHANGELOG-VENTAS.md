# Changelog — Día de Trabajo: 21 de julio de 2026

**Proyecto:** SGI Repuestos (Chopper Repuestos)
**Ruta:** `C:\Users\manu_\.gemini\antigravity\scratch\sgi-repuestos`

---

## Índice

1. [Análisis Inicial del Proyecto](#1-análisis-inicial-del-proyecto)
2. [Sistema de Productos Favoritos](#2-sistema-de-productos-favoritos)
3. [Filtros Rápidos en Catálogo](#3-filtros-rápidos-en-catálogo)
4. [Labels Mejorados](#4-labels-mejorados)
5. [Rediseño del Carrito de Compras](#5-rediseño-del-carrito-de-compras)
6. [Sección de Pago Reorganizada](#6-sección-de-pago-reorganizada)
7. [Botón "Limpiar carrito"](#7-botón-limpiar-carrito)
8. [Archivos Modificados](#8-archivos-modificados)
9. [Archivos NO Modificados](#9-archivos-no-modificados)
10. [Verificaciones](#10-verificaciones)
11. [Cómo Ejecutar](#11-cómo-ejecutar)

---

## 1. Análisis Inicial del Proyecto

Se realizó un análisis completo del proyecto antes de implementar cambios.

### Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Runtime | React 19 |
| Base de datos | PostgreSQL 15 (Docker, puerto 5433) |
| ORM | Prisma 7.8 con `@prisma/adapter-pg` |
| Auth | JWT (jose) con cookies httpOnly |
| UI | Radix UI + Tailwind CSS 4 + shadcn/ui |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Extras | jsPDF + html2canvas (tickets PDF), xlsx (exportación) |

### Modelo de Dominio (Prisma Schema)

12 entidades en PostgreSQL:

```
Rol ──1:N──> Usuario ──1:1──> Empleado
                  │
                  ├──1:N──> Venta ──1:N──> DetalleVenta
                  ├──1:N──> Caja ──1:N──> MovimientoCaja
                  └──1:N──> Compra ──1:N──> DetalleCompra

Cliente ──1:N──> Venta
Proveedor ──1:N──> Producto, Compra
Categoria ──1:N──> Producto
Producto ──1:N──> DetalleVenta, DetalleCompra
```

### Dominios del Sistema

- **Stock/Productos** con categorías y proveedores
- **Ventas** con detalle línea, descuentos, cuotas, tipo comprobante
- **Caja** (apertura/cierre, movimientos, gastos manuales)
- **Compras** a proveedores con detalle
- **Personas**: usuarios, empleados, clientes
- **Informes** (módulo de reporting)

### Estructura de Código (`src/`)

```
src/
├── app/                    # Next.js App Router (8 módulos)
│   ├── login/              # Autenticación
│   ├── dashboard/          # Panel principal
│   ├── productos/          # CRUD productos
│   ├── ventas/             # Terminal de ventas
│   ├── caja/               # Terminal de caja
│   ├── clientes/           # CRUD clientes
│   ├── proveedores/        # CRUD proveedores
│   ├── empleados/          # CRUD empleados
│   ├── informes/           # Reporting
│   └── api/logout/         # API endpoint logout
├── actions/                # Server Actions (10 archivos)
├── components/
│   ├── layout/             # AppShell, Navbar, DashboardClient
│   ├── forms/              # VentasTerminal, CajaTerminal
│   ├── tables/             # Tablas CRUD (4 tables + StatusFilter)
│   ├── reports/            # 11 archivos de reportes/modales
│   └── ui/                 # Componentes shadcn/ui
├── hooks/                  # useExport, useReport
├── lib/                    # auth.server, jwt, prisma, upload, utils
└── middleware.ts           # Auth + RBAC middleware
```

### Seguridad

- JWT con expiración 24h, verificado en middleware
- RBAC con 3 roles: `ADMINISTRADOR`, `ENCARGADO_VENTAS`, `ENCARGADO_STOCK`
- Rutas protegidas por rol en el middleware
- Cookie `session` httpOnly

### Estado Inicial

- 1 cambio SDD en progreso: `mejorar-modulo-informes`
- Docker compose levanta PostgreSQL local
- README es el default de create-next-app

---

## 2. Sistema de Productos Favoritos

### Base de datos

**Nuevo modelo `ProductoFavorito`** agregado al Prisma schema:

```prisma
model ProductoFavorito {
  id         Int      @id @default(autoincrement())
  usuarioId  Int      @map("usuario_id")
  usuario    Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  productoId Int      @map("producto_id")
  producto   Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)
  creadoEn   DateTime @default(now()) @map("creado_en")

  @@unique([usuarioId, productoId])
  @@map("productos_favoritos")
}
```

- Tabla `productos_favoritos` con 4 columnas
- Foreign keys hacia `usuarios` y `productos` (ON DELETE CASCADE)
- Unique compuesto: `(usuario_id, producto_id)`
- Relaciones agregadas en modelos `Usuario` y `Producto`

**Migración:** `20260721000000_add_producto_favorito`

### Server Action

Nueva función `toggleFavorito()` en `src/actions/ventas.ts`:

```typescript
export async function toggleFavorito(productoId: number)
```

- Alterna el estado de favorito para el usuario actual (JWT)
- Optimistic update en el cliente (se actualiza antes de la respuesta del servidor)
- Revert automático en caso de error
- Usa `@@unique` para upsert eficiente

### Pantalla de Ventas (Server Component)

Se agregaron 2 queries adicionales en `src/app/ventas/page.tsx`:

1. **Favoritos del usuario:** `prisma.productoFavorito.findMany()`
2. **Ventas por producto:** `prisma.detalleVenta.groupBy()` (para "Más vendidos")

Datos serializados como array y objeto plano (no `Set`/`Map`) para server→client.

---

## 3. Filtros Rápidos en Catálogo

### Segmented Control

Debajo del buscador de productos, se agregó un control de pestañas:

```text
[ Todos | Favoritos | Más vendidos ]
```

| Tab | Comportamiento |
|---|---|
| **Todos** | Catálogo completo (comportamiento original) |
| **Favoritos** | Filtra solo productos marcados con estrella |
| **Más vendidos** | Ordena por cantidad total vendida (descendente) |

- Tab activo: fondo rojo institucional (`--brand`) con texto blanco
- Tab inactivo: texto gris con hover sutil
- Badge de conteo en Favoritos (cuando hay > 0)

### Estrella de Favoritos

- **Ubicación:** esquina superior derecha de cada tarjeta de producto
- **Click:** toggle favorito (no activa el `addToCart`)
- **Estados:** Amarillo/dorado si es favorito, gris transparente si no
- **Técnica:** `stopPropagation()` para evitar conflictos con el clic principal

### Estado Vacío Contextual

Cada tab muestra un mensaje vacío diferente:

| Tab | Mensaje |
|---|---|
| Favoritos | "No tenés favoritos aún — Tocá la estrella en un producto para marcarlo" |
| Más vendidos | "Sin ventas registradas" |
| Todos | "No se encontraron productos" |

### Badge de Vendidos

En filtro "Más vendidos", cada tarjeta muestra:

```text
TrendingUp icon + "X vendidos"
```

---

## 4. Labels Mejorados

### Estilo Consistente

Todos los labels del sistema usan ahora el mismo estilo:

```css
text-[10px] text-slate-200 font-semibold
```

Aplicado a:

| Label | Ubicación |
|---|---|
| **Buscar producto** | Sobre el input de búsqueda en catálogo |
| **Categoría** | Sobre el select de categorías |
| **Cliente:** | En la sección de pago del carrito |
| **Forma de pago** | Sobre los botones de medio de pago |
| **Tipo de factura** | Sobre los botones de comprobante |
| **Descuento** | Sobre el campo de descuento |

### Antes vs Después

**Catálogo (antes):**
```text
[ Buscar repuesto... ]    [ Todas ▼ ]
```

**Catálogo (ahora):**
```text
Buscar producto            Categoría
[ Buscar repuesto... ]    [ Todas ▼ ]
```

**Pago (antes):**
```text
Cliente:                    Empresa Alfa
[botones de pago]
```

**Pago (ahora):**
```text
Cliente:                    Empresa Alfa

Forma de pago
[Efectivo]     [Transferencia]
[Débito]       [Crédito]

Tipo de factura
[Factura A]    [Factura B]    [Factura C]

Descuento
[$ Fijo] [      0      ] [$]
```

---

## 5. Rediseño del Carrito de Compras

### 5.1 Interface `CartItem`

Se amplió para incluir datos visuales:

```typescript
interface CartItem {
  id: number;
  nombre: string;
  imagen: string | null;      // NUEVO
  categoria: string;           // NUEVO
  precioVenta: number;
  stockDisponible: number;
  cantidad: number;
}
```

### 5.2 Filas de Productos

**Antes (2 filas por producto):**
```text
[img] Nombre                    $ precio
     Categoría     [-] qty [+]    $ subtotal  [🗑]
```

**Ahora (1 fila por producto):**
```text
[img] Nombre y categoría    [-] qty [+]    $ subtotal    [🗑]
```

- Layout con `flex items-center` — todo en una sola línea
- Imagen: 36×36px, fallback a icono `Package`
- Nombre: truncado con `truncate`, `text-[10px] font-semibold`
- Categoría: debajo del nombre, `text-[8px] text-[var(--text-secondary)]`
- **Precio unitario eliminado** — solo queda el subtotal

### 5.3 Controles de Cantidad

| Aspecto | Antes | Ahora |
|---|---|---|
| Altura del grupo | `h-5` (20px) | `h-6` (24px) |
| Iconos `-` / `+` | `size={8}` | `size={10}` |
| Fuente botones | `9px` | `11px` |
| Input quantity | `w-6`, `9px` | `w-7`, `11px` `font-bold` |
| Borde del grupo | `--border` | `--border-hover` |
| Hover botones | `--text` | white + fondo rojo sutil |

### 5.4 Subtotal

- Tamaño: `12px` (antes `10px`)
- Color: **white** `font-bold` (antes `--text`)
- Formato: `formatCurrency(precioVenta * cantidad)`

### 5.5 Botón Eliminar

| Aspecto | Antes | Ahora |
|---|---|---|
| Icono | `size={12}` | `size={14}` |
| Padding | `p-1` | `p-1.5` |
| Hover | solo color | color rojo + fondo `danger/10` + `rounded-md` |
| Tooltip | ninguno | `title="Eliminar producto"` |

### 5.6 Espaciado

- Entre filas: `space-y-1` (antes `space-y-1.5`)
- Padding de cada fila: `p-1.5`
- Gap interno: `gap-2`

---

## 6. Sección de Pago Reorganizada

### Orden Final

```text
───────────────────────────
Cliente:                    Empresa Alfa SRL

Forma de pago
[Efectivo]     [Transferencia]
[Débito]       [Crédito]

Tipo de factura
[Factura A]    [Factura B]    [Factura C]

Descuento
[$ Fijo] [      0      ] [$]

Subtotal:                   $ 60.000
Desc.:                      -$ 5.000
Total:                      $ 55.000

[ Cobrar → ]
```

### Cambios Respectivos al Diseño Original

| Cambio | Detalle |
|---|---|
| **DNI/CUIT eliminado** | Ya no se muestra en el carrito |
| **"Forma de pago" label** | Nuevo label consistente |
| **"Tipo de factura" label** | Nuevo label consistente |
| **Orden invertido** | Factura ahora va antes de Descuento |
| **Descuento compactado** | `max-w-[320px]` en vez de `flex-1` |

---

## 7. Botón "Limpiar carrito"

### Ubicación

- **Antes:** debajo del botón Cobrar (al final del carrito)
- **Ahora:** inmediatamente debajo de la lista de productos, antes de los datos del cliente

### Orden del Carrito

```text
Encabezado del carrito
Lista de productos (scroll interno)
Botón Limpiar carrito          ← NUEVA POSICIÓN
───────────────────────────
Cliente: nombre
Forma de pago (2×2 grid)
Tipo de factura (3 columnas)
Descuento (label + select + input)
Subtotal / Descuento / Total
Error (si existe)
Botón Cobrar                   ← SIEMPRE AL FINAL, FIJO
```

### Diseño

- Ancho completo
- Borde rojo: `border-[var(--danger)]/30`
- Texto rojo: `text-[var(--danger)]`
- Icono `Trash2` a la izquierda del texto
- Hover: fondo rojo transparente `hover:bg-[var(--danger)]/10`
- Bordes redondeados: `rounded-[var(--radius-md)]`
- Texto: `text-[11px] font-semibold`
- Comportamiento: conserva la función original de vaciar carrito

---

## 8. Archivos Modificados

| # | Archivo | Tipo de Cambio |
|---|---|---|
| 1 | `prisma/schema.prisma` | Nuevo modelo `ProductoFavorito`, relaciones en `Usuario` y `Producto` |
| 2 | `prisma/migrations/20260721000000_add_producto_favorito/migration.sql` | SQL de creación de tabla (NUEVO) |
| 3 | `src/actions/ventas.ts` | Nueva server action `toggleFavorito()` |
| 4 | `src/app/ventas/page.tsx` | Fetch de favoritos y ventas por producto, props adicionales |
| 5 | `src/components/forms/VentasTerminal.tsx` | Todos los cambios de UI, lógica de filtros, rediseño del carrito |

**Total: 5 archivos modificados/creados**

---

## 9. Archivos NO Modificados

### Infraestructura

- `src/app/layout.tsx`
- `src/middleware.ts`
- `docker-compose.yml`
- `package.json`
- `tsconfig.json`
- `.env`

### Librerías

- `src/lib/auth.server.ts`
- `src/lib/jwt.ts`
- `src/lib/prisma.ts`
- `src/lib/utils.ts`
- `src/lib/upload.ts`

### Otros Server Actions

- `src/actions/auth.ts`
- `src/actions/caja.ts`
- `src/actions/clientes.ts`
- `src/actions/productos.ts`
- `src/actions/proveedores.ts`
- `src/actions/usuarios.ts`
- `src/actions/informes.ts`
- `src/actions/auxiliares.ts`
- `src/actions/foto-perfil.ts`

### Otros Módulos

- `src/app/dashboard/page.tsx`
- `src/app/productos/page.tsx`
- `src/app/clientes/page.tsx`
- `src/app/proveedores/page.tsx`
- `src/app/empleados/page.tsx`
- `src/app/caja/page.tsx`
- `src/app/informes/page.tsx`
- Todos los componentes de `components/ui/`, `components/tables/`, `components/reports/`, `components/layout/`

---

## 10. Verificaciones

| Verificación | Estado | Detalle |
|---|---|---|
| TypeScript compila sin errores | ✅ | `npx tsc --noEmit` sin output |
| Migración aplicada | ✅ | `npx prisma migrate deploy` exitoso |
| Tabla `productos_favoritos` creada | ✅ | 4 columnas: id, usuario_id, producto_id, creado_en |
| Foreign keys | ✅ | `productos_favoritos_usuario_id_fkey` → `usuarios.id` |
| | | `productos_favoritos_producto_id_fkey` → `productos.id` |
| Unique compuesto | ✅ | `productos_favoritos_usuario_id_producto_id_key` |
| Datos intactos | ✅ | 3 usuarios, 13 productos, 7 clientes, 31 ventas, 45 detalles, 2 cajas |
| Prisma client regenerado | ✅ | `npx prisma generate` exitoso |
| Migration status | ✅ | "Database schema is up to date!" |
| Docker PostgreSQL | ✅ | Contenedor `sgi-repuestos-db-1` corriendo en puerto 5433 |

---

## 11. Cómo Ejecutar

```bash
# 1. Levantar la base de datos
docker compose up -d

# 2. Regenerar el cliente Prisma (si se modificó el schema)
npx prisma generate

# 3. Verificar que compile
npx tsc --noEmit

# 4. Ejecutar el dev server
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

---

## Dependencias Utilizadas

No se agregaron ni eliminaron dependencias. Se utilizaron únicamente paquetes ya instalados:

| Paquete | Uso |
|---|---|
| `lucide-react` | Iconos: `Star`, `TrendingUp`, `Trash2`, `Package` |
| `@prisma/client` | Queries a PostgreSQL |
| `jose` | JWT (ya existente) |
| `next` | Server Actions, App Router |
| `react` | Componentes client |

---

## Notas Técnicas

### Serialización Server → Client

Los `Set` y `Map` de JavaScript no son serializables entre server y client components en Next.js. Se convirtieron:

- `Set<number>` (favoritoIds) → `number[]` (array plano)
- `Map<number, number>` (ventasPorProducto) → `Record<number, number>` (objeto plano)

### Optimistic Update

El toggle de favoritos usa optimistic update:
1. Se actualiza el estado local inmediatamente
2. Se envía la request al servidor
3. Si falla, se revierte al estado anterior

Esto da sensación de inmediacy al usuario sin percibir latency.
