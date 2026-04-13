# 0005 — Detecção de anomalia de webhooks Twilio — adiada para pós-MVP

## Contexto

Webhooks do Twilio são o ponto de entrada de todas as mensagens do sistema. Anomalias nesse fluxo podem indicar:

- **Abuso**: spam ou tentativa de injection via mensagens automatizadas.
- **Falha do Twilio**: burst de retries por erro de entrega, gerando carga artificial.
- **Comportamento anômalo de hóspede**: volume incomum de mensagens (ex: hóspede frustrado enviando dezenas de mensagens em sequência).

A detecção dessas anomalias requer um baseline de frequência normal de mensagens por hotel, que só pode ser construído com dados reais de produção.

## Decisão

Adiar a implementação de detecção de anomalia para depois do MVP. Registrar a decisão como dívida técnica consciente com trigger de revisão.

O que **está** implementado no MVP como proteção mínima:
- Validação de assinatura Twilio (X-Twilio-Signature) em todo webhook — rejeita requests forjados.
- Rate limiting global por IP no ALB (regra WAF).
- Lock distribuído por conversa (ADR 0002) que impede processamento paralelo da mesma conversa.

O que **não** está implementado:
- Rate limiting por phone number ou por hotel.
- Detecção de burst (ex: >20 mensagens/minuto do mesmo número).
- Alertas de volume anômalo por hotel (desvio em relação ao baseline histórico).

## Tradeoffs considerados

| Alternativa | Por que descartada/adiada |
|---|---|
| **Rate limit fixo por phone (ex: 10 msg/min)** | Sem dados reais, qualquer threshold é arbitrário. Um threshold muito baixo bloqueia hóspedes legítimos em conversa ativa; muito alto não protege contra nada. |
| **Anomaly detection baseada em Z-score do volume por hotel** | Requer pelo menos 30 dias de dados de produção para construir baseline estatisticamente significativo. No MVP, com zero hotéis ativos, não há baseline. |
| **Implementar mesmo sem dados, com thresholds conservadores** | Adiciona complexidade sem proteção real. O esforço é melhor investido em funcionalidades core que validem o produto. |

## Consequências

- No MVP, o sistema está protegido contra requests forjados (assinatura Twilio) e contra DDoS genérico (WAF), mas não contra abuso sofisticado via mensagens legítimas.
- O risco é aceitável porque: (a) o número de hotéis no MVP é pequeno e conhecido, (b) o volume de mensagens é baixo, (c) o custo por mensagem processada (Twilio + Anthropic) é monitorado via billing alerts da AWS e dashboard da Anthropic.
- Se um hotel receber volume anômalo antes da feature ser implementada, o time detecta via alertas de custo e pode bloquear manualmente o número via Twilio console.

## Dívida técnica consciente

- **Trigger de revisão**: implementar detecção de anomalia quando houver pelo menos 3 hotéis ativos com 30+ dias de dados históricos. Nesse ponto, haverá baseline suficiente para calibrar thresholds por segmento (hotel pequeno vs. resort).
- **Dados a coletar desde o MVP**: mesmo sem detecção, logar `messages_per_phone_per_hour` e `messages_per_property_per_hour` como métricas no CloudWatch desde o dia 1. Isso acelera a construção do baseline quando a feature for priorizada.
- **Design antecipado**: a arquitetura de rate limiting deve ser por property (não global), pois o volume esperado varia drasticamente entre um hostel de 10 quartos e um resort de 300.
