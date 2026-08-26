import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/pasantes_db",
  }),
});

export interface ProductItem {
  nombre: string;
  codigo: string;
  categoria: string;
  marca: string;
  proveedorNombre: string;
  precioCompra: number;
  precioVenta: number;
  cantidad: number;
  stockMinimo: number;
  activo: boolean;
  imagen: string | null;
}

const CATEGORY_IMAGES: Record<string, string> = {
  "Lubricantes": "/uploads/1787256814727-9ankcz.webp",
  "Suspensión": "/uploads/1787256838982-qcmmog.webp",
  "Eléctrico": "/uploads/1787256884615-ec2s6q.webp",
  "Encendido": "/uploads/1787256924603-yyphhb.webp",
  "Transmisión": "/uploads/1787257247068-n6du8v.webp",
  "Frenos": "/uploads/1787257275289-zfrhdi.webp",
  "Neumáticos": "/uploads/1787257109231-xgu3vc.webp",
  "Filtros": "/uploads/1787257208766-dhiz8x.webp",
  "Motor": "/uploads/1787257208766-dhiz8x.webp",
  "Escape": "/uploads/1787256978094-sidqz3.webp",
  "Iluminación": "/uploads/1787257172217-pralxv.webp",
  "Refrigeración": "/uploads/1787256814727-9ankcz.webp",
  "Carrocería": "/uploads/1787257138942-7grty1.webp",
  "Indumentaria y Cascos": "/uploads/1787257138942-7grty1.webp",
  "Accesorios": "/uploads/1787257138942-7grty1.webp",
  "Herramientas": "/uploads/1787257138942-7grty1.webp",
};

export const EXACT_100_PRODUCTS: ProductItem[] = [
  // ── 1. LUBRICANTES (6) ──
  {
    nombre: "Aceite Castrol Power 1 4T 10W-40 Semisintético 1L",
    codigo: "LUB-CAS-PWR10W40",
    categoria: "Lubricantes",
    marca: "Castrol",
    proveedorNombre: "Todo Moto",
    precioCompra: 9500,
    precioVenta: 13200, // +38.9%
    cantidad: 24,
    stockMinimo: 6,
    activo: true,
    imagen: CATEGORY_IMAGES["Lubricantes"],
  },
  {
    nombre: "Aceite Motul 7100 4T 10W-50 100% Sintético Éster 1L",
    codigo: "LUB-MOT-710010W50",
    categoria: "Lubricantes",
    marca: "Motul",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 16500,
    precioVenta: 22800, // +38.2%
    cantidad: 15,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Lubricantes"],
  },
  {
    nombre: "Aceite Yamalube 4T 20W-50 Mineral Premium 1L",
    codigo: "LUB-YAM-20W50",
    categoria: "Lubricantes",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 7200,
    precioVenta: 9900, // +37.5%
    cantidad: 30,
    stockMinimo: 8,
    activo: true,
    imagen: CATEGORY_IMAGES["Lubricantes"],
  },
  {
    nombre: "Aceite Honda HGO 4T 10W-30 Genuino Honda 1L",
    codigo: "LUB-HON-10W30",
    categoria: "Lubricantes",
    marca: "Honda",
    proveedorNombre: "El Motoquero",
    precioCompra: 8500,
    precioVenta: 11800, // +38.8%
    cantidad: 40,
    stockMinimo: 10,
    activo: true,
    imagen: CATEGORY_IMAGES["Lubricantes"],
  },
  {
    nombre: "Aceite para Horquillas Motul Fork Oil Expert Medium 10W 1L",
    codigo: "LUB-MOT-FORK10W",
    categoria: "Lubricantes",
    marca: "Motul",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 12000,
    precioVenta: 16500, // +37.5%
    cantidad: 3, // [CRÍTICO 1/12]
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Lubricantes"],
  },
  {
    nombre: "Aceite 2T Castrol Super TT para Motores 2 Tiempos 1L",
    codigo: "LUB-CAS-2TSUPER",
    categoria: "Lubricantes",
    marca: "Castrol",
    proveedorNombre: "El Motoquero",
    precioCompra: 6000,
    precioVenta: 8400, // +40.0%
    cantidad: 0, // [SIN STOCK 1/6]
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Lubricantes"],
  },

  // ── 2. FRENOS (7) ──
  {
    nombre: "Pastillas de Freno Delantera Honda CB1 125",
    codigo: "FRN-HON-CB1DEL",
    categoria: "Frenos",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 4200,
    precioVenta: 5800, // +38.1%
    cantidad: 22,
    stockMinimo: 6,
    activo: true,
    imagen: CATEGORY_IMAGES["Frenos"],
  },
  {
    nombre: "Pastillas de Freno Traseras Yamaha YBR 125 / FZ FI",
    codigo: "FRN-YAM-FZTRAS",
    categoria: "Frenos",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 5800,
    precioVenta: 8000, // +37.9%
    cantidad: 16,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Frenos"],
  },
  {
    nombre: "Juego de Zapatas de Freno Trasero Honda Wave 110S",
    codigo: "FRN-HON-WAVE110ZAP",
    categoria: "Frenos",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 3500,
    precioVenta: 4900, // +40.0%
    cantidad: 35,
    stockMinimo: 8,
    activo: true,
    imagen: CATEGORY_IMAGES["Frenos"],
  },
  {
    nombre: "Disco de Freno Delantero Yamaha FZ 16 / FZ-S 282mm",
    codigo: "FRN-YAM-DISCFZ16",
    categoria: "Frenos",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 18500,
    precioVenta: 25500, // +37.8%
    cantidad: 8,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Frenos"],
  },
  {
    nombre: "Bomba de Freno Delantero Universal con Maneta Negra",
    codigo: "FRN-GEN-BOMBDEL",
    categoria: "Frenos",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 12500,
    precioVenta: 17200, // +37.6%
    cantidad: 2, // [CRÍTICO 2/12]
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Frenos"],
  },
  {
    nombre: "Flexible de Freno Delantero Mallado Universal 95cm",
    codigo: "FRN-GEN-FLEXMALL95",
    categoria: "Frenos",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 6800,
    precioVenta: 9500, // +39.7%
    cantidad: 14,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Frenos"],
  },
  {
    nombre: "Pastillas de Freno Sinterizadas Suzuki GN 125",
    codigo: "FRN-SUZ-GN125SINT",
    categoria: "Frenos",
    marca: "Suzuki",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 4800,
    precioVenta: 6600, // +37.5%
    cantidad: 0, // [SIN STOCK 2/6]
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Frenos"],
  },

  // ── 3. TRANSMISIÓN (8) ──
  {
    nombre: "Kit de Transmisión Reforzado Yamaha YBR 125 (Corona, Piñón, Cadena)",
    codigo: "TRN-YAM-YBRKITREF",
    categoria: "Transmisión",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 14500,
    precioVenta: 20000, // +37.9%
    cantidad: 12,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Transmisión"],
  },
  {
    nombre: "Kit de Transmisión Corven Triax 150 / 200 Paso 428",
    codigo: "TRN-CRV-TRIAXKIT",
    categoria: "Transmisión",
    marca: "Corven",
    proveedorNombre: "El Motoquero",
    precioCompra: 11800,
    precioVenta: 16500, // +39.8%
    cantidad: 10,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Transmisión"],
  },
  {
    nombre: "Corona Trasera 43T Honda XR 150L / XR 125L",
    codigo: "TRN-HON-COR43TXR",
    categoria: "Transmisión",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 8200,
    precioVenta: 11400, // +39.0%
    cantidad: 8,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Transmisión"],
  },
  {
    nombre: "Piñón de Ataque 14T Honda CG 150 Titan",
    codigo: "TRN-HON-PIN14TCG",
    categoria: "Transmisión",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 3400,
    precioVenta: 4700, // +38.2%
    cantidad: 25,
    stockMinimo: 6,
    activo: true,
    imagen: CATEGORY_IMAGES["Transmisión"],
  },
  {
    nombre: "Cadena de Transmisión Dorada 520H x 120L con O-Ring",
    codigo: "TRN-GEN-CAD520HORING",
    categoria: "Transmisión",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 19500,
    precioVenta: 26900, // +37.9%
    cantidad: 9,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Transmisión"],
  },
  {
    nombre: "Goma de Maza / Corona Honda Wave 110S (Juego 4 tacos)",
    codigo: "TRN-HON-TACOSWAVE",
    categoria: "Transmisión",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 2100,
    precioVenta: 2950, // +40.5%
    cantidad: 30,
    stockMinimo: 8,
    activo: true,
    imagen: CATEGORY_IMAGES["Transmisión"],
  },
  {
    nombre: "Kit de Arrastre Zanella Sapucai 150",
    codigo: "TRN-ZAN-SAP150KIT",
    categoria: "Transmisión",
    marca: "Zanella",
    proveedorNombre: "Todo Moto",
    precioCompra: 10500,
    precioVenta: 14500, // +38.1%
    cantidad: 2, // [CRÍTICO 3/12]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Transmisión"],
  },
  {
    nombre: "Kit Transmisión Descatalogado Mondial RD 150",
    codigo: "TRN-MON-RD150DESC",
    categoria: "Transmisión",
    marca: "Mondial",
    proveedorNombre: "Todo Moto",
    precioCompra: 8900,
    precioVenta: 12200, // +37.1%
    cantidad: 2, // [INACTIVO 1/2]
    stockMinimo: 0,
    activo: false,
    imagen: CATEGORY_IMAGES["Transmisión"],
  },

  // ── 4. NEUMÁTICOS (7) ──
  {
    nombre: "Cubierta 90/90-18 Pirelli City Dragon Delantera",
    codigo: "NEU-PIR-909018CITY",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorNombre: "Ruedas del Sur",
    precioCompra: 32000,
    precioVenta: 44000, // +37.5%
    cantidad: 10,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Neumáticos"],
  },
  {
    nombre: "Cubierta 2.75-17 Pirelli Super City Wave / Smash",
    codigo: "NEU-PIR-27517SC",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorNombre: "Ruedas del Sur",
    precioCompra: 22000,
    precioVenta: 30500, // +38.6%
    cantidad: 16,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Neumáticos"],
  },
  {
    nombre: "Cubierta 80/100-14 Pirelli City Cross Trasera Wave",
    codigo: "NEU-PIR-8010014CC",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorNombre: "Ruedas del Sur",
    precioCompra: 24500,
    precioVenta: 33800, // +38.0%
    cantidad: 14,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Neumáticos"],
  },
  {
    nombre: "Cubierta 110/90-17 MRF Mogrip Meteor Enduro",
    codigo: "NEU-MRF-1109017MOG",
    categoria: "Neumáticos",
    marca: "MRF",
    proveedorNombre: "Ruedas del Sur",
    precioCompra: 38000,
    precioVenta: 52000, // +36.8%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Neumáticos"],
  },
  {
    nombre: "Cámara para Moto 2.75/3.00-18 Rinaldi Válvula TR4",
    codigo: "NEU-GEN-CAM18TR4",
    categoria: "Neumáticos",
    marca: "Genérico",
    proveedorNombre: "Ruedas del Sur",
    precioCompra: 4500,
    precioVenta: 6300, // +40.0%
    cantidad: 40,
    stockMinimo: 10,
    activo: true,
    imagen: CATEGORY_IMAGES["Neumáticos"],
  },
  {
    nombre: "Cubierta 140/70-17 Pirelli Diablo Rosso II Radial Trasera",
    codigo: "NEU-PIR-1407017DR2",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorNombre: "Ruedas del Sur",
    precioCompra: 68000,
    precioVenta: 93500, // +37.5%
    cantidad: 3, // [CRÍTICO 4/12]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Neumáticos"],
  },
  {
    nombre: "Cubierta 100/90-19 Delantera Enduro Honda XR 250 Tornado",
    codigo: "NEU-PIR-1009019TOR",
    categoria: "Neumáticos",
    marca: "Pirelli",
    proveedorNombre: "Ruedas del Sur",
    precioCompra: 42000,
    precioVenta: 58000, // +38.1%
    cantidad: 0, // [SIN STOCK 3/6]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Neumáticos"],
  },

  // ── 5. ELÉCTRICO (7) ──
  {
    nombre: "Batería de Gel 12V 5Ah Yuasa YTX5L-BS Wave / Smash",
    codigo: "ELE-YAM-YTX5LBS",
    categoria: "Eléctrico",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 19000,
    precioVenta: 26000, // +36.8%
    cantidad: 14,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Eléctrico"],
  },
  {
    nombre: "Batería de Gel 12V 7Ah Bosch BTX7L-BS Honda CG Titan",
    codigo: "ELE-HON-BTX7LBS",
    categoria: "Eléctrico",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 22500,
    precioVenta: 31000, // +37.8%
    cantidad: 12,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Eléctrico"],
  },
  {
    nombre: "Regulador de Voltaje / Rectificador Honda CG 150 Titan",
    codigo: "ELE-HON-REGVOLTCG",
    categoria: "Eléctrico",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 8900,
    precioVenta: 12400, // +39.3%
    cantidad: 8,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Eléctrico"],
  },
  {
    nombre: "Relé de Arranque Universal 12V 4 Pin",
    codigo: "ELE-GEN-RELEARRAN",
    categoria: "Eléctrico",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 4500,
    precioVenta: 6300, // +40.0%
    cantidad: 20,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Eléctrico"],
  },
  {
    nombre: "Motor de Arranque / Burro Honda Wave 110S",
    codigo: "ELE-HON-BURROWAVE",
    categoria: "Eléctrico",
    marca: "Honda",
    proveedorNombre: "El Motoquero",
    precioCompra: 24000,
    precioVenta: 33000, // +37.5%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Eléctrico"],
  },
  {
    nombre: "Bocina Universal 12V Tono Grave para Moto",
    codigo: "ELE-GEN-BOCINA12V",
    categoria: "Eléctrico",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 3200,
    precioVenta: 4500, // +40.6%
    cantidad: 16,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Eléctrico"],
  },
  {
    nombre: "Llave de Contacto y Tambor con 2 Llaves Zanella ZB 110",
    codigo: "ELE-ZAN-TAMBTAMZB",
    categoria: "Eléctrico",
    marca: "Zanella",
    proveedorNombre: "El Motoquero",
    precioCompra: 6800,
    precioVenta: 9500, // +39.7%
    cantidad: 2, // [CRÍTICO 5/12]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Eléctrico"],
  },

  // ── 6. ENCENDIDO (7) ──
  {
    nombre: "Bujía de Iridium NGK CPR8EAIX-9 Alto Rendimiento",
    codigo: "ENC-NGK-CPR8EAIX",
    categoria: "Encendido",
    marca: "NGK",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 7500,
    precioVenta: 10500, // +40.0%
    cantidad: 18,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Encendido"],
  },
  {
    nombre: "Bujía NGK D8EA Honda CG 150 / Titan / XR",
    codigo: "ENC-NGK-D8EA",
    categoria: "Encendido",
    marca: "NGK",
    proveedorNombre: "El Motoquero",
    precioCompra: 1200,
    precioVenta: 1700, // +41.7%
    cantidad: 60,
    stockMinimo: 15,
    activo: true,
    imagen: CATEGORY_IMAGES["Encendido"],
  },
  {
    nombre: "Bujía NGK C7HSA 110cc Smash / Wave / Biz",
    codigo: "ENC-NGK-C7HSA",
    categoria: "Encendido",
    marca: "NGK",
    proveedorNombre: "El Motoquero",
    precioCompra: 1100,
    precioVenta: 1550, // +40.9%
    cantidad: 75,
    stockMinimo: 20,
    activo: true,
    imagen: CATEGORY_IMAGES["Encendido"],
  },
  {
    nombre: "CDI Racing sin Corte 6 Pines Universal",
    codigo: "ENC-GEN-CDIRACING",
    categoria: "Encendido",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 6500,
    precioVenta: 9100, // +40.0%
    cantidad: 11,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Encendido"],
  },
  {
    nombre: "Bobina de Alta Tensión con Capuchón NGK Siliconado",
    codigo: "ENC-NGK-BOBINAALTA",
    categoria: "Encendido",
    marca: "NGK",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 8200,
    precioVenta: 11500, // +40.2%
    cantidad: 9,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Encendido"],
  },
  {
    nombre: "Estator de Bobinas de Encendido Honda CG 150",
    codigo: "ENC-HON-ESTATORCG",
    categoria: "Encendido",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 16500,
    precioVenta: 22900, // +38.8%
    cantidad: 3, // [CRÍTICO 6/12]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Encendido"],
  },
  {
    nombre: "CDI Original Yamaha FZ 16 / FZ-S 2.0",
    codigo: "ENC-YAM-CDIFZ16",
    categoria: "Encendido",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 28000,
    precioVenta: 38500, // +37.5%
    cantidad: 0, // [SIN STOCK 4/6]
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Encendido"],
  },

  // ── 7. FILTROS (7) ──
  {
    nombre: "Filtro de Aire Esponja Honda XR 250 Tornado Lavable",
    codigo: "FLT-HON-AIRTORNADO",
    categoria: "Filtros",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 4500,
    precioVenta: 6300, // +40.0%
    cantidad: 20,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Filtros"],
  },
  {
    nombre: "Filtro de Aire Yamaha YBR 125 Elemento Seco",
    codigo: "FLT-YAM-AIRYBR125",
    categoria: "Filtros",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 3800,
    precioVenta: 5300, // +39.5%
    cantidad: 22,
    stockMinimo: 6,
    activo: true,
    imagen: CATEGORY_IMAGES["Filtros"],
  },
  {
    nombre: "Filtro de Aceite Yamaha FZ 16 / FZ 25 Original",
    codigo: "FLT-YAM-OILFZ16",
    categoria: "Filtros",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 2400,
    precioVenta: 3400, // +41.7%
    cantidad: 40,
    stockMinimo: 10,
    activo: true,
    imagen: CATEGORY_IMAGES["Filtros"],
  },
  {
    nombre: "Filtro de Combustible Nafta Universal con Imán",
    codigo: "FLT-GEN-NAFTAIMAN",
    categoria: "Filtros",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 900,
    precioVenta: 1300, // +44.4%
    cantidad: 65,
    stockMinimo: 15,
    activo: true,
    imagen: CATEGORY_IMAGES["Filtros"],
  },
  {
    nombre: "Filtro de Aire Cónico Deportivo 35mm / 38mm",
    codigo: "FLT-GEN-AIRCONICO",
    categoria: "Filtros",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 4200,
    precioVenta: 5900, // +40.5%
    cantidad: 14,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Filtros"],
  },
  {
    nombre: "Filtro de Aceite Kawasaki Ninja 300 / 400 K&N",
    codigo: "FLT-KAW-OILNINJA",
    categoria: "Filtros",
    marca: "Kawasaki",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 11000,
    precioVenta: 15200, // +38.2%
    cantidad: 3, // [CRÍTICO 7/12]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Filtros"],
  },
  {
    nombre: "Filtro de Aire Descontinuado Gilera VC 150",
    codigo: "FLT-GIL-VC150OLD",
    categoria: "Filtros",
    marca: "Gilera",
    proveedorNombre: "El Motoquero",
    precioCompra: 2500,
    precioVenta: 3500, // +40.0%
    cantidad: 1, // [INACTIVO 2/2]
    stockMinimo: 0,
    activo: false,
    imagen: CATEGORY_IMAGES["Filtros"],
  },

  // ── 8. MOTOR (7) ──
  {
    nombre: "Kit de Cilindro, Pistón y Aros Honda CG 150 57.3mm Standard",
    codigo: "MOT-HON-KITCILCG150",
    categoria: "Motor",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 34000,
    precioVenta: 47000, // +38.2%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Motor"],
  },
  {
    nombre: "Juego de Juntas de Motor Completo Honda Wave 110S",
    codigo: "MOT-HON-JUNTASWAVE",
    categoria: "Motor",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 4800,
    precioVenta: 6700, // +39.6%
    cantidad: 25,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Motor"],
  },
  {
    nombre: "Válvulas de Admisión y Escape 3B Honda CG 150 Titan (Par)",
    codigo: "MOT-HON-VALVULASCG",
    categoria: "Motor",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 6200,
    precioVenta: 8600, // +38.7%
    cantidad: 15,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Motor"],
  },
  {
    nombre: "Árbol de Levas con Balancines Corven Hunter / Triax 150",
    codigo: "MOT-CRV-LEVASTRIAX",
    categoria: "Motor",
    marca: "Corven",
    proveedorNombre: "El Motoquero",
    precioCompra: 16500,
    precioVenta: 22900, // +38.8%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Motor"],
  },
  {
    nombre: "Discos de Embrague Honda CG 150 Titan (Juego x5)",
    codigo: "MOT-HON-EMBRAGCG150",
    categoria: "Motor",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 5800,
    precioVenta: 8100, // +39.7%
    cantidad: 19,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Motor"],
  },
  {
    nombre: "Bomba de Aceite de Motor Yamaha YBR 125",
    codigo: "MOT-YAM-BOMBOILYBR",
    categoria: "Motor",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 12000,
    precioVenta: 16500, // +37.5%
    cantidad: 3, // [CRÍTICO 8/12]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Motor"],
  },
  {
    nombre: "Carburador Completo 28mm Tipo Mikuni Universal 150cc / 200cc",
    codigo: "MOT-GEN-CARB28MIK",
    categoria: "Motor",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 21500,
    precioVenta: 29500, // +37.2%
    cantidad: 0, // [SIN STOCK 5/6]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Motor"],
  },

  // ── 9. SUSPENSIÓN (7) ──
  {
    nombre: "Amortiguadores Traseros Cromados Reforzados Honda CG 150 (Par)",
    codigo: "SUS-HON-AMORTCGPAR",
    categoria: "Suspensión",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 24000,
    precioVenta: 33000, // +37.5%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Suspensión"],
  },
  {
    nombre: "Retenes de Barral y Guardapolvos Honda XR 150 / 125 (Juego)",
    codigo: "SUS-HON-RETBARRALXR",
    categoria: "Suspensión",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 3600,
    precioVenta: 5000, // +38.9%
    cantidad: 20,
    stockMinimo: 6,
    activo: true,
    imagen: CATEGORY_IMAGES["Suspensión"],
  },
  {
    nombre: "Barrales de Suspensión Delantera Cromados Yamaha YBR 125 (Par)",
    codigo: "SUS-YAM-BARRALYBR",
    categoria: "Suspensión",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 38000,
    precioVenta: 52500, // +38.2%
    cantidad: 4, // [CRÍTICO 9/12]
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Suspensión"],
  },
  {
    nombre: "Monoshock Trasero Regulable Honda XR 250 Tornado",
    codigo: "SUS-HON-MONOSHOCKTOR",
    categoria: "Suspensión",
    marca: "Honda",
    proveedorNombre: "Posadas Motos",
    precioCompra: 45000,
    precioVenta: 62000, // +37.8%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Suspensión"],
  },
  {
    nombre: "Fuelle Protector de Barrales Goma Negro 35mm (Par)",
    codigo: "SUS-GEN-FUELLE35MM",
    categoria: "Suspensión",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 2800,
    precioVenta: 3900, // +39.3%
    cantidad: 26,
    stockMinimo: 6,
    activo: true,
    imagen: CATEGORY_IMAGES["Suspensión"],
  },
  {
    nombre: "Juego de Cazoletas y Pistas de Dirección Cónicas CG / Wave",
    codigo: "SUS-GEN-PISTCONICAS",
    categoria: "Suspensión",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 4900,
    precioVenta: 6800, // +38.8%
    cantidad: 15,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Suspensión"],
  },
  {
    nombre: "Bujes de Horquillón Trasero Teflon Honda Titan (Par)",
    codigo: "SUS-HON-BUJTEFLON",
    categoria: "Suspensión",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 2400,
    precioVenta: 3400, // +41.7%
    cantidad: 22,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Suspensión"],
  },

  // ── 10. ILUMINACIÓN (7) ──
  {
    nombre: "Lámpara LED H4 Cree 8000 LM Alta y Baja con Ventilador",
    codigo: "ILU-GEN-LEDH4CREE",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 4800,
    precioVenta: 6700, // +39.6%
    cantidad: 30,
    stockMinimo: 8,
    activo: true,
    imagen: CATEGORY_IMAGES["Iluminación"],
  },
  {
    nombre: "Juego de Giros LED Secuenciales Universales Negros (4 Unidades)",
    codigo: "ILU-GEN-GIROSSECU4",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 6500,
    precioVenta: 9100, // +40.0%
    cantidad: 18,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Iluminación"],
  },
  {
    nombre: "Óptica Delantera Completa con Carcasa Honda CG 150 Titan",
    codigo: "ILU-HON-OPTICACG150",
    categoria: "Iluminación",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 13500,
    precioVenta: 18600, // +37.8%
    cantidad: 9,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Iluminación"],
  },
  {
    nombre: "Faro Trasero Stop LED Completo Yamaha FZ 16",
    codigo: "ILU-YAM-FAROSTOPFZ",
    categoria: "Iluminación",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 9800,
    precioVenta: 13600, // +38.8%
    cantidad: 11,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Iluminación"],
  },
  {
    nombre: "Lámpara Halógena H4 12V 35/35W Osram Original",
    codigo: "ILU-GEN-HALH4OSRAM",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 2100,
    precioVenta: 2950, // +40.5%
    cantidad: 50,
    stockMinimo: 12,
    activo: true,
    imagen: CATEGORY_IMAGES["Iluminación"],
  },
  {
    nombre: "Faro Auxiliar LED Explorador Ojo de Ángel (Par)",
    codigo: "ILU-GEN-AUXEXPLOR",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 8500,
    precioVenta: 11900, // +40.0%
    cantidad: 2, // [CRÍTICO 10/12]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Iluminación"],
  },
  {
    nombre: "Lámpara de Tablero T10 LED Blanco Puro x 10 unidades",
    codigo: "ILU-GEN-LEDT10X10",
    categoria: "Iluminación",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 1500,
    precioVenta: 2100, // +40.0%
    cantidad: 45,
    stockMinimo: 10,
    activo: true,
    imagen: CATEGORY_IMAGES["Iluminación"],
  },

  // ── 11. ESCAPE (5) ──
  {
    nombre: "Caño de Escape Deportivo Cott RS7 Boca Negra Honda Wave 110",
    codigo: "ESC-GEN-RS7WAVE110",
    categoria: "Escape",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 28000,
    precioVenta: 38800, // +38.6%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Escape"],
  },
  {
    nombre: "Escape Original Cromado Completo Honda CG 150 Titan ESD",
    codigo: "ESC-HON-ORIGCG150",
    categoria: "Escape",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 42000,
    precioVenta: 58000, // +38.1%
    cantidad: 3, // [CRÍTICO 11/12]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Escape"],
  },
  {
    nombre: "Junta de Boca de Escape de Bronce y Cobre Universal 110/125/150",
    codigo: "ESC-GEN-JUNTACOPPER",
    categoria: "Escape",
    marca: "Genérico",
    proveedorNombre: "El Motoquero",
    precioCompra: 600,
    precioVenta: 850, // +41.7%
    cantidad: 50,
    stockMinimo: 15,
    activo: true,
    imagen: CATEGORY_IMAGES["Escape"],
  },
  {
    nombre: "Silenciador de Escape Universal con Abrazadera",
    codigo: "ESC-GEN-SILENCUNI",
    categoria: "Escape",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 14500,
    precioVenta: 20000, // +37.9%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Escape"],
  },
  {
    nombre: "Cinta Térmica Aislante para Múltiple de Escape Titanio 5m",
    codigo: "ESC-GEN-CINTATERM5M",
    categoria: "Escape",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 5200,
    precioVenta: 7200, // +38.5%
    cantidad: 16,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Escape"],
  },

  // ── 12. REFRIGERACIÓN (4) ──
  {
    nombre: "Líquido Refrigerante / Anticongelante Motul Motocool Expert 1L",
    codigo: "REF-MOT-MOTOCOOL",
    categoria: "Refrigeración",
    marca: "Motul",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 6800,
    precioVenta: 9400, // +38.2%
    cantidad: 20,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Refrigeración"],
  },
  {
    nombre: "Radiador de Agua Completo de Aluminio Rouser NS200",
    codigo: "REF-BAJ-RADNS200",
    categoria: "Refrigeración",
    marca: "Bajaj",
    proveedorNombre: "El Motoquero",
    precioCompra: 38000,
    precioVenta: 52500, // +38.2%
    cantidad: 3, // [CRÍTICO 12/12]
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Refrigeración"],
  },
  {
    nombre: "Tapa de Radiador de Presión 1.1 Bar Universal",
    codigo: "REF-GEN-TAPARAD11",
    categoria: "Refrigeración",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 3400,
    precioVenta: 4800, // +41.2%
    cantidad: 15,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Refrigeración"],
  },
  {
    nombre: "Sensor de Temperatura / Bulbo de Radiador Yamaha FZ 25",
    codigo: "REF-YAM-BULBOTEMP",
    categoria: "Refrigeración",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 8500,
    precioVenta: 11900, // +40.0%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Refrigeración"],
  },

  // ── 13. CARROCERÍA (6) ──
  {
    nombre: "Juego de Plásticos Completo Negro Brillante Honda Wave 110S",
    codigo: "CAR-HON-KITPLASWAVE",
    categoria: "Carrocería",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 48000,
    precioVenta: 66000, // +37.5%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Carrocería"],
  },
  {
    nombre: "Guardabarro Trasero con Portapatente Honda CG 150 Titan",
    codigo: "CAR-HON-GUARDTRASCG",
    categoria: "Carrocería",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 9200,
    precioVenta: 12800, // +39.1%
    cantidad: 11,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Carrocería"],
  },
  {
    nombre: "Cubre Cadena Plástico Negro Honda CG 150 / Titan",
    codigo: "CAR-HON-CUBRECADCG",
    categoria: "Carrocería",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 3100,
    precioVenta: 4300, // +38.7%
    cantidad: 18,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Carrocería"],
  },
  {
    nombre: "Asiento Completo Antideslizante Yamaha YBR 125 ESD",
    codigo: "CAR-YAM-ASIENTOYBR",
    categoria: "Carrocería",
    marca: "Yamaha",
    proveedorNombre: "Posadas Motos",
    precioCompra: 26000,
    precioVenta: 36000, // +38.5%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Carrocería"],
  },
  {
    nombre: "Funda de Asiento Térmica de Malla Panal de Abeja Talle L",
    codigo: "CAR-GEN-FUNDAASIL",
    categoria: "Carrocería",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 3800,
    precioVenta: 5300, // +39.5%
    cantidad: 30,
    stockMinimo: 6,
    activo: true,
    imagen: CATEGORY_IMAGES["Carrocería"],
  },
  {
    nombre: "Kit de Calcomanías Completas Honda Tornado 250",
    codigo: "CAR-HON-GRAFISTOR",
    categoria: "Carrocería",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 7500,
    precioVenta: 10500, // +40.0%
    cantidad: 12,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Carrocería"],
  },

  // ── 14. INDUMENTARIA Y CASCOS (5) ──
  {
    nombre: "Casco Integral Hawk RS11 Negro Mate Talle L con Visor Antirrayas",
    codigo: "IND-GEN-CASCOHWKRS11",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 42000,
    precioVenta: 58000, // +38.1%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Indumentaria y Cascos"],
  },
  {
    nombre: "Casco Abierto / Jet MT Le Mans Cafe Racer Talle M",
    codigo: "IND-GEN-CASCOMTLEM",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 36000,
    precioVenta: 49500, // +37.5%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Indumentaria y Cascos"],
  },
  {
    nombre: "Guantes de Moto Térmicos con Protección en Nudillos Talle XL",
    codigo: "IND-GEN-GUANTESTERMXL",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorNombre: "El Motoquero",
    precioCompra: 8500,
    precioVenta: 11900, // +40.0%
    cantidad: 15,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Indumentaria y Cascos"],
  },
  {
    nombre: "Traje de Lluvia / Piloto Impermeable 2 Piezas Reforzado Talle L",
    codigo: "IND-GEN-PILOTOLLUVL",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorNombre: "El Motoquero",
    precioCompra: 14000,
    precioVenta: 19500, // +39.3%
    cantidad: 10,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Indumentaria y Cascos"],
  },
  {
    nombre: "Antiparras de Motocross / Enduro con Lente Espejado Tornasol",
    codigo: "IND-GEN-ANTIPARRAS",
    categoria: "Indumentaria y Cascos",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 6800,
    precioVenta: 9500, // +39.7%
    cantidad: 12,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Indumentaria y Cascos"],
  },

  // ── 15. ACCESORIOS (6) ──
  {
    nombre: "Baúl / Top Case Trasero 32L para 1 Casco con Base Universal",
    codigo: "ACC-GEN-BAUL32L",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 26000,
    precioVenta: 36000, // +38.5%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Accesorios"],
  },
  {
    nombre: "Soporte Celular de Aluminio para Manubrio con Cargador USB Rápido",
    codigo: "ACC-GEN-SOPCELUSB",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 7200,
    precioVenta: 10000, // +38.9%
    cantidad: 24,
    stockMinimo: 6,
    activo: true,
    imagen: CATEGORY_IMAGES["Accesorios"],
  },
  {
    nombre: "Traba Disco Antirrobo con Alarma Sonora 110dB y Cable Recordatorio",
    codigo: "ACC-GEN-TRABADISCALRM",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 9800,
    precioVenta: 13700, // +39.8%
    cantidad: 16,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Accesorios"],
  },
  {
    nombre: "Puños de Goma y Aluminio Deportivos CNC Universales 22mm (Par)",
    codigo: "ACC-GEN-PUNOSCNC22",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 3400,
    precioVenta: 4700, // +38.2%
    cantidad: 22,
    stockMinimo: 5,
    activo: true,
    imagen: CATEGORY_IMAGES["Accesorios"],
  },
  {
    nombre: "Manubrio Deportivo de Aluminio Tipo Wirtz 22mm con Pad",
    codigo: "ACC-GEN-MANUBWIRTZ",
    categoria: "Accesorios",
    marca: "Genérico",
    proveedorNombre: "Todo Moto",
    precioCompra: 16500,
    precioVenta: 23000, // +39.4%
    cantidad: 10,
    stockMinimo: 3,
    activo: true,
    imagen: CATEGORY_IMAGES["Accesorios"],
  },
  {
    nombre: "Caballete Central con Resorte y Perno Honda CG 150 Titan",
    codigo: "ACC-HON-CABALLETECG",
    categoria: "Accesorios",
    marca: "Honda",
    proveedorNombre: "Motos & Repuestos del Litoral",
    precioCompra: 11500,
    precioVenta: 16000, // +39.1%
    cantidad: 0, // [SIN STOCK 6/6]
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Accesorios"],
  },

  // ── 16. HERRAMIENTAS (4) ──
  {
    nombre: "Llave Saca Bujía Articulada 16mm / 21mm Reforzada con Mango T",
    codigo: "HER-GEN-SACABUJIA16",
    categoria: "Herramientas",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 3200,
    precioVenta: 4500, // +40.6%
    cantidad: 15,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Herramientas"],
  },
  {
    nombre: "Extractor de Volante Magnético Magneto Universal Moto 110 / 125 / 150",
    codigo: "HER-GEN-EXTRACTVOL",
    categoria: "Herramientas",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 6500,
    precioVenta: 9100, // +40.0%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Herramientas"],
  },
  {
    nombre: "Corta Cadena y Remachador Universal para Cadenas 420 a 530",
    codigo: "HER-GEN-CORTACADENA",
    categoria: "Herramientas",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 8900,
    precioVenta: 12400, // +39.3%
    cantidad: 8,
    stockMinimo: 2,
    activo: true,
    imagen: CATEGORY_IMAGES["Herramientas"],
  },
  {
    nombre: "Calibrador de Válvulas Galgas Sondas en Pulgadas y Milímetros",
    codigo: "HER-GEN-GALGASVALV",
    categoria: "Herramientas",
    marca: "Genérico",
    proveedorNombre: "Repuestos alemania",
    precioCompra: 2800,
    precioVenta: 3950, // +41.1%
    cantidad: 18,
    stockMinimo: 4,
    activo: true,
    imagen: CATEGORY_IMAGES["Herramientas"],
  },
];

async function main() {
  console.log(`Verificando lista de exactamente 100 productos...`);
  console.log(`Total productos en lista: ${EXACT_100_PRODUCTS.length}`);

  if (EXACT_100_PRODUCTS.length !== 100) {
    throw new Error(`La lista debe contener exactamente 100 productos, tiene ${EXACT_100_PRODUCTS.length}`);
  }

  // Comprobar distribución
  const normales = EXACT_100_PRODUCTS.filter((p) => p.activo && p.cantidad >= 8 && p.cantidad <= 100);
  const criticos = EXACT_100_PRODUCTS.filter((p) => p.activo && p.cantidad >= 1 && p.cantidad <= 4);
  const sinStock = EXACT_100_PRODUCTS.filter((p) => p.activo && p.cantidad === 0);
  const inactivos = EXACT_100_PRODUCTS.filter((p) => !p.activo);

  console.log(`\nDistribución exacta de los 100 productos nuevos:`);
  console.log(`- Normales (8-100 u, Activos): ${normales.length} / 80`);
  console.log(`- Críticos (1-4 u, Activos): ${criticos.length} / 12`);
  console.log(`- Sin stock (0 u, Activos): ${sinStock.length} / 6`);
  console.log(`- Inactivos: ${inactivos.length} / 2`);

  // 1. Eliminar productos previos cargados con id > 20
  await prisma.producto.deleteMany({
    where: { id: { gt: 20 } },
  });

  // 2. Asegurar categorías en DB
  const categoryNames = Array.from(new Set(EXACT_100_PRODUCTS.map((p) => p.categoria)));
  for (const catName of categoryNames) {
    await prisma.categoria.upsert({
      where: { nombre: catName },
      update: {},
      create: { nombre: catName, activo: true },
    });
  }

  // 3. Asegurar marcas en DB
  const brandNames = Array.from(new Set(EXACT_100_PRODUCTS.map((p) => p.marca)));
  for (const brandName of brandNames) {
    await prisma.marca.upsert({
      where: { nombre: brandName },
      update: {},
      create: { nombre: brandName, activo: true },
    });
  }

  // 4. Mapear Categorías, Marcas y Proveedores
  const allCategories = await prisma.categoria.findMany();
  const allBrands = await prisma.marca.findMany();
  const allSuppliers = await prisma.proveedor.findMany();

  const catMap = new Map(allCategories.map((c) => [c.nombre, c.id]));
  const brandMap = new Map(allBrands.map((b) => [b.nombre, b.id]));
  const provMap = new Map(allSuppliers.map((p) => [p.nombre, p.id]));

  for (const prod of EXACT_100_PRODUCTS) {
    const categoriaId = catMap.get(prod.categoria);
    const marcaId = brandMap.get(prod.marca);
    const proveedorId = provMap.get(prod.proveedorNombre);

    if (!categoriaId || !proveedorId) {
      throw new Error(`Falta categoría (${prod.categoria}) o proveedor (${prod.proveedorNombre}) para ${prod.nombre}`);
    }

    await prisma.producto.create({
      data: {
        nombre: prod.nombre,
        codigo: prod.codigo,
        categoriaId,
        marca: prod.marca,
        marcaId: marcaId ?? null,
        proveedorId,
        precioCompra: prod.precioCompra,
        precioVenta: prod.precioVenta,
        cantidad: prod.cantidad,
        stockMinimo: prod.stockMinimo,
        activo: prod.activo,
        imagen: prod.imagen,
      },
    });
  }

  // Estadísticas finales de la Base de Datos completa
  const totalDbProducts = await prisma.producto.findMany({
    include: {
      categoria: true,
      proveedor: true,
    },
  });

  const catCounts: Record<string, number> = {};
  const provCounts: Record<string, number> = {};
  let totalNormal = 0;
  let totalCritico = 0;
  let totalSinStock = 0;
  let totalInactivos = 0;

  for (const p of totalDbProducts) {
    catCounts[p.categoria.nombre] = (catCounts[p.categoria.nombre] || 0) + 1;
    provCounts[p.proveedor.nombre] = (provCounts[p.proveedor.nombre] || 0) + 1;

    if (!p.activo) {
      totalInactivos++;
    } else if (p.cantidad === 0) {
      totalSinStock++;
    } else if (p.cantidad <= p.stockMinimo) {
      totalCritico++;
    } else {
      totalNormal++;
    }
  }

  console.log("\n=======================================================");
  console.log("             RESUMEN FINAL DEL INVENTARIO              ");
  console.log("=======================================================");
  console.log(`TOTAL DE PRODUCTOS EN BASE DE DATOS: ${totalDbProducts.length}`);
  console.log("\n--- ESTADO DEL INVENTARIO (DASHBOARD) ---");
  console.log(`- Stock Normal (Activos): ${totalNormal}`);
  console.log(`- Stock Crítico (Activos <= Stock Mínimo): ${totalCritico}`);
  console.log(`- Sin Stock (Activos = 0): ${totalSinStock}`);
  console.log(`- Inactivos: ${totalInactivos}`);

  console.log("\n--- PRODUCTOS POR CATEGORÍA ---");
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${cat}: ${count}`);
  }

  console.log("\n--- PRODUCTOS POR PROVEEDOR ---");
  for (const [prov, count] of Object.entries(provCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${prov}: ${count}`);
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
