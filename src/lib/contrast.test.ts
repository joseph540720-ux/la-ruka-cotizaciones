import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function cssVariable(name: string) {
  const match = css.match(new RegExp(`${name}:(#[0-9a-f]{6})`, "i"));
  assert.ok(match, `No se encontró ${name} en globals.css`);
  return match[1];
}

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g);
  assert.ok(channels, `Color inválido: ${hex}`);
  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("los colores principales superan contraste WCAG AA", () => {
  const pairs = [
    ["#ffffff", cssVariable("--orange"), "texto blanco del botón primario"],
    [cssVariable("--orange-dark"), "#ffffff", "enlaces naranjos sobre blanco"],
    [cssVariable("--green"), "#eaf6f1", "estado verde sobre fondo verde claro"],
    [cssVariable("--blue"), "#edf3f7", "estado azul sobre fondo azul claro"],
    ["#59544f", "#f2efeb", "categoría sobre fondo gris"],
    ["#8a5a00", "#fff3d8", "estado pendiente sobre fondo amarillo"],
  ] as const;
  for (const [foreground, background, label] of pairs) {
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${label} no alcanza 4.5:1`);
  }
});
