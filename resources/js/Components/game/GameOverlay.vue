<template>
    <div class="absolute top-0 left-0 w-full text-center p-4 z-10">
      <h1 class="text-4xl font-bold">🎮 Jogo de Nave - Destroyer 2D</h1>
      <div class="text-xl mt-4">
        <span>Score: {{ gameStats.score }}</span>
        <span class="ml-4">Level: {{ gameStats.level }}</span>
      </div>
    </div>
  </template>
  
  <script setup>
  import { reactive } from 'vue';
  
  // Estado reativo para o jogo
  const gameStats = reactive({
    score: 0,
    level: 1
  });
  </script>
  