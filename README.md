# Scumm Poker

## Qué es y para qué sirve

Aplicación web de planning poker para estimar tareas de un sprint en equipo.

Varias salas pueden estar abiertas a la vez. Cada persona entra con un nombre y un avatar, elige una carta y el voto permanece oculto hasta que alguien pulsa **Revelar**. Entonces se muestra la media, redondeada a la escala de Fibonacci. **Nueva ronda** limpia los votos y empieza otra estimación.

En la sala también hay un chat para comentar y compartir enlaces. Si la sala se crea vinculada a un tablero de Jira Cloud, se pueden listar las tareas, ver adjuntos y escribir la estimación en la incidencia elegida.

Las salas vacías se conservan en Redis unas 2 horas, así que se puede recargar y volver a entrar.

## Repositorio

https://github.com/JuanGEspinal/tfm_scrumm_poker

Rama principal: `main`.

## Tecnología

Monorepo npm con tres paquetes. Node 20 o superior. TypeScript en modo estricto.

| Parte | Tecnología |
| --- | --- |
| Interfaz | Vue 3 (Composition API), Vite, Vue Router, Pinia, Socket.IO client |
| Servidor | Fastify, Socket.IO |
| Datos en tiempo real | Redis 7 (Docker) |
| Dominio compartido | `@scrum-poker/shared`: cartas, fases de la sala y nombres de eventos |
| Pruebas | Vitest |

La interfaz está en español. Los votos ajenos no salen del servidor hasta el revelado.

## Cómo ponerlo en marcha

Requisitos: Node 20+, npm y Docker.

```bash
npm install
docker compose up -d redis
npm run dev
```

- Interfaz: http://localhost:5173
- API y sockets: http://localhost:3000

Otros comandos:

```bash
npm test    # pruebas de dominio, servidor e interfaz
npm run build
```




