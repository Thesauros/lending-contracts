# Rebalance Finance Backend

[![Nx](https://img.shields.io/badge/Nx-16.5.1-blue)](https://nx.dev)
[![NestJS](https://img.shields.io/badge/NestJS-10.0.2-red)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1.3-blue)](https://www.typescriptlang.org)

> **DeFi (Decentralized Finance) проект для автоматического ребалансирования криптоактивов между различными протоколами кредитования**

## Обзор проекта

Rebalance Finance Backend - это комплексная система для автоматического управления криптоактивами, которая максимизирует доходность пользователей путем автоматического переключения между различными протоколами кредитования в зависимости от текущих ставок APR.

###  Ключевые возможности

- **Автоматическое ребалансирование** активов между протоколами кредитования
- **Мониторинг APR** в реальном времени
- **Система очков и наград** (RBLN токены)
- **Управление блокировками** активов
- **Геймификация** с системой задач
- **Безопасные транзакции** через Safe (Gnosis Safe)

##  Архитектура

Проект построен на **Nx monorepo** с использованием **NestJS**:

```
backend-ts/
├── apps/
│   ├── api/                 # REST API сервис
│   ├── rebalancer/          # Автоматическое ребалансирование
│   ├── worker/              # Сбор данных о пулах
│   ├── worker-lockperm/     # Обработка перманентных блокировок
│   ├── worker-points/       # Система очков пользователей
│   └── worker-rewards/      # Распределение наград
├── libs/                    # Общие библиотеки
│   ├── database/           # База данных и сущности
│   ├── enums/              # Перечисления
│   ├── providers/          # Интеграции с DeFi протоколами
│   ├── pools/              # Управление пулами
│   └── ...
└── abis/                   # ABI контрактов
```

##  Поддерживаемые сети и токены

### Сети
- **Arbitrum** (основная сеть)
- **BSC** (Binance Smart Chain)
- **Base**

### Токены
- **Stablecoins:** USDT, USDC, USDC.e, FRAX, DAI
- **Major tokens:** wBTC, wETH, wBNB, ARB

##  Интегрированные протоколы

Проект поддерживает более 15 DeFi протоколов кредитования:

- **Aave V3** - Крупнейший протокол кредитования
- **Compound V3** - Протокол с алгоритмическими ставками
- **Fraxlend** - Протокол с гибкими параметрами
- **Venus** - Ведущий протокол на BSC
- **Silo** - Протокол с изолированными пулами
- **Radiant V2** - Кроссчейн протокол
- **И другие...**

##  Технический стек

### Backend
- **NestJS** - Фреймворк для Node.js
- **TypeScript** - Типизированный JavaScript
- **TypeORM** - ORM для работы с базой данных
- **PostgreSQL** - Реляционная база данных

### Блокчейн
- **Ethers.js** - Библиотека для работы с Ethereum
- **TypeChain** - Генерация типов для смарт-контрактов
- **Safe Protocol Kit** - Безопасные мультисиг транзакции

### Инфраструктура
- **Nx** - Монорепозиторий и инструменты сборки
- **AWS Secrets Manager** - Управление секретами
- **Moralis** - API для блокчейн данных
- **Telegram Bot** - Уведомления и мониторинг

##  Установка и запуск

### Предварительные требования

- Node.js 18+
- Yarn
- PostgreSQL
- AWS CLI (для Secrets Manager)

### Установка зависимостей

```bash
yarn install
```

### Получение ABI контрактов

1. Клонируйте репозиторий контрактов:
```bash
git clone https://github.com/REBALANCE-Finance/lending-contracts
cd lending-contracts
npm install
npx hardhat compile
```

2. Скопируйте `.json` файлы из `artifacts/contracts/` в папку `abis/`

3. Сгенерируйте типы:
```bash
yarn typechain
```

### Настройка окружения

Создайте файл `.env` с необходимыми переменными:

```env
# База данных
DATABASE_URL=postgresql://user:password@localhost:5432/rebalance_finance

# AWS Secrets Manager
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Блокчейн
NETWORK=Arbitrum
PRIVATE_KEY=your_private_key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Moralis
MORALIS_API_KEY=your_moralis_key
```

### Запуск сервисов

```bash
# API сервис
yarn start:api

# Rebalancer
yarn start:rebalancer

# Worker сервисы
nx serve worker
nx serve worker-lockperm
nx serve worker-points
nx serve worker-rewards
```

##  API Endpoints

### Основные эндпоинты

- `GET /lending` - Получение данных о кредитовании
- `GET /lending/:token/apr-ticks/:interval/:intervals` - APR по интервалам
- `GET /lending/:token/user-earned/:userAddress` - Заработок пользователя
- `GET /lending/user-points/:userAddress` - Очки пользователя
- `GET /lending/user-locks/:userAddress` - Блокировки пользователя
- `GET /lending/rewards-claim-details/:userAddress` - Детали наград

### Swagger документация

После запуска API сервиса, документация доступна по адресу:
```
http://localhost:3000/api
```

##  Безопасность

### Мультисиг транзакции
- Все транзакции выполняются через **Safe (Gnosis Safe)**
- Поддержка режимов: Propose → Approve → Execute
- Требуется подтверждение от нескольких владельцев

### Управление секретами
- **AWS Secrets Manager** для хранения приватных ключей
- Шифрование чувствительных данных
- Ротация ключей

##  Мониторинг и аналитика

### Telegram уведомления
- Уведомления о ребалансировании
- Мониторинг ошибок
- Статистика производительности

### Кэширование
- Кэш данных из subgraph
- Кэш цен токенов
- Кэш балансов пользователей

##  Система наград

### RBLN токены
- Начисление за активность
- Расчет на основе суммы и времени блокировки
- Merkle tree для распределения наград

### Система очков
- Очки за различные действия
- Геймификация для увеличения активности
- Система задач и достижений

##  Разработка

### Структура кода
- **TypeScript** для типизации
- **ESLint** и **Prettier** для форматирования
- **Jest** для тестирования

### Команды разработки

```bash
# Генерация типов контрактов
yarn typechain

# Запуск тестов
nx test

# Линтинг
nx lint

# Форматирование
nx format:write
```

## Лицензия

MIT License

##  Ссылки

- [Документация NestJS](https://nestjs.com)
- [Документация Nx](https://nx.dev)
- [Safe Protocol Kit](https://docs.safe.global)
- [Moralis API](https://docs.moralis.io)

--