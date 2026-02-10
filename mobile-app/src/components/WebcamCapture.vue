<template>
  <div class="webcam-modal" v-if="isOpen">
    <div class="webcam-overlay" @click="close"></div>
    <div class="webcam-container">
      <div class="webcam-header">
        <h3>📷 Prendre une photo</h3>
        <button class="close-btn" @click="close">✕</button>
      </div>
      
      <div class="webcam-body">
        <video ref="videoEl" autoplay playsinline class="webcam-video"></video>
        <canvas ref="canvasEl" style="display:none"></canvas>
      </div>
      
      <div class="webcam-actions">
        <button class="capture-btn" @click="capture">
          <span class="capture-icon">📸</span>
          Capturer
        </button>
        <button class="cancel-btn" @click="close">Annuler</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'captured', dataUrl: string): void;
}>();

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
let stream: MediaStream | null = null;

watch(() => props.isOpen, async (open) => {
  if (open) {
    await nextTick();
    await startCamera();
  } else {
    stopCamera();
  }
});

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    if (videoEl.value) {
      videoEl.value.srcObject = stream;
    }
  } catch (err) {
    console.error('Impossible d\'accéder à la caméra', err);
    alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
    close();
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (videoEl.value) {
    videoEl.value.srcObject = null;
  }
}

function capture() {
  if (!videoEl.value || !canvasEl.value) return;
  
  const video = videoEl.value;
  const canvas = canvasEl.value;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  
  emit('captured', dataUrl);
  close();
}

function close() {
  stopCamera();
  emit('close');
}
</script>

<style scoped>
.webcam-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.webcam-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
}

.webcam-container {
  position: relative;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  max-width: 90vw;
  max-height: 90vh;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.webcam-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
  color: white;
}

.webcam-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
}

.webcam-body {
  background: #000;
}

.webcam-video {
  display: block;
  width: 100%;
  max-height: 60vh;
  object-fit: contain;
}

.webcam-actions {
  display: flex;
  gap: 12px;
  padding: 20px;
  justify-content: center;
  background: #f7fafc;
}

.capture-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.capture-btn:hover {
  opacity: 0.9;
}

.capture-icon {
  font-size: 20px;
}

.cancel-btn {
  padding: 12px 24px;
  background: #e2e8f0;
  color: #4a5568;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #cbd5e0;
}
</style>
