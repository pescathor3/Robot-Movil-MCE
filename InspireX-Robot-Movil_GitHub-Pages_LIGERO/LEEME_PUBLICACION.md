# Manual interactivo InspireX Robot Móvil — publicación GitHub Pages

## Publicación desde el navegador

1. Descomprime `InspireX-Robot-Movil_GitHub-Pages_LIGERO.zip` en tu equipo. **No subas el ZIP directamente** al repositorio.
2. Abre tu repositorio de GitHub y usa **Add file → Upload files**.
3. Sube la **carpeta `InspireX-Robot-Movil` completa**, incluyendo `index.html` y todos los archivos de `assets/`. Para preservar las rutas, arrastra la carpeta sobre la zona de subida (si el navegador admite carpetas). Otra opción es crear primero la carpeta en GitHub y subir allí `index.html` y luego la carpeta `assets`.
4. Si GitHub muestra un error al confirmar muchos archivos a la vez, súbelos en dos lotes conservando exactamente las rutas. Cada archivo está por debajo de 3 MiB.
5. Activa GitHub Pages desde **Settings → Pages** si aún no está activo.

Con publicación del repositorio `Manuales-MCE` desde su raíz, la ruta prevista es:
`https://pescathor3.github.io/Manuales-MCE/InspireX-Robot-Movil/`

## Importante

- El manual carga sus datos comprimidos en el navegador mediante `DecompressionStream('gzip')`, compatible con versiones recientes de Edge, Chrome, Firefox y Safari.
- **No se abre directamente con doble clic al archivo `index.html`** porque `fetch` de datos locales con `file://` suele ser bloqueado. Debes abrir la página publicada en GitHub Pages (HTTPS) o mediante un servidor web local.
- Mantén juntos `index.html` y `assets/`; todos los archivos de `assets/` son necesarios.
- No subas el HTML original de 76 MB: está reemplazado por este sitio estático ligero.
- El visor requiere WebGL2 y aceleración gráfica del navegador.
