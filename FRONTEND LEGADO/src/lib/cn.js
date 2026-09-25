import clsx from "clsx";

/** Merge class names (shadcn-style helper without Tailwind). */
export function cn(...inputs) {
  return clsx(inputs);
}

export default cn;
