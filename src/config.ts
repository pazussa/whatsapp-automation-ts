import 'dotenv/config';
export type Config = {
  contact_name: string;
  contact_phone?: string | null;
  headless: boolean;
  cmd_listar: string;
  cmd_crear: string;
  cmd_listar_fert: string;
  cmd_crear_fert: string;
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
  session_dir: process.env.SESSION_DIR || "~/.whatsapp-session-qa",
  nombre_base: process.env.NOMBRE_BASE || "Cultivo"
});
