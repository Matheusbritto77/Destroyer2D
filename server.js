// server.js - Servidor de jogo multiplayer de naves espaciais
const uWS = require('uWebSockets.js');

// Configurações do jogo
const GAME_CONFIG = {
    tickRate: 60,                // Atualizações por segundo
    worldWidth: 50000,           // Largura do mundo do jogo
    worldHeight: 50000,          // Altura do mundo do jogo
    spawnRadius: 1000,           // Raio da área de spawn
    weaponCooldown: 300,         // Tempo mínimo entre disparos (ms)
    projectileSpeed: 500,        // Velocidade dos projéteis
    projectileLifetime: 1000,    // Duração dos projéteis (ms)
    maxProjectiles: 100,         // Projéteis máximos por jogador
    defaultShipStats: {
      maxHealth: 100,            // Vida máxima
      maxShield: 50,             // Escudo máximo
      shieldRegen: 0.5,          // Regeneração de escudo por segundo
      speed: 30,                // Velocidade de movimento
      rotationSpeed: 2,         // Velocidade de rotação
      damage: 10,                // Dano base
      radius: 30                 // Raio da nave (para colisões)
    },
    // Configurações de inimigos
    enemies: {
      spawnRate: {
        basic: 5000,             // Um inimigo básico a cada 5 segundos
        medium: 15000,           // Um inimigo médio a cada 15 segundos
        boss: 60000              // Um boss a cada 60 segundos
      },
      maxCount: {
        basic: 1,               // Máximo de inimigos básicos simultâneos
        medium: 1,              // Máximo de inimigos médios simultâneos
        boss: 1                  // Máximo de bosses simultâneos
      },
      stats: {
        basic: {
          health: 30,
          speed: 60,
          damage: 5,
          radius: 25,
          scoreValue: 5,
          fireRate: 6000         // Dispara a cada 2 segundos
        },
        medium: {
          health: 100,
          speed: 40,
          damage: 10,
          radius: 40,
          scoreValue: 15,
          fireRate: 4000         // Dispara a cada 1.5 segundos
        },
        boss: {
          health: 500,
          speed: 15,
          damage: 20,
          radius: 80,
          scoreValue: 50,
          fireRate: 3000         // Dispara a cada 1 segundo
        }
      }
    }
  };

// Estruturas de dados principais
const players = new Map();         // Todos os jogadores
const projectiles = new Map();
const enemies = new Map();       // Todos os projéteis
const rooms = new Map();           // Salas de jogo

// Inicializar sala pública
rooms.set('public', {
  id: 'public',
  name: 'Sala Pública',
  players: new Set(),
  maxPlayers: 50,
  createdAt: Date.now()
});

// Contador de IDs
let nextPlayerId = 1;
let nextProjectileId = 1;
let nextEnemyId = 1;

// Criar aplicação uWebSockets
const app = uWS.App();
// Contadores para spawners
const enemySpawnTimers = {
    basic: 0,
    medium: 0,
    boss: 0
  };

// Gerar posição inicial aleatória
function getRandomSpawnPosition() {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * GAME_CONFIG.spawnRadius;
  
  return {
    x: GAME_CONFIG.worldWidth / 2 + Math.cos(angle) * distance,
    y: GAME_CONFIG.worldHeight / 2 + Math.sin(angle) * distance,
    rotation: Math.random() * Math.PI * 2
  };
}

// Criar um novo jogador
function createPlayer(id, name) {
  const spawnPosition = getRandomSpawnPosition();
  
  return {
    id,
    name: name || `Piloto-${id}`,
    roomId: 'public',          // Sala padrão
    position: {
      x: spawnPosition.x,
      y: spawnPosition.y
    },
    rotation: spawnPosition.rotation,
    velocity: { x: 0, y: 0 },
    inputs: {                  // Controles do jogador
      thrust: false,
      rotateLeft: false,
      rotateRight: false,
      fire: false
    },
    health: GAME_CONFIG.defaultShipStats.maxHealth,
    maxHealth: GAME_CONFIG.defaultShipStats.maxHealth,
    shield: GAME_CONFIG.defaultShipStats.maxShield,
    maxShield: GAME_CONFIG.defaultShipStats.maxShield,
    speed: GAME_CONFIG.defaultShipStats.speed,
    damage: GAME_CONFIG.defaultShipStats.damage,
    radius: GAME_CONFIG.defaultShipStats.radius,
    lastFireTime: 0,
    score: 0,
    kills: 0,
    deaths: 0,
    lastUpdateTime: Date.now(),
    connected: true
  };
}

// Função para criar um inimigo
function createEnemy(type) {
    const id = `enemy_${nextEnemyId++}`;
    const stats = GAME_CONFIG.enemies.stats[type];
    
    // Gerar posição aleatória fora da área de spawn dos jogadores
    const spawnDistanceFromCenter = GAME_CONFIG.spawnRadius * 2;
    const angle = Math.random() * Math.PI * 2;
    
    // Posição no perímetro do mundo
    const x = GAME_CONFIG.worldWidth / 2 + Math.cos(angle) * spawnDistanceFromCenter;
    const y = GAME_CONFIG.worldHeight / 2 + Math.sin(angle) * spawnDistanceFromCenter;
    
    return {
      id,
      type,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      health: stats.health,
      maxHealth: stats.health,
      speed: stats.speed,
      damage: stats.damage,
      radius: stats.radius,
      scoreValue: stats.scoreValue,
      lastFireTime: 0,
      fireRate: stats.fireRate,
      lastUpdateTime: Date.now(),
      target: null, // Jogador alvo
      roomId: 'public', // Sempre na sala pública
      behaviors: {
        followPlayer: type !== 'basic', // Médio e boss seguem jogadores
        circlePlayer: type === 'boss',  // Boss circula o jogador
        shootAtPlayer: true             // Todos atiram
      }
    };
  }

  // Função para gerenciar spawn de inimigos
function manageEnemySpawns() {
    const now = Date.now();
    
    // Processar spawn para cada tipo de inimigo
    ['basic', 'medium', 'boss'].forEach(type => {
      // Verificar se é hora de spawnar
      if (now - enemySpawnTimers[type] >= GAME_CONFIG.enemies.spawnRate[type]) {
        enemySpawnTimers[type] = now;
        
        // Contar inimigos existentes deste tipo
        let typeCount = 0;
        for (const enemy of enemies.values()) {
          if (enemy.type === type) typeCount++;
        }
        
        // Verificar se não excedeu o máximo
        if (typeCount < GAME_CONFIG.enemies.maxCount[type]) {
          const enemy = createEnemy(type);
          enemies.set(enemy.id, enemy);
          
          // Encontrar um alvo aleatório na sala pública
          const publicRoom = rooms.get('public');
          if (publicRoom && publicRoom.players.size > 0) {
            const playerIds = Array.from(publicRoom.players);
            if (playerIds.length > 0) {
              const randomIndex = Math.floor(Math.random() * playerIds.length);
              enemy.target = playerIds[randomIndex];
            }
          }
        }
      }
    });
  }

  // Função para atualizar inimigos
function updateEnemy(enemy, deltaTime) {
    const now = Date.now();
    
    // Verificar se tem um alvo e se ele existe
    let targetPlayer = null;
    if (enemy.target && players.has(enemy.target)) {
      targetPlayer = players.get(enemy.target);
    } else {
      // Encontrar novo alvo se não tiver um válido
      const publicRoom = rooms.get('public');
      if (publicRoom && publicRoom.players.size > 0) {
        const playerIds = Array.from(publicRoom.players);
        if (playerIds.length > 0) {
          const randomIndex = Math.floor(Math.random() * playerIds.length);
          enemy.target = playerIds[randomIndex];
          if (players.has(enemy.target)) {
            targetPlayer = players.get(enemy.target);
          }
        }
      }
    }
    
    // Comportamento com base no alvo
    if (targetPlayer) {
      // Calcular vetor direção para o alvo
      const dx = targetPlayer.position.x - enemy.position.x;
      const dy = targetPlayer.position.y - enemy.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Atualizar rotação para apontar para o jogador
      enemy.rotation = Math.atan2(dy, dx);
      
      // Movimento baseado no tipo de inimigo
      if (enemy.behaviors.followPlayer) {
        // Seguir o jogador diretamente (médio e boss)
        if (distance > enemy.radius * 3) {
          // Normalizar o vetor direção
          const dirX = dx / distance;
          const dirY = dy / distance;
          
          // Aplicar velocidade
          enemy.velocity.x = dirX * enemy.speed;
          enemy.velocity.y = dirY * enemy.speed;
        } else if (enemy.behaviors.circlePlayer) {
          // Para bosses, circular o jogador quando estiver próximo
          const circleSpeed = enemy.speed * 0.5;
          const circleAngle = enemy.rotation + Math.PI / 2; // 90 graus
          
          enemy.velocity.x = Math.cos(circleAngle) * circleSpeed;
          enemy.velocity.y = Math.sin(circleAngle) * circleSpeed;
        } else {
          // Parar quando estiver muito próximo
          enemy.velocity.x *= 0.95;
          enemy.velocity.y *= 0.95;
        }
      } else {
        // Movimento mais simples para inimigos básicos
        // Movimentação mais aleatória com tendência ao jogador
        if (Math.random() < 0.05) {
          // 5% de chance de mudar direção aleatoriamente
          const randomAngle = Math.random() * Math.PI * 2;
          enemy.velocity.x = Math.cos(randomAngle) * enemy.speed * 0.5;
          enemy.velocity.y = Math.sin(randomAngle) * enemy.speed * 0.5;
        } else {
          // Normalizar o vetor direção com componente aleatória
          const randomFactor = 0.3;
          let dirX = dx / distance + (Math.random() * 2 - 1) * randomFactor;
          let dirY = dy / distance + (Math.random() * 2 - 1) * randomFactor;
          
          // Renormalizar
          const newLen = Math.sqrt(dirX * dirX + dirY * dirY);
          dirX = dirX / newLen;
          dirY = dirY / newLen;
          
          // Aplicar velocidade
          enemy.velocity.x = dirX * enemy.speed;
          enemy.velocity.y = dirY * enemy.speed;
        }
      }
      
      // Atirar no jogador se possível
      if (enemy.behaviors.shootAtPlayer && 
          now - enemy.lastFireTime > enemy.fireRate) {
        const projectile = createEnemyProjectile(enemy);
        projectiles.set(projectile.id, projectile);
        enemy.lastFireTime = now;
      }
    } else {
      // Sem alvo, movimento aleatório
      if (Math.random() < 0.02) {
        const randomAngle = Math.random() * Math.PI * 2;
        enemy.velocity.x = Math.cos(randomAngle) * enemy.speed * 0.5;
        enemy.velocity.y = Math.sin(randomAngle) * enemy.speed * 0.5;
      }
    }
    
    // Atualizar posição
    updatePosition(enemy, deltaTime);
    
    // Atualizar timestamp
    enemy.lastUpdateTime = now;
    
    return enemy;
  }
  
  // Criar projétil para inimigos
  function createEnemyProjectile(enemy) {
    const id = `ep${nextProjectileId++}`;
    const angle = enemy.rotation;
    
    // Posição inicial na frente do inimigo
    const offsetX = Math.cos(angle) * enemy.radius;
    const offsetY = Math.sin(angle) * enemy.radius;
    
    return {
      id,
      playerId: enemy.id, // Usar ID do inimigo para identificação
      enemyProjectile: true, // Marcar como projétil de inimigo
      position: {
        x: enemy.position.x + offsetX,
        y: enemy.position.y + offsetY
      },
      velocity: {
        x: Math.cos(angle) * GAME_CONFIG.projectileSpeed,
        y: Math.sin(angle) * GAME_CONFIG.projectileSpeed
      },
      damage: enemy.damage,
      radius: 5,
      createdAt: Date.now(),
      expires: Date.now() + GAME_CONFIG.projectileLifetime
    };
  }
  // Adicionar à função gameLoop para processar colisões com inimigos
function processEnemyCollisions() {
    // Colisões de projéteis com inimigos
    for (const [projId, projectile] of projectiles.entries()) {
      // Ignorar projéteis de inimigos
      if (projectile.enemyProjectile) continue;
      
      for (const [enemyId, enemy] of enemies.entries()) {
        if (checkCollision(projectile, enemy)) {
          // Aplicar dano ao inimigo
          enemy.health -= projectile.damage;
          
          // Verificar se o inimigo foi derrotado
          if (enemy.health <= 0) {
            // Dar pontos ao jogador que atirou
            const shooter = players.get(projectile.playerId);
            if (shooter) {
              shooter.score += enemy.scoreValue;
            }
            
            // Remover o inimigo
            enemies.delete(enemyId);
          }
          
          // Remover o projétil
          projectiles.delete(projId);
          break;
        }
      }
    }
    
    // Colisões de projéteis de inimigos com jogadores
    for (const [projId, projectile] of projectiles.entries()) {
      // Processar apenas projéteis de inimigos
      if (!projectile.enemyProjectile) continue;
      
      for (const [playerId, player] of players.entries()) {
        if (checkCollision(projectile, player)) {
          // Aplicar dano ao jogador
          const killed = applyDamage(player, projectile.damage);
          
          if (killed) {
            // Respawn do jogador
            respawnPlayer(player);
          }
          
          // Remover o projétil
          projectiles.delete(projId);
          break;
        }
      }
    }
    
    // Colisões diretas entre inimigos e jogadores
    for (const [enemyId, enemy] of enemies.entries()) {
      for (const [playerId, player] of players.entries()) {
        if (checkCollision(enemy, player)) {
          // Aplicar dano ao jogador
          const killed = applyDamage(player, enemy.damage * 0.00); // Dano reduzido para colisão direta
          
          if (killed) {
            // Respawn do jogador
            respawnPlayer(player);
          }
          
          // Afastar o inimigo um pouco
          const dx = enemy.position.x - player.position.x;
          const dy = enemy.position.y - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 0) {
            const pushFactor = (enemy.radius + player.radius) / dist;
            enemy.position.x = player.position.x + dx * pushFactor;
            enemy.position.y = player.position.y + dy * pushFactor;
          }
        }
      }
    }
  }

// Criar um novo projétil
function createProjectile(playerId, player) {
  const id = `p${nextProjectileId++}`;
  const angle = player.rotation;
  
  // Posição inicial na frente da nave
  const offsetX = Math.cos(angle) * player.radius;
  const offsetY = Math.sin(angle) * player.radius;
  
  return {
    id,
    playerId,
    position: {
      x: player.position.x + offsetX,
      y: player.position.y + offsetY
    },
    velocity: {
      x: Math.cos(angle) * GAME_CONFIG.projectileSpeed,
      y: Math.sin(angle) * GAME_CONFIG.projectileSpeed
    },
    damage: player.damage,
    radius: 5,
    createdAt: Date.now(),
    expires: Date.now() + GAME_CONFIG.projectileLifetime
  };
}

// Verificar colisão entre dois objetos circulares
function checkCollision(obj1, obj2) {
  const dx = obj1.position.x - obj2.position.x;
  const dy = obj1.position.y - obj2.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance < (obj1.radius + obj2.radius);
}

// Processar dano em um jogador
function applyDamage(player, damage) {
  // Primeiro absorver com escudo
  if (player.shield > 0) {
    if (player.shield >= damage) {
      player.shield -= damage;
      damage = 0;
    } else {
      damage -= player.shield;
      player.shield = 0;
    }
  }
  
  // Dano restante vai para vida
  if (damage > 0) {
    player.health -= damage;
  }
  
  return player.health <= 0;
}

// Respawn de jogador
function respawnPlayer(player) {
  const spawnPosition = getRandomSpawnPosition();
  
  player.position.x = spawnPosition.x;
  player.position.y = spawnPosition.y;
  player.rotation = spawnPosition.rotation;
  player.velocity = { x: 0, y: 0 };
  player.health = player.maxHealth;
  player.shield = player.maxShield;
  player.deaths++;
  
  return player;
}

// Atualizar posição baseada em velocidade
function updatePosition(obj, deltaTime) {
  obj.position.x += obj.velocity.x * (deltaTime / 1000);
  obj.position.y += obj.velocity.y * (deltaTime / 1000);
  
  // Manter dentro dos limites do mundo
  obj.position.x = Math.max(0, Math.min(GAME_CONFIG.worldWidth, obj.position.x));
  obj.position.y = Math.max(0, Math.min(GAME_CONFIG.worldHeight, obj.position.y));
  
  return obj;
}

// Atualizar um jogador
function updatePlayer(player, deltaTime) {
  // Processar inputs
  if (player.inputs.thrust) {
    const thrustX = Math.cos(player.rotation) * player.speed;
    const thrustY = Math.sin(player.rotation) * player.speed;
    
    // Aplicar aceleração gradualmente
    player.velocity.x += thrustX * (deltaTime / 1000) * 2;
    player.velocity.y += thrustY * (deltaTime / 1000) * 2;
    
    // Limitar velocidade máxima
    const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
    if (speed > player.speed) {
      player.velocity.x = (player.velocity.x / speed) * player.speed;
      player.velocity.y = (player.velocity.y / speed) * player.speed;
    }
  } else {
    // Desaceleração quando não está acelerando
    player.velocity.x *= 0.98;
    player.velocity.y *= 0.98;
    
    // Parar completamente se for muito lento
    if (Math.abs(player.velocity.x) < 0.1) player.velocity.x = 0;
    if (Math.abs(player.velocity.y) < 0.1) player.velocity.y = 0;
  }
  
  // Rotação
  if (player.inputs.rotateLeft) {
    player.rotation -= GAME_CONFIG.defaultShipStats.rotationSpeed * (deltaTime / 1000);
  }
  if (player.inputs.rotateRight) {
    player.rotation += GAME_CONFIG.defaultShipStats.rotationSpeed * (deltaTime / 1000);
  }
  
  // Normalizar rotação
  player.rotation = player.rotation % (Math.PI * 2);
  if (player.rotation < 0) player.rotation += Math.PI * 2;
  
  // Disparar
  if (player.inputs.fire && 
      Date.now() - player.lastFireTime > GAME_CONFIG.weaponCooldown) {
    
    // Verificar limite de projéteis
    let playerProjectileCount = 0;
    for (const projectile of projectiles.values()) {
      if (projectile.playerId === player.id) {
        playerProjectileCount++;
      }
    }
    
    if (playerProjectileCount < GAME_CONFIG.maxProjectiles) {
      const projectile = createProjectile(player.id, player);
      projectiles.set(projectile.id, projectile);
      player.lastFireTime = Date.now();
    }
  }
  
  // Regenerar escudo
  if (player.shield < player.maxShield) {
    player.shield += GAME_CONFIG.defaultShipStats.shieldRegen * (deltaTime / 1000);
    if (player.shield > player.maxShield) {
      player.shield = player.maxShield;
    }
  }
  
  // Atualizar posição
  updatePosition(player, deltaTime);
  
  // Atualizar timestamp
  player.lastUpdateTime = Date.now();
  
  return player;
}

// Serializador de estado do jogo para um jogador específico
function serializeGameState(playerId) {
    const player = players.get(playerId);
    if (!player) return null;
    
    const playerRoom = player.roomId;
    const visiblePlayers = [];
    const visibleProjectiles = [];
    const visibleEnemies = [];
    
    // Jogadores na mesma sala
    for (const otherPlayer of players.values()) {
      if (otherPlayer.roomId === playerRoom) {
        visiblePlayers.push({
          id: otherPlayer.id,
          name: otherPlayer.name,
          position: otherPlayer.position,
          rotation: otherPlayer.rotation,
          health: otherPlayer.health,
          maxHealth: otherPlayer.maxHealth,
          shield: otherPlayer.shield,
          maxShield: otherPlayer.maxShield,
          radius: otherPlayer.radius,
          score: otherPlayer.score,
          isCurrentPlayer: otherPlayer.id === playerId
        });
      }
    }
    
    // Projéteis na mesma sala
    for (const projectile of projectiles.values()) {
      // Para projéteis de jogadores
      if (!projectile.enemyProjectile) {
        const projectileOwner = players.get(projectile.playerId);
        if (projectileOwner && projectileOwner.roomId === playerRoom) {
          visibleProjectiles.push({
            id: projectile.id,
            position: projectile.position,
            playerId: projectile.playerId,
            isEnemyProjectile: false
          });
        }
      } 
      // Para projéteis de inimigos
      else if (projectile.enemyProjectile) {
        visibleProjectiles.push({
          id: projectile.id,
          position: projectile.position,
          playerId: projectile.playerId,
          isEnemyProjectile: true
        });
      }
    }
    
    // Inimigos na mesma sala
    for (const enemy of enemies.values()) {
      if (enemy.roomId === playerRoom) {
        visibleEnemies.push({
          id: enemy.id,
          type: enemy.type,
          position: enemy.position,
          rotation: enemy.rotation,
          health: enemy.health,
          maxHealth: enemy.maxHealth,
          radius: enemy.radius
        });
      }
    }
    
    return {
      self: {
        id: player.id,
        health: player.health,
        maxHealth: player.maxHealth,
        shield: player.shield,
        maxShield: player.maxShield,
        position: player.position,
        rotation: player.rotation,
        velocity: player.velocity,
        score: player.score,
        kills: player.kills,
        deaths: player.deaths
      },
      players: visiblePlayers,
      projectiles: visibleProjectiles,
      enemies: visibleEnemies,
      worldSize: {
        width: GAME_CONFIG.worldWidth,
        height: GAME_CONFIG.worldHeight
      },
      timestamp: Date.now()
    };
  }




/**
 * Loop principal de atualização do jogo
 * Processa inimigos, projéteis, colisões e estados dos jogadores
 */
function gameLoop() {
    const now = Date.now();
    
    // Gerenciar spawn de inimigos
    manageEnemySpawns();
    
    // ===== ATUALIZAÇÃO DE PROJÉTEIS =====
    for (const [id, projectile] of projectiles.entries()) {
      // Remover projéteis expirados
      if (now > projectile.expires) {
        projectiles.delete(id);
        continue;
      }
      
      // Atualizar posição
      const deltaTime = now - projectile.lastUpdateTime || 16;
      updatePosition(projectile, deltaTime);
      projectile.lastUpdateTime = now;
      
      // Para projéteis de jogadores (não de inimigos), checar colisões com jogadores
      if (!projectile.enemyProjectile) {
        // Checar se o atirador ainda existe e está ativo
        const shooter = players.get(projectile.playerId);
        if (!shooter || !shooter.connected) {
          // Atirador não existe ou foi desconectado, remover o projétil
          projectiles.delete(id);
          continue;
        }
        
        // Checar colisões com outros jogadores na mesma sala
        for (const [playerId, player] of players.entries()) {
          // Não colidir com o próprio atirador
          if (playerId === projectile.playerId) continue;
          
          // Verificar se estão na mesma sala
          if (player.roomId !== shooter.roomId) continue;
          
          // Verificar colisão
          if (checkCollision(projectile, player)) {
            // Aplicar dano
            const killed = applyDamage(player, projectile.damage);
            
            if (killed) {
              // Incrementar score do atirador
              shooter.score += 10;
              shooter.kills++;
              
              // Respawn do jogador abatido
              respawnPlayer(player);
              
              // Notificar o jogador abatido sobre quem o matou
              try {
                if (player.connected && player.ws && typeof player.ws.getBufferedAmount === 'function') {
                  player.ws.send(JSON.stringify({
                    type: 'playerKilled',
                    killerName: shooter.name,
                    killerId: shooter.id
                  }));
                }
              } catch (error) {
                console.warn(`Erro ao notificar jogador #${playerId} sobre sua morte: ${error.message}`);
                player.connected = false;
              }
            }
            
            // Remover projétil após o impacto
            projectiles.delete(id);
            break;
          }
        }
      }
    }
    
    // ===== ATUALIZAÇÃO DE INIMIGOS =====
    for (const [id, enemy] of enemies.entries()) {
      const deltaTime = now - enemy.lastUpdateTime || 16;
      updateEnemy(enemy, deltaTime);
    }
    
    // Processar colisões entre projéteis e inimigos, e entre inimigos e jogadores
    processEnemyCollisions();
    
    // ===== ATUALIZAÇÃO DE JOGADORES =====
    for (const [id, player] of players.entries()) {
      // Tratar jogadores desconectados
      if (!player.connected) {
        // Remover jogadores desconectados depois de um tempo
        const disconnectTime = now - player.lastUpdateTime;
        if (disconnectTime > 5000) {
          console.log(`Removendo jogador #${id} após ${Math.floor(disconnectTime/1000)}s de desconexão`);
          
          // Remover da sala
          const room = rooms.get(player.roomId);
          if (room) {
            room.players.delete(id);
          }
          
          // Remover do mapa de jogadores
          players.delete(id);
        }
        continue;
      }
      
      // Atualizar jogadores conectados
      const deltaTime = now - player.lastUpdateTime;
      updatePlayer(player, deltaTime);
    }
    
    // ===== ENVIO DE ATUALIZAÇÕES PARA JOGADORES =====
    for (const [id, player] of players.entries()) {
      if (!player.connected) continue;
      
      const ws = player.ws;
      // Verificação robusta do estado do WebSocket
      if (ws && typeof ws.getBufferedAmount === 'function') {
        try {
          // Verificar buffer para evitar sobrecarga
          if (ws.getBufferedAmount() < 16384) {
            const gameState = serializeGameState(id);
            ws.send(JSON.stringify({
              type: 'gameState',
              data: gameState
            }));
          } else {
            console.warn(`Buffer alto para jogador #${id}: ${ws.getBufferedAmount()} bytes`);
          }
        } catch (error) {
          console.warn(`Erro ao enviar estado para jogador #${id}: ${error.message}`);
          player.connected = false;
        }
      } else {
        // WebSocket inválido ou fechado
        console.warn(`WebSocket inválido para jogador #${id}, marcando como desconectado`);
        player.connected = false;
      }
    }
    
    // ===== ESTATÍSTICAS DE DESEMPENHO =====
    // Calcular a cada 60 ciclos (aproximadamente a cada segundo em 60 ticks)
    if ((now % 60) === 0) {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const activeEntities = players.size + projectiles.size + enemies.size;
      
      // Log detalhado a cada minuto
      if ((now % 60000) < 1000) {
        console.log(`Estado: ${players.size} jogadores, ${projectiles.size} projéteis, ${enemies.size} inimigos, ${heapUsedMB}MB heap`);
        
        // Verificar se há vazamentos potenciais
        if (projectiles.size > 1000) {
          console.warn(`Alerta: Número alto de projéteis (${projectiles.size}), possível acúmulo não tratado`);
        }
      }
    }
  }

// Configurar rota de WebSocket
app.ws('/game', {
  idleTimeout: 120,
  maxPayloadLength: 16 * 1024,
  maxBackpressure: 1024 * 1024,
  compression: uWS.SHARED_COMPRESSOR,
  
  // Conexão de novo jogador
 // Conexão de novo jogador
open: (ws) => {
    const playerId = nextPlayerId++;
    
    // Criar jogador
    const player = createPlayer(playerId);
    player.ws = ws;
    
    // Adicionar ao mapa de jogadores
    players.set(playerId, player);
    
    // Adicionar à sala pública
    const publicRoom = rooms.get('public');
    publicRoom.players.add(playerId);
    
    // Definir propriedade no socket para identificar o jogador
    ws.playerData = { id: playerId };
    
    console.log(`Jogador #${playerId} conectado`);
    
    // Enviar mensagem de boas-vindas com ID do jogador
    if (ws && ws.getBufferedAmount !== undefined) { // Verificar se o WebSocket ainda está válido
      ws.send(JSON.stringify({
        type: 'welcome',
        id: playerId,
        ship: player,
        config: {
          worldWidth: GAME_CONFIG.worldWidth,
          worldHeight: GAME_CONFIG.worldHeight,
          weaponCooldown: GAME_CONFIG.weaponCooldown
        }
      }));
    }
    
    // Notificar outros jogadores na sala - AQUI ESTÁ O PROBLEMA
    for (const otherId of publicRoom.players) {
      if (otherId !== playerId) {
        const otherPlayer = players.get(otherId);
        
        // Verificar se o WebSocket do outro jogador está aberto e válido
        if (otherPlayer && otherPlayer.connected && otherPlayer.ws && 
            typeof otherPlayer.ws.getBufferedAmount === 'function') {
          try {
            otherPlayer.ws.send(JSON.stringify({
              type: 'playerJoined',
              player: {
                id: player.id,
                name: player.name,
                position: player.position,
                rotation: player.rotation
              }
            }));
          } catch (error) {
            console.warn(`Falha ao notificar jogador #${otherId} sobre a entrada do jogador #${playerId}: ${error.message}`);
            // Marcar jogador como desconectado se não conseguir enviar mensagem
            otherPlayer.connected = false;
          }
        }
      }
    }
  },
  
  // Receber mensagem de um jogador
  message: (ws, message, isBinary) => {
    // Obter ID do jogador
    const playerId = ws.playerData?.id;
    if (!playerId || !players.has(playerId)) return;
    
    const player = players.get(playerId);
    
    try {
      if (!isBinary) {
        const messageText = Buffer.from(message).toString();
        const data = JSON.parse(messageText);
        
        // Processar diferentes tipos de mensagens
        switch (data.type) {
          case 'input':
            // Atualizar inputs do jogador
            player.inputs = {
              ...player.inputs,
              ...data.inputs
            };
            break;
            
          case 'changeName':
            if (data.name && typeof data.name === 'string' && data.name.length <= 20) {
              const oldName = player.name;
              player.name = data.name;
              
              // Notificar outros jogadores da mudança de nome
              const room = rooms.get(player.roomId);
              for (const otherId of room.players) {
                if (otherId !== playerId) {
                  const otherPlayer = players.get(otherId);
                  if (otherPlayer && otherPlayer.ws) {
                    otherPlayer.ws.send(JSON.stringify({
                      type: 'playerRenamed',
                      playerId,
                      oldName,
                      newName: player.name
                    }));
                  }
                }
              }
            }
            break;
            
          case 'ping':
            // Responder pings para medir latência
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: data.timestamp
            }));
            break;
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  },
  
  // Desconexão de jogador
  close: (ws, code, message) => {
    const playerId = ws.playerData?.id;
    if (!playerId) return;
    
    console.log(`Jogador #${playerId} desconectado, código: ${code}`);
    
    const player = players.get(playerId);
    if (player) {
      // Marcar como desconectado para remoção posterior
      player.connected = false;
      
      // Notificar outros jogadores
      const room = rooms.get(player.roomId);
      if (room) {
        for (const otherId of room.players) {
          if (otherId !== playerId) {
            const otherPlayer = players.get(otherId);
            if (otherPlayer && otherPlayer.connected && otherPlayer.ws) {
              otherPlayer.ws.send(JSON.stringify({
                type: 'playerLeft',
                playerId
              }));
            }
          }
        }
      }
    }
  }
});

  // Continuação da rota para informações sobre o servidor
  app.get('/status', (res, req) => {
    res.writeStatus('200 OK');
    res.writeHeader('Content-Type', 'application/json');
    
    const serverStatus = {
      players: players.size,
      projectiles: projectiles.size,
      rooms: [...rooms.values()].map(room => ({
        id: room.id,
        name: room.name,
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers
      })),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      config: {
        tickRate: GAME_CONFIG.tickRate,
        worldSize: {
          width: GAME_CONFIG.worldWidth,
          height: GAME_CONFIG.worldHeight
        }
      }
    };
    
    res.end(JSON.stringify(serverStatus));
  });

  // API para criar uma nova sala
  app.post('/api/rooms', (res, req) => {
    // Ler o corpo da requisição
    readJson(res, (body) => {
      if (!body || !body.name) {
        res.writeStatus('400 Bad Request');
        res.end(JSON.stringify({ error: 'Nome da sala é obrigatório' }));
        return;
      }
      
      const roomId = `room_${Date.now()}`;
      const newRoom = {
        id: roomId,
        name: body.name,
        players: new Set(),
        maxPlayers: body.maxPlayers || 10,
        createdAt: Date.now(),
        password: body.password || null,
        private: !!body.private
      };
      
      rooms.set(roomId, newRoom);
      
      res.writeStatus('201 Created');
      res.writeHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        id: newRoom.id,
        name: newRoom.name,
        maxPlayers: newRoom.maxPlayers,
        private: newRoom.private,
        hasPassword: !!newRoom.password
      }));
    }, () => {
      res.writeStatus('400 Bad Request');
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    });
  });

  // Função auxiliar para ler JSON de requisições
  function readJson(res, cb, err) {
    let buffer;
    
    res.onData((chunk, isLast) => {
      const curBuffer = buffer;
      const newBuffer = isLast ? chunk : Buffer.concat([curBuffer, chunk]);
      
      if (isLast) {
        try {
          cb(JSON.parse(Buffer.from(newBuffer).toString()));
        } catch (e) {
          if (err) err();
        }
      } else {
        buffer = newBuffer;
      }
    });
    
    res.onAborted(err || (() => {}));
  }

  // Iniciar o servidor na porta 5588
  app.listen(5588, (listenSocket) => {
    if (listenSocket) {
      console.log('✅ Servidor de jogo rodando em ws://localhost:5588/game');
      console.log('   Status em http://localhost:5588/status');
      
      // Iniciar o loop do jogo
      const tickInterval = 1000 / GAME_CONFIG.tickRate;
      setInterval(gameLoop, tickInterval);
    } else {
      console.error('❌ Falha ao iniciar servidor na porta 5588');
      process.exit(1);
    }
  });

  // Lidar com encerramento do processo
  process.on('SIGINT', () => {
    console.log('\nServidor sendo encerrado graciosamente...');
    
    // Notificar todos os jogadores
    for (const player of players.values()) {
      if (player.connected && player.ws) {
        player.ws.send(JSON.stringify({
          type: 'serverShutdown',
          message: 'Servidor está sendo desligado'
        }));
      }
    }
    
    // Aguardar um pouco para as mensagens serem enviadas
    setTimeout(() => {
      process.exit(0);
    }, 500);
  });

  // Registro de estatísticas periódicas
  setInterval(() => {
    console.log(`Estatísticas: ${players.size} jogadores, ${projectiles.size} projéteis, ${rooms.size} salas`);
  }, 60000); // A cada minuto

  console.log('Servidor de jogo de naves multiplayer configurado e pronto!');