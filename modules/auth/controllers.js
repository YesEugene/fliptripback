/**
 * Auth Module - Controllers
 * Обработчики запросов для аутентификации
 */

// TODO: Интегрировать с реальной базой данных
// Пока используем простой in-memory хранилище для демо
const users = [];

/**
 * Регистрация нового пользователя
 */
export async function register(req, res) {
  try {
    const { name, email, password, role = 'user' } = req.body;

    // Валидация
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Все поля обязательны' 
      });
    }

    // Проверка существования пользователя
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Пользователь с таким email уже существует' 
      });
    }

    // Создание пользователя
    // TODO: Хеширование пароля с помощью bcrypt
    const newUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      password, // В продакшене должен быть захеширован
      role: role === 'guide' ? 'guide' : 'user',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // TODO: Генерация JWT токена
    const token = `token-${Date.now()}`;

    res.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка регистрации' 
    });
  }
}

/**
 * Вход пользователя
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email и пароль обязательны' 
      });
    }

    // Поиск пользователя
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Неверный email или пароль' 
      });
    }

    // TODO: Генерация JWT токена
    const token = `token-${Date.now()}`;

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка входа' 
    });
  }
}

/**
 * Получение текущего пользователя
 */
export async function getCurrentUser(req, res) {
  try {
    // req.user устанавливается middleware authenticateToken
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Пользователь не найден' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка получения данных пользователя' 
    });
  }
}

