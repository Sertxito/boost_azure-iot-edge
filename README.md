# boost_azure-iot-edge

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub Repo](https://img.shields.io/badge/repo-boost__azure--iot--edge-blue)](https://github.com/Sertxito/boost_azure-iot-edge)

> Azure IoT Edge — Ingesta MQTT, Normalización Local & Decisión Semántica

## Overview

Proyecto Edge maduro para arquitecturas IoT. Ingesta MQTT → normalización de payload local → decisión semántica local → envío a Azure IoT Hub. Runtime containerizado, routing inteligente, completo con tests unitarios y documentación operativa.

### Key Features

- ✅ **Ingesta MQTT** — Broker MQTT local, conectores flexibles  
- ✅ **Normalización Local** — Transformación de payload sin latencia
- ✅ **Decisión Semántica** — Lógica de negocio en edge
- ✅ **Runtime Containerizado** — Docker compatible, deployment seguro
- ✅ **Routing Inteligente** — Priorización de mensajes críticos
- ✅ **Scripts PowerShell** — Deploy/redeploy automatizado
- ✅ **11 Docs** — Arquitectura, contrato datos, NodeMCU, Power BI, operación

## Quick Start

### Prerequisites

- Azure IoT Hub instance
- Docker (local testing)
- NodeMCU o edge device compatible

### Installation

```bash
git clone https://github.com/Sertxito/boost_azure-iot-edge.git
cd boost_azure-iot-edge
pwsh -ExecutionPolicy Bypass ./scripts/deploy.ps1
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Data Contract](docs/DATA_CONTRACT.md)
- [NodeMCU Setup](docs/HARDWARE.md)
- [Power BI Dashboard](docs/POWERBI.md)

## License

MIT — See [LICENSE](LICENSE)
