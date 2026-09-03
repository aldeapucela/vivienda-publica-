#!/usr/bin/env node
// Test de contraste: falla si algún par de tokens de src/styles.css baja de lo
// que exige WCAG 2.2 AA (4,5:1 en texto, 3:1 en componentes), en claro y en
// oscuro. Lee los tokens del propio CSS: si alguien cambia un color, el test
// cambia con él.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(RAIZ, 'src/styles.css'), 'utf8');

// [primer plano, fondo, mínimo]
const PARES = [
  ['--tinta', '--papel', 4.5], ['--tinta', '--panel', 4.5],
  ['--tinta-suave', '--papel', 4.5], ['--tinta-suave', '--panel', 4.5],
  ['--acento', '--papel', 4.5], ['--acento', '--panel', 4.5], ['--acento', '--acento-fondo', 4.5],
  ['--acento-fuerte', '--panel', 4.5],
  ['--sobre-acento', '--acento', 4.5],
  ['--libre', '--libre-fondo', 4.5], ['--libre', '--panel', 4.5],
  ['--ocupada', '--ocupada-fondo', 4.5], ['--ocupada', '--panel', 4.5],
  ['--urge', '--papel', 4.5], ['--urge', '--panel', 4.5],
  ['--aviso', '--aviso-fondo', 4.5],
  ['--libre-barra', '--linea', 3],
];

function tokens(bloque) {
  const m = {};
  for (const [, k, v] of bloque.matchAll(/(--[a-z-]+)\s*:\s*(#[0-9a-f]{6})\b/gi)) m[k] = v.toLowerCase();
  return m;
}
function bloque(selector) {
  const i = css.indexOf(selector);
  if (i === -1) throw new Error(`no encuentro «${selector}» en src/styles.css`);
  return css.slice(i, css.indexOf('}', i));
}
const claro = tokens(bloque(':root {'));
const oscuro = { ...claro, ...tokens(bloque(':root[data-theme="dark"] {')) };

function luminancia(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const problemas = [];
for (const [nombre, paleta] of [['claro', claro], ['oscuro', oscuro]]) {
  for (const [fg, bg, minimo] of PARES) {
    if (!paleta[fg] || !paleta[bg]) { problemas.push(`${nombre}: falta el token ${paleta[fg] ? bg : fg}`); continue; }
    const r = ratio(paleta[fg], paleta[bg]);
    if (r < minimo) problemas.push(`${nombre}: ${fg} sobre ${bg} da ${r.toFixed(2)}:1 y el mínimo es ${minimo}:1`);
  }
}
if (problemas.length) {
  console.error('✖ Contraste insuficiente:');
  for (const p of problemas) console.error(`  · ${p}`);
  process.exit(1);
}
console.log(`✔ contraste: ${PARES.length} pares en verde, en claro y en oscuro`);
