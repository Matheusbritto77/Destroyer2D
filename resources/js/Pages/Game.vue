<template>
  <div class="relative w-full h-screen bg-black text-white overflow-hidden">
    <!-- Canvas do jogo -->
    <canvas ref="gameCanvas" class="w-full h-full"></canvas>

    <!-- HUD otimizada para desktop e mobile -->
    <div class="absolute top-0 left-0 w-full z-10 p-3 flex flex-col items-center backdrop-blur-sm bg-black/50 text-sm sm:text-base">
      <!-- Título - Menor em dispositivos móveis -->
      <h1 class="text-lg sm:text-3xl font-bold text-white mb-1 sm:mb-2 flex items-center gap-2">
        <i class="fas fa-rocket text-yellow-400"></i> Space Multiplayer
      </h1>

      <!-- Status HUD - Compacta em dispositivos móveis -->
      <div class="flex justify-center items-center gap-2 sm:gap-4 flex-wrap text-white">
        <div class="flex items-center gap-1">
          <i class="fas fa-trophy text-yellow-300"></i>
          {{ playerScore }}
        </div>
        <div class="flex items-center gap-1">
          <i class="fas fa-users text-blue-300"></i>
          {{ playerCount }}
        </div>
        <div class="flex items-center gap-1">
          <i class="fas fa-shield-alt text-green-400"></i>
          {{ Math.floor(shield) }}%
        </div>
        <div class="flex items-center gap-1">
          <i class="fas fa-heart text-red-400"></i>
          {{ Math.floor(health) }}%
        </div>
        <div v-if="ping !== null" class="flex items-center gap-1 hidden sm:flex">
          <i class="fas fa-wifi text-blue-400"></i>
          {{ ping }}ms
        </div>
      </div>
    </div>

    <!-- Controles para dispositivos móveis -->
    <div v-if="isMobile" class="mobile-controls">
      <!-- Área do joystick virtual (lado esquerdo) -->
      <div 
        ref="joystickArea" 
        class="joystick-area"
        @touchstart="handleJoystickStart"
        @touchmove="handleJoystickMove"
        @touchend="handleJoystickEnd"
      >
        <div class="joystick-base">
          <div 
            ref="joystickHandle" 
            class="joystick-handle" 
            :style="{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`
            }"
          ></div>
        </div>
      </div>

      <!-- Botão de disparo (lado direito) -->
      <div 
        class="fire-button"
        @touchstart="handleFireStart"
        @touchend="handleFireEnd"
      >
        <i class="fas fa-crosshairs"></i>
      </div>
      
      <!-- Indicador de direção da nave -->
      <div class="direction-indicator">
        <div class="ship-orientation" :style="{ transform: `rotate(${shipRotation}deg)` }">
          <i class="fas fa-angle-up"></i>
        </div>
      </div>
    </div>

    <!-- Mensagem de conexão -->
    <div v-if="connectionStatus !== 'connected'" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
      <div class="bg-gray-800 p-6 rounded-lg text-center">
        <h2 class="text-xl mb-4">{{ connectionStatusMessage }}</h2>
        <button v-if="connectionStatus === 'error'" @click="connect" class="bg-blue-500 px-4 py-2 rounded">
          Tentar Novamente
        </button>
      </div>
    </div>
    
    <!-- Indicador de orientação do dispositivo para mobile -->
    <div v-if="isMobile && isLandscapeNeeded && !isLandscape" class="orientation-warning">
      <div class="content">
        <i class="fas fa-mobile-alt rotate-icon"></i>
        <p>Para uma melhor experiência, gire o dispositivo para modo paisagem</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css');

body {
  margin: 0;
  overflow: hidden;
  font-family: Arial, sans-serif;
  touch-action: none; /* Previne gestos padrão do navegador */
}

/* Estilos para controles mobile */
.mobile-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 40%;
  pointer-events: none;
  z-index: 10;
}

.joystick-area {
  position: absolute;
  bottom: 40px;
  left: 40px;
  width: 120px;
  height: 120px;
  pointer-events: auto;
}

.joystick-base {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
}

.joystick-handle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 10px rgba(0, 128, 255, 0.7);
}

.fire-button {
  position: absolute;
  bottom: 40px;
  right: 40px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: rgba(255, 50, 50, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 30px;
  pointer-events: auto;
  transition: transform 0.1s, background-color 0.1s;
}

.fire-button:active {
  transform: scale(0.9);
  background-color: rgba(255, 0, 0, 0.9);
}

.direction-indicator {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
}

.ship-orientation {
  font-size: 24px;
  color: #fff;
  transition: transform 0.2s ease-out;
}

/* Aviso de orientação */
.orientation-warning {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.orientation-warning .content {
  text-align: center;
  padding: 20px;
}

.orientation-warning .rotate-icon {
  font-size: 60px;
  color: white;
  display: block;
  margin-bottom: 20px;
  animation: rotate 2s infinite;
}

@keyframes rotate {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(0deg); }
  75% { transform: rotate(90deg); }
  100% { transform: rotate(90deg); }
}

/* Ajustes responsivos */
@media (max-height: 500px) {
  .joystick-area {
    bottom: 20px;
    left: 20px;
    width: 100px;
    height: 100px;
  }
  
  .fire-button {
    bottom: 20px;
    right: 20px;
    width: 70px;
    height: 70px;
  }
}
</style>

<script>
export default {
  name: 'SpaceGame',
  data() {
    return {
      // Conexão WebSocket e estado do jogo (código existente)
      socket: null,
      connectionStatus: 'connecting',
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      playerId: null,
      playerName: 'Piloto',
      playerScore: 0,
      playerCount: 0,
      health: 100,
      shield: 50,
      ping: null,
      lastPingSent: 0,
      
      // Canvas e renderização (código existente)
      canvas: null,
      ctx: null,
      shipImage: null,
      bulletImage: null,
      players: [],
      projectiles: [],
      enemies: [],
      worldSize: { width: 5000, height: 5000 },
      viewport: { x: 0, y: 0, width: 0, height: 0 },
      
      // Controles (modificados para suportar touch)
      keys: {},
      inputs: {
        thrust: false,
        rotateLeft: false,
        rotateRight: false,
        fire: false
      },
      
      // Detecção de tipo de dispositivo
      isMobile: false,
      isLandscape: true,
      isLandscapeNeeded: true,
      
      // Joystick virtual
      joystickActive: false,
      joystickBasePosition: { x: 0, y: 0 },
      joystickPos: { x: 0, y: 0 },
      joystickMaxDistance: 40,
      
      // Rotação da nave para feedback visual
      shipRotation: 0,
      
      // Animação (código existente)
      lastFrameTime: 0,
      fps: 0,
      framesThisSecond: 0,
      lastFpsUpdate: 0,
      
      // Timer de ping (código existente)
      pingInterval: null
    };
  },
  
  computed: {
    // Computados existentes...
    connectionStatusMessage() {
      switch(this.connectionStatus) {
        case 'connecting': return 'Conectando ao servidor...';
        case 'error': return 'Erro de conexão!';
        case 'disconnected': return 'Desconectado do servidor.';
        default: return '';
      }
    },
    
    currentPlayer() {
      return this.players.find(p => p.id === this.playerId) || null;
    }
  },
  
  mounted() {
    // Detectar tipo de dispositivo
    this.detectDevice();
    
    // Adicionar listener para mudanças de orientação
    window.addEventListener('resize', this.checkOrientation);
    this.checkOrientation();
    
    // Inicialização do canvas (código existente)
    this.canvas = this.$refs.gameCanvas;
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);
    
    // Carregar imagens (código existente)
    this.loadImages();
    
    // Configurar controles - apenas para desktop
    if (!this.isMobile) {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    }
    
    // Iniciar conexão com o servidor (código existente)
    this.connect();
    
    // Iniciar timer de ping (código existente)
    this.pingInterval = setInterval(this.sendPing, 2000);
  },
  
  beforeDestroy() {
    // Limpar event listeners
    window.removeEventListener('resize', this.resizeCanvas);
    window.removeEventListener('resize', this.checkOrientation);
    
    if (!this.isMobile) {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
    }
    
    // Fechar WebSocket (código existente)
    if (this.socket) {
      this.socket.close();
    }
    
    // Limpar timers (código existente)
    clearInterval(this.pingInterval);
  },
  
  methods: {
    // Métodos de detecção de dispositivo e orientação
    detectDevice() {
      const userAgent = navigator.userAgent.toLowerCase();
      this.isMobile = /android|webos|iphone|ipad|ipod|blackberry|windows phone/.test(userAgent);
    },
    
    checkOrientation() {
      this.isLandscape = window.innerWidth > window.innerHeight;
    },
    
    // Métodos para controles de touch
    handleJoystickStart(event) {
      event.preventDefault();
      const touch = event.touches[0];
      const rect = this.$refs.joystickArea.getBoundingClientRect();
      
      this.joystickActive = true;
      this.joystickBasePosition = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      
      // Inicializar posição do joystick no centro
      this.joystickPos = { x: 0, y: 0 };
      this.updateJoystickPosition(touch.clientX, touch.clientY);
    },
    
    handleJoystickMove(event) {
      if (!this.joystickActive) return;
      event.preventDefault();
      const touch = event.touches[0];
      this.updateJoystickPosition(touch.clientX, touch.clientY);
    },
    
    handleJoystickEnd(event) {
      event.preventDefault();
      this.joystickActive = false;
      this.joystickPos = { x: 0, y: 0 };
      
      // Resetar inputs quando o joystick é solto
      this.inputs.thrust = false;
      this.inputs.rotateLeft = false;
      this.inputs.rotateRight = false;
      this.sendInputs();
    },
    
    updateJoystickPosition(clientX, clientY) {
      // Calcular distância do centro
      const dx = clientX - this.joystickBasePosition.x;
      const dy = clientY - this.joystickBasePosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Limitar a distância máxima
      if (distance > this.joystickMaxDistance) {
        const angle = Math.atan2(dy, dx);
        this.joystickPos = {
          x: Math.cos(angle) * this.joystickMaxDistance,
          y: Math.sin(angle) * this.joystickMaxDistance
        };
      } else {
        this.joystickPos = { x: dx, y: dy };
      }
      
      // Converter posição do joystick em inputs
      const angle = Math.atan2(this.joystickPos.y, this.joystickPos.x);
      const normalizedAngle = ((angle * 180 / Math.PI) + 360) % 360;
      
      // Atualizar rotação da nave (visual)
      this.shipRotation = normalizedAngle;
      
      // Definir inputs baseados na posição do joystick
      this.inputs.thrust = distance > 10; // Acelerar se o joystick for movido o suficiente
      
      // Usar ângulo para determinar rotação
      const deadzone = 5; // Pequena zona morta para evitar rotações indesejadas
      if (distance > deadzone) {
        // Apontar nave na direção do joystick
        if (this.currentPlayer) {
          const targetAngle = angle;
          const currentAngle = this.currentPlayer.rotation;
          
          // Calcular a diferença angular mais curta
          let angleDiff = targetAngle - currentAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          
          // Rotacionar baseado na diferença
          this.inputs.rotateLeft = angleDiff < -0.05;
          this.inputs.rotateRight = angleDiff > 0.05;
        }
      } else {
        this.inputs.rotateLeft = false;
        this.inputs.rotateRight = false;
      }
      
      this.sendInputs();
    },
    
    handleFireStart(event) {
      event.preventDefault();
      this.inputs.fire = true;
      this.sendInputs();
    },
    
    handleFireEnd(event) {
      event.preventDefault();
      this.inputs.fire = false;
      this.sendInputs();
    },
    
    // Métodos existentes...
    connect() {
      this.connectionStatus = 'connecting';
      
      // Criar conexão
      this.socket = new WebSocket('ws://localhost:5588/game');
      
      // Configurar handlers
      this.socket.onopen = this.handleSocketOpen;
      this.socket.onmessage = this.handleSocketMessage;
      this.socket.onclose = this.handleSocketClose;
      this.socket.onerror = this.handleSocketError;
    },
    
    handleSocketOpen() {
      console.log('Conectado ao servidor WebSocket');
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      
      // Iniciar o loop de renderização
      requestAnimationFrame(this.gameLoop);
    },
    
    handleSocketMessage(event) {
      try {
        const message = JSON.parse(event.data);
        console.log("Mensagem recebida:", message.type);
        
        switch(message.type) {
          case 'welcome':
            // Configuração inicial
            this.playerId = message.id;
            this.playerName = message.ship.name;
            this.worldSize = {
              width: message.config.worldWidth,
              height: message.config.worldHeight
            };
            break;
            
          case 'gameState':
            // Atualização do estado do jogo
            this.updateGameState(message.data);
            break;
            
          case 'pong':
            // Cálculo de ping
            if (message.timestamp) {
              this.ping = Date.now() - message.timestamp;
            }
            break;
            
          case 'playerJoined':
          case 'playerLeft':
          case 'playerKilled':
            // Outros eventos do jogo...
            break;
        }
      } catch (error) {
        console.error('Erro ao processar mensagem:', error, event.data);
      }
    },
    
    handleSocketClose(event) {
      console.log(`WebSocket fechado: ${event.code}`);
      this.connectionStatus = 'disconnected';
      
      // Tentar reconectar automaticamente
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts})`);
        setTimeout(this.connect, delay);
      }
    },
    
    handleSocketError() {
      console.error('Erro no WebSocket');
      this.connectionStatus = 'error';
    },
    
    // Resto dos métodos existentes preservados...
    // ...
    
    // Apenas adaptações nos métodos de input quando necessário
    handleKeyDown(e) {
      this.keys[e.code] = true;
      
      // Evitar scroll da página com teclas de seta
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    },
    
    handleKeyUp(e) {
      this.keys[e.code] = false;
    },
    
    // Processamento de entrada combinado para desktop e mobile
    processInputs() {
      if (this.isMobile) {
        // No mobile, os inputs já são processados pelos handlers de touch
        return;
      }
      
      // Para desktop, processar inputs baseados nas teclas
      const newInputs = {
        thrust: this.keys['ArrowUp'] || this.keys['KeyW'] || false,
        rotateLeft: this.keys['ArrowLeft'] || this.keys['KeyA'] || false,
        rotateRight: this.keys['ArrowRight'] || this.keys['KeyD'] || false,
        fire: this.keys['Space'] || this.keys['KeyF'] || false
      };
      
      // Enviar apenas se houver mudança
      if (JSON.stringify(newInputs) !== JSON.stringify(this.inputs)) {
        this.inputs = newInputs;
        this.sendInputs();
      }
    },
    
    sendInputs() {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'input',
          inputs: this.inputs
        }));
      }
    },
    
    updateGameState(data) {
      if (!data) {
        console.warn("Dados do estado do jogo vazios");
        return;
      }
      
      // Atualizar informações do jogador
      if (data.self) {
        this.health = (data.self.health / data.self.maxHealth) * 100;
        this.shield = (data.self.shield / data.self.maxShield) * 100;
        this.playerScore = data.self.score || 0;
        
        // Atualizar ângulo visual da nave para mobile, se necessário
        if (!this.joystickActive && this.isMobile && this.currentPlayer) {
          const rotationDegrees = (data.self.rotation * 180 / Math.PI) % 360;
          this.shipRotation = rotationDegrees;
        }
      }
      
      // Atualizar listas de entidades
      if (Array.isArray(data.players)) {
        this.players = data.players;
        this.playerCount = this.players.length;
      }
      
      if (Array.isArray(data.projectiles)) {
        this.projectiles = data.projectiles;
      }
      
      if (Array.isArray(data.enemies)) {
        this.enemies = data.enemies;
      }
      
      // Atualizar tamanho do mundo
      if (data.worldSize) {
        this.worldSize = data.worldSize;
      }
    },
    
    // Loop de renderização do jogo
    gameLoop(timestamp) {
      // Calcular FPS
      if (!this.lastFrameTime) {
        this.lastFrameTime = timestamp;
      }
      
      const elapsed = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;
      
      // Contar frames para cálculo de FPS
      this.framesThisSecond++;
      if (timestamp - this.lastFpsUpdate >= 1000) {
        this.fps = this.framesThisSecond;
        this.framesThisSecond = 0;
        this.lastFpsUpdate = timestamp;
      }
      
      // Processar inputs para desktop (mobile é tratado por eventos touch)
      if (!this.isMobile) {
        this.processInputs();
      }
      
      // Renderizar o jogo
      this.render();
      
      // Continuar o loop
      requestAnimationFrame(this.gameLoop);
    },
    
    render() {
      if (!this.ctx) {
        console.warn("Contexto de canvas não disponível");
        return;
      }
      
      const { ctx, canvas } = this;
      
      // Limpar canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Calcular viewport
      let viewportX = 0;
      let viewportY = 0;
      
      if (this.currentPlayer) {
        viewportX = this.currentPlayer.position.x - canvas.width / 2;
        viewportY = this.currentPlayer.position.y - canvas.height / 2;
      } else {
        viewportX = this.worldSize.width / 2 - canvas.width / 2;
        viewportY = this.worldSize.height / 2 - canvas.height / 2;
      }
      
      this.viewport = { x: viewportX, y: viewportY, width: canvas.width, height: canvas.height };
      
      // Renderizar componentes do jogo
      this.drawGrid();
      this.drawWorldBorder();
      this.drawProjectiles();
      
      // Desenhar inimigos se existirem
      if (this.enemies && this.enemies.length > 0) {
        this.drawEnemies();
      }
      
      this.drawPlayers();
      
      // Em dispositivos móveis, mostrar indicador de aceleração se estiver acelerando
      if (this.isMobile && this.inputs.thrust) {
        this.drawThrustIndicator();
      }
      
      // Desenhar minimapa
      this.drawMinimap();
    },
    
    // Método para mostrar visual de aceleração em dispositivos móveis
    drawThrustIndicator() {
      if (!this.currentPlayer) return;
      
      const { ctx, viewport } = this;
      const x = this.currentPlayer.position.x - viewport.x;
      const y = this.currentPlayer.position.y - viewport.y;
      
      // Desenhar efeito de propulsão atrás da nave
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.currentPlayer.rotation);
      
      // Efeito fogo com opacidade variável
      const thrustLength = 20 + Math.random() * 10;
      const gradient = ctx.createLinearGradient(
        -thrustLength, 0,
        -this.currentPlayer.radius, 0
      );
      
      gradient.addColorStop(0, 'rgba(255, 50, 0, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 150, 0, 0.7)');
      gradient.addColorStop(1, 'rgba(255, 230, 0, 0.9)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-this.currentPlayer.radius, 0);
      ctx.lineTo(-thrustLength, -8);
      ctx.lineTo(-thrustLength - 5, 0);
      ctx.lineTo(-thrustLength, 8);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    },
    
    // Utilitários de renderização
    resizeCanvas() {
      const { canvas } = this;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Reavaliar se mobile quando o tamanho muda
      this.checkOrientation();
    },
    
    // Desenhar funções de elementos visuais do jogo (mantidas como estavam)
    drawGrid() {
      const { ctx, viewport, canvas } = this;
      const gridSize = 200;
      
      ctx.strokeStyle = 'rgba(50, 50, 50, 0.5)';
      ctx.lineWidth = 1;
      
      // Calcular limites visíveis
      const startX = Math.floor(viewport.x / gridSize) * gridSize;
      const startY = Math.floor(viewport.y / gridSize) * gridSize;
      const endX = viewport.x + canvas.width;
      const endY = viewport.y + canvas.height;
      
      // Linhas verticais
      for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x - viewport.x, 0);
        ctx.lineTo(x - viewport.x, canvas.height);
        ctx.stroke();
      }
      
      // Linhas horizontais
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y - viewport.y);
        ctx.lineTo(canvas.width, y - viewport.y);
        ctx.stroke();
      }
    },
    
    drawWorldBorder() {
      const { ctx, viewport, worldSize } = this;
      
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      
      ctx.strokeRect(
        -viewport.x, 
        -viewport.y, 
        worldSize.width, 
        worldSize.height
      );
    },
    
    drawPlayers() {
      if (!this.players.length) return;
      
      const { ctx, viewport } = this;
      
      for (const player of this.players) {
        const x = player.position.x - viewport.x;
        const y = player.position.y - viewport.y;
        
        // Verificar se está na tela
        if (x < -50 || x > viewport.width + 50 || 
            y < -50 || y > viewport.height + 50) {
          continue;
        }
        
        // Salvar contexto
        ctx.save();
        
        // Transladar e rotacionar
        ctx.translate(x, y);
        ctx.rotate(player.rotation);
        
        // Desenhar nave
        if (this.shipImage && this.shipImage.complete) {
          ctx.drawImage(this.shipImage, -15, -15, 30, 30);
        } else {
          // Fallback se a imagem não estiver disponível
          ctx.fillStyle = player.id === this.playerId ? '#4CAF50' : '#FF5722';
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(-10, -10);
          ctx.lineTo(-10, 10);
          ctx.closePath();
          ctx.fill();
        }
        
        // Destacar jogador atual
        if (player.id === this.playerId) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, player.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Restaurar contexto
        ctx.restore();
        
        // Desenhar barras de vida/escudo
        this.drawPlayerBars(player, x, y);
        
        // Desenhar nome
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, x, y - 25);
      }
    },
    
    drawPlayerBars(player, x, y) {
      const { ctx } = this;
      const barWidth = 40;
      const barHeight = 4;
      
      // Barra de vida
      const healthPercent = player.health / player.maxHealth;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x - barWidth/2, y - 20, barWidth, barHeight);
      ctx.fillStyle = healthPercent > 0.6 ? '#4CAF50' : healthPercent > 0.3 ? '#FFC107' : '#F44336';
      ctx.fillRect(x - barWidth/2, y - 20, barWidth * healthPercent, barHeight);
      
      // Barra de escudo
      if (player.shield > 0) {
        const shieldPercent = player.shield / player.maxShield;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - barWidth/2, y - 15, barWidth, barHeight);
        ctx.fillStyle = '#2196F3';
        ctx.fillRect(x - barWidth/2, y - 15, barWidth * shieldPercent, barHeight);
      }
    },
    
    drawProjectiles() {
      if (!this.projectiles.length) return;
      
      const { ctx, viewport } = this;
      
      for (const projectile of this.projectiles) {
        const x = projectile.position.x - viewport.x;
        const y = projectile.position.y - viewport.y;
        
        // Verificar se está na tela
        if (x < 0 || x > viewport.width || y < 0 || y > viewport.height) {
          continue;
        }
        
        // Cores diferentes para projéteis de jogadores vs. inimigos
        if (projectile.isEnemyProjectile) {
          ctx.fillStyle = '#ff2222';
        } else {
          ctx.fillStyle = '#ff6b6b';
        }
        
        // Desenhar projétil
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    
    // Método para desenhar inimigos - usa imagens quando disponíveis ou desenha formas
drawEnemies() {
  if (!this.enemies || !this.enemies.length) return;
  
  const { ctx, viewport } = this;
  
  for (const enemy of this.enemies) {
    const x = enemy.position.x - viewport.x;
    const y = enemy.position.y - viewport.y;
    
    // Verificar se está na tela (com margem para objetos grandes)
    if (x < -100 || x > viewport.width + 100 || 
        y < -100 || y > viewport.height + 100) {
      continue;
    }
    
    // Determinar tamanho baseado no tipo
    let size = enemy.radius || 30;
    
    // Obter a imagem correspondente ao tipo
    let enemyImage = null;
    if (this.enemyImages && this.enemyImages[enemy.type]) {
      enemyImage = this.enemyImages[enemy.type];
    }
    
    // Salvar contexto antes de transformações
    ctx.save();
    
    // Transladar para posição do inimigo e aplicar rotação
    ctx.translate(x, y);
    ctx.rotate(enemy.rotation);
    
    // Tentar desenhar usando imagem se estiver disponível e carregada
    const imageAvailable = enemyImage && enemyImage.complete && enemyImage.naturalWidth > 0;
    
    if (imageAvailable) {
      // Dimensões baseadas no tipo de inimigo
      let imageWidth, imageHeight;
      
      switch (enemy.type) {
        case 'basic':
          imageWidth = size * 2; 
          imageHeight = size * 2;
          break;
        case 'medium':
          imageWidth = size * 2.2;
          imageHeight = size * 2.2;
          break;
        case 'boss':
          imageWidth = size * 2.5;
          imageHeight = size * 2.5;
          
          // Opcional: Efeito de brilho para boss
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 15;
          break;
        default:
          imageWidth = size * 2;
          imageHeight = size * 2;
      }
      
      // Desenhar imagem centralizada na posição do inimigo
      ctx.drawImage(
        enemyImage, 
        -imageWidth/2,  // x (centralizado)
        -imageHeight/2, // y (centralizado)
        imageWidth,     // largura
        imageHeight     // altura
      );
    } 
    else {
      // Fallback: desenhar formas geométricas se imagem não estiver disponível
      switch (enemy.type) {
        case 'basic':
          // Triângulo vermelho para inimigos básicos
          ctx.fillStyle = '#ff4d4d';
          ctx.beginPath();
          ctx.moveTo(size, 0);
          ctx.lineTo(-size/2, -size/2);
          ctx.lineTo(-size/2, size/2);
          ctx.closePath();
          ctx.fill();
          
          // Pequeno detalhe para diferenciar
          ctx.fillStyle = '#ff9999';
          ctx.beginPath();
          ctx.arc(-size/4, 0, size/6, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'medium':
          // Diamante laranja para inimigos médios
          ctx.fillStyle = '#ff9900';
          ctx.beginPath();
          ctx.moveTo(size, 0);
          ctx.lineTo(0, -size/2);
          ctx.lineTo(-size, 0);
          ctx.lineTo(0, size/2);
          ctx.closePath();
          ctx.fill();
          
          // Detalhes adicionais
          ctx.fillStyle = '#ffcc66';
          ctx.beginPath();
          ctx.arc(0, 0, size/4, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'boss':
          // Hexágono vermelho escuro para bosses
          ctx.fillStyle = '#cc0000';
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI / 3) + Math.PI / 6;
            const px = Math.cos(angle) * size;
            const py = Math.sin(angle) * size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          
          // Círculo central vermelho
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(0, 0, size/3, 0, Math.PI * 2);
          ctx.fill();
          
          // Efeito pulsante para boss (usando sinusoide baseada no tempo)
          const pulseAmount = 0.1 * Math.sin(Date.now() / 200) + 1;
          ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, size * pulseAmount, 0, Math.PI * 2);
          ctx.stroke();
          break;
          
        default:
          // Forma padrão (círculo) para tipos desconhecidos
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, Math.PI * 2);
          ctx.fill();
      }
    }
    
    // Limpar sombras se aplicadas
    ctx.shadowBlur = 0;
    
    // Restaurar contexto após desenho
    ctx.restore();
    
    // Desenhar barra de vida acima do inimigo
    const barWidth = size * 2;
    const barHeight = 4;
    const healthPercent = enemy.health / enemy.maxHealth;
    
    // Fundo da barra (preto semi-transparente)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x - barWidth/2, y - size - 10, barWidth, barHeight);
    
    // Barra de vida colorida baseada na saúde
    let healthColor;
    if (healthPercent > 0.6) {
      healthColor = '#ff4d4d'; // Vermelho para inimigos mesmo com vida alta
    } else if (healthPercent > 0.3) {
      healthColor = '#ff9900'; // Laranja para vida média
    } else {
      healthColor = '#ffff00'; // Amarelo para vida baixa
    }
    
    ctx.fillStyle = healthColor;
    ctx.fillRect(x - barWidth/2, y - size - 10, barWidth * healthPercent, barHeight);
    
    // Adicionar rótulo para bosses
    if (enemy.type === 'boss') {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('BOSS', x, y - size - 15);
    }
  }
},
    
    drawMinimap() {
      // Ajustar tamanho do minimapa baseado no dispositivo
      const { ctx, canvas, worldSize, viewport } = this;
      const mapSize = this.isMobile ? 80 : 120; // Menor em dispositivos móveis
      const mapX = canvas.width - mapSize - 10;
      const mapY = canvas.height - mapSize - 10;
      const scale = mapSize / Math.max(worldSize.width, worldSize.height);
      
      // Fundo
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(mapX, mapY, mapSize, mapSize);
      
      // Borda
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(mapX, mapY, mapSize, mapSize);
      
      // Área visível
      const viewX = mapX + viewport.x * scale;
      const viewY = mapY + viewport.y * scale;
      const viewW = viewport.width * scale;
      const viewH = viewport.height * scale;
      ctx.strokeStyle = '#FFF';
      ctx.strokeRect(viewX, viewY, viewW, viewH);
      
      // Jogadores
      for (const player of this.players) {
        const x = mapX + player.position.x * scale;
        const y = mapY + player.position.y * scale;
        
        ctx.fillStyle = player.id === this.playerId ? '#4CAF50' : '#FF5722';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Inimigos no minimapa (se existirem)
      if (this.enemies && this.enemies.length > 0) {
        for (const enemy of this.enemies) {
          const x = mapX + enemy.position.x * scale;
          const y = mapY + enemy.position.y * scale;
          
          let enemyColor;
          switch(enemy.type) {
            case 'basic': enemyColor = '#ff4d4d'; break;
            case 'medium': enemyColor = '#ff9900'; break;
            case 'boss': enemyColor = '#cc0000'; break;
            default: enemyColor = '#ff0000';
          }
          
          ctx.fillStyle = enemyColor;
          ctx.beginPath();
          ctx.arc(x, y, enemy.type === 'boss' ? 3 : 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
            // Projéteis no minimapa
            ctx.fillStyle = '#ff6b6b';
      for (const projectile of this.projectiles) {
        const x = mapX + projectile.position.x * scale;
        const y = mapY + projectile.position.y * scale;
        
        if (x >= mapX && x <= mapX + mapSize && y >= mapY && y <= mapY + mapSize) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    
    // Carregar todas as imagens do jogo com padrão consistente
loadImages() {
  // Inicializar objeto de imagens de inimigos
  this.enemyImages = {
    basic: null,
    medium: null,
    boss: null
  };
  
  // Carregar imagem da nave do jogador
  this.shipImage = new Image();
  this.shipImage.onerror = () => {
    console.warn("Erro ao carregar imagem da nave - tentando caminho alternativo");
    this.shipImage.src = '/assets/ship.png';
  };
  this.shipImage.onload = () => console.log("Imagem da nave carregada com sucesso");
  this.shipImage.src = '/navs/ship.png';
  
  // Carregar imagem de projétil
  this.bulletImage = new Image();
  this.bulletImage.onerror = () => {
    console.warn("Erro ao carregar imagem do projétil - tentando caminho alternativo");
    this.bulletImage.src = '/assets/bullet.png';
  };
  this.bulletImage.onload = () => console.log("Imagem do projétil carregada com sucesso");
  this.bulletImage.src = '/navs/bullet.png';
  
  // Carregar imagem do inimigo básico
  this.enemyImages.basic = new Image();
  this.enemyImages.basic.onerror = () => {
    console.warn("Erro ao carregar imagem do inimigo básico - tentando caminho alternativo");
    this.enemyImages.basic.src = '/assets/enemy_basic.png';
  };
  this.enemyImages.basic.onload = () => console.log("Imagem do inimigo básico carregada com sucesso");
  this.enemyImages.basic.src = '/navs/basic.png';
  
  // Carregar imagem do inimigo médio
  this.enemyImages.medium = new Image();
  this.enemyImages.medium.onerror = () => {
    console.warn("Erro ao carregar imagem do inimigo médio - tentando caminho alternativo");
    this.enemyImages.medium.src = '/assets/enemy_medium.png';
  };
  this.enemyImages.medium.onload = () => console.log("Imagem do inimigo médio carregada com sucesso");
  this.enemyImages.medium.src = '/navs/medium.png';
  
  // Carregar imagem do boss
  this.enemyImages.boss = new Image();
  this.enemyImages.boss.onerror = () => {
    console.warn("Erro ao carregar imagem do boss - tentando caminho alternativo");
    this.enemyImages.boss.src = '/assets/enemy_boss.png';
  };
  this.enemyImages.boss.onload = () => console.log("Imagem do boss carregada com sucesso");
  this.enemyImages.boss.src = '/navs/boss.png';
  
  console.log("Iniciado carregamento de todas as imagens do jogo");
},
    
    // Método para enviar ping e medir latência
    sendPing() {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.lastPingSent = Date.now();
        this.socket.send(JSON.stringify({
          type: 'ping',
          timestamp: this.lastPingSent
        }));
      }
    },
    
    // Métodos para efeitos visuais
    createExplosion(x, y, size = 'normal') {
      // Impedir explosões fora da tela
      const screenX = x - this.viewport.x;
      const screenY = y - this.viewport.y;
      if (screenX < -100 || screenX > this.canvas.width + 100 || 
          screenY < -100 || screenY > this.canvas.height + 100) {
        return; // Não criar explosões fora da área visível
      }
      
      // Configurar parâmetros baseados no tamanho
      let particleCount, colors, maxSize, maxLife;
      
      switch (size) {
        case 'small':
          particleCount = 15;
          colors = ['#ff6b6b', '#ffb347', '#ffdd99'];
          maxSize = 3;
          maxLife = 30;
          break;
          
        case 'boss':
          particleCount = 50;
          colors = ['#ff0000', '#ff6b00', '#ffcc00', '#ffffff'];
          maxSize = 6;
          maxLife = 60;
          
          // Flash inicial para explosão de boss
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          this.ctx.beginPath();
          this.ctx.arc(screenX, screenY, 80, 0, Math.PI * 2);
          this.ctx.fill();
          break;
          
        case 'normal':
        default:
          particleCount = 25;
          colors = ['#ff6b6b', '#ff9e7d', '#ffce93'];
          maxSize = 4;
          maxLife = 40;
      }
      
      const particles = [];
      
      // Criar partículas
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        const size = 1 + Math.random() * maxSize;
        const life = 20 + Math.random() * maxLife;
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size,
          life,
          maxLife: life,
          color
        });
      }
      
      // Animar partículas
      const animate = () => {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          
          const opacity = p.life / p.maxLife;
          const screenX = p.x - this.viewport.x;
          const screenY = p.y - this.viewport.y;
          
          if (screenX < -50 || screenX > this.canvas.width + 50 || 
              screenY < -50 || screenY > this.canvas.height + 50) {
            particles.splice(i, 1);
            continue;
          }
          
          this.ctx.fillStyle = `${p.color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
          this.ctx.beginPath();
          this.ctx.arc(screenX, screenY, p.size * opacity, 0, Math.PI * 2);
          this.ctx.fill();
        }
        
        if (particles.length > 0) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    },
    
    // Sistema de partículas para trilhas de propulsores
    createThrustParticles() {
      if (!this.currentPlayer || !this.inputs.thrust) return;
      
      // No mobile, só criar partículas se o jogo estiver visível
      if (this.isMobile && !document.hasFocus()) return;
      
      const { rotation, position } = this.currentPlayer;
      const tailX = position.x - Math.cos(rotation) * 15;
      const tailY = position.y - Math.sin(rotation) * 15;
      
      // Verificar se está na tela ou próximo
      const screenX = tailX - this.viewport.x;
      const screenY = tailY - this.viewport.y;
      
      if (screenX < -50 || screenX > this.canvas.width + 50 || 
          screenY < -50 || screenY > this.canvas.height + 50) {
        return; // Não criar partículas se estiver fora da tela
      }
      
      // Criar partículas de propulsão
      for (let i = 0; i < 2; i++) {
        const angle = rotation + (Math.random() * 0.5 - 0.25);
        const speed = 1 + Math.random() * 2;
        const size = 1 + Math.random() * 2;
        const life = 10 + Math.random() * 15;
        
        const particle = {
          x: tailX,
          y: tailY,
          vx: -Math.cos(angle) * speed,
          vy: -Math.sin(angle) * speed,
          size,
          life,
          maxLife: life,
          color: Math.random() > 0.3 ? 'hsla(40, 100%, 60%, 0.8)' : 'hsla(15, 100%, 60%, 0.8)'
        };
        
        // Animar a partícula
        const animate = () => {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.life--;
          
          if (particle.life <= 0) return;
          
          const opacity = particle.life / particle.maxLife;
          const screenX = particle.x - this.viewport.x;
          const screenY = particle.y - this.viewport.y;
          
          // Não renderizar se estiver fora da tela
          if (screenX < 0 || screenX > this.canvas.width || 
              screenY < 0 || screenY > this.canvas.height) {
            return;
          }
          
          this.ctx.fillStyle = particle.color.replace('0.8)', `${opacity})`);
          this.ctx.beginPath();
          this.ctx.arc(screenX, screenY, particle.size * opacity, 0, Math.PI * 2);
          this.ctx.fill();
          
          requestAnimationFrame(animate);
        };
        
        animate();
      }
    },
    
    // Mostrar notificações/mensagens no jogo
    showGameMessage(message, type = 'info', duration = 3000) {
      // Criar elemento para a mensagem
      const messageEl = document.createElement('div');
      messageEl.className = `game-message game-message-${type}`;
      messageEl.textContent = message;
      
      // Estilos do elemento
      Object.assign(messageEl.style, {
        position: 'absolute',
        top: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: type === 'error' ? 'rgba(255, 0, 0, 0.7)' : 
                         type === 'success' ? 'rgba(0, 255, 0, 0.7)' : 
                         'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '5px',
        fontWeight: 'bold',
        zIndex: '100',
        opacity: '0',
        transition: 'opacity 0.3s'
      });
      
      // Adicionar ao DOM
      document.body.appendChild(messageEl);
      
      // Animar aparecimento
      setTimeout(() => {
        messageEl.style.opacity = '1';
      }, 10);
      
      // Remover após a duração
      setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => {
          if (messageEl.parentNode) {
            document.body.removeChild(messageEl);
          }
        }, 300);
      }, duration);
    },
    
    // Especificamente para dispositivos móveis, mostrar aviso sobre boss
    showBossWarning() {
      if (!this.isMobile) return;
      
      // Criar overlay de aviso
      const warningEl = document.createElement('div');
      
      // Estilos para o aviso
      Object.assign(warningEl.style, {
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(204, 0, 0, 0.8)',
        color: 'white',
        padding: '15px 25px',
        borderRadius: '8px',
        fontWeight: 'bold',
        fontSize: '20px',
        zIndex: '100',
        textAlign: 'center',
        boxShadow: '0 0 20px rgba(255, 0, 0, 0.5)',
        animation: 'bossWarningPulse 2s infinite'
      });
      
      // Adicionar ícone e texto
      warningEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right: 10px;"></i> BOSS DETECTADO!';
      
      // Criar estilo para animação
      const styleEl = document.createElement('style');
      styleEl.textContent = `
        @keyframes bossWarningPulse {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
      `;
      
      // Adicionar ao DOM
      document.head.appendChild(styleEl);
      document.body.appendChild(warningEl);
      
      // Reproduzir vibração no dispositivo se suportado
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      
      // Remover após 3 segundos
      setTimeout(() => {
        if (warningEl.parentNode) {
          document.body.removeChild(warningEl);
        }
      }, 3000);
    }
  }
}
</script>