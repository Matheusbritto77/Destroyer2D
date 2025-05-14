<template>
    <canvas ref="gameCanvas" class="w-full h-full"></canvas>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  
  const gameCanvas = ref(null);
  
  onMounted(() => {
    const canvas = gameCanvas.value;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      // Agora você pode usar o ctx para desenhar no canvas
    } else {
      console.error("Canvas não foi encontrado!");
    }
  });
  </script>
  
  <style scoped>
  canvas {
    display: block;
  }
  </style>
  