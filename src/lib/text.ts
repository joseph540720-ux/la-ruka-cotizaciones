export function customerInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("es-CL");
}

export function savedQuotesLabel(count: number) {
  return count === 1 ? "1 cotización guardada" : `${count} cotizaciones guardadas`;
}
