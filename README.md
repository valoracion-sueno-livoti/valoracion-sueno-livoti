# Valoración del sueño del niño

App web para que los padres completen el cuestionario BISQ-R (0 a 2 años) y se genere
automáticamente un Google Doc con el resumen y las respuestas, en el Drive de la
Dra. Florencia Livoti.

## Estructura del proyecto

```
index.html                  → pantalla de selección de edad
cuestionario-0-2.html       → cuestionario completo (0 a 2 años)
assets/
  styles.css                → estilos (paleta e identidad del logo)
  app.js                    → lógica del wizard + envío del formulario
  logo.png                  → logo recortado, usado en el encabezado
apps-script/
  Code.gs                   → backend (pegar en script.google.com)
```

## Cómo publicar (resumen)

1. Subí **todos** estos archivos y carpetas al repo de GitHub
   `valoracion-sueno-livoti`, manteniendo la misma estructura (podés arrastrar la
   carpeta completa en "Add file → Upload files").
2. GitHub Pages ya está activado — la app va a estar en:
   `https://[tu-usuario].github.io/valoracion-sueno-livoti/`

## Cómo conectar el Apps Script (backend)

1. Andá a [script.google.com](https://script.google.com) con la cuenta de Google de
   la Dra. Livoti.
2. Nuevo proyecto → pegá **todo** el contenido de `apps-script/Code.gs`.
3. (Opcional pero recomendado) Seleccioná la función `pruebaManual` en el desplegable
   de arriba y le das "Ejecutar". Te va a pedir autorizar permisos de Drive/Docs — se
   autoriza con la cuenta de la Dra. Si todo sale bien, se crea un doc de prueba en la
   carpeta de Drive. Ese doc de prueba lo podés borrar después.
4. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Implementar
5. Copiá la URL que termina en `/exec`.
6. Abrí `assets/app.js` y reemplazá esta línea:
   ```js
   const APPS_SCRIPT_URL = "PEGAR_AQUI_LA_URL_DEL_APPS_SCRIPT";
   ```
   por la URL real, entre comillas.
7. Subí de nuevo el archivo `app.js` actualizado al repo de GitHub (o editalo
   directamente en GitHub, con el lápiz de "Edit").

## Cómo probar el flujo completo

1. Abrí la URL de GitHub Pages desde el celular o la PC.
2. Elegí "Hasta 2 años", completá el formulario con datos de prueba y enviá.
3. Revisá que aparezca un Doc nuevo en la carpeta de Drive de la Dra., con el nombre
   `Apellido Nombre - fecha - cobertura`.
4. Abrí el doc y confirmá que el resumen de arriba y las 40 respuestas se vean bien.

## Notas

- Cada envío crea un documento nuevo — no se sobrescribe nada.
- Todos los campos son obligatorios; el formulario no deja avanzar de paso si falta
  algo.
- El resumen de sueño usa referencias orientativas (edad del bebé, latencia,
  despertares, percepción familiar) — no es un diagnóstico. Esto se aclara también
  dentro del documento generado.
- Si en algún momento cambia la carpeta de Drive, hay que actualizar
  `ID_CARPETA_DRIVE` en `Code.gs` y volver a implementar el Apps Script.
- El cuestionario de 2 a 18 años (todavía no construido) ya tiene su lugar reservado
  en `index.html`, marcado como "Próximamente".
