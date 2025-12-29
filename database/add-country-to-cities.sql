-- Миграция: Добавление поля country в таблицу cities
-- Безопасная миграция: можно выполнять несколько раз

-- Добавить колонку country, если её нет
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cities' AND column_name = 'country'
  ) THEN
    ALTER TABLE cities ADD COLUMN country VARCHAR(100);
    RAISE NOTICE 'Добавлена колонка country в таблицу cities';
  ELSE
    RAISE NOTICE 'Колонка country уже существует';
  END IF;
END $$;

-- Создать индекс для быстрого поиска по стране
CREATE INDEX IF NOT EXISTS idx_cities_country ON cities(country);

-- Создать составной индекс для поиска по городу и стране
CREATE INDEX IF NOT EXISTS idx_cities_name_country ON cities(name, country);


