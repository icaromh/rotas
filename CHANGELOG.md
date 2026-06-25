# Changelog

## [v0] - Primeira Versão Estável (MVP)

Esta versão inicial estabelece as bases fundamentais do Otimizador de Quadrantes GPS, fornecendo um motor matemático robusto capaz de gerar rotas contínuas em ambientes complexos de vias de mão única.

### Funcionalidades (O que o app faz)
- **Seleção Avançada de Área (Polígono):** Ferramenta de desenho livre no mapa para delimitar perfeitamente ruas, rios ou bairros de formatos irregulares, mantendo a restrição de segurança de até 4 km².
- **Motor Assíncrono (Web Worker):** Todo o processamento algorítmico superpesado é resolvido em uma thread separada, não travando a interface de usuário durante a montagem da rota.
- **Roteamento Legal e Inteligente (Mão Única):** Para bicicletas, o algoritmo soluciona o "Mixed Chinese Postman Problem" respeitando as mãos das vias, e expande automaticamente a busca para usar vias auxiliares (*Transit Edges*) fora do polígono para conseguir fazer os retornos permitidos nos quarteirões ao invés de acusar erro de malha ou sugerir contramão.
- **Modos de Transporte Customizáveis:** Alternância entre `Pedal` e `Caminhada` (ignorando mãos únicas), permitindo que a velocidade e estimativa de tempo gerada mude de acordo.
- **Visualização Dinâmica (Animação):** Um tocador com botão "Animar Rota" que desenha dinamicamente todo o percurso (modo "cobrinha") durante 10 segundos, para que o usuário possa ver as decisões direcionais tomadas pelo algoritmo antes de baixar o arquivo.
- **Integração Real (OSM / Overpass):** Apanha informações diretamente do OpenStreetMap de vias classificadas, descartando calçadas e servidões de forma inteligente.
- **Exportação Universal (GPX):** Transforma os dados finais num arquivo `.gpx` estruturado pronto para Garmin, Wahoo, Strava ou Komoot.
