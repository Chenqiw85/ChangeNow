import { apiFetch } from "@/lib/api";

// ─── 类型定义 ────────────────────────────────────────

export interface Exercise {
  id: number;
  name: string;
  type: string;
  description: string;
  created_at: string;
}

export interface WorkoutSet {
  workout_log_id: number;
  exercise_id: number;
  exercise_name: string;
  exercise_type: string;
  created_at: string;
  sets: Sets[];
}

export interface Sets {
  id: number;
  set_number: number;
  weight: number;
  reps: number;
}

export interface WorkoutLog {
  id: number;
  volume: number;
  calories: number;
  performed_at: string;
  notes: string;
}

// ─── Exercise CRUD ──────────────────────────────────

/** 获取当前用户的所有训练动作 */
export async function fetchExercises(): Promise<Exercise[]> {
  const data = await apiFetch<{ exercises: Exercise[] }>("/exercises");
  return data.exercises;
}

/** 创建新的训练动作 */
export async function createExercise(
  name: string,
  type: string = "Strength training",
  description: string = ""
): Promise<Exercise> {
  return apiFetch<Exercise>("/exercises", {
    method: "POST",
    body: { name, type, description },
  });
}

/** 删除训练动作 */
export async function deleteExercise(id: number): Promise<void> {
  await apiFetch(`/exercises/${id}`, { method: "DELETE" });
}


export async function deleteSet(id:number) {
   await apiFetch(`/workouts/${id}`, { method: "DELETE" });
}

// ─── Workout 记录 ───────────────────────────────────

export async function logWorkout(
  exerciseId: number,
  sets: { set_number: number; weight: number; reps: number }[],
  performedAt?: string, 
  notes?: string
): Promise<{ workout_log_id: number }> {
  return apiFetch("/workouts", {
    method: "POST",
    body: {
      exercise_id: exerciseId,
      sets,
      performed_at: performedAt || undefined,
      notes: notes || "",
    },
  });
}

/** 获取某个训练动作的历史记录 */
export async function fetchExerciseHistory(
  exerciseId: number
): Promise<WorkoutSet[]> {
  const data = await apiFetch<{ history: WorkoutSet[] }>(
    `/exercises/${exerciseId}/history`
  );
  return data.history;
}

/** Fetch all Exercises */

export async function fetchDailyExercisesHistory(): Promise<WorkoutLog[]>{
    const data = await apiFetch<{ history: WorkoutLog[] }>(
    `/exercises/history`
  );
  return data.history;
}


export async function fetchDailyExercisesDetails(workoutlogId:number): Promise<WorkoutSet[]>{
    const data = await apiFetch<{ history: WorkoutSet[] }>(
    `/exercises/${workoutlogId}/details`
  );
  return data.history;
}