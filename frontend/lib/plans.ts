import { apiFetch } from "@/lib/api";

// ─── 类型定义 ────────────────────────────────────────

/** 用户填写的生成请求 */
export interface GeneratePlanInput {
  goal: string;
  days_per_week: number;
  equipment: string;
  constraints: string;
}

/** 任务状态（轮询返回的） */
interface TaskStatus {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  plan_id?: string;
  error_message?: string;
}

/** AI 返回的 plan 结构（解析 plan_text 后得到的） */
export interface FitnessPlan {
  plan_name: string;
  days: PlanDay[];
  notes: string;
}

export interface PlanDay {
  day: string;
  focus: string;
  exercises: PlanExercise[];
}

export interface PlanExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
}

// ─── API 函数 ────────────────────────────────────────

/**
 * 发起计划生成请求。
 * 注意：这个不会立即返回计划内容，只返回 task_id。
 */
async function startGeneration(input: GeneratePlanInput): Promise<string> {
  const data = await apiFetch<{ task_id: string }>("/plans/generate", {
    method: "POST",
    body: input,
  });
  return data.task_id;
}

/**
 * 查询任务状态。
 */
async function checkTask(taskId: string): Promise<TaskStatus> {
  return apiFetch<TaskStatus>(`/tasks/${taskId}`);
}

/**
 * 获取计划内容。
 * plan_text 是一个 JSON 字符串，需要再 parse 一次。
 */
async function fetchPlanText(planId: string): Promise<string> {
  const data = await apiFetch<{ id: string; plan_text: string }>(
    `/plans/${planId}`
  );
  return data.plan_text;
}

/**
 * 轮询等待任务完成。
 * 每隔 intervalMs 检查一次，最多等 maxWaitMs。
 *
 * 为什么要轮询？
 * 因为 AI 生成计划可能需要 5-15 秒。后端用异步任务模式：
 * 先快速返回 task_id，后台慢慢生成，前端定期检查状态。
 */
async function pollUntilDone(
  taskId: string,
  intervalMs: number = 2000,
  maxWaitMs: number = 60000
): Promise<TaskStatus> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const task = await checkTask(taskId);

    if (task.status === "done") {
      return task;
    }
    if (task.status === "failed") {
      throw new Error(task.error_message || "Plan generation failed");
    }

    // 还没完成，等一会儿再查
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Plan generation timed out. Please try again.");
}

/**
 * 完整的生成流程：发起请求 → 轮询等待 → 获取并解析结果。
 *
 * 这是前端组件唯一需要调用的函数。
 * 调用方只需要 await generatePlan(input)，拿到结构化的 FitnessPlan。
 *
 * onStatusChange 回调让 UI 能显示当前进度（"Generating..." / "Almost there..."）
 */
export async function generatePlan(
  input: GeneratePlanInput,
  onStatusChange?: (status: string) => void
): Promise<FitnessPlan> {
  // Step 1: 发起生成
  onStatusChange?.("Sending request...");
  const taskId = await startGeneration(input);

  // Step 2: 轮询等完成
  onStatusChange?.("Generating your plan...");
  const task = await pollUntilDone(taskId);

  if (!task.plan_id) {
    throw new Error("Task completed but no plan_id returned");
  }

  // Step 3: 获取 plan 内容
  onStatusChange?.("Loading plan...");
  const planText = await fetchPlanText(task.plan_id);

  // Step 4: 解析 JSON
  // plan_text 可能包含 markdown 代码块标记，需要清理
  let cleaned = planText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const plan = JSON.parse(cleaned) as FitnessPlan;
    return plan;
  } catch {
    // 如果 AI 返回的不是有效 JSON，把原始文本包装成一个简单结构
    return {
      plan_name: "Your Fitness Plan",
      days: [],
      notes: planText,
    };
  }
}