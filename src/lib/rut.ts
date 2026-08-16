function limpiarRut(value: string) {
  return value.replace(/[.\-\s]/g, "").toUpperCase();
}

export function calcularDv(cuerpo: string) {
  if (!/^\d+$/.test(cuerpo)) throw new Error("El cuerpo del RUT debe contener solo números.");
  let suma = 0;
  let factor = 2;
  for (let index = cuerpo.length - 1; index >= 0; index -= 1) {
    suma += Number(cuerpo[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  return resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
}

export function esRutValido(value: string) {
  const limpio = limpiarRut(value);
  if (!/^\d+[0-9K]$/.test(limpio)) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return calcularDv(cuerpo) === dv;
}

export function formatearRut(value: string) {
  const limpio = limpiarRut(value);
  if (limpio.length < 2) return value.trim().toUpperCase();
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

export function normalizarRutOpcional(value: string): string | null {
  if (!value.trim()) return "";
  return esRutValido(value) ? formatearRut(value) : null;
}
