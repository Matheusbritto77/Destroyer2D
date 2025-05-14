<template>
    <div class="bullet" ref="bullet"></div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  
  const bullet = ref(null);
  
  // Aqui você pode adicionar lógica para manipular o bullet, como movimentação ou colisões
  </script>
  
  <style scoped>
  .bullet {
    width: 10px;
    height: 20px;
    background-color: red;
  }
  </style>
  