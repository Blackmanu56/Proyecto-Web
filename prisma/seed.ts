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
  fotoUrl?: string | null;
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
    fotoUrl: "/uploads/avatars/avatar-1-1784755249503.jpg",
    empleado: { nombre: "Administrador", apellido: "General", cargo: "Gerente" },
  },
  {
    username: "ventas",
    nombreCompleto: "Carlos López",
    dni: "35123456",
    correo: "carlos@chopperrepuestos.com",
    telefono: "3764555001",
    rol: "ENCARGADO_VENTAS",
    fotoUrl: "/uploads/avatars/avatar-2-1784003261920.webp",
    empleado: { nombre: "Carlos", apellido: "López", cargo: "Encargado de Ventas" },
  },
  {
    username: "stock",
    nombreCompleto: "María García",
    dni: "36789012",
    correo: "maria@chopperrepuestos.com",
    telefono: "3764555002",
    rol: "ENCARGADO_STOCK",
    fotoUrl: "/uploads/avatars/avatar-3-1784003243669.webp",
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
  {
    nombre: "Repuestos alemania",
    cuit: "30666666668",
    telefono: "3764777888",
    direccion: "Av. Lavalle 2800, Posadas",
    email: "alemania@repuestos.com.ar",
    contactoResponsable: "Hans Schmidt",
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
  { nombre: "Filtros" },
  { nombre: "Escape" },
  { nombre: "Refrigeración" },
  { nombre: "Carrocería" },
  { nombre: "Indumentaria y Cascos" },
  { nombre: "Herramientas" },
] as const;

const BRAND_DEMOS: readonly DemoBrandSeed[] = [
  { nombre: "Honda" },
  { nombre: "Yamaha" },
  { nombre: "Bajaj" },
  { nombre: "Suzuki" },
  { nombre: "Kawasaki" },
  { nombre: "Motul" },
  { nombre: "Castrol" },
  { nombre: "Pirelli" },
  { nombre: "MRF" },
  { nombre: "Zanella" },
  { nombre: "Corven" },
  { nombre: "Gilera" },
  { nombre: "Mondial" },
  { nombre: "NGK" },
  { nombre: "Genérico" },
] as const;

export const PRODUCT_DEMOS: readonly DemoProductSeed[] = [
  {
    key: "lub-cas-pwr10w40",
    nombre: "Aceite Castrol Power 1 4T 10W-40 Semisintético 1L",
    categoria: "Lubricantes",
    marca: "Castrol",
    proveedorCuit: "30555555558",
    precioCompra: 9500,
    precioVenta: 13200,
    initialQuantity: 24,
    stockMinimo: 6,
    codigo: "LUB-CAS-PWR10W40",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "lub-mot-710010w50",
    nombre: "Aceite Motul 7100 4T 10W-50 100% Sintético Éster 1L",
    categoria: "Lubricantes",
    marca: "Motul",
    proveedorCuit: "30111111118",
    precioCompra: 16500,
    precioVenta: 22800,
    initialQuantity: 15,
    stockMinimo: 5,
    codigo: "LUB-MOT-710010W50",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "lub-yam-20w50",
    nombre: "Aceite Yamalube 4T 20W-50 Mineral Premium 1L",
    categoria: "Lubricantes",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 7200,
    precioVenta: 9900,
    initialQuantity: 30,
    stockMinimo: 8,
    codigo: "LUB-YAM-20W50",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "lub-hon-10w30",
    nombre: "Aceite Honda HGO 4T 10W-30 Genuino Honda 1L",
    categoria: "Lubricantes",
    marca: "Honda",
    proveedorCuit: "30222222228",
    precioCompra: 8500,
    precioVenta: 11800,
    initialQuantity: 40,
    stockMinimo: 10,
    codigo: "LUB-HON-10W30",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "lub-mot-fork10w",
    nombre: "Aceite para Horquillas Motul Fork Oil Expert Medium 10W 1L",
    categoria: "Lubricantes",
    marca: "Motul",
    proveedorCuit: "30666666668",
    precioCompra: 12000,
    precioVenta: 16500,
    initialQuantity: 3,
    stockMinimo: 5,
    codigo: "LUB-MOT-FORK10W",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "lub-cas-2tsuper",
    nombre: "Aceite 2T Castrol Super TT para Motores 2 Tiempos 1L",
    categoria: "Lubricantes",
    marca: "Castrol",
    proveedorCuit: "30222222228",
    precioCompra: 6000,
    precioVenta: 8400,
    initialQuantity: 0,
    stockMinimo: 5,
    codigo: "LUB-CAS-2TSUPER",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "frn-hon-cb1del",
    nombre: "Pastillas de Freno Delantera Honda CB1 125",
    categoria: "Frenos",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 4200,
    precioVenta: 5800,
    initialQuantity: 22,
    stockMinimo: 6,
    codigo: "FRN-HON-CB1DEL",
    imagen: "/uploads/1787257275289-zfrhdi.webp",
  },
  {
    key: "frn-yam-fztras",
    nombre: "Pastillas de Freno Traseras Yamaha YBR 125 / FZ FI",
    categoria: "Frenos",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 5800,
    precioVenta: 8000,
    initialQuantity: 16,
    stockMinimo: 5,
    codigo: "FRN-YAM-FZTRAS",
    imagen: "/uploads/1787257275289-zfrhdi.webp",
  },
  {
    key: "frn-hon-wave110zap",
    nombre: "Juego de Zapatas de Freno Trasero Honda Wave 110S",
    categoria: "Frenos",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 3500,
    precioVenta: 4900,
    initialQuantity: 35,
    stockMinimo: 8,
    codigo: "FRN-HON-WAVE110ZAP",
    imagen: "/uploads/1787257275289-zfrhdi.webp",
  },
  {
    key: "frn-yam-discfz16",
    nombre: "Disco de Freno Delantero Yamaha FZ 16 / FZ-S 282mm",
    categoria: "Frenos",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 18500,
    precioVenta: 25500,
    initialQuantity: 8,
    stockMinimo: 3,
    codigo: "FRN-YAM-DISCFZ16",
    imagen: "/uploads/1787257275289-zfrhdi.webp",
  },
  {
    key: "frn-gen-bombdel",
    nombre: "Bomba de Freno Delantero Universal con Maneta Negra",
    categoria: "Frenos",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 12500,
    precioVenta: 17200,
    initialQuantity: 2,
    stockMinimo: 4,
    codigo: "FRN-GEN-BOMBDEL",
    imagen: "/uploads/1787257275289-zfrhdi.webp",
  },
  {
    key: "frn-gen-flexmall95",
    nombre: "Flexible de Freno Delantero Mallado Universal 95cm",
    categoria: "Frenos",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 6800,
    precioVenta: 9500,
    initialQuantity: 14,
    stockMinimo: 4,
    codigo: "FRN-GEN-FLEXMALL95",
    imagen: "/uploads/1787257275289-zfrhdi.webp",
  },
  {
    key: "frn-suz-gn125sint",
    nombre: "Pastillas de Freno Sinterizadas Suzuki GN 125",
    categoria: "Frenos",
    marca: "Suzuki",
    proveedorCuit: "30666666668",
    precioCompra: 4800,
    precioVenta: 6600,
    initialQuantity: 0,
    stockMinimo: 4,
    codigo: "FRN-SUZ-GN125SINT",
    imagen: "/uploads/1787257275289-zfrhdi.webp",
  },
  {
    key: "trn-yam-ybrkitref",
    nombre: "Kit de Transmisión Reforzado Yamaha YBR 125 (Corona, Piñón, Cadena)",
    categoria: "Transmisión",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 14500,
    precioVenta: 20000,
    initialQuantity: 12,
    stockMinimo: 4,
    codigo: "TRN-YAM-YBRKITREF",
    imagen: "/uploads/1787257247068-n6du8v.webp",
  },
  {
    key: "trn-crv-triaxkit",
    nombre: "Kit de Transmisión Corven Triax 150 / 200 Paso 428",
    categoria: "Transmisión",
    marca: "Corven",
    proveedorCuit: "30222222228",
    precioCompra: 11800,
    precioVenta: 16500,
    initialQuantity: 10,
    stockMinimo: 3,
    codigo: "TRN-CRV-TRIAXKIT",
    imagen: "/uploads/1787257247068-n6du8v.webp",
  },
  {
    key: "trn-hon-cor43txr",
    nombre: "Corona Trasera 43T Honda XR 150L / XR 125L",
    categoria: "Transmisión",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 8200,
    precioVenta: 11400,
    initialQuantity: 8,
    stockMinimo: 3,
    codigo: "TRN-HON-COR43TXR",
    imagen: "/uploads/1787257247068-n6du8v.webp",
  },
  {
    key: "trn-hon-pin14tcg",
    nombre: "Piñón de Ataque 14T Honda CG 150 Titan",
    categoria: "Transmisión",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 3400,
    precioVenta: 4700,
    initialQuantity: 25,
    stockMinimo: 6,
    codigo: "TRN-HON-PIN14TCG",
    imagen: "/uploads/1787257247068-n6du8v.webp",
  },
  {
    key: "trn-gen-cad520horing",
    nombre: "Cadena de Transmisión Dorada 520H x 120L con O-Ring",
    categoria: "Transmisión",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 19500,
    precioVenta: 26900,
    initialQuantity: 9,
    stockMinimo: 2,
    codigo: "TRN-GEN-CAD520HORING",
    imagen: "/uploads/1787257247068-n6du8v.webp",
  },
  {
    key: "trn-hon-tacoswave",
    nombre: "Goma de Maza / Corona Honda Wave 110S (Juego 4 tacos)",
    categoria: "Transmisión",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 2100,
    precioVenta: 2950,
    initialQuantity: 30,
    stockMinimo: 8,
    codigo: "TRN-HON-TACOSWAVE",
    imagen: "/uploads/1787257247068-n6du8v.webp",
  },
  {
    key: "trn-zan-sap150kit",
    nombre: "Kit de Arrastre Zanella Sapucai 150",
    categoria: "Transmisión",
    marca: "Zanella",
    proveedorCuit: "30555555558",
    precioCompra: 10500,
    precioVenta: 14500,
    initialQuantity: 2,
    stockMinimo: 3,
    codigo: "TRN-ZAN-SAP150KIT",
    imagen: "/uploads/1787257247068-n6du8v.webp",
  },
  {
    key: "trn-mon-rd150desc",
    nombre: "Kit Transmisión Descatalogado Mondial RD 150",
    categoria: "Transmisión",
    marca: "Mondial",
    proveedorCuit: "30555555558",
    precioCompra: 8900,
    precioVenta: 12200,
    initialQuantity: 2,
    stockMinimo: 0,
    codigo: "TRN-MON-RD150DESC",
    activo: false,
    imagen: "/uploads/1787257247068-n6du8v.webp",
  },
  {
    key: "neu-pir-909018city",
    nombre: "Cubierta 90/90-18 Pirelli City Dragon Delantera",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorCuit: "30444444448",
    precioCompra: 32000,
    precioVenta: 44000,
    initialQuantity: 10,
    stockMinimo: 3,
    codigo: "NEU-PIR-909018CITY",
    imagen: "/uploads/1787257109231-xgu3vc.webp",
  },
  {
    key: "neu-pir-27517sc",
    nombre: "Cubierta 2.75-17 Pirelli Super City Wave / Smash",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorCuit: "30444444448",
    precioCompra: 22000,
    precioVenta: 30500,
    initialQuantity: 16,
    stockMinimo: 4,
    codigo: "NEU-PIR-27517SC",
    imagen: "/uploads/1787257109231-xgu3vc.webp",
  },
  {
    key: "neu-pir-8010014cc",
    nombre: "Cubierta 80/100-14 Pirelli City Cross Trasera Wave",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorCuit: "30444444448",
    precioCompra: 24500,
    precioVenta: 33800,
    initialQuantity: 14,
    stockMinimo: 4,
    codigo: "NEU-PIR-8010014CC",
    imagen: "/uploads/1787257109231-xgu3vc.webp",
  },
  {
    key: "neu-mrf-1109017mog",
    nombre: "Cubierta 110/90-17 MRF Mogrip Meteor Enduro",
    categoria: "Neumáticos",
    marca: "MRF",
    proveedorCuit: "30444444448",
    precioCompra: 38000,
    precioVenta: 52000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "NEU-MRF-1109017MOG",
    imagen: "/uploads/1787257109231-xgu3vc.webp",
  },
  {
    key: "neu-gen-cam18tr4",
    nombre: "Cámara para Moto 2.75/3.00-18 Rinaldi Válvula TR4",
    categoria: "Neumáticos",
    marca: "Genérico",
    proveedorCuit: "30444444448",
    precioCompra: 4500,
    precioVenta: 6300,
    initialQuantity: 40,
    stockMinimo: 10,
    codigo: "NEU-GEN-CAM18TR4",
    imagen: "/uploads/1787257109231-xgu3vc.webp",
  },
  {
    key: "neu-pir-1407017dr2",
    nombre: "Cubierta 140/70-17 Pirelli Diablo Rosso II Radial Trasera",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorCuit: "30444444448",
    precioCompra: 68000,
    precioVenta: 93500,
    initialQuantity: 3,
    stockMinimo: 3,
    codigo: "NEU-PIR-1407017DR2",
    imagen: "/uploads/1787257109231-xgu3vc.webp",
  },
  {
    key: "neu-pir-1009019tor",
    nombre: "Cubierta 100/90-19 Delantera Enduro Honda XR 250 Tornado",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorCuit: "30444444448",
    precioCompra: 42000,
    precioVenta: 58000,
    initialQuantity: 0,
    stockMinimo: 3,
    codigo: "NEU-PIR-1009019TOR",
    imagen: "/uploads/1787257109231-xgu3vc.webp",
  },
  {
    key: "ele-yam-ytx5lbs",
    nombre: "Batería de Gel 12V 5Ah Yuasa YTX5L-BS Wave / Smash",
    categoria: "Eléctrico",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 19000,
    precioVenta: 26000,
    initialQuantity: 14,
    stockMinimo: 4,
    codigo: "ELE-YAM-YTX5LBS",
    imagen: "/uploads/1787256884615-ec2s6q.webp",
  },
  {
    key: "ele-hon-btx7lbs",
    nombre: "Batería de Gel 12V 7Ah Bosch BTX7L-BS Honda CG Titan",
    categoria: "Eléctrico",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 22500,
    precioVenta: 31000,
    initialQuantity: 12,
    stockMinimo: 4,
    codigo: "ELE-HON-BTX7LBS",
    imagen: "/uploads/1787256884615-ec2s6q.webp",
  },
  {
    key: "ele-hon-regvoltcg",
    nombre: "Regulador de Voltaje / Rectificador Honda CG 150 Titan",
    categoria: "Eléctrico",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 8900,
    precioVenta: 12400,
    initialQuantity: 8,
    stockMinimo: 3,
    codigo: "ELE-HON-REGVOLTCG",
    imagen: "/uploads/1787256884615-ec2s6q.webp",
  },
  {
    key: "ele-gen-relearran",
    nombre: "Relé de Arranque Universal 12V 4 Pin",
    categoria: "Eléctrico",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 4500,
    precioVenta: 6300,
    initialQuantity: 20,
    stockMinimo: 5,
    codigo: "ELE-GEN-RELEARRAN",
    imagen: "/uploads/1787256884615-ec2s6q.webp",
  },
  {
    key: "ele-hon-burrowave",
    nombre: "Motor de Arranque / Burro Honda Wave 110S",
    categoria: "Eléctrico",
    marca: "Honda",
    proveedorCuit: "30222222228",
    precioCompra: 24000,
    precioVenta: 33000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "ELE-HON-BURROWAVE",
    imagen: "/uploads/1787256884615-ec2s6q.webp",
  },
  {
    key: "ele-gen-bocina12v",
    nombre: "Bocina Universal 12V Tono Grave para Moto",
    categoria: "Eléctrico",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 3200,
    precioVenta: 4500,
    initialQuantity: 16,
    stockMinimo: 4,
    codigo: "ELE-GEN-BOCINA12V",
    imagen: "/uploads/1787256884615-ec2s6q.webp",
  },
  {
    key: "ele-zan-tambtamzb",
    nombre: "Llave de Contacto y Tambor con 2 Llaves Zanella ZB 110",
    categoria: "Eléctrico",
    marca: "Zanella",
    proveedorCuit: "30222222228",
    precioCompra: 6800,
    precioVenta: 9500,
    initialQuantity: 2,
    stockMinimo: 3,
    codigo: "ELE-ZAN-TAMBTAMZB",
    imagen: "/uploads/1787256884615-ec2s6q.webp",
  },
  {
    key: "enc-ngk-cpr8eaix",
    nombre: "Bujía de Iridium NGK CPR8EAIX-9 Alto Rendimiento",
    categoria: "Encendido",
    marca: "NGK",
    proveedorCuit: "30666666668",
    precioCompra: 7500,
    precioVenta: 10500,
    initialQuantity: 18,
    stockMinimo: 5,
    codigo: "ENC-NGK-CPR8EAIX",
    imagen: "/uploads/1787256924603-yyphhb.webp",
  },
  {
    key: "enc-ngk-d8ea",
    nombre: "Bujía NGK D8EA Honda CG 150 / Titan / XR",
    categoria: "Encendido",
    marca: "NGK",
    proveedorCuit: "30222222228",
    precioCompra: 1200,
    precioVenta: 1700,
    initialQuantity: 60,
    stockMinimo: 15,
    codigo: "ENC-NGK-D8EA",
    imagen: "/uploads/1787256924603-yyphhb.webp",
  },
  {
    key: "enc-ngk-c7hsa",
    nombre: "Bujía NGK C7HSA 110cc Smash / Wave / Biz",
    categoria: "Encendido",
    marca: "NGK",
    proveedorCuit: "30222222228",
    precioCompra: 1100,
    precioVenta: 1550,
    initialQuantity: 75,
    stockMinimo: 20,
    codigo: "ENC-NGK-C7HSA",
    imagen: "/uploads/1787256924603-yyphhb.webp",
  },
  {
    key: "enc-gen-cdiracing",
    nombre: "CDI Racing sin Corte 6 Pines Universal",
    categoria: "Encendido",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 6500,
    precioVenta: 9100,
    initialQuantity: 11,
    stockMinimo: 3,
    codigo: "ENC-GEN-CDIRACING",
    imagen: "/uploads/1787256924603-yyphhb.webp",
  },
  {
    key: "enc-ngk-bobinaalta",
    nombre: "Bobina de Alta Tensión con Capuchón NGK Siliconado",
    categoria: "Encendido",
    marca: "NGK",
    proveedorCuit: "30666666668",
    precioCompra: 8200,
    precioVenta: 11500,
    initialQuantity: 9,
    stockMinimo: 3,
    codigo: "ENC-NGK-BOBINAALTA",
    imagen: "/uploads/1787256924603-yyphhb.webp",
  },
  {
    key: "enc-hon-estatorcg",
    nombre: "Estator de Bobinas de Encendido Honda CG 150",
    categoria: "Encendido",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 16500,
    precioVenta: 22900,
    initialQuantity: 3,
    stockMinimo: 3,
    codigo: "ENC-HON-ESTATORCG",
    imagen: "/uploads/1787256924603-yyphhb.webp",
  },
  {
    key: "enc-yam-cdifz16",
    nombre: "CDI Original Yamaha FZ 16 / FZ-S 2.0",
    categoria: "Encendido",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 28000,
    precioVenta: 38500,
    initialQuantity: 0,
    stockMinimo: 2,
    codigo: "ENC-YAM-CDIFZ16",
    imagen: "/uploads/1787256924603-yyphhb.webp",
  },
  {
    key: "flt-hon-airtornado",
    nombre: "Filtro de Aire Esponja Honda XR 250 Tornado Lavable",
    categoria: "Filtros",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 4500,
    precioVenta: 6300,
    initialQuantity: 20,
    stockMinimo: 5,
    codigo: "FLT-HON-AIRTORNADO",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "flt-yam-airybr125",
    nombre: "Filtro de Aire Yamaha YBR 125 Elemento Seco",
    categoria: "Filtros",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 3800,
    precioVenta: 5300,
    initialQuantity: 22,
    stockMinimo: 6,
    codigo: "FLT-YAM-AIRYBR125",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "flt-yam-oilfz16",
    nombre: "Filtro de Aceite Yamaha FZ 16 / FZ 25 Original",
    categoria: "Filtros",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 2400,
    precioVenta: 3400,
    initialQuantity: 40,
    stockMinimo: 10,
    codigo: "FLT-YAM-OILFZ16",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "flt-gen-naftaiman",
    nombre: "Filtro de Combustible Nafta Universal con Imán",
    categoria: "Filtros",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 900,
    precioVenta: 1300,
    initialQuantity: 65,
    stockMinimo: 15,
    codigo: "FLT-GEN-NAFTAIMAN",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "flt-gen-airconico",
    nombre: "Filtro de Aire Cónico Deportivo 35mm / 38mm",
    categoria: "Filtros",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 4200,
    precioVenta: 5900,
    initialQuantity: 14,
    stockMinimo: 3,
    codigo: "FLT-GEN-AIRCONICO",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "flt-kaw-oilninja",
    nombre: "Filtro de Aceite Kawasaki Ninja 300 / 400 K&N",
    categoria: "Filtros",
    marca: "Kawasaki",
    proveedorCuit: "30666666668",
    precioCompra: 11000,
    precioVenta: 15200,
    initialQuantity: 3,
    stockMinimo: 3,
    codigo: "FLT-KAW-OILNINJA",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "flt-gil-vc150old",
    nombre: "Filtro de Aire Descontinuado Gilera VC 150",
    categoria: "Filtros",
    marca: "Gilera",
    proveedorCuit: "30222222228",
    precioCompra: 2500,
    precioVenta: 3500,
    initialQuantity: 1,
    stockMinimo: 0,
    codigo: "FLT-GIL-VC150OLD",
    activo: false,
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "mot-hon-kitcilcg150",
    nombre: "Kit de Cilindro, Pistón y Aros Honda CG 150 57.3mm Standard",
    categoria: "Motor",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 34000,
    precioVenta: 47000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "MOT-HON-KITCILCG150",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "mot-hon-juntaswave",
    nombre: "Juego de Juntas de Motor Completo Honda Wave 110S",
    categoria: "Motor",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 4800,
    precioVenta: 6700,
    initialQuantity: 25,
    stockMinimo: 5,
    codigo: "MOT-HON-JUNTASWAVE",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "mot-hon-valvulascg",
    nombre: "Válvulas de Admisión y Escape 3B Honda CG 150 Titan (Par)",
    categoria: "Motor",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 6200,
    precioVenta: 8600,
    initialQuantity: 15,
    stockMinimo: 4,
    codigo: "MOT-HON-VALVULASCG",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "mot-crv-levastriax",
    nombre: "Árbol de Levas con Balancines Corven Hunter / Triax 150",
    categoria: "Motor",
    marca: "Corven",
    proveedorCuit: "30222222228",
    precioCompra: 16500,
    precioVenta: 22900,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "MOT-CRV-LEVASTRIAX",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "mot-hon-embragcg150",
    nombre: "Discos de Embrague Honda CG 150 Titan (Juego x5)",
    categoria: "Motor",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 5800,
    precioVenta: 8100,
    initialQuantity: 19,
    stockMinimo: 5,
    codigo: "MOT-HON-EMBRAGCG150",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "mot-yam-bomboilybr",
    nombre: "Bomba de Aceite de Motor Yamaha YBR 125",
    categoria: "Motor",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 12000,
    precioVenta: 16500,
    initialQuantity: 3,
    stockMinimo: 3,
    codigo: "MOT-YAM-BOMBOILYBR",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "mot-gen-carb28mik",
    nombre: "Carburador Completo 28mm Tipo Mikuni Universal 150cc / 200cc",
    categoria: "Motor",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 21500,
    precioVenta: 29500,
    initialQuantity: 0,
    stockMinimo: 3,
    codigo: "MOT-GEN-CARB28MIK",
    imagen: "/uploads/1787257208766-dhiz8x.webp",
  },
  {
    key: "sus-hon-amortcgpar",
    nombre: "Amortiguadores Traseros Cromados Reforzados Honda CG 150 (Par)",
    categoria: "Suspensión",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 24000,
    precioVenta: 33000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "SUS-HON-AMORTCGPAR",
    imagen: "/uploads/1787256838982-qcmmog.webp",
  },
  {
    key: "sus-hon-retbarralxr",
    nombre: "Retenes de Barral y Guardapolvos Honda XR 150 / 125 (Juego)",
    categoria: "Suspensión",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 3600,
    precioVenta: 5000,
    initialQuantity: 20,
    stockMinimo: 6,
    codigo: "SUS-HON-RETBARRALXR",
    imagen: "/uploads/1787256838982-qcmmog.webp",
  },
  {
    key: "sus-yam-barralybr",
    nombre: "Barrales de Suspensión Delantera Cromados Yamaha YBR 125 (Par)",
    categoria: "Suspensión",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 38000,
    precioVenta: 52500,
    initialQuantity: 4,
    stockMinimo: 4,
    codigo: "SUS-YAM-BARRALYBR",
    imagen: "/uploads/1787256838982-qcmmog.webp",
  },
  {
    key: "sus-hon-monoshocktor",
    nombre: "Monoshock Trasero Regulable Honda XR 250 Tornado",
    categoria: "Suspensión",
    marca: "Honda",
    proveedorCuit: "30333333338",
    precioCompra: 45000,
    precioVenta: 62000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "SUS-HON-MONOSHOCKTOR",
    imagen: "/uploads/1787256838982-qcmmog.webp",
  },
  {
    key: "sus-gen-fuelle35mm",
    nombre: "Fuelle Protector de Barrales Goma Negro 35mm (Par)",
    categoria: "Suspensión",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 2800,
    precioVenta: 3900,
    initialQuantity: 26,
    stockMinimo: 6,
    codigo: "SUS-GEN-FUELLE35MM",
    imagen: "/uploads/1787256838982-qcmmog.webp",
  },
  {
    key: "sus-gen-pistconicas",
    nombre: "Juego de Cazoletas y Pistas de Dirección Cónicas CG / Wave",
    categoria: "Suspensión",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 4900,
    precioVenta: 6800,
    initialQuantity: 15,
    stockMinimo: 4,
    codigo: "SUS-GEN-PISTCONICAS",
    imagen: "/uploads/1787256838982-qcmmog.webp",
  },
  {
    key: "sus-hon-bujteflon",
    nombre: "Bujes de Horquillón Trasero Teflon Honda Titan (Par)",
    categoria: "Suspensión",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 2400,
    precioVenta: 3400,
    initialQuantity: 22,
    stockMinimo: 5,
    codigo: "SUS-HON-BUJTEFLON",
    imagen: "/uploads/1787256838982-qcmmog.webp",
  },
  {
    key: "ilu-gen-ledh4cree",
    nombre: "Lámpara LED H4 Cree 8000 LM Alta y Baja con Ventilador",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 4800,
    precioVenta: 6700,
    initialQuantity: 30,
    stockMinimo: 8,
    codigo: "ILU-GEN-LEDH4CREE",
    imagen: "/uploads/1787257172217-pralxv.webp",
  },
  {
    key: "ilu-gen-girossecu4",
    nombre: "Juego de Giros LED Secuenciales Universales Negros (4 Unidades)",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 6500,
    precioVenta: 9100,
    initialQuantity: 18,
    stockMinimo: 4,
    codigo: "ILU-GEN-GIROSSECU4",
    imagen: "/uploads/1787257172217-pralxv.webp",
  },
  {
    key: "ilu-hon-opticacg150",
    nombre: "Óptica Delantera Completa con Carcasa Honda CG 150 Titan",
    categoria: "Iluminación",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 13500,
    precioVenta: 18600,
    initialQuantity: 9,
    stockMinimo: 2,
    codigo: "ILU-HON-OPTICACG150",
    imagen: "/uploads/1787257172217-pralxv.webp",
  },
  {
    key: "ilu-yam-farostopfz",
    nombre: "Faro Trasero Stop LED Completo Yamaha FZ 16",
    categoria: "Iluminación",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 9800,
    precioVenta: 13600,
    initialQuantity: 11,
    stockMinimo: 3,
    codigo: "ILU-YAM-FAROSTOPFZ",
    imagen: "/uploads/1787257172217-pralxv.webp",
  },
  {
    key: "ilu-gen-halh4osram",
    nombre: "Lámpara Halógena H4 12V 35/35W Osram Original",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 2100,
    precioVenta: 2950,
    initialQuantity: 50,
    stockMinimo: 12,
    codigo: "ILU-GEN-HALH4OSRAM",
    imagen: "/uploads/1787257172217-pralxv.webp",
  },
  {
    key: "ilu-gen-auxexplor",
    nombre: "Faro Auxiliar LED Explorador Ojo de Ángel (Par)",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 8500,
    precioVenta: 11900,
    initialQuantity: 2,
    stockMinimo: 3,
    codigo: "ILU-GEN-AUXEXPLOR",
    imagen: "/uploads/1787257172217-pralxv.webp",
  },
  {
    key: "ilu-gen-ledt10x10",
    nombre: "Lámpara de Tablero T10 LED Blanco Puro x 10 unidades",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 1500,
    precioVenta: 2100,
    initialQuantity: 45,
    stockMinimo: 10,
    codigo: "ILU-GEN-LEDT10X10",
    imagen: "/uploads/1787257172217-pralxv.webp",
  },
  {
    key: "esc-gen-rs7wave110",
    nombre: "Caño de Escape Deportivo Cott RS7 Boca Negra Honda Wave 110",
    categoria: "Escape",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 28000,
    precioVenta: 38800,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "ESC-GEN-RS7WAVE110",
    imagen: "/uploads/1787256978094-sidqz3.webp",
  },
  {
    key: "esc-hon-origcg150",
    nombre: "Escape Original Cromado Completo Honda CG 150 Titan ESD",
    categoria: "Escape",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 42000,
    precioVenta: 58000,
    initialQuantity: 3,
    stockMinimo: 3,
    codigo: "ESC-HON-ORIGCG150",
    imagen: "/uploads/1787256978094-sidqz3.webp",
  },
  {
    key: "esc-gen-juntacopper",
    nombre: "Junta de Boca de Escape de Bronce y Cobre Universal 110/125/150",
    categoria: "Escape",
    marca: "Genérico",
    proveedorCuit: "30222222228",
    precioCompra: 600,
    precioVenta: 850,
    initialQuantity: 50,
    stockMinimo: 15,
    codigo: "ESC-GEN-JUNTACOPPER",
    imagen: "/uploads/1787256978094-sidqz3.webp",
  },
  {
    key: "esc-gen-silencuni",
    nombre: "Silenciador de Escape Universal con Abrazadera",
    categoria: "Escape",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 14500,
    precioVenta: 20000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "ESC-GEN-SILENCUNI",
    imagen: "/uploads/1787256978094-sidqz3.webp",
  },
  {
    key: "esc-gen-cintaterm5m",
    nombre: "Cinta Térmica Aislante para Múltiple de Escape Titanio 5m",
    categoria: "Escape",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 5200,
    precioVenta: 7200,
    initialQuantity: 16,
    stockMinimo: 4,
    codigo: "ESC-GEN-CINTATERM5M",
    imagen: "/uploads/1787256978094-sidqz3.webp",
  },
  {
    key: "ref-mot-motocool",
    nombre: "Líquido Refrigerante / Anticongelante Motul Motocool Expert 1L",
    categoria: "Refrigeración",
    marca: "Motul",
    proveedorCuit: "30111111118",
    precioCompra: 6800,
    precioVenta: 9400,
    initialQuantity: 20,
    stockMinimo: 5,
    codigo: "REF-MOT-MOTOCOOL",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "ref-baj-radns200",
    nombre: "Radiador de Agua Completo de Aluminio Rouser NS200",
    categoria: "Refrigeración",
    marca: "Bajaj",
    proveedorCuit: "30222222228",
    precioCompra: 38000,
    precioVenta: 52500,
    initialQuantity: 3,
    stockMinimo: 3,
    codigo: "REF-BAJ-RADNS200",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "ref-gen-taparad11",
    nombre: "Tapa de Radiador de Presión 1.1 Bar Universal",
    categoria: "Refrigeración",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 3400,
    precioVenta: 4800,
    initialQuantity: 15,
    stockMinimo: 4,
    codigo: "REF-GEN-TAPARAD11",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "ref-yam-bulbotemp",
    nombre: "Sensor de Temperatura / Bulbo de Radiador Yamaha FZ 25",
    categoria: "Refrigeración",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 8500,
    precioVenta: 11900,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "REF-YAM-BULBOTEMP",
    imagen: "/uploads/1787256814727-9ankcz.webp",
  },
  {
    key: "car-hon-kitplaswave",
    nombre: "Juego de Plásticos Completo Negro Brillante Honda Wave 110S",
    categoria: "Carrocería",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 48000,
    precioVenta: 66000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "CAR-HON-KITPLASWAVE",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "car-hon-guardtrascg",
    nombre: "Guardabarro Trasero con Portapatente Honda CG 150 Titan",
    categoria: "Carrocería",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 9200,
    precioVenta: 12800,
    initialQuantity: 11,
    stockMinimo: 3,
    codigo: "CAR-HON-GUARDTRASCG",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "car-hon-cubrecadcg",
    nombre: "Cubre Cadena Plástico Negro Honda CG 150 / Titan",
    categoria: "Carrocería",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 3100,
    precioVenta: 4300,
    initialQuantity: 18,
    stockMinimo: 4,
    codigo: "CAR-HON-CUBRECADCG",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "car-yam-asientoybr",
    nombre: "Asiento Completo Antideslizante Yamaha YBR 125 ESD",
    categoria: "Carrocería",
    marca: "Yamaha",
    proveedorCuit: "30333333338",
    precioCompra: 26000,
    precioVenta: 36000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "CAR-YAM-ASIENTOYBR",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "car-gen-fundaasil",
    nombre: "Funda de Asiento Térmica de Malla Panal de Abeja Talle L",
    categoria: "Carrocería",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 3800,
    precioVenta: 5300,
    initialQuantity: 30,
    stockMinimo: 6,
    codigo: "CAR-GEN-FUNDAASIL",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "car-hon-grafistor",
    nombre: "Kit de Calcomanías Completas Honda Tornado 250",
    categoria: "Carrocería",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 7500,
    precioVenta: 10500,
    initialQuantity: 12,
    stockMinimo: 3,
    codigo: "CAR-HON-GRAFISTOR",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "ind-gen-cascohwkrs11",
    nombre: "Casco Integral Hawk RS11 Negro Mate Talle L con Visor Antirrayas",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 42000,
    precioVenta: 58000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "IND-GEN-CASCOHWKRS11",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "ind-gen-cascomtlem",
    nombre: "Casco Abierto / Jet MT Le Mans Cafe Racer Talle M",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 36000,
    precioVenta: 49500,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "IND-GEN-CASCOMTLEM",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "ind-gen-guantestermxl",
    nombre: "Guantes de Moto Térmicos con Protección en Nudillos Talle XL",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorCuit: "30222222228",
    precioCompra: 8500,
    precioVenta: 11900,
    initialQuantity: 15,
    stockMinimo: 4,
    codigo: "IND-GEN-GUANTESTERMXL",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "ind-gen-pilotolluvl",
    nombre: "Traje de Lluvia / Piloto Impermeable 2 Piezas Reforzado Talle L",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorCuit: "30222222228",
    precioCompra: 14000,
    precioVenta: 19500,
    initialQuantity: 10,
    stockMinimo: 3,
    codigo: "IND-GEN-PILOTOLLUVL",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "ind-gen-antiparras",
    nombre: "Antiparras de Motocross / Enduro con Lente Espejado Tornasol",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 6800,
    precioVenta: 9500,
    initialQuantity: 12,
    stockMinimo: 3,
    codigo: "IND-GEN-ANTIPARRAS",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "acc-gen-baul32l",
    nombre: "Baúl / Top Case Trasero 32L para 1 Casco con Base Universal",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 26000,
    precioVenta: 36000,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "ACC-GEN-BAUL32L",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "acc-gen-sopcelusb",
    nombre: "Soporte Celular de Aluminio para Manubrio con Cargador USB Rápido",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 7200,
    precioVenta: 10000,
    initialQuantity: 24,
    stockMinimo: 6,
    codigo: "ACC-GEN-SOPCELUSB",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "acc-gen-trabadiscalrm",
    nombre: "Traba Disco Antirrobo con Alarma Sonora 110dB y Cable Recordatorio",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 9800,
    precioVenta: 13700,
    initialQuantity: 16,
    stockMinimo: 4,
    codigo: "ACC-GEN-TRABADISCALRM",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "acc-gen-punoscnc22",
    nombre: "Puños de Goma y Aluminio Deportivos CNC Universales 22mm (Par)",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 3400,
    precioVenta: 4700,
    initialQuantity: 22,
    stockMinimo: 5,
    codigo: "ACC-GEN-PUNOSCNC22",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "acc-gen-manubwirtz",
    nombre: "Manubrio Deportivo de Aluminio Tipo Wirtz 22mm con Pad",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorCuit: "30555555558",
    precioCompra: 16500,
    precioVenta: 23000,
    initialQuantity: 10,
    stockMinimo: 3,
    codigo: "ACC-GEN-MANUBWIRTZ",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "acc-hon-caballetecg",
    nombre: "Caballete Central con Resorte y Perno Honda CG 150 Titan",
    categoria: "Accesorios",
    marca: "Honda",
    proveedorCuit: "30111111118",
    precioCompra: 11500,
    precioVenta: 16000,
    initialQuantity: 0,
    stockMinimo: 2,
    codigo: "ACC-HON-CABALLETECG",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "her-gen-sacabujia16",
    nombre: "Llave Saca Bujía Articulada 16mm / 21mm Reforzada con Mango T",
    categoria: "Herramientas",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 3200,
    precioVenta: 4500,
    initialQuantity: 15,
    stockMinimo: 4,
    codigo: "HER-GEN-SACABUJIA16",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "her-gen-extractvol",
    nombre: "Extractor de Volante Magnético Magneto Universal Moto 110 / 125 / 150",
    categoria: "Herramientas",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 6500,
    precioVenta: 9100,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "HER-GEN-EXTRACTVOL",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "her-gen-cortacadena",
    nombre: "Corta Cadena y Remachador Universal para Cadenas 420 a 530",
    categoria: "Herramientas",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 8900,
    precioVenta: 12400,
    initialQuantity: 8,
    stockMinimo: 2,
    codigo: "HER-GEN-CORTACADENA",
    imagen: "/uploads/1787257138942-7grty1.webp",
  },
  {
    key: "her-gen-galgasvalv",
    nombre: "Calibrador de Válvulas Galgas Sondas en Pulgadas y Milímetros",
    categoria: "Herramientas",
    marca: "Genérico",
    proveedorCuit: "30666666668",
    precioCompra: 2800,
    precioVenta: 3950,
    initialQuantity: 18,
    stockMinimo: 4,
    codigo: "HER-GEN-GALGASVALV",
    imagen: "/uploads/1787257138942-7grty1.webp",
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
      { productKey: "trn-yam-ybrkitref", quantity: 1 },
      { productKey: "enc-ngk-cpr8eaix", quantity: 2 },
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
    details: [{ productKey: "neu-pir-909018city", quantity: 1 }],
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
      { productKey: "ilu-gen-ledh4cree", quantity: 1 },
      { productKey: "enc-ngk-cpr8eaix", quantity: 3 },
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
      { productKey: "flt-yam-oilfz16", quantity: 2 },
      { productKey: "lub-mot-710010w50", quantity: 2 },
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
    details: [{ productKey: "frn-hon-cb1del", quantity: 2 }],
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
    details: [{ productKey: "trn-gen-cad520horing", quantity: 1 }],
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
    details: [{ productKey: "trn-yam-ybrkitref", quantity: 4 }],
    pagos: [{ medio: "EFECTIVO_CAJA", monto: 58000 }],
  },
  {
    key: "reposicion-transferencia-actual",
    kind: "TRANSFERENCIA",
    fecha: "2026-08-13T00:50:00-03:00",
    proveedorCuit: "30222222228",
    usuario: "stock",
    origenPago: OrigenPagoCompra.TRANSFERENCIA_BANCARIA,
    details: [
      { productKey: "frn-hon-cb1del", quantity: 4 },
      { productKey: "trn-gen-cad520horing", quantity: 2 },
    ],
    pagos: [{ medio: "TRANSFERENCIA_BANCARIA", monto: 55800 }],
  },
  {
    key: "reposicion-mixta-actual",
    kind: "MIXTO",
    cajaKey: "caja-activa-demo",
    fecha: "2026-08-13T00:58:00-03:00",
    proveedorCuit: "30333333338",
    usuario: "stock",
    origenPago: OrigenPagoCompra.TRANSFERENCIA_BANCARIA,
    details: [{ productKey: "sus-hon-amortcgpar", quantity: 2 }],
    pagos: [
      { medio: "EFECTIVO_CAJA", monto: 18000, observacion: "Parte abonada desde Caja" },
      {
        medio: "TRANSFERENCIA_BANCARIA",
        monto: 30000,
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
  { usuario: "admin", productKey: "trn-yam-ybrkitref" },
  { usuario: "admin", productKey: "ele-yam-ytx5lbs" },
  { usuario: "ventas", productKey: "frn-hon-cb1del" },
] as const;

const HISTORY_DEMOS: readonly DemoHistorySeed[] = [
  {
    productKey: "flt-gil-vc150old",
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

const SEED_PRODUCT_IMAGE_BASE_PATHS = ["/uploads", "/seed/productos"];

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

    if (!SEED_PRODUCT_IMAGE_BASE_PATHS.some((base) => product.imagen!.startsWith(`${base}/`))) {
      errors.push(`El producto ${product.key} debe usar assets demo bajo ${SEED_PRODUCT_IMAGE_BASE_PATHS.join(" o ")}.`);
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
        fotoUrl: userSeed.fotoUrl ?? null,
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
        fotoUrl: userSeed.fotoUrl ?? null,
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

async function seedSolicitudesDemo(prisma: PrismaClient, refs: SeedReferences) {
  const existing = await prisma.solicitudReposicion.count();
  if (existing > 0) {
    console.log(`ℹ️ Ya existen ${existing} solicitudes de reposición. Se omite seed.`);
    return;
  }

  console.log("📋 Sembrando solicitudes de reposición demo...");
  const stockUser = refs.users.get("stock");
  const adminUser = refs.users.get("admin");
  const kitProduct = refs.products.get("trn-yam-ybrkitref");
  const pastillasProduct = refs.products.get("frn-hon-cb1del");
  const bateriaProduct = refs.products.get("ele-yam-ytx5lbs");
  const supplier1 = refs.suppliers.get("30111111118");
  const supplier2 = refs.suppliers.get("30222222228");
  const supplier3 = refs.suppliers.get("30333333338");

  if (!stockUser || !adminUser || !kitProduct || !pastillasProduct || !bateriaProduct || !supplier1 || !supplier2 || !supplier3) {
    console.log("⚠️ Faltan referencias para solicitudes demo. Se omite.");
    return;
  }

  // PENDIENTE — awaiting approval
  await prisma.solicitudReposicion.create({
    data: {
      productoId: kitProduct.id,
      cantidad: 5,
      costoUnitario: kitProduct.precioCompra,
      total: 5 * kitProduct.precioCompra,
      proveedorId: supplier1.id,
      origenPago: "EFECTIVO_CAJA",
      motivo: "Stock bajo por ventas",
      estado: "PENDIENTE",
      solicitanteId: stockUser.id,
    },
  });

  // APROBADA — already resolved
  await prisma.solicitudReposicion.create({
    data: {
      productoId: pastillasProduct.id,
      cantidad: 3,
      costoUnitario: pastillasProduct.precioCompra,
      total: 3 * pastillasProduct.precioCompra,
      proveedorId: supplier2.id,
      origenPago: "TRANSFERENCIA_BANCARIA",
      motivo: "Reposición urgente",
      estado: "APROBADA",
      solicitanteId: stockUser.id,
      aprobadorId: adminUser.id,
      resueltoEn: new Date("2026-08-18T10:00:00Z"),
    },
  });

  // RECHAZADA — rejected
  await prisma.solicitudReposicion.create({
    data: {
      productoId: bateriaProduct.id,
      cantidad: 2,
      costoUnitario: bateriaProduct.precioCompra,
      total: 2 * bateriaProduct.precioCompra,
      proveedorId: supplier3.id,
      origenPago: "EFECTIVO_CAJA",
      motivo: "Pedido de cliente",
      estado: "RECHAZADA",
      respuesta: "Fondos insuficientes en caja este mes",
      solicitanteId: stockUser.id,
      aprobadorId: adminUser.id,
      resueltoEn: new Date("2026-08-17T14:30:00Z"),
    },
  });

  console.log("  ✅ 3 solicitudes demo creadas (1 PENDIENTE, 1 APROBADA, 1 RECHAZADA)");
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

    // Always seed solicitudes if none exist
    await seedSolicitudesDemo(prisma, refs);

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
