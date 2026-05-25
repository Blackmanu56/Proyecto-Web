import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("Iniciando el sembrado de la base de datos (Seed)...");

  // 1. Roles (nuevos roles según requisitos de tesis)
  console.log("Sembrando Roles...");
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

  // 2. Usuarios
  console.log("Sembrando Usuarios...");
  const passwordHash = bcrypt.hashSync("1234", 10);

  // Usuario administrador principal
  const adminUser = await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: passwordHash,
      nombreCompleto: "Administrador General",
      dni: "00000001",
      correo: "admin@chopperrepuestos.com",
      telefono: "3764000001",
      rolId: adminRole.id,
    },
  });

  // Asociar empleado al admin
  await prisma.empleado.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nombre: "Administrador",
      apellido: "General",
      cargo: "Gerente",
      usuarioId: adminUser.id,
      activo: true,
    },
  });

  // Usuario encargado de ventas (demo)
  await prisma.usuario.upsert({
    where: { username: "ventas" },
    update: {},
    create: {
      username: "ventas",
      passwordHash: passwordHash,
      nombreCompleto: "Carlos López",
      dni: "35123456",
      correo: "carlos@chopperrepuestos.com",
      telefono: "3764555001",
      rolId: ventasRole.id,
    },
  });

  // Usuario encargado de stock (demo)
  await prisma.usuario.upsert({
    where: { username: "stock" },
    update: {},
    create: {
      username: "stock",
      passwordHash: passwordHash,
      nombreCompleto: "María García",
      dni: "36789012",
      correo: "maria@chopperrepuestos.com",
      telefono: "3764555002",
      rolId: stockRole.id,
    },
  });

  // 3. Clientes
  console.log("Sembrando Clientes...");
  const clientes = [
    { nombre: "Empresa Alfa SRL", dni: "30712345678", telefono: "3764555123", direccion: "Av. Corrientes 1500", email: "alfa@empresa.com" },
    { nombre: "Ricardo Gómez", dni: "20123456789", telefono: "3764123456", direccion: "Calle San Martín 890", email: "ricardo@correo.com" },
    { nombre: "Distribuidora El Litoral S.A.", dni: "33987654321", telefono: "3764888777", direccion: "Ruta Nacional 12 Km 5", email: "litoral@distri.com" },
    { nombre: "María Elena Díaz", dni: "27011223344", telefono: "3764999000", direccion: "Av. Uruguay 450", email: "maria@correo.com" },
    { nombre: "Ferretería Central", dni: "30654321098", telefono: "3764222111", direccion: "Calle Colón 2300", email: "contacto@central.com" },
  ];

  for (const c of clientes) {
    await prisma.cliente.upsert({
      where: { dni: c.dni },
      update: {},
      create: c,
    });
  }

  // 4. Proveedores
  console.log("Sembrando Proveedores...");
  const proveedores = [
    { nombre: "Motos & Repuestos del Litoral", cuit: "30111111118", telefono: "3764123456", direccion: "Av. Roque Saenz Peña 1500, Posadas", email: "contacto@motoslitoral.com.ar" },
    { nombre: "El Motoquero", cuit: "30222222228", telefono: "3764987654", direccion: "Av. Corrientes 2345, Posadas", email: "info@elmotoquero.com.ar" },
    { nombre: "Posadas Motos", cuit: "30333333338", telefono: "3764567890", direccion: "Calle La Rioja 123, Posadas", email: "ventas@posadasmotos.com.ar" },
    { nombre: "Ruedas del Sur", cuit: "30444444448", telefono: "3764321098", direccion: "Av. Uruguay 3456, Posadas", email: "info@ruedasdelsur.com.ar" },
    { nombre: "Todo Moto", cuit: "30555555558", telefono: "3764876543", direccion: "Av. San Martín 100, Garupá", email: "contacto@todomoto.com.ar" },
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

  // 5. Categorías
  console.log("Sembrando Categorías...");
  const categorias = [
    { nombre: "Transmisión" },
    { nombre: "Frenos" },
    { nombre: "Eléctrico" },
    { nombre: "Neumáticos" },
    { nombre: "Lubricantes" },
    { nombre: "Motor" },
    { nombre: "Encendido" },
    { nombre: "Iluminación" },
    { nombre: "Suspensión" },
    { nombre: "Accesorios" },
  ];

  const dbCategorías = [];
  for (const cat of categorias) {
    const dbCat = await prisma.categoria.upsert({
      where: { nombre: cat.nombre },
      update: {},
      create: cat,
    });
    dbCategorías.push(dbCat);
  }

  // 6. Productos
  console.log("Sembrando Productos...");
  const productos = [
    {
      nombre: "Kit de transmisión para Honda CG 150",
      categoria: "Transmisión",
      cuitProveedor: "30111111118",
      precioCompra: 10500.00,
      precioVenta: 15000.00,
      cantidad: 100,
      stockMinimo: 10,
    },
    {
      nombre: "Pastillas de freno delantero Rouser NS200",
      categoria: "Frenos",
      cuitProveedor: "30222222228",
      precioCompra: 5250.00,
      precioVenta: 7500.00,
      cantidad: 100,
      stockMinimo: 15,
    },
    {
      nombre: "Batería YTX7L-BS para Yamaha FZ16",
      categoria: "Eléctrico",
      cuitProveedor: "30333333338",
      precioCompra: 18000.00,
      precioVenta: 25000.00,
      cantidad: 20,
      stockMinimo: 5,
    },
    {
      nombre: "Cubierta trasera 130/70-17 Pirelli",
      categoria: "Neumáticos",
      cuitProveedor: "30444444448",
      precioCompra: 31500.00,
      precioVenta: 45000.00,
      cantidad: 14,
      stockMinimo: 4,
    },
    {
      nombre: "Aceite Motul 5100 15W-50 4T",
      categoria: "Lubricantes",
      cuitProveedor: "30555555558",
      precioCompra: 8400.00,
      precioVenta: 12000.00,
      cantidad: 40,
      stockMinimo: 20,
    },
    {
      nombre: "Amortiguador trasero Monoshock FZ16",
      categoria: "Suspensión",
      cuitProveedor: "30333333338",
      precioCompra: 10500.00,
      precioVenta: 15000.00,
      cantidad: 30,
      stockMinimo: 5,
    },
  ];

  for (const prod of productos) {
    const cat = dbCategorías.find((c) => c.nombre === prod.categoria)!;
    const prov = dbProveedores.find((p) => p.cuit === prod.cuitProveedor)!;

    await prisma.producto.create({
      data: {
        nombre: prod.nombre,
        categoriaId: cat.id,
        proveedorId: prov.id,
        precioCompra: prod.precioCompra,
        precioVenta: prod.precioVenta,
        cantidad: prod.cantidad,
        stockMinimo: prod.stockMinimo,
      },
    });
  }

  console.log("Sembrado finalizado exitosamente!");
  console.log("─────────────────────────────────");
  console.log("Usuarios creados:");
  console.log("  admin / 1234 (ADMINISTRADOR)");
  console.log("  ventas / 1234 (ENCARGADO_VENTAS)");
  console.log("  stock / 1234 (ENCARGADO_STOCK)");
  console.log("─────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("Error al sembrar base de datos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
