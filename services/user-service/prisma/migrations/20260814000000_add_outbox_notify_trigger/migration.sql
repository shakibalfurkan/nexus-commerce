-- Add a Postgres NOTIFY trigger on outbox_events so the OutboxListener
-- (packages/kafka/src/outboxListener.ts) is woken immediately on insert.
--
-- The listener LISTENs on the 'outbox_channel' channel; the trigger fires
-- AFTER INSERT and sends NEW.id::text, which the listener treats as a
-- "wake up and drain" signal. The outbox poller's slow interval remains the
-- durability fallback (NOTIFY is fire-and-forget and is dropped while no
-- listener is subscribed).
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS mean this
-- is safe to re-apply (incl. shadow-DB replay).

CREATE OR REPLACE FUNCTION notify_outbox_event() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('outbox_channel', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outbox_event_notify ON "outbox_events";

CREATE TRIGGER outbox_event_notify
AFTER INSERT ON "outbox_events"
FOR EACH ROW EXECUTE FUNCTION notify_outbox_event();

-- ─────────────────────────────────────────────────────────────────────────────
-- DOWN MIGRATION (manual rollback — Prisma applies only the up file above).
-- Run these manually to remove the trigger and function:
--
--   DROP TRIGGER IF EXISTS outbox_event_notify ON "outbox_events";
--   DROP FUNCTION IF EXISTS notify_outbox_event();
-- ─────────────────────────────────────────────────────────────────────────────