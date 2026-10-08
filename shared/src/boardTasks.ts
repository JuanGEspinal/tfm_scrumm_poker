export type BoardTask = {
  key: string;
  title: string;
  done: boolean;
  estimated: boolean;
};

export type BoardTaskComment = {
  id: string;
  author: string;
  createdAt: string;
  body: string;
};

export type BoardTaskDetail = {
  key: string;
  description: string;
  comments: BoardTaskComment[];
};

const BOARD_TASK_KEY = /^[A-Z][A-Z0-9]+-\d+$/;

export function isBoardTaskKey(value: string): boolean {
  return BOARD_TASK_KEY.test(value);
}

export type BoardTaskFilter = {
  query: string;
  activeOnly: boolean;
  unestimatedOnly: boolean;
};

export function filterBoardTasks(tasks: readonly BoardTask[], filter: BoardTaskFilter): BoardTask[] {
  const query = filter.query.trim().toLocaleLowerCase("es");
  return tasks.filter((task) => {
    if (query && !task.title.toLocaleLowerCase("es").includes(query)) {
      return false;
    }
    if (filter.activeOnly && task.done) {
      return false;
    }
    if (filter.unestimatedOnly && task.estimated) {
      return false;
    }
    return true;
  });
}
