# 0004 — Graceful shutdown com Terminus sincronizado ao deregistration delay do ALB

## Contexto

O deploy no ECS Fargate usa rolling update: novas tasks sobem, o ALB drena as antigas. Durante o drain, a task antiga ainda pode estar processando mensagens de WhatsApp que envolvem chamada à LLM (até 8s) e envio de resposta via Twilio. Se o container for terminado antes de concluir esses requests, o hóspede não recebe resposta e o estado da conversa pode ficar inconsistente (lock não liberado, estado parcialmente escrito no Redis).

## Decisão

Configurar três valores sincronizados:

| Componente | Configuração | Valor |
|---|---|---|
| **ALB Target Group** | `deregistration_delay.timeout_seconds` | `30` |
| **NestJS (Terminus)** | `gracefulShutdownTimeoutMs` | `25000` |
| **ECS Task Definition** | `stopTimeout` | `35` |

Fluxo de shutdown:

1. ECS envia `SIGTERM` à task.
2. ALB para de enviar novos requests (deregistration inicia).
3. Terminus intercepta `SIGTERM`, para de aceitar novas conexões e aguarda até 25s para requests em voo.
4. Health check do Terminus retorna `503` imediatamente, acelerando o deregistration do ALB.
5. Se após 25s ainda houver requests pendentes, Terminus força o shutdown.
6. ECS aguarda até 35s (`stopTimeout`) antes de enviar `SIGKILL`.

A margem de 5s entre Terminus (25s) e ALB (30s) garante que o app faça cleanup antes do ALB considerar a task como drenada. A margem de 5s entre ALB (30s) e ECS (35s) é safety net contra race conditions no deregistration.

## Tradeoffs considerados

| Alternativa | Por que descartada |
|---|---|
| **Timeout mais longo (60s+)** | Deploys mais lentos. Com rolling update de 2 tasks, cada deploy levaria >2 minutos só em drain. Para o MVP com poucos hotéis, 30s cobre o caso de uso (LLM timeout 8s + Twilio send ~2s + margem). |
| **Sem graceful shutdown (kill imediato)** | Requests em voo são perdidos. O hóspede não recebe resposta, o lock no Redis fica preso até TTL expirar (30s), e o estado da conversa pode corromper. |
| **Lifecycle hook `draining` do ECS** | Adiciona complexidade (Lambda ou SNS para sinalizar completude) sem benefício claro sobre o mecanismo nativo de SIGTERM + Terminus. Útil para workloads com jobs longos (minutos), não para requests de segundos. |

## Consequências

- Zero-downtime deploys: hóspedes em conversa ativa não percebem o deploy.
- O time precisa manter os três valores sincronizados. Se alguém alterar o `deregistration_delay` no Terraform sem ajustar o Terminus, requests podem ser cortados. Documentar a relação nos comentários do Terraform e no `main.ts`.
- O health check do Terminus (`/health`) é o mesmo endpoint usado pelo ALB para health check — quando retorna `503`, o ALB acelera o drain.
- Métricas de `shutdown_duration_ms` são logadas para validar que 25s é suficiente em produção.

## Dívida técnica consciente

- **Connection draining granular**: hoje o Terminus drena todas as conexões igualmente. Se no futuro houver WebSocket ou SSE (ex: painel do hotel com atualizações em tempo real), será necessário drain diferenciado por tipo de conexão. Revisitar quando houver conexões long-lived.
- **Blue/green deploy**: rolling update é suficiente para o MVP, mas não permite rollback instantâneo. Migrar para blue/green quando o custo de manter duas task definitions ativas for justificável (provavelmente após Product-Market Fit).
