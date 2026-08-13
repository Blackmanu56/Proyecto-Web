import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  OrigenPagoCompra,
  PrismaClient,
  TipoCuentaFinanciera,
  TipoMovimientoFinanciero,
} from "@prisma/client";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_DESCRIPTIONS,
  serializeRoleData,
} from "../src/lib/permissions";

export const DEMO_PASSWORD = "1234";

type RoleName = keyof typeof DEFAULT_ROLE_PERMISSIONS;
type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA_DEBITO" | "TARJETA_CREDITO";
type PurchaseKind = "EFECTIVO" | "TRANSFERENCIA" | "MIXTO";
type PurchasePaymentMethod = "EFECTIVO_CAJA" | "TRANSFERENCIA_BANCARIA";

type DemoRoleSeed = {
  nombre: RoleName;
  permisos: string;
};

type DemoUserSeed = {
  username: string;
  nombreCompleto: string;
  dni: string;
  correo: string;
  telefono: string;
  rol: RoleName;
  empleado: {
    nombre: string;
    apellido: string;
    cargo: string;
  };
};

type DemoClientSeed = {
  dni: string;
  nombre: string;
  cuit: string;
  telefono: string;
  direccion: string;
  email: string;
  activo?: boolean;
};

type DemoSupplierSeed = {
  cuit: string;
  nombre: string;
  telefono: string;
  direccion: string;
  email: string;
  contactoResponsable: string;
  activo?: boolean;
};

type DemoCategorySeed = {
  nombre: string;
  activo?: boolean;
};

type DemoBrandSeed = {
  nombre: string;
  activo?: boolean;
};

type DemoProductSeed = {
  key: string;
  nombre: string;
  categoria: string;
  marca: string;
  proveedorCuit: string;
  precioCompra: number;
  precioVenta: number;
  initialQuantity: number;
  stockMinimo: number;
  codigo: string;
  activo?: boolean;
  imagen?: string | null;
};

type DemoCajaSeed = {
  key: string;
  usuario: string;
  fechaApertura: string;
  montoInicial: number;
  estado: "ABIERTA" | "CERRADA";
  fechaCierre?: string;
  observacionCierre?: string;
};

type DemoSaleDetailSeed = {
  productKey: string;
  quantity: number;
};

type DemoSaleSeed = {
  key: string;
  cajaKey: string;
  fecha: string;
  clienteDni: string;
  usuario: string;
  metodoPago: PaymentMethod;
  comprobanteNumero: number;
  cuotas?: number;
  details: DemoSaleDetailSeed[];
};

type DemoPurchaseDetailSeed = {
  productKey: string;
  quantity: number;
};

type DemoPurchasePaymentSeed = {
  medio: PurchasePaymentMethod;
  monto: number;
  observacion?: string;
};

type DemoPurchaseSeed = {
  key: string;
  kind: PurchaseKind;
  cajaKey?: string;
  fecha: string;
  proveedorCuit: string;
  usuario: string;
  origenPago: OrigenPagoCompra;
  details: DemoPurchaseDetailSeed[];
  pagos: DemoPurchasePaymentSeed[];
};

type DemoExpenseSeed = {
  cajaKey: string;
  fecha: string;
  usuario: string;
  descripcion: string;
  monto: number;
};

type DemoFavoriteSeed = {
  usuario: string;
  productKey: string;
};

type DemoHistorySeed = {
  productKey: string;
  usuario: string;
  fecha: string;
  motivo:
    | "VENCIDO"
    | "DEFECTUOSO"
    | "DISCONTINUADO"
    | "BAJA_TEMPORAL"
    | "YA_NO_SE_COMERCIALIZA"
    | "OTRO"
    | "REACTIVACION";
  observacion: string;
};

type DemoAccountSeed = {
  nombre: string;
  tipo: TipoCuentaFinanciera;
  esPrincipal: boolean;
  activa: boolean;
  saldoInicial: number;
};

export const FINANCIAL_ACCOUNT_DEMOS: readonly DemoAccountSeed[] = [
  {
    nombre: "Banco principal",
    tipo: TipoCuentaFinanciera.BANCO,
    esPrincipal: true,
    activa: true,
    saldoInicial: 0,
  },
  {
    nombre: "Tarjetas por acreditar",
    tipo: TipoCuentaFinanciera.POR_ACREDITAR,
    esPrincipal: false,
    activa: true,
    saldoInicial: 0,
  },
] as const;

const ROLE_NAMES: readonly RoleName[] = [
  "ADMINISTRADOR",
  "ENCARGADO_VENTAS",
  "ENCARGADO_STOCK",
] as const;

const USER_DEMOS: readonly DemoUserSeed[] = [
  {
    username: "admin",
    nombreCompleto: "Administrador General",
    dni: "00000001",
    correo: "admin@chopperrepuestos.com",
    telefono: "3764000001",
    rol: "ADMINISTRADOR",
    empleado: { nombre: "Administrador", apellido: "General", cargo: "Gerente" },
  },
  {
    username: "ventas",
    nombreCompleto: "Carlos López",
    dni: "35123456",
    correo: "carlos@chopperrepuestos.com",
    telefono: "3764555001",
    rol: "ENCARGADO_VENTAS",
    empleado: { nombre: "Carlos", apellido: "López", cargo: "Encargado de Ventas" },
  },
  {
    username: "stock",
    nombreCompleto: "María García",
    dni: "36789012",
    correo: "maria@chopperrepuestos.com",
    telefono: "3764555002",
    rol: "ENCARGADO_STOCK",
    empleado: { nombre: "María", apellido: "García", cargo: "Encargada de Stock" },
  },
] as const;

const CLIENT_DEMOS: readonly DemoClientSeed[] = [
  {
    nombre: "Empresa Alfa SRL",
    dni: "30712345678",
    cuit: "30712345678",
    telefono: "3764555123",
    direccion: "Av. Corrientes 1500, Posadas",
    email: "alfa@empresa.com",
  },
  {
    nombre: "Ricardo Gómez",
    dni: "20123456789",
    cuit: "20123456789",
    telefono: "3764123456",
    direccion: "Calle San Martín 890, Posadas",
    email: "ricardo@correo.com",
  },
  {
    nombre: "Distribuidora El Litoral S.A.",
    dni: "33987654321",
    cuit: "33987654321",
    telefono: "3764888777",
    direccion: "Ruta Nacional 12 Km 5, Posadas",
    email: "litoral@distri.com",
  },
  {
    nombre: "María Elena Díaz",
    dni: "27011223344",
    cuit: "27011223344",
    telefono: "3764999000",
    direccion: "Av. Uruguay 450, Posadas",
    email: "maria@correo.com",
  },
  {
    nombre: "Ferretería Central",
    dni: "30654321098",
    cuit: "30654321098",
    telefono: "3764222111",
    direccion: "Calle Colón 2300, Posadas",
    email: "contacto@central.com",
  },
] as const;

const SUPPLIER_DEMOS: readonly DemoSupplierSeed[] = [
  {
    nombre: "Motos & Repuestos del Litoral",
    cuit: "30111111118",
    telefono: "3764123456",
    direccion: "Av. Roque Sáenz Peña 1500, Posadas",
    email: "contacto@motoslitoral.com.ar",
    contactoResponsable: "Jorge Martínez",
  },
  {
    nombre: "El Motoquero",
    cuit: "30222222228",
    telefono: "3764987654",
    direccion: "Av. Corrientes 2345, Posadas",
    email: "info@elmotoquero.com.ar",
    contactoResponsable: "Pedro Gutiérrez",
  },
  {
    nombre: "Posadas Motos",
    cuit: "30333333338",
    telefono: "3764567890",
    direccion: "Calle La Rioja 123, Posadas",
    email: "ventas@posadasmotos.com.ar",
    contactoResponsable: "Ana Rodríguez",
  },
  {
    nombre: "Ruedas del Sur",
    cuit: "30444444448",
    telefono: "3764321098",
    direccion: "Av. Uruguay 3456, Posadas",
    email: "info@ruedasdelsur.com.ar",
    contactoResponsable: "Luis Fernández",
  },
  {
    nombre: "Todo Moto",
    cuit: "30555555558",
    telefono: "3764876543",
    direccion: "Av. San Martín 100, Garupá",
    email: "contacto@todomoto.com.ar",
    contactoResponsable: "Roberto Sánchez",
  },
] as const;

const CATEGORY_DEMOS: readonly DemoCategorySeed[] = [
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
] as const;

const BRAND_DEMOS: readonly DemoBrandSeed[] = [
  { nombre: "Honda" },
  { nombre: "Yamaha" },
  { nombre: "Bajaj" },
  { nombre: "Suzuki" },
  { nombre: "Kawasaki" },
  { nombre: "Motul" },
  { nombre: "Pirelli" },
  { nombre: "MRF" },
  { nombre: "Genérico" },
] as const;

const SEED_PRODUCT_IMAGE_BASE_PATH = "/seed/productos";

function seedProductImage(filename: string) {
  return `${SEED_PRODUCT_IMAGE_BASE_PATH}/${filename}`;
}

export const PRODUCT_DEMOS: readonly DemoProductSeed[] = [
  {
    key: "kit-transmision-cg150",
    nombre: "Kit de transmisión para Honda CG 150",
    categoria: "Transmisión",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 10500,
    precioVenta: 15000,
    initialQuantity: 8,
    stockMinimo: 4,
    codigo: "TRN-HON-CG150",
    imagen: seedProductImage("kit-transmision-cg150.webp"),
  },
  {
    key: "pastillas-ns200",
    nombre: "Pastillas de freno delantero Rouser NS200",
    categoria: "Frenos",
    marca: "Bajaj",
    proveedorCuit: "30222222228",
    precioCompra: 5250,
    precioVenta: 7500,
    initialQuantity: 6,
    stockMinimo: 5,
    codigo: "FRN-BAJ-NS200",
    imagen: seedProductImage("pastillas-ns200.webp"),
  },
  {
    key: "bateria-fz16",
    nombre: "Batería YTX7L-BS para Yamaha FZ16",
    categoria: "Eléctrico",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 18000,
    precioVenta: 25000,
    initialQuantity: 3,
    stockMinimo: 3,
    codigo: "ELE-YAM-FZ16",
    imagen: seedProductImage("bateria-fz16.webp"),
  },
  {
    key: "cubierta-pirelli-130-70-17",
    nombre: "Cubierta trasera 130/70-17 Pirelli",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorCuit: "30444444448",
    precioCompra: 31500,
    precioVenta: 45000,
    initialQuantity: 5,
    stockMinimo: 2,
    codigo: "NEU-PIR-13070",
    imagen: seedProductImage("cubierta-pirelli-130-70-17.webp"),
  },
  {
    key: "aceite-motul-5100",
    nombre: "Aceite Motul 5100 15W-50 4T",
    categoria: "Lubricantes",
    marca: "Motul",
    proveedorCuit: "30555555558",
    precioCompra: 8400,
    precioVenta: 12000,
    initialQuantity: 10,
    stockMinimo: 6,
    codigo: "LUB-MOT-5100",
  },
  {
    key: "amortiguador-fz16",
    nombre: "Amortiguador trasero Monoshock FZ16",
    categoria: "Suspensión",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 10500,
    precioVenta: 15000,
    initialQuantity: 2,
    stockMinimo: 2,
    codigo: "SUS-YAM-FZ16",
    imagen: seedProductImage("amortiguador-fz16.webp"),
  },
  {
    key: "cadena-428h-cg",
    nombre: "Cadena 428H 120L Honda CG",
    categoria: "Transmisión",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 4800,
    precioVenta: 7000,
    initialQuantity: 4,
    stockMinimo: 2,
    codigo: "TRN-HON-CG428",
  },
  {
    key: "bujia-ngk-cr8e",
    nombre: "Bujía NGK CR8E",
    categoria: "Encendido",
    marca: "Genérico",
    proveedorCuit: "30222222228",
    precioCompra: 850,
    precioVenta: 1400,
    initialQuantity: 20,
    stockMinimo: 10,
    codigo: "ENC-NGK-CR8E",
  },
  {
    key: "faro-led-universal",
    nombre: "Faro delantero LED universal",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 6200,
    precioVenta: 9500,
    initialQuantity: 1,
    stockMinimo: 1,
    codigo: "ILU-LED-UNI",
  },
  {
    key: "filtro-aceite-cg150",
    nombre: "Filtro de aceite Honda CG 150",
    categoria: "Motor",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 1800,
    precioVenta: 2800,
    initialQuantity: 7,
    stockMinimo: 3,
    codigo: "MOT-HON-FILT150",
  },
  {
    key: "cubierta-delantera-mrf",
    nombre: "Cubierta delantera 90/90-17 MRF",
    categoria: "Neumáticos",
    marca: "MRF",
    proveedorCuit: "30444444448",
    precioCompra: 14000,
    precioVenta: 20000,
    initialQuantity: 4,
    stockMinimo: 4,
    codigo: "NEU-MRF-9090",
  },
  {
    key: "espejo-universal-par",
    nombre: "Espejo retrovisor universal par",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 3200,
    precioVenta: 5000,
    initialQuantity: 6,
    stockMinimo: 3,
    codigo: "ACC-ESP-UNI",
  },
  {
    key: "carenado-lateral-usado",
    nombre: "Carenado lateral usado CG 150",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorCuit: "30111111118",
    precioCompra: 6000,
    precioVenta: 9000,
    initialQuantity: 0,
    stockMinimo: 0,
    codigo: "ACC-CAR-USADO",
    activo: false,
  },
] as const;

const CAJA_DEMOS: readonly DemoCajaSeed[] = [
  {
    key: "caja-historica-1",
    usuario: "ventas",
    fechaApertura: "2026-08-10T09:00:00-03:00",
    montoInicial: 120000,
    estado: "CERRADA",
    fechaCierre: "2026-08-10T18:00:00-03:00",
    observacionCierre: "Turno mañana y tarde sin diferencias.",
  },
  {
    key: "caja-historica-2",
    usuario: "ventas",
    fechaApertura: "2026-08-11T09:15:00-03:00",
    montoInicial: 90000,
    estado: "CERRADA",
    fechaCierre: "2026-08-11T17:45:00-03:00",
    observacionCierre: "Cierre correcto luego de reposición en efectivo.",
  },
  {
    key: "caja-activa-demo",
    usuario: "admin",
    fechaApertura: "2026-08-13T00:21:00-03:00",
    montoInicial: 100000,
    estado: "ABIERTA",
  },
] as const;

export const SALE_DEMOS: readonly DemoSaleSeed[] = [
  {
    key: "venta-historica-efectivo",
    cajaKey: "caja-historica-1",
    fecha: "2026-08-10T10:15:00-03:00",
    clienteDni: "20123456789",
    usuario: "ventas",
    metodoPago: "EFECTIVO",
    comprobanteNumero: 1001,
    details: [
      { productKey: "kit-transmision-cg150", quantity: 1 },
      { productKey: "bujia-ngk-cr8e", quantity: 2 },
    ],
  },
  {
    key: "venta-historica-efectivo-2",
    cajaKey: "caja-historica-2",
    fecha: "2026-08-11T11:40:00-03:00",
    clienteDni: "30712345678",
    usuario: "ventas",
    metodoPago: "EFECTIVO",
    comprobanteNumero: 1002,
    details: [{ productKey: "cubierta-pirelli-130-70-17", quantity: 1 }],
  },
  {
    key: "venta-actual-efectivo",
    cajaKey: "caja-activa-demo",
    fecha: "2026-08-13T01:05:00-03:00",
    clienteDni: "33987654321",
    usuario: "admin",
    metodoPago: "EFECTIVO",
    comprobanteNumero: 1003,
    details: [
      { productKey: "faro-led-universal", quantity: 1 },
      { productKey: "bujia-ngk-cr8e", quantity: 6 },
    ],
  },
  {
    key: "venta-actual-transferencia",
    cajaKey: "caja-activa-demo",
    fecha: "2026-08-13T01:08:00-03:00",
    clienteDni: "27011223344",
    usuario: "admin",
    metodoPago: "TRANSFERENCIA",
    comprobanteNumero: 1004,
    details: [
      { productKey: "filtro-aceite-cg150", quantity: 2 },
      { productKey: "aceite-motul-5100", quantity: 2 },
    ],
  },
  {
    key: "venta-actual-debito",
    cajaKey: "caja-activa-demo",
    fecha: "2026-08-13T01:10:00-03:00",
    clienteDni: "30654321098",
    usuario: "admin",
    metodoPago: "TARJETA_DEBITO",
    comprobanteNumero: 1005,
    details: [{ productKey: "pastillas-ns200", quantity: 2 }],
  },
  {
    key: "venta-actual-credito",
    cajaKey: "caja-activa-demo",
    fecha: "2026-08-13T01:12:00-03:00",
    clienteDni: "30712345678",
    usuario: "admin",
    metodoPago: "TARJETA_CREDITO",
    comprobanteNumero: 1006,
    cuotas: 3,
    details: [{ productKey: "cadena-428h-cg", quantity: 1 }],
  },
] as const;

export const REPOSICION_DEMOS: readonly DemoPurchaseSeed[] = [
  {
    key: "reposicion-efectivo-historica",
    kind: "EFECTIVO",
    cajaKey: "caja-historica-2",
    fecha: "2026-08-11T14:20:00-03:00",
    proveedorCuit: "30111111118",
    usuario: "stock",
    origenPago: OrigenPagoCompra.EFECTIVO_CAJA,
    details: [{ productKey: "kit-transmision-cg150", quantity: 4 }],
    pagos: [{ medio: "EFECTIVO_CAJA", monto: 42000 }],
  },
  {
    key: "reposicion-transferencia-actual",
    kind: "TRANSFERENCIA",
    fecha: "2026-08-13T00:50:00-03:00",
    proveedorCuit: "30222222228",
    usuario: "stock",
    origenPago: OrigenPagoCompra.TRANSFERENCIA_BANCARIA,
    details: [
      { productKey: "pastillas-ns200", quantity: 4 },
      { productKey: "cadena-428h-cg", quantity: 3 },
    ],
    pagos: [{ medio: "TRANSFERENCIA_BANCARIA", monto: 35400 }],
  },
  {
    key: "reposicion-mixta-actual",
    kind: "MIXTO",
    cajaKey: "caja-activa-demo",
    fecha: "2026-08-13T00:58:00-03:00",
    proveedorCuit: "30333333338",
    usuario: "stock",
    origenPago: OrigenPagoCompra.TRANSFERENCIA_BANCARIA,
    details: [{ productKey: "amortiguador-fz16", quantity: 2 }],
    pagos: [
      { medio: "EFECTIVO_CAJA", monto: 8000, observacion: "Parte abonada desde Caja" },
      {
        medio: "TRANSFERENCIA_BANCARIA",
        monto: 13000,
        observacion: "Saldo abonado por transferencia",
      },
    ],
  },
] as const;

const EXPENSE_DEMOS: readonly DemoExpenseSeed[] = [
  {
    cajaKey: "caja-historica-1",
    fecha: "2026-08-10T16:45:00-03:00",
    usuario: "ventas",
    descripcion: "Insumos de limpieza",
    monto: 5000,
  },
  {
    cajaKey: "caja-activa-demo",
    fecha: "2026-08-13T01:20:00-03:00",
    usuario: "admin",
    descripcion: "Viáticos de cadete",
    monto: 2000,
  },
] as const;

const FAVORITE_DEMOS: readonly DemoFavoriteSeed[] = [
  { usuario: "admin", productKey: "kit-transmision-cg150" },
  { usuario: "admin", productKey: "bateria-fz16" },
  { usuario: "ventas", productKey: "pastillas-ns200" },
] as const;

const HISTORY_DEMOS: readonly DemoHistorySeed[] = [
  {
    productKey: "carenado-lateral-usado",
    usuario: "stock",
    fecha: "2026-08-09T11:30:00-03:00",
    motivo: "DISCONTINUADO",
    observacion: "Se dejó fuera del catálogo por desgaste y baja rotación.",
  },
] as const;

const BANK_BOOTSTRAP = {
  fecha: "2026-08-09T08:00:00-03:00",
  usuario: "admin",
  descripcion: "Saldo inicial Banco",
  monto: 500000,
  referencia: "SEED-BANCO-INICIAL",
} as const;

const PRODUCT_BY_KEY = new Map(PRODUCT_DEMOS.map((product) => [product.key, product]));

function getProductOrThrow(productKey: string) {
  const product = PRODUCT_BY_KEY.get(productKey);
  if (!product) {
    throw new Error(`Producto demo no encontrado: ${productKey}`);
  }
  return product;
}

function sumSaleTotal(sale: DemoSaleSeed) {
  return sale.details.reduce((total, detail) => {
    const product = getProductOrThrow(detail.productKey);
    return total + product.precioVenta * detail.quantity;
  }, 0);
}

function sumPurchaseTotal(purchase: DemoPurchaseSeed) {
  return purchase.details.reduce((total, detail) => {
    const product = getProductOrThrow(detail.productKey);
    return total + product.precioCompra * detail.quantity;
  }, 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);
}

export function buildRoleSeedData(): DemoRoleSeed[] {
  return ROLE_NAMES.map((nombre) => ({
    nombre,
    permisos: serializeRoleData({
      activo: true,
      descripcion: ROLE_DESCRIPTIONS[nombre],
      permisos: DEFAULT_ROLE_PERMISSIONS[nombre],
    }),
  }));
}

export function getSeedInvariantErrors(): string[] {
  const errors: string[] = [];

  const accountNames = FINANCIAL_ACCOUNT_DEMOS.map((account) => account.nombre);
  if (new Set(accountNames).size !== accountNames.length) {
    errors.push("Las cuentas financieras demo tienen nombres duplicados.");
  }

  const bancosPrincipales = FINANCIAL_ACCOUNT_DEMOS.filter(
    (account) => account.tipo === TipoCuentaFinanciera.BANCO && account.esPrincipal
  );
  if (bancosPrincipales.length !== 1) {
    errors.push("Debe existir exactamente un Banco principal demo.");
  }

  const porAcreditar = FINANCIAL_ACCOUNT_DEMOS.filter(
    (account) => account.tipo === TipoCuentaFinanciera.POR_ACREDITAR
  );
  if (porAcreditar.length !== 1) {
    errors.push("Debe existir exactamente una cuenta demo de Tarjetas por acreditar.");
  }

  for (const sale of SALE_DEMOS) {
    const total = sumSaleTotal(sale);
    if (total <= 0) {
      errors.push(`La venta ${sale.key} debe tener total positivo.`);
    }
  }

  for (const purchase of REPOSICION_DEMOS) {
    const total = sumPurchaseTotal(purchase);
    const pagos = purchase.pagos.reduce((sum, payment) => sum + payment.monto, 0);
    if (Math.abs(total - pagos) > 0.01) {
      errors.push(`La reposición ${purchase.key} no coincide entre total y pagos.`);
    }
  }

  const stockBalance = new Map<string, number>();
  PRODUCT_DEMOS.forEach((product) => stockBalance.set(product.key, product.initialQuantity));
  SALE_DEMOS.forEach((sale) => {
    sale.details.forEach((detail) => {
      stockBalance.set(detail.productKey, (stockBalance.get(detail.productKey) ?? 0) - detail.quantity);
    });
  });
  REPOSICION_DEMOS.forEach((purchase) => {
    purchase.details.forEach((detail) => {
      stockBalance.set(detail.productKey, (stockBalance.get(detail.productKey) ?? 0) + detail.quantity);
    });
  });

  stockBalance.forEach((quantity, productKey) => {
    if (quantity < 0) {
      errors.push(`El stock final del producto ${productKey} queda negativo.`);
    }
  });

  for (const product of PRODUCT_DEMOS) {
    if (!product.imagen) continue;

    if (/^[A-Za-z]:\\/.test(product.imagen)) {
      errors.push(`El producto ${product.key} usa una ruta absoluta local para imagen.`);
      continue;
    }

    if (!product.imagen.startsWith(`${SEED_PRODUCT_IMAGE_BASE_PATH}/`)) {
      errors.push(`El producto ${product.key} debe usar assets demo bajo ${SEED_PRODUCT_IMAGE_BASE_PATH}.`);
      continue;
    }

    const assetPath = path.join(process.cwd(), "public", product.imagen.replace(/^\//, ""));
    if (!existsSync(assetPath)) {
      errors.push(`Falta el asset demo para ${product.key}: ${product.imagen}`);
    }
  }

  return errors;
}

function assertSeedInvariants() {
  const errors = getSeedInvariantErrors();
  if (errors.length > 0) {
    throw new Error(`Dataset demo inválido:\n- ${errors.join("\n- ")}`);
  }
}

function buildPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

function isMainModule() {
  return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

type SeedReferences = {
  roles: Map<RoleName, { id: number }>;
  users: Map<string, { id: number; username: string }>;
  clients: Map<string, { id: number }>;
  suppliers: Map<string, { id: number }>;
  categories: Map<string, { id: number }>;
  brands: Map<string, { id: number }>;
  products: Map<string, { id: number; cantidad: number; precioCompra: number; precioVenta: number }>;
  accounts: {
    bancoPrincipal: { id: number; nombre: string };
    porAcreditar: { id: number; nombre: string };
  };
};

async function seedMasterData(prisma: PrismaClient, freshOperationalState: boolean): Promise<SeedReferences> {
  console.log("📌 Sembrando roles y permisos...");
  const roles = new Map<RoleName, { id: number }>();
  for (const roleSeed of buildRoleSeedData()) {
    const role = await prisma.rol.upsert({
      where: { nombre: roleSeed.nombre },
      update: { permisos: roleSeed.permisos },
      create: { nombre: roleSeed.nombre, permisos: roleSeed.permisos },
      select: { id: true },
    });
    roles.set(roleSeed.nombre, role);
  }

  console.log("👤 Sembrando usuarios y empleados...");
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const users = new Map<string, { id: number; username: string }>();
  for (const userSeed of USER_DEMOS) {
    const role = roles.get(userSeed.rol);
    if (!role) throw new Error(`Rol no encontrado para ${userSeed.username}`);

    const user = await prisma.usuario.upsert({
      where: { username: userSeed.username },
      update: {
        passwordHash,
        nombreCompleto: userSeed.nombreCompleto,
        dni: userSeed.dni,
        correo: userSeed.correo,
        telefono: userSeed.telefono,
        activo: true,
        rolId: role.id,
      },
      create: {
        username: userSeed.username,
        passwordHash,
        nombreCompleto: userSeed.nombreCompleto,
        dni: userSeed.dni,
        correo: userSeed.correo,
        telefono: userSeed.telefono,
        activo: true,
        rolId: role.id,
      },
      select: { id: true, username: true },
    });

    await prisma.empleado.upsert({
      where: { usuarioId: user.id },
      update: {
        nombre: userSeed.empleado.nombre,
        apellido: userSeed.empleado.apellido,
        cargo: userSeed.empleado.cargo,
        activo: true,
      },
      create: {
        nombre: userSeed.empleado.nombre,
        apellido: userSeed.empleado.apellido,
        cargo: userSeed.empleado.cargo,
        activo: true,
        usuarioId: user.id,
      },
    });

    users.set(user.username, user);
  }

  console.log("🧑‍🤝‍🧑 Sembrando clientes...");
  const clients = new Map<string, { id: number }>();
  for (const clientSeed of CLIENT_DEMOS) {
    const client = await prisma.cliente.upsert({
      where: { dni: clientSeed.dni },
      update: {},
      create: {
        ...clientSeed,
        activo: clientSeed.activo ?? true,
      },
      select: { id: true },
    });
    clients.set(clientSeed.dni, client);
  }

  console.log("🚚 Sembrando proveedores...");
  const suppliers = new Map<string, { id: number }>();
  for (const supplierSeed of SUPPLIER_DEMOS) {
    const supplier = await prisma.proveedor.upsert({
      where: { cuit: supplierSeed.cuit },
      update: {},
      create: {
        ...supplierSeed,
        activo: supplierSeed.activo ?? true,
      },
      select: { id: true },
    });
    suppliers.set(supplierSeed.cuit, supplier);
  }

  console.log("📂 Sembrando categorías...");
  const categories = new Map<string, { id: number }>();
  for (const categorySeed of CATEGORY_DEMOS) {
    const category = await prisma.categoria.upsert({
      where: { nombre: categorySeed.nombre },
      update: {},
      create: { nombre: categorySeed.nombre, activo: categorySeed.activo ?? true },
      select: { id: true },
    });
    categories.set(categorySeed.nombre, category);
  }

  console.log("🏷️ Sembrando marcas...");
  const brands = new Map<string, { id: number }>();
  for (const brandSeed of BRAND_DEMOS) {
    const brand = await prisma.marca.upsert({
      where: { nombre: brandSeed.nombre },
      update: {},
      create: { nombre: brandSeed.nombre, activo: brandSeed.activo ?? true },
      select: { id: true },
    });
    brands.set(brandSeed.nombre, brand);
  }

  console.log("🏦 Sembrando cuentas financieras...");
  for (const accountSeed of FINANCIAL_ACCOUNT_DEMOS) {
    const existing = await prisma.cuentaFinanciera.findFirst({
      where: { nombre: accountSeed.nombre, tipo: accountSeed.tipo },
      select: { id: true },
    });

    if (existing) {
      await prisma.cuentaFinanciera.update({
        where: { id: existing.id },
        data: {
          activa: accountSeed.activa,
          esPrincipal: accountSeed.esPrincipal,
          saldoInicial: accountSeed.saldoInicial,
        },
      });
      continue;
    }

    await prisma.cuentaFinanciera.create({
      data: {
        nombre: accountSeed.nombre,
        tipo: accountSeed.tipo,
        esPrincipal: accountSeed.esPrincipal,
        activa: accountSeed.activa,
        saldoInicial: accountSeed.saldoInicial,
      },
    });
  }

  const bancoPrincipal = await prisma.cuentaFinanciera.findFirst({
    where: { tipo: TipoCuentaFinanciera.BANCO, esPrincipal: true, activa: true },
    select: { id: true, nombre: true },
  });
  const porAcreditar = await prisma.cuentaFinanciera.findFirst({
    where: { tipo: TipoCuentaFinanciera.POR_ACREDITAR, activa: true },
    select: { id: true, nombre: true },
  });

  if (!bancoPrincipal || !porAcreditar) {
    throw new Error("No se pudieron resolver las cuentas financieras demo.");
  }

  console.log("📦 Sembrando productos...");
  const products = new Map<string, { id: number; cantidad: number; precioCompra: number; precioVenta: number }>();
  for (const productSeed of PRODUCT_DEMOS) {
    const category = categories.get(productSeed.categoria);
    const brand = brands.get(productSeed.marca);
    const supplier = suppliers.get(productSeed.proveedorCuit);

    if (!category || !brand || !supplier) {
      throw new Error(`Dependencias faltantes para producto ${productSeed.key}`);
    }

    const existing = await prisma.producto.findFirst({
      where: { nombre: productSeed.nombre },
      select: { id: true, cantidad: true, precioCompra: true, precioVenta: true },
    });

    const product = existing
      ? await prisma.producto.update({
          where: { id: existing.id },
          data: freshOperationalState
            ? {
                marca: productSeed.marca,
                marcaId: brand.id,
                categoriaId: category.id,
                proveedorId: supplier.id,
                precioCompra: productSeed.precioCompra,
                precioVenta: productSeed.precioVenta,
                stockMinimo: productSeed.stockMinimo,
                codigo: productSeed.codigo,
                cantidad: productSeed.initialQuantity,
                activo: productSeed.activo ?? true,
                imagen: productSeed.imagen ?? null,
              }
            : {
                marca: productSeed.marca,
                marcaId: brand.id,
                categoriaId: category.id,
                proveedorId: supplier.id,
                precioCompra: productSeed.precioCompra,
                precioVenta: productSeed.precioVenta,
                stockMinimo: productSeed.stockMinimo,
                codigo: productSeed.codigo,
                activo: productSeed.activo ?? true,
                imagen: productSeed.imagen ?? null,
              },
          select: { id: true, cantidad: true, precioCompra: true, precioVenta: true },
        })
      : await prisma.producto.create({
          data: {
            nombre: productSeed.nombre,
            categoriaId: category.id,
            proveedorId: supplier.id,
            precioCompra: productSeed.precioCompra,
            precioVenta: productSeed.precioVenta,
            cantidad: productSeed.initialQuantity,
            stockMinimo: productSeed.stockMinimo,
            codigo: productSeed.codigo,
            imagen: productSeed.imagen ?? null,
            activo: productSeed.activo ?? true,
            marca: productSeed.marca,
            marcaId: brand.id,
          },
          select: { id: true, cantidad: true, precioCompra: true, precioVenta: true },
        });

    products.set(productSeed.key, product);
  }

  return {
    roles,
    users,
    clients,
    suppliers,
    categories,
    brands,
    products,
    accounts: {
      bancoPrincipal,
      porAcreditar,
    },
  };
}

async function createOpeningMovement(prisma: PrismaClient, cajaId: number, usuarioId: number, fecha: string, montoInicial: number) {
  await prisma.movimientoCaja.create({
    data: {
      cajaId,
      usuarioId,
      tipo: "INGRESO",
      monto: montoInicial,
      descripcion: "Saldo inicial de apertura de caja",
      fecha: new Date(fecha),
    },
  });
}

async function createCajaDemo(prisma: PrismaClient, cajaSeed: DemoCajaSeed, refs: SeedReferences) {
  const user = refs.users.get(cajaSeed.usuario);
  if (!user) throw new Error(`Usuario demo no encontrado para caja ${cajaSeed.key}`);

  const caja = await prisma.caja.create({
    data: {
      usuarioId: user.id,
      fechaApertura: new Date(cajaSeed.fechaApertura),
      montoInicial: cajaSeed.montoInicial,
      totalVentas: 0,
      gastosManuales: 0,
      estado: "ABIERTA",
      fechaCierre: null,
      totalContado: null,
      observacionCierre: null,
    },
    select: { id: true },
  });

  await createOpeningMovement(prisma, caja.id, user.id, cajaSeed.fechaApertura, cajaSeed.montoInicial);

  return caja;
}

function getCajaMovementDescription(sale: DemoSaleSeed) {
  return `FACTURA C N° ${sale.comprobanteNumero} - ${sale.metodoPago}`;
}

function getFinancialSaleDescription(sale: DemoSaleSeed) {
  return `FACTURA C N° ${sale.comprobanteNumero}`;
}

function getPurchaseDescription(purchase: DemoPurchaseSeed) {
  const firstDetail = purchase.details[0];
  const firstProduct = getProductOrThrow(firstDetail.productKey);
  return `Reposición - ${firstProduct.nombre}`;
}

async function createSaleDemo(prisma: PrismaClient, sale: DemoSaleSeed, refs: SeedReferences, cajaIds: Map<string, number>) {
  const client = refs.clients.get(sale.clienteDni);
  const user = refs.users.get(sale.usuario);
  const cajaId = cajaIds.get(sale.cajaKey);

  if (!client || !user || !cajaId) {
    throw new Error(`Referencias faltantes para la venta ${sale.key}`);
  }

  const total = sumSaleTotal(sale);
  const venta = await prisma.venta.create({
    data: {
      clienteId: client.id,
      usuarioId: user.id,
      total,
      fecha: new Date(sale.fecha),
      metodoPago: sale.metodoPago,
      tipoComprobante: "FACTURA_C",
      cuotas: sale.cuotas ?? null,
      detalles: {
        create: sale.details.map((detail) => {
          const product = getProductOrThrow(detail.productKey);
          return {
            productoId: refs.products.get(detail.productKey)!.id,
            cantidad: detail.quantity,
            precioUnitario: product.precioVenta,
            subtotal: product.precioVenta * detail.quantity,
          };
        }),
      },
    },
    select: { id: true },
  });

  for (const detail of sale.details) {
    await prisma.producto.update({
      where: { id: refs.products.get(detail.productKey)!.id },
      data: { cantidad: { decrement: detail.quantity } },
    });
  }

  await prisma.caja.update({
    where: { id: cajaId },
    data: {
      totalVentas: { increment: total },
    },
  });

  if (sale.metodoPago === "EFECTIVO") {
    await prisma.movimientoCaja.create({
      data: {
        cajaId,
        usuarioId: user.id,
        ventaId: venta.id,
        tipo: "INGRESO",
        monto: total,
        descripcion: getCajaMovementDescription(sale),
        fecha: new Date(sale.fecha),
      },
    });
    return;
  }

  const destination =
    sale.metodoPago === "TARJETA_CREDITO"
      ? refs.accounts.porAcreditar.id
      : refs.accounts.bancoPrincipal.id;

  await prisma.movimientoFinanciero.create({
    data: {
      cuentaFinancieraId: destination,
      tipo: TipoMovimientoFinanciero.INGRESO,
      monto: total,
      fecha: new Date(sale.fecha),
      descripcion: getFinancialSaleDescription(sale),
      usuarioId: user.id,
      ventaId: venta.id,
      referencia: `FACTURA-C-${sale.comprobanteNumero}`,
    },
  });
}

async function createPurchaseDemo(prisma: PrismaClient, purchase: DemoPurchaseSeed, refs: SeedReferences, cajaIds: Map<string, number>) {
  const supplier = refs.suppliers.get(purchase.proveedorCuit);
  const user = refs.users.get(purchase.usuario);
  if (!supplier || !user) {
    throw new Error(`Referencias faltantes para la reposición ${purchase.key}`);
  }

  const total = sumPurchaseTotal(purchase);
  const compra = await prisma.compra.create({
    data: {
      proveedorId: supplier.id,
      usuarioId: user.id,
      total,
      fecha: new Date(purchase.fecha),
      origenPago: purchase.origenPago,
      detalles: {
        create: purchase.details.map((detail) => {
          const product = getProductOrThrow(detail.productKey);
          return {
            productoId: refs.products.get(detail.productKey)!.id,
            cantidad: detail.quantity,
            costoUnitario: product.precioCompra,
            subtotal: product.precioCompra * detail.quantity,
          };
        }),
      },
    },
    select: { id: true },
  });

  await prisma.pagoCompra.createMany({
    data: purchase.pagos.map((payment) => ({
      compraId: compra.id,
      medio: payment.medio,
      monto: payment.monto,
      observacion: payment.observacion ?? null,
      createdAt: new Date(purchase.fecha),
    })),
  });

  for (const detail of purchase.details) {
    await prisma.producto.update({
      where: { id: refs.products.get(detail.productKey)!.id },
      data: { cantidad: { increment: detail.quantity } },
    });
  }

  const efectivoCaja = purchase.pagos
    .filter((payment) => payment.medio === "EFECTIVO_CAJA")
    .reduce((sum, payment) => sum + payment.monto, 0);
  const transferencia = purchase.pagos
    .filter((payment) => payment.medio === "TRANSFERENCIA_BANCARIA")
    .reduce((sum, payment) => sum + payment.monto, 0);

  if (efectivoCaja > 0) {
    const cajaId = purchase.cajaKey ? cajaIds.get(purchase.cajaKey) : null;
    if (!cajaId) {
      throw new Error(`La reposición ${purchase.key} requiere caja para la parte en efectivo.`);
    }

    await prisma.movimientoCaja.create({
      data: {
        cajaId,
        usuarioId: user.id,
        compraId: compra.id,
        tipo: "EGRESO",
        monto: efectivoCaja,
        descripcion: `${getPurchaseDescription(purchase)} (Total: ${formatMoney(total)}; efectivo de Caja: ${formatMoney(efectivoCaja)})`,
        fecha: new Date(purchase.fecha),
      },
    });

    await prisma.caja.update({
      where: { id: cajaId },
      data: { totalVentas: { decrement: efectivoCaja } },
    });
  }

  if (transferencia > 0) {
    await prisma.movimientoFinanciero.create({
      data: {
        cuentaFinancieraId: refs.accounts.bancoPrincipal.id,
        tipo: TipoMovimientoFinanciero.EGRESO,
        monto: transferencia,
        fecha: new Date(purchase.fecha),
        descripcion: `${getPurchaseDescription(purchase)} (transferencia)`,
        usuarioId: user.id,
        compraId: compra.id,
        referencia: `COMPRA-${purchase.key}`,
      },
    });
  }
}

async function createExpenseDemo(prisma: PrismaClient, expense: DemoExpenseSeed, refs: SeedReferences, cajaIds: Map<string, number>) {
  const user = refs.users.get(expense.usuario);
  const cajaId = cajaIds.get(expense.cajaKey);
  if (!user || !cajaId) {
    throw new Error(`Referencias faltantes para gasto ${expense.descripcion}`);
  }

  await prisma.movimientoCaja.create({
    data: {
      cajaId,
      usuarioId: user.id,
      tipo: "EGRESO",
      monto: expense.monto,
      descripcion: `Gasto: ${expense.descripcion}`,
      fecha: new Date(expense.fecha),
    },
  });

  await prisma.caja.update({
    where: { id: cajaId },
    data: {
      totalVentas: { decrement: expense.monto },
      gastosManuales: { increment: expense.monto },
    },
  });
}

async function closeCajaDemo(prisma: PrismaClient, cajaSeed: DemoCajaSeed, cajaId: number) {
  const movimientos = await prisma.movimientoCaja.findMany({
    where: { cajaId },
    select: { tipo: true, monto: true },
  });

  const totalContado = movimientos.reduce((balance, movimiento) => {
    return movimiento.tipo === "INGRESO" ? balance + movimiento.monto : balance - movimiento.monto;
  }, 0);

  await prisma.caja.update({
    where: { id: cajaId },
    data: {
      estado: "CERRADA",
      fechaCierre: cajaSeed.fechaCierre ? new Date(cajaSeed.fechaCierre) : null,
      totalContado,
      observacionCierre: cajaSeed.observacionCierre ?? null,
    },
  });
}

async function seedOperationalDemo(prisma: PrismaClient, refs: SeedReferences) {
  console.log("💳 Registrando saldo inicial auditable de Banco...");
  const admin = refs.users.get(BANK_BOOTSTRAP.usuario);
  if (!admin) throw new Error("Usuario admin no encontrado para Banco inicial.");

  await prisma.movimientoFinanciero.create({
    data: {
      cuentaFinancieraId: refs.accounts.bancoPrincipal.id,
      tipo: TipoMovimientoFinanciero.INGRESO,
      monto: BANK_BOOTSTRAP.monto,
      fecha: new Date(BANK_BOOTSTRAP.fecha),
      descripcion: BANK_BOOTSTRAP.descripcion,
      usuarioId: admin.id,
      referencia: BANK_BOOTSTRAP.referencia,
    },
  });

  console.log("🧾 Creando cajas demo...");
  const cajaIds = new Map<string, number>();
  for (const cajaSeed of CAJA_DEMOS) {
    const caja = await createCajaDemo(prisma, cajaSeed, refs);
    cajaIds.set(cajaSeed.key, caja.id);
  }

  console.log("🛒 Registrando ventas demo...");
  for (const sale of SALE_DEMOS) {
    await createSaleDemo(prisma, sale, refs, cajaIds);
  }

  console.log("📥 Registrando reposiciones demo...");
  for (const purchase of REPOSICION_DEMOS) {
    await createPurchaseDemo(prisma, purchase, refs, cajaIds);
  }

  console.log("🧾 Registrando gastos manuales demo...");
  for (const expense of EXPENSE_DEMOS) {
    await createExpenseDemo(prisma, expense, refs, cajaIds);
  }

  console.log("⭐ Registrando favoritos e historial de estados...");
  for (const favorite of FAVORITE_DEMOS) {
    await prisma.productoFavorito.create({
      data: {
        usuarioId: refs.users.get(favorite.usuario)!.id,
        productoId: refs.products.get(favorite.productKey)!.id,
      },
    });
  }

  for (const history of HISTORY_DEMOS) {
    await prisma.historialEstado.create({
      data: {
        productoId: refs.products.get(history.productKey)!.id,
        estadoAnterior: "ACTIVO",
        estadoNuevo: "INACTIVO",
        motivo: history.motivo,
        observacion: history.observacion,
        fecha: new Date(history.fecha),
        usuarioId: refs.users.get(history.usuario)!.id,
      },
    });
  }

  console.log("🔒 Cerrando cajas históricas con arqueos coherentes...");
  for (const cajaSeed of CAJA_DEMOS.filter((item) => item.estado === "CERRADA")) {
    await closeCajaDemo(prisma, cajaSeed, cajaIds.get(cajaSeed.key)!);
  }
}

async function getOperationalCounts(prisma: PrismaClient) {
  const [ventas, compras, cajas, movimientosFinancieros] = await Promise.all([
    prisma.venta.count(),
    prisma.compra.count(),
    prisma.caja.count(),
    prisma.movimientoFinanciero.count(),
  ]);

  return { ventas, compras, cajas, movimientosFinancieros };
}

async function printSummary(prisma: PrismaClient) {
  const [
    roles,
    usuarios,
    clientes,
    proveedores,
    categorias,
    marcas,
    productos,
    ventasPorPago,
    compras,
    cajas,
    movimientosCaja,
    pagosCompra,
    cuentas,
    movimientosFinancieros,
  ] = await Promise.all([
    prisma.rol.count(),
    prisma.usuario.count(),
    prisma.cliente.count(),
    prisma.proveedor.count(),
    prisma.categoria.count(),
    prisma.marca.count(),
    prisma.producto.count(),
    prisma.venta.groupBy({ by: ["metodoPago"], _count: true, orderBy: { metodoPago: "asc" } }),
    prisma.compra.findMany({ include: { pagos: true } }),
    prisma.caja.findMany({ orderBy: { fechaApertura: "asc" } }),
    prisma.movimientoCaja.count(),
    prisma.pagoCompra.count(),
    prisma.cuentaFinanciera.findMany({ orderBy: { tipo: "asc" } }),
    prisma.movimientoFinanciero.count(),
  ]);

  const reposicionesPorMedio = {
    efectivo: compras.filter((compra) => compra.pagos.length === 1 && compra.pagos[0]?.medio === "EFECTIVO_CAJA").length,
    transferencia: compras.filter((compra) => compra.pagos.length === 1 && compra.pagos[0]?.medio === "TRANSFERENCIA_BANCARIA").length,
    mixto: compras.filter((compra) => compra.pagos.length > 1).length,
  };

  console.log("\n✅ Seed única completada");
  console.log("═══════════════════════════════════════");
  console.log(`Roles:                ${roles}`);
  console.log(`Usuarios:             ${usuarios} (admin / ventas / stock — contraseña: ${DEMO_PASSWORD})`);
  console.log(`Clientes:             ${clientes}`);
  console.log(`Proveedores:          ${proveedores}`);
  console.log(`Categorías:           ${categorias}`);
  console.log(`Marcas:               ${marcas}`);
  console.log(`Productos:            ${productos}`);
  console.log(`Cajas:                ${cajas.length} (${cajas.filter((caja) => caja.estado === "CERRADA").length} cerradas, ${cajas.filter((caja) => caja.estado === "ABIERTA").length} abierta)`);
  console.log(`MovimientoCaja:       ${movimientosCaja}`);
  console.log(`PagoCompra:           ${pagosCompra}`);
  console.log(`CuentaFinanciera:     ${cuentas.length}`);
  console.log(`MovimientoFinanciero: ${movimientosFinancieros}`);
  console.log("Ventas por método:");
  ventasPorPago.forEach((row) => console.log(`  - ${row.metodoPago ?? "SIN_METODO"}: ${row._count}`));
  console.log("Reposiciones por medio:");
  console.log(`  - Efectivo:       ${reposicionesPorMedio.efectivo}`);
  console.log(`  - Transferencia:  ${reposicionesPorMedio.transferencia}`);
  console.log(`  - Mixto:          ${reposicionesPorMedio.mixto}`);
  console.log("Cuentas demo:");
  cuentas.forEach((account) => {
    console.log(`  - ${account.nombre} (${account.tipo})${account.esPrincipal ? " [principal]" : ""}`);
  });
  console.log("═══════════════════════════════════════");
  console.log("Comando único oficial: npx prisma db seed");
}

export async function runSeed(databaseUrl = process.env.DATABASE_URL) {
  assertSeedInvariants();
  const prisma = buildPrismaClient(databaseUrl);

  try {
    console.log("🌱 Iniciando seed oficial del proyecto...");

    const operationalCounts = await getOperationalCounts(prisma);
    const freshOperationalState =
      operationalCounts.ventas === 0 &&
      operationalCounts.compras === 0 &&
      operationalCounts.cajas === 0 &&
      operationalCounts.movimientosFinancieros === 0;

    const refs = await seedMasterData(prisma, freshOperationalState);

    if (freshOperationalState) {
      await seedOperationalDemo(prisma, refs);
    } else {
      console.log("ℹ️ La base ya tiene datos operativos. Se integraron roles/permisos y catálogos, pero se omitió el dataset transaccional demo para no contaminar registros existentes.");
    }

    await printSummary(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (isMainModule()) {
  runSeed().catch((error) => {
    console.error("❌ Error al ejecutar la seed oficial:", error);
    process.exit(1);
  });
}
