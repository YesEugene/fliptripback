/**
 * Скрипт для импорта городов из CSV файла в базу данных
 * Использование: node scripts/import-world-cities.js /path/to/worldcities.csv
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузить переменные окружения
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Ошибка: SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть установлены в .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Парсинг CSV файла
 */
function parseCSV(filePath) {
  console.log(`📖 Чтение файла: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Пропустить заголовок
  const header = lines[0];
  const dataLines = lines.slice(1);
  
  console.log(`📊 Найдено ${dataLines.length} городов в файле`);
  
  const cities = [];
  for (const line of dataLines) {
    if (!line.trim()) continue;
    
    // Разделитель: точка с запятой
    const parts = line.split(';');
    if (parts.length < 2) continue;
    
    const city = parts[0]?.trim();
    const country = parts[1]?.trim();
    
    if (city && country) {
      cities.push({
        name: city,
        country: country
      });
    }
  }
  
  console.log(`✅ Распарсено ${cities.length} городов`);
  return cities;
}

/**
 * Импорт городов в базу данных
 */
async function importCities(cities) {
  console.log(`\n💾 Начало импорта ${cities.length} городов...`);
  
  // Проверить, есть ли уже города в БД
  const { data: existingCities, error: checkError } = await supabase
    .from('cities')
    .select('id, name, country')
    .limit(1);
  
  if (checkError) {
    console.error('❌ Ошибка при проверке существующих городов:', checkError);
    return;
  }
  
  if (existingCities && existingCities.length > 0) {
    console.log('⚠️  В базе данных уже есть города. Проверяем, нужно ли обновлять...');
    
    // Проверить, есть ли поле country
    const hasCountry = existingCities[0].country !== null && existingCities[0].country !== undefined;
    
    if (hasCountry) {
      console.log('ℹ️  Поле country уже заполнено. Пропускаем импорт.');
      console.log('💡 Если нужно переимпортировать, сначала очистите таблицу cities');
      return;
    }
  }
  
  // Импортировать батчами по 1000 записей
  const batchSize = 1000;
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);
    
    try {
      // Проверить, какие города уже существуют
      const cityNames = batch.map(c => c.name);
      const { data: existing } = await supabase
        .from('cities')
        .select('name')
        .in('name', cityNames);
      
      const existingNames = new Set((existing || []).map(c => c.name));
      
      // Разделить на новые и существующие
      const newCities = batch.filter(c => !existingNames.has(c.name));
      const updateCities = batch.filter(c => existingNames.has(c.name));
      
      // Вставить новые города
      if (newCities.length > 0) {
        const { error: insertError } = await supabase
          .from('cities')
          .insert(newCities);
        
        if (insertError) {
          console.error(`❌ Ошибка при вставке батча ${i / batchSize + 1}:`, insertError);
          errors += newCities.length;
        } else {
          imported += newCities.length;
          console.log(`✅ Импортировано ${newCities.length} новых городов (батч ${i / batchSize + 1})`);
        }
      }
      
      // Обновить существующие города (добавить country)
      if (updateCities.length > 0) {
        for (const city of updateCities) {
          const { error: updateError } = await supabase
            .from('cities')
            .update({ country: city.country })
            .eq('name', city.name);
          
          if (updateError) {
            console.error(`❌ Ошибка при обновлении города ${city.name}:`, updateError);
            errors++;
          } else {
            skipped++; // Считаем как обновленные
          }
        }
        
        if (updateCities.length > 0) {
          console.log(`🔄 Обновлено ${updateCities.length} существующих городов (батч ${i / batchSize + 1})`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Ошибка при обработке батча ${i / batchSize + 1}:`, error);
      errors += batch.length;
    }
    
    // Прогресс
    const progress = ((i + batch.length) / cities.length * 100).toFixed(1);
    console.log(`📊 Прогресс: ${progress}% (${i + batch.length} / ${cities.length})`);
  }
  
  console.log(`\n✅ Импорт завершен:`);
  console.log(`   - Импортировано новых: ${imported}`);
  console.log(`   - Обновлено существующих: ${skipped}`);
  console.log(`   - Ошибок: ${errors}`);
  
  // Финальная проверка
  const { data: finalCount } = await supabase
    .from('cities')
    .select('id', { count: 'exact', head: true });
  
  console.log(`\n📊 Всего городов в БД: ${finalCount?.length || 0}`);
}

/**
 * Главная функция
 */
async function main() {
  const csvPath = process.argv[2] || path.join(__dirname, '../worldcities.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Файл не найден: ${csvPath}`);
    console.log('💡 Использование: node scripts/import-world-cities.js /path/to/worldcities.csv');
    process.exit(1);
  }
  
  console.log('🚀 Начало импорта городов из CSV...\n');
  
  try {
    // Парсинг CSV
    const cities = parseCSV(csvPath);
    
    if (cities.length === 0) {
      console.error('❌ Не удалось распарсить города из CSV файла');
      process.exit(1);
    }
    
    // Импорт в БД
    await importCities(cities);
    
    console.log('\n✅ Импорт успешно завершен!');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

// Запуск
main();

