--
-- PostgreSQL database dump
--

\restrict m0TSkXz4NRFaczRmw90ghEU9KSh0mJhkFhamYPHfrg6T4YfZZiY6ShUJNWjR61B

-- Dumped from database version 15.18
-- Dumped by pg_dump version 15.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO "user";

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: user
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO "user";

--
-- Name: cajas; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.cajas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    fecha_apertura timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_cierre timestamp(3) without time zone,
    monto_inicial double precision NOT NULL,
    total_ventas double precision DEFAULT 0.0 NOT NULL,
    estado text DEFAULT 'ABIERTA'::text NOT NULL,
    gastos_manuales double precision DEFAULT 0.0 NOT NULL,
    total_contado double precision
);


ALTER TABLE public.cajas OWNER TO "user";

--
-- Name: cajas_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.cajas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cajas_id_seq OWNER TO "user";

--
-- Name: cajas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.cajas_id_seq OWNED BY public.cajas.id;


--
-- Name: categorias; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.categorias (
    id integer NOT NULL,
    nombre text NOT NULL
);


ALTER TABLE public.categorias OWNER TO "user";

--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.categorias_id_seq OWNER TO "user";

--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.clientes (
    id integer NOT NULL,
    nombre text NOT NULL,
    dni text NOT NULL,
    telefono text,
    direccion text,
    email text,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cuit text
);


ALTER TABLE public.clientes OWNER TO "user";

--
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.clientes_id_seq OWNER TO "user";

--
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- Name: compras; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.compras (
    id integer NOT NULL,
    proveedor_id integer NOT NULL,
    usuario_id integer NOT NULL,
    total double precision DEFAULT 0.0 NOT NULL,
    fecha timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.compras OWNER TO "user";

--
-- Name: compras_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.compras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.compras_id_seq OWNER TO "user";

--
-- Name: compras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.compras_id_seq OWNED BY public.compras.id;


--
-- Name: detalle_compras; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.detalle_compras (
    id integer NOT NULL,
    compra_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL,
    costo_unitario double precision NOT NULL,
    subtotal double precision NOT NULL
);


ALTER TABLE public.detalle_compras OWNER TO "user";

--
-- Name: detalle_compras_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.detalle_compras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.detalle_compras_id_seq OWNER TO "user";

--
-- Name: detalle_compras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.detalle_compras_id_seq OWNED BY public.detalle_compras.id;


--
-- Name: detalle_ventas; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.detalle_ventas (
    id integer NOT NULL,
    venta_id integer NOT NULL,
    producto_id integer NOT NULL,
    cantidad integer NOT NULL,
    precio_unitario double precision NOT NULL,
    subtotal double precision NOT NULL
);


ALTER TABLE public.detalle_ventas OWNER TO "user";

--
-- Name: detalle_ventas_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.detalle_ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.detalle_ventas_id_seq OWNER TO "user";

--
-- Name: detalle_ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.detalle_ventas_id_seq OWNED BY public.detalle_ventas.id;


--
-- Name: empleados; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.empleados (
    id integer NOT NULL,
    nombre text NOT NULL,
    apellido text NOT NULL,
    cargo text NOT NULL,
    usuario_id integer,
    activo boolean DEFAULT true NOT NULL
);


ALTER TABLE public.empleados OWNER TO "user";

--
-- Name: empleados_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.empleados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.empleados_id_seq OWNER TO "user";

--
-- Name: empleados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.empleados_id_seq OWNED BY public.empleados.id;


--
-- Name: movimientos_caja; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.movimientos_caja (
    id integer NOT NULL,
    caja_id integer NOT NULL,
    usuario_id integer NOT NULL,
    venta_id integer,
    compra_id integer,
    tipo text NOT NULL,
    monto double precision NOT NULL,
    descripcion text NOT NULL,
    fecha timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.movimientos_caja OWNER TO "user";

--
-- Name: movimientos_caja_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.movimientos_caja_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.movimientos_caja_id_seq OWNER TO "user";

--
-- Name: movimientos_caja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.movimientos_caja_id_seq OWNED BY public.movimientos_caja.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    nombre text NOT NULL,
    categoria_id integer NOT NULL,
    precio_compra double precision NOT NULL,
    precio_venta double precision NOT NULL,
    cantidad integer DEFAULT 0 NOT NULL,
    stock_minimo integer DEFAULT 0 NOT NULL,
    proveedor_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    codigo text,
    imagen text,
    marca text
);


ALTER TABLE public.productos OWNER TO "user";

--
-- Name: productos_favoritos; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.productos_favoritos (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    producto_id integer NOT NULL,
    creado_en timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.productos_favoritos OWNER TO "user";

--
-- Name: productos_favoritos_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.productos_favoritos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.productos_favoritos_id_seq OWNER TO "user";

--
-- Name: productos_favoritos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.productos_favoritos_id_seq OWNED BY public.productos_favoritos.id;


--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.productos_id_seq OWNER TO "user";

--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.proveedores (
    id integer NOT NULL,
    nombre text NOT NULL,
    telefono text,
    direccion text,
    email text,
    cuit text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    contacto_responsable text,
    creado_en timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.proveedores OWNER TO "user";

--
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.proveedores_id_seq OWNER TO "user";

--
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.proveedores_id_seq OWNED BY public.proveedores.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    nombre text NOT NULL,
    permisos text
);


ALTER TABLE public.roles OWNER TO "user";

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_seq OWNER TO "user";

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    nombre_completo text NOT NULL,
    dni text NOT NULL,
    correo text,
    telefono text,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rol_id integer NOT NULL,
    foto_actualizada_en timestamp(3) without time zone,
    foto_url text
);


ALTER TABLE public.usuarios OWNER TO "user";

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.usuarios_id_seq OWNER TO "user";

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: ventas; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.ventas (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    usuario_id integer NOT NULL,
    total double precision DEFAULT 0.0 NOT NULL,
    fecha timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    estado text DEFAULT 'COMPLETADA'::text NOT NULL,
    metodo_pago text,
    descuento_tipo text,
    monto_descuento double precision DEFAULT 0.0 NOT NULL,
    tipo_comprobante text,
    cuotas integer
);


ALTER TABLE public.ventas OWNER TO "user";

--
-- Name: ventas_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.ventas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ventas_id_seq OWNER TO "user";

--
-- Name: ventas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.ventas_id_seq OWNED BY public.ventas.id;


--
-- Name: cajas id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.cajas ALTER COLUMN id SET DEFAULT nextval('public.cajas_id_seq'::regclass);


--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- Name: compras id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.compras ALTER COLUMN id SET DEFAULT nextval('public.compras_id_seq'::regclass);


--
-- Name: detalle_compras id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.detalle_compras ALTER COLUMN id SET DEFAULT nextval('public.detalle_compras_id_seq'::regclass);


--
-- Name: detalle_ventas id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.detalle_ventas ALTER COLUMN id SET DEFAULT nextval('public.detalle_ventas_id_seq'::regclass);


--
-- Name: empleados id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.empleados ALTER COLUMN id SET DEFAULT nextval('public.empleados_id_seq'::regclass);


--
-- Name: movimientos_caja id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.movimientos_caja ALTER COLUMN id SET DEFAULT nextval('public.movimientos_caja_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: productos_favoritos id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.productos_favoritos ALTER COLUMN id SET DEFAULT nextval('public.productos_favoritos_id_seq'::regclass);


--
-- Name: proveedores id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.proveedores ALTER COLUMN id SET DEFAULT nextval('public.proveedores_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: ventas id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.ventas ALTER COLUMN id SET DEFAULT nextval('public.ventas_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
8ad73c9b-1ac5-4872-8d20-a02e06c8a7c5	e6abca96cec4f4b3c0dcffa409bee5f4d9827b984dee86a8fc23c679b977ba60	2026-06-01 04:29:15.696799+00	20260601040600_add_informe_fields		\N	2026-06-01 04:29:15.696799+00	0
1553c82d-f12a-4866-9561-cb063219fc72	3e603d10494a6be1176b88745be266d755bb6f3a4dff3db24da08fa9c846fa1a	2026-06-01 07:26:36.957731+00	20260525043815_init		\N	2026-06-01 07:26:36.957731+00	0
9937d79c-61c9-417d-a747-7555aea6fb5e	a0b91672540f9da39a9daee1ded662fa190ab0a1d4d506b05f63f76ad6c5d9d0	2026-07-22 01:45:27.085426+00	20260721000000_add_producto_favorito	\N	\N	2026-07-22 01:45:27.034117+00	1
\.


--
-- Data for Name: cajas; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.cajas (id, usuario_id, fecha_apertura, fecha_cierre, monto_inicial, total_ventas, estado, gastos_manuales, total_contado) FROM stdin;
1	1	2026-05-26 00:18:10.032	2026-06-01 18:02:38.417	100000	-1573400	CERRADA	0	\N
2	1	2026-06-01 18:15:08.95	\N	100000	741316	ABIERTA	0	\N
\.


--
-- Data for Name: categorias; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.categorias (id, nombre) FROM stdin;
1	Transmisi├│n
2	Frenos
3	El├®ctrico
4	Neum├íticos
5	Lubricantes
6	Motor
7	Encendido
8	Iluminaci├│n
9	Suspensi├│n
10	Accesorios
\.


--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.clientes (id, nombre, dni, telefono, direccion, email, activo, creado_en, cuit) FROM stdin;
1	Empresa Alfa SRL	30712345678	3764555123	Av. Corrientes 1500	alfa@empresa.com	t	2026-05-26 01:41:39.657	\N
2	Ricardo G├│mez	20123456789	3764123456	Calle San Mart├¡n 890	ricardo@correo.com	t	2026-05-26 01:41:39.657	\N
4	Mar├¡a Elena D├¡az	27011223344	3764999000	Av. Uruguay 450	maria@correo.com	t	2026-05-26 01:41:39.657	\N
5	Ferreter├¡a Central	30654321098	3764222111	Calle Col├│n 2300	contacto@central.com	t	2026-05-26 01:41:39.657	\N
3	Distribuidora El Litoral S.A.	33987654321	3764888777	Ruta Nacional 12 Km 5	litoral@distri.com	t	2026-05-26 01:41:39.657	\N
6	emanuel acu├▒a	42205499	3765243554	\N	\N	t	2026-07-14 02:26:51.336	\N
7	Garcia Mayoral Alvaro Lionel	35123456	\N	\N	\N	t	2026-07-14 21:17:40.564	\N
\.


--
-- Data for Name: compras; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.compras (id, proveedor_id, usuario_id, total, fecha) FROM stdin;
1	8	1	80000	2026-05-26 00:25:50.465
2	8	1	100	2026-05-26 00:27:55.75
3	8	1	600	2026-05-26 00:29:21.918
4	8	1	300	2026-05-26 00:30:28.054
5	8	1	600	2026-05-26 00:30:57.51
6	8	1	1200	2026-05-26 00:31:30.147
7	2	1	200	2026-05-26 00:44:03.941
8	8	1	400000	2026-06-01 18:01:58.751
9	8	1	1120000	2026-06-01 18:02:09.855
10	3	1	10500	2026-06-04 01:00:09.574
11	8	1	540	2026-06-21 02:45:58.355
12	8	1	240000	2026-07-14 20:04:10.097
\.


--
-- Data for Name: detalle_compras; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.detalle_compras (id, compra_id, producto_id, cantidad, costo_unitario, subtotal) FROM stdin;
1	1	7	1	80000	80000
2	2	8	10	10	100
3	3	9	20	30	600
4	4	10	5	60	300
5	5	11	20	30	600
6	6	12	30	40	1200
7	7	13	10	20	200
8	8	7	5	80000	400000
9	9	7	14	80000	1120000
10	10	6	1	10500	10500
11	11	10	9	60	540
12	12	9	8	30000	240000
\.


--
-- Data for Name: detalle_ventas; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.detalle_ventas (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) FROM stdin;
1	1	9	10	60	600
2	2	6	2	15000	30000
3	3	10	1	80	80
4	4	9	2	60	120
5	4	6	1	15000	15000
6	4	1	1	15000	15000
7	4	2	1	7500	7500
8	5	6	3	15000	45000
9	5	10	2	80	160
10	6	6	1	15000	15000
11	6	9	1	60	60
12	6	10	1	80	80
13	7	6	5	15000	75000
14	7	9	1	60	60
15	8	9	1	60	60
16	9	9	1	60	60
17	10	9	1	60	60
18	11	10	3	80	240
19	12	9	1	60	60
20	13	6	1	15000	15000
21	14	9	1	60	60
22	15	9	1	60	60
23	16	6	1	15000	15000
24	17	3	1	25000	25000
25	18	6	1	15000	15000
26	19	6	1	15000	15000
27	20	7	1	98000	98000
28	21	7	1	98000	98000
29	22	6	1	15000	15000
30	23	10	1	80	80
31	24	10	1	80	80
32	25	10	1	80	80
33	25	3	2	25000	50000
34	25	7	1	98000	98000
35	26	4	1	45000	45000
36	27	6	1	15000	15000
37	28	6	2	15000	30000
38	29	9	1	60000	60000
39	29	6	1	15000	15000
40	29	8	1	20	20
41	30	9	2	60000	120000
42	30	12	1	60	60
43	30	6	1	15000	15000
44	31	9	1	60000	60000
45	31	4	1	45000	45000
\.


--
-- Data for Name: empleados; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.empleados (id, nombre, apellido, cargo, usuario_id, activo) FROM stdin;
1	Administrador	General	Gerente	1	t
\.


--
-- Data for Name: movimientos_caja; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.movimientos_caja (id, caja_id, usuario_id, venta_id, compra_id, tipo, monto, descripcion, fecha) FROM stdin;
1	1	1	\N	\N	INGRESO	100000	Saldo inicial de apertura de caja	2026-05-26 00:18:10.036
2	1	1	\N	1	EGRESO	80000	Stock inicial de 'Disco Freno Grande 290 Mm Honda Cg 150 Old' x1	2026-05-26 00:25:50.475
3	1	1	\N	2	EGRESO	100	Stock inicial de 'Guardabarros delantero Suzuki RM500 RM 500' x10	2026-05-26 00:27:55.758
4	1	1	\N	3	EGRESO	600	Stock inicial de 'Bater├¡a AGM Yb9A-A para Honda 31500-968-013Ah' x20	2026-05-26 00:29:21.927
5	1	1	\N	4	EGRESO	300	Stock inicial de 'Bater├¡a AGM para moto YTX14-BS alto rendimiento sin mantenimiento sellada' x5	2026-05-26 00:30:28.061
6	1	1	\N	5	EGRESO	600	Stock inicial de 'YTX14-BS Alto Rendimiento - Sin Mantenimiento - Bater├¡a Sellada ETX14 BS' x20	2026-05-26 00:30:57.521
7	1	1	\N	6	EGRESO	1200	Stock inicial de 'Compartir Bater├¡a Cromada Recargable YTX14-BS Power Sports Bater├¡a Reemplaci├│n GYZ16H' x30	2026-05-26 00:31:30.156
8	1	1	\N	7	EGRESO	200	Stock inicial de 'Condensador con fusible. Bicicletas de tierra de arranque con inyecci├│n de combustible (EFI y TPI) con bater├¡a muerta' x10	2026-05-26 00:44:03.949
9	1	1	\N	\N	EGRESO	1000	Gasto: chipa	2026-05-26 00:51:21.363
10	1	1	1	\N	INGRESO	600	Venta - Factura N┬║ 1	2026-05-27 01:21:34.968
11	1	1	2	\N	INGRESO	30000	Venta - Factura N┬║ 2	2026-05-27 17:38:08.518
12	1	1	\N	8	EGRESO	400000	Reposici├│n de 'Disco Freno Grande 290 Mm Honda Cg 150 Old' x5	2026-06-01 18:01:58.8
13	1	1	\N	9	EGRESO	1120000	Reposici├│n de 'Disco Freno Grande 290 Mm Honda Cg 150 Old' x14	2026-06-01 18:02:09.87
14	2	1	\N	\N	INGRESO	100000	Saldo inicial de apertura de caja	2026-06-01 18:15:08.968
15	2	1	3	\N	INGRESO	80	Venta - Factura N┬║ 3	2026-06-01 18:15:17.988
16	2	1	4	\N	INGRESO	37620	Venta - Factura N┬║ 4	2026-06-01 18:58:25.039
17	2	1	\N	10	EGRESO	10500	Reposici├│n de 'Amortiguador trasero Monoshock FZ16' x1	2026-06-04 01:00:09.59
18	2	1	5	\N	INGRESO	45160	Venta - Factura N┬║ 5	2026-06-04 01:01:49.269
19	2	1	6	\N	INGRESO	15140	Venta - Factura N┬║ 6	2026-06-21 02:36:42.866
20	2	1	\N	11	EGRESO	540	Reposici├│n de 'Bater├¡a AGM para moto YTX14-BS alto rendimiento sin mantenimiento sellada' x9	2026-06-21 02:45:58.367
21	2	1	7	\N	INGRESO	75060	Venta - Factura N┬║ 7	2026-06-21 02:46:10.829
22	2	1	\N	\N	EGRESO	9000	Gasto: chipa	2026-06-21 02:54:43.875
23	2	2	8	\N	INGRESO	60	Venta - Factura N┬║ 8	2026-07-13 21:03:40.128
24	2	1	9	\N	INGRESO	60	FACTURA_B N┬║ 9 - TARJETA_CREDITO	2026-07-14 02:35:58.42
25	2	1	10	\N	INGRESO	60	FACTURA_C N┬║ 10 - EFECTIVO	2026-07-14 02:46:01.493
26	2	1	11	\N	INGRESO	216	FACTURA_B N┬║ 11 - EFECTIVO (Dto: $24.00)	2026-07-14 02:46:49.846
27	2	1	12	\N	INGRESO	60	FACTURA_B N┬║ 12 - TARJETA_DEBITO	2026-07-14 02:48:15.41
28	2	1	13	\N	INGRESO	15000	FACTURA_B N┬║ 13 - EFECTIVO	2026-07-14 02:50:14.972
29	2	1	14	\N	INGRESO	60	FACTURA_C N┬║ 14 - EFECTIVO	2026-07-14 02:51:19.666
30	2	1	15	\N	INGRESO	60	FACTURA_C N┬║ 15 - EFECTIVO	2026-07-14 02:53:05.151
31	2	1	16	\N	INGRESO	15000	FACTURA_B N┬║ 16 - EFECTIVO	2026-07-14 02:53:36.773
32	2	1	17	\N	INGRESO	25000	FACTURA_C N┬║ 17 - EFECTIVO	2026-07-14 02:55:12.006
33	2	1	18	\N	INGRESO	15000	FACTURA_C N┬║ 18 - EFECTIVO	2026-07-14 02:57:09.309
34	2	1	19	\N	INGRESO	15000	FACTURA_A N┬║ 19 - EFECTIVO	2026-07-14 02:58:07.646
35	2	1	20	\N	INGRESO	98000	FACTURA_B N┬║ 20 - EFECTIVO	2026-07-14 02:59:43.671
36	2	1	21	\N	INGRESO	98000	FACTURA_B N┬║ 21 - EFECTIVO	2026-07-14 03:01:12.87
37	2	1	22	\N	INGRESO	15000	FACTURA_B N┬║ 22 - EFECTIVO	2026-07-14 03:02:46.301
38	2	1	23	\N	INGRESO	80	FACTURA_B N┬║ 23 - EFECTIVO	2026-07-14 03:06:24.939
39	2	1	24	\N	INGRESO	80	FACTURA_B N┬║ 24 - EFECTIVO	2026-07-14 03:50:57.082
40	2	1	25	\N	INGRESO	148080	FACTURA_B N┬║ 25 - EFECTIVO	2026-07-14 03:51:42.662
41	2	2	26	\N	INGRESO	45000	FACTURA_C N┬║ 26 - EFECTIVO	2026-07-14 04:02:31.992
42	2	1	27	\N	INGRESO	15000	FACTURA_B N┬║ 27 - EFECTIVO	2026-07-14 04:31:19.449
43	2	1	\N	12	EGRESO	240000	Reposici├│n de 'Bater├¡a AGM Yb9A-A para Honda 31500-968-013Ah' x8	2026-07-14 20:04:10.121
44	2	1	28	\N	INGRESO	29400	FACTURA_B N┬║ 28 - EFECTIVO (Dto: $600.00)	2026-07-14 20:35:33.125
45	2	1	29	\N	INGRESO	75020	FACTURA_C N┬║ 29 - TRANSFERENCIA	2026-07-14 22:08:19.461
46	2	1	30	\N	INGRESO	135060	FACTURA_B N┬║ 30 - EFECTIVO	2026-07-15 00:32:53.159
47	2	1	31	\N	INGRESO	84000	FACTURA_C N┬║ 31 - EFECTIVO (Dto: $21000.00)	2026-07-22 00:05:45.728
\.


--
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.productos (id, nombre, categoria_id, precio_compra, precio_venta, cantidad, stock_minimo, proveedor_id, activo, codigo, imagen, marca) FROM stdin;
5	Aceite Motul 5100 15W-50 4T	5	8400	12000	19	20	5	f	\N	\N	\N
10	Bater├¡a AGM para moto YTX14-BS alto rendimiento sin mantenimiento sellada	3	60	80	4	2	8	t	\N	/uploads/1783994182309-5ufx79.webp	\N
3	Bater├¡a YTX7L-BS para Yamaha FZ16	3	18000	25000	17	5	3	t	\N	/uploads/1783994252200-n6hxrg.webp	\N
7	Disco Freno Grande 290 Mm Honda Cg 150 Old	2	80000	98000	17	2	8	t	\N	/uploads/1783994375572-g7dxdl.webp	\N
8	Guardabarros delantero Suzuki RM500 RM 500	10	10	20	9	5	8	t	\N	/uploads/1783994411401-rdyb53.webp	\N
13	Condensador con fusible. Bicicletas de tierra de arranque con inyecci├│n de combustible (EFI y TPI) con bater├¡a muerta	3	20	35	10	2	2	t	\N	/uploads/1783994311392-49olr2.webp	\N
1	Kit de transmisi├│n para Honda CG 150	1	10500	15000	99	10	1	t	\N	/uploads/1783994431874-0ubpzf.webp	\N
11	YTX14-BS Alto Rendimiento - Sin Mantenimiento - Bater├¡a Sellada ETX14 BS	3	30	40	20	5	8	t	\N	/uploads/1783994476358-4rezkj.webp	\N
12	Bater├¡a Cromada Recargable YTX14-BS Power Sports Bater├¡a Reemplaci├│n GYZ16H	3	40	60	29	10	8	t	\N	/uploads/1783994280256-7znat5.jpg	\N
6	Amortiguador trasero Monoshock FZ16	9	10500	15000	9	5	3	t	\N	/uploads/1783993604453-tsvgox.webp	\N
2	Pastillas de freno delantero Rouser NS200	2	5250	7500	99	15	2	t	\N	/uploads/1784678530331-jx8ogw.webp	\N
9	Bater├¡a AGM Yb9A-A para Honda 31500-968-013Ah	3	30000	60000	4	2	8	t	\N	/uploads/1783994134261-b6u1ge.webp	\N
4	Cubierta trasera 130/70-17 Pirelli	4	31500	45000	12	4	4	t	\N	/uploads/1783994346515-fs2lv6.webp	\N
\.


--
-- Data for Name: productos_favoritos; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.productos_favoritos (id, usuario_id, producto_id, creado_en) FROM stdin;
\.


--
-- Data for Name: proveedores; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.proveedores (id, nombre, telefono, direccion, email, cuit, activo, contacto_responsable, creado_en) FROM stdin;
3	Posadas Motos	3764567890	Calle La Rioja 123, Posadas	ventas@posadasmotos.com.ar	30333333338	t	\N	2026-05-26 00:04:24.964
4	Ruedas del Sur	3764321098	Av. Uruguay 3456, Posadas	info@ruedasdelsur.com.ar	30444444448	t	\N	2026-05-26 00:04:24.964
5	Todo Moto	3764876543	Av. San Mart├¡n 100, Garup├í	contacto@todomoto.com.ar	30555555558	t	\N	2026-05-26 00:04:24.964
8	Repuestos alemania	03765243554	5989 100 y 121	acumanu56@gmail.com	20422054996	t	\N	2026-05-26 00:24:05.407
2	El Motoquero	3764987654	Av. Corrientes 2345, Posadas	info@elmotoquero.com.ar	30222222228	t	\N	2026-05-26 00:04:24.964
1	Motos & Repuestos del Litoral	3764123456	Av. Roque Saenz Pe├▒a 1500, Posadas	contacto@motoslitoral.com.ar	30111111118	t	\N	2026-05-26 00:04:24.964
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.roles (id, nombre, permisos) FROM stdin;
1	ADMINISTRADOR	\N
2	ENCARGADO_VENTAS	\N
3	ENCARGADO_STOCK	\N
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.usuarios (id, username, password_hash, nombre_completo, dni, correo, telefono, activo, creado_en, rol_id, foto_actualizada_en, foto_url) FROM stdin;
1	admin	$2b$10$S6GqHCetsK40fEuXkQN.jO7xEdrSCS1Y12aol.b2Dl1FWgrvUOH6.	Administrador General	00000001	admin@chopperrepuestos.com	3764000001	t	2026-05-25 23:32:54.378	1	2026-07-14 04:27:53.831	/uploads/avatars/avatar-1-1784003273829.jpg
3	stock	$2b$10$S6GqHCetsK40fEuXkQN.jO7xEdrSCS1Y12aol.b2Dl1FWgrvUOH6.	Mar├¡a Garc├¡a	36789012	maria@chopperrepuestos.com	3764555002	t	2026-05-25 23:32:54.399	3	2026-07-14 04:27:23.671	/uploads/avatars/avatar-3-1784003243669.webp
2	carlos	$2b$10$S6GqHCetsK40fEuXkQN.jO7xEdrSCS1Y12aol.b2Dl1FWgrvUOH6.	Carlos L├│pez	35123456	carlos@chopperrepuestos.com	3764555001	t	2026-05-25 23:32:54.394	2	2026-07-14 04:27:41.922	/uploads/avatars/avatar-2-1784003261920.webp
\.


--
-- Data for Name: ventas; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.ventas (id, cliente_id, usuario_id, total, fecha, estado, metodo_pago, descuento_tipo, monto_descuento, tipo_comprobante, cuotas) FROM stdin;
1	4	1	600	2026-05-27 01:21:34.957	COMPLETADA	\N	\N	0	\N	\N
2	3	1	30000	2026-05-27 17:38:08.507	COMPLETADA	\N	\N	0	\N	\N
3	1	1	80	2026-06-01 18:15:17.969	COMPLETADA	\N	\N	0	\N	\N
4	3	1	37620	2026-06-01 18:58:25.017	COMPLETADA	\N	\N	0	\N	\N
5	3	1	45160	2026-06-04 01:01:49.259	COMPLETADA	\N	\N	0	\N	\N
6	3	1	15140	2026-06-21 02:36:42.851	COMPLETADA	\N	\N	0	\N	\N
7	3	1	75060	2026-06-21 02:46:10.823	COMPLETADA	\N	\N	0	\N	\N
8	1	2	60	2026-07-13 21:03:40.116	COMPLETADA	\N	\N	0	\N	\N
9	1	1	60	2026-07-14 02:35:58.409	COMPLETADA	TARJETA_CREDITO	MONTO	0	FACTURA_B	3
10	3	1	60	2026-07-14 02:46:01.486	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_C	\N
11	3	1	216	2026-07-14 02:46:49.837	COMPLETADA	EFECTIVO	PORCENTAJE	24	FACTURA_B	\N
12	1	1	60	2026-07-14 02:48:15.402	COMPLETADA	TARJETA_DEBITO	PORCENTAJE	0	FACTURA_B	\N
13	1	1	15000	2026-07-14 02:50:14.965	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
14	1	1	60	2026-07-14 02:51:19.66	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_C	\N
15	1	1	60	2026-07-14 02:53:05.142	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_C	\N
16	3	1	15000	2026-07-14 02:53:36.768	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
17	2	1	25000	2026-07-14 02:55:11.999	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_C	\N
18	4	1	15000	2026-07-14 02:57:09.302	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_C	\N
19	6	1	15000	2026-07-14 02:58:07.638	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_A	\N
20	1	1	98000	2026-07-14 02:59:43.664	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
21	1	1	98000	2026-07-14 03:01:12.864	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
22	1	1	15000	2026-07-14 03:02:46.294	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
23	3	1	80	2026-07-14 03:06:24.932	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
24	5	1	80	2026-07-14 03:50:57.068	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
25	3	1	148080	2026-07-14 03:51:42.653	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
26	1	2	45000	2026-07-14 04:02:31.985	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_C	\N
27	3	1	15000	2026-07-14 04:31:19.441	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
28	1	1	29400	2026-07-14 20:35:33.107	COMPLETADA	EFECTIVO	PORCENTAJE	600	FACTURA_B	\N
29	3	1	75020	2026-07-14 22:08:19.444	COMPLETADA	TRANSFERENCIA	MONTO	0	FACTURA_C	\N
30	1	1	135060	2026-07-15 00:32:53.147	COMPLETADA	EFECTIVO	MONTO	0	FACTURA_B	\N
31	1	1	84000	2026-07-22 00:05:45.713	COMPLETADA	EFECTIVO	PORCENTAJE	21000	FACTURA_C	\N
\.


--
-- Name: cajas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.cajas_id_seq', 2, true);


--
-- Name: categorias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.categorias_id_seq', 10, true);


--
-- Name: clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.clientes_id_seq', 7, true);


--
-- Name: compras_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.compras_id_seq', 12, true);


--
-- Name: detalle_compras_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.detalle_compras_id_seq', 12, true);


--
-- Name: detalle_ventas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.detalle_ventas_id_seq', 45, true);


--
-- Name: empleados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.empleados_id_seq', 1, false);


--
-- Name: movimientos_caja_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.movimientos_caja_id_seq', 47, true);


--
-- Name: productos_favoritos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.productos_favoritos_id_seq', 3, true);


--
-- Name: productos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.productos_id_seq', 13, true);


--
-- Name: proveedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.proveedores_id_seq', 8, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.roles_id_seq', 3, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 4, true);


--
-- Name: ventas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.ventas_id_seq', 31, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: cajas cajas_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_pkey PRIMARY KEY (id);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);


--
-- Name: detalle_compras detalle_compras_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.detalle_compras
    ADD CONSTRAINT detalle_compras_pkey PRIMARY KEY (id);


--
-- Name: detalle_ventas detalle_ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.detalle_ventas
    ADD CONSTRAINT detalle_ventas_pkey PRIMARY KEY (id);


--
-- Name: empleados empleados_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_pkey PRIMARY KEY (id);


--
-- Name: movimientos_caja movimientos_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_pkey PRIMARY KEY (id);


--
-- Name: productos_favoritos productos_favoritos_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.productos_favoritos
    ADD CONSTRAINT productos_favoritos_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- Name: categorias_nombre_key; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX categorias_nombre_key ON public.categorias USING btree (nombre);


--
-- Name: clientes_cuit_key; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX clientes_cuit_key ON public.clientes USING btree (cuit);


--
-- Name: clientes_dni_key; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX clientes_dni_key ON public.clientes USING btree (dni);


--
-- Name: empleados_usuario_id_key; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX empleados_usuario_id_key ON public.empleados USING btree (usuario_id);


--
-- Name: productos_favoritos_usuario_id_producto_id_key; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX productos_favoritos_usuario_id_producto_id_key ON public.productos_favoritos USING btree (usuario_id, producto_id);


--
-- Name: proveedores_cuit_key; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX proveedores_cuit_key ON public.proveedores USING btree (cuit);


--
-- Name: roles_nombre_key; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX roles_nombre_key ON public.roles USING btree (nombre);


--
-- Name: usuarios_dni_key; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX usuarios_dni_key ON public.usuarios USING btree (dni);


--
-- Name: usuarios_username_key; Type: INDEX; Schema: public; Owner: user
--

CREATE UNIQUE INDEX usuarios_username_key ON public.usuarios USING btree (username);


--
-- Name: cajas cajas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: compras compras_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: compras compras_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: detalle_compras detalle_compras_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.detalle_compras
    ADD CONSTRAINT detalle_compras_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: detalle_compras detalle_compras_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.detalle_compras
    ADD CONSTRAINT detalle_compras_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: detalle_ventas detalle_ventas_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.detalle_ventas
    ADD CONSTRAINT detalle_ventas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: detalle_ventas detalle_ventas_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.detalle_ventas
    ADD CONSTRAINT detalle_ventas_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: empleados empleados_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.empleados
    ADD CONSTRAINT empleados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: movimientos_caja movimientos_caja_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_caja_id_fkey FOREIGN KEY (caja_id) REFERENCES public.cajas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: movimientos_caja movimientos_caja_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: movimientos_caja movimientos_caja_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: movimientos_caja movimientos_caja_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: productos productos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: productos_favoritos productos_favoritos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.productos_favoritos
    ADD CONSTRAINT productos_favoritos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: productos_favoritos productos_favoritos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.productos_favoritos
    ADD CONSTRAINT productos_favoritos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: productos productos_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ventas ventas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ventas ventas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: user
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict m0TSkXz4NRFaczRmw90ghEU9KSh0mJhkFhamYPHfrg6T4YfZZiY6ShUJNWjR61B

