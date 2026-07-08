# FAQ: ERC-4626, Rendimientos y Uso Institucional

Este documento resume preguntas y respuestas clave sobre el funcionamiento de una vault ERC-4626, con foco en estrategias de rendimiento (por ejemplo, lending) y lineamientos para una institucion financiera.

## 1) Que hace ERC-4626 y cual es su utilidad

**Pregunta:** Que hace ERC-4626 y cual es su utilidad o ventajas?

**Respuesta breve:** ERC-4626 estandariza vaults tokenizadas. Los usuarios depositan un activo subyacente y reciben shares. Luego pueden retirar/redimir segun el valor de esas shares.

**Ventajas principales:**
- Interoperabilidad con wallets, agregadores y protocolos DeFi.
- Previews estandarizadas (`previewDeposit`, `previewMint`, `previewWithdraw`, `previewRedeem`).
- Conversiones claras entre activos y shares (`convertToShares`, `convertToAssets`).
- Mejor composabilidad y menor friccion de integracion.

## 2) Como se manejan los rendimientos

**Pregunta:** Como se manejan los rendimientos?

**Respuesta breve:** El rendimiento no se distribuye mintiendo shares extra a cada usuario. Se refleja en el precio por share.

$$
pricePerShare = \frac{totalAssets}{totalSupply}
$$

Si la estrategia gana intereses:
- `totalAssets` sube.
- `totalSupply` suele mantenerse.
- Cada share pasa a representar mas activos.

## 3) Si la estrategia presta el activo, hay que sacar fondos de la boveda?

**Pregunta:** Si la estrategia es prestar el activo subyacente, hay que sacar activo de la boveda. Que se hace ahi?

**Respuesta breve:** Si. El balance local de la boveda baja porque los fondos pasan a una estrategia externa, pero siguen siendo activos economicos de la vault.

Conceptualmente:
- **Idle assets:** activos en la direccion de la boveda.
- **Invested assets:** activos colocados en estrategia.

Por eso `totalAssets` debe incluir ambos componentes (mas rendimiento acumulado y menos perdidas/comisiones, si aplica):

$$
totalAssets = idle + invested + accruedYield - losses - fees
$$

## 4) Entonces el balance del asset al moverlo fuera deberia restar?

**Pregunta:** Al mover activos fuera del contrato para una estrategia, ese balance deberia restar?

**Respuesta breve:** Si, el balance local (`asset.balanceOf(address(this))`) baja. Eso es normal.

Lo importante es que **no** se use solo ese balance local para valorar la vault. La funcion `totalAssets()` debe sumar tambien el valor en estrategia.

## 5) Cuando la gente quiere retirar, debe existir balance suficiente?

**Pregunta:** Cuando las personas quieran retirar, debe tener balance necesario para poder pagar?

**Respuesta breve:** Si. En el momento del pago, la boveda debe tener liquidez disponible para transferir al usuario.

Flujo recomendado:
1. Calcular activos/shares de salida.
2. Desinvertir desde estrategia lo necesario.
3. Transferir activos al usuario.

Si la estrategia no puede devolver liquidez a tiempo, el retiro debe fallar o limitarse segun `maxWithdraw`/`maxRedeem`.

## 6) Nota importante para esta implementacion base

En esta base (`src/ERC4626/ERC4626Base.sol`), en `deposit` y `mint` se ejecuta `_afterDeposit(...)` antes de recibir los tokens con `_safeTransferFrom(...)`.

Implicacion:
- Si se quiere invertir inmediatamente en `_afterDeposit`, ese hook puede ejecutarse cuando los activos aun no entraron a la boveda.

Opciones tipicas:
- Reordenar para transferir primero y luego ejecutar el hook de inversion.
- O hacer que `_afterDeposit` no asuma saldo ya recibido.

## 7) Enfoque para una institucion financiera

Para uso institucional, ademas de la logica ERC-4626, se recomienda:

- **Gobernanza y controles:** roles claros para parametros de riesgo, pausas y cambios de estrategia.
- **Politica de liquidez:** buffer minimo en idle assets para cubrir retiros normales.
- **Gestion de riesgo:** limites por contraparte/protocolo, stress tests y escenarios de corrida.
- **Valuacion y reporting:** metodologia de `totalAssets` auditable, reportes diarios de NAV y reconciliacion.
- **Cumplimiento:** procesos KYC/AML, monitoreo de transacciones y trazabilidad.
- **Custodia y seguridad:** segregacion de funciones, multisig, monitoreo on-chain y planes de respuesta.
- **Continuidad operativa:** runbooks de emergencia, pausas operativas y plan de desinversion ordenada.

## 8) Checklist operativo minimo

- Implementar `totalAssets()` incluyendo activos en estrategia.
- Asegurar flujo de liquidez en `withdraw`/`redeem`.
- Definir limites realistas en `maxWithdraw` y `maxRedeem`.
- Documentar supuestos de valuacion y frecuencia de actualizacion.
- Cubrir con pruebas unitarias/fuzz los casos de iliquidez parcial y perdidas.

## 9) Casos de uso de ejemplo (narracion completa)

### Caso 1: Tesoreria corporativa con liquidez diaria

**Contexto**
- Una empresa mantiene excedentes de caja en stablecoins.
- Busca rendimiento de bajo riesgo sin perder capacidad de pago diaria.

**Narrativa completa**
1. La tesoreria deposita 5,000,000 USDC en la vault y recibe shares equivalentes.
2. La vault mantiene 20% en idle assets para retiros rapidos y envia 80% a una estrategia de lending.
3. Cada dia, el equipo financiero consulta `totalAssets` y el precio por share para medir rendimiento.
4. A mitad de mes, la empresa necesita 900,000 USDC para pagos operativos.
5. El retiro se procesa en dos tramos:
- Tramo A: se usa primero el idle disponible en la vault.
- Tramo B: si falta liquidez, `beforeWithdraw` desinvierte desde lending.
6. El pago se completa el mismo dia y la empresa conserva el resto de la posicion invertida.

**Resultado esperado**
- Liquidez diaria sin tener todo el capital improductivo.
- Trazabilidad clara entre saldo idle, saldo invertido y rendimiento acumulado.

**Controles recomendados**
- Buffer minimo de liquidez definido por politica interna.
- Limites de retiro por ventana horaria.
- Monitoreo de desviaciones entre valor contable y on-chain.

### Caso 2: Fondo institucional con politica de riesgo por capas

**Contexto**
- Un fondo administra capital de clientes institucionales.
- Debe cumplir politicas formales de riesgo y reporte.

**Narrativa completa**
1. El fondo lanza una vault ERC-4626 para un mandato conservador.
2. La asignacion se distribuye por capas:
- Capa 1 (liquidez): activos en vault para rescates normales.
- Capa 2 (rendimiento): lending sobre protocolos con rating interno aprobado.
- Capa 3 (reserva): activos no desplegados para eventos extremos.
3. Se define un comite que autoriza cambios de estrategia y ajustes de limites.
4. Durante un trimestre, el rendimiento sube `totalAssets` sin emitir shares adicionales.
5. Un evento de mercado reduce la liquidez de un protocolo externo.
6. La vault responde con plan de contingencia:
- Pausa nuevos despliegues en ese protocolo.
- Priorizacion de retiros con liquidez local.
- Desinversion escalonada en bloques para evitar slippage excesivo.
7. El fondo emite reporte extraordinario a clientes con detalle de exposicion y acciones.

**Resultado esperado**
- Continuidad operativa bajo estres.
- Cumplimiento de rescates dentro de umbrales definidos.
- Transparencia de gestion frente a inversionistas y auditoria.

**Controles recomendados**
- `maxWithdraw` y `maxRedeem` alineados a liquidez real, no solo a valor teorico.
- Reporte diario de NAV y reporte de excepciones.
- Simulacros periodicos de corrida de retiros.

### Caso 3: Banco digital con producto de ahorro tokenizado

**Contexto**
- Un banco digital ofrece una cuenta de ahorro con rendimiento variable.
- Quiere operar sobre una vault con reglas estandar y auditable.

**Narrativa completa**
1. Cada cliente deposita stablecoins y recibe shares de la vault.
2. El core bancario registra la posicion por cliente y sincroniza eventos on-chain.
3. La estrategia coloca fondos en mercados monetarios de bajo riesgo.
4. El rendimiento diario incrementa el valor por share; no se hacen "abonos manuales" por cliente.
5. El cliente solicita retiro parcial desde la app movil.
6. El sistema consulta `previewWithdraw` para estimar shares a quemar y mostrar monto final.
7. Si hay liquidez local, el retiro sale inmediato; si no, se ejecuta desinversion automatica.
8. La operacion queda reconciliada entre libro interno, eventos on-chain y reporte regulatorio.

**Resultado esperado**
- Experiencia de retiro predecible para cliente final.
- Menor friccion de integracion gracias al estandar ERC-4626.
- Auditoria mas simple por consistencia entre operaciones y eventos.

**Controles recomendados**
- Politica de SLA de retiro (inmediato vs diferido).
- Alertas tempranas de iliquidez por umbral.
- Conciliacion diaria entre sistema interno y datos de cadena.

### Caso 4: Escenario de estres y manejo de iliquidez temporal

**Contexto**
- Una parte relevante del capital esta invertida y un protocolo externo reduce retiros instantaneos.

**Narrativa completa**
1. Los usuarios empiezan a retirar de forma simultanea.
2. La vault consume primero el idle buffer disponible.
3. Al agotarse ese buffer, intenta desinvertir desde estrategia.
4. La estrategia devuelve liquidez parcial en la primera ventana.
5. La vault aplica limites dinamicos de retiro para evitar liquidaciones forzadas ineficientes.
6. Se comunica estado operativo: porcentaje de liquidez inmediata y tiempos estimados.
7. En las siguientes ventanas, la vault completa desinversion y normaliza retiros.

**Resultado esperado**
- Proteccion de valor para todos los participantes.
- Trato consistente entre usuarios en condiciones de estres.
- Reanudacion ordenada de operacion normal.

**Controles recomendados**
- Runbook de crisis con responsabilidades claras.
- Mecanismo de pausa parcial (no total) segun severidad.
- Registro post-mortem para mejorar parametros de riesgo.

## 10) Preguntas frecuentes del contrato y sus funciones

### 10.1 Que significa saldo idle en esta vault?

**Pregunta:** Que es saldo idle y por que importa?

**Respuesta:** Es el balance del activo subyacente que esta en la direccion del contrato de la vault, sin invertir en estrategia. Se usa para atender retiros inmediatos sin tener que desinvertir.

Referencias en el contrato:
- El token subyacente se expone con asset().
- El balance idle se consulta externamente con balanceOf del token subyacente sobre la direccion de la vault.
- En esta base, totalAssets() debe ser implementada para incluir idle + invertido.

### 10.2 Si bajo el saldo idle, perdi activos?

**Pregunta:** Cuando invierto fuera y baja el idle, la vault perdio fondos?

**Respuesta:** No necesariamente. Es normal que baje el saldo local cuando se despliega capital en estrategia. La clave es que totalAssets() siga reflejando el valor economico total (idle + posicion invertida).

### 10.3 Cual es la diferencia entre convert y preview?

**Pregunta:** Para que existen convertToShares/convertToAssets y previewDeposit/previewWithdraw?

**Respuesta:**
- convertToShares y convertToAssets son conversiones base con redondeo hacia abajo.
- previewDeposit y previewRedeem usan redondeo hacia abajo.
- previewMint y previewWithdraw usan redondeo hacia arriba para no subestimar costo de entrada o quema de shares.

Esto evita prometer mas de lo que se puede ejecutar cuando hay division entera.

### 10.4 Por que en deposit y mint importa el orden de operaciones?

**Pregunta:** En esta implementacion, por que se menciona el orden del hook _afterDeposit?

**Respuesta:** Porque en la base actual _afterDeposit se ejecuta antes de recibir el activo con safeTransferFrom. Si en el hook se asume que el saldo ya llego, puede fallar la inversion inmediata.

Conclusiones practicas:
- O se reordena para transferir primero y luego invertir.
- O el hook se implementa sin asumir que ya entro liquidez.

### 10.5 Como se atiende withdraw/redeem cuando hay estrategia?

**Pregunta:** Si los fondos estan invertidos, como paga la vault?

**Respuesta:** La vault debe traer liquidez antes de transferir al usuario. En esta base, eso se modela con _beforeWithdraw, que se ejecuta antes de la transferencia final.

Si no se logra traer liquidez suficiente, la operacion revierte o debe limitarse con maxWithdraw y maxRedeem segun liquidez real.

### 10.6 Que representa maxWithdraw hoy en esta base?

**Pregunta:** maxWithdraw protege contra iliquidez de estrategia?

**Respuesta:** En esta base, maxWithdraw usa una vista teorica basada en shares convertidas a activos. Si la estrategia esta temporalmente iliquida, conviene sobrescribir maxWithdraw y maxRedeem en el contrato hijo para reflejar capacidad real de salida.

### 10.7 Como se reparten rendimientos entre usuarios?

**Pregunta:** El contrato le deposita intereses a cada usuario?

**Respuesta:** No. El rendimiento se refleja en el valor por share. Cuando totalAssets sube y totalSupply se mantiene, cada share vale mas activos. El usuario captura el rendimiento al retirar o redimir.

### 10.8 Que debe probarse en tests de este contrato?

**Pregunta:** Cuales son pruebas minimas recomendadas?

**Respuesta:**
- Deposito y retiro simple con relacion 1:1 inicial.
- Rounding en previewMint y previewWithdraw (redondeo hacia arriba).
- Escenarios con activos invertidos y bajo saldo idle.
- Fallo controlado cuando no hay liquidez para pagar retiro.
- Coherencia entre totalAssets, conversiones y eventos emitidos.

## 11) Como funcionan los hooks y que estrategia implementar fuera de la boveda

### 11.1 Como funcionan los hooks en esta base

**Hook de entrada: _afterDeposit(assets, shares)**
- Se invoca en deposit y mint.
- Su objetivo es ejecutar logica posterior al calculo de shares, normalmente despliegue a estrategia.
- En esta base, se llama antes de recibir fondos via transferFrom.

**Hook de salida: _beforeWithdraw(assets, shares)**
- Se invoca en withdraw y redeem.
- Su objetivo es traer liquidez desde estrategia antes de pagar al usuario.
- Debe garantizar que exista saldo suficiente para la transferencia final.

### 11.2 Estrategia recomendada cuando el subyacente se invierte afuera

**Objetivo operativo**
- Mantener liquidez para retiros cotidianos.
- Invertir excedente para generar rendimiento.
- Valorar correctamente la vault en todo momento.

**Modelo sugerido (idle + estrategia)**
1. Definir un buffer idle minimo (porcentaje o monto absoluto).
2. Todo excedente sobre ese buffer se despliega a estrategia externa.
3. Ante retiros, usar primero idle.
4. Si no alcanza, desinvertir en _beforeWithdraw.
5. Si la estrategia no devuelve liquidez, limitar salida con maxWithdraw/maxRedeem realistas.

### 11.3 Regla contable clave

Aunque el balance local del contrato baje al invertir, la valorizacion correcta es:

$$
totalAssets = idle + invested + accruedYield - losses - fees
$$

Si totalAssets solo mira balance local, previews y conversiones quedan distorsionadas.

### 11.4 Flujo operativo recomendado de punta a punta

1. Usuario deposita o mintea.
2. La vault recibe activos y acuña shares.
3. La politica de liquidez decide cuanto queda idle y cuanto se invierte.
4. El valor por share evoluciona con totalAssets.
5. Usuario solicita retiro o redeem.
6. La vault consume idle y, si falta, desinvierte.
7. Se queman shares y se transfiere activo.

### 11.5 Controles minimos para entorno institucional

- Limites por protocolo y por contraparte.
- Oraculo o metodo robusto de valuacion de posicion invertida.
- Circuit breaker para pausar nuevos despliegues, no necesariamente retiros.
- Monitoreo de liquidez inmediata, liquidez a T+1 y liquidez estresada.
- Runbook de desinversion escalonada para eventos de mercado.

## 12) Propuesta de uso del estandar en modelo omnibus

### 12.1 Que es un modelo omnibus en este contexto

En un modelo omnibus, la institucion opera una o pocas cuentas on-chain agregadas y lleva el detalle de clientes en un libro interno (sub-ledger).

Idea central:
- On-chain: la cuenta omnibus es titular de shares ERC-4626.
- Off-chain: la institucion asigna internamente la propiedad economica de esas shares por cliente final.

### 12.2 Por que ERC-4626 encaja bien

- Estandariza deposit/mint/withdraw/redeem para integracion simple.
- Permite valuacion diaria con totalAssets y precio por share.
- Facilita reconciliacion entre eventos on-chain y libro interno.
- Reduce complejidad de custodiar miles de wallets cliente en la capa base.

### 12.3 Arquitectura propuesta (institucion + vault)

Componentes:
1. Cuenta omnibus on-chain de la institucion.
2. Motor de ordenes (entrada/salida) en sistema interno.
3. Sub-ledger por cliente con participacion en shares.
4. Servicio de conciliacion entre eventos de la vault y saldos internos.
5. Capa de riesgo/compliance (KYC/AML, limites, alertas).

Regla de asignacion sugerida:
- Cada corte operativo convierte activos cliente a participacion interna equivalente en shares omnibus.
- El sub-ledger debe mantener trazabilidad de:
	- aportes,
	- rescates,
	- comisiones,
	- rendimiento neto atribuido.

### 12.4 Flujo operativo sugerido

1. Clientes depositan fiat/stablecoin en la institucion.
2. La institucion agrupa ordenes y ejecuta deposit o mint en la vault desde la cuenta omnibus.
3. Se reciben shares en omnibus.
4. El sub-ledger reparte esas shares de forma proporcional entre clientes.
5. Para retiros, la institucion agrupa solicitudes y ejecuta withdraw o redeem.
6. Si falta liquidez local, la vault desinvierte via hook de salida.
7. La institucion liquida a clientes y registra conciliacion final.

### 12.5 Politica de liquidez para omnibus

Para reducir friccion operativa:
- Definir buffer idle minimo para cubrir retiros diarios esperados.
- Rebalancear en ventanas fijas (por ejemplo, cada hora o cada dia).
- Usar maxWithdraw y maxRedeem del contrato hijo alineados a liquidez real.

### 12.6 Controles indispensables

- Segregacion de funciones: trading, operaciones, custodia y aprobaciones.
- Multisig para acciones criticas (cambio de estrategia, rescates extraordinarios).
- Conciliacion diaria: NAV on-chain vs saldos del sub-ledger.
- Politica de excepciones: desalineaciones, iliquidez, slippage y pausas.
- Auditoria de asignacion: evidencia reproducible de reparto por cliente.

### 12.7 Riesgos especificos del modelo omnibus

- Riesgo de asignacion interna incorrecta (no del estandar, sino del operador).
- Riesgo operacional por latencias entre libro interno y estado on-chain.
- Riesgo de concentracion en una sola cuenta omnibus.
- Riesgo de liquidez si la estrategia externa no devuelve capital a tiempo.

Mitigaciones:
- Controles de doble validacion para ciclos de reparto.
- Cortes operativos definidos (T+0/T+1) con reglas transparentes.
- Limites de exposicion por estrategia y pruebas de stress recurrentes.

### 12.8 KPI recomendados para gestion omnibus

- Cobertura de liquidez inmediata (idle/retiros esperados).
- Tiempo medio de retiro (normal y estresado).
- Error de conciliacion diario (bps).
- Porcentaje de retiros atendidos sin desinversion.
- Desviacion entre rendimiento bruto estrategia y neto cliente.

### 12.9 Conclusion practica

ERC-4626 es una base solida para un modelo omnibus institucional porque separa bien:
- capa on-chain estandarizada (vault + shares), y
- capa operativa interna (asignacion por cliente, compliance y reporting).

La clave de exito no es solo tecnica: depende de una buena disciplina de conciliacion, liquidez y controles operativos.

## 13) Limitaciones y riesgos del uso de ERC-4626

### 13.1 Limitaciones propias del estandar

- ERC-4626 estandariza interfaces y semantica basica, pero no impone una estrategia de inversion segura por defecto.
- El estandar no garantiza liquidez inmediata: una vault puede tener valor economico alto y aun asi poca liquidez instantanea.
- `totalAssets` es una funcion definida por el implementador; si se calcula mal, todo el sistema de conversiones y previews queda sesgado.
- El estandar no define gobernanza, permisos operativos ni politicas de riesgo institucional.

### 13.2 Riesgos tecnicos del contrato

- Riesgo de redondeo: diferencias pequenas en deposit/mint/withdraw/redeem por division entera.
- Riesgo de valuacion: sobreestimar o subestimar activos invertidos por oraculos, precios o supuestos incorrectos.
- Riesgo de integracion ERC-20: tokens con comportamiento no estandar, fees on transfer o callbacks inesperados.
- Riesgo de orden de operaciones: hooks mal ubicados pueden asumir liquidez no disponible en ese momento.
- Riesgo de limites teoricos: `maxWithdraw` y `maxRedeem` pueden no reflejar iliquidez temporal de estrategia.

### 13.3 Riesgos de estrategia y mercado

- Riesgo de contraparte/protocolo externo: fallas, hacks o insolvencia del destino donde se invierte.
- Riesgo de iliquidez: imposibilidad de desinvertir rapido ante retiros masivos.
- Riesgo de slippage y costos de salida: desinversion en condiciones adversas puede destruir valor.
- Riesgo de correlacion: varias estrategias pueden fallar simultaneamente bajo estres de mercado.

### 13.4 Riesgos operativos e institucionales

- Riesgo de conciliacion: diferencias entre estado on-chain y sistemas internos.
- Riesgo de custodia: manejo inadecuado de llaves, aprobaciones y procesos de firma.
- Riesgo de cumplimiento: brechas en KYC/AML, trazabilidad o reporte regulatorio.
- Riesgo de continuidad: ausencia de runbooks para pausas, incidentes y recuperacion.

### 13.5 Riesgos para usuarios finales

- Riesgo de expectativas: confundir "valor total" con "liquidez inmediata".
- Riesgo de timing: entrar o salir en momentos de alta variacion de liquidez o precio.
- Riesgo de comisiones no transparentes: performance fee, withdrawal fee o costos de ejecucion no explicitados.

### 13.6 Mitigaciones recomendadas

1. Implementar `totalAssets` conservadora, auditable y con metodologia documentada.
2. Mantener buffer idle y politicas de rebalanceo por ventanas.
3. Sobrescribir `maxWithdraw` y `maxRedeem` para reflejar liquidez real.
4. Establecer limites por protocolo, contraparte y concentracion.
5. Probar escenarios de estres: corrida de retiros, iliquidez parcial y perdida de valor.
6. Implementar monitoreo continuo de NAV, liquidez y desviaciones de valuacion.
7. Definir procesos de emergencia: pausa parcial, desinversion escalonada y comunicacion a usuarios.

### 13.7 Conclusiones practicas

ERC-4626 es un estandar muy util para interoperabilidad, pero no elimina riesgo financiero ni operativo por si solo. Su calidad final depende de:
- la implementacion de `totalAssets`,
- el diseno de liquidez,
- la estrategia externa,
- y la disciplina de controles.

## 14) Direcciones desplegadas (registro)

### 14.1 Sepolia (chainId 11155111)

- Mock COPW: `0x563347Cb73dF1250D62d7B0B1407E3B1209f0A71`
- ERC4626IdleVault: `0x2BBDeAa7D79455B074b6D5c8006628000634C10a`

Parametros usados en el despliegue de la vault:
- ASSET_TOKEN: `0x563347Cb73dF1250D62d7B0B1407E3B1209f0A71`
- VAULT_NAME: `CDToken`
- VAULT_SYMBOL: `CDT`
