# Plan: Notifications (Email/Chat)

**Impact: MEDIUM | Effort: LOW-MEDIUM (2-3 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Send alert notifications via email and chat platforms (Slack, Microsoft Teams, Discord) when critical events occur.

## Current State
- Alerts visible only in NOC console
- No external notification mechanism
- Operators must constantly monitor the console

## Design

### Notification Channels
| Channel | Protocol | Config |
|---------|----------|--------|
| Email | SMTP/TLS | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS |
| Slack | Webhook URL | SLACK_WEBHOOK_URL |
| Teams | Webhook URL | TEAMS_WEBHOOK_URL |
| Discord | Webhook URL | DISCORD_WEBHOOK_URL |

### Notification Rules
- Critical alerts -> all channels immediately
- High alerts -> chat channels, email digest every 15 min
- Medium/Low -> email digest every hour
- Configurable per-service overrides

## Implementation

### Backend
1. `plugins/notifications/channels.py` (NEW) - channel implementations
   - `EmailChannel` - SMTP with TLS
   - `SlackChannel` - Incoming webhook (Block Kit format)
   - `TeamsChannel` - Adaptive Card format
   - `DiscordChannel` - Embed format
2. `plugins/notifications/dispatcher.py` (NEW) - notification dispatcher
   - `dispatch(alert, channels)` - fan-out to channels
   - Rate limiting per channel
   - Digest aggregation for non-critical
3. `plugins/notifications/router.py` (NEW) - config API
   - `GET /api/v1/notifications/config` - get notification config
   - `POST /api/v1/notifications/config` - update config
   - `POST /api/v1/notifications/test` - send test notification
4. Wire into alert-noc store.py: dispatch on create_alert for critical/high

### Frontend
5. `ui/src/components/NotificationSettings.tsx` (NEW) - channel config UI
6. `ui/src/pages/NOCAlerts.tsx` - notification indicator on alerts
7. `ui/src/api/client.ts` - notificationsAPI

### Docker
8. Environment variables for SMTP and webhook URLs
9. Docker Compose: add env vars

## Verification
1. Critical alert fires -> Slack message received within seconds
2. Test notification button -> sends test to all configured channels
3. High alert -> chat notification immediate, email after 15 min
4. Rate limiting -> no more than 1 alert/min per channel
