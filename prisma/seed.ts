import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed de la base de datos...");

  // ──────────────────────────────────────────────
  // 1. Roles
  // ──────────────────────────────────────────────
  console.log("📌 Sembrando Roles...");
  const roles = [
    { nombre: "ADMINISTRADOR" },
    { nombre: "ENCARGADO_VENTAS" },
    { nombre: "ENCARGADO_STOCK" },
  ];

  const dbRoles = [];
  for (const r of roles) {
    const dbRol = await prisma.rol.upsert({
      where: { nombre: r.nombre },
      update: {},
      create: { nombre: r.nombre },
    });
    dbRoles.push(dbRol);
  }

  const adminRole = dbRoles.find((r) => r.nombre === "ADMINISTRADOR")!;
  const ventasRole = dbRoles.find((r) => r.nombre === "ENCARGADO_VENTAS")!;
  const stockRole = dbRoles.find((r) => r.nombre === "ENCARGADO_STOCK")!;

  // ──────────────────────────────────────────────
  // 2. Usuarios
  // ──────────────────────────────────────────────
  console.log("👤 Sembrando Usuarios...");
  const passwordHash = bcrypt.hashSync("1234", 10);

  const adminUser = await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      nombreCompleto: "Administrador General",
      dni: "00000001",
      correo: "admin@chopperrepuestos.com",
      telefono: "3764000001",
      rolId: adminRole.id,
    },
  });

  const ventasUser = await prisma.usuario.upsert({
    where: { username: "ventas" },
    update: {},
    create: {
      username: "ventas",
      passwordHash,
      nombreCompleto: "Carlos López",
      dni: "35123456",
      correo: "carlos@chopperrepuestos.com",
      telefono: "3764555001",
      rolId: ventasRole.id,
    },
  });

  const stockUser = await prisma.usuario.upsert({
    where: { username: "stock" },
    update: {},
    create: {
      username: "stock",
      passwordHash,
      nombreCompleto: "María García",
      dni: "36789012",
      correo: "maria@chopperrepuestos.com",
      telefono: "3764555002",
      rolId: stockRole.id,
    },
  });

  // ──────────────────────────────────────────────
  // 3. Empleados
  // ──────────────────────────────────────────────
  console.log("🏢 Sembrando Empleados...");
  await prisma.empleado.upsert({
    where: { usuarioId: adminUser.id },
    update: {},
    create: {
      nombre: "Administrador",
      apellido: "General",
      cargo: "Gerente",
      usuarioId: adminUser.id,
      activo: true,
    },
  });

  await prisma.empleado.upsert({
    where: { usuarioId: ventasUser.id },
    update: {},
    create: {
      nombre: "Carlos",
      apellido: "López",
      cargo: "Encargado de Ventas",
      usuarioId: ventasUser.id,
      activo: true,
    },
  });

  await prisma.empleado.upsert({
    where: { usuarioId: stockUser.id },
    update: {},
    create: {
      nombre: "María",
      apellido: "García",
      cargo: "Encargada de Stock",
      usuarioId: stockUser.id,
      activo: true,
    },
  });

  // ──────────────────────────────────────────────
  // 4. Clientes
  // ──────────────────────────────────────────────
  console.log("🧑‍🤝‍🧑 Sembrando Clientes...");
  const clientes = [
    { nombre: "Empresa Alfa SRL", dni: "30712345678", cuit: "30712345678", telefono: "3764555123", direccion: "Av. Corrientes 1500", email: "alfa@empresa.com" },
    { nombre: "Ricardo Gómez", dni: "20123456789", cuit: "20123456789", telefono: "3764123456", direccion: "Calle San Martín 890", email: "ricardo@correo.com" },
    { nombre: "Distribuidora El Litoral S.A.", dni: "33987654321", cuit: "33987654321", telefono: "3764888777", direccion: "Ruta Nacional 12 Km 5", email: "litoral@distri.com" },
    { nombre: "María Elena Díaz", dni: "27011223344", cuit: "27011223344", telefono: "3764999000", direccion: "Av. Uruguay 450", email: "maria@correo.com" },
    { nombre: "Ferretería Central", dni: "30654321098", cuit: "30654321098", telefono: "3764222111", direccion: "Calle Colón 2300", email: "contacto@central.com" },
  ];

  for (const c of clientes) {
    await prisma.cliente.upsert({
      where: { dni: c.dni },
      update: {},
      create: c,
    });
  }

  // ──────────────────────────────────────────────
  // 5. Proveedores
  // ──────────────────────────────────────────────
  console.log("🚚 Sembrando Proveedores...");
  const proveedores = [
    { nombre: "Motos & Repuestos del Litoral", cuit: "30111111118", telefono: "3764123456", direccion: "Av. Roque Saenz Peña 1500, Posadas", email: "contacto@motoslitoral.com.ar", contactoResponsable: "Jorge Martínez" },
    { nombre: "El Motoquero", cuit: "30222222228", telefono: "3764987654", direccion: "Av. Corrientes 2345, Posadas", email: "info@elmotoquero.com.ar", contactoResponsable: "Pedro Gutiérrez" },
    { nombre: "Posadas Motos", cuit: "30333333338", telefono: "3764567890", direccion: "Calle La Rioja 123, Posadas", email: "ventas@posadasmotos.com.ar", contactoResponsable: "Ana Rodríguez" },
    { nombre: "Ruedas del Sur", cuit: "30444444448", telefono: "3764321098", direccion: "Av. Uruguay 3456, Posadas", email: "info@ruedasdelsur.com.ar", contactoResponsable: "Luis Fernández" },
    { nombre: "Todo Moto", cuit: "30555555558", telefono: "3764876543", direccion: "Av. San Martín 100, Garupá", email: "contacto@todomoto.com.ar", contactoResponsable: "Roberto Sánchez" },
  ];

  const dbProveedores = [];
  for (const p of proveedores) {
    const dbProv = await prisma.proveedor.upsert({
      where: { cuit: p.cuit },
      update: {},
      create: p,
    });
    dbProveedores.push(dbProv);
  }

  // ──────────────────────────────────────────────
  // 6. Categorías
  // ──────────────────────────────────────────────
  console.log("📂 Sembrando Categorías...");
  const categorias = [
    { nombre: "Transmisión", activo: true },
    { nombre: "Frenos", activo: true },
    { nombre: "Eléctrico", activo: true },
    { nombre: "Neumáticos", activo: true },
    { nombre: "Lubricantes", activo: true },
    { nombre: "Motor", activo: true },
    { nombre: "Encendido", activo: true },
    { nombre: "Iluminación", activo: true },
    { nombre: "Suspensión", activo: true },
    { nombre: "Accesorios", activo: true },
  ];

  const dbCategorias = [];
  for (const cat of categorias) {
    const dbCat = await prisma.categoria.upsert({
      where: { nombre: cat.nombre },
      update: {},
      create: cat,
    });
    dbCategorias.push(dbCat);
  }

  // ──────────────────────────────────────────────
  // 7. Marcas
  // ──────────────────────────────────────────────
  console.log("🏷️  Sembrando Marcas...");
  const marcas = [
    { nombre: "Honda", activo: true },
    { nombre: "Yamaha", activo: true },
    { nombre: "Bajaj", activo: true },
    { nombre: "Suzuki", activo: true },
    { nombre: "Kawasaki", activo: true },
    { nombre: "TVS", activo: true },
    { nombre: "Motul", activo: true },
    { nombre: "Pirelli", activo: true },
    { nombre: "Genérico", activo: true },
  ];

  const dbMarcas = [];
  for (const m of marcas) {
    const dbMarca = await prisma.marca.upsert({
      where: { nombre: m.nombre },
      update: {},
      create: m,
    });
    dbMarcas.push(dbMarca);
  }

  // ──────────────────────────────────────────────
  // 8. Productos
  // ──────────────────────────────────────────────
  console.log("📦 Sembrando Productos...");
  const productos = [
    {
      nombre: "Kit de transmisión para Honda CG 150",
      categoria: "Transmisión",
      marca: "Honda",
      proveedor: "30111111118",
      precioCompra: 10500.00,
      precioVenta: 15000.00,
      cantidad: 100,
      stockMinimo: 10,
      codigo: "TRN-HON-CG150",
      imagen: null as string | null,
    },
    {
      nombre: "Pastillas de freno delantero Rouser NS200",
      categoria: "Frenos",
      marca: "Bajaj",
      proveedor: "30222222228",
      precioCompra: 5250.00,
      precioVenta: 7500.00,
      cantidad: 100,
      stockMinimo: 15,
      codigo: "FRN-BAJ-NS200",
      imagen: null as string | null,
    },
    {
      nombre: "Batería YTX7L-BS para Yamaha FZ16",
      categoria: "Eléctrico",
      marca: "Yamaha",
      proveedor: "30333333338",
      precioCompra: 18000.00,
      precioVenta: 25000.00,
      cantidad: 20,
      stockMinimo: 5,
      codigo: "ELE-YAM-FZ16",
      imagen: null as string | null,
    },
    {
      nombre: "Cubierta trasera 130/70-17 Pirelli",
      categoria: "Neumáticos",
      marca: "Pirelli",
      proveedor: "30444444448",
      precioCompra: 31500.00,
      precioVenta: 45000.00,
      cantidad: 14,
      stockMinimo: 4,
      codigo: "NEU-PIR-13070",
      imagen: null as string | null,
    },
    {
      nombre: "Aceite Motul 5100 15W-50 4T",
      categoria: "Lubricantes",
      marca: "Motul",
      proveedor: "30555555558",
      precioCompra: 8400.00,
      precioVenta: 12000.00,
      cantidad: 40,
      stockMinimo: 20,
      codigo: "LUB-MOT-5100",
      imagen: null as string | null,
    },
    {
      nombre: "Amortiguador trasero Monoshock FZ16",
      categoria: "Suspensión",
      marca: "Yamaha",
      proveedor: "30333333338",
      precioCompra: 10500.00,
      precioVenta: 15000.00,
      cantidad: 30,
      stockMinimo: 5,
      codigo: "SUS-YAM-FZ16",
      imagen: null as string | null,
    },
    {
      nombre: "Cadena 428H 120L Honda CG",
      categoria: "Transmisión",
      marca: "Honda",
      proveedor: "30111111118",
      precioCompra: 4800.00,
      precioVenta: 7000.00,
      cantidad: 60,
      stockMinimo: 10,
      codigo: "TRN-HON-CG428",
      imagen: null as string | null,
    },
    {
      nombre: "Bujía NGK CR8E",
      categoria: "Encendido",
      marca: "Genérico",
      proveedor: "30222222228",
      precioCompra: 850.00,
      precioVenta: 1400.00,
      cantidad: 200,
      stockMinimo: 30,
      codigo: "ENC-NGK-CR8E",
      imagen: null as string | null,
    },
    {
      nombre: "Faro delantero LED universal",
      categoria: "Iluminación",
      marca: "Genérico",
      proveedor: "30555555558",
      precioCompra: 6200.00,
      precioVenta: 9500.00,
      cantidad: 25,
      stockMinimo: 5,
      codigo: "ILU-LED-UNI",
      imagen: null as string | null,
    },
    {
      nombre: "Filtro de aceite Honda CG 150",
      categoria: "Motor",
      marca: "Honda",
      proveedor: "30111111118",
      precioCompra: 1800.00,
      precioVenta: 2800.00,
      cantidad: 80,
      stockMinimo: 15,
      codigo: "MOT-HON-FILT150",
      imagen: null as string | null,
    },
    {
      nombre: "Cubierta delantera 90/90-17 MRF",
      categoria: "Neumáticos",
      marca: "Genérico",
      proveedor: "30444444448",
      precioCompra: 14000.00,
      precioVenta: 20000.00,
      cantidad: 18,
      stockMinimo: 4,
      codigo: "NEU-MRF-9090",
      imagen: null as string | null,
    },
    {
      nombre: "Espejo retrovisor universal par",
      categoria: "Accesorios",
      marca: "Genérico",
      proveedor: "30555555558",
      precioCompra: 3200.00,
      precioVenta: 5000.00,
      cantidad: 50,
      stockMinimo: 10,
      codigo: "ACC-ESM-UNI",
      imagen: null as string | null,
    },
  ];

  for (const prod of productos) {
    const cat = dbCategorias.find((c) => c.nombre === prod.categoria)!;
    const prov = dbProveedores.find((p) => p.cuit === prod.proveedor)!;
    const marca = dbMarcas.find((m) => m.nombre === prod.marca)!;

    // Producto no tiene unique constraint en nombre/codigo, así que usamos findFirst + create
    const existing = await prisma.producto.findFirst({ where: { nombre: prod.nombre } });
    if (!existing) {
      await prisma.producto.create({
        data: {
          nombre: prod.nombre,
          categoriaId: cat.id,
          proveedorId: prov.id,
          marcaId: marca.id,
          precioCompra: prod.precioCompra,
          precioVenta: prod.precioVenta,
          cantidad: prod.cantidad,
          stockMinimo: prod.stockMinimo,
          codigo: prod.codigo,
          imagen: prod.imagen,
          activo: true,
        },
      });
    }
  }

  // ──────────────────────────────────────────────
  // Resumen
  // ──────────────────────────────────────────────
  console.log("");
  console.log("✅ Seed completado exitosamente!");
  console.log("═══════════════════════════════════════");
  console.log("  Roles:        3 (ADMINISTRADOR, ENCARGADO_VENTAS, ENCARGADO_STOCK)");
  console.log("  Usuarios:     3 (admin, ventas, stock) — contraseña: 1234");
  console.log("  Empleados:    3");
  console.log("  Clientes:     5");
  console.log("  Proveedores:  5");
  console.log("  Categorías:   10");
  console.log("  Marcas:       9");
  console.log("  Productos:    12");
  console.log("═══════════════════════════════════════");
  console.log("  ⚠️  Permisos: ejecutar después: npx tsx prisma/seed-permissions.ts");
  console.log("═══════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ Error al sembrar base de datos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
