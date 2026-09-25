import React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    className={cn("brain-input", className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
