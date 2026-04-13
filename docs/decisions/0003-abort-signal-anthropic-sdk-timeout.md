# 0003 — AbortSignal com timeout no SDK da Anthropic

## Contexto

O Claude Haiku é chamado a cada mensagem do hóspede para classificar intent e extrair slots. Em condições normais responde em 1-3 segundos, mas sob carga da API da Anthropic ou com prompts que triggeram respostas longas, a latência pode ultrapassar 10 segundos. O hóspede no WhatsApp espera resposta em poucos segundos — uma espera longa sem feedback degrada a experiência e pode levar ao abandono da conversa.

## Decisão

Passar `AbortSignal.timeout(8000)` na chamada ao SDK da Anthropic. Se o timeout dispara:

1. A resposta da LLM é descartada.
2. O intent é classificado como `UNKNOWN`.
3. O fluxo existente de escalação para atendente humano é acionado (mesmo fluxo usado quando a LLM não consegue classificar com confiança).
4. O hóspede recebe mensagem de fallback: "Vou transferir você para um atendente que pode ajudar melhor."

O timeout de 8 segundos foi calibrado para cobrir p99 observado em testes (~5s) com margem, sem exceder o limite de paciência do usuário no WhatsApp (~10-15s).

## Tradeoffs considerados

| Alternativa | Por que descartada |
|---|---|
| **Timeout via `httpAgent` do Node.js** | Menos ergonômico e não cancela a promise do SDK, apenas a conexão TCP. O AbortSignal cancela a operação de forma cooperativa e é suportado nativamente pelo SDK da Anthropic. |
| **Retry com timeout menor (ex: 3s + 3s)** | Duplicaria custo de tokens e latência total no caso de a API estar genuinamente lenta. Um retry só faz sentido para erros transientes (429, 500), não para lentidão sustentada. |
| **Sem timeout (esperar indefinidamente)** | Risco de prender o worker indefinidamente, esgotando a capacidade de processamento das tasks Fargate. Além disso, o hóspede provavelmente já teria saído da conversa. |
| **Circuit breaker na camada de serviço** | Complementar ao timeout, não substituto. O circuit breaker será considerado quando houver volume suficiente para calibrar thresholds de abertura. |

## Consequências

- O pior caso de latência percebida pelo hóspede é ~8 segundos + tempo de envio da mensagem de fallback (~1s).
- O fallback para atendente humano já existe e é testado — o timeout não introduz um novo caminho de código, apenas mais um trigger para um caminho existente.
- Chamadas canceladas via AbortSignal não geram cobrança de tokens de output na API da Anthropic (a request é abortada antes da resposta completa).
- Logs estruturados registram `llm.timeout: true` com o `traceId` da conversa para correlação.

## Dívida técnica consciente

- **Circuit breaker**: não implementado no MVP. Se a API da Anthropic apresentar degradação sustentada (ex: p50 > 5s por vários minutos), o sistema vai escalar para humano em volume — o que pode sobrecarregar a equipe de atendimento. Implementar circuit breaker com half-open state quando houver dados de produção para calibrar. Revisitar após 30 dias de operação.
- **Fallback para modelo alternativo**: hoje não há secundário. Se o Haiku ficar indisponível, 100% vai para humano. Avaliar fallback para outro modelo (ex: GPT-4o-mini) como redundância quando houver budget para manter dois provedores.
