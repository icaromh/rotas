### Contexto
Atualmente, a aplicação web faz uma chamada do tipo `POST` para o endpoint do proxy (`https://api.rotas.cc/proxy`), onde o próprio front-end monta e envia a string crua da query do banco de dados (Overpass QL) no corpo da requisição (`data=...`).

### Problemas Atuais
1. O Service Worker do front-end (usando a Cache Storage API nativa) **não permite fazer cache de requisições do tipo POST**. Isso nos impede de salvar em disco as áreas já visitadas para acelerar a performance e permitir uso offline pelo Workbox.
2. Manter o front-end responsável por construir uma string gigante de query em Overpass QL mistura responsabilidades e dificulta futuras manutenções na estrutura da query.

### Solução Proposta (Refatoração)
Ajustar o serviço de backend/worker (`api.rotas.cc`) para que atue como uma API semântica baseada em `GET`, aceitando apenas os parâmetros de busca e se encarregando de construir a string do Overpass.

**Exemplos da Nova API:**

1. **Endpoint de Bairros:**
   - `GET /api/neighborhoods?bbox=41.3,2.15,41.4,2.16`
   
2. **Endpoint de Redes e Ruas:**
   - `GET /api/roads?bbox=41.3,2.15,41.4,2.16&mode=bike&safety=strict`

**Responsabilidade do Backend (Worker):**
- Ler as *querystrings* (`bbox`, `mode`, `safety`).
- Injetar esses valores nos templates da query do Overpass QL internamente.
- Realizar a requisição efetiva (`POST` ou `GET`) para as instâncias públicas do Overpass.
- Devolver o JSON original para o front-end.

### Impacto no Front-end
Após a implementação dessa nova API, nós alteraremos o código no `src/api/overpass.ts` para fazer os `fetch` usando `GET` com os parâmetros. Em seguida, adicionaremos no `vite.config.ts` (na regra do PWA) um `CacheFirst` ou `StaleWhileRevalidate` para o domínio da API, e o sistema passará a armazenar todo o conteúdo automaticamente de forma super performática no browser.

### OpenAPI (Swagger)
Para facilitar o consumo e o versionamento dessa nova API no futuro (ou a geração de clientes tipados via Swagger/Orval no front-end), o novo endpoint deverá expor ou documentar as suas rotas no formato OpenAPI schema.
