# 0002 — Lock distribuído Redis por phone + stayId para serializar mensagens

## Contexto

Webhooks do Twilio podem entregar mensagens do mesmo usuário em paralelo quando duas mensagens são enviadas em sequência rápida. Se duas instâncias processarem mensagens concorrentes da mesma conversa, o estado conversacional corrompe: slots são sobrescritos, intents conflitam e o bot responde de forma incoerente.

É necessário garantir que mensagens do mesmo usuário para a mesma estadia sejam processadas em ordem, uma de cada vez.

## Decisão

Usar lock distribuído no Redis (via Redlock simplificado com single-node, dado que já usamos ElastiCache single-primary) com chave composta `lock:conversation:{stayId}:{phone}`. O lock tem TTL de 30 segundos (timeout máximo esperado do ciclo completo: receber → processar → responder). Mensagens que não conseguem adquirir o lock entram em retry com backoff exponencial (3 tentativas, base 500ms).

## Tradeoffs considerados

| Alternativa | Por que descartada |
|---|---|
| **SQS FIFO com MessageGroupId** | Garante ordenação, mas introduz head-of-line blocking: uma mensagem lenta (ex: chamada ao Claude que demora 8s) bloqueia todas as mensagens seguintes do mesmo grupo. Além disso, adiciona ~50-100ms de latência por polling e a complexidade de gerenciar visibility timeout. |
| **Mutex in-process (por instância)** | Não funciona com múltiplas tasks no ECS Fargate. Cada task recebe webhooks independentemente via ALB. |
| **Nenhuma serialização** | O comportamento natural do WhatsApp já serializa mensagens do lado do usuário (digitação sequencial), então colisões reais são raras. Porém, retries do Twilio e edge cases de rede podem gerar entregas duplicadas/fora de ordem. O custo do lock é baixo o suficiente para justificar a proteção. |

## Consequências

- Mensagens concorrentes do mesmo usuário+estadia são serializadas sem depender de fila externa.
- O lock é liberado explicitamente no `finally` do handler; o TTL é safety net contra crashes.
- Se o Redis ficar indisponível, o lock falha aberto (fail-open): a mensagem é processada sem lock. Isso prioriza disponibilidade sobre consistência, aceitável dado que colisões reais são raras.
- A granularidade `phone + stayId` permite que o mesmo hóspede interaja sobre estadias diferentes em paralelo (cenário raro, mas possível com múltiplas reservas).

## Dívida técnica consciente

- **Redlock multi-node**: com single-node ElastiCache, o lock não sobrevive a failover do nó. Se migrarmos para cluster mode, implementar Redlock com quorum. Revisitar se observarmos corrupção de estado em produção após failovers.
- **Métricas de contenção**: não há hoje dashboard de quantas mensagens aguardam lock ou quantos retries ocorrem. Adicionar métricas (lock_acquired, lock_wait_ms, lock_timeout) quando houver volume real para calibrar o TTL e o backoff.
