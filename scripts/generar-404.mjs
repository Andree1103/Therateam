// Genera dist/therateam/browser/404.html a partir del index.html compilado.
//
// POR QUÉ: Cloudflare Pages sirve 404.html para cualquier ruta que no corresponda a un archivo.
// /pacientes/3451 no es un archivo — es una ruta del router de Angular — así que pegar esa URL
// en el navegador mostraba la pantalla de "No se encontró el archivo". Lo normal sería resolverlo
// con una regla en _redirects, pero en este proyecto Cloudflare no las está aplicando (se probó
// con el comodín global y con una regla por módulo: el resultado fue 404 en ambos casos).
//
// Haciendo que 404.html SEA la aplicación, el enlace directo funciona sin depender de eso: el
// navegador recibe la app y el router se encarga del resto. El único costo es que la respuesta
// viaja con estado 404 en vez de 200, invisible para quien usa el sistema.
//
// No es una copia literal del index: se le quita el HTML pre-renderizado y el estado de
// hidratación. El index trae la pantalla de login ya dibujada, y servirla en /pacientes/3451
// haría que Angular intentara hidratar un contenido que no corresponde a esa ruta. Dejando el
// <app-root> vacío, la app arranca limpia y navega a donde dice la URL.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join('dist', 'therateam', 'browser');
const ORIGEN = join(DIR, 'index.html');
const DESTINO = join(DIR, '404.html');

if (!existsSync(ORIGEN)) {
  console.error(`generar-404: no existe ${ORIGEN}. ¿Se corrió "ng build" antes?`);
  process.exit(1);
}

let html = readFileSync(ORIGEN, 'utf8');

// El contenido pre-renderizado dentro de <app-root>, con sus atributos de hidratación.
const appRoot = /<app-root[^>]*>[\s\S]*?<\/app-root>/;
if (!appRoot.test(html)) {
  console.error('generar-404: no se encontró <app-root> en index.html — revisar el build.');
  process.exit(1);
}
html = html.replace(appRoot, '<app-root></app-root>');

// El bloque de estado que Angular usa para hidratar; sin contenido que hidratar, sobra.
html = html.replace(/<script id="ng-state"[^>]*>[\s\S]*?<\/script>/g, '');

writeFileSync(DESTINO, html, 'utf8');
console.log(`generar-404: ${DESTINO} escrito (${(html.length / 1024).toFixed(1)} kB)`);
