<template>
  <div v-if="open" class="board-layer">
    <div class="board-backdrop" @click="emit('close')" />
    <aside
      class="board-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-drawer-title"
    >
      <section class="board-search">
        <div class="board-search-head">
          <h2 id="board-drawer-title">Tareas</h2>
          <button type="button" class="ghost" @click="emit('close')">Cerrar</button>
        </div>
        <label>
          Buscar
          <input
            ref="searchInput"
            v-model="query"
            type="search"
            placeholder="Filtrar por título"
          />
        </label>
        <div class="board-filters">
          <button
            type="button"
            :class="{ secondary: !activeOnly }"
            :aria-pressed="activeOnly"
            @click="activeOnly = !activeOnly"
          >
            Activas
          </button>
          <button
            type="button"
            :class="{ secondary: !unestimatedOnly }"
            :aria-pressed="unestimatedOnly"
            @click="unestimatedOnly = !unestimatedOnly"
          >
            No estimadas
          </button>
        </div>
      </section>

      <section class="board-list" aria-live="polite">
        <p v-if="loading" class="muted">Cargando tareas…</p>
        <p v-else-if="error" class="error">{{ error }}</p>
        <p v-else-if="visibleTasks.length === 0" class="muted">No hay tareas que coincidan.</p>
        <ul v-else>
          <li
            v-for="task in visibleTasks"
            :key="task.key"
            class="board-task-row"
            :class="{ selected: task.key === selectedKey, inspecting: task.key === inspected?.key }"
          >
            <button
              type="button"
              class="board-task-title"
              :title="task.title"
              :aria-expanded="task.key === inspected?.key"
              aria-controls="board-task-detail"
              @click="showDetail(task)"
            >
              {{ task.title }}
            </button>
            <button
              type="button"
              class="board-task-select"
              :aria-label="`Seleccionar ${task.title}`"
              @click="choose(task)"
            >
              Seleccionar
            </button>
          </li>
        </ul>
      </section>

      <section id="board-task-detail" class="board-detail" aria-live="polite">
        <p v-if="!inspected" class="muted">Pulsa el nombre de una tarea para ver su descripción, sus comentarios y sus adjuntos.</p>
        <template v-else>
          <h3>{{ inspected.title }}</h3>
          <p v-if="detailLoading" class="muted">Cargando detalle…</p>
          <p v-else-if="detailError" class="error">{{ detailError }}</p>
          <template v-else-if="detail">
            <h4>Descripción</h4>
            <p class="board-detail-text">{{ detail.description || "Sin descripción." }}</p>
            <h4>Adjuntos</h4>
            <p v-if="detail.attachments.length === 0" class="muted">Sin adjuntos.</p>
            <ul v-else class="board-attachments">
              <li v-for="file in detail.attachments" :key="file.id">
                <a
                  class="board-attachment"
                  :href="boardTaskAttachmentUrl(roomId, detail.key, file.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    v-if="isImage(file) && !hiddenThumbs.includes(file.id)"
                    class="board-attachment-thumb"
                    :src="boardTaskAttachmentUrl(roomId, detail.key, file.id, true)"
                    alt=""
                    @error="hideThumb(file.id)"
                  />
                  <span v-else class="board-attachment-fallback" aria-hidden="true">{{ fileExtension(file.filename) }}</span>
                  <span class="board-attachment-name" :title="file.filename">{{ file.filename }}</span>
                  <span class="muted">{{ formatSize(file.size) }}</span>
                </a>
              </li>
            </ul>
            <h4>Comentarios</h4>
            <p v-if="detail.comments.length === 0" class="muted">Sin comentarios.</p>
            <ul v-else class="board-comments">
              <li v-for="comment in detail.comments" :key="comment.id" class="board-comment">
                <header>
                  <strong>{{ comment.author }}</strong>
                  <time :datetime="comment.createdAt">{{ formatWhen(comment.createdAt) }}</time>
                </header>
                <p class="board-detail-text">{{ comment.body || "Sin texto." }}</p>
              </li>
            </ul>
          </template>
        </template>
      </section>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { filterBoardTasks, type BoardTask, type BoardTaskAttachment, type BoardTaskDetail } from "@scrum-poker/shared";
import { boardTaskAttachmentUrl, fetchBoardTaskDetail, fetchBoardTasks } from "../api";

const props = defineProps<{
  roomId: string;
  open: boolean;
  selectedKey?: string;
}>();

const emit = defineEmits<{
  close: [];
  select: [task: BoardTask];
}>();
const loading = ref(false);
const error = ref("");
const query = ref("");
const activeOnly = ref(false);
const unestimatedOnly = ref(false);
const tasks = ref<Awaited<ReturnType<typeof fetchBoardTasks>>>([]);
const searchInput = ref<HTMLInputElement | null>(null);
const inspected = ref<BoardTask | null>(null);
const detail = ref<BoardTaskDetail | null>(null);
const detailLoading = ref(false);
const detailError = ref("");
const hiddenThumbs = ref<string[]>([]);

let requestId = 0;
let detailRequestId = 0;

const visibleTasks = computed(() =>
  filterBoardTasks(tasks.value, {
    query: query.value,
    activeOnly: activeOnly.value,
    unestimatedOnly: unestimatedOnly.value,
  }),
);

function errorMessage(cause: unknown): string {
  if (typeof cause === "object" && cause && "message" in cause && typeof cause.message === "string") {
    return cause.message;
  }
  return "No se han podido cargar las tareas del panel.";
}

async function load() {
  const id = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const next = await fetchBoardTasks(props.roomId);
    if (id !== requestId) {
      return;
    }
    tasks.value = next;
  } catch (cause) {
    if (id !== requestId) {
      return;
    }
    tasks.value = [];
    error.value = errorMessage(cause);
  } finally {
    if (id === requestId) {
      loading.value = false;
    }
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    emit("close");
  }
}

function releaseOverlay() {
  window.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      releaseOverlay();
      detailRequestId += 1;
      inspected.value = null;
      detail.value = null;
      detailError.value = "";
      detailLoading.value = false;
      hiddenThumbs.value = [];
      return;
    }
    window.addEventListener("keydown", onKeydown);
    document.body.style.overflow = "hidden";
    void load();
    await nextTick();
    searchInput.value?.focus();
  },
  { immediate: true },
);

function isImage(file: BoardTaskAttachment): boolean {
  return file.mimeType.startsWith("image/");
}

function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const extension = dot >= 0 ? filename.slice(dot + 1) : "";
  const clean = extension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  return clean || "FILE";
}

function hideThumb(id: string) {
  if (!hiddenThumbs.value.includes(id)) {
    hiddenThumbs.value = [...hiddenThumbs.value, id];
  }
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  const formatted = new Intl.NumberFormat("es", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(
    value,
  );
  return `${formatted} ${units[unit]}`;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function showDetail(task: BoardTask) {
  const id = ++detailRequestId;
  inspected.value = task;
  detail.value = null;
  detailError.value = "";
  hiddenThumbs.value = [];
  detailLoading.value = true;
  try {
    const next = await fetchBoardTaskDetail(props.roomId, task.key);
    if (id !== detailRequestId) {
      return;
    }
    detail.value = next;
  } catch (cause) {
    if (id !== detailRequestId) {
      return;
    }
    detailError.value = errorMessage(cause);
  } finally {
    if (id === detailRequestId) {
      detailLoading.value = false;
    }
  }
}

function choose(task: BoardTask) {
  emit("select", task);
  emit("close");
}

onUnmounted(releaseOverlay);
</script>
