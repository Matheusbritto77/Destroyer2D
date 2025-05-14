<template>
    <div class="absolute top-4 right-4 bg-black p-4 text-white">
      <div>Score: {{ gameStats.score }}</div>
      <div>Level: {{ gameStats.level }}</div>
      <div>Health: {{ gameStats.health }}</div>
    </div>
  </template>
  
  <script setup>
  import { reactive } from 'vue';
  
  const gameStats = reactive({
    score: 0,
    level: 1,
    health: 100
  });
  </script>
  