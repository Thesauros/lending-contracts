#  Граф бизнес-логики Rebalance Finance

##  Общая архитектура бизнес-логики

```mermaid
graph TB
    %% Основные компоненты
    subgraph " Пользовательский слой"
        UI[Frontend UI]
        API[API Gateway]
    end
    
    subgraph "Основные сервисы"
        LENDING[Lending Service]
        REBALANCER[Rebalancer Service]
        WORKERS[Worker Services]
    end
    
    subgraph "DeFi интеграции"
        PROVIDERS[DeFi Providers]
        POOLS[Pool Management]
        VAULTS[Vault Contracts]
    end
    
    subgraph "Данные"
        DB[(PostgreSQL)]
        CACHE[Cache Layer]
        SUBGRAPH[Subgraph Data]
    end
    
    subgraph "Безопасность"
        SAFE[Safe Protocol]
        AWS[AWS Secrets]
    end
    
    %% Связи
    UI --> API
    API --> LENDING
    API --> REBALANCER
    LENDING --> DB
    LENDING --> CACHE
    REBALANCER --> PROVIDERS
    REBALANCER --> SAFE
    WORKERS --> DB
    WORKERS --> SUBGRAPH
    PROVIDERS --> POOLS
    POOLS --> VAULTS
    SAFE --> AWS
```

##  Основные бизнес-процессы

### 1. Автоматическое ребалансирование

```mermaid
sequenceDiagram
    participant Cron as Cron Job
    participant Rebalancer as Rebalancer Service
    participant Pool as Pool Manager
    participant Providers as DeFi Providers
    participant Safe as Safe Protocol
    participant Blockchain as Blockchain
    
    Cron->>Rebalancer: Запуск ребалансирования
    Rebalancer->>Pool: Получить текущие ставки
    Pool->>Providers: Multicall - deposit rates
    Providers-->>Pool: Ставки всех провайдеров
    Pool->>Pool: Найти лучший провайдер
    Pool-->>Rebalancer: Рекомендация ребалансирования
    
    alt Есть лучший провайдер
        Rebalancer->>Safe: Создать транзакцию
        Safe->>Blockchain: Propose transaction
        Blockchain-->>Safe: Transaction hash
        Safe-->>Rebalancer: Успешно предложено
    else Нет лучшего провайдера
        Rebalancer->>Rebalancer: Пропустить ребалансирование
    end
```

### 2. Система наград и очков

```mermaid
graph LR
    subgraph "Пользовательские действия"
        DEPOSIT[Депозит]
        LOCK[Блокировка]
        TASKS[Выполнение задач]
        SOCIAL[Социальная активность]
    end
    
    subgraph "Расчет системы"
        POINTS[Система очков]
        RBLN[RBLN токены]
        MERKLE[Merkle Tree]
    end
    
    subgraph "Распределение"
        REWARDS[Награды]
        CLAIM[Запрос наград]
        DISTRIBUTION[Распределение]
    end
    
    DEPOSIT --> POINTS
    LOCK --> POINTS
    TASKS --> POINTS
    SOCIAL --> POINTS
    
    POINTS --> RBLN
    RBLN --> MERKLE
    MERKLE --> REWARDS
    REWARDS --> CLAIM
    CLAIM --> DISTRIBUTION
```

### 3. Мониторинг и сбор данных

```mermaid
graph TB
    subgraph "Источники данных"
        BLOCKCHAIN[Blockchain Events]
        SUBGRAPH[Subgraph Queries]
        MORALIS[Moralis API]
    end
    
    subgraph "Worker Services"
        WORKER[Pool Data Worker]
        LOCKPERM[Lock Perm Worker]
        POINTS[Points Worker]
        REWARDS[Rewards Worker]
    end
    
    subgraph "Хранение"
        POOL_ENTITIES[Pool Entities]
        PROVIDER_ENTITIES[Provider Entities]
        USER_ENTITIES[User Entities]
        CACHE_ENTITIES[Cache Entities]
    end
    
    BLOCKCHAIN --> WORKER
    SUBGRAPH --> LOCKPERM
    SUBGRAPH --> POINTS
    SUBGRAPH --> REWARDS
    MORALIS --> WORKER
    
    WORKER --> POOL_ENTITIES
    WORKER --> PROVIDER_ENTITIES
    LOCKPERM --> USER_ENTITIES
    POINTS --> USER_ENTITIES
    REWARDS --> USER_ENTITIES
    WORKER --> CACHE_ENTITIES
```

##  DeFi провайдеры и интеграции

### Поддерживаемые протоколы

```mermaid
graph LR
    subgraph "Кредитные протоколы"
        AAVE[Aave V3]
        COMPOUND[Compound V3]
        FRAXLEND[Fraxlend]
        VENUS[Venus]
        SILO[Silo]
        RADIANT[Radiant V2]
        DOLOMITE[Dolomite]
        KINZA[Kinza Binance]
        LODESTAR[Lodestar]
    end
    
    subgraph "Morpho протоколы"
        SPARK[Spark Morpho]
        MOONWELL[Moonwell Morpho]
        SEAMLESS[Seamless Morpho]
        STEAKHOUSE[Steakhouse Morpho]
        GAUNTLET_CORE[Gauntlet Core Morpho]
        GAUNTLET_PRIME[Gauntlet Prime Morpho]
        APOSTRO[Apostro Resolv Morpho]
    end
    
    subgraph "Управление"
        POOL_MANAGER[Pool Manager]
        VAULT_MANAGER[Vault Manager]
        REBALANCER[Rebalancer]
    end
    
    AAVE --> POOL_MANAGER
    COMPOUND --> POOL_MANAGER
    FRAXLEND --> POOL_MANAGER
    VENUS --> POOL_MANAGER
    SILO --> POOL_MANAGER
    RADIANT --> POOL_MANAGER
    DOLOMITE --> POOL_MANAGER
    KINZA --> POOL_MANAGER
    LODESTAR --> POOL_MANAGER
    
    SPARK --> POOL_MANAGER
    MOONWELL --> POOL_MANAGER
    SEAMLESS --> POOL_MANAGER
    STEAKHOUSE --> POOL_MANAGER
    GAUNTLET_CORE --> POOL_MANAGER
    GAUNTLET_PRIME --> POOL_MANAGER
    APOSTRO --> POOL_MANAGER
    
    POOL_MANAGER --> VAULT_MANAGER
    VAULT_MANAGER --> REBALANCER
```

##  API и бизнес-логика

### Основные эндпоинты и их логика

```mermaid
graph TB
    subgraph "Lending API"
        GET_LENDING[GET /lending]
        APR_TICKS[GET /lending/:token/apr-ticks]
        USER_EARNED[GET /lending/:token/user-earned]
        USER_POINTS[GET /lending/user-points]
        USER_LOCKS[GET /lending/user-locks]
        REWARDS_CLAIM[GET /lending/rewards-claim-details]
    end
    
    subgraph "Бизнес-логика"
        CALC_APR[Расчет APR]
        CALC_EARNED[Расчет заработка]
        CALC_POINTS[Расчет очков]
        CALC_RBLN[Расчет RBLN]
        MERKLE_TREE[Merkle Tree генерация]
    end
    
    subgraph "Источники данных"
        POOL_DATA[Pool Data]
        USER_DATA[User Data]
        CACHE_DATA[Cache Data]
        SUBGRAPH_DATA[Subgraph Data]
    end
    
    GET_LENDING --> CALC_APR
    APR_TICKS --> CALC_APR
    USER_EARNED --> CALC_EARNED
    USER_POINTS --> CALC_POINTS
    USER_LOCKS --> USER_DATA
    REWARDS_CLAIM --> CALC_RBLN
    
    CALC_APR --> POOL_DATA
    CALC_EARNED --> USER_DATA
    CALC_POINTS --> USER_DATA
    CALC_RBLN --> MERKLE_TREE
    
    POOL_DATA --> CACHE_DATA
    USER_DATA --> CACHE_DATA
    MERKLE_TREE --> SUBGRAPH_DATA
```

##  Безопасность и транзакции

### Процесс безопасных транзакций

```mermaid
sequenceDiagram
    participant Rebalancer as Rebalancer
    participant Safe as Safe Protocol
    participant API as Safe API
    participant Blockchain as Blockchain
    participant Wallet as Wallet
    
    Rebalancer->>Safe: Создать транзакцию
    Safe->>Safe: Подписать транзакцию
    Safe->>API: Propose transaction
    API->>Blockchain: Сохранить предложение
    
    Note over Rebalancer,Blockchain: Ожидание подтверждения
    
    Wallet->>API: Approve transaction
    API->>Blockchain: Подтвердить транзакцию
    
    Note over Rebalancer,Blockchain: Ожидание выполнения
    
    Wallet->>API: Execute transaction
    API->>Blockchain: Выполнить транзакцию
    Blockchain-->>API: Transaction result
    API-->>Wallet: Успешное выполнение
```

##  Система геймификации

### Логика начисления очков и наград

```mermaid
graph TB
    subgraph "Пользовательские действия"
        CONNECT[Подключение кошелька]
        DEPOSIT[Депозит средств]
        LOCK[Блокировка активов]
        SOCIAL[Социальная активность]
        TASKS[Выполнение задач]
    end
    
    subgraph "Расчет системы"
        POINTS_CALC[Расчет очков]
        RBLN_CALC[Расчет RBLN]
        WEIGHT[Взвешенный расчет]
    end
    
    subgraph "Награды"
        MERKLE_GEN[Merkle Tree генерация]
        REWARD_DIST[Распределение наград]
        CLAIM_PROC[Процесс запроса]
    end
    
    CONNECT --> POINTS_CALC
    DEPOSIT --> POINTS_CALC
    LOCK --> POINTS_CALC
    SOCIAL --> POINTS_CALC
    TASKS --> POINTS_CALC
    
    POINTS_CALC --> WEIGHT
    WEIGHT --> RBLN_CALC
    RBLN_CALC --> MERKLE_GEN
    MERKLE_GEN --> REWARD_DIST
    REWARD_DIST --> CLAIM_PROC
```

##  Мониторинг и аналитика

### Система мониторинга

```mermaid
graph LR
    subgraph " Сбор метрик"
        PERFORMANCE[Производительность]
        ERRORS[Ошибки]
        TRANSACTIONS[Транзакции]
        USER_ACTIVITY[Активность пользователей]
    end
    
    subgraph " Уведомления"
        TELEGRAM[Telegram Bot]
        ALERTS[Система алертов]
        LOGS[Логирование]
    end
    
    subgraph " Аналитика"
        DASHBOARD[Дашборд]
        REPORTS[Отчеты]
        METRICS[Метрики]
    end
    
    PERFORMANCE --> TELEGRAM
    ERRORS --> ALERTS
    TRANSACTIONS --> LOGS
    USER_ACTIVITY --> DASHBOARD
    
    TELEGRAM --> REPORTS
    ALERTS --> METRICS
    LOGS --> DASHBOARD
```

##  Жизненный цикл данных

### Поток данных в системе

```mermaid
graph TB
    subgraph " Источники"
        BLOCKCHAIN_EVENTS[Blockchain Events]
        SUBGRAPH_QUERIES[Subgraph Queries]
        USER_ACTIONS[User Actions]
    end
    
    subgraph " Обработка"
        WORKERS[Worker Services]
        CACHE[Cache Services]
        API[API Services]
    end
    
    subgraph " Хранение"
        POSTGRES[PostgreSQL]
        CACHE_STORAGE[Cache Storage]
        MERKLE_FILES[Merkle Tree Files]
    end
    
    subgraph " Представление"
        API_RESPONSES[API Responses]
        DASHBOARDS[Dashboards]
        NOTIFICATIONS[Notifications]
    end
    
    BLOCKCHAIN_EVENTS --> WORKERS
    SUBGRAPH_QUERIES --> WORKERS
    USER_ACTIONS --> API
    
    WORKERS --> POSTGRES
    WORKERS --> CACHE_STORAGE
    API --> CACHE
    CACHE --> CACHE_STORAGE
    
    POSTGRES --> API_RESPONSES
    CACHE_STORAGE --> API_RESPONSES
    API_RESPONSES --> DASHBOARDS
    API_RESPONSES --> NOTIFICATIONS
```

##  Ключевые бизнес-метрики

### Основные KPI системы

```mermaid
graph TB
    subgraph " Финансовые метрики"
        TVL[Total Value Locked]
        APR[Average APR]
        EARNINGS[User Earnings]
        REBALANCE_FREQ[Rebalance Frequency]
    end
    
    subgraph " Пользовательские метрики"
        ACTIVE_USERS[Active Users]
        USER_RETENTION[User Retention]
        POINTS_DISTRIBUTION[Points Distribution]
        REWARDS_CLAIMED[Rewards Claimed]
    end
    
    subgraph "Технические метрики"
        UPTIME[System Uptime]
        TRANSACTION_SUCCESS[Transaction Success Rate]
        CACHE_HIT_RATE[Cache Hit Rate]
        RESPONSE_TIME[API Response Time]
    end
    
    subgraph "Аналитика"
        PERFORMANCE_DASHBOARD[Performance Dashboard]
        USER_ANALYTICS[User Analytics]
        FINANCIAL_REPORTS[Financial Reports]
        SYSTEM_HEALTH[System Health]
    end
    
    TVL --> PERFORMANCE_DASHBOARD
    APR --> FINANCIAL_REPORTS
    EARNINGS --> USER_ANALYTICS
    REBALANCE_FREQ --> SYSTEM_HEALTH
    
    ACTIVE_USERS --> USER_ANALYTICS
    USER_RETENTION --> PERFORMANCE_DASHBOARD
    POINTS_DISTRIBUTION --> USER_ANALYTICS
    REWARDS_CLAIMED --> FINANCIAL_REPORTS
    
    UPTIME --> SYSTEM_HEALTH
    TRANSACTION_SUCCESS --> PERFORMANCE_DASHBOARD
    CACHE_HIT_RATE --> SYSTEM_HEALTH
    RESPONSE_TIME --> PERFORMANCE_DASHBOARD
```

---

##  Резюме бизнес-логики

###  Основные бизнес-процессы:

1. **Автоматическое ребалансирование** - постоянный мониторинг и переключение между провайдерами для максимизации APR
2. **Система наград** - геймификация с очками и RBLN токенами для увеличения пользовательской активности
3. **Безопасные транзакции** - мультисиг транзакции через Safe Protocol
4. **Мониторинг данных** - сбор и анализ данных из блокчейна и subgraph
5. **API сервисы** - предоставление данных для фронтенда и внешних интеграций

###  Ключевые особенности:

- **Мультисетевая поддержка** (Arbitrum, BSC, Base)
- **Интеграция с 15+ DeFi протоколами**
- **Система кэширования** для оптимизации производительности
- **Telegram уведомления** для мониторинга
- **Merkle tree** для эффективного распределения наград
- **TypeScript** для типобезопасности
- **Nx monorepo** для масштабируемости