# FAQ: ERC-7540 (Vault Asincrona)

Este documento resume preguntas frecuentes sobre la implementacion ERC-7540 del proyecto y su relacion con ERC-4626.

## 1) Que problema resuelve ERC-7540

**Pregunta:** Para que usar ERC-7540 si ya existe ERC-4626?

**Respuesta breve:** ERC-7540 agrega un modelo asincrono con dos fases (request y claim), util cuando la liquidacion no puede o no conviene ser inmediata.

Casos comunes:
- Estrategias con latencia para traer liquidez.
- Procesamiento por ventanas o lotes.
- Controles operativos y de riesgo mas estrictos.

## 2) Cual es la diferencia entre request y claim

**Pregunta:** Que pasa en `request*` y que pasa en `claim*`?

**Respuesta:**
- `requestDeposit`: transfiere assets y deja una solicitud pendiente.
- `claimDeposit`: minta shares cuando se liquida la solicitud.
- `requestRedeem`: mueve shares a escrow y deja solicitud pendiente.
- `claimRedeem`: quema shares en escrow y transfiere assets.

## 3) Quien puede ejecutar los claims

**Pregunta:** Cualquiera puede reclamar una solicitud?

**Respuesta:** No. Solo `owner` o `controller` asociado a esa solicitud.

Si un tercero intenta hacer claim, la transaccion revierte por autorizacion.

## 4) Se puede reclamar dos veces la misma solicitud

**Pregunta:** Que evita doble cobro o doble mint?

**Respuesta:** Cada solicitud tiene bandera `claimed`. Una vez reclamada, cualquier segundo intento revierte.

## 5) Que pasa con las shares durante requestRedeem

**Pregunta:** Las shares siguen en la cuenta del usuario?

**Respuesta:** No. En `requestRedeem` las shares pasan a escrow interno en la vault (`address(vault)`), quedando inmovilizadas hasta `claimRedeem`.

## 6) Como se calcula lo que recibe el usuario

**Pregunta:** Como se determinan shares o assets en claim?

**Respuesta:**
- `claimDeposit` usa `previewDeposit(assets)` para calcular shares.
- `claimRedeem` usa `previewRedeem(shares)` para calcular assets.

Por eso la valorizacion depende de `totalAssets()` y del estado contable de la vault.

## 7) ERC-7540 reemplaza ERC-4626

**Pregunta:** Se deja de usar ERC-4626?

**Respuesta:** No. En esta implementacion, ERC-7540 se apoya en una base ERC-4626 y reutiliza su contabilidad de shares, conversiones y limites.

## 8) Si el asset esta invertido fuera, como impacta

**Pregunta:** Cambia algo por tener estrategia externa?

**Respuesta:** Si. `totalAssets()` debe reflejar activos locales e invertidos para que previews y conversiones sean correctas.

Regla conceptual:

$$
totalAssets = idle + invested + accruedYield - losses - fees
$$

## 9) Que pruebas minimas debo correr

**Pregunta:** Cuales son las pruebas importantes para ERC-7540?

**Respuesta:**
1. Unit tests de request/claim para deposit y redeem.
2. Fuzz tests de autorizacion, doble-claim y monotonia de `requestId`.
3. Fuzzing avanzado (Medusa) con propiedades e invariantes globales.

## 10) Que ya esta cubierto en este repo

**Pregunta:** Ya hay cobertura de pruebas para ERC-7540 aqui?

**Respuesta:** Si, incluyendo unit, fuzz de Foundry y Medusa.

Archivos relevantes:
- `test/ERC7540BaseUnit.t.sol`
- `test/ERC7540BaseFuzz.t.sol`
- `test/fizz/handlers/ERC7540Handler.sol`
- `test/fizz/Properties.sol`

## 11) Como ejecutar rapidamente todas las pruebas ERC-7540

**Pregunta:** Cual es la secuencia recomendada?

**Respuesta:**

```bash
forge test --match-contract ERC7540BaseUnitTest -vv
forge test --match-contract ERC7540BaseFuzzTest -vv
make medusa-short
```

## 12) Que mejoras quedan para una version productiva

**Pregunta:** Que faltaria para un entorno institucional?

**Respuesta:**
- Ventanas de liquidacion y procesamiento por lote.
- Roles operativos y politicas de pausa parcial.
- Reglas de cancelacion/expiracion de solicitudes (si aplica).
- Limites dinamicos de salida segun liquidez real.
- Monitoreo y reporting de pendientes por requestId.

## 13) Cuales son las ventajas de hacerlo asincronico

**Pregunta:** Por que usar un flujo asincronico en lugar de ejecutar todo en una sola llamada?

**Respuesta:** El modelo asincronico separa la intencion (`request`) de la liquidacion (`claim`) para mejorar control operativo y resiliencia.

Ventajas principales:
- Mejor control de liquidez: evita prometer ejecucion inmediata cuando parte del capital esta invertido o con latencia de salida.
- Procesamiento por lotes: permite agrupar solicitudes por ventanas para una operacion mas ordenada y eficiente.
- Compatibilidad con estrategias lentas: cuando desinvertir no es instantaneo, el usuario deja la solicitud y liquida al estar procesable.
- Mejor gestion de riesgo institucional: facilita politicas de cola, limites por ventana, pausas parciales y runbooks operativos.
- Menor ejecucion forzada en condiciones adversas: reduce riesgo de liquidar en momentos de baja liquidez o slippage alto.

Resumen practico:
- ERC-4626 sincrono: solicitar y liquidar en la misma transaccion.
- ERC-7540 asincrono: solicitar ahora y liquidar despues, cuando la vault tenga condiciones adecuadas.
