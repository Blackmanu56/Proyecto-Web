# Chopper Repuestos - Sistema de Gestión Integral (SGI)

Sistema de gestión web integral para **Chopper Repuestos**, desarrollado con Next.js (App Router), React 19, TypeScript, Tailwind CSS y Prisma ORM.

## Base de Datos

La base de datos del sistema opera sobre **Supabase PostgreSQL** en la nube.

### Variables de Entorno

Configurar en el archivo `.env` las cadenas de conexión provistas por Supabase:

```env
# Supabase PostgreSQL (Connection Pooler / Transaction mode - puerto 6543)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase PostgreSQL (Direct / Session mode para migraciones - puerto 5432)
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Secreto para la firma de JSON Web Tokens (JWT)
JWT_SECRET="tu-clave-secreta"
```

## Primeros Pasos

1. Instalar dependencias:
```bash
npm install
```

2. Generar el cliente de Prisma:
```bash
npx prisma generate
```

3. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo.
- `npm run build`: Compila la aplicación para producción.
- `npm run start`: Inicia el servidor de producción.
- `npm run lint`: Ejecuta el linter (ESLint).
- `npm run test`: Ejecuta los tests unitarios con Vitest.
- `npm run db:seed`: Ejecuta el seed de datos base con Prisma.
