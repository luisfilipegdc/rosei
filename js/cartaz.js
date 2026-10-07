"use strict";
  const url = new URL("enviar.html", location.href).href;
  new QRCode(document.getElementById("qrcode"), { text: url, width: 600, height: 600, correctLevel: QRCode.CorrectLevel.H });
document.getElementById("imprimir").addEventListener("click", () => print());
