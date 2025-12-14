/**
 * Auth Module - Middleware
 * Middleware для проверки авторизации
 */

/**
 * Проверка JWT токена
 * TODO: Реализовать проверку реального JWT токена
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Токен не предоставлен' 
    });
  }

  // TODO: Валидация JWT токена
  // Пока используем простую проверку для демо
  if (!token.startsWith('token-')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Неверный токен' 
    });
  }

  // TODO: Извлечение данных пользователя из токена
  // Пока используем заглушку
  req.user = {
    id: 'user-123', // Должно извлекаться из токена
    role: 'user'
  };

  next();
}

/**
 * Проверка роли пользователя
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ 
        success: false, 
        message: 'Недостаточно прав доступа' 
      });
    }
    next();
  };
}

