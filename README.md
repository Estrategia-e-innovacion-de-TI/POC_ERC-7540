# ERC-7540 Repository

Este repositorio contiene dos proyectos:

## Estructura

- `Blockchain/`: proyecto Foundry para contratos Solidity (ERC-4626/ERC-7540), scripts de deploy, pruebas unitarias y fuzzing.
- `FrontEnd/`: proyecto frontend React para interactuar con contratos desplegados en Sepolia.

## Proyecto Blockchain (Foundry)

Ubicacion: `Blockchain/`

Comandos principales:

```bash
cd Blockchain
make help
make build
make test
```

Documentacion principal del subproyecto:

- `Blockchain/README.md`

Documentacion ERC-7540:

- [Blockchain/ARQUITECTURA_ERC7540.md](Blockchain/ARQUITECTURA_ERC7540.md)
- [Blockchain/FAQ_ERC7540.md](Blockchain/FAQ_ERC7540.md)

## Proyecto FrontEnd

Ubicacion: `FrontEnd/`

Este directorio esta reservado para la aplicacion frontend que consumira los contratos del proyecto blockchain.

## Flujo recomendado del repositorio

1. Trabajar contratos y pruebas en `Blockchain/`.
2. Publicar direcciones/ABIs para consumo del frontend.
3. Integrar y probar flujos end-to-end desde `FrontEnd/`.

## Variables de entorno

- Blockchain usa plantilla en `Blockchain/example.env` para despliegues y configuracion local.

## Notas

- Este README es general del monorepo.
- Cada subproyecto puede mantener su propia documentacion y scripts especificos.
