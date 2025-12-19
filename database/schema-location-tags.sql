-- Таблица для связи локаций с тегами
-- Аналогично tour_tags, но для locations

CREATE TABLE IF NOT EXISTS location_tags (
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, tag_id)
);

-- Индекс для производительности
CREATE INDEX IF NOT EXISTS idx_location_tags_location_id ON location_tags(location_id);
CREATE INDEX IF NOT EXISTS idx_location_tags_tag_id ON location_tags(tag_id);


