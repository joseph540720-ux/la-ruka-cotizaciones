import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import manifest from "../app/manifest.ts";

function publicFile(name: string) {
  return new URL(`../../public/${name}`, import.meta.url);
}

test("declara íconos 192, 512 y maskable", async () => {
  const icons = manifest().icons || [];
  assert.equal(icons.some((icon) => icon.sizes === "192x192"), true);
  assert.equal(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"), true);
  for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-512.png", 512]] as const) {
    const bytes = await readFile(publicFile(name));
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
});

test("el service worker conserva el shell y excluye la API", async () => {
  const worker = await readFile(publicFile("sw.js"), "utf8");
  assert.match(worker, /"\/productos"/);
  assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /caches\.match\("\/"\)/);
});
