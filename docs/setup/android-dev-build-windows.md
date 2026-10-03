# Development build de Android en Windows

Diagnóstico y arreglo de los fallos al ejecutar `npx expo run:android` en esta
máquina (Windows 11, pnpm, Expo SDK 56 / RN 0.85.3).

Ninguno de estos fallos venía del código de la app: los cuatro son de entorno.
Se documentan porque son caros de rediagnosticar y volverán a aparecer en
cualquier máquina Windows nueva.

## Resumen

| # | Síntoma | Causa | Estado |
| --- | --- | --- | --- |
| 1 | `Could not initialize class ...foojay.DistributionsKt` | Falta un JDK 17 y el resolver que lo descargaría está roto | Resuelto |
| 2 | `configureCMakeDebug FAILED: A restricted method in java.lang.System has been called` | El demonio de Gradle corría sobre JDK 25 | Resuelto |
| 3 | `ninja: error: mkdir(...): No such file or directory` | Rutas de pnpm + CMake por encima de MAX_PATH | Resuelto |
| 4 | `ERR_PNPM_EPERM ... rename` | Algo mantiene handles abiertos sobre `node_modules` | En curso |

## 1. Sin JDK 17, y el resolver que lo descarga está roto

```
Could not initialize class org.gradle.toolchains.foojay.DistributionsKt
> NoSuchFieldError: Class org.gradle.jvm.toolchain.JvmVendorSpec
  does not have member field 'JvmVendorSpec IBM_SEMERU'
```

`@react-native/gradle-plugin@0.85.3` se compila a sí mismo con
`kotlin { jvmToolchain(17) }`. En la máquina solo había **JDK 25** (en el PATH) y
el **JBR 21** de Android Studio. Gradle no encontró ningún 17, así que intentó
descargarlo con el resolver *foojay*, que RN fija en la versión `0.5.0`
(`@react-native/gradle-plugin/settings.gradle.kts:16`). Gradle 9 eliminó
`JvmVendorSpec.IBM_SEMERU`, que esa versión todavía referencia: el plugin revienta
al inicializarse.

El fallo llegaba a los 3 segundos, en fase de configuración. No se llegaba a
compilar nada, que es lo que hace que el mensaje despiste tanto.

**Arreglo** — Temurin JDK 17 descomprimido en:

```
C:\Users\randy\.jdks\jdk-17.0.20.1+1
```

Gradle detecta `~/.jdks` por sí solo (es la ruta que usa IntelliJ), así que no
hizo falta tocar ningún archivo del proyecto ni `JAVA_HOME`.

## 2. El demonio de Gradle corría sobre JDK 25

```
Execution failed for task ':react-native-worklets:configureCMakeDebug[x86_64]'.
> WARNING: A restricted method in java.lang.System has been called
```

Arreglar el toolchain no bastó: eso solo da el JDK con el que se *compila el
plugin*. El demonio de Gradle seguía siendo el JDK 25. Desde Java 24
([JEP 472](https://openjdk.org/jeps/472)) las llamadas nativas restringidas
emiten ese warning por stderr, y la tarea de CMake de AGP lo interpreta como
fallo. RN 0.85 soporta JDK 17.

**Arreglo** — `~/.gradle/gradle.properties` (creado, no existía):

```properties
org.gradle.java.home=C:/Users/randy/.jdks/jdk-17.0.20.1+1
```

Va en el archivo global y no en `android/gradle.properties` **porque
`expo prebuild` regenera esa carpeta** y el arreglo se perdería en el siguiente
prebuild.

## 3. Las rutas de pnpm pasan de MAX_PATH

```
ninja: error: mkdir(CMakeFiles/cmTC_97ffa.dir): No such file or directory
The object file directory ... has 264 characters.
The maximum full path to an object file is 250 (see CMAKE_OBJECT_PATH_MAX).
```

El linker por defecto de pnpm mete un segmento largo en cada ruta real:

```
node_modules/.pnpm/react-native-screens@4.25.2_936a04738fe10bad90f6f84330168846/node_modules/react-native-screens/
```

Son **77 caracteres** que se suman a todas las rutas de CMake (`.cxx/Debug/<hash>/
x86_64/CMakeFiles/CMakeTmp/CMakeFiles/cmTC_xxxxx.dir/`). El resultado, 264, pasa
del límite.

`subst` a una unidad corta no sirve: Node resuelve los symlinks de pnpm a su ruta
real, así que el path largo reaparece. `LongPathsEnabled` **ya estaba a 1** en
esta máquina; no ayuda porque ni CMake 3.22 ni ninja son long-path aware, y el
límite de 250 de `CMAKE_OBJECT_PATH_MAX` es del propio CMake, no del sistema.

**Arreglo** — `pnpm-workspace.yaml`:

```yaml
nodeLinker: hoisted
```

Esto elimina el segmento `.pnpm/<pkg>@<version>_<hash>/node_modules/` de las
rutas reales (264 → ~205 caracteres). Es además la configuración que React
Native documenta para pnpm: RN no soporta el `node_modules` aislado.

> Esta es la **única línea que toca el repo** de todo el diagnóstico.

## 4. `EPERM` a mitad del install (pendiente)

```
[ERR_PNPM_EPERM] [importPackage ...\node_modules\expo-location]
EPERM: operation not permitted, rename '...\expo-location_tmp_8644_9' -> '...\expo-location'
```

Cambiar el linker obliga a reinstalar `node_modules` entero, y ahí aparece un
`EPERM` en el `rename` final de un paquete distinto en cada intento. Algo
mantiene handles abiertos sobre `node_modules` mientras pnpm renombra.

Una causa confirmada eran los **demonios de Gradle**: tras `./gradlew --stop` el
install llegó mucho más lejos. El resto apunta al antivirus escaneando en tiempo
real y ganando la carrera al `rename`.

**Por qué importa más de lo que parece:** el install aborta *antes* de crear los
enlaces de `node_modules/.bin`. Sin `node_modules/.bin/expo`, `npx expo` cae al
**`expo-cli` global legacy** instalado en `%APPDATA%\npm`, que ni soporta Node 24
ni sabe reutilizar el emulador abierto:

```
WARNING: The legacy expo-cli does not support Node +17.
The emulator (Phone) quit before it finished opening.
```

Es decir: el síntoma final (el emulador se cierra) no tiene nada que ver con el
emulador. Es un install a medias.

## Plan

1. **Completar el install.** Cada pasada avanza; repetir `pnpm install` hasta que
   termine limpio. Si se atasca, con Gradle, Metro y el emulador parados, y si
   aun así falla, excluir del antivirus la carpeta del proyecto y el store de
   pnpm (`%LOCALAPPDATA%\pnpm\store`).
2. **Verificar** que existe `node_modules/.bin/expo`. Es la prueba de que el
   install llegó al final.
3. **Desinstalar el CLI legacy**: `npm rm -g expo-cli`. Está deprecado, no
   soporta Node 17+, y mientras exista puede volver a suplantar al CLI local en
   cuanto un install quede a medias.
4. **Recompilar**: `npx expo run:android --device Phone` (`Phone` es el nombre
   del AVD, no el serial `emulator-5554`; `--device` espera lo primero).
5. **Re-ejecutar los tests** de la app y del server. El layout hoisted cambia
   cómo se resuelven los módulos y hay que confirmar que jest sigue igual.
6. **Anotar en `CONTEXT-WEEK11.md`** la línea nueva de `pnpm-workspace.yaml`,
   para que aparezca en la revisión del diff.

## Prueba de push, después

Para que el envío llegue de verdad a este emulador (`sdk_gphone16k_x86_64`, que
sí trae Google Play Services) falta todavía `google-services.json` y
`android.googleServicesFile` en `app.json`. El checklist está en
[`docs/notifications/push.md`](../notifications/push.md).
