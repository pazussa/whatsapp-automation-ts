import 'dotenv/config';
export type Config = {
  contact_name: string;
  contact_phone?: string | null;
  headless: boolean;
  cmd_listar: string;
  cmd_crear: string;
  cmd_listar_fert: string;
  cmd_crear_fert: string;
  cmd_listar_fito: string;
  cmd_crear_fito: string;
  cmd_consultar_campos: string;
  cmd_consultar_distribucion: string;
  cmd_crear_campana: string;
  cmd_consultar_trabajos: string;
  cmd_consultar_trabajos_hoy: string;
  cmd_asignar_precios_producto: string;
  session_dir: string;
  nombre_base: string;
};

export const loadConfig = (): Config => ({
  contact_name: process.env.CONTACT_NAME || "Twilio",
  contact_phone: process.env.CONTACT_PHONE || null,
  headless:
    (process.env.HEADLESS || "false").toLowerCase() === "true" ||
    !process.env.DISPLAY,
  cmd_listar: process.env.CMD_LISTAR || "listar cultivos",
  cmd_crear: process.env.CMD_CREAR || "crear cultivo",
  cmd_listar_fert: process.env.CMD_LISTAR_FERT || "listar fertilizantes",
  cmd_crear_fert: process.env.CMD_CREAR_FERT || "crear fertilizante",
  cmd_listar_fito: process.env.CMD_LISTAR_FITO || "Listar productos químicos",
  cmd_crear_fito: process.env.CMD_CREAR_FITO || "crear fitosanitario",
  cmd_consultar_campos: process.env.CMD_CONSULTAR_CAMPOS || "Consultar campos sin planificar",
  cmd_consultar_distribucion: process.env.CMD_CONSULTAR_DISTRIBUCION || "Consultar distribución cultivos",
  cmd_crear_campana: process.env.CMD_CREAR_CAMPANA || "Crear campaña",
  cmd_consultar_trabajos: process.env.CMD_CONSULTAR_TRABAJOS || "Consultar trabajos",
  cmd_consultar_trabajos_hoy: process.env.CMD_CONSULTAR_TRABAJOS_HOY || "Consultar trabajos (hoy)",
  cmd_asignar_precios_producto: process.env.CMD_ASIGNAR_PRECIOS_PRODUCTO || "Asignar precios producto",
  session_dir: process.env.SESSION_DIR || "~/.whatsapp-session-qa",
  nombre_base: process.env.NOMBRE_BASE || "Cultivo"
});
