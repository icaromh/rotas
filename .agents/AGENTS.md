# Rotas Workspace Rules

- **Changelog Requirement**: A cada nova feature finalizada, você (o agente) deve sempre atualizar o arquivo `CHANGELOG.md` documentando a funcionalidade antes de finalizar a task.

- **Versioning Requirement**: Sempre que atualizar o CHANGELOG.md com uma nova feature ou correção e commitar direto na `main`, deve-se também lançar uma nova versão via comando `npm version <major|minor|patch> -m "..."` respeitando o Semantic Versioning (SemVer), e depois fazer push com as tags (`git push origin main --tags`). Caso o trabalho seja feito empacotado em um PR (Pull Request), este processo de atualização de changelog e bump de versão também deve fazer parte do fluxo do PR antes de integrá-lo.

- **Localization Requirement**: Ao criar ou alterar funcionalidades com textos visíveis ao usuário, você deve sempre extrair e utilizar strings localizadas (i18n) através da biblioteca `react-i18next`. Todas as chaves devem ser registradas nos arquivos de dicionário em `src/i18n/locales/` (`en-US.json`, `pt-BR.json` e `es-ES.json`). Nunca utilize strings "hardcoded" diretamente nos componentes.
