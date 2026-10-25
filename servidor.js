// Servidor - Coquito Amarillo S.A.S.
// Recibe pedidos y los guarda en Datos.csv y en MySQL.
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const mysql = require("mysql2/promise");

const RUTA_CSV = path.join(__dirname, "Datos.csv");
const ENCABEZADO_CSV = "nombreCliente,producto,cantidad,correo,fecha\n";

// ---------- POO: encapsula y valida un pedido ----------
class RegistroPedido {
  constructor({ nombreCliente, producto, cantidad, correo }) {
    this.nombreCliente = String(nombreCliente ?? "").trim();
    this.producto = String(producto ?? "").trim();
    this.cantidad = Number(cantidad);
    this.correo = String(correo ?? "").trim();
    this.fecha = new Date().toISOString();
  }

  // Devuelve lista de errores (vacía si todo está bien)
  validar() {
    const errores = [];
    if (!this.nombreCliente) errores.push("El nombre del cliente es obligatorio");
    if (!this.producto) errores.push("El producto es obligatorio");
    if (!Number.isInteger(this.cantidad) || this.cantidad <= 0)
      errores.push("La cantidad debe ser un entero mayor que 0");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.correo))
      errores.push("El correo electrónico no es válido");
    return errores;
  }

  // Escapa campos con comas, comillas o saltos de línea (formato CSV válido)
  static #campoCSV(valor) {
    const texto = String(valor);
    return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  }

  toCSV() {
    return [this.nombreCliente, this.producto, this.cantidad, this.correo, this.fecha]
      .map(RegistroPedido.#campoCSV).join(",") + "\n";
  }
}

// ---------- Acceso a datos ----------
class RepositorioCSV {
  async guardar(registro) {
    try { await fs.access(RUTA_CSV); }
    catch { await fs.writeFile(RUTA_CSV, ENCABEZADO_CSV, "utf8"); } // crea con encabezado
    await fs.appendFile(RUTA_CSV, registro.toCSV(), "utf8");        // agrega, no sobrescribe
  }
}

class RepositorioMySQL {
  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "coquito_amarillo",
      connectionLimit: 5
    });
  }
  async guardar(r) {
    const sql = "INSERT INTO registros (nombre_cliente, producto, cantidad, correo) VALUES (?, ?, ?, ?)";
    await this.pool.execute(sql, [r.nombreCliente, r.producto, r.cantidad, r.correo]);
  }
}

// ---------- Aplicación ----------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.redirect("/formulario.html"));

const repoCSV = new RepositorioCSV();
const repoMySQL = new RepositorioMySQL();

app.post("/registrar", async (req, res) => {
  try {
    const registro = new RegistroPedido(req.body);
    const errores = registro.validar();
    if (errores.length > 0) return res.status(400).json({ error: errores.join(". ") });

    // Se guardan en ambos destinos; si uno falla se informa cuál
    const [csv, db] = await Promise.allSettled([repoCSV.guardar(registro), repoMySQL.guardar(registro)]);
    if (csv.status === "rejected") console.error("Error CSV:", csv.reason.message);
    if (db.status === "rejected") console.error("Error MySQL:", db.reason.message);

    if (csv.status === "fulfilled" && db.status === "fulfilled")
      return res.status(201).json({ mensaje: "Pedido guardado en CSV y MySQL" });

    const fallos = [csv.status === "rejected" && "CSV", db.status === "rejected" && "MySQL"].filter(Boolean);
    return res.status(500).json({ error: `No se pudo guardar en: ${fallos.join(" y ")}` });
  } catch (error) {
    console.error("Error inesperado:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => console.log(`Servidor escuchando en http://localhost:${PUERTO}`));
