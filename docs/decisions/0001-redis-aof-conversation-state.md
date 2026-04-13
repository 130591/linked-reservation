# 0001 — Redis com AOF para persistência do estado conversacional

## Contexto

O fluxo conversacional via WhatsApp exige manter estado entre mensagens (intent detectada, slots coletados, etapa do diálogo). Esse estado precisa ser lido e escrito com latência sub-milissegundo a cada mensagem recebida. A questão era onde persistir esse estado: PostgreSQL (já presente no stack) ou Redis.

## Decisão

Usar Redis com persistência AOF (Append-Only File) via AWS ElastiCache como store primário do estado conversacional. Cada conversa é representada por uma chave com TTL alinhado à duração esperada da sessão. O AOF é configurado com `appendfsync everysec`, aceitando perda máxima de ~1 segundo de dados em caso de falha do nó.

## Tradeoffs considerados

| Alternativa | Por que descartada |
|---|---|
| **PostgreSQL com tabela de sessão** | Latência de escrita/leitura incompatível com o loop conversacional (cada mensagem gera read-modify-write). Adicionaria carga no banco relacional que já serve reservas e identidade. |
| **Redis sem persistência (cache puro)** | Risco de perder estado mid-conversation em caso de restart do nó ElastiCache, forçando o usuário a recomeçar o diálogo. |
| **DynamoDB** | Latência adequada, mas introduziria mais um serviço gerenciado no stack sem necessidade. ElastiCache já estava planejado para cache de disponibilidade. |

## Consequências

- O estado conversacional vive exclusivamente no Redis; não há réplica no PostgreSQL.
- Em caso de falha do nó ElastiCache, perde-se no máximo ~1 segundo de escritas. Na prática, o usuário reenvia a mensagem e o bot reinicia o fluxo — impacto aceitável para o produto.
- ElastiCache Multi-AZ com failover automático reduz a janela de indisponibilidade a poucos segundos.
- O time precisa monitorar `aof_last_bgrewrite_status` e métricas de memória do ElastiCache para evitar degradação silenciosa.

## Dívida técnica consciente

- **Snapshot periódico para auditoria**: não há hoje mecanismo para reconstruir o histórico de uma conversa a partir do Redis. Se surgir necessidade de auditoria ou replay, será necessário implementar write-ahead log no PostgreSQL ou stream para S3. Revisitar quando houver requisito regulatório ou de debugging em produção.
- **Eviction policy**: o `maxmemory-policy` está como `noeviction` para evitar perda silenciosa de sessões ativas. Se a base de hotéis crescer significativamente, será necessário dimensionar o nó ou implementar tiered storage.
