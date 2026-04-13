# 0006 — Recuperação de mensagens perdidas via Twilio Message Logs — adiada para pós-MVP

## Contexto

Mensagens podem ser perdidas entre o Twilio e o sistema por diversos motivos:

- **Falha na entrega do webhook**: timeout do ALB, task em shutdown, network blip.
- **Erro no processamento**: exceção não tratada que impede o ack do webhook (Twilio retenta, mas com limite de tentativas).
- **Indisponibilidade do sistema**: deploy com janela de indisponibilidade, falha de infraestrutura.

O Twilio retém logs de todas as mensagens enviadas e recebidas por até 400 dias via Message Logs API. Isso permite implementar um job de reconciliação que compara mensagens registradas no Twilio com mensagens processadas pelo sistema e reprocessa as ausentes.

## Decisão

Adiar a implementação do job de reconciliação para depois do MVP. Registrar como dívida técnica com design antecipado documentado.

O que **está** implementado no MVP:
- Twilio faz até 14 retries com backoff exponencial para webhooks que retornam erro ou timeout.
- Cada mensagem processada com sucesso é logada com `messageSid` do Twilio, permitindo reconciliação futura.
- O graceful shutdown (ADR 0004) minimiza mensagens perdidas durante deploys.

O que **não** está implementado:
- Job periódico que consulta `GET /2010-04-01/Accounts/{sid}/Messages.json` e compara com mensagens processadas.
- Reprocessamento automático de mensagens identificadas como perdidas.
- Alerting de gap detection (ex: "hotel X não recebeu mensagens nas últimas 2 horas apesar de ter hóspedes ativos").

## Tradeoffs considerados

| Alternativa | Por que descartada/adiada |
|---|---|
| **Implementar reconciliação no MVP** | Complexidade significativa (idempotência no reprocessamento, janela de reconciliação, handling de mensagens expiradas) sem volume que justifique. No MVP, o time consegue monitorar manualmente. |
| **Dead letter queue (DLQ) para webhooks falhos** | Útil, mas não cobre o caso de webhook que nunca chegou (ex: timeout de rede antes do ALB). A reconciliação via Twilio API é a única forma de detectar mensagens que nunca atingiram o sistema. |
| **Webhook com ack assíncrono (responder 200 imediato, processar depois)** | Reduz risco de timeout mas introduce complexidade de fila interna. Avaliado como overengineering para o volume do MVP. |

## Consequências

- No MVP, se uma mensagem for perdida após esgotar os retries do Twilio, ela é silenciosamente descartada. O hóspede provavelmente reenvia a mensagem manualmente.
- O risco é aceitável porque: (a) os 14 retries do Twilio cobrem falhas transientes, (b) o graceful shutdown minimiza perdas em deploy, (c) o volume baixo do MVP torna perdas detectáveis via logs.
- O time deve monitorar o dashboard do Twilio para identificar mensagens com status `undelivered` para webhooks do sistema.

## Dívida técnica consciente

- **Trigger de revisão**: implementar reconciliação quando o volume atingir >100 mensagens/dia por hotel ou quando o primeiro incidente de mensagem perdida impactar um hóspede.
- **Design antecipado do job de reconciliação**:
  1. Cron job (ECS Scheduled Task ou EventBridge) executa a cada 15 minutos.
  2. Consulta Twilio Message Logs dos últimos 30 minutos (janela com overlap de 15min para cobrir edge cases).
  3. Compara `messageSid` com tabela de mensagens processadas no PostgreSQL.
  4. Mensagens ausentes são publicadas na fila SQS existente para reprocessamento.
  5. O handler de mensagem já deve ser idempotente (keyed por `messageSid`) — isso é pré-requisito e deve ser garantido antes de implementar a reconciliação.
- **Idempotência**: registrar `messageSid` como unique constraint no PostgreSQL desde o MVP, mesmo sem o job de reconciliação. Isso evita reprocessamento duplicado quando a feature for implementada e é barato de fazer agora.
