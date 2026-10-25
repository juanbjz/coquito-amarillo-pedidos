// Frontend: envía el formulario al backend y muestra el resultado
const formulario = document.getElementById("formPedido");
const mensaje = document.getElementById("mensaje");

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault(); // evita recargar la página
  const boton = formulario.querySelector("button");
  boton.disabled = true;
  try {
    const datos = Object.fromEntries(new FormData(formulario));
    const respuesta = await fetch("/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });
    const resultado = await respuesta.json();
    if (respuesta.ok) {
      mensaje.className = "ok";
      mensaje.textContent = resultado.mensaje;
      formulario.reset();
    } else {
      mensaje.className = "error";
      mensaje.textContent = resultado.error;
    }
  } catch (error) {
    mensaje.className = "error";
    mensaje.textContent = "No se pudo conectar con el servidor";
  } finally {
    boton.disabled = false;
  }
});
