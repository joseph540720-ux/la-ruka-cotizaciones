import type { BusinessSettings, Customer, Product, Quote } from "./quote.ts";
import { DEFAULT_QUOTE_RECIPIENT } from "./email.ts";

export const seedBusiness: BusinessSettings = {
  name: "La Ruka",
  legalName: "",
  rut: "77.123.456-7",
  address: "San José de la Mariquina, Región de Los Ríos",
  phone: "+56 9 8765 4321",
  email: "contacto@laruka.cl",
  defaultRecipient: DEFAULT_QUOTE_RECIPIENT,
  logoDataUrl: "/la-ruka-logo.png",
};

export const seedProducts: Product[] = [
  { id: "p1", name: "Café de grano", category: "Bebestibles", unit: "persona", price: 1800, cost: 620, active: true },
  { id: "p2", name: "Té e infusiones", category: "Bebestibles", unit: "persona", price: 1200, cost: 380, active: true },
  { id: "p3", name: "Jugo natural", category: "Bebestibles", unit: "vaso", price: 1500, cost: 560, active: true },
  { id: "p4", name: "Tapaditos surtidos", category: "Salados", unit: "unidad", price: 2000, cost: 850, active: true },
  { id: "p5", name: "Mini empanadas", category: "Salados", unit: "unidad", price: 1500, cost: 670, active: true },
  { id: "p6", name: "Kuchen artesanal", category: "Dulces", unit: "porción", price: 2500, cost: 900, active: true },
  { id: "p7", name: "Galletas caseras", category: "Dulces", unit: "unidad", price: 900, cost: 310, active: true },
  { id: "p8", name: "Fruta de estación", category: "Saludable", unit: "porción", price: 1800, cost: 720, active: true },
  { id: "p9", name: "Pack coffee clásico", category: "Packs", unit: "persona", price: 6500, cost: 2950, active: true },
  { id: "p10", name: "Despacho urbano", category: "Servicios", unit: "servicio", price: 18000, cost: 9000, active: true },
];

export const seedCustomers: Customer[] = [
  { id: "c1", name: "Municipalidad de Mariquina", rut: "69.200.100-8", contact: "Carolina Soto", email: "compras@munimariquina.cl", phone: "+56 9 6123 4567", address: "Mariquina, Región de Los Ríos", compraPorMercadoPublico: true },
  { id: "c2", name: "Constructora Los Ríos", rut: "76.321.456-2", contact: "Marco Díaz", email: "administracion@constructoralosrios.cl", phone: "+56 9 7321 8821", address: "Valdivia, Región de Los Ríos", compraPorMercadoPublico: false },
  { id: "c3", name: "Escuela Valle Verde", rut: "65.104.332-1", contact: "Paula Reyes", email: "direccion@valleverde.cl", phone: "+56 9 5332 1008", address: "Lanco, Región de Los Ríos", compraPorMercadoPublico: true },
];

export const seedQuotes: Quote[] = [];
