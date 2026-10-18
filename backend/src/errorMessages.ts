import type { RoomErrorCode } from "@scrum-poker/shared";

export const ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  invalid_room_id: "El ID de sala no es válido (3-32 caracteres: letras, números o guiones).",
  invalid_name: "El nombre no es válido.",
  room_not_found: "La sala no existe.",
  room_exists: "Ya existe una sala con ese ID.",
  name_taken: "Ese nombre ya está en uso en la sala.",
  not_in_room: "No estás en esta sala.",
  invalid_vote: "La carta no es válida.",
  invalid_task: "La tarea seleccionada no es válida.",
  invalid_message: "El mensaje no es válido.",
  wrong_phase: "Esta acción no está permitida en este momento.",
};
