import { notFound } from "next/navigation";
import { getTask } from "@/data/tasks";
import { TaskView } from "./TaskView";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getTask(id)) notFound();
  return <TaskView taskId={id} />;
}
