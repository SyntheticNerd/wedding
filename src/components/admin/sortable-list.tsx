"use client";

import { type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type Identifiable = { _id: string };

type SortableListProps<T extends Identifiable> = {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T) => ReactNode;
};

export function SortableList<T extends Identifiable>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i._id === active.id);
    const newIndex = items.findIndex((i) => i._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = items.slice();
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next.map((i) => i._id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i._id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <SortableRow key={item._id} id={item._id}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-center"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="px-2 py-3 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1">{children}</div>
    </li>
  );
}
