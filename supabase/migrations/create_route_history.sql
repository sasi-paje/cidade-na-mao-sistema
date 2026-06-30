-- Tabela de histórico da rota
-- Armazena os eventos/timeline de cada rota

CREATE TABLE IF NOT EXISTS trx_route_history (
  id BIGSERIAL PRIMARY KEY,
  id_route BIGINT NOT NULL REFERENCES trx_route(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- STATUS_CHANGE, DELIVERY_UPDATE, etc.
  event_label VARCHAR(100) NOT NULL, -- "Rota Criada", "Em Rota de Entrega", etc.
  event_description TEXT, -- Descrição detalhada do evento
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Data/hora do evento
  metadata JSONB, -- Dados adicionais em formato JSON
  is_test BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by BIGINT
);

-- Índice para buscar histórico por rota
CREATE INDEX IF NOT EXISTS idx_route_history_route ON trx_route_history(id_route);
CREATE INDEX IF NOT EXISTS idx_route_history_date ON trx_route_history(event_at);

-- Comentário para documentar os tipos de evento
COMMENT ON TABLE trx_route_history IS 'Tabela de histórico/timeline da rota';
COMMENT ON COLUMN trx_route_history.event_type IS 'Tipo do evento: STATUS_CHANGE, DELIVERY_UPDATE, INVOICE_ASSIGNED, etc.';